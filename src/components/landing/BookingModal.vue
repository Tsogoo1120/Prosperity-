<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useAvailableSlots } from '@/composables/useAvailableSlots.js'
import { services } from '@/data/union.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const { session, profile } = useAuth()

// User picks what they're booking: a tarot reading or a coaching session.
// Each has its own price; the selection drives the payment amount + service_type
// so the admin Payments queue shows exactly what was bought.
const BOOKABLE = services.filter((s) => s.id === 'tarot' || s.id === 'coaching')
const serviceId = ref('coaching')
const meetingService = computed(
  () => BOOKABLE.find((s) => s.id === serviceId.value) ?? BOOKABLE[0],
)

// step 0 = pick service + slot + topic, step 1 = payment upload, step 2 = success
const step = ref(0)
const bookDate = ref(null)
const bookSlot = ref(null)
const topic = ref('')
const bookingErr = ref('')

// Guest contact — booking does not require login. A guest signs in
// anonymously on submit, so we still collect name + email here to let the
// admin reach them with the Meet link.
const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? '').trim())
}

// payment upload state
const receiptFile = ref(null)
const uploading = ref(false)
const uploadErr = ref('')

const { rawSlots, dayMap, availDays, loadAvailableSlots } = useAvailableSlots()

const currentItems = computed(() => {
  if (!bookDate.value?.iso) return []
  return dayMap.value[bookDate.value.iso]?.items ?? []
})

watch(
  () => props.open,
  (v) => {
    if (v) {
      step.value = 0
      serviceId.value = 'coaching'
      bookSlot.value = null
      bookingErr.value = ''
      uploadErr.value = ''
      topic.value = ''
      guestName.value = profile.value?.full_name ?? ''
      guestEmail.value = profile.value?.email ?? session.value?.user?.email ?? ''
      guestPhone.value = profile.value?.phone ?? ''
      receiptFile.value = null
      bookDate.value = availDays.value[0] ?? null
      loadAvailableSlots()
    }
  },
)

watch(availDays, (days) => {
  if (days.length && !bookDate.value) bookDate.value = days[0]
})

let realtimeChannel = null

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel('booking-available-slots')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, loadAvailableSlots)
    .subscribe()
}

onMounted(() => { loadAvailableSlots(); subscribeRealtime() })
onUnmounted(() => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) })

// Step 0 → 1: validate selection + guest contact, do NOT touch DB yet.
// No login required — a guest signs in anonymously at submit time.
function confirmBooking() {
  if (!bookDate.value || !bookSlot.value) return
  bookingErr.value = ''
  if (!guestName.value.trim()) {
    bookingErr.value = 'Нэрээ оруулна уу.'
    return
  }
  if (!isValidEmail(guestEmail.value)) {
    bookingErr.value = 'Имэйл хаягаа зөв оруулна уу.'
    return
  }
  step.value = 1
}

// Step 1 → 2: upload receipt then claim the slot
async function submitPayment() {
  uploadErr.value = ''
  if (!receiptFile.value) { uploadErr.value = 'Баримтын зурагийг хавсаргана уу.'; return }

  uploading.value = true

  // Ensure a session. Guests get a real (anonymous) auth user so all existing
  // user_id / RLS / storage-path rules keep working without a login UX.
  let userId = session.value?.user?.id
  if (!userId) {
    const { data: anon, error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError || !anon?.user) {
      uploadErr.value = 'Нэвтрэхэд алдаа: ' + (anonError?.message ?? 'тодорхойгүй')
      uploading.value = false
      return
    }
    userId = anon.user.id
  }

  // Persist guest contact so the admin can email the Meet link.
  await supabase
    .from('profiles')
    .update({
      full_name: guestName.value.trim(),
      email: guestEmail.value.trim(),
      phone: guestPhone.value.trim() || null,
    })
    .eq('id', userId)

  const file = receiptFile.value
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('payment-screenshots')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    uploadErr.value = 'Баримт илгээхэд алдаа: ' + uploadError.message
    uploading.value = false
    return
  }

  const { error } = await supabase
    .from('coaching_slots')
    .update({
      status: 'pending',
      user_id: userId,
      service_type: meetingService.value?.id ?? 'coaching',
      description: topic.value || null,
      payment_screenshot_path: path,
    })
    .eq('id', bookSlot.value.id)
    .eq('status', 'available')

  if (error) {
    await supabase.storage.from('payment-screenshots').remove([path])
    uploadErr.value = 'Захиалга хадгалахад алдаа. Дахин оролдоно уу.'
    uploading.value = false
    return
  }

  // Mirror the enroll flow: every meeting booking also creates a payment
  // request so it appears in the admin Payments section. The slot is already
  // claimed at this point, so a payment-insert failure must not block success —
  // the booking still shows up as a Schedule request.
  const { data: paymentRow } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      screenshot_path: path,
      amount: meetingService.value?.price ?? null,
      currency: 'MNT',
      status: 'pending',
      service_type: meetingService.value?.id ?? 'coaching',
      bank_reference: 'TU-MEET',
    })
    .select('id')
    .single()

  // Fire-and-forget alerts — failures must not block the user
  supabase.functions
    .invoke('send-email', { body: { type: 'payment_received', userId, amount: meetingService.value?.price, currency: 'MNT' } })
    .catch(() => {})
  if (paymentRow?.id) {
    supabase.functions
      .invoke('send-email', { body: { type: 'admin_new_payment', userId, paymentId: paymentRow.id } })
      .catch(() => {})
  }

  uploading.value = false
  step.value = 2
}
</script>

<template>
  <Teleport to="body">
  <div v-if="open" class="modal-scrim" @click="emit('close')">
    <div
      class="card pop"
      style="width: 560px; max-width: 94vw; border-radius: 20px; overflow: hidden; box-shadow: var(--sh-lg)"
      @click.stop
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between"
        style="padding: 22px 26px; border-bottom: 1px solid var(--line)"
      >
        <div class="flex items-center gap-3">
          <UiAvatar name="Maren Halvorsen" color="var(--primary)" :size="40" />
          <div>
            <div style="font-weight: 600">Tsogoo-той уулзалт</div>
            <div class="muted" style="font-size: 13px">
              <span v-if="step === 0">Өдөр болон цаг сонгох</span>
              <span v-else-if="step === 1">Төлбөрийн баримт</span>
              <span v-else>Хүлээгдэж байна</span>
            </div>
          </div>
        </div>
        <button class="btn btn-quiet" style="padding: 8px" @click="emit('close')">
          <UiIcon name="x" :size="18" />
        </button>
      </div>

      <!-- Step 0: pick service + slot + topic -->
      <div v-if="step === 0" style="padding: 26px">
        <div class="kicker cool" style="margin-bottom: 14px">Үйлчилгээ сонгох</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 26px">
          <button
            v-for="svc in BOOKABLE"
            :key="svc.id"
            type="button"
            class="svccell"
            :style="{
              borderColor: serviceId === svc.id ? 'var(--primary)' : 'var(--line)',
              background: serviceId === svc.id ? 'var(--primary-tint)' : 'var(--card)',
              color: serviceId === svc.id ? 'var(--primary-deep)' : 'var(--ink)',
            }"
            @click="serviceId = svc.id"
          >
            <span style="font-weight: 600; font-size: 14.5px">{{ svc.title }}</span>
            <span style="font-size: 13px; opacity: 0.75">{{ svc.priceDisplay }}</span>
          </button>
        </div>
        <div class="kicker cool" style="margin-bottom: 14px">Өдөр сонгох</div>
        <div v-if="availDays.length" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 26px">
          <button
            v-for="day in availDays"
            :key="day.iso"
            type="button"
            class="daycell"
            :style="{
              borderColor: bookDate?.iso === day.iso ? 'var(--primary)' : 'var(--line)',
              background: bookDate?.iso === day.iso ? 'var(--primary-tint)' : 'var(--card)',
              color: bookDate?.iso === day.iso ? 'var(--primary-deep)' : 'var(--ink)',
            }"
            @click="bookDate = day; bookSlot = null"
          >
            <span style="font-size: 12px; font-weight: 600; opacity: 0.7">{{ day.d }}</span>
            <span style="font-size: 21px; font-family: var(--serif); font-weight: 600">{{ day.n }}</span>
          </button>
        </div>
        <p v-else class="muted" style="font-size: 14px; margin-bottom: 26px">Одоогоор боломжит цаг байхгүй байна.</p>
        <div class="kicker cool" style="margin-bottom: 14px">Боломжит цаг</div>
        <div v-if="currentItems.length" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px" class="slot-grid">
          <button
            v-for="item in currentItems"
            :key="item.id"
            type="button"
            class="slotcell"
            :style="{
              borderColor: bookSlot?.id === item.id ? 'var(--clay)' : 'var(--line)',
              background: bookSlot?.id === item.id ? 'var(--clay)' : 'var(--card)',
              color: bookSlot?.id === item.id ? '#fff' : 'var(--ink)',
            }"
            @click="bookSlot = item"
          >
            {{ item.time }}
          </button>
        </div>
        <p v-else-if="bookDate" class="muted" style="font-size: 14px">Энэ өдөрт боломжит цаг байхгүй эсвэл бүгд захиалагдсан байна.</p>
        <div class="field" style="margin-top: 22px">
          <label>Нэр <span style="color: var(--clay)">*</span></label>
          <input v-model="guestName" class="input" placeholder="Таны нэр" />
        </div>
        <div class="field" style="margin-top: 14px">
          <label>Имэйл <span style="color: var(--clay)">*</span></label>
          <input v-model="guestEmail" type="email" class="input" placeholder="name@example.com" />
        </div>
        <div class="field" style="margin-top: 14px">
          <label>Утас <span class="muted" style="font-weight: 400">(optional)</span></label>
          <input v-model="guestPhone" type="tel" class="input" placeholder="9911-2233" />
        </div>
        <div class="field" style="margin-top: 14px">
          <label>What would you like to focus on? <span class="muted" style="font-weight: 400">(optional)</span></label>
          <input v-model="topic" class="input" placeholder="e.g. career direction, managing stress…" />
        </div>
        <p v-if="bookingErr" style="margin-top: 14px; font-size: 13px; color: var(--bad); text-align: center">
          {{ bookingErr }}
        </p>
        <button
          class="btn btn-primary btn-block btn-lg"
          style="margin-top: 22px"
          :disabled="!bookSlot"
          @click="confirmBooking"
        >
          Үргэлжлүүлэх <UiIcon name="arrowRight" :size="17" />
        </button>
      </div>

      <!-- Step 1: payment screenshot upload -->
      <div v-else-if="step === 1" style="padding: 26px">
        <!-- selected slot recap -->
        <div
          class="flex items-center"
          style="gap: 10px; padding: 12px 14px; background: var(--primary-tint); border-radius: 12px; margin-bottom: 22px; font-size: 14px; color: var(--primary-deep)"
        >
          <UiIcon name="calendar" :size="16" />
          <span style="font-weight: 600">{{ meetingService?.title }} · {{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }} · {{ meetingService?.priceDisplay }}</span>
        </div>

        <!-- bank transfer info -->
        <div class="card card-pad" style="border-radius: 14px; margin-bottom: 18px">
          <div class="flex items-center" style="gap: 8px; margin-bottom: 12px">
            <UiIcon name="bank" :size="18" style="color: var(--primary)" />
            <span style="font-weight: 600; font-size: 14px">Банкны шилжүүлэг</span>
          </div>
          <div
            v-for="[k, v] in [['Банк','Голомт банк'],['Дансны нэр','Гэрэлцэцэг Алтанцог'],['Дансны дугаар','2705130475']]"
            :key="k"
            class="flex items-center justify-between"
            style="padding: 7px 0; border-bottom: 1px solid var(--line-soft); font-size: 13.5px"
          >
            <span class="muted">{{ k }}</span>
            <span style="font-weight: 600">{{ v }}</span>
          </div>
        </div>

        <label style="font-size: 13px; font-weight: 600; color: var(--ink-soft); display: block; margin-bottom: 10px">
          Баримтын зураг хавсаргах <span style="color: var(--clay)">*</span>
        </label>
        <ImageSlot
          id="booking-receipt"
          :radius="12"
          placeholder="Шилжүүлгийн баримтыг дуслах — эсвэл дарж нээнэ"
          style="width: 100%; height: 180px"
          @change="receiptFile = $event"
        />

        <div
          class="flex items-center"
          :style="{
            gap: '8px', marginTop: '10px', fontSize: '13.5px',
            color: receiptFile ? 'var(--good)' : 'var(--muted)',
          }"
        >
          <UiIcon :name="receiptFile ? 'checkCircle' : 'upload'" :size="16" />
          {{ receiptFile ? 'Баримт хавсарсан — илгээхэд бэлэн.' : 'PNG эсвэл JPG баримт.' }}
        </div>

        <p v-if="uploadErr" style="margin-top: 12px; font-size: 13px; color: var(--bad)">{{ uploadErr }}</p>

        <div class="flex items-center" style="gap: 10px; margin-top: 22px">
          <button class="btn btn-ghost" style="flex: none" @click="step = 0">
            <UiIcon name="arrowLeft" :size="16" /> Буцах
          </button>
          <button
            class="btn btn-primary btn-block btn-lg"
            :disabled="!receiptFile || uploading"
            @click="submitPayment"
          >
            <UiIcon v-if="uploading" name="clock" :size="17" style="animation: spin 1s linear infinite" />
            {{ uploading ? 'Илгээж байна…' : 'Захиалга илгээх' }}
          </button>
        </div>
      </div>

      <!-- Step 2: success / pending review -->
      <div v-else style="padding: 40px 26px; text-align: center">
        <div
          class="pop"
          style="width: 70px; height: 70px; border-radius: 50%; background: var(--warn-tint); color: var(--warn); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px"
        >
          <UiIcon name="clock" :size="34" />
        </div>
        <h3 style="font-size: 24px; margin-bottom: 10px">Захиалга илгээгдлээ.</h3>
        <p class="muted" style="max-width: 360px; margin: 0 auto 6px; font-size: 15px">
          {{ meetingService?.title }} · {{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }}. Баримтыг шалгасны дараа хариу болон Google Meet линкийг имэйлээр илгээнэ.
        </p>
        <button class="btn btn-ghost" style="margin-top: 22px" @click="emit('close')">Хаах</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(11, 24, 30, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fade 0.25s ease both;
}
.daycell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 0;
  border: 1.5px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.daycell:hover {
  border-color: var(--primary);
}
.slotcell {
  padding: 12px 0;
  border: 1.5px solid;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14.5px;
  transition: all 0.15s;
}
.slotcell:hover {
  border-color: var(--clay);
}
.svccell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border: 1.5px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.svccell:hover {
  border-color: var(--primary);
}
@media (max-width: 767px) {
  .slot-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

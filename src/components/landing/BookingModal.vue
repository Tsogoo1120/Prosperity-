<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const { session } = useAuth()

// step 0 = pick slot + topic, step 1 = payment upload, step 2 = success
const step = ref(0)
const bookDate = ref(null)
const bookSlot = ref(null)
const topic = ref('')
const bookingErr = ref('')
const rawSlots = ref([])

// payment upload state
const receiptFile = ref(null)
const uploading = ref(false)
const uploadErr = ref('')

async function loadAvailableSlots() {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, service_type')
    .eq('status', 'available')
    .is('user_id', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
  rawSlots.value = data ?? []
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dayMap = computed(() => {
  const map = {}
  for (const s of rawSlots.value) {
    const iso = s.start_at.slice(0, 10)
    if (!map[iso]) {
      const d = new Date(s.start_at)
      map[iso] = { iso, d: DAY_NAMES[d.getDay()], n: d.getDate(), items: [] }
    }
    const d = new Date(s.start_at)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    map[iso].items.push({ id: s.id, time: `${hh}:${mm}` })
  }
  return map
})

const availDays = computed(() => Object.values(dayMap.value))

const currentItems = computed(() => {
  if (!bookDate.value?.iso) return []
  return dayMap.value[bookDate.value.iso]?.items ?? []
})

watch(
  () => props.open,
  (v) => {
    if (v) {
      step.value = 0
      bookSlot.value = null
      bookingErr.value = ''
      uploadErr.value = ''
      topic.value = ''
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

// Step 0 → 1: validate selection, do NOT touch DB yet
function confirmBooking() {
  if (!bookDate.value || !bookSlot.value) return
  bookingErr.value = ''
  const userId = session.value?.user?.id
  if (!userId) {
    bookingErr.value = 'Нэвтэрч орно уу.'
    return
  }
  step.value = 1
}

// Step 1 → 2: upload receipt then claim the slot
async function submitPayment() {
  uploadErr.value = ''
  const userId = session.value?.user?.id
  if (!userId) { uploadErr.value = 'Нэвтэрч орно уу.'; return }
  if (!receiptFile.value) { uploadErr.value = 'Баримтын зурагийг хавсаргана уу.'; return }

  uploading.value = true

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

      <!-- Step 0: pick slot + topic -->
      <div v-if="step === 0" style="padding: 26px">
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
          <span style="font-weight: 600">{{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }}</span>
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
          {{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }}. Баримтыг шалгасны дараа хариу болон Google Meet линкийг имэйлээр илгээнэ.
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
@media (max-width: 767px) {
  .slot-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

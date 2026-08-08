<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useAvailableSlots } from '@/composables/useAvailableSlots.js'
import { services } from '@/data/union.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  // When set, pre-selects this slot's day + time after slots load (user tapped
  // a concrete available time elsewhere in the app).
  preselectSlotId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const { session, profile } = useAuth()

// This modal is the personal-reading checkout. Keep the service record as the
// single source of truth for the existing price and backend service identifier.
const meetingService = services.find((service) => service.id === 'tarot')
const tarotOptions = meetingService?.tarotOptions ?? []

// 0 = reading type, 1 = time + contact, 2 = payment, 3 = success
const step = ref(0)
const selectedTarotOption = ref(null)
const bookDate = ref(null)
const bookSlot = ref(null)
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
const accountCopied = ref(false)
let copyTimer = null

const { dayMap, availDays, slotsError, loadAvailableSlots } = useAvailableSlots()

const currentItems = computed(() => {
  if (!bookDate.value?.iso) return []
  return dayMap.value[bookDate.value.iso]?.items ?? []
})

watch(
  () => props.open,
  async (v) => {
    if (v) {
      step.value = 0
      selectedTarotOption.value = null
      bookSlot.value = null
      bookingErr.value = ''
      uploadErr.value = ''
      guestName.value = profile.value?.full_name ?? ''
      guestEmail.value = profile.value?.email ?? session.value?.user?.email ?? ''
      guestPhone.value = profile.value?.phone ?? ''
      receiptFile.value = null
      bookDate.value = availDays.value[0] ?? null
      await loadAvailableSlots()
      if (props.preselectSlotId) {
        // Jump straight to the day + time the user tapped.
        for (const day of Object.values(dayMap.value)) {
          const item = day.items.find((it) => it.id === props.preselectSlotId)
          if (item) {
            bookDate.value = day
            bookSlot.value = item
            break
          }
        }
      }
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
onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
  clearTimeout(copyTimer)
})

async function copyAccountNumber() {
  try {
    await navigator.clipboard.writeText('2705130475')
    accountCopied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { accountCopied.value = false }, 1600)
  } catch {
    // The number remains visible if clipboard access is unavailable.
  }
}

function confirmReadingType() {
  if (!selectedTarotOption.value) return
  bookingErr.value = ''
  step.value = 1
}

// Step 1 → 2: validate the slot and contact details. No login is required — a
// guest signs in anonymously only when the payment is submitted.
function confirmBooking() {
  bookingErr.value = ''
  if (!bookDate.value || !bookSlot.value) {
    bookingErr.value = 'Өдөр, цагаа сонгоорой.'
    return
  }
  if (!guestName.value.trim()) {
    bookingErr.value = 'Нэрээ бичээрэй.'
    return
  }
  if (!guestPhone.value.trim()) {
    bookingErr.value = 'Утасны дугаараа бичээрэй.'
    return
  }
  if (!isValidEmail(guestEmail.value)) {
    bookingErr.value = 'И-мэйл хаягаа зөв бичээрэй.'
    return
  }
  step.value = 2
}

// Step 2 → 3: upload the receipt, then claim the slot.
async function submitPayment() {
  uploadErr.value = ''
  if (!receiptFile.value) { uploadErr.value = 'Төлбөрийн баримтаа хавсаргаарай.'; return }

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
      service_type: meetingService?.id ?? 'tarot',
      description: selectedTarotOption.value?.title || null,
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
      amount: meetingService?.price ?? null,
      currency: 'MNT',
      status: 'pending',
      service_type: meetingService?.id ?? 'tarot',
      bank_reference: 'TU-MEET',
    })
    .select('id')
    .single()

  // Fire-and-forget alerts — failures must not block the user
  supabase.functions
    .invoke('send-email', { body: { type: 'payment_received', userId, amount: meetingService?.price, currency: 'MNT' } })
    .catch(() => {})
  if (paymentRow?.id) {
    supabase.functions
      .invoke('send-email', { body: { type: 'admin_new_payment', userId, paymentId: paymentRow.id } })
      .catch(() => {})
  }

  uploading.value = false
  step.value = 3
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-scrim" @click="emit('close')">
      <div
        class="card pop booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        @click.stop
      >
        <header class="booking-modal__head">
          <div class="booking-modal__title-wrap">
            <span class="booking-modal__mark" aria-hidden="true">
              <UiIcon name="star" :size="19" />
            </span>
            <div>
              <h2 id="booking-modal-title" class="booking-modal__title">Хувийн тарот уншлага</h2>
              <p class="booking-modal__subtitle">
                <span v-if="step === 0">Уншлагын төрлөө сонгох</span>
                <span v-else-if="step === 1">Цаг болон мэдээллээ оруулах</span>
                <span v-else-if="step === 2">Төлбөрийн баримт</span>
                <span v-else>Захиалга илгээгдсэн</span>
              </p>
            </div>
          </div>
          <button type="button" class="btn btn-quiet booking-modal__close" aria-label="Хаах" @click="emit('close')">
            <UiIcon name="x" :size="18" />
          </button>
        </header>

        <div v-if="step < 3" class="booking-progress" aria-label="Захиалгын явц">
          <span
            v-for="n in 3"
            :key="n"
            class="booking-progress__bar"
            :class="{ 'is-active': n - 1 <= step }"
          />
        </div>

        <!-- Step 0: keep the existing personal-reading types exactly as written. -->
        <section v-if="step === 0" class="booking-modal__body">
          <div class="booking-service-summary">
            <div>
              <strong>30 минутын онлайн уншлага</strong>
              <span>Өөрт тохирох төрлөө сонгоорой.</span>
            </div>
            <strong class="booking-service-summary__price">{{ meetingService?.priceDisplay }}</strong>
          </div>

          <div class="reading-options">
            <button
              v-for="option in tarotOptions"
              :key="option.id"
              type="button"
              class="reading-option"
              :class="{ 'is-selected': selectedTarotOption?.id === option.id }"
              @click="selectedTarotOption = option"
            >
              <span class="reading-option__copy">
                <strong>{{ option.title }}</strong>
                <span>{{ option.lead }}</span>
                <span v-if="selectedTarotOption?.id === option.id" class="reading-option__details">
                  <span v-for="bullet in option.bullets" :key="bullet">
                    <UiIcon name="chevRight" :size="13" /> {{ bullet }}
                  </span>
                </span>
              </span>
              <UiIcon
                :name="selectedTarotOption?.id === option.id ? 'checkCircle' : 'chevRight'"
                :size="19"
                class="reading-option__icon"
              />
            </button>
          </div>

          <button
            type="button"
            class="btn btn-primary btn-block btn-lg booking-primary-action"
            :disabled="!selectedTarotOption"
            @click="confirmReadingType"
          >
            Цаг сонгох <UiIcon name="arrowRight" :size="17" />
          </button>
        </section>

        <!-- Step 1: date, time, and contact information. -->
        <section v-else-if="step === 1" class="booking-modal__body">
          <div class="booking-recap">
            <UiIcon name="star" :size="16" />
            <span>{{ selectedTarotOption?.title }}</span>
          </div>

          <h3 class="booking-section-title">Өөрт тохирох цагаа сонгоорой</h3>
          <div class="kicker cool booking-kicker">Өдөр</div>
          <div v-if="availDays.length" class="booking-days">
            <button
              v-for="day in availDays"
              :key="day.iso"
              type="button"
              class="daycell"
              :class="{ 'is-selected': bookDate?.iso === day.iso }"
              @click="bookDate = day; bookSlot = null; bookingErr = ''"
            >
              <span class="daycell__name">{{ day.d }}</span>
              <span class="daycell__number">{{ day.n }}</span>
            </button>
          </div>
          <p v-else class="booking-empty">
            {{ slotsError ? 'Цагийн мэдээлэл ачаалагдсангүй. Түр хүлээгээд дахин оролдоорой.' : 'Одоогоор сул цаг алга байна.' }}
          </p>

          <div class="kicker cool booking-kicker booking-kicker--time">Цаг</div>
          <div v-if="currentItems.length" class="slot-grid">
            <button
              v-for="item in currentItems"
              :key="item.id"
              type="button"
              class="slotcell"
              :class="{ 'is-selected': bookSlot?.id === item.id }"
              @click="bookSlot = item; bookingErr = ''"
            >
              {{ item.time }}
            </button>
          </div>
          <p v-else-if="bookDate" class="booking-empty">Энэ өдрийн бүх цаг захиалагдсан байна.</p>

          <div class="contact-section">
            <h3 class="booking-section-title">Холбоо барих мэдээлэл</h3>
            <div class="booking-form-grid">
              <div class="field booking-form-grid__full">
                <label for="booking-name">Нэр <span class="required-mark">*</span></label>
                <input
                  id="booking-name"
                  v-model="guestName"
                  class="input"
                  autocomplete="name"
                  placeholder="Нэрээ бичээрэй"
                />
              </div>
              <div class="field">
                <label for="booking-phone">Утасны дугаар <span class="required-mark">*</span></label>
                <input
                  id="booking-phone"
                  v-model="guestPhone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  class="input"
                  placeholder="Жишээ: 9911 2233"
                />
              </div>
              <div class="field">
                <label for="booking-email">И-мэйл хаяг <span class="required-mark">*</span></label>
                <input
                  id="booking-email"
                  v-model="guestEmail"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  class="input"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <p class="email-helper">
              <UiIcon name="message" :size="15" />
              И-мэйлээ заавал зөв бичээрэй. Google Meet-ийн линкийг энэ хаяг руу явуулна.
            </p>
            <a
              class="instagram-alternative"
              href="https://www.instagram.com/tsogoo_1120/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <UiIcon name="instagram" :size="18" />
              <span>Эсвэл <strong>@tsogoo_1120</strong> хаяг руу шууд бичээд, Instagram-аар видео дуудлага хийж болно.</span>
              <UiIcon name="arrowRight" :size="16" class="instagram-alternative__arrow" />
            </a>
          </div>

          <p v-if="bookingErr" class="booking-error">{{ bookingErr }}</p>

          <div class="booking-actions">
            <button type="button" class="btn btn-ghost" @click="step = 0; bookingErr = ''">
              <UiIcon name="arrowLeft" :size="16" /> Буцах
            </button>
            <button type="button" class="btn btn-primary btn-lg" @click="confirmBooking">
              Төлбөрт үргэлжлүүлэх <UiIcon name="arrowRight" :size="17" />
            </button>
          </div>
        </section>

        <!-- Step 2: simple bank details and the existing screenshot uploader. -->
        <section v-else-if="step === 2" class="booking-modal__body">
          <div class="booking-recap booking-recap--stack-mobile">
            <UiIcon name="calendar" :size="16" />
            <span>{{ selectedTarotOption?.title }} · {{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }}</span>
          </div>

          <h3 class="booking-section-title">Уншлагын төлбөр</h3>
          <p class="payment-intro">Доорх данс руу {{ meetingService?.priceDisplay }} шилжүүлээд, баримтын зургаа хавсаргаарай.</p>

          <div class="simple-payment-card">
            <div>
              <span>Уншлагын үнэ</span>
              <strong>{{ meetingService?.priceDisplay }}</strong>
            </div>
            <button type="button" class="simple-payment-card__copy" @click="copyAccountNumber">
              <span>Дансны дугаар "Голомт банк"</span>
                            <span>Эзэмшигч: Гэрэлцэцэг Алтанцог</span>
              <span class="simple-payment-card__account-row">
                <strong class="simple-payment-card__account">2705130475</strong>
                <small><UiIcon :name="accountCopied ? 'check' : 'copy'" :size="14" /> {{ accountCopied ? 'Хуулсан' : 'Хуулах' }}</small>
              </span>
            </button>
          </div>

          <label class="receipt-label" for="booking-receipt">
            Төлбөрийн баримт <span class="required-mark">*</span>
          </label>
          <ImageSlot
            id="booking-receipt"
            class="receipt-slot"
            :radius="14"
            placeholder="Зургаа энд чирж оруулах эсвэл дарж сонгоорой"
            @change="receiptFile = $event"
          />

          <div class="receipt-status" :class="{ 'is-ready': receiptFile }">
            <UiIcon :name="receiptFile ? 'checkCircle' : 'upload'" :size="16" />
            {{ receiptFile ? 'Баримт хавсаргалаа.' : 'Төлбөрийн баримтын зургаа хавсаргаарай.' }}
          </div>

          <p v-if="uploadErr" class="booking-error">{{ uploadErr }}</p>

          <div class="booking-actions">
            <button type="button" class="btn btn-ghost" :disabled="uploading" @click="step = 1; uploadErr = ''">
              <UiIcon name="arrowLeft" :size="16" /> Буцах
            </button>
            <button
              type="button"
              class="btn btn-primary btn-lg"
              :disabled="!receiptFile || uploading"
              @click="submitPayment"
            >
              <UiIcon v-if="uploading" name="clock" :size="17" class="booking-spinner" />
              {{ uploading ? 'Илгээж байна…' : 'Захиалгаа илгээх' }}
              <UiIcon v-if="!uploading" name="arrowRight" :size="17" />
            </button>
          </div>
        </section>

        <!-- Step 3: success. -->
        <section v-else class="booking-modal__body booking-success">
          <div class="booking-success__icon">
            <UiIcon name="checkCircle" :size="38" />
          </div>
          <h3>Захиалга илгээгдлээ</h3>
          <p>
            Баримтыг тань шалгаад удахгүй баталгаажуулна. Google Meet-ийн линкийг
            <strong>{{ guestEmail }}</strong> хаяг руу явуулна.
          </p>
          <div class="booking-success__recap">
            <strong>{{ selectedTarotOption?.title }}</strong>
            <span>{{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }} · {{ meetingService?.priceDisplay }}</span>
          </div>
          <a
            class="instagram-alternative booking-success__instagram"
            href="https://www.instagram.com/tsogoo_1120/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <UiIcon name="instagram" :size="18" />
            <span>Instagram-аар видео дуудлага хийх бол <strong>@tsogoo_1120</strong> руу шууд бичээрэй.</span>
          </a>
          <button type="button" class="btn btn-primary btn-lg" @click="emit('close')">Хаах</button>
        </section>
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
  overflow-y: auto;
  animation: fade 0.25s ease both;
}

.booking-modal {
  width: min(620px, 100%);
  max-height: calc(100dvh - 40px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--sh-lg);
  display: flex;
  flex-direction: column;
}

.booking-modal__head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--line);
  background: var(--card);
}

.booking-modal__title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.booking-modal__mark {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, var(--clay), var(--clay-deep));
}

.booking-modal__title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}

.booking-modal__subtitle {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.booking-modal__close {
  flex: none;
  padding: 8px;
}

.booking-progress {
  flex: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 10px 22px 0;
  background: var(--card);
}

.booking-progress__bar {
  height: 3px;
  border-radius: 999px;
  background: var(--line);
  transition: background 0.2s ease;
}

.booking-progress__bar.is-active {
  background: var(--clay);
}

.booking-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 22px;
}

.booking-service-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: var(--clay-tint);
  color: var(--clay-deep);
}

.booking-service-summary > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}

.booking-service-summary > div strong {
  color: var(--ink);
  font-size: 14px;
}

.booking-service-summary__price {
  flex: none;
  font-family: var(--serif);
  font-size: 21px;
}

.reading-options {
  display: grid;
  gap: 9px;
}

.reading-option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 15px;
  border: 1.5px solid var(--line);
  border-radius: 13px;
  background: var(--surface-2);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
}

.reading-option:hover {
  border-color: color-mix(in srgb, var(--clay) 65%, var(--line));
  transform: translateY(-1px);
}

.reading-option.is-selected {
  border-color: var(--clay);
  background: var(--clay-tint);
}

.reading-option__copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reading-option__copy > strong {
  font-size: 14.5px;
  line-height: 1.35;
}

.reading-option__copy > span:not(.reading-option__details) {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.reading-option__details {
  display: grid;
  gap: 4px;
  margin-top: 5px;
  color: var(--ink-soft);
  font-size: 12px;
}

.reading-option__details > span {
  display: flex;
  align-items: flex-start;
  gap: 5px;
}

.reading-option__details svg {
  flex: none;
  margin-top: 2px;
  color: var(--clay);
}

.reading-option__icon {
  flex: none;
  margin-top: 1px;
  color: var(--muted);
}

.reading-option.is-selected .reading-option__icon {
  color: var(--clay);
}

.booking-primary-action {
  margin-top: 18px;
}

.booking-recap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 18px;
  border-radius: 11px;
  background: var(--clay-tint);
  color: var(--clay-deep);
  font-size: 13px;
  font-weight: 600;
}

.booking-recap svg {
  flex: none;
}

.booking-section-title {
  margin: 0 0 15px;
  font-size: 18px;
}

.booking-kicker {
  margin-bottom: 10px;
}

.booking-kicker--time {
  margin-top: 20px;
}

.booking-days {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.daycell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 11px 0;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.daycell:hover {
  border-color: var(--primary);
}

.daycell.is-selected {
  border-color: var(--primary);
  background: var(--primary-tint);
  color: var(--primary-deep);
}

.daycell__name {
  font-size: 11.5px;
  font-weight: 600;
  opacity: 0.7;
}

.daycell__number {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 600;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.slotcell {
  padding: 12px 0;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
  font-weight: 600;
  font-size: 14.5px;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.slotcell:hover {
  border-color: var(--clay);
}

.slotcell.is-selected {
  border-color: var(--clay);
  background: var(--clay);
  color: #fff;
}

.booking-empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.contact-section {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--line-soft);
}

.booking-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.booking-form-grid__full {
  grid-column: 1 / -1;
}

.required-mark {
  color: var(--clay);
}

.email-helper {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.5;
}

.email-helper svg {
  flex: none;
  margin-top: 2px;
  color: var(--primary);
}

.instagram-alternative {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 13px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--clay) 30%, var(--line));
  border-radius: 12px;
  background: color-mix(in srgb, var(--clay-tint) 55%, var(--card));
  color: var(--ink-soft);
  text-decoration: none;
  font-size: 12.5px;
  line-height: 1.45;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.instagram-alternative:hover {
  border-color: var(--clay);
  transform: translateY(-1px);
}

.instagram-alternative > svg:first-child {
  flex: none;
  color: var(--clay-deep);
}

.instagram-alternative__arrow {
  flex: none;
  margin-left: auto;
  color: var(--clay-deep);
}

.booking-error {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bad-tint);
  color: var(--bad);
  font-size: 13px;
  text-align: center;
}

.booking-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}

.payment-intro {
  margin: -7px 0 16px;
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.55;
}

.simple-payment-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-bottom: 22px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--line);
}

.simple-payment-card > div,
.simple-payment-card > button {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 17px;
  border: 0;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  text-align: left;
}

.simple-payment-card > button {
  cursor: pointer;
}

.simple-payment-card > button:hover {
  background: var(--primary-soft);
}

.simple-payment-card span {
  color: var(--muted);
  font-size: 12.5px;
}

.simple-payment-card strong {
  color: var(--clay-deep);
  font-family: var(--serif);
  font-size: 23px;
}

.simple-payment-card__account {
  font-family: inherit !important;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.simple-payment-card__account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.simple-payment-card__account-row small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-deep);
  font-family: var(--sans);
  font-size: 11.5px;
  font-weight: 600;
}

.receipt-label {
  display: block;
  margin-bottom: 9px;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
}

.receipt-slot {
  width: 100%;
  height: 190px;
}

.receipt-slot :deep(button > span:last-child) {
  display: none;
}

.receipt-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
}

.receipt-status.is-ready {
  color: var(--good);
}

.booking-spinner {
  animation: spin 1s linear infinite;
}

.booking-success {
  padding-top: 38px;
  padding-bottom: 38px;
  text-align: center;
}

.booking-success__icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: var(--good-tint);
  color: var(--good);
}

.booking-success h3 {
  margin: 0 0 9px;
  font-size: 25px;
}

.booking-success > p {
  max-width: 450px;
  margin: 0 auto;
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.6;
}

.booking-success > p strong {
  color: var(--ink);
}

.booking-success__recap {
  max-width: 430px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 20px auto 0;
  padding: 13px 15px;
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 13px;
}

.booking-success__recap span {
  color: var(--muted);
}

.booking-success__instagram {
  max-width: 430px;
  margin: 12px auto 20px;
  text-align: left;
}

@media (max-width: 767px) {
  .modal-scrim {
    align-items: flex-end;
    padding: 0;
  }

  .booking-modal {
    width: 100%;
    max-height: 96dvh;
    border-radius: 20px 20px 0 0;
  }

  .booking-modal__head {
    padding: 15px 17px;
  }

  .booking-progress {
    padding: 9px 17px 0;
  }

  .booking-modal__body {
    padding: 18px 17px calc(20px + env(safe-area-inset-bottom));
  }

  .booking-service-summary {
    align-items: flex-start;
  }

  .booking-service-summary__price {
    font-size: 19px;
  }

  .reading-option {
    padding: 13px;
  }

  .booking-days {
    gap: 6px;
  }

  .daycell {
    padding: 10px 0;
  }

  .slot-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  .booking-form-grid,
  .simple-payment-card {
    grid-template-columns: 1fr;
  }

  .booking-form-grid__full {
    grid-column: auto;
  }

  .simple-payment-card {
    gap: 1px;
  }

  .booking-actions {
    align-items: stretch;
  }

  .booking-actions .btn-primary {
    flex: 1;
  }
}

@media (max-width: 420px) {
  .booking-modal__mark {
    width: 36px;
    height: 36px;
  }

  .booking-modal__title {
    font-size: 15.5px;
  }

  .booking-modal__subtitle {
    font-size: 11.5px;
  }

  .booking-recap--stack-mobile {
    align-items: flex-start;
  }

  .booking-actions {
    gap: 8px;
  }

  .booking-actions .btn {
    padding-left: 12px;
    padding-right: 12px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

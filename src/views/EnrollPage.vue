<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { services } from '@/data/union.js'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import EnrollStepper from '@/components/enroll/EnrollStepper.vue'

const emit = defineEmits(['nav'])
const { session, profile, loading, signInWithGoogle, updateProfile } = useAuth()

const step = ref(0)
const selectedService = ref(services[0])
const selectedTarotOption = ref(null)

const form = ref({ name: '', phone: '', email: '' })
const receiptFile = ref(null)

const bookDate = ref(null)
const bookSlot = ref(null)
const bookingFromLanding = ref(false)
const pendingPrefill = ref(null)

const submitting = ref(false)
const submitError = ref('')

const DISCOUNT_RATE = 0.3

const STEP_LABELS = {
  plan: 'Үйлчилгээ',
  account: 'Бүртгэл',
  booking: 'Цаг захиалах',
  payment: 'Төлбөр',
  review: 'Батлагдсан',
}

// ── Available slots fetching ──────────────────────────────────────────────────
const rawSlots = ref([])
const loadingSlots = ref(false)

async function loadAvailableSlots() {
  loadingSlots.value = true
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, service_type')
    .eq('status', 'available')
    .is('user_id', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
  rawSlots.value = data ?? []
  loadingSlots.value = false
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар']

const dayMap = computed(() => {
  const map = {}
  // Slots are typeless now — the user already picked their service, so every
  // available slot is bookable regardless of which service they chose.
  for (const s of rawSlots.value) {
    const iso = s.start_at.slice(0, 10)
    if (!map[iso]) {
      const d = new Date(s.start_at)
      map[iso] = {
        iso,
        d: DAY_NAMES[d.getDay()],
        n: d.getDate(),
        m: d.getMonth(),
        y: d.getFullYear(),
        items: []
      }
    }
    const d = new Date(s.start_at)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    map[iso].items.push({ id: s.id, time: `${hh}:${mm}`, raw: s })
  }
  return map
})

const availDays = computed(() => Object.values(dayMap.value))

const currentMonthLabel = computed(() => {
  if (!availDays.value.length) return ''
  const first = availDays.value[0]
  return `${MONTH_NAMES[first.m]}`
})

const currentItems = computed(() => {
  if (!bookDate.value?.iso) return []
  return dayMap.value[bookDate.value.iso]?.items ?? []
})

let realtimeChannel = null
function subscribeRealtime() {
  realtimeChannel = supabase
    .channel('enroll-available-slots')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, loadAvailableSlots)
    .subscribe()
}

onUnmounted(() => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) })

const bookingComplete = computed(() => Boolean(bookDate.value && bookSlot.value))

const stepSequence = computed(() => {
  const withBooking = selectedService.value.requiresBooking
    ? ['plan', 'account', 'booking', 'payment', 'review']
    : ['plan', 'account', 'payment', 'review']
  if (bookingComplete.value) return withBooking.filter((s) => s !== 'booking')
  return withBooking
})

const stepLabels = computed(() => stepSequence.value.map((s) => STEP_LABELS[s]))
const stepType = computed(() => stepSequence.value[step.value] || 'review')

const isSubscriber = computed(
  () => profile.value?.subscription_status === 'active',
)

const intentServiceId = computed(() => pendingPrefill.value?.serviceId ?? null)

function serviceRecommendLabel(serviceId) {
  const intent = intentServiceId.value
  if (!intent) return null
  if (serviceId === intent) return 'Санал болгох'
  if (intent !== 'subscription' && serviceId === 'subscription') return 'Хөнгөлөлт авах'
  return null
}

const discountActive = computed(
  () => isSubscriber.value && selectedService.value.id !== 'subscription',
)
const basePrice = computed(() => selectedService.value.price)
const finalPrice = computed(() =>
  discountActive.value ? Math.round(basePrice.value * (1 - DISCOUNT_RATE)) : basePrice.value,
)

const googleConnected = computed(() => !!session.value)
const uploaded = computed(() => !!receiptFile.value)

const continueDisabled = computed(() => {
  if (submitting.value) return true
  if (stepType.value === 'plan')
    return selectedService.value.id === 'tarot' && !selectedTarotOption.value
  if (stepType.value === 'account')
    return !googleConnected.value
  if (stepType.value === 'booking') return !bookDate.value || !bookSlot.value
  if (stepType.value === 'payment')
    return !uploaded.value || !form.value.name || !form.value.phone
  return false
})

const maxStep = computed(() => stepLabels.value.length - 1)
const rawNext = () => (step.value = Math.min(step.value + 1, maxStep.value))
const back = () => (step.value === 0 ? emit('nav', 'landing') : step.value--)

function selectService(s) {
  selectedService.value = s
  selectedTarotOption.value = null
  if (!bookingFromLanding.value) {
    bookDate.value = null
    bookSlot.value = null
  }
}

// Skip the reset while we're restoring a saved intent (e.g. after OAuth),
// otherwise the restored step would be clobbered back to 0.
let restoringIntent = false
watch(selectedService, () => {
  if (restoringIntent) return
  if (step.value > 0) step.value = 0
})

watch(stepSequence, (seq) => {
  if (step.value >= seq.length) step.value = Math.max(0, seq.length - 1)
})

// Pre-fill form from profile when session loads
watch(
  [loading, profile],
  () => {
    if (!loading.value && profile.value) {
      form.value.name = profile.value.full_name || ''
      form.value.phone = profile.value.phone || ''
      form.value.email = profile.value.email || ''
    }
  },
  { immediate: true },
)

function applyBookingPrefill(source) {
  if (!source?.bookDate || !source?.bookSlot) return
  const day = availDays.value.find(d => d.iso === source.bookDate.iso)
  if (day) {
    bookDate.value = day
    const slot = day.items.find(s => s.time === (source.bookSlot.time || source.bookSlot))
    if (slot) {
      bookSlot.value = slot
      bookingFromLanding.value = true
    }
  }
}

// Retry prefill after rawSlots loads — at mount time slots aren't loaded yet
watch(rawSlots, () => {
  if (bookSlot.value) return // already applied
  if (pendingPrefill.value) {
    applyBookingPrefill(pendingPrefill.value)
    return
  }
  const prefillRaw = sessionStorage.getItem('union-booking-prefill')
  if (prefillRaw) {
    try { applyBookingPrefill(JSON.parse(prefillRaw)) } catch(e) {}
  }
})

function applyEnrollIntent() {
  const raw = sessionStorage.getItem('union-enroll-intent')
  if (raw) {
    sessionStorage.removeItem('union-enroll-intent')
    try {
      const intent = JSON.parse(raw)
      restoringIntent = true
      const match = services.find((s) => s.id === intent.serviceId)
      if (match) selectedService.value = match
      // Restore reading-type (tarot) sub-option so reading vs coaching survives login
      if (intent.tarotOptionId && match?.tarotOptions) {
        const opt = match.tarotOptions.find((o) => o.id === intent.tarotOptionId)
        if (opt) selectedTarotOption.value = opt
      }
      if (intent.bookDate && intent.bookSlot) {
        pendingPrefill.value = intent
        applyBookingPrefill(intent) // succeeds if rawSlots already loaded, else watcher retries
      }
      if (intent.step !== undefined) step.value = intent.step
      // Let the selectedService watcher settle without resetting the restored step
      nextTick(() => { restoringIntent = false })
    } catch {
      restoringIntent = false
      /* ignore malformed intent */
    }
  }
}

onMounted(() => {
  loadAvailableSlots()
  subscribeRealtime()
  applyEnrollIntent()
})

// ── Auth actions ──────────────────────────────────────────────────────────────

function connectGoogle() {
  // Save current state so App.vue can restore it after the OAuth redirect.
  // Include the selected slot + reading type so the user isn't sent back to
  // re-pick a slot they already chose on the landing page.
  const intent = { serviceId: selectedService.value.id, step: step.value }
  if (bookDate.value && bookSlot.value) {
    intent.bookDate = { d: bookDate.value.d, n: bookDate.value.n, iso: bookDate.value.iso }
    intent.bookSlot = { id: bookSlot.value.id, time: bookSlot.value.time }
  } else if (pendingPrefill.value?.bookDate && pendingPrefill.value?.bookSlot) {
    // Slot chosen on landing but not yet re-applied (slots still loading)
    intent.bookDate = pendingPrefill.value.bookDate
    intent.bookSlot = pendingPrefill.value.bookSlot
  }
  if (selectedTarotOption.value) intent.tarotOptionId = selectedTarotOption.value.id
  sessionStorage.setItem('union-post-oauth', JSON.stringify(intent))
  signInWithGoogle()
}

async function saveAccountProfile() {
  if (!session.value || !form.value.phone) return
  await updateProfile({ full_name: form.value.name, phone: form.value.phone })
}

// ── Payment submission ────────────────────────────────────────────────────────

async function submitPayment() {
  submitting.value = true
  submitError.value = ''

  const file = receiptFile.value
  const userId = session.value?.user?.id
  if (!file || !userId) {
    submitError.value = 'Баримтын зураг болон нэвтрэлт шаардлагатай.'
    submitting.value = false
    return
  }

  // Persist contact details collected on this step (moved here from account step)
  await saveAccountProfile()

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('payment-screenshots')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadErr) {
    submitError.value = 'Баримт илгээхэд алдаа: ' + uploadErr.message
    submitting.value = false
    return
  }

  // Claim the coaching slot if applicable
  if (bookSlot.value?.id) {
    const { error: slotErr } = await supabase
      .from('coaching_slots')
      .update({
        status: 'pending',
        user_id: userId,
        description: `Enrollment: ${selectedService.value.title}${selectedTarotOption.value ? ' - ' + selectedTarotOption.value.title : ''}`,
        payment_screenshot_path: path,
      })
      .eq('id', bookSlot.value.id)
      .eq('status', 'available')

    if (slotErr) {
      await supabase.storage.from('payment-screenshots').remove([path])
      submitError.value = 'Цаг захиалахад алдаа гарлаа. Энэ цаг аль хэдийн захиалагдсан байж магадгүй.'
      submitting.value = false
      return
    }
  }

  const { data: paymentRow, error: insertErr } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      screenshot_path: path,
      amount: finalPrice.value,
      currency: 'MNT',
      status: 'pending',
      service_type: selectedService.value.id,
      bank_reference: 'TU-' + (form.value.name.split(' ')[0]?.toUpperCase() || 'GUEST'),
    })
    .select('id')
    .single()

  if (insertErr) {
    // If we claimed a slot but payment record failed, we might want to revert the slot claim
    // but usually, we'd rather keep it pending or handle it manually.
    // For now, let's just report the error.
    submitError.value = 'Мэдээлэл хадгалахад алдаа: ' + insertErr.message
    submitting.value = false
    return
  }

  // Flip profile to pending ONLY for subscription purchases.
  // Meeting bookings (tarot/coaching) must NOT touch subscription state.
  if (selectedService.value.id === 'subscription') {
    try { await supabase.rpc('submit_payment_flip_pending') } catch {}
  }

  // Fire-and-forget emails — failures must not block the user
  if (paymentRow?.id) {
    supabase.functions
      .invoke('send-email', { body: { type: 'payment_received', userId, amount: finalPrice.value, currency: 'MNT' } })
      .catch(() => {})
    supabase.functions
      .invoke('send-email', { body: { type: 'admin_new_payment', userId, paymentId: paymentRow.id } })
      .catch(() => {})
  }

  submitting.value = false
  rawNext()
}

// ── Main continue handler ─────────────────────────────────────────────────────

async function handleContinue() {
  if (stepType.value === 'payment') {
    await submitPayment()
  } else {
    rawNext()
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

const transferRows = computed(() => [
  ['Банк', 'Голомт банк'],
  ['Дансны нэр', 'Гэрэлцэцэг Алтанцог'],
  ['Дансны дугаар', '2705130475'],
  ['IBAN', '37001500'],
  ['Гүйлгээний утга', 'TU-' + (form.value.name.split(' ')[0]?.toUpperCase() || 'GUEST')],
])

const reviewRows = computed(() => {
  const rows = [
    [
      'Үйлчилгээ',
      selectedService.value.title +
        (selectedTarotOption.value ? ` — ${selectedTarotOption.value.title}` : ''),
    ],
  ]
  if (bookDate.value && bookSlot.value)
    rows.push(['Цаг', `${bookDate.value.d} ${bookDate.value.n}, ${bookSlot.value.time}`])
  rows.push(['Дүн', fmtMNT(finalPrice.value) + (discountActive.value ? ' (30% хөнгөлөлт)' : '')])
  rows.push(['Төлөв', 'Хүлээгдэж байна'])
  return rows
})

function fmtMNT(v) {
  return v.toLocaleString('mn-MN') + ' ₮'
}

const serviceIcons = { subscription: 'book', tarot: 'star', coaching: 'heart' }
</script>

<template>
  <div class="scroll-y enroll-page">
    <!-- top bar -->
    <div class="enroll-topbar flex items-center justify-between">
      <UiLogo :size="20" />
      <button class="btn btn-quiet btn-sm" @click="emit('nav', 'landing')">
        <UiIcon name="x" :size="17" /> Цуцлах
      </button>
    </div>

    <div
      class="enroll-body"
      :class="{ 'enroll-body--review': stepType === 'review' }"
    >
      <!-- stepper -->
      <div class="card enroll-stepper-card">
        <EnrollStepper :steps="stepLabels" :active="step" />
      </div>

      <!-- ═══════════════════════ STEP 0 — Plan ═══════════════════════ -->
      <div v-if="stepType === 'plan'" class="rise enroll-step-content">
        <h2 class="enroll-step-title">Үйлчилгээгээ сонгоно уу</h2>
        <div class="enroll-subscriber-row flex items-center">
          <p class="muted" style="font-size: 15px; margin: 0">
            Subscription авсан хэрэглэгчид автоматаар
          </p>
          <span
            v-if="isSubscriber"
            class="chip"
            style="background: var(--sage-tint); color: var(--sage-deep); font-size: 12px"
          >
            30% хөнгөлөлт идэвхтэй
          </span>
          <span v-else class="muted" style="font-size: 14px; font-weight: 600; color: var(--sage-deep)">
            30% хөнгөлөлт авна
          </span>
        </div>

        <!-- service cards -->
        <div class="enroll-service-list">
          <button
            v-for="s in services"
            :key="s.id"
            class="card enroll-service-card"
            :style="{
              textAlign: 'left',
              padding: 0,
              cursor: 'pointer',
              border:
                selectedService.id === s.id
                  ? `2px solid ${s.hue}`
                  : '2px solid var(--line)',
              borderRadius: '16px',
              overflow: 'hidden',
              background: 'var(--card)',
              display: 'block',
              width: '100%',
            }"
            @click="selectService(s)"
          >
            <div class="enroll-service-card__main">
              <!-- icon badge -->
              <div
                :style="{
                  width: '52px',
                  height: '52px',
                  borderRadius: '13px',
                  flex: 'none',
                  background: `linear-gradient(150deg, ${s.hue}, color-mix(in srgb, ${s.hue} 55%, #16313f))`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }"
              >
                <UiIcon :name="serviceIcons[s.id]" :size="24" />
              </div>

              <!-- title + subtitle -->
              <div style="flex: 1; min-width: 0">
                <div class="flex items-center" style="gap: 10px; flex-wrap: wrap">
                  <h3 style="font-size: 17px; margin: 0">{{ s.title }}</h3>
                  <span
                    v-if="serviceRecommendLabel(s.id)"
                    class="chip"
                    :style="{
                      background: serviceRecommendLabel(s.id) === 'Санал болгох' ? 'var(--clay-tint)' : 'var(--sage-tint)',
                      color: serviceRecommendLabel(s.id) === 'Санал болгох' ? 'var(--clay-deep)' : 'var(--sage-deep)',
                      fontSize: '11.5px',
                    }"
                  >
                    {{ serviceRecommendLabel(s.id) }}
                  </span>
                  <span
                    v-else-if="isSubscriber && s.id !== 'subscription'"
                    class="chip"
                    style="background: var(--sage-tint); color: var(--sage-deep); font-size: 11.5px"
                  >
                    -30% хөнгөлөлт
                  </span>
                </div>
                <p class="muted" style="font-size: 13px; margin: 5px 0 0; line-height: 1.45">
                  {{ s.subtitle }}
                </p>
              </div>

              <!-- price -->
              <div style="text-align: right; flex: none">
                <div
                  v-if="isSubscriber && s.id !== 'subscription'"
                  class="muted"
                  style="font-size: 12px; text-decoration: line-through"
                >
                  {{ s.priceDisplay }}
                </div>
                <div
                  style="font-family: var(--serif); font-weight: 700; font-size: 20px; color: var(--ink)"
                >
                  <span v-if="isSubscriber && s.id !== 'subscription'">
                    {{ fmtMNT(Math.round(s.price * 0.7)) }}
                  </span>
                  <span v-else>{{ s.priceDisplay }}</span>
                </div>
                <div class="muted" style="font-size: 12px">{{ s.period }}</div>
              </div>

              <!-- selected check -->
              <div v-if="selectedService.id === s.id" style="flex: none; color: var(--clay); align-self: flex-start">
                <UiIcon name="checkCircle" :size="22" fill />
              </div>
            </div>

            <!-- features list (subscription + coaching) -->
            <div
              v-if="s.features && selectedService.id === s.id"
              class="enroll-service-features"
            >
              <div
                v-for="f in s.features"
                :key="f"
                class="flex items-center"
                style="gap: 7px; font-size: 13.5px; color: var(--ink-soft)"
              >
                <UiIcon name="check" :size="15" style="color: var(--sage-deep); flex: none" />
                {{ f }}
              </div>
            </div>

            <!-- tarot option picker -->
            <div
              v-if="s.id === 'tarot' && selectedService.id === 'tarot'"
              class="enroll-tarot-panel"
            >
              <p
                class="muted"
                style="font-size: 13px; font-weight: 600; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.04em"
              >
                Уншлагын төрөл сонгоно уу
              </p>
              <div style="display: flex; flex-direction: column; gap: 8px">
                <button
                  v-for="opt in s.tarotOptions"
                  :key="opt.id"
                  class="tarot-opt-btn"
                  :style="{
                    textAlign: 'left',
                    padding: '13px 16px',
                    borderRadius: '12px',
                    border:
                      selectedTarotOption?.id === opt.id
                        ? '1.5px solid var(--clay)'
                        : '1.5px solid var(--line)',
                    background:
                      selectedTarotOption?.id === opt.id
                        ? 'var(--clay-tint)'
                        : 'var(--surface-2)',
                    cursor: 'pointer',
                    width: '100%',
                  }"
                  @click.stop="selectedTarotOption = opt"
                >
                  <div class="flex items-start" style="gap: 10px">
                    <div style="flex: 1">
                      <div style="font-weight: 600; font-size: 14px; color: var(--ink)">
                        {{ opt.title }}
                      </div>
                      <div class="muted" style="font-size: 12.5px; margin-top: 3px; line-height: 1.45">
                        {{ opt.lead }}
                      </div>
                      <div
                        v-if="selectedTarotOption?.id === opt.id"
                        style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px"
                      >
                        <div
                          v-for="b in opt.bullets"
                          :key="b"
                          class="flex items-start"
                          style="gap: 6px; font-size: 12.5px; color: var(--ink-soft)"
                        >
                          <UiIcon name="chevRight" :size="13" style="color: var(--clay); flex: none; margin-top: 1px" />
                          {{ b }}
                        </div>
                      </div>
                    </div>
                    <UiIcon
                      v-if="selectedTarotOption?.id === opt.id"
                      name="checkCircle"
                      :size="18"
                      style="color: var(--clay); flex: none; margin-top: 1px"
                    />
                  </div>
                </button>
              </div>
              <p
                v-if="!selectedTarotOption"
                class="muted"
                style="font-size: 12.5px; margin: 10px 0 0; display: flex; align-items: center; gap: 5px"
              >
                <UiIcon name="chevDown" :size="14" /> Уншлагын төрлөө сонгосны дараа үргэлжлүүлнэ
              </p>
            </div>
          </button>
        </div>
      </div>

      <!-- ═══════════════════════ STEP 1 — Account ═══════════════════════ -->
      <div v-else-if="stepType === 'account'" class="rise enroll-step-content enroll-step-content--narrow">
        <h2 class="enroll-step-title">Бүртгэл үүсгэх</h2>
        <p class="enroll-step-lead muted">
          Үргэлжлүүлэхийн тулд Google-ээр нэвтэрнэ үү. Таны явц хадгалагдана.
        </p>

        <!-- Google connect -->
        <button
          class="btn"
          :style="{
            width: '100%',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '16px',
            border: googleConnected ? '1.5px solid var(--good)' : '1.5px solid var(--line)',
            background: googleConnected ? 'var(--good-tint)' : 'var(--card)',
            color: googleConnected ? 'var(--good)' : 'var(--ink)',
            padding: '13px 20px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '14.5px',
          }"
          :disabled="googleConnected"
          @click="connectGoogle"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span v-if="!googleConnected">Google-ээр холбох</span>
          <span v-else>Google холбогдсон · {{ session?.user?.email }}</span>
          <UiIcon v-if="googleConnected" name="check" :size="16" style="margin-left: 4px" />
        </button>

        <div
          v-if="googleConnected"
          class="flex items-start"
          style="gap: 7px; margin-bottom: 14px; font-size: 13px; color: var(--good); background: var(--good-tint); border-radius: 10px; padding: 10px 14px"
        >
          <UiIcon name="checkCircle" :size="15" style="color: var(--good); flex: none; margin-top: 1px" />
          Google холбогдлоо. Үргэлжлүүлээд нэр, утас, төлбөрийн мэдээллээ оруулна уу.
        </div>
      </div>

      <!-- ═══════════════════════ STEP 2 — Booking ═══════════════════════ -->
      <div v-else-if="stepType === 'booking'" class="rise enroll-step-content enroll-step-content--booking">
        <h2 class="enroll-step-title">Цаг захиалах</h2>
        <p class="enroll-step-lead muted">
          {{ selectedService.id === 'tarot' ? '30 минут · Онлайн уулзалт' : '1 цаг · Онлайн уулзалт' }}
        </p>
        <div class="card card-pad" style="border-radius: 16px">
          <div class="kicker cool" style="margin-bottom: 14px">{{ currentMonthLabel || 'Ажиллах өдрүүд' }}</div>
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
          <p v-else-if="!loadingSlots" class="muted" style="font-size: 14px; margin-bottom: 26px">Одоогоор боломжит цаг байхгүй байна.</p>
          <p v-else class="muted" style="font-size: 14px; margin-bottom: 26px">Уншиж байна...</p>

          <div class="kicker cool" style="margin-bottom: 14px">Боломжтой цагууд</div>
          <div v-if="currentItems.length" class="slot-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px">
            <button
              v-for="s in currentItems"
              :key="s.id"
              class="slotcell"
              :style="{
                borderColor: bookSlot?.id === s.id ? 'var(--clay)' : 'var(--line)',
                background: bookSlot?.id === s.id ? 'var(--clay)' : 'var(--card)',
                color: bookSlot?.id === s.id ? '#fff' : 'var(--ink)',
              }"
              @click="bookSlot = s"
            >
              {{ s.time }}
            </button>
          </div>
          <p v-else-if="bookDate" class="muted" style="font-size: 14px">Энэ өдөрт боломжит цаг байхгүй байна.</p>
          <p v-else class="muted" style="font-size: 14px">Өдөр сонгоно уу.</p>

          <div
            v-if="bookDate && bookSlot"
            class="flex items-center"
            style="gap: 8px; margin-top: 16px; padding: 12px 14px; background: var(--good-tint); border-radius: 10px; font-size: 14px; color: var(--good)"
          >
            <UiIcon name="checkCircle" :size="17" />
            {{ bookDate.d }} {{ bookDate.n }}-нд {{ bookSlot.time }} цагт захиалгасан
          </div>
        </div>
      </div>

      <!-- ═══════════════════════ STEP 3 — Payment ═══════════════════════ -->
      <div v-else-if="stepType === 'payment'" class="rise grid-split-enroll-pay enroll-step-content enroll-step-content--payment">
        <div>
          <h2 class="enroll-step-title">Банкны шилжүүлэг</h2>
          <p class="enroll-step-lead muted">
            Дор дурдсан дансруу шилжүүлэг хийж, баримтын зурагийг хавсаргана уу.
          </p>

          <!-- discount banner -->
          <div
            v-if="discountActive"
            class="flex items-center"
            style="gap: 10px; margin-bottom: 16px; padding: 12px 16px; background: var(--sage-tint); border-radius: 12px; color: var(--sage-deep)"
          >
            <UiIcon name="award" :size="18" style="flex: none" />
            <div style="font-size: 13.5px">
              <strong>Гишүүний хөнгөлөлт идэвхтэй.</strong>
              {{ fmtMNT(basePrice) }} → <strong>{{ fmtMNT(finalPrice) }}</strong>
              <span style="font-size: 12px"> (30% хямдарсан)</span>
            </div>
          </div>

          <div class="card card-pad" style="border-radius: 16px">
            <div class="flex items-center" style="gap: 10px; margin-bottom: 16px">
              <UiIcon name="bank" :size="20" style="color: var(--primary)" />
              <span style="font-weight: 600">Шилжүүлгийн мэдээлэл</span>
            </div>
            <div
              v-for="[k, v] in transferRows"
              :key="k"
              class="flex items-center justify-between"
              style="padding: 11px 0; border-bottom: 1px solid var(--line-soft)"
            >
              <span class="muted" style="font-size: 13.5px">{{ k }}</span>
              <span style="font-weight: 600; font-size: 14px; font-variant-numeric: tabular-nums">{{ v }}</span>
            </div>
            <div class="flex items-center justify-between" style="padding: 16px 0 4px">
              <span style="font-weight: 600">Нийт дүн</span>
              <div style="text-align: right">
                <div
                  v-if="discountActive"
                  class="muted"
                  style="font-size: 12.5px; text-decoration: line-through"
                >
                  {{ fmtMNT(basePrice) }}
                </div>
                <span style="font-family: var(--serif); font-weight: 700; font-size: 26px; color: var(--clay-deep)">
                  {{ fmtMNT(finalPrice) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-start" style="gap: 8px; margin-top: 14px; font-size: 13px; color: var(--muted)">
            <UiIcon name="shield" :size="16" style="color: var(--sage-deep); margin-top: 1px" />
            <span>Баримт хавсарсны дараа элсэлт баталгааждаг — хуудсан дээр хүлээх шаардлагагүй.</span>
          </div>
        </div>

        <div>
          <!-- Contact details (moved here from the account step) -->
          <div class="card card-pad" style="border-radius: 16px; display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px">
            <div class="flex items-center" style="gap: 10px">
              <UiIcon name="user" :size="18" style="color: var(--primary)" />
              <span style="font-weight: 600">Холбоо барих мэдээлэл</span>
            </div>
            <div class="field">
              <label>Нэр <span style="color: var(--clay)">*</span></label>
              <input v-model="form.name" class="input" placeholder="Таны нэр" />
            </div>
            <div class="field">
              <label>Утасны дугаар <span style="color: var(--clay)">*</span></label>
              <input v-model="form.phone" class="input" type="tel" placeholder="+976 ···· ····" />
            </div>
            <div class="field">
              <label>И-мэйл</label>
              <input :value="form.email || session?.user?.email || ''" class="input" type="email" disabled style="opacity: 0.6" />
            </div>
          </div>

          <label
            style="font-size: 13px; font-weight: 600; color: var(--ink-soft); display: block; margin-bottom: 10px"
          >
            Баримтын зураг хавсаргах <span style="color: var(--clay)">*</span>
          </label>
          <ImageSlot
            id="union-receipt"
            :radius="14"
            placeholder="Шилжүүлгийн баримтыг дуслах — эсвэл дарж нээнэ"
            style="width: 100%; height: min(360px, 50vh)"
            @change="receiptFile = $event"
          />
          <div
            class="flex items-center"
            :style="{
              gap: '8px',
              marginTop: '12px',
              fontSize: '13.5px',
              color: uploaded ? 'var(--good)' : 'var(--muted)',
            }"
          >
            <UiIcon :name="uploaded ? 'checkCircle' : 'upload'" :size="16" />
            {{ uploaded ? 'Баримт хавсарсан — илгээхэд бэлэн.' : 'PNG эсвэл JPG баримт.' }}
          </div>

          <!-- submit error -->
          <div
            v-if="submitError"
            class="flex items-start"
            style="gap: 8px; margin-top: 12px; padding: 12px 14px; background: var(--bad-tint); border-radius: 10px; font-size: 13px; color: var(--bad)"
          >
            <UiIcon name="x" :size="15" style="flex: none; margin-top: 1px" />
            {{ submitError }}
          </div>
        </div>
      </div>

      <!-- ═══════════════════════ STEP 4 — Review ═══════════════════════ -->
      <div v-else-if="stepType === 'review'" class="rise enroll-review">
        <div
          class="pop"
          style="
            width: 78px;
            height: 78px;
            border-radius: 50%;
            background: var(--warn-tint);
            color: var(--warn);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 22px;
          "
        >
          <UiIcon name="clock" :size="36" />
        </div>
        <h2 style="font-size: 30px; margin-bottom: 10px">Бүртгэл илгээгдлээ</h2>
        <p class="muted" style="max-width: 420px; margin: 0 auto 28px; font-size: 16px; line-height: 1.6">
          <strong style="color: var(--ink)">{{ selectedService.title }}</strong> үйлчилгээний
          төлбөрийн баримтыг хүлээн авлаа. Манай баг 24 цагийн дотор шалгаж батлана.
        </p>
        <div
          class="card card-pad"
          style="border-radius: 16px; max-width: 420px; margin: 0 auto 28px; text-align: left"
        >
          <div
            v-for="([k, v], i) in reviewRows"
            :key="k"
            class="flex items-center justify-between"
            :style="{
              padding: '9px 0',
              borderBottom: i < reviewRows.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }"
          >
            <span class="muted" style="font-size: 14px">{{ k }}</span>
            <span v-if="k === 'Төлөв'" class="chip warn">{{ v }}</span>
            <span v-else style="font-weight: 600; font-size: 14px">{{ v }}</span>
          </div>
        </div>
        <div class="flex items-center justify-center" style="gap: 12px">
          <button class="btn btn-ghost" @click="emit('nav', 'landing')">Нүүр хуудас</button>
          <button class="btn btn-primary" @click="emit('nav', 'student')">
            Платформыг үзэх <UiIcon name="arrowRight" :size="17" />
          </button>
        </div>
      </div>

      <!-- ═══════════════════════ footer nav ═══════════════════════ -->
      <div
        v-if="stepType !== 'review'"
        class="flex items-center justify-between enroll-footer-nav"
        :class="{
          'enroll-footer-nav--narrow': stepType === 'account',
          'enroll-footer-nav--booking': stepType === 'booking',
        }"
      >
        <button class="btn btn-ghost" @click="back">
          <UiIcon name="arrowLeft" :size="17" /> Буцах
        </button>
        <div class="flex items-center" style="gap: 16px">
          <span v-if="stepType === 'payment'" class="muted" style="font-size: 13.5px; align-self: center">
            {{ fmtMNT(finalPrice) }} · {{ selectedService.title }}
          </span>
          <button
            class="btn btn-primary btn-lg"
            :disabled="continueDisabled"
            @click="handleContinue"
          >
            <UiIcon v-if="submitting" name="clock" :size="17" style="animation: spin 1s linear infinite" />
            {{ stepType === 'payment' ? 'Бүртгэл илгээх' : 'Үргэлжлүүлэх' }}
            <UiIcon v-if="!submitting" name="arrowRight" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.enroll-page {
  height: 100vh;
  overflow-y: auto;
  background: var(--surface-2);
}

.enroll-topbar {
  padding: 16px 16px 14px;
  max-width: 1080px;
  margin: 0 auto;
}

.enroll-body {
  max-width: 1080px;
  margin: 0 auto;
  padding: 4px 16px calc(56px + env(safe-area-inset-bottom, 0px));
}

.enroll-body--review {
  max-width: 620px;
}

.enroll-stepper-card {
  padding: 18px 16px;
  border-radius: 16px;
  margin-bottom: 20px;
}

.enroll-step-title {
  font-size: clamp(24px, 4.8vw, 30px);
  margin: 0 0 8px;
  line-height: 1.2;
}

.enroll-step-lead {
  margin: 0 0 22px;
  font-size: 15px;
  line-height: 1.55;
}

.enroll-subscriber-row {
  gap: 10px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.enroll-service-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.enroll-service-card__main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
}

.enroll-service-features {
  padding: 0 16px 14px 66px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enroll-tarot-panel {
  border-top: 1px solid var(--line-soft);
  padding: 14px 16px 16px;
}

.enroll-step-content--narrow {
  max-width: 540px;
}

.enroll-step-content--booking {
  max-width: 580px;
}

.enroll-review {
  text-align: center;
  padding: 12px 0 8px;
}

.enroll-footer-nav {
  margin-top: 24px;
}

.enroll-footer-nav--narrow {
  max-width: 540px;
}

.enroll-footer-nav--booking {
  max-width: 580px;
}

@media (min-width: 768px) {
  .enroll-topbar {
    padding: 20px 32px 18px;
  }

  .enroll-body {
    padding: 8px 32px 72px;
  }

  .enroll-stepper-card {
    padding: 22px 28px;
    border-radius: 18px;
    margin-bottom: 28px;
  }

  .enroll-step-lead {
    margin-bottom: 26px;
    font-size: 15.5px;
  }

  .enroll-subscriber-row {
    margin-bottom: 26px;
  }

  .enroll-service-list {
    gap: 14px;
  }

  .enroll-service-card__main {
    gap: 16px;
    padding: 20px 22px;
  }

  .enroll-service-features {
    padding: 0 22px 18px 90px;
  }

  .enroll-tarot-panel {
    padding: 18px 22px;
  }

  .enroll-review {
    padding: 20px 0;
  }

  .enroll-footer-nav {
    margin-top: 28px;
  }
}

@media (min-width: 1024px) {
  .enroll-topbar {
    padding-left: 40px;
    padding-right: 40px;
  }

  .enroll-body {
    padding-left: 40px;
    padding-right: 40px;
  }

  .enroll-stepper-card {
    padding: 24px 30px;
  }
}

@media (max-width: 767px) {
  .enroll-subscriber-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .enroll-step-lead {
    margin-bottom: 18px;
  }
}

.enroll-service-card {
  transition: border-color 0.15s, box-shadow 0.15s;
}
.enroll-service-card:hover {
  box-shadow: var(--sh-md);
}
.tarot-opt-btn {
  transition: border-color 0.15s, background 0.15s;
}
.tarot-opt-btn:hover {
  border-color: var(--clay) !important;
}
.daycell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 0;
  border: 1.5px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.daycell:not(:disabled):hover {
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
@keyframes spin {
  to { transform: rotate(360deg); }
}
@media (max-width: 767px) {
  .slot-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
</style>

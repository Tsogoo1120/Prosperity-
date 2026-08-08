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

const subscriptionService = services.find((service) => service.id === 'subscription') ?? services[0]
const step = ref(0)

const form = ref({ name: '', phone: '', email: '' })
const receiptFile = ref(null)

const submitting = ref(false)
const submitError = ref('')

const STEP_LABELS = {
  account: 'Бүртгэл',
  payment: 'Төлбөр',
  review: 'Илгээсэн',
}

onUnmounted(() => {
  clearTimeout(copiedTimer)
})

const googleConnected = computed(() => !!session.value)

const stepSequence = ['account', 'payment', 'review']
const stepLabels = stepSequence.map((stepName) => STEP_LABELS[stepName])
const stepType = computed(() => stepSequence[step.value] || 'review')
const finalPrice = computed(() => subscriptionService.price)

const uploaded = computed(() => !!receiptFile.value)

const continueDisabled = computed(() => {
  if (submitting.value) return true
  if (stepType.value === 'account')
    return !googleConnected.value
  if (stepType.value === 'payment')
    return !uploaded.value || !form.value.name || !form.value.phone
  return false
})

const maxStep = stepSequence.length - 1
const rawNext = () => (step.value = Math.min(step.value + 1, maxStep))
const back = () => (step.value === 0 ? emit('nav', 'landing') : step.value--)

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

function applyEnrollIntent() {
  const raw = sessionStorage.getItem('union-enroll-intent')
  if (raw) {
    sessionStorage.removeItem('union-enroll-intent')
    try {
      const intent = JSON.parse(raw)
      if (intent.stepName) {
        const idx = stepSequence.indexOf(intent.stepName)
        step.value = idx >= 0 ? idx : 0
      } else if (Number.isInteger(intent.step)) {
        step.value = Math.min(Math.max(intent.step, 0), maxStep)
      }
    } catch {
      /* ignore malformed intent */
    }
  }
}

// After the OAuth redirect the page reloads with screen already at 'enroll',
// so this component mounts BEFORE App.vue transfers the post-oauth payload
// into 'union-enroll-intent'. Re-check once auth settles; nextTick guarantees
// App.vue's own watcher (registered earlier) has already written the intent.
watch([loading, session, profile], async () => {
  if (loading.value || !session.value || !profile.value) return
  await nextTick()
  applyEnrollIntent()
})

onMounted(() => {
  applyEnrollIntent()
})

// ── Auth actions ──────────────────────────────────────────────────────────────

function connectGoogle() {
  // Save the current subscription step so App.vue can restore it after OAuth.
  const intent = { serviceId: subscriptionService.id, stepName: stepType.value }
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

  // Payment insert + subscription activation run atomically server-side.
  const { data: paymentId, error: rpcErr } = await supabase.rpc('submit_enrollment', {
    p_screenshot_path: path,
    p_amount: finalPrice.value,
    p_service_type: subscriptionService.id,
    p_bank_reference: bankReference.value,
    p_slot_id: null,
    p_slot_description: null,
  })

  if (rpcErr) {
    await supabase.storage.from('payment-screenshots').remove([path]).catch(() => {})
    submitError.value = 'Мэдээлэл хадгалахад алдаа: ' + rpcErr.message
    submitting.value = false
    return
  }

  // Fire-and-forget emails — failures must not block the user
  if (paymentId) {
    supabase.functions
      .invoke('send-email', { body: { type: 'payment_received', userId, amount: finalPrice.value, currency: 'MNT' } })
      .catch(() => {})
    supabase.functions
      .invoke('send-email', { body: { type: 'admin_new_payment', userId, paymentId } })
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

const bankReference = computed(
  () => 'TU-' + (form.value.name.split(' ')[0]?.toUpperCase() || 'GUEST'),
)

const transferRows = computed(() => [
  { label: 'Дансны дугаар', value: '2705130475', copy: true },
])

// Click-to-copy so the user never re-types the account number or reference
const copiedKey = ref('')
let copiedTimer = null
async function copyValue(key, value) {
  try {
    await navigator.clipboard.writeText(value)
    copiedKey.value = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copiedKey.value = ''), 1600)
  } catch {
    /* clipboard unavailable — value stays visible for manual copy */
  }
}

// One clear reason why the submit button is disabled — instead of a dead button
const paymentHint = computed(() => {
  if (stepType.value !== 'payment' || submitting.value) return ''
  if (!form.value.name) return 'Нэрээ оруулна уу'
  if (!form.value.phone) return 'Утасны дугаараа оруулна уу'
  if (!uploaded.value) return 'Баримтын зургаа хавсаргана уу'
  return ''
})

const reviewRows = computed(() => {
  const rows = [
    ['Үйлчилгээ', subscriptionService.title],
  ]
  rows.push(['Дүн', fmtMNT(finalPrice.value)])
  rows.push(['Төлөв', 'Хүлээгдэж байна'])
  return rows
})

function fmtMNT(v) {
  return v.toLocaleString('mn-MN') + ' ₮'
}

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

      <!-- ═══════════════════════ STEP 1 — Account ═══════════════════════ -->
      <div v-if="stepType === 'account'" class="rise enroll-step-content enroll-step-content--narrow">
        <div class="kicker cool" style="margin-bottom: 12px">Онлайн хичээл</div>
        <h2 class="enroll-step-title">Шинээр хэргэлэгч болох</h2>
        <p class="enroll-step-lead muted">
          Видео хичээлээ үзэхийн тулд Gmail хаягаараа нэвтэрч ороорой
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
          <span v-if="!googleConnected">Google хаягаараа үргэлжлүүлэх</span>
          <span v-else>Google холбогдсон · {{ session?.user?.email }}</span>
          <UiIcon v-if="googleConnected" name="check" :size="16" style="margin-left: 4px" />
        </button>

        <div
          v-if="googleConnected"
          class="flex items-start"
          style="gap: 7px; margin-bottom: 14px; font-size: 13px; color: var(--good); background: var(--good-tint); border-radius: 10px; padding: 10px 14px"
        >
          <UiIcon name="checkCircle" :size="15" style="color: var(--good); flex: none; margin-top: 1px" />
          Google хаяг холбогдлоо. Одоо төлбөрийн баримтаа оруулахад л болно.
        </div>
      </div>

      <!-- ═══════════════════════ STEP 2 — Payment ═══════════════════════ -->
      <div v-else-if="stepType === 'payment'" class="rise grid-split-enroll-pay enroll-step-content enroll-step-content--payment">
        <div>
          <div class="kicker cool" style="margin-bottom: 12px">Subscription үйлчилгээ</div>
          <h2 class="enroll-step-title">Гишүүнчлэлийн төлбөр</h2>
          <div class="enroll-pay-steps">
            <div class="enroll-pay-step">
              <span class="enroll-pay-step__num">1</span>
              Доорх данс руу <strong>{{ fmtMNT(finalPrice) }}</strong> шилжүүлээрэй
            </div>
            <div class="enroll-pay-step">
              <span class="enroll-pay-step__num">2</span>
              Баримтын зургаа оруулаад илгээнэ
            </div>
          </div>

          <div class="card card-pad" style="border-radius: 16px">
            <div class="flex items-center" style="gap: 10px; margin-bottom: 16px">
              <UiIcon name="bank" :size="20" style="color: var(--primary)" />
              <span style="font-weight: 600">Төлбөр хийх данс</span>
            </div>
            <div
              v-for="row in transferRows"
              :key="row.label"
              class="flex items-center justify-between"
              style="padding: 11px 0; border-bottom: 1px solid var(--line-soft)"
            >
              <span class="muted" style="font-size: 13.5px">{{ row.label }}</span>
              <span class="flex items-center" style="gap: 8px">
                <span style="font-weight: 600; font-size: 14px; font-variant-numeric: tabular-nums">{{ row.value }}</span>
                <button
                  v-if="row.copy"
                  type="button"
                  class="copy-btn"
                  :class="{ 'copy-btn--done': copiedKey === row.label }"
                  :aria-label="'Хуулах: ' + row.label"
                  @click="copyValue(row.label, row.value)"
                >
                  <UiIcon :name="copiedKey === row.label ? 'check' : 'copy'" :size="14" />
                  {{ copiedKey === row.label ? 'Хуулсан' : 'Хуулах' }}
                </button>
              </span>
            </div>
            <div class="flex items-center justify-between" style="padding: 16px 0 4px">
              <span style="font-weight: 600">Нийт дүн</span>
              <div style="text-align: right">
                <span class="flex items-center" style="gap: 8px; justify-content: flex-end">
                  <span style="font-family: var(--serif); font-weight: 700; font-size: 26px; color: var(--clay-deep)">
                    {{ fmtMNT(finalPrice) }}
                  </span>
                  <button
                    type="button"
                    class="copy-btn"
                    :class="{ 'copy-btn--done': copiedKey === 'amount' }"
                    aria-label="Дүн хуулах"
                    @click="copyValue('amount', String(finalPrice))"
                  >
                    <UiIcon :name="copiedKey === 'amount' ? 'check' : 'copy'" :size="14" />
                    {{ copiedKey === 'amount' ? 'Хуулсан' : 'Хуулах' }}
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-start" style="gap: 8px; margin-top: 14px; font-size: 13px; color: var(--muted)">
            <UiIcon name="shield" :size="16" style="color: var(--sage-deep); margin-top: 1px" />
            <span>Баримтаа илгээсний дараа энд хүлээх шаардлагагүй. Шалгаад гишүүнчлэлийг тань нээнэ.</span>
          </div>
        </div>

        <div>
          <!-- Contact details (moved here from the account step) -->
          <div class="card card-pad" style="border-radius: 16px; display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px">
            <div class="flex items-center" style="gap: 10px">
              <UiIcon name="user" :size="18" style="color: var(--primary)" />
              <span style="font-weight: 600">Таны мэдээлэл</span>
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
            Төлбөрийн баримт <span style="color: var(--clay)">*</span>
          </label>
          <ImageSlot
            id="union-receipt"
            :radius="14"
            placeholder="Баримтын зургаа энд оруулаарай"
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
            {{ uploaded ? 'Баримт хавсаргалаа.' : 'Зургаа чирж оруулах эсвэл дарж сонгоорой.' }}
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

      <!-- ═══════════════════════ STEP 3 — Review ═══════════════════════ -->
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
        <h2 style="font-size: 30px; margin-bottom: 10px">Баримт илгээгдлээ</h2>
        <p class="muted" style="max-width: 420px; margin: 0 auto 28px; font-size: 16px; line-height: 1.6">
          Одоо өөр хийх зүйлгүй. Төлбөрийг шалгаад Subscription эрхийг тань идэвхжүүлнэ.
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
        }"
      >
        <button class="btn btn-ghost" @click="back">
          <UiIcon name="arrowLeft" :size="17" /> Буцах
        </button>
        <div class="flex items-center" style="gap: 16px">
          <span
            v-if="stepType === 'payment' && paymentHint"
            style="font-size: 13.5px; align-self: center; color: var(--clay-deep); font-weight: 600"
          >
            {{ paymentHint }}
          </span>
          <span v-else-if="stepType === 'payment'" class="muted" style="font-size: 13.5px; align-self: center">
            {{ fmtMNT(finalPrice) }} · {{ subscriptionService.title }}
          </span>
          <button
            class="btn btn-primary btn-lg"
            :disabled="continueDisabled"
            @click="handleContinue"
          >
            <UiIcon v-if="submitting" name="clock" :size="17" style="animation: spin 1s linear infinite" />
            {{ stepType === 'payment' ? (submitting ? 'Илгээж байна…' : 'Баримтаа илгээх') : 'Үргэлжлүүлэх' }}
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

.enroll-step-content--narrow {
  max-width: 540px;
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
  .enroll-step-lead {
    margin-bottom: 18px;
  }
}

.enroll-pay-steps {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0 0 20px;
}

.enroll-pay-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.45;
}

.enroll-pay-step__num {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-tint);
  color: var(--primary-deep);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  white-space: nowrap;
}
.copy-btn:hover {
  border-color: var(--primary);
  color: var(--primary-deep);
}
.copy-btn--done {
  border-color: var(--good);
  background: var(--good-tint);
  color: var(--good);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

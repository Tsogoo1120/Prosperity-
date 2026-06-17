<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const { session } = useAuth()

const list = ref([])
const sel = ref(null)
const screenshotUrl = ref('')
const loadingList = ref(true)
const acting = ref(false)
const actError = ref('')

const DURATION_DAYS = 30

const SERVICE_NAMES = { subscription: 'Subscription', tarot: 'Тарот уншлага', coaching: '1:1 Coaching' }

const stat = {
  pending: { c: 'warn', t: 'Хүлээгдэж байна' },
  approved: { c: 'good', t: 'Батлагдсан' },
  denied: { c: 'bad', t: 'Татгалзсан' },
}

const pendingList = computed(() => list.value.filter((p) => p.status === 'pending'))

async function loadPayments() {
  loadingList.value = true
  const { data, error } = await supabase
    .from('payments')
    .select('*, profiles(full_name, email, phone, avatar_url, subscription_status, subscription_expires_at)')
    .order('created_at', { ascending: false })

  if (!error && data) {
    list.value = data
    if (!sel.value && data.length) sel.value = data[0]
    else if (sel.value) {
      // Refresh selected item
      const refreshed = data.find((p) => p.id === sel.value.id)
      if (refreshed) sel.value = refreshed
    }
  }
  loadingList.value = false
}

async function loadScreenshot(payment) {
  screenshotUrl.value = ''
  if (!payment?.screenshot_path) return
  const { data } = await supabase.storage
    .from('payment-screenshots')
    .createSignedUrl(payment.screenshot_path, 3600)
  if (data?.signedUrl) screenshotUrl.value = data.signedUrl
}

watch(sel, (p) => { if (p) loadScreenshot(p) })

onMounted(loadPayments)

function selectPayment(p) {
  sel.value = p
  actError.value = ''
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMNT(v) {
  return Number(v).toLocaleString('mn-MN') + ' ₮'
}

const enrollmentRows = computed(() => {
  if (!sel.value) return []
  const p = sel.value
  const profile = p.profiles
  return [
    ['Үйлчилгээ', SERVICE_NAMES[p.service_type] || p.service_type || '—'],
    ['Дүн', fmtMNT(p.amount)],
    ['Лавлагаа', p.bank_reference || '—'],
    ['Илгээсэн', fmtDate(p.created_at)],
    ['Утас', profile?.phone || '—'],
    ['Хэрэглэгчийн статус', profile?.subscription_status || '—'],
  ]
})

async function setPaymentStatus(id, status) {
  return supabase
    .from('payments')
    .update({
      status,
      reviewed_by: session.value.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function approvePayment() {
  if (!sel.value || !session.value) return
  acting.value = true
  actError.value = ''

  const payment = sel.value
  const userId = payment.user_id

  const { error: payErr } = await setPaymentStatus(payment.id, 'approved')

  if (payErr) {
    actError.value = 'Алдаа: ' + payErr.message
    acting.value = false
    return
  }

  // Renewal-aware expiry: extend from max(now, existing_expiry)
  const now = new Date()
  const existing = payment.profiles?.subscription_expires_at
    ? new Date(payment.profiles.subscription_expires_at)
    : null
  const base = existing && existing > now ? existing : now
  const newExpiry = new Date(base.getTime() + DURATION_DAYS * 24 * 60 * 60 * 1000)

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_expires_at: newExpiry.toISOString(),
      expiry_reminder_stage: 0,
    })
    .eq('id', userId)

  if (profErr) {
    actError.value = 'Профайл шинэчлэхэд алдаа: ' + profErr.message
  }

  // Fire-and-forget — email failure must not block admin workflow
  supabase.functions
    .invoke('send-email', { body: { type: 'payment_approved', userId } })
    .catch(() => {})

  acting.value = false
  await loadPayments()
}

async function denyPayment() {
  if (!sel.value || !session.value) return
  acting.value = true
  actError.value = ''

  const payment = sel.value

  const { error: payErr } = await setPaymentStatus(payment.id, 'denied')

  if (payErr) {
    actError.value = 'Алдаа: ' + payErr.message
    acting.value = false
    return
  }

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ subscription_status: 'denied' })
    .eq('id', payment.user_id)

  if (profErr) {
    actError.value = 'Профайл шинэчлэхэд алдаа: ' + profErr.message
  }

  // Fire-and-forget — email failure must not block admin workflow
  supabase.functions
    .invoke('send-email', { body: { type: 'payment_denied', userId: payment.user_id, adminNote: null } })
    .catch(() => {})

  acting.value = false
  await loadPayments()
}
</script>

<template>
  <div class="grid-split-admin-pay" style="flex: 1">
    <!-- queue list -->
    <div class="scroll-y" style="border-right: 1px solid var(--line); overflow-y: auto; background: var(--card)">
      <div style="padding: 18px 22px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--card); z-index: 2">
        <div class="flex items-center justify-between">
          <h3 style="font-size: 16px">Төлбөрийн дараалал</h3>
          <span class="chip warn">{{ pendingList.length }} хүлээгдэж байна</span>
        </div>
      </div>

      <!-- loading state -->
      <div v-if="loadingList" style="padding: 32px; text-align: center; color: var(--muted); font-size: 14px">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.4" />
        Уншиж байна…
      </div>

      <div v-else-if="!list.length" style="padding: 32px; text-align: center; color: var(--muted); font-size: 14px">
        Төлбөр байхгүй байна.
      </div>

      <button
        v-for="p in list"
        :key="p.id"
        class="flex w-full items-center text-left"
        :style="{
          gap: '12px',
          padding: '15px 22px',
          border: 'none',
          borderBottom: '1px solid var(--line-soft)',
          cursor: 'pointer',
          background: sel?.id === p.id ? 'var(--primary-soft)' : 'transparent',
          borderLeft: sel?.id === p.id ? '3px solid var(--primary)' : '3px solid transparent',
        }"
        @click="selectPayment(p)"
      >
        <UiAvatar :name="p.profiles?.full_name || p.profiles?.email || '?'" :size="40" />
        <div style="flex: 1; min-width: 0">
          <div class="flex items-center justify-between">
            <span style="font-weight: 600; font-size: 14px">{{ p.profiles?.full_name || '—' }}</span>
          </div>
          <div class="muted" style="font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ p.profiles?.email }}
          </div>
          <div class="flex items-center justify-between" style="margin-top: 5px">
            <span :class="'chip ' + (stat[p.status]?.c || 'warn')" style="font-size: 11px; padding: 2px 8px">
              {{ stat[p.status]?.t || p.status }}
            </span>
            <span class="muted" style="font-size: 11.5px">{{ fmtDate(p.created_at) }}</span>
          </div>
        </div>
      </button>
    </div>

    <!-- detail panel -->
    <div v-if="sel" class="scroll-y" style="overflow-y: auto">
      <div class="page-inset" style="max-width: 720px">
        <div class="flex items-center justify-between" style="margin-bottom: 22px">
          <div class="flex items-center" style="gap: 16px">
            <UiAvatar :name="sel.profiles?.full_name || sel.profiles?.email || '?'" :size="52" />
            <div>
              <h2 style="font-size: 22px">{{ sel.profiles?.full_name || '—' }}</h2>
              <div class="muted" style="font-size: 13.5px">{{ sel.profiles?.email }}</div>
            </div>
          </div>
          <span :class="'chip ' + (stat[sel.status]?.c || 'warn')">{{ stat[sel.status]?.t || sel.status }}</span>
        </div>

        <div class="grid-admin-2" style="margin-bottom: 24px">
          <!-- Enrollment details -->
          <div class="card card-pad" style="border-radius: 14px">
            <h4 style="font-family: var(--sans); font-size: 13px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 14px">
              Бүртгэлийн мэдээлэл
            </h4>
            <div
              v-for="[k, v] in enrollmentRows"
              :key="k"
              class="flex items-center justify-between"
              style="padding: 8px 0; border-bottom: 1px solid var(--line-soft); font-size: 13.5px"
            >
              <span class="muted">{{ k }}</span>
              <span style="font-weight: 600">{{ v }}</span>
            </div>
          </div>

          <!-- Screenshot -->
          <div>
            <h4 style="font-family: var(--sans); font-size: 13px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 14px">
              Баримтын зураг
            </h4>
            <div style="border-radius: 12px; overflow: hidden; background: var(--surface-2); border: 1px solid var(--line); min-height: 180px; display: flex; align-items: center; justify-content: center">
              <img
                v-if="screenshotUrl"
                :src="screenshotUrl"
                alt="Баримт"
                style="width: 100%; height: auto; display: block; border-radius: 12px"
              />
              <div v-else style="text-align: center; color: var(--muted); font-size: 13px; padding: 32px">
                <UiIcon name="upload" :size="28" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
                Баримт байхгүй
              </div>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div
          v-if="actError"
          class="flex items-start"
          style="gap: 8px; margin-bottom: 16px; padding: 12px 14px; background: var(--bad-tint); border-radius: 10px; font-size: 13px; color: var(--bad)"
        >
          <UiIcon name="x" :size="15" style="flex: none; margin-top: 1px" />
          {{ actError }}
        </div>

        <!-- Actions -->
        <div
          v-if="sel.status === 'pending'"
          class="card card-pad"
          style="border-radius: 14px; background: var(--surface-2); border: none"
        >
          <div class="flex flex-wrap items-center justify-between" style="gap: 14px">
            <div class="flex items-center" style="gap: 8px; font-size: 13.5px; color: var(--ink-soft)">
              <UiIcon name="shield" :size="18" style="color: var(--sage-deep)" />
              Дүн болон лавлагааг шалгасны дараа батална уу.
            </div>
            <div class="flex items-center" style="gap: 10px">
              <button
                class="btn btn-ghost"
                style="color: var(--bad); border-color: var(--bad-tint)"
                :disabled="acting"
                @click="denyPayment"
              >
                <UiIcon name="x" :size="17" /> Татгалзах
              </button>
              <button
                class="btn"
                style="background: var(--good); color: #fff"
                :disabled="acting"
                @click="approvePayment"
              >
                <UiIcon name="check" :size="17" />
                {{ acting ? 'Уншиж байна…' : 'Батлах' }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="card card-pad flex items-center"
          :style="{
            borderRadius: '14px',
            gap: '12px',
            background: sel.status === 'approved' ? 'var(--good-tint)' : 'var(--bad-tint)',
          }"
        >
          <UiIcon
            :name="sel.status === 'approved' ? 'checkCircle' : 'x'"
            :size="22"
            :style="{ color: sel.status === 'approved' ? 'var(--good)' : 'var(--bad)' }"
          />
          <span :style="{ fontWeight: 600, color: sel.status === 'approved' ? 'var(--good)' : 'var(--bad)' }">
            {{
              sel.status === 'approved'
                ? 'Элсэлт батлагдсан — оюутанд мэдэгдэж, нэвтрэх эрх олгогдсон.'
                : 'Элсэлт татгалзагдсан — оюутанд дахин илгээхийг хүссэн.'
            }}
          </span>
        </div>
      </div>
    </div>

    <!-- empty state -->
    <div v-else class="scroll-y flex items-center justify-center" style="color: var(--muted); font-size: 14px">
      Төлбөр сонгоно уу
    </div>
  </div>
</template>

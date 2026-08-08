<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
const actOk = ref('')

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
    // Land on the first item that actually needs action, not just the newest.
    if (!sel.value && data.length) sel.value = data.find((p) => p.status === 'pending') || data[0]
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

function onKey(e) {
  if (!list.value.length) return
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  const idx = list.value.findIndex((p) => p.id === sel.value?.id)
  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault()
    selectPayment(list.value[Math.min(idx + 1, list.value.length - 1)])
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault()
    selectPayment(list.value[Math.max(idx - 1, 0)])
  } else if ((e.key === 'a' || e.key === 'A') && sel.value?.status === 'pending' && !acting.value) {
    approvePayment()
  } else if ((e.key === 'd' || e.key === 'D') && sel.value?.status === 'pending' && !acting.value) {
    denyPayment()
  }
}

let realtimeChannel = null

onMounted(() => {
  loadPayments()
  window.addEventListener('keydown', onKey)
  // New bookings/enrollments insert payment rows from other sessions — keep the
  // queue live so the admin never acts on a stale list.
  realtimeChannel = supabase
    .channel('admin-payments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadPayments)
    .subscribe()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})

const detailEl = ref(null)

function selectPayment(p) {
  if (!p) return
  sel.value = p
  actError.value = ''
  actOk.value = ''
  // Stacked mobile layout: the detail panel sits below the full queue list,
  // so bring it into view after a tap.
  if (window.innerWidth < 1024) {
    nextTick(() => detailEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

// After acting on a payment, jump to the next one still awaiting review so the
// admin can clear the queue without reaching for the mouse between each.
function advanceToNextPending(prevId) {
  const idx = list.value.findIndex((p) => p.id === prevId)
  const next =
    (idx >= 0 && list.value.slice(idx + 1).find((p) => p.status === 'pending')) ||
    list.value.find((p) => p.status === 'pending')
  if (!next) return
  // selectPayment clears the action banners — keep the outcome of the decision
  // we just made visible while the next item loads.
  const ok = actOk.value
  const err = actError.value
  selectPayment(next)
  actOk.value = ok
  actError.value = err
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

// Meeting bookings create both a payment row and a coaching_slot with the same
// uploaded receipt path — that shared path is the join key between the two.
async function findLinkedSlot(payment) {
  if (!payment.screenshot_path) return null
  if (payment.service_type === 'subscription') return null
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, status, meet_link')
    .eq('payment_screenshot_path', payment.screenshot_path)
    .eq('user_id', payment.user_id)
    .maybeSingle()
  return data ?? null
}

async function approvePayment() {
  if (!sel.value || !session.value) return
  acting.value = true
  actError.value = ''
  actOk.value = ''

  const payment = sel.value
  const userId = payment.user_id

  // Meeting payment: approving it must also confirm the booked slot — mint the
  // Google Meet link first, and only mark the payment approved once that works,
  // so the queue never shows "approved" for a meeting that has no link.
  const linkedSlot = await findLinkedSlot(payment)
  if (linkedSlot?.status === 'pending') {
    const { data, error } = await supabase.functions
      .invoke('coaching-create-meet', { body: { slotId: linkedSlot.id } })
    if (error || !data?.ok) {
      actError.value =
        'Google Meet линк үүсгэхэд алдаа гарлаа: ' +
        (data?.detail || error?.message || 'тодорхойгүй') +
        ' — төлбөр батлагдаагүй хэвээр байна.'
      acting.value = false
      return
    }
  }

  const { error: payErr } = await setPaymentStatus(payment.id, 'approved')

  if (payErr) {
    actError.value = 'Алдаа: ' + payErr.message
    acting.value = false
    return
  }

  // Subscription is the ONLY product that grants/extends subscription access.
  // Meeting payments (tarot/coaching) must NOT touch subscription state.
  if (payment.service_type === 'subscription') {
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
  }

  if (linkedSlot && linkedSlot.status !== 'cancelled') {
    // The approval email for a meeting carries the Meet link + calendar button.
    // Await it so we can tell the admin whether the user was actually notified.
    try {
      const { data, error } = await supabase.functions
        .invoke('send-email', { body: { type: 'coaching_approved', slotId: linkedSlot.id, adminNote: null } })
      if (error || data?.emailSent === false) {
        actError.value = 'Захиалга батлагдсан, гэвч имэйл илгээгдсэнгүй. Хэрэглэгчид өөрөөр мэдэгдэнэ үү.'
      } else {
        actOk.value = 'Захиалга батлагдлаа — Google Meet линк үүсч, хэрэглэгчид имэйлээр илгээгдлээ.'
      }
    } catch {
      actError.value = 'Захиалга батлагдсан, гэвч имэйл илгээгдсэнгүй. Хэрэглэгчид өөрөөр мэдэгдэнэ үү.'
    }
  } else if (!linkedSlot && payment.service_type === 'subscription') {
    // Fire-and-forget — email failure must not block admin workflow.
    // (The payment_approved template talks about subscription access, so it's
    // only right for subscription payments.)
    supabase.functions
      .invoke('send-email', { body: { type: 'payment_approved', userId } })
      .catch(() => {})
    actOk.value = 'Төлбөр батлагдлаа.'
  } else {
    actOk.value = 'Төлбөр батлагдлаа.'
  }

  acting.value = false
  await loadPayments()
  advanceToNextPending(payment.id)
}

async function denyPayment() {
  if (!sel.value || !session.value) return
  acting.value = true
  actError.value = ''
  actOk.value = ''

  const payment = sel.value

  const { error: payErr } = await setPaymentStatus(payment.id, 'denied')

  if (payErr) {
    actError.value = 'Алдаа: ' + payErr.message
    acting.value = false
    return
  }

  // Only subscription denials affect subscription status.
  // Meeting payment denials must NOT mark the user's subscription as denied.
  if (payment.service_type === 'subscription') {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ subscription_status: 'denied' })
      .eq('id', payment.user_id)

    if (profErr) {
      actError.value = 'Профайл шинэчлэхэд алдаа: ' + profErr.message
    }
  }

  // Denying a meeting payment also cancels the linked booking request so it
  // doesn't linger in the Schedule queue.
  const linkedSlot = await findLinkedSlot(payment)
  if (linkedSlot?.status === 'pending') {
    await supabase
      .from('coaching_slots')
      .update({ status: 'cancelled', decided_at: new Date().toISOString() })
      .eq('id', linkedSlot.id)
    supabase.functions
      .invoke('send-email', { body: { type: 'coaching_denied', slotId: linkedSlot.id, adminNote: null } })
      .catch(() => {})
  } else {
    // Fire-and-forget — email failure must not block admin workflow
    supabase.functions
      .invoke('send-email', { body: { type: 'payment_denied', userId: payment.user_id, adminNote: null } })
      .catch(() => {})
  }

  acting.value = false
  await loadPayments()
  advanceToNextPending(payment.id)
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
    <div v-if="sel" ref="detailEl" class="scroll-y" style="overflow-y: auto">
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

        <!-- Success -->
        <div
          v-if="actOk"
          class="flex items-start"
          style="gap: 8px; margin-bottom: 16px; padding: 12px 14px; background: var(--good-tint); border-radius: 10px; font-size: 13px; color: var(--good)"
        >
          <UiIcon name="checkCircle" :size="15" style="flex: none; margin-top: 1px" />
          {{ actOk }}
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
              {{
                sel.service_type === 'subscription'
                  ? 'Дүн болон лавлагааг шалгасны дараа батална уу.'
                  : 'Батлахад Google Meet линк үүсч, хэрэглэгчид имэйлээр илгээгдэнэ.'
              }}
              <span class="hide-mobile muted" style="font-size: 12px; margin-left: 2px">
                · <kbd>A</kbd> батлах · <kbd>D</kbd> татгалзах · <kbd>↑↓</kbd> шилжих
              </span>
            </div>
            <div class="flex items-center admin-pay-actions" style="gap: 10px">
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
                ? (sel.service_type === 'subscription'
                    ? 'Элсэлт батлагдсан — оюутанд мэдэгдэж, нэвтрэх эрх олгогдсон.'
                    : 'Захиалга батлагдсан — Google Meet линк имэйлээр илгээгдсэн.')
                : (sel.service_type === 'subscription'
                    ? 'Элсэлт татгалзагдсан — оюутанд дахин илгээхийг хүссэн.'
                    : 'Захиалга татгалзагдсан — хэрэглэгчид имэйлээр мэдэгдсэн.')
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

<style scoped>
kbd {
  font-family: var(--mono, monospace);
  font-size: 11px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 1px 5px;
  color: var(--ink-soft);
}
</style>

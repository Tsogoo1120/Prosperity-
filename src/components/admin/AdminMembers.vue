<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const tab = ref('members') // 'members' | 'meetings'

// ── Members ───────────────────────────────────────────────────────────────────
const members = ref([])
const loadingMembers = ref(true)
const filter = ref('active')
const extendingId = ref(null)
const deletingId = ref(null)
const expandedId = ref(null)
const memberPayments = ref({}) // userId -> payment rows (with signed screenshotUrl)
const loadingPaymentsId = ref(null)
const err = ref('')

const STATUS = {
  active:  { c: 'good', t: 'Идэвхтэй' },
  pending: { c: 'warn', t: 'Хүлээгдэж байна' },
  denied:  { c: 'bad',  t: 'Татгалзсан' },
}

const SERVICE_NAMES = {
  subscription: 'Subscription',
  tarot: 'Тарот уншлага',
  coaching: '1:1 Coaching',
}

const PAY_STATUS = {
  pending:  { c: 'warn', t: 'Хүлээгдэж байна' },
  approved: { c: 'good', t: 'Батлагдсан' },
  denied:   { c: 'bad',  t: 'Татгалзсан' },
}

async function loadMembers() {
  loadingMembers.value = true
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url, subscription_status, subscription_expires_at, created_at')
    .not('subscription_status', 'is', null)
    .order('subscription_expires_at', { ascending: false })
  members.value = data ?? []
  loadingMembers.value = false
}

const filtered = computed(() => {
  if (filter.value === 'all') return members.value
  if (filter.value === 'expired') {
    const now = new Date()
    return members.value.filter(m =>
      m.subscription_status === 'active' && m.subscription_expires_at && new Date(m.subscription_expires_at) <= now
    )
  }
  return members.value.filter(m => m.subscription_status === filter.value)
})

async function toggleExpand(m) {
  if (expandedId.value === m.id) { expandedId.value = null; return }
  expandedId.value = m.id
  if (!memberPayments.value[m.id]) await loadMemberPayments(m.id)
}

async function loadMemberPayments(userId) {
  loadingPaymentsId.value = userId
  const { data } = await supabase
    .from('payments')
    .select('id, amount, service_type, status, screenshot_path, bank_reference, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  const rows = data ?? []
  await Promise.all(rows.map(signRow))
  memberPayments.value = { ...memberPayments.value, [userId]: rows }
  loadingPaymentsId.value = null
}

async function signRow(row) {
  const path = row.screenshot_path || row.payment_screenshot_path
  if (!path) return
  const { data } = await supabase.storage.from('payment-screenshots').createSignedUrl(path, 3600)
  row.screenshotUrl = data?.signedUrl || ''
}

function newExpiry(member) {
  const now = new Date()
  const existing = member.subscription_expires_at ? new Date(member.subscription_expires_at) : null
  const base = existing && existing > now ? existing : now
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
}

async function extendOne(member) {
  extendingId.value = member.id
  err.value = ''
  const expiry = newExpiry(member)
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'active', subscription_expires_at: expiry.toISOString(), expiry_reminder_stage: 0 })
    .eq('id', member.id)
  if (error) err.value = error.message
  extendingId.value = null
  await loadMembers()
}

async function deleteSubscription(member) {
  if (!window.confirm(`${member.full_name || member.email}-н эрхийг устгах уу? Энэ үйлдэл нь захиалгын төлөвийг арилгана.`)) return
  deletingId.value = member.id
  err.value = ''
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: null, subscription_expires_at: null, expiry_reminder_stage: 0 })
    .eq('id', member.id)
  if (error) err.value = error.message
  deletingId.value = null
  if (expandedId.value === member.id) expandedId.value = null
  await loadMembers()
}

// ── Meeting orders ────────────────────────────────────────────────────────────
const meetings = ref([])
const loadingMeetings = ref(true)

const MEET_STATUS = {
  pending: { c: 'warn', t: 'Хүлээгдэж байна' },
  booked:  { c: 'good', t: 'Батлагдсан' },
}

async function loadMeetings() {
  loadingMeetings.value = true
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, service_type, description, payment_screenshot_path, meet_link, profiles(full_name, email, phone, avatar_url)')
    .not('user_id', 'is', null)
    .in('status', ['pending', 'booked'])
    .order('start_at', { ascending: false })
  const rows = data ?? []
  await Promise.all(rows.map(signRow))
  meetings.value = rows
  loadingMeetings.value = false
}

onMounted(() => { loadMembers(); loadMeetings() })

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lightbox = ref('')

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtMNT(v) {
  return Number(v || 0).toLocaleString('mn-MN') + ' ₮'
}

function isExpired(member) {
  if (!member.subscription_expires_at) return false
  return new Date(member.subscription_expires_at) <= new Date()
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; overflow-y: auto">
    <div class="page-inset" style="max-width: 880px">

      <!-- Section tabs -->
      <div class="flex items-center" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px; margin-bottom: 22px; width: fit-content">
        <button
          v-for="[id, lbl] in [['members', 'Гишүүд'], ['meetings', 'Уулзалтын захиалга']]"
          :key="id"
          class="flex items-center"
          :style="{
            gap: '6px', padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            background: tab === id ? 'var(--card)' : 'transparent',
            color: tab === id ? 'var(--ink)' : 'var(--muted)',
            fontWeight: 600, fontSize: '13.5px',
            boxShadow: tab === id ? 'var(--sh-sm)' : 'none',
          }"
          @click="tab = id"
        >{{ lbl }}</button>
      </div>

      <!-- Error -->
      <div
        v-if="err"
        style="margin-bottom: 14px; padding: 12px 16px; background: var(--bad-tint); border-radius: 10px; font-size: 13.5px; color: var(--bad)"
      >{{ err }}</div>

      <!-- ═══════════════════ MEMBERS ═══════════════════ -->
      <template v-if="tab === 'members'">
        <!-- Filter tabs -->
        <div class="flex items-center" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px; margin-bottom: 18px; width: fit-content">
          <button
            v-for="[id, lbl] in [['active', 'Идэвхтэй'], ['pending', 'Хүлээгдэж байна'], ['expired', 'Дууссан'], ['all', 'Бүгд']]"
            :key="id"
            :style="{
              padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: filter === id ? 'var(--card)' : 'transparent',
              color: filter === id ? 'var(--ink)' : 'var(--muted)',
              fontWeight: 600, fontSize: '13px',
              boxShadow: filter === id ? 'var(--sh-sm)' : 'none',
            }"
            @click="filter = id"
          >{{ lbl }}</button>
        </div>

        <!-- Loading -->
        <div v-if="loadingMembers" style="padding: 48px; text-align: center; color: var(--muted)">
          <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
          Уншиж байна…
        </div>

        <!-- Empty -->
        <div
          v-else-if="!filtered.length"
          class="card card-pad"
          style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)"
        >
          <UiIcon name="users" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
          <p style="font-size: 15px">Гишүүн байхгүй байна.</p>
        </div>

        <!-- Member rows -->
        <div v-else class="flex flex-col" style="gap: 8px">
          <div
            v-for="m in filtered"
            :key="m.id"
            class="card"
            style="border-radius: 14px; overflow: hidden"
          >
            <!-- Header row (click to expand) -->
            <div
              class="flex flex-wrap items-center"
              style="padding: 14px 20px; gap: 14px; cursor: pointer"
              @click="toggleExpand(m)"
            >
              <!-- Avatar + name -->
              <div class="flex items-center" style="gap: 12px; flex: 1; min-width: 200px">
                <UiAvatar :name="m.full_name || m.email || '?'" :size="42" />
                <div style="min-width: 0">
                  <div style="font-weight: 600; font-size: 14.5px">{{ m.full_name || '—' }}</div>
                  <div class="muted" style="font-size: 12.5px">{{ m.email }}</div>
                </div>
              </div>

              <!-- Status -->
              <div style="min-width: 100px">
                <span
                  :class="'chip ' + (isExpired(m) ? 'bad' : (STATUS[m.subscription_status]?.c || 'warn'))"
                  style="font-size: 12px"
                >
                  {{ isExpired(m) ? 'Дууссан' : (STATUS[m.subscription_status]?.t || m.subscription_status) }}
                </span>
              </div>

              <!-- Expiry -->
              <div style="min-width: 130px">
                <div class="muted" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px">Дуусах огноо</div>
                <div style="font-size: 13.5px; font-weight: 600">{{ fmtDate(m.subscription_expires_at) }}</div>
              </div>

              <!-- Actions -->
              <div class="flex items-center" style="gap: 8px" @click.stop>
                <button
                  class="btn btn-ghost btn-sm"
                  :disabled="extendingId === m.id"
                  @click="extendOne(m)"
                >
                  <UiIcon name="plus" :size="15" />
                  {{ extendingId === m.id ? '…' : '+1 сар' }}
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  style="color: var(--bad); border-color: var(--bad-tint)"
                  :disabled="deletingId === m.id"
                  @click="deleteSubscription(m)"
                >
                  <UiIcon name="x" :size="15" />
                  {{ deletingId === m.id ? '…' : 'Устгах' }}
                </button>
                <UiIcon
                  name="chevDown"
                  :size="18"
                  :style="{ color: 'var(--muted)', transition: 'transform .15s', transform: expandedId === m.id ? 'rotate(180deg)' : 'none' }"
                />
              </div>
            </div>

            <!-- Expanded detail -->
            <div
              v-if="expandedId === m.id"
              style="border-top: 1px solid var(--line-soft); padding: 18px 20px; background: var(--surface-2)"
            >
              <!-- Contact / form info -->
              <h4 style="font-family: var(--sans); font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 10px">
                Хэрэглэгчийн мэдээлэл
              </h4>
              <div class="member-info-grid" style="margin-bottom: 18px">
                <div
                  v-for="[k, v] in [
                    ['Нэр', m.full_name || '—'],
                    ['Утас', m.phone || '—'],
                    ['И-мэйл', m.email || '—'],
                    ['Элссэн', fmtDate(m.created_at)],
                  ]"
                  :key="k"
                >
                  <div class="muted" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px">{{ k }}</div>
                  <div style="font-size: 13.5px; font-weight: 600; word-break: break-word">{{ v }}</div>
                </div>
              </div>

              <!-- Payment screenshots / history -->
              <h4 style="font-family: var(--sans); font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 10px">
                Төлбөрийн түүх
              </h4>

              <div v-if="loadingPaymentsId === m.id" class="muted" style="font-size: 13px; padding: 8px 0">Уншиж байна…</div>

              <div v-else-if="!(memberPayments[m.id]?.length)" class="muted" style="font-size: 13px; padding: 8px 0">
                Төлбөр байхгүй байна.
              </div>

              <div v-else class="flex flex-col" style="gap: 8px">
                <div
                  v-for="p in memberPayments[m.id]"
                  :key="p.id"
                  class="card flex items-center"
                  style="border-radius: 10px; padding: 10px 12px; gap: 12px; background: var(--card)"
                >
                  <!-- Screenshot thumb -->
                  <button
                    v-if="p.screenshotUrl"
                    style="flex: none; width: 52px; height: 52px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); padding: 0; cursor: pointer; background: none"
                    @click="lightbox = p.screenshotUrl"
                  >
                    <img :src="p.screenshotUrl" alt="Баримт" style="width: 100%; height: 100%; object-fit: cover; display: block" />
                  </button>
                  <div
                    v-else
                    style="flex: none; width: 52px; height: 52px; border-radius: 8px; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--muted)"
                  >
                    <UiIcon name="upload" :size="18" style="opacity: 0.4" />
                  </div>

                  <!-- Details -->
                  <div style="flex: 1; min-width: 0">
                    <div style="font-weight: 600; font-size: 13.5px">{{ SERVICE_NAMES[p.service_type] || p.service_type || '—' }}</div>
                    <div class="muted" style="font-size: 12px">{{ fmtMNT(p.amount) }} · {{ fmtDate(p.created_at) }}</div>
                  </div>

                  <span :class="'chip ' + (PAY_STATUS[p.status]?.c || 'warn')" style="font-size: 11px; padding: 2px 8px">
                    {{ PAY_STATUS[p.status]?.t || p.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══════════════════ MEETING ORDERS ═══════════════════ -->
      <template v-else>
        <!-- Loading -->
        <div v-if="loadingMeetings" style="padding: 48px; text-align: center; color: var(--muted)">
          <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
          Уншиж байна…
        </div>

        <!-- Empty -->
        <div
          v-else-if="!meetings.length"
          class="card card-pad"
          style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)"
        >
          <UiIcon name="calendar" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
          <p style="font-size: 15px">Уулзалтын захиалга байхгүй байна.</p>
        </div>

        <!-- Meeting rows -->
        <div v-else class="flex flex-col" style="gap: 10px">
          <div
            v-for="s in meetings"
            :key="s.id"
            class="card flex flex-wrap items-center"
            style="border-radius: 14px; padding: 14px 18px; gap: 14px"
            :style="{ borderLeft: '4px solid ' + (MEET_STATUS[s.status]?.c === 'good' ? 'var(--good)' : 'var(--warn)') }"
          >
            <!-- Screenshot thumb -->
            <button
              v-if="s.screenshotUrl"
              style="flex: none; width: 56px; height: 56px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); padding: 0; cursor: pointer; background: none"
              @click="lightbox = s.screenshotUrl"
            >
              <img :src="s.screenshotUrl" alt="Баримт" style="width: 100%; height: 100%; object-fit: cover; display: block" />
            </button>
            <div
              v-else
              style="flex: none; width: 56px; height: 56px; border-radius: 10px; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--muted)"
            >
              <UiIcon name="upload" :size="20" style="opacity: 0.4" />
            </div>

            <!-- Customer -->
            <div class="flex items-center" style="gap: 11px; flex: 1; min-width: 190px">
              <UiAvatar :name="s.profiles?.full_name || s.profiles?.email || '?'" :size="40" />
              <div style="min-width: 0">
                <div style="font-weight: 600; font-size: 14px">{{ s.profiles?.full_name || '—' }}</div>
                <div class="muted" style="font-size: 12.5px">{{ s.profiles?.email }}</div>
                <div v-if="s.profiles?.phone" class="muted" style="font-size: 12.5px">{{ s.profiles.phone }}</div>
              </div>
            </div>

            <!-- Meeting info -->
            <div style="flex: 1; min-width: 170px">
              <div style="font-weight: 600; font-size: 13.5px; margin-bottom: 3px">
                Онлайн уулзалт
              </div>
              <div class="muted" style="font-size: 12.5px; display: flex; align-items: center; gap: 6px">
                <UiIcon name="calendar" :size="13" />
                {{ fmtDateTime(s.start_at) }}
              </div>
              <a
                v-if="s.meet_link"
                :href="s.meet_link"
                target="_blank"
                rel="noopener"
                style="font-size: 12.5px; color: var(--primary); display: inline-flex; align-items: center; gap: 5px; margin-top: 3px"
                @click.stop
              >
                <UiIcon name="video" :size="13" /> Meet линк
              </a>
            </div>

            <!-- Status -->
            <span :class="'chip ' + (MEET_STATUS[s.status]?.c || 'warn')" style="font-size: 12px">
              {{ MEET_STATUS[s.status]?.t || s.status }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Lightbox -->
    <div
      v-if="lightbox"
      style="position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.75); display: flex; align-items: center; justify-content: center; padding: 32px; cursor: zoom-out"
      @click="lightbox = ''"
    >
      <img :src="lightbox" alt="Баримт" style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: var(--sh-lg)" />
    </div>
  </div>
</template>

<style scoped>
.member-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
}
@media (min-width: 640px) {
  .member-info-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>

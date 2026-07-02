<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import { supabase } from '@/lib/supabase.js'
import ScheduleCalendar from './ScheduleCalendar.vue'
import ScheduleRequests from './ScheduleRequests.vue'
import ScheduleHistory from './ScheduleHistory.vue'

const tab = ref('calendar')
const calendarRef = ref(null)

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const weekStart = ref(getMondayOf(new Date()))

const weekDates = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + i)
    return d
  })
)

const weekLabel = computed(() => {
  const s = weekDates.value[0]
  const e = weekDates.value[6]
  const mo = { month: 'short', day: 'numeric' }
  return s.toLocaleDateString('en-US', mo) + ' – ' + e.toLocaleDateString('en-US', { ...mo, year: 'numeric' })
})

const slots = ref([])
const pendingSlots = ref([])
const loadingPending = ref(false)
const actingSlotId = ref(null)
const actErr = ref('')
const actOk = ref('')
const pendingCount = computed(() => pendingSlots.value.length)

const historySlots = ref([])
const loadingHistory = ref(false)

async function loadSlots() {
  const start = weekStart.value.toISOString()
  const end = new Date(weekStart.value.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, description, status, service_type, user_id, profiles(full_name, email)')
    .in('status', ['available', 'pending', 'booked'])
    .gte('start_at', start)
    .lt('start_at', end)
    .order('start_at', { ascending: true })
  slots.value = data ?? []
}

let autoTabDone = false

async function loadPendingRequests() {
  loadingPending.value = true
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, service_type, description, user_id, profiles(full_name, email, phone, avatar_url)')
    .eq('status', 'pending')
    .order('start_at', { ascending: true })
  pendingSlots.value = data ?? []
  loadingPending.value = false
  // On first load, land on whichever tab has work waiting.
  if (!autoTabDone) {
    autoTabDone = true
    if (pendingSlots.value.length) tab.value = 'requests'
  }
}

// Approved (booked) and denied (cancelled) requests, newest decision first.
async function loadHistory() {
  loadingHistory.value = true
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, decided_at, meet_link, user_id, profiles(full_name, email, phone)')
    .in('status', ['booked', 'cancelled'])
    .not('user_id', 'is', null)
    .order('decided_at', { ascending: false, nullsFirst: false })
    .limit(60)
  historySlots.value = data ?? []
  loadingHistory.value = false
}

function prevWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() - 7)
  weekStart.value = d
  loadSlots()
}

function nextWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 7)
  weekStart.value = d
  loadSlots()
}

// Sends the decision email and reports delivery so the admin knows the user
// was actually notified (send-email returns emailSent).
async function sendDecisionEmail(type, slotId) {
  try {
    const { data, error } = await supabase.functions
      .invoke('send-email', { body: { type, slotId, adminNote: null } })
    if (error || data?.emailSent === false) {
      actErr.value = 'Шийдвэр хадгалагдсан, гэвч имэйл илгээгдсэнгүй. Хэрэглэгчид өөрөөр мэдэгдэнэ үү.'
      return false
    }
    return true
  } catch {
    actErr.value = 'Шийдвэр хадгалагдсан, гэвч имэйл илгээгдсэнгүй. Хэрэглэгчид өөрөөр мэдэгдэнэ үү.'
    return false
  }
}

async function approveSlot({ slot }) {
  actingSlotId.value = slot.id
  actErr.value = ''
  actOk.value = ''
  // Mint a Google Meet link (creates a Calendar event on the coach's calendar)
  // and mark the slot booked — all server-side.
  const { data, error } = await supabase.functions
    .invoke('coaching-create-meet', { body: { slotId: slot.id } })
  if (error || !data?.ok) {
    actErr.value = data?.detail || error?.message || 'Google Meet линк үүсгэхэд алдаа гарлаа.'
    actingSlotId.value = null
    return
  }
  // Send the branded approval email (reads meet_link back from the slot).
  const sent = await sendDecisionEmail('coaching_approved', slot.id)
  if (sent) actOk.value = 'Захиалга батлагдаж, хэрэглэгчид имэйл илгээгдлээ.'
  actingSlotId.value = null
  await Promise.all([loadPendingRequests(), loadSlots(), loadHistory()])
}

async function denySlot(slot) {
  actingSlotId.value = slot.id
  actErr.value = ''
  actOk.value = ''
  const { error } = await supabase
    .from('coaching_slots')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', slot.id)
  if (error) { actErr.value = error.message; actingSlotId.value = null; return }
  const sent = await sendDecisionEmail('coaching_denied', slot.id)
  if (sent) actOk.value = 'Захиалга татгалзагдаж, хэрэглэгчид имэйл илгээгдлээ.'
  actingSlotId.value = null
  await Promise.all([loadPendingRequests(), loadSlots(), loadHistory()])
}

let realtimeChannel = null

onMounted(() => {
  loadSlots()
  loadPendingRequests()
  loadHistory()
  realtimeChannel = supabase
    .channel('admin-schedule')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, () => {
      loadSlots()
      loadPendingRequests()
      loadHistory()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="flex flex-col" style="flex: 1; height: calc(100vh - 72px)">
    <!-- Topbar with tabs + calendar controls -->
    <div
      class="topbar-row flex-wrap admin-sched-topbar"
      style="padding: 16px 36px; border-bottom: 1px solid var(--line); background: var(--card); gap: 14px"
    >
      <div class="flex items-center admin-sched-tabs" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px">
        <button
          v-for="[id, lbl] in [['calendar', 'Хуваарь'], ['requests', 'Захиалга'], ['history', 'Түүх']]"
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
        >
          {{ lbl }}
          <span
            v-if="id === 'requests' && pendingCount"
            style="background: var(--warn); color: #fff; border-radius: 999px; padding: 1px 7px; font-size: 11.5px; font-weight: 700"
          >{{ pendingCount }}</span>
        </button>
      </div>

      <template v-if="tab === 'calendar'">
        <div class="flex items-center" style="gap: 12px">
          <button class="btn btn-ghost btn-sm" style="padding: 9px" @click="prevWeek"><UiIcon name="chevLeft" :size="17" /></button>
          <div style="font-weight: 600; font-size: 15.5px">{{ weekLabel }}</div>
          <button class="btn btn-ghost btn-sm" style="padding: 9px" @click="nextWeek"><UiIcon name="chevRight" :size="17" /></button>
        </div>
        <div class="flex items-center admin-sched-add" style="gap: 10px; margin-left: auto">
          <button class="btn btn-primary btn-sm" @click="calendarRef?.openAddSlot()"><UiIcon name="plus" :size="16" /> Цаг нэмэх</button>
        </div>
      </template>
    </div>

    <div
      v-if="actOk"
      style="margin: 12px 36px 0; padding: 11px 16px; background: var(--good-tint); border-radius: 10px; font-size: 13.5px; color: var(--good); display: flex; align-items: center; justify-content: space-between; gap: 10px"
      class="admin-sched-banner"
    >
      <span>{{ actOk }}</span>
      <button style="border: none; background: transparent; cursor: pointer; color: inherit; display: flex" @click="actOk = ''">
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <ScheduleCalendar
      v-if="tab === 'calendar'"
      ref="calendarRef"
      :week-dates="weekDates"
      :slots="slots"
      @slot-added="loadSlots"
    />
    <ScheduleRequests
      v-else-if="tab === 'requests'"
      :slots="pendingSlots"
      :loading="loadingPending"
      :acting-slot-id="actingSlotId"
      :act-err="actErr"
      @approve="approveSlot"
      @deny="denySlot"
    />
    <ScheduleHistory
      v-else
      :slots="historySlots"
      :loading="loadingHistory"
    />
  </div>
</template>

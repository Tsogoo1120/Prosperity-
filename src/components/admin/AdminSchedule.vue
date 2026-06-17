<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'

const { session } = useAuth()

const tab = ref('calendar') // 'calendar' | 'requests'
const showAddSlot = ref(false)

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HH = 58

// Manual slot creation
const newSlotDate = ref('')
const newSlotStart = ref('09:00')
const newSlotEnd = ref('10:00')
const newSlotType = ref('coaching')
const addSlotErr = ref('')
const addingSlot = ref(false)

// Pending requests
const pendingSlots = ref([])
const loadingPending = ref(false)
const actingSlotId = ref(null)
const actErr = ref('')
const screenshotUrls = reactive({})
const meetLinkInputs = reactive({})

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const weekStart = ref(getMondayOf(new Date()))

const weekDates = computed(() => {
  return DAYS.map((_, i) => {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + i)
    return d
  })
})

const weekLabel = computed(() => {
  const s = weekDates.value[0]
  const e = weekDates.value[4]
  const mo = { month: 'short', day: 'numeric' }
  return s.toLocaleDateString('en-US', mo) + ' – ' + e.toLocaleDateString('en-US', { ...mo, year: 'numeric' })
})

const slots = ref([])

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

async function loadPendingRequests() {
  loadingPending.value = true
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, service_type, description, user_id, payment_screenshot_path, profiles(full_name, email, avatar_url)')
    .eq('status', 'pending')
    .order('start_at', { ascending: true })
  pendingSlots.value = data ?? []
  loadingPending.value = false
  // Load signed URLs for payment screenshots and init meet link inputs
  for (const slot of (data ?? [])) {
    if (slot.payment_screenshot_path && !screenshotUrls[slot.id]) {
      supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(slot.payment_screenshot_path, 3600)
        .then(({ data: u }) => { if (u?.signedUrl) screenshotUrls[slot.id] = u.signedUrl })
    }
    if (meetLinkInputs[slot.id] === undefined) meetLinkInputs[slot.id] = ''
  }
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

function slotsForDay(dayIndex) {
  const target = weekDates.value[dayIndex]
  return slots.value.filter(s => {
    const d = new Date(s.start_at)
    return d.getFullYear() === target.getFullYear() &&
           d.getMonth() === target.getMonth() &&
           d.getDate() === target.getDate()
  })
}

function slotStartH(slot) {
  const d = new Date(slot.start_at)
  return d.getHours() + d.getMinutes() / 60
}

function slotDurMin(slot) {
  return (new Date(slot.end_at) - new Date(slot.start_at)) / 60000
}

function slotLabel(slot) {
  return slot.service_type === 'tarot_reading' ? 'Тарот' : '1:1 Coaching'
}

function fmtDt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Add a manual available slot
async function saveNewSlot() {
  if (!newSlotDate.value || !newSlotStart.value || !newSlotEnd.value) {
    addSlotErr.value = 'Огноо болон цагийг оруулна уу'
    return
  }
  const startDt = new Date(`${newSlotDate.value}T${newSlotStart.value}:00`)
  const endDt = new Date(`${newSlotDate.value}T${newSlotEnd.value}:00`)
  if (endDt <= startDt) {
    addSlotErr.value = 'Дуусах цаг эхлэх цагаас хойш байх ёстой'
    return
  }
  addingSlot.value = true
  addSlotErr.value = ''
  const { error } = await supabase.from('coaching_slots').insert({
    start_at: startDt.toISOString(),
    end_at: endDt.toISOString(),
    status: 'available',
    service_type: newSlotType.value,
  })
  addingSlot.value = false
  if (error) {
    addSlotErr.value = error.message
    return
  }
  showAddSlot.value = false
  newSlotDate.value = ''
  await loadSlots()
}

const pendingCount = computed(() => pendingSlots.value.length)

async function approveSlot(slot) {
  actingSlotId.value = slot.id
  actErr.value = ''
  const meetLink = (meetLinkInputs[slot.id] ?? '').trim() || null
  const { error } = await supabase
    .from('coaching_slots')
    .update({ status: 'booked', meet_link: meetLink })
    .eq('id', slot.id)
  if (error) {
    actErr.value = error.message
    actingSlotId.value = null
    return
  }
  supabase.functions
    .invoke('send-email', { body: { type: 'coaching_approved', slotId: slot.id, adminNote: null } })
    .catch(() => {})
  actingSlotId.value = null
  await Promise.all([loadPendingRequests(), loadSlots()])
}

async function denySlot(slot) {
  actingSlotId.value = slot.id
  actErr.value = ''
  const { error } = await supabase
    .from('coaching_slots')
    .update({ status: 'cancelled' })
    .eq('id', slot.id)
  if (error) {
    actErr.value = error.message
    actingSlotId.value = null
    return
  }
  supabase.functions
    .invoke('send-email', { body: { type: 'coaching_denied', slotId: slot.id, adminNote: null } })
    .catch(() => {})
  actingSlotId.value = null
  await Promise.all([loadPendingRequests(), loadSlots()])
}

let realtimeChannel = null

onMounted(() => {
  loadSlots()
  loadPendingRequests()
  realtimeChannel = supabase
    .channel('admin-schedule')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, () => {
      loadSlots()
      loadPendingRequests()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="flex flex-col" style="flex: 1; height: calc(100vh - 72px)">
    <!-- Topbar with tabs -->
    <div
      class="topbar-row flex-wrap"
      style="padding: 16px 36px; border-bottom: 1px solid var(--line); background: var(--card); gap: 14px"
    >
      <!-- Tab switcher -->
      <div class="flex items-center" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px">
        <button
          v-for="[id, lbl] in [['calendar', 'Calendar'], ['requests', 'Booking requests']]"
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

      <!-- Calendar controls -->
      <template v-if="tab === 'calendar'">
        <div class="flex items-center" style="gap: 12px">
          <button class="btn btn-ghost btn-sm" style="padding: 9px" @click="prevWeek"><UiIcon name="chevLeft" :size="17" /></button>
          <div style="font-weight: 600; font-size: 15.5px">{{ weekLabel }}</div>
          <button class="btn btn-ghost btn-sm" style="padding: 9px" @click="nextWeek"><UiIcon name="chevRight" :size="17" /></button>
        </div>
        <div class="flex items-center" style="gap: 10px; margin-left: auto">
          <button class="btn btn-primary btn-sm" @click="showAddSlot = true"><UiIcon name="plus" :size="16" /> Add slot</button>
        </div>
      </template>
    </div>

    <!-- ── CALENDAR TAB ── -->
    <div v-if="tab === 'calendar'" class="scroll-y schedule-scroll" style="flex: 1; overflow-y: auto">
      <div style="display: grid; grid-template-columns: 64px repeat(5, 1fr); min-width: 720px">
        <!-- header row -->
        <div style="border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); position: sticky; top: 0; background: var(--surface); z-index: 3" />
        <div
          v-for="(d, i) in DAYS"
          :key="d"
          style="padding: 12px 0; text-align: center; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); position: sticky; top: 0; background: var(--surface); z-index: 3"
        >
          <div class="muted" style="font-size: 12px; font-weight: 600">{{ d }}</div>
          <div style="font-family: var(--serif); font-weight: 700; font-size: 19px">{{ weekDates[i].getDate() }}</div>
        </div>

        <!-- time gutter -->
        <div style="border-right: 1px solid var(--line)">
          <div v-for="h in HOURS" :key="h" :style="{ height: HH + 'px', position: 'relative' }">
            <span style="position: absolute; top: -8px; right: 8px; font-size: 11.5px; color: var(--faint)">{{ h }}:00</span>
          </div>
        </div>

        <!-- day columns -->
        <div v-for="(d, di) in DAYS" :key="d" style="border-right: 1px solid var(--line); position: relative">
          <div v-for="h in HOURS" :key="h" :style="{ height: HH + 'px', borderBottom: '1px solid var(--line-soft)' }" />

          <!-- coaching slots -->
          <div
            v-for="s in slotsForDay(di)"
            :key="s.id"
            :style="{
              position: 'absolute',
              left: '5px',
              right: '5px',
              top: (slotStartH(s) - 8) * HH + 2 + 'px',
              height: Math.max((slotDurMin(s) / 60) * HH - 4, 22) + 'px',
              background: s.status === 'pending' ? 'var(--warn-tint)' : s.status === 'booked' ? 'var(--primary)' : 'var(--surface-3)',
              color: s.status === 'pending' ? 'var(--warn)' : s.status === 'booked' ? '#fff' : 'var(--ink-soft)',
              borderRadius: '9px',
              padding: '5px 9px',
              overflow: 'hidden',
              boxShadow: 'var(--sh-sm)',
              cursor: 'pointer',
              borderLeft: s.status === 'pending' ? '3px solid var(--warn)' : s.status === 'booked' ? '3px solid var(--primary-deep)' : '3px solid var(--line)',
              fontSize: '12px',
            }"
          >
            <div style="font-weight: 600; line-height: 1.2">{{ slotLabel(s) }}</div>
            <div style="opacity: 0.75; font-size: 11px">{{ s.status }}</div>
            <div v-if="s.profiles?.full_name" style="opacity: 0.7; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ s.profiles.full_name }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── BOOKING REQUESTS TAB ── -->
    <div v-else class="scroll-y" style="flex: 1; overflow-y: auto">
      <div class="page-inset" style="max-width: 800px">
        <div v-if="actErr" style="margin-bottom: 14px; padding: 12px 16px; background: var(--bad-tint); border-radius: 10px; font-size: 13.5px; color: var(--bad)">
          {{ actErr }}
        </div>

        <div v-if="loadingPending" style="padding: 48px; text-align: center; color: var(--muted)">
          <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
          Уншиж байна…
        </div>

        <div v-else-if="!pendingSlots.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)">
          <UiIcon name="calendar" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
          <p style="font-size: 15px">Хүлээгдэж буй захиалга байхгүй байна.</p>
        </div>

        <div v-else class="flex flex-col" style="gap: 12px">
          <div
            v-for="slot in pendingSlots"
            :key="slot.id"
            class="card"
            style="border-radius: 14px; padding: 18px 22px; border-left: 4px solid var(--warn)"
          >
            <div class="flex items-start flex-wrap" style="gap: 16px">
              <!-- User info -->
              <div class="flex items-center" style="gap: 12px; flex: 1; min-width: 200px">
                <UiAvatar :name="slot.profiles?.full_name || slot.profiles?.email || '?'" :size="44" />
                <div>
                  <div style="font-weight: 600; font-size: 15px">{{ slot.profiles?.full_name || '—' }}</div>
                  <div class="muted" style="font-size: 13px">{{ slot.profiles?.email }}</div>
                </div>
              </div>

              <!-- Slot info -->
              <div style="flex: 1; min-width: 180px">
                <div style="font-weight: 600; font-size: 14.5px; margin-bottom: 4px">
                  {{ slot.service_type === 'tarot_reading' ? 'Тарот уншлага' : '1:1 Coaching' }}
                </div>
                <div class="muted" style="font-size: 13px; display: flex; align-items: center; gap: 6px">
                  <UiIcon name="calendar" :size="14" />
                  {{ fmtDt(slot.start_at) }} – {{ new Date(slot.end_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }}
                </div>
                <div v-if="slot.description" class="muted" style="font-size: 13px; margin-top: 4px">
                  <UiIcon name="note" :size="13" style="vertical-align: -2px" /> {{ slot.description }}
                </div>
              </div>

              <!-- Payment screenshot + meet link + actions -->
              <div style="width: 100%; margin-top: 12px; display: flex; flex-direction: column; gap: 12px">
                <!-- Screenshot thumbnail -->
                <div v-if="slot.payment_screenshot_path" style="border-radius: 10px; overflow: hidden; border: 1px solid var(--line); max-height: 160px; background: var(--surface-2)">
                  <img
                    v-if="screenshotUrls[slot.id]"
                    :src="screenshotUrls[slot.id]"
                    alt="Баримт"
                    style="width: 100%; max-height: 160px; object-fit: contain; display: block"
                  />
                  <div v-else style="padding: 18px; text-align: center; font-size: 12.5px; color: var(--muted)">Баримт уншиж байна…</div>
                </div>
                <div v-else style="padding: 12px; border-radius: 10px; background: var(--warn-tint); font-size: 12.5px; color: var(--warn)">
                  Төлбөрийн баримт байхгүй
                </div>

                <!-- Google Meet link input -->
                <div>
                  <label style="font-size: 12px; font-weight: 600; color: var(--muted); display: block; margin-bottom: 5px">Google Meet линк (батлахад илгээнэ)</label>
                  <input
                    v-model="meetLinkInputs[slot.id]"
                    class="input"
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    style="font-size: 13px"
                  />
                </div>

                <!-- Approve / deny -->
                <div class="flex items-center" style="gap: 8px">
                  <button
                    class="btn btn-ghost btn-sm"
                    style="color: var(--bad); border-color: var(--bad-tint)"
                    :disabled="actingSlotId === slot.id"
                    @click="denySlot(slot)"
                  >
                    <UiIcon name="x" :size="16" /> Татгалзах
                  </button>
                  <button
                    class="btn btn-sm"
                    style="background: var(--good); color: #fff"
                    :disabled="actingSlotId === slot.id"
                    @click="approveSlot(slot)"
                  >
                    <UiIcon name="check" :size="16" />
                    {{ actingSlotId === slot.id ? 'Уншиж байна…' : 'Батлах' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add Slot Modal -->
  <Teleport to="body">
    <div v-if="showAddSlot" class="modal-scrim" @click="showAddSlot = false">
      <div
        class="card pop"
        style="width: 420px; max-width: 94vw; border-radius: 20px; overflow: hidden; box-shadow: var(--sh-lg)"
        @click.stop
      >
        <div style="padding: 22px 26px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between">
          <div style="font-weight: 600; font-size: 16px">Цаг нэмэх</div>
          <button class="btn btn-quiet" style="padding: 8px" @click="showAddSlot = false">
            <UiIcon name="x" :size="18" />
          </button>
        </div>
        <div style="padding: 26px; display: flex; flex-direction: column; gap: 16px">
          <div class="field">
            <label style="font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block">Огноо</label>
            <input v-model="newSlotDate" type="date" class="input" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px">
            <div class="field">
              <label style="font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block">Эхлэх цаг</label>
              <input v-model="newSlotStart" type="time" class="input" />
            </div>
            <div class="field">
              <label style="font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block">Дуусах цаг</label>
              <input v-model="newSlotEnd" type="time" class="input" />
            </div>
          </div>
          <div class="field">
            <label style="font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block">Төрөл</label>
            <select v-model="newSlotType" class="input">
              <option value="coaching">1:1 Coaching</option>
              <option value="tarot_reading">Тарот уншлага</option>
            </select>
          </div>
          <p v-if="addSlotErr" style="font-size: 13px; color: var(--bad); margin: 0">{{ addSlotErr }}</p>
          <button
            class="btn btn-primary btn-block"
            :disabled="addingSlot"
            @click="saveNewSlot"
          >
            {{ addingSlot ? 'Хадгалж байна…' : 'Нэмэх' }}
          </button>
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
</style>

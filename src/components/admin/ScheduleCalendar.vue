<script setup>
import { ref, computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import { supabase } from '@/lib/supabase.js'

const props = defineProps({
  weekDates: { type: Array, required: true },
  slots: { type: Array, default: () => [] },
})
const emit = defineEmits(['slot-added'])

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HH = 58

// Slots have no end time in the UI — the coach knows when a session ends.
// A fixed end_at is still stored so the Google Meet event has a duration and
// the calendar can render a block.
const SLOT_DURATION_MIN = 60

// Remembered default times so the coach isn't re-typing the same schedule
// every day. Persisted in localStorage and pre-loaded into the bulk modal.
const TEMPLATE_KEY = 'union_slot_template_times'
function loadTemplateTimes() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]')
    if (Array.isArray(raw) && raw.length) return raw
  } catch { /* ignore */ }
  return ['09:00', '10:00', '11:00']
}

const showAddSlot = ref(false)
// Times to create (one slot each). Shared across all selected days.
const slotTimes = ref(loadTemplateTimes())
const timeToAdd = ref('09:00')
// Which days of the week in view to apply the times to (0 = Mon … 6 = Sun).
const selectedDayIdx = ref([])
// Repeat the same day/time pattern forward across N weeks (1 = this week only).
const repeatWeeks = ref(1)
const REPEAT_OPTS = [[1, 'Энэ долоо хоног'], [2, '2 долоо хоног'], [4, '4 долоо хоног'], [8, '8 долоо хоног']]
const addSlotErr = ref('')
const addingSlot = ref(false)

const allDaysSelected = computed(() => selectedDayIdx.value.length === 7)

function toggleDay(i) {
  const arr = selectedDayIdx.value
  selectedDayIdx.value = arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i].sort((a, b) => a - b)
}

function toggleAllDays() {
  selectedDayIdx.value = allDaysSelected.value ? [] : [0, 1, 2, 3, 4, 5, 6]
}

function addTime() {
  const t = timeToAdd.value
  if (t && !slotTimes.value.includes(t)) {
    slotTimes.value = [...slotTimes.value, t].sort()
  }
}

function removeTime(t) {
  slotTimes.value = slotTimes.value.filter((x) => x !== t)
}

// Managing an existing available slot (view → delete)
const selectedSlot = ref(null)
const deletingSlot = ref(false)
const deleteErr = ref('')

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

defineExpose({
  openAddSlot: () => {
    // Default-select today if it's in the week in view, otherwise Monday.
    const today = toISODate(new Date())
    const idx = (props.weekDates || []).findIndex((d) => toISODate(d) === today)
    selectedDayIdx.value = [idx >= 0 ? idx : 0]
    repeatWeeks.value = 1
    addSlotErr.value = ''
    showAddSlot.value = true
  },
})

function slotsForDay(dayIndex) {
  const target = props.weekDates[dayIndex]
  return props.slots.filter(s => {
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

function slotLabel() {
  return 'Онлайн уулзалт'
}

async function saveNewSlot() {
  if (!selectedDayIdx.value.length) {
    addSlotErr.value = 'Дор хаяж нэг өдөр сонгоно уу'
    return
  }
  if (!slotTimes.value.length) {
    addSlotErr.value = 'Дор хаяж нэг цаг нэмнэ үү'
    return
  }
  const now = new Date()
  const existing = props.slots.map((s) => [new Date(s.start_at).getTime(), new Date(s.end_at).getTime()])
  const rows = []
  const built = [] // [startMs, endMs] for newly built rows, to dedupe within the batch
  let skippedPast = 0
  let skippedOverlap = 0

  for (let w = 0; w < repeatWeeks.value; w++) {
    for (const di of selectedDayIdx.value) {
      const base = props.weekDates[di]
      if (!base) continue
      // Same weekday, w weeks forward.
      const day = new Date(base)
      day.setDate(day.getDate() + w * 7)
      for (const t of slotTimes.value) {
        const startDt = new Date(`${toISODate(day)}T${t}:00`)
        const endDt = new Date(startDt.getTime() + SLOT_DURATION_MIN * 60000)
        const sMs = startDt.getTime()
        const eMs = endDt.getTime()
        if (startDt <= now) { skippedPast++; continue }
        const clash = [...existing, ...built].some(([xs, xe]) => sMs < xe && eMs > xs)
        if (clash) { skippedOverlap++; continue }
        built.push([sMs, eMs])
        rows.push({ start_at: startDt.toISOString(), end_at: endDt.toISOString(), status: 'available' })
      }
    }
  }

  if (!rows.length) {
    addSlotErr.value = skippedOverlap
      ? 'Сонгосон бүх цаг өмнө нэмсэн цагтай давхцаж байна'
      : 'Сонгосон цагууд аль хэдийн өнгөрсөн байна'
    return
  }

  addingSlot.value = true
  addSlotErr.value = ''

  // Repeated weeks fall outside props.slots (only the visible week is loaded),
  // so re-check the DB across the full inserted range to avoid duplicates on a
  // second click.
  const minStart = rows.reduce((m, r) => (r.start_at < m ? r.start_at : m), rows[0].start_at)
  const maxEnd = rows.reduce((m, r) => (r.end_at > m ? r.end_at : m), rows[0].end_at)
  const { data: dbExisting } = await supabase
    .from('coaching_slots')
    .select('start_at, end_at')
    .in('status', ['available', 'pending', 'booked'])
    .gte('start_at', minStart)
    .lt('start_at', maxEnd)
  const taken = new Set((dbExisting ?? []).map((s) => new Date(s.start_at).getTime()))
  const finalRows = rows.filter((r) => !taken.has(new Date(r.start_at).getTime()))
  if (!finalRows.length) {
    addingSlot.value = false
    addSlotErr.value = 'Эдгээр цаг аль хэдийн үүсгэгдсэн байна'
    return
  }

  const { error } = await supabase.from('coaching_slots').insert(finalRows)
  addingSlot.value = false
  if (error) { addSlotErr.value = error.message; return }

  // Remember these times as the new default for next time.
  try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(slotTimes.value)) } catch { /* ignore */ }

  showAddSlot.value = false
  emit('slot-added')
}

function onSlotClick(slot) {
  // Only available slots are manageable here; booked/pending are handled
  // from the Booking requests tab so user bookings aren't disrupted.
  if (slot.status !== 'available') return
  deleteErr.value = ''
  selectedSlot.value = slot
}

async function deleteSlot() {
  if (!selectedSlot.value) return
  deletingSlot.value = true
  deleteErr.value = ''
  const { error } = await supabase
    .from('coaching_slots')
    .delete()
    .eq('id', selectedSlot.value.id)
    .eq('status', 'available')
  deletingSlot.value = false
  if (error) { deleteErr.value = error.message; return }
  selectedSlot.value = null
  emit('slot-added')
}
</script>

<template>
  <div class="scroll-y schedule-scroll" style="flex: 1; overflow-y: auto">
    <div style="display: grid; grid-template-columns: 64px repeat(7, 1fr); min-width: 900px">
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
        <div
          v-for="s in slotsForDay(di)"
          :key="s.id"
          @click="onSlotClick(s)"
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
            cursor: s.status === 'available' ? 'pointer' : 'default',
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
        <div style="padding: 26px; display: flex; flex-direction: column; gap: 18px">
          <!-- Days: pick one, several, or the whole week at once -->
          <div class="field">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
              <label style="font-size: 13px; font-weight: 600">Өдрүүд</label>
              <button
                type="button"
                class="btn btn-quiet btn-sm"
                style="font-size: 12px; padding: 4px 10px"
                @click="toggleAllDays"
              >{{ allDaysSelected ? 'Цэвэрлэх' : 'Бүх долоо хоног' }}</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px">
              <button
                v-for="(d, i) in DAYS"
                :key="d"
                type="button"
                @click="toggleDay(i)"
                :style="{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  padding: '8px 0', borderRadius: '9px', cursor: 'pointer',
                  border: selectedDayIdx.includes(i) ? '1px solid var(--primary)' : '1px solid var(--line)',
                  background: selectedDayIdx.includes(i) ? 'var(--primary)' : 'var(--card)',
                  color: selectedDayIdx.includes(i) ? '#fff' : 'var(--muted)',
                  fontWeight: 600,
                }"
              >
                <span style="font-size: 10.5px">{{ d }}</span>
                <span style="font-size: 13px">{{ weekDates[i].getDate() }}</span>
              </button>
            </div>
          </div>

          <!-- Times: each becomes a slot on every selected day -->
          <div class="field">
            <label style="font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block">Цагууд</label>
            <div v-if="slotTimes.length" style="display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px">
              <span
                v-for="t in slotTimes"
                :key="t"
                style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 6px 5px 11px; border-radius: 999px; background: var(--surface-3); font-size: 13px; font-weight: 600"
              >
                {{ t }}
                <button type="button" style="display: flex; border: none; background: transparent; cursor: pointer; padding: 2px; color: var(--muted)" @click="removeTime(t)">
                  <UiIcon name="x" :size="13" />
                </button>
              </span>
            </div>
            <div style="display: flex; gap: 8px">
              <input v-model="timeToAdd" type="time" class="input" style="flex: 1" @keyup.enter="addTime" />
              <button type="button" class="btn btn-ghost" @click="addTime"><UiIcon name="plus" :size="15" /> Нэмэх</button>
            </div>
          </div>

          <!-- Repeat the same pattern forward across upcoming weeks -->
          <div class="field">
            <label style="font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block">Давтах</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">
              <button
                v-for="[n, lbl] in REPEAT_OPTS"
                :key="n"
                type="button"
                @click="repeatWeeks = n"
                :style="{
                  padding: '8px 0', borderRadius: '9px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600,
                  border: repeatWeeks === n ? '1px solid var(--primary)' : '1px solid var(--line)',
                  background: repeatWeeks === n ? 'var(--primary)' : 'var(--card)',
                  color: repeatWeeks === n ? '#fff' : 'var(--muted)',
                }"
              >{{ lbl }}</button>
            </div>
          </div>

          <p v-if="addSlotErr" style="font-size: 13px; color: var(--bad); margin: 0">{{ addSlotErr }}</p>
          <button class="btn btn-primary btn-block" :disabled="addingSlot" @click="saveNewSlot">
            {{ addingSlot ? 'Хадгалж байна…' : `${slotTimes.length * selectedDayIdx.length * repeatWeeks} цаг үүсгэх` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Manage / Delete Slot Modal (available slots only) -->
  <Teleport to="body">
    <div v-if="selectedSlot" class="modal-scrim" @click="selectedSlot = null">
      <div
        class="card pop"
        style="width: 380px; max-width: 94vw; border-radius: 20px; overflow: hidden; box-shadow: var(--sh-lg)"
        @click.stop
      >
        <div style="padding: 22px 26px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between">
          <div style="font-weight: 600; font-size: 16px">Цаг устгах</div>
          <button class="btn btn-quiet" style="padding: 8px" @click="selectedSlot = null">
            <UiIcon name="x" :size="18" />
          </button>
        </div>
        <div style="padding: 26px; display: flex; flex-direction: column; gap: 16px">
          <p style="font-size: 14px; margin: 0; font-weight: 600">
            {{ slotLabel(selectedSlot) }}
          </p>
          <p style="font-size: 13.5px; margin: 0; color: var(--muted)">
            {{ new Date(selectedSlot.start_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) }}
          </p>
          <p style="font-size: 13.5px; margin: 0; color: var(--ink-soft)">Энэ боломжит цагийг устгах уу?</p>
          <p v-if="deleteErr" style="font-size: 13px; color: var(--bad); margin: 0">{{ deleteErr }}</p>
          <div class="flex items-center" style="gap: 10px">
            <button class="btn btn-ghost btn-block" @click="selectedSlot = null">Болих</button>
            <button class="btn btn-block" style="background: var(--bad); color: #fff" :disabled="deletingSlot" @click="deleteSlot">
              {{ deletingSlot ? 'Устгаж байна…' : 'Устгах' }}
            </button>
          </div>
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

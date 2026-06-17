<script setup>
import { ref } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import { supabase } from '@/lib/supabase.js'

const props = defineProps({
  weekDates: { type: Array, required: true },
  slots: { type: Array, default: () => [] },
})
const emit = defineEmits(['slot-added'])

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HH = 58

const showAddSlot = ref(false)
const newSlotDate = ref('')
const newSlotStart = ref('09:00')
const newSlotEnd = ref('10:00')
const newSlotType = ref('coaching')
const addSlotErr = ref('')
const addingSlot = ref(false)

defineExpose({ openAddSlot: () => { showAddSlot.value = true } })

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

function slotLabel(slot) {
  return slot.service_type === 'tarot_reading' ? 'Тарот' : '1:1 Coaching'
}

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
  if (startDt <= new Date()) {
    addSlotErr.value = 'Эхлэх цаг ирээдүйд байх ёстой'
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
  if (error) { addSlotErr.value = error.message; return }
  showAddSlot.value = false
  newSlotDate.value = ''
  emit('slot-added')
}
</script>

<template>
  <div class="scroll-y schedule-scroll" style="flex: 1; overflow-y: auto">
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
          <button class="btn btn-primary btn-block" :disabled="addingSlot" @click="saveNewSlot">
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

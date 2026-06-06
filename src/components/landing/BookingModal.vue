<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const { session } = useAuth()

const step = ref(0)
const bookDate = ref(null)
const bookSlot = ref(null) // { id, time }
const topic = ref('')
const bookingErr = ref('')
const rawSlots = ref([])

async function loadAvailableSlots() {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, service_type')
    .eq('status', 'available')
    .is('user_id', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
  rawSlots.value = data ?? []
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dayMap = computed(() => {
  const map = {}
  for (const s of rawSlots.value) {
    const iso = s.start_at.slice(0, 10)
    if (!map[iso]) {
      const d = new Date(s.start_at)
      map[iso] = { iso, d: DAY_NAMES[d.getDay()], n: d.getDate(), items: [] }
    }
    const d = new Date(s.start_at)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    map[iso].items.push({ id: s.id, time: `${hh}:${mm}` })
  }
  return map
})

const availDays = computed(() => Object.values(dayMap.value))

const currentItems = computed(() => {
  if (!bookDate.value?.iso) return []
  return dayMap.value[bookDate.value.iso]?.items ?? []
})

watch(
  () => props.open,
  (v) => {
    if (v) {
      step.value = 0
      bookSlot.value = null
      bookingErr.value = ''
      topic.value = ''
      bookDate.value = availDays.value[0] ?? null
      loadAvailableSlots()
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
onUnmounted(() => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) })

async function confirmBooking() {
  if (!bookDate.value || !bookSlot.value) return
  bookingErr.value = ''
  const userId = session.value?.user?.id
  if (!userId) {
    bookingErr.value = 'Нэвтэрч орно уу.'
    return
  }
  const { error } = await supabase
    .from('coaching_slots')
    .update({ status: 'pending', user_id: userId, description: topic.value || null })
    .eq('id', bookSlot.value.id)
    .eq('status', 'available')
  if (error) {
    bookingErr.value = 'Захиалга хадгалахад алдаа гарлаа. Дахин оролдоно уу.'
    return
  }
  sessionStorage.setItem(
    'union-booking-prefill',
    JSON.stringify({
      bookDate: { d: bookDate.value.d, n: bookDate.value.n },
      bookSlot: bookSlot.value.time,
    }),
  )
  step.value = 2
}
</script>

<template>
  <Teleport to="body">
  <div v-if="open" class="modal-scrim" @click="emit('close')">
    <div
      class="card pop"
      style="width: 560px; max-width: 94vw; border-radius: 20px; overflow: hidden; box-shadow: var(--sh-lg)"
      @click.stop
    >
      <div
        class="flex items-center justify-between"
        style="padding: 22px 26px; border-bottom: 1px solid var(--line)"
      >
        <div class="flex items-center gap-3">
          <UiAvatar name="Maren Halvorsen" color="var(--primary)" :size="40" />
          <div>
            <div style="font-weight: 600">Consultation with Dr. Maren</div>
            <div class="muted" style="font-size: 13px">30 min · Free intro · Video call</div>
          </div>
        </div>
        <button class="btn btn-quiet" style="padding: 8px" @click="emit('close')">
          <UiIcon name="x" :size="18" />
        </button>
      </div>

      <div v-if="step < 2" style="padding: 26px">
        <div class="kicker cool" style="margin-bottom: 14px">Өдөр сонгох</div>
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
        <p v-else class="muted" style="font-size: 14px; margin-bottom: 26px">Одоогоор боломжит цаг байхгүй байна.</p>
        <div class="kicker cool" style="margin-bottom: 14px">Боломжит цаг</div>
        <div v-if="currentItems.length" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px" class="slot-grid">
          <button
            v-for="item in currentItems"
            :key="item.id"
            type="button"
            class="slotcell"
            :style="{
              borderColor: bookSlot?.id === item.id ? 'var(--clay)' : 'var(--line)',
              background: bookSlot?.id === item.id ? 'var(--clay)' : 'var(--card)',
              color: bookSlot?.id === item.id ? '#fff' : 'var(--ink)',
            }"
            @click="bookSlot = item"
          >
            {{ item.time }}
          </button>
        </div>
        <p v-else-if="bookDate" class="muted" style="font-size: 14px">Энэ өдөрт боломжит цаг байхгүй эсвэл бүгд захиалагдсан байна.</p>
        <div class="field" style="margin-top: 22px">
          <label
            >What would you like to focus on?
            <span class="muted" style="font-weight: 400">(optional)</span></label
          >
          <input
            v-model="topic"
            class="input"
            placeholder="e.g. career direction, managing stress…"
          />
        </div>
        <p v-if="bookingErr" style="margin-top: 14px; font-size: 13px; color: var(--bad); text-align: center">
          {{ bookingErr }}
        </p>
        <button
          class="btn btn-primary btn-block btn-lg"
          style="margin-top: 22px"
          :disabled="!bookSlot"
          @click="confirmBooking"
        >
          Confirm booking
        </button>
      </div>

      <div v-else style="padding: 40px 26px; text-align: center">
        <div
          class="pop"
          style="width: 70px; height: 70px; border-radius: 50%; background: var(--good-tint); color: var(--good); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px"
        >
          <UiIcon name="check" :size="34" />
        </div>
        <h3 style="font-size: 24px; margin-bottom: 10px">You're booked.</h3>
        <p class="muted" style="max-width: 360px; margin: 0 auto 6px; font-size: 15px">
          {{ bookDate?.d }} {{ bookDate?.n }} · {{ bookSlot?.time }}. A calendar invite and video link are on their way to
          your inbox.
        </p>
        <button class="btn btn-ghost" style="margin-top: 22px" @click="emit('close')">Done</button>
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
.daycell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 0;
  border: 1.5px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.daycell:hover {
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
@media (max-width: 767px) {
  .slot-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
</style>

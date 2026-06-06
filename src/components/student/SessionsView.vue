<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const emit = defineEmits(['book'])
const { session } = useAuth()

const upcoming = ref([])
const past = ref([])

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function serviceLabel(type) {
  return type === 'tarot_reading' ? 'Тарот уншлага' : '1:1 Coaching'
}

async function loadSessions() {
  if (!session.value) return
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, service_type, description')
    .eq('user_id', session.value.user.id)
    .order('start_at', { ascending: true })
  if (!data) return
  upcoming.value = data
    .filter((s) => s.start_at >= now)
    .map((s) => ({
      id: s.id,
      date: fmtDate(s.start_at),
      time: fmtTime(s.start_at),
      topic: serviceLabel(s.service_type),
      name: 'Dr. Maren',
      dur: Math.round((new Date(s.end_at) - new Date(s.start_at)) / 60000),
    }))
  past.value = data
    .filter((s) => s.start_at < now)
    .map((s) => ({
      id: s.id,
      date: fmtDate(s.start_at),
      time: fmtTime(s.start_at),
      topic: serviceLabel(s.service_type),
      note: s.description || '—',
    }))
}

let realtimeChannel = null

onMounted(async () => {
  await loadSessions()
  realtimeChannel = supabase
    .channel('user-sessions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, loadSessions)
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow" style="max-width: 900px">
      <!-- mentor banner -->
      <div
        class="card rise flex flex-col sm:flex-row"
        style="border-radius: 18px; padding: 24px 28px; margin-bottom: 28px; gap: 20px; align-items: center; background: linear-gradient(120deg, var(--sage-tint), var(--card))"
      >
        <UiAvatar name="Maren Halvorsen" color="var(--primary)" :size="62" />
        <div style="flex: 1; text-align: center">
          <h3 style="font-size: 20px">Tsogoo</h3>
          <p class="muted" style="font-size: 14px; margin-top: 3px">Онлайн уулзалт цаг товлох.</p>
        </div>
        <button class="btn btn-primary btn-block sm:btn-block" style="width: 100%; max-width: 100%" @click="emit('book')"><UiIcon name="calendar" :size="17" /> Book a session</button>
      </div>

      <h3 style="font-size: 17px; margin-bottom: 14px">Upcoming</h3>
      <div class="flex flex-col" style="gap: 12px; margin-bottom: 34px">
        <div
          v-for="(s, i) in upcoming"
          :key="i"
          class="card rise d1 session-row flex flex-col sm:flex-row sm:items-center"
          style="border-radius: 14px; padding: 18px; gap: 18px; border-left: 4px solid var(--clay)"
        >
          <div class="flex items-center" style="gap: 18px; width: 100%">
            <div style="text-align: center; width: 64px; flex: none">
            <div style="font-family: var(--serif); font-weight: 700; font-size: 16px; color: var(--clay-deep)">{{ s.date }}</div>
            <div class="muted" style="font-size: 13px">{{ s.time }}</div>
          </div>
          <div style="width: 1px; height: 40px; background: var(--line)" />
          <div style="flex: 1; min-width: 0">
            <div style="font-weight: 600; font-size: 15.5px">{{ s.topic }}</div>
            <div class="muted" style="font-size: 13.5px">{{ s.name }} · {{ s.dur }} min · Video call</div>
          </div>
          </div>
          <div class="flex items-center flex-wrap" style="gap: 8px; width: 100%; sm:width: auto">
            <button class="btn btn-ghost btn-sm" @click="emit('book')">Reschedule</button>
            <button class="btn btn-blue btn-sm"><UiIcon name="video" :size="16" /> Join</button>
          </div>
        </div>
        <div v-if="!upcoming.length" class="muted" style="font-size: 14px; padding: 8px 0">No upcoming sessions. Book one above.</div>
      </div>

      <h3 style="font-size: 17px; margin-bottom: 14px">Past sessions</h3>
      <div class="flex flex-col" style="gap: 12px">
        <div
          v-for="(s, i) in past"
          :key="i"
          class="card rise session-row flex flex-col sm:flex-row sm:items-center"
          :style="{ borderRadius: '14px', padding: '18px', gap: '18px', animationDelay: i * 0.06 + 0.1 + 's' }"
        >
          <div class="flex items-center" style="gap: 18px; width: 100%">
            <div style="text-align: center; width: 64px; flex: none">
            <div style="font-family: var(--serif); font-weight: 700; font-size: 16px">{{ s.date }}</div>
            <div class="muted" style="font-size: 13px">{{ s.time }}</div>
          </div>
          <div style="width: 1px; height: 40px; background: var(--line)" />
          <div style="flex: 1; min-width: 0">
            <div style="font-weight: 600; font-size: 15.5px">{{ s.topic }}</div>
            <div class="muted" style="font-size: 13.5px">
              <UiIcon name="note" :size="13" style="vertical-align: -2px" /> {{ s.note }}
            </div>
          </div>
          </div>
          <button class="btn btn-quiet btn-sm" style="align-self: flex-start">View notes</button>
        </div>
        <div v-if="!past.length" class="muted" style="font-size: 14px; padding: 8px 0">No past sessions yet.</div>
      </div>
    </div>
  </div>
</template>

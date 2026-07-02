<script setup>
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

defineProps({
  slots: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

function fmtDt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Relative "decided" time so recent activity reads at a glance.
function fmtAgo(iso) {
  if (!iso) return ''
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'саяхан'
  if (diffMin < 60) return `${diffMin} мин өмнө`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h} цагийн өмнө`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} өдрийн өмнө`
  return fmtDt(iso)
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; overflow-y: auto">
    <div class="page-inset" style="max-width: 800px">
      <div v-if="loading" style="padding: 48px; text-align: center; color: var(--muted)">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
        Уншиж байна…
      </div>

      <div v-else-if="!slots.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)">
        <UiIcon name="clock" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
        <p style="font-size: 15px">Түүх хоосон байна.</p>
      </div>

      <div v-else class="flex flex-col" style="gap: 10px">
        <div
          v-for="slot in slots"
          :key="slot.id"
          class="card sched-history-row"
          :style="{
            borderRadius: '14px',
            padding: '14px 18px',
            borderLeft: slot.status === 'booked' ? '4px solid var(--good)' : '4px solid var(--bad)',
          }"
        >
          <div class="flex items-center flex-wrap" style="gap: 14px">
            <!-- Status badge -->
            <span
              class="sched-history-badge"
              :style="{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 11px', borderRadius: '999px',
                fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                background: slot.status === 'booked' ? 'var(--good-tint)' : 'var(--bad-tint)',
                color: slot.status === 'booked' ? 'var(--good)' : 'var(--bad)',
              }"
            >
              <UiIcon :name="slot.status === 'booked' ? 'check' : 'x'" :size="13" />
              {{ slot.status === 'booked' ? 'Баталсан' : 'Татгалзсан' }}
            </span>

            <!-- User -->
            <div class="flex items-center" style="gap: 10px; flex: 1; min-width: 180px">
              <UiAvatar :name="slot.profiles?.full_name || slot.profiles?.email || '?'" :size="36" />
              <div style="min-width: 0">
                <div style="font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ slot.profiles?.full_name || '—' }}
                </div>
                <div class="muted" style="font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ slot.profiles?.email }}
                </div>
              </div>
            </div>

            <!-- Slot time + decision time -->
            <div class="sched-history-times" style="text-align: right">
              <div style="font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; justify-content: flex-end">
                <UiIcon name="calendar" :size="13" />
                {{ fmtDt(slot.start_at) }}
              </div>
              <div class="muted" style="font-size: 12px; margin-top: 3px">
                Шийдвэрлэсэн: {{ fmtAgo(slot.decided_at) }}
              </div>
            </div>
          </div>

          <a
            v-if="slot.status === 'booked' && slot.meet_link"
            :href="slot.meet_link"
            target="_blank"
            rel="noopener"
            style="display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12.5px; font-weight: 600; color: var(--primary); text-decoration: none"
          >
            <UiIcon name="video" :size="14" /> Google Meet линк
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import StatCard from '@/components/student/StatCard.vue'

const props = defineProps({
  pending: { type: Number, default: 0 },
  pendingMeetings: { type: Number, default: 0 },
})
const emit = defineEmits(['set-view'])

// Each stat is a one-click jump into the view it summarizes.
const statViews = ['payments', 'videos', 'tests', 'members']

const appts = ref([])
const statsData = ref([
  { icon: 'bank', hue: 'var(--clay)', tint: 'var(--clay-tint)', value: props.pending, label: 'Баталгаажуулах төлбөр', foot: 'Үйлдэл шаардлагатай' },
  { icon: 'video', hue: 'var(--primary)', tint: 'var(--primary-tint)', value: '—', label: 'Нийтэлсэн хичээлүүд', foot: '' },
  { icon: 'compass', hue: 'var(--sage-deep)', tint: 'var(--sage-tint)', value: '—', label: 'Нийтэлсэн тестүүд', foot: '' },
  { icon: 'users', hue: 'var(--gold)', tint: 'var(--gold-tint)', value: '—', label: 'Идэвхтэй гишүүд', foot: '' },
])

watch(() => props.pending, (n) => { statsData.value[0].value = n }, { immediate: true })

onMounted(async () => {
  const [{ count: vCount }, { count: tCount }, { count: uCount }] = await Promise.all([
    supabase.from('video_lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('psychology_tests').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
  ])
  statsData.value[1].value = vCount ?? 0
  statsData.value[2].value = tCount ?? 0
  statsData.value[3].value = uCount ?? 0

  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, description, status, service_type')
    .in('status', ['available', 'pending', 'booked'])
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(4)
  appts.value = data ?? []
})

function fmtSlot(slot) {
  const d = new Date(slot.start_at)
  return d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; overflow-y: auto; height: calc(100vh - 72px)">
    <div class="page-inset-narrow">
      <div class="grid-admin-4" style="margin-bottom: 26px">
        <div
          v-for="(s, i) in statsData"
          :key="i"
          class="rise stat-jump"
          :style="{ animationDelay: i * 0.05 + 's' }"
          @click="emit('set-view', statViews[i])"
        >
          <StatCard v-bind="s" />
        </div>
      </div>
      <div class="grid-admin-2">
        <!-- needs-attention inbox: every pending queue in one place -->
        <div class="card card-pad rise d1" style="border-radius: 16px">
          <h3 style="font-size: 18px; margin-bottom: 16px">Анхаарал шаардлагатай</h3>

          <div class="flex flex-col" style="gap: 10px">
            <!-- pending payments -->
            <button
              v-if="pending > 0"
              class="attn-row"
              style="background: var(--clay-tint)"
              @click="emit('set-view', 'payments')"
            >
              <div class="attn-icon" style="background: var(--clay)"><UiIcon name="bank" :size="21" /></div>
              <div style="flex: 1; text-align: left">
                <div style="font-weight: 600">{{ pending }} төлбөрийн баримт</div>
                <div style="font-size: 13px; color: var(--clay-deep)">Элсэлт хүлээж буй оюутнууд</div>
              </div>
              <UiIcon name="chevRight" :size="20" style="color: var(--clay-deep)" />
            </button>

            <!-- pending meeting bookings -->
            <button
              v-if="pendingMeetings > 0"
              class="attn-row"
              style="background: var(--warn-tint)"
              @click="emit('set-view', 'schedule')"
            >
              <div class="attn-icon" style="background: var(--warn)"><UiIcon name="calendar" :size="21" /></div>
              <div style="flex: 1; text-align: left">
                <div style="font-weight: 600">{{ pendingMeetings }} уулзалтын хүсэлт</div>
                <div style="font-size: 13px; color: var(--warn)">Баталгаажуулахыг хүлээж байна</div>
              </div>
              <UiIcon name="chevRight" :size="20" style="color: var(--warn)" />
            </button>

            <!-- all clear -->
            <div
              v-if="pending === 0 && pendingMeetings === 0"
              style="background: var(--sage-tint); border-radius: 12px; padding: 16px; display: flex; gap: 13px; align-items: center"
            >
              <div class="attn-icon" style="background: var(--sage-deep)"><UiIcon name="check" :size="21" /></div>
              <div style="font-weight: 600; color: var(--sage-deep)">Бүх хүсэлт шийдэгдсэн</div>
            </div>
          </div>
        </div>

        <!-- upcoming coaching slots -->
        <div class="card card-pad rise d2" style="border-radius: 16px">
          <div class="flex items-center justify-between" style="margin-bottom: 16px">
            <h3 style="font-size: 18px">Ойрын цагууд</h3>
            <button class="btn btn-soft btn-sm" @click="emit('set-view', 'schedule')">Хуваарь харах</button>
          </div>
          <div v-if="appts.length" class="flex flex-col" style="gap: 10px">
            <div v-for="a in appts" :key="a.id" class="flex items-center" style="gap: 12px">
              <div style="width: 34px; height: 34px; border-radius: 9px; background: var(--primary-tint); color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
                <UiIcon name="calendar" :size="17" />
              </div>
              <div style="flex: 1; min-width: 0">
                <div style="font-weight: 600; font-size: 14px">Онлайн уулзалт</div>
                <div class="muted" style="font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ a.description || '—' }}</div>
              </div>
              <div style="text-align: right; font-size: 12.5px; flex-shrink: 0">
                <div style="font-weight: 600">{{ fmtSlot(a) }}</div>
                <span :class="a.status === 'booked' ? 'chip clay' : 'chip'" style="font-size: 11px; padding: 2px 7px">{{ a.status }}</span>
              </div>
            </div>
          </div>
          <div v-else class="muted" style="font-size: 14px; padding: 12px 0; text-align: center">
            Ойрын цаг захиалга байхгүй
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.stat-jump {
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}
.stat-jump:hover {
  transform: translateY(-2px);
}
.stat-jump:active {
  transform: translateY(0);
}
.attn-row {
  border: none;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 13px;
  align-items: center;
  cursor: pointer;
  width: 100%;
  transition: filter 0.14s ease;
}
.attn-row:hover {
  filter: brightness(0.97);
}
.attn-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>

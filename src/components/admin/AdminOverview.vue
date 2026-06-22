<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import StatCard from '@/components/student/StatCard.vue'

const props = defineProps({
  pending: { type: Number, default: 0 },
})
const emit = defineEmits(['set-view'])

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
        <div v-for="(s, i) in statsData" :key="i" class="rise" :style="{ animationDelay: i * 0.05 + 's' }">
          <StatCard v-bind="s" />
        </div>
      </div>
      <div class="grid-admin-2">
        <!-- pending payments card -->
        <div class="card card-pad rise d1" style="border-radius: 16px">
          <div class="flex items-center justify-between" style="margin-bottom: 16px">
            <h3 style="font-size: 18px">Анхаарал шаардлагатай</h3>
            <button class="btn btn-soft btn-sm" @click="emit('set-view', 'payments')">Дараалал харах</button>
          </div>
          <div style="background: var(--clay-tint); border-radius: 12px; padding: 16px; display: flex; gap: 13px; align-items: center">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--clay); color: #fff; display: flex; align-items: center; justify-content: center">
              <UiIcon name="bank" :size="21" />
            </div>
            <div style="flex: 1">
              <div style="font-weight: 600">{{ pending }} төлбөрийн баримт</div>
              <div style="font-size: 13px; color: var(--clay-deep)">Элсэлт хүлээж буй оюутнууд</div>
            </div>
            <UiIcon name="chevRight" :size="20" style="color: var(--clay-deep); cursor: pointer" @click="emit('set-view', 'payments')" />
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

      <!-- quick actions -->
      <div class="grid-admin-2" style="margin-top: 22px">
        <div class="card card-pad rise d3" style="border-radius: 16px">
          <h3 style="font-size: 16px; margin-bottom: 14px">Хурдан үйлдлүүд</h3>
          <div class="flex flex-col" style="gap: 8px">
            <button class="btn btn-ghost btn-sm" style="justify-content: flex-start; gap: 12px" @click="emit('set-view', 'videos')">
              <UiIcon name="video" :size="18" style="color: var(--primary)" /> Видео хичээл нэмэх
            </button>
            <button class="btn btn-ghost btn-sm" style="justify-content: flex-start; gap: 12px" @click="emit('set-view', 'tests')">
              <UiIcon name="compass" :size="18" style="color: var(--sage-deep)" /> Тест нэмэх
            </button>
            <button class="btn btn-ghost btn-sm" style="justify-content: flex-start; gap: 12px" @click="emit('set-view', 'payments')">
              <UiIcon name="bank" :size="18" style="color: var(--clay)" /> Төлбөрүүд шалгах
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { instructor } from '@/data/union.js'
import UiIcon from '@/components/common/UiIcon.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import tarotImg from '../../../imgs.video/tarot.jpg'
import { supabase } from '@/lib/supabase.js'

const emit = defineEmits(['book'])
const m = instructor

const availSlots = ref([])

function fmtSlotLabel(s) {
  const d = new Date(s.start_at)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const type = s.service_type === 'tarot_reading' ? 'Тарот' : 'Coaching'
  return `${date} · ${hh}:${mm} (${type})`
}

onMounted(async () => {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, service_type')
    .eq('status', 'available')
    .is('user_id', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
    .limit(6)
  availSlots.value = data ?? []
})
</script>

<template>
  <section
    id="mentor"
    class="landing-section landing-section--band"
    style="background: var(--surface-2); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line)"
  >
    <div class="mx-auto max-w-wrap grid-mentor">
      <div class="landing-reveal landing-reveal--scale" style="position: relative">
        <div style="position: relative; aspect-ratio: 4/5; border-radius: 18px; box-shadow: var(--sh-lg); overflow: hidden">
          <div style="position: absolute; inset: 0; background: linear-gradient(160deg, var(--sage), var(--primary-deep))" />
          <ImageSlot
            id="union-mentor"
            :radius="18"
            :src="tarotImg"
            placeholder="Drop mentor portrait"
            style="position: absolute; inset: 0; height: 100%"
          />
        </div>
      </div>
      <div class="landing-reveal" style="transition-delay: 0.1s">
        <div class="kicker sage" style="margin-bottom: 14px">Your mentor</div>
        <h2 style="font-size: clamp(28px, 5vw, 36px); margin-bottom: 8px">{{ m.name }}</h2>
        <div style="color: var(--clay); font-weight: 600; margin-bottom: 20px">{{ m.role }}</div>
        <p style="font-size: 17px; color: var(--ink-soft); line-height: 1.65; max-width: 520px">{{ m.bio }}</p>
        <div class="flex flex-col" style="gap: 10px; margin: 24px 0 30px">
          <div v-for="c in m.credentials" :key="c" class="flex items-center" style="gap: 12px; font-size: 15px">
            <span style="color: var(--sage-deep)"><UiIcon name="checkCircle" :size="19" /></span>{{ c }}
          </div>
        </div>
        <!-- Available slots preview -->
        <div style="margin-bottom: 22px">
          <div class="kicker sage" style="margin-bottom: 10px">Боломжит цагууд</div>
          <div v-if="availSlots.length" style="display: flex; flex-wrap: wrap; gap: 8px">
            <span
              v-for="s in availSlots"
              :key="s.id"
              style="padding: 7px 13px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-soft); cursor: pointer"
              @click="emit('book')"
            >
              {{ fmtSlotLabel(s) }}
            </span>
          </div>
          <p v-else class="muted" style="font-size: 13.5px">Одоогоор нээлттэй цаг байхгүй байна.</p>
        </div>

        <button class="btn btn-blue btn-lg btn-block" @click="emit('book')">
          <UiIcon name="calendar" :size="18" /> Надтай уулзалтын цаг товлох
        </button>
      </div>
    </div>
  </section>
</template>

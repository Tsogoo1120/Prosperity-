<script setup>
import { computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiRing from '@/components/common/UiRing.vue'
import UiBar from '@/components/common/UiBar.vue'

const props = defineProps({
  test: { type: Object, required: true },
  result: { type: Object, required: true }, // { scoreData, summary }
})
const emit = defineEmits(['retake', 'exit'])

const scoringType = computed(() => props.test.scoring_rules?.type ?? 'simple')

// Simple: single numeric value
const simpleScore = computed(() => props.result.scoreData?.value ?? 0)
const simpleMax = computed(() => {
  const ranges = props.test.scoring_rules?.ranges ?? []
  return ranges.length ? ranges[ranges.length - 1].max : 100
})
const simpleRatio = computed(() => Math.min(1, simpleScore.value / (simpleMax.value || 1)))

// Big Five: trait bars
const traitEntries = computed(() => {
  if (scoringType.value !== 'big_five') return []
  const traitInfo = props.test.scoring_rules?.traitInfo ?? {}
  const levels = props.test.scoring_rules?.resultLevels ?? []
  const maxLevel = levels.length ? levels[levels.length - 1].max : 40
  return Object.entries(props.result.scoreData ?? {}).map(([key, val]) => ({
    key,
    label: traitInfo[key]?.title ?? key,
    value: val,
    ratio: Math.min(1, Math.max(0, val / maxLevel)),
  }))
})

// Category count: winning category info
const winnerInfo = computed(() => {
  if (scoringType.value !== 'category_count') return null
  const categories = props.test.scoring_rules?.categories ?? {}
  const counts = props.result.scoreData ?? {}
  const order = props.test.scoring_rules?.categoryOrder ?? Object.keys(counts)
  let winner = null, max = -1
  for (const key of order) {
    if ((counts[key] ?? 0) > max) { max = counts[key] ?? 0; winner = key }
  }
  return winner ? { ...categories[winner], key: winner } : null
})

const barColor = (ratio) => ratio >= 0.7 ? 'var(--sage-deep)' : ratio >= 0.5 ? 'var(--primary)' : 'var(--clay)'
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-centered">

      <!-- Hero card -->
      <div class="card rise" style="border-radius: 20px; overflow: hidden; margin-bottom: 24px">
        <div
          class="grid-test-hero"
          style="padding: 34px 36px; background: linear-gradient(120deg, var(--clay-tint), var(--card))"
        >
          <!-- Simple: ring -->
          <UiRing
            v-if="scoringType === 'simple'"
            :value="simpleRatio"
            :size="128"
            :stroke="10"
            color="var(--clay)"
            :label="simpleScore"
          />
          <!-- Big Five: no ring, icon -->
          <div
            v-else
            :style="{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--clay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }"
          >
            <UiIcon name="compass" :size="38" />
          </div>

          <div>
            <div class="kicker" style="margin-bottom: 10px">{{ test.title }} · Үр дүн</div>
            <h2 style="font-size: 24px; margin-bottom: 8px">
              {{ result.summary ?? 'Тестийн үр дүн' }}
            </h2>
            <p v-if="scoringType === 'simple'" class="muted" style="font-size: 15px; line-height: 1.55">
              Нийт оноо: {{ simpleScore }} / {{ simpleMax }}
            </p>
            <p v-else-if="scoringType === 'category_count' && winnerInfo" class="muted" style="font-size: 15px; line-height: 1.55">
              {{ winnerInfo.meaning }}
            </p>
          </div>
        </div>
      </div>

      <!-- Big Five: trait breakdown -->
      <div v-if="scoringType === 'big_five' && traitEntries.length" class="card card-pad rise" style="border-radius: 16px; margin-bottom: 24px">
        <h3 style="font-size: 18px; margin-bottom: 18px">Шинж чанарын задаргаа</h3>
        <div class="flex flex-col" style="gap: 16px">
          <div v-for="t in traitEntries" :key="t.key">
            <div class="flex items-center justify-between" style="font-size: 13.5px; margin-bottom: 6px">
              <span style="font-weight: 500">{{ t.label }}</span>
              <span style="font-weight: 700">{{ t.value }}</span>
            </div>
            <UiBar :value="t.ratio" :color="barColor(t.ratio)" />
          </div>
        </div>
      </div>

      <!-- Category count: all categories -->
      <div v-else-if="scoringType === 'category_count'" class="card card-pad rise" style="border-radius: 16px; margin-bottom: 24px">
        <h3 style="font-size: 18px; margin-bottom: 18px">Ангиллын тоолол</h3>
        <div class="flex flex-col" style="gap: 12px">
          <div
            v-for="(count, key) in result.scoreData"
            :key="key"
            class="flex items-center justify-between"
            :style="{ padding: '10px 14px', borderRadius: '10px', background: winnerInfo?.key === key ? 'var(--clay-tint)' : 'var(--surface-2)', border: winnerInfo?.key === key ? '1px solid var(--clay)' : '1px solid transparent' }"
          >
            <span style="font-weight: 500; font-size: 14.5px">
              {{ test.scoring_rules?.categories?.[key]?.title ?? key }}
              <span v-if="winnerInfo?.key === key" style="margin-left: 6px; font-size: 12px; color: var(--clay)">✓ Тэнцүүлэгч</span>
            </span>
            <span style="font-weight: 700; font-size: 16px">{{ count }}</span>
          </div>
        </div>
      </div>

      <div class="btn-row-center" style="margin-top: 8px">
        <button class="btn btn-ghost" @click="emit('exit')">Тест жагсаалт руу</button>
        <button class="btn btn-primary" @click="emit('retake')">
          <UiIcon name="trend" :size="16" /> Дахин өгөх
        </button>
      </div>
    </div>
  </div>
</template>

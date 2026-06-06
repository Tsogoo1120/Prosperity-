<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  color: { type: String, default: 'var(--primary)' },
  w: { type: Number, default: 120 },
  h: { type: Number, default: 36 },
})

const pts = computed(() => {
  const data = props.data
  if (!data.length) return []
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  return data.map((d, i) => [
    (i / (data.length - 1)) * props.w,
    props.h - ((d - min) / rng) * (props.h - 6) - 3,
  ])
})

const path = computed(() =>
  pts.value.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '),
)
const last = computed(() => pts.value[pts.value.length - 1])
</script>

<template>
  <svg v-if="pts.length" :width="w" :height="h" style="overflow: visible">
    <path :d="path" fill="none" :stroke="color" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <circle :cx="last[0]" :cy="last[1]" r="3" :fill="color" />
  </svg>
</template>

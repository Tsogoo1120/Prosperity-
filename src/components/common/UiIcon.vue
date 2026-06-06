<script setup>
import { computed } from 'vue'
import { ICONS } from './icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  stroke: { type: [Number, String], default: 1.7 },
  fill: { type: Boolean, default: false },
})

const segments = computed(() =>
  (ICONS[props.name] || '')
    .split('M')
    .filter(Boolean)
    .map((seg) => 'M' + seg),
)

// Only the "play" glyph reads well as a solid shape when filled.
const svgFill = computed(() => (props.name === 'play' && props.fill ? 'currentColor' : 'none'))
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="svgFill"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="flex: none"
    aria-hidden="true"
  >
    <path v-for="(d, i) in segments" :key="i" :d="d" />
  </svg>
</template>

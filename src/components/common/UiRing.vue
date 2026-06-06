<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 56 },
  stroke: { type: Number, default: 5 },
  color: { type: String, default: 'var(--clay)' },
  track: { type: String, default: 'var(--surface-3)' },
  label: { type: [String, Number, null], default: null },
})

const r = computed(() => (props.size - props.stroke) / 2)
const circ = computed(() => 2 * Math.PI * r.value)
const offset = computed(() => circ.value * (1 - props.value))
const display = computed(() =>
  props.label != null ? props.label : Math.round(props.value * 100) + '%',
)
</script>

<template>
  <div :style="{ position: 'relative', width: size + 'px', height: size + 'px', flex: 'none' }">
    <svg :width="size" :height="size" style="transform: rotate(-90deg)">
      <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke="track" :stroke-width="stroke" />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circ"
        :stroke-dashoffset="offset"
        style="transition: stroke-dashoffset 0.8s cubic-bezier(0.2, 0.7, 0.2, 1)"
      />
    </svg>
    <div
      :style="{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.26 + 'px',
        fontFamily: 'var(--sans)',
      }"
    >
      {{ display }}
    </div>
  </div>
</template>

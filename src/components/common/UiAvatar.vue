<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  color: { type: String, default: 'var(--primary)' },
  size: { type: Number, default: 38 },
})

const initials = computed(() =>
  props.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
</script>

<template>
  <div
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: '50%',
      flex: 'none',
      background: color,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      fontSize: size * 0.38 + 'px',
      fontFamily: 'var(--sans)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)',
    }"
  >
    {{ initials }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: Number, default: 22 },
  light: { type: Boolean, default: false },
})

const c1 = computed(() => (props.light ? '#fff' : 'var(--primary)'))
const c2 = computed(() => (props.light ? 'rgba(255,255,255,.7)' : 'var(--clay)'))
</script>

<template>
  <div class="flex items-center" style="gap: 10px">
    <svg :width="size + 6" :height="size + 6" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 6v11a8 8 0 0 0 16 0V6" :stroke="c1" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="16" cy="25" r="2.4" :fill="c2" />
    </svg>
    <span
      class="font-serif"
      :style="{
        fontWeight: 600,
        fontSize: size + 'px',
        letterSpacing: '-0.02em',
        color: light ? '#fff' : 'var(--ink)',
      }"
      >Union</span
    >
  </div>
</template>

<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  title: { type: String, required: true },
  sub: { type: [String, null], default: null },
})
defineEmits(['menu'])
</script>

<template>
  <div
    class="topbar-row"
    style="border-bottom: 1px solid var(--line); background: var(--card)"
  >
    <div class="flex items-center" style="gap: 12px; min-width: 0">
      <button class="menu-toggle" aria-label="Open navigation" @click="$emit('menu')">
        <UiIcon name="menu" :size="20" />
      </button>
      <div style="min-width: 0">
        <h2 style="font-size: clamp(18px, 4vw, 23px); line-height: 1.2">{{ title }}</h2>
        <div v-if="sub" class="muted hide-mobile" style="font-size: 13.5px; margin-top: 2px">{{ sub }}</div>
      </div>
    </div>
    <slot name="right" />
  </div>
</template>

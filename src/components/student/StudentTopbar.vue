<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  title: { type: String, default: '' },
  sub: { type: [String, null], default: null },
  showBook: { type: Boolean, default: false },
})
const emit = defineEmits(['book', 'menu'])
</script>

<template>
  <div
    class="topbar-row"
    style="border-bottom: 1px solid var(--line); position: sticky; top: 0; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(10px); z-index: 20"
  >
    <div class="flex items-center" style="gap: 12px; min-width: 0">
      <button class="menu-toggle" aria-label="Open navigation" @click="emit('menu')">
        <UiIcon name="menu" :size="20" />
      </button>
      <div style="min-width: 0">
        <h2 style="font-size: clamp(18px, 4vw, 22px); line-height: 1.2">{{ title }}</h2>
        <div v-if="sub" class="muted hide-mobile" style="font-size: 13.5px; margin-top: 2px">{{ sub }}</div>
      </div>
    </div>
    <div class="flex items-center" style="gap: 8px; flex-shrink: 0">
      <div
        class="hide-mobile flex items-center"
        style="background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; gap: 9px; width: 230px; color: var(--faint)"
      >
        <UiIcon name="search" :size="17" /><span style="font-size: 13.5px">Search lessons, notes…</span>
      </div>
      <button class="btn btn-quiet" style="padding: 10px; border-radius: 999px; border: 1px solid var(--line)">
        <UiIcon name="bell" :size="18" />
      </button>
      <button v-if="showBook" class="btn btn-primary btn-sm hide-mobile" @click="emit('book')">
        <UiIcon name="calendar" :size="16" /> Book session
      </button>
      <button v-if="showBook" class="btn btn-primary btn-sm show-mobile-only" style="padding: 10px" title="Book session" @click="emit('book')">
        <UiIcon name="calendar" :size="18" />
      </button>
    </div>
  </div>
</template>

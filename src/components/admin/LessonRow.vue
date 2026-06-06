<script setup>
import { computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  lesson: { type: Object, required: true },
})

const icon = computed(() => (props.lesson.type === 'reading' ? 'doc' : 'video'))
</script>

<template>
  <div
    class="flex items-center"
    style="gap: 12px; padding: 11px 14px; background: var(--card); border: 1px solid var(--line); border-radius: 10px"
  >
    <span style="color: var(--faint); cursor: grab"><UiIcon name="dots" :size="16" /></span>
    <span
      :style="{
        width: '30px',
        height: '30px',
        borderRadius: '8px',
        flex: 'none',
        background: lesson.type === 'reading' ? 'var(--sage-tint)' : 'var(--primary-tint)',
        color: lesson.type === 'reading' ? 'var(--sage-deep)' : 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }"
    >
      <UiIcon :name="icon" :size="16" />
    </span>
    <div style="flex: 1">
      <div style="font-weight: 500; font-size: 14px">{{ lesson.title }}</div>
      <div class="muted" style="font-size: 12px">{{ lesson.type === 'reading' ? 'Reading' : 'Video' }} · {{ lesson.dur }}</div>
    </div>
    <span class="chip" style="font-size: 11px">{{ lesson.done ? 'Published' : 'Draft' }}</span>
    <button class="btn btn-quiet" style="padding: 6px"><UiIcon name="dots" :size="16" /></button>
  </div>
</template>

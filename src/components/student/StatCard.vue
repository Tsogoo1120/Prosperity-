<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  icon: { type: String, required: true },
  hue: { type: String, required: true },
  tint: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  foot: { type: String, default: '' },
})
</script>

<template>
  <div class="card card-pad" style="border-radius: 14px; padding: 18px">
    <div class="flex items-center justify-between" style="margin-bottom: 14px">
      <div
        :style="{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: tint,
          color: hue,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }"
      >
        <UiIcon :name="icon" :size="21" />
      </div>
    </div>
    <div style="font-family: var(--serif); font-weight: 700; font-size: 28px; line-height: 1">{{ value }}</div>
    <div class="muted" style="font-size: 13.5px; margin-top: 5px">{{ label }}</div>
    <div v-if="foot" style="font-size: 12.5px; color: var(--sage-deep); margin-top: 6px; font-weight: 600">{{ foot }}</div>
  </div>
</template>

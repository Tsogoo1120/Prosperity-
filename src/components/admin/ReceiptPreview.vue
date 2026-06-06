<script setup>
import { computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  payment: { type: Object, required: true },
})

const rows = computed(() => [
  ['From', props.payment.name],
  ['To', 'Union Education Ltd'],
  ['Reference', props.payment.ref],
  ['Date', 'Jun 1, 2026'],
])
</script>

<template>
  <div
    style="background: #fff; border-radius: 10px; padding: 22px; border: 1px solid var(--line); font-family: var(--sans); color: #1a2c33; box-shadow: var(--sh-sm)"
  >
    <div class="flex items-center justify-between" style="border-bottom: 1px dashed #cdd8d4; padding-bottom: 12px; margin-bottom: 14px">
      <div style="font-weight: 700; letter-spacing: 0.04em; color: #355169">NORTHBRIDGE TRUST</div>
      <UiIcon name="bank" :size="20" style="color: #355169" />
    </div>
    <div style="font-size: 12.5px; color: #5a6e74; margin-bottom: 4px">Transfer confirmation</div>
    <div style="font-family: var(--serif); font-size: 30px; font-weight: 700; color: #16313f; margin-bottom: 16px">${{ payment.amount }}.00</div>
    <div
      v-for="[k, v] in rows"
      :key="k"
      class="flex items-center justify-between"
      style="padding: 7px 0; border-bottom: 1px solid #eef2f0; font-size: 13px"
    >
      <span style="color: #5a6e74">{{ k }}</span><span style="font-weight: 600">{{ v }}</span>
    </div>
    <div class="flex items-center" style="gap: 8px; margin-top: 14px; color: #4f8a6b; font-size: 12.5px; font-weight: 600">
      <UiIcon name="checkCircle" :size="15" /> Completed
    </div>
  </div>
</template>

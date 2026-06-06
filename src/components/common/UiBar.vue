<script setup>
defineProps({
  value: { type: Number, default: 0 },
  color: { type: String, default: 'var(--clay)' },
  h: { type: Number, default: 7 },
})
</script>

<template>
  <div
    :style="{
      background: 'var(--surface-3)',
      borderRadius: '999px',
      height: h + 'px',
      overflow: 'hidden',
      width: '100%',
    }"
  >
    <div
      :style="{
        width: value * 100 + '%',
        height: '100%',
        background: color,
        borderRadius: '999px',
        transition: 'width .8s cubic-bezier(.2,.7,.2,1)',
      }"
    />
  </div>
</template>

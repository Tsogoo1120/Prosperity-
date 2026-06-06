<script setup>
// Soft decorative "calm field" background (layered radial blobs).
defineProps({
  styleOverride: { type: Object, default: () => ({}) },
  /** Richer blurred gradients — landing hero / CTA */
  intense: { type: Boolean, default: false },
})
</script>

<template>
  <div
    aria-hidden="true"
    class="calm-field"
    :class="{ 'calm-field--intense': intense }"
    :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...styleOverride }"
  >
    <div class="calm-field__blob calm-field__blob--sage" />
    <div class="calm-field__blob calm-field__blob--primary" />
    <div class="calm-field__blob calm-field__blob--clay" />
    <div class="calm-field__blob calm-field__blob--sage-mid" />
    <div class="calm-field__blob calm-field__blob--primary-soft" />
    <div class="calm-field__blob calm-field__blob--clay-warm" />
  </div>
</template>

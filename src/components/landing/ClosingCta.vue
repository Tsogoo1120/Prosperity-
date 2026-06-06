<script setup>
import UiIcon from '@/components/common/UiIcon.vue'
import CalmField from '@/components/common/CalmField.vue'
</script>

<template>
  <section id="cta" class="grain closing-cta landing-section landing-section--cta">
    <CalmField intense :style-override="{ opacity: 0.75 }" />
    <div class="mx-auto max-w-wrap landing-reveal closing-cta__inner" style="position: relative; text-align: center">
      <h2 style="color: #fff; font-size: clamp(32px, 4vw, 48px); max-width: 1400px; margin: 0 auto 18px">
       After Tuesday the calendar goes W T F
      </h2>
      <p style="color: rgba(255, 255, 255, 0.75); font-size: 18px; max-width: 520px; margin: 0 auto 32px">
        Асуух юм байвал миний хувийн хаяг луу шууд чат бичээрэй окэ
      </p>
      <div class="btn-row-center btn-row--stack-mobile">
        <a
          href="https://www.instagram.com/tsogoo_1120/"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-lg"
          style="background: rgba(255, 255, 255, 0.12); color: #fff"
          aria-label="Follow on Instagram (@tsogoo_1120)"
        >
          <UiIcon name="instagram" :size="19" />
          Instagram хаягаар холбогдох
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.closing-cta {
  position: relative;
  overflow: hidden;
  background: #16313f;
}
.closing-cta__inner {
  padding: 88px 32px;
}
</style>

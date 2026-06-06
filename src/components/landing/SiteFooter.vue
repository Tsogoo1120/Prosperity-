<script setup>
import UiLogo from '@/components/common/UiLogo.vue'

const emit = defineEmits(['nav'])
</script>

<template>
  <footer class="site-footer">
    <div class="mx-auto flex max-w-wrap flex-wrap items-center justify-between site-footer__inner">
      <UiLogo :size="19" light />
      <div class="flex items-center" style="gap: 26px; font-size: 13.5px; color: rgba(255, 255, 255, 0.6)">
                <span>Г.Алтанцог миний бие энэ вэбсайт хийсэн болно хаха   ©2026 Union</span><span> </span>

        <a href="#" @click.prevent="emit('nav', 'admin')">Admin portal</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background: #16313f;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.site-footer__inner {
  padding: 28px 32px;
  gap: 16px;
}
@media (max-width: 767px) {
  .site-footer__inner {
    flex-direction: column;
    align-items: flex-start;
    padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
    gap: 20px;
  }
  .site-footer__inner > div:last-child {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>

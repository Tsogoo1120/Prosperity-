<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  countLabel: { type: String, required: true },
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="content-library-scrim" @click="emit('close')">
      <section
        class="card pop content-library-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <header class="content-library-modal__head">
          <div>
            <span class="chip blue">{{ countLabel }}</span>
            <h2>{{ title }}</h2>
          </div>
          <button type="button" class="btn btn-quiet" aria-label="Хаах" @click="emit('close')">
            <UiIcon name="x" :size="19" />
          </button>
        </header>

        <div class="content-library-modal__body scroll-y">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.content-library-scrim {
  position: fixed;
  inset: 0;
  z-index: 79;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(11, 24, 30, 0.56);
  backdrop-filter: blur(5px);
}
.content-library-modal {
  display: flex;
  flex-direction: column;
  width: min(1120px, 96vw);
  max-height: min(88vh, 820px);
  overflow: hidden;
  border-radius: 20px;
  box-shadow: var(--sh-lg);
}
.content-library-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-bottom: 1px solid var(--line);
}
.content-library-modal__head .chip {
  margin-bottom: 9px;
}
.content-library-modal__head h2 {
  font-size: clamp(24px, 4vw, 32px);
}
.content-library-modal__body {
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
}
@media (max-width: 640px) {
  .content-library-scrim {
    align-items: flex-end;
    padding: 0;
  }
  .content-library-modal {
    width: 100%;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
  }
  .content-library-modal__head,
  .content-library-modal__body {
    padding: 18px;
  }
}
</style>

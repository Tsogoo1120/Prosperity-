<script setup>
import { computed } from 'vue'
import { getThumbnailUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  lesson: { type: Object, default: null },
  canWatch: { type: Boolean, default: false },
  hue: { type: String, default: 'var(--primary)' },
})
const emit = defineEmits(['close', 'watch', 'enroll'])

function fmtDur(s) {
  if (!s) return null
  const m = Math.floor(s / 60)
  const sec = String(s % 60).padStart(2, '0')
  return `${m}:${sec}`
}

const dur = computed(() => fmtDur(props.lesson?.duration_seconds))
</script>

<template>
  <Teleport to="body">
    <div v-if="open && lesson" class="modal-scrim" @click="emit('close')">
      <div class="lesson-preview-modal card pop" @click.stop>
        <button type="button" class="lesson-preview-modal__close btn btn-quiet" aria-label="Хаах" @click="emit('close')">
          <UiIcon name="x" :size="18" />
        </button>

        <!-- hero -->
        <div
          class="lesson-preview-modal__hero"
          :style="getThumbnailUrl(lesson.thumbnail_path)
            ? { backgroundImage: `url(${getThumbnailUrl(lesson.thumbnail_path)})` }
            : { background: `linear-gradient(150deg, ${hue}, color-mix(in srgb, ${hue} 55%, #16313f))` }"
        >
          <div class="grain lesson-preview-modal__grain" />
          <span v-if="lesson.category" class="chip lesson-preview-modal__chip">{{ lesson.category }}</span>

          <!-- lock / play badge -->
          <div class="lesson-preview-modal__badge" :class="canWatch ? 'lesson-preview-modal__badge--play' : ''">
            <UiIcon :name="canWatch ? 'play' : 'lock'" :size="24" :fill="canWatch" />
          </div>

          <span v-if="dur" class="chip lesson-preview-modal__dur">
            <UiIcon name="clock" :size="11" /> {{ dur }}
          </span>
        </div>

        <!-- body -->
        <div class="lesson-preview-modal__body">
          <h3 class="lesson-preview-modal__title">{{ lesson.title }}</h3>
          <p v-if="lesson.description" class="muted lesson-preview-modal__desc">{{ lesson.description }}</p>

          <!-- lock notice for non-subscribers -->
          <div v-if="!canWatch" class="lesson-preview-modal__notice flex items-start">
            <UiIcon name="lock" :size="18" style="flex-shrink: 0; margin-top: 2px; color: var(--clay-deep)" />
            <p style="font-size: 13.5px; line-height: 1.55; color: var(--ink-soft); margin: 0">
              Видео агуулга зөвхөн бүртгэлтэй гишүүдэд нээгдэнэ. Захиалга авснаар бүх хичээлийг бүрэн үзэх боломжтой.
            </p>
          </div>

          <div class="lesson-preview-modal__actions flex flex-wrap items-center">
            <button v-if="canWatch" type="button" class="btn btn-primary btn-lg" @click="emit('watch'); emit('close')">
              <UiIcon name="play" :size="18" :fill="true" /> Хичээл үзэх
            </button>
            <button v-else type="button" class="btn btn-primary btn-lg" @click="emit('enroll'); emit('close')">
              <UiIcon name="calendar" :size="18" /> Захиалга авч үзэх
            </button>
            <button type="button" class="btn btn-ghost" @click="emit('close')">Хаах</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(11, 24, 30, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fade 0.25s ease both;
}
.lesson-preview-modal {
  position: relative;
  width: 520px;
  max-width: 94vw;
  max-height: min(90vh, 700px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--sh-lg);
  display: flex;
  flex-direction: column;
}
.lesson-preview-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  padding: 8px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 10px;
}
.lesson-preview-modal__hero {
  height: 200px;
  position: relative;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.lesson-preview-modal__grain {
  position: absolute;
  inset: 0;
}
.lesson-preview-modal__chip {
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  border: none;
}
.lesson-preview-modal__badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(11, 24, 30, 0.18);
}
.lesson-preview-modal__badge--play {
  background: transparent;
}
.lesson-preview-modal__badge--play > * {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--clay);
}
.lesson-preview-modal__dur {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(12, 29, 37, 0.75);
  color: #fff;
  border: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.lesson-preview-modal__body {
  padding: 22px 26px 26px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.lesson-preview-modal__title {
  font-size: 22px;
  margin-bottom: 8px;
  padding-right: 36px;
}
.lesson-preview-modal__desc {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 16px;
}
.lesson-preview-modal__notice {
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 18px;
}
.lesson-preview-modal__actions {
  gap: 12px;
  padding-top: 4px;
}
</style>

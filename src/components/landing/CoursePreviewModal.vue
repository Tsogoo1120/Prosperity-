<script setup>
import { computed } from 'vue'
import { coursePrices } from '@/data/union.js'
import { getCourseHours, getCurriculumPreview, getLessonCount } from '@/utils/course-stats.js'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  course: { type: Object, default: null },
})
const emit = defineEmits(['close', 'enroll'])

const lessonCount = computed(() => (props.course ? getLessonCount(props.course) : 0))
const hours = computed(() => (props.course ? getCourseHours(props.course) : 0))
const curriculum = computed(() => (props.course ? getCurriculumPreview(props.course) : []))
const description = computed(
  () => props.course?.description || props.course?.subtitle || '',
)
const priceLabel = computed(() => {
  const id = props.course?.id
  if (!id || coursePrices[id] == null) return null
  return `$${coursePrices[id]}`
})

function goEnroll() {
  if (!props.course) return
  sessionStorage.setItem(
    'union-enroll-intent',
    JSON.stringify({ serviceId: 'subscription', courseId: props.course.id }),
  )
  emit('enroll')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && course" class="modal-scrim" @click="emit('close')">
      <div class="course-preview-modal card pop" @click.stop>
        <button type="button" class="course-preview-modal__close btn btn-quiet" aria-label="Хаах" @click="emit('close')">
          <UiIcon name="x" :size="18" />
        </button>

        <div
          class="course-preview-modal__hero"
          :style="
            course.coverImage
              ? { backgroundImage: `url(${course.coverImage})` }
              : {
                  background: `linear-gradient(150deg, ${course.hue}, color-mix(in srgb, ${course.hue} 55%, #16313f))`,
                }
          "
        >
          <div class="grain course-preview-modal__grain" />
          <span class="chip course-preview-modal__level">{{ course.level }}</span>
          <div v-if="!course.coverImage" class="course-preview-modal__lock-badge" aria-hidden="true">
            <UiIcon name="lock" :size="22" />
          </div>
        </div>

        <div class="course-preview-modal__body">
          <h3 class="course-preview-modal__title">{{ course.title }}</h3>
          <p class="muted course-preview-modal__desc">{{ description }}</p>

          <div class="course-preview-modal__meta flex items-center">
            <span class="flex items-center" style="gap: 6px">
              <UiIcon name="video" :size="14" /> {{ lessonCount }} хичээл
            </span>
            <span class="flex items-center" style="gap: 6px">
              <UiIcon name="clock" :size="14" /> {{ hours }}ц
            </span>
            <span v-if="priceLabel" class="course-preview-modal__price">{{ priceLabel }}</span>
          </div>

          <div class="course-preview-modal__notice flex items-start">
            <UiIcon name="lock" :size="18" style="flex-shrink: 0; margin-top: 2px; color: var(--clay-deep)" />
            <p style="font-size: 13.5px; line-height: 1.55; color: var(--ink-soft); margin: 0">
              Видео агуулга зөвхөн бүртгэлтэй гишүүдэд нээгдэнэ. Доорх жагсаалтаас сэдэв, хугацааг урьдчилан харж болно —
              үзэхийн тулд бүртгүүлж төлбөрөө баталгуулна уу.
            </p>
          </div>

          <div v-if="curriculum.length" class="course-preview-modal__syllabus">
            <div class="kicker cool" style="margin-bottom: 12px">Хичээлийн агуулга</div>
            <ul class="course-preview-modal__lesson-list">
              <li v-for="lesson in curriculum" :key="lesson.id" class="course-preview-modal__lesson">
                <span
                  class="course-preview-modal__lesson-icon"
                  :class="lesson.type === 'reading' ? 'course-preview-modal__lesson-icon--reading' : ''"
                >
                  <UiIcon :name="lesson.type === 'reading' ? 'doc' : 'video'" :size="15" />
                </span>
                <div class="course-preview-modal__lesson-text">
                  <span class="course-preview-modal__lesson-module">{{ lesson.moduleTitle }}</span>
                  <span class="course-preview-modal__lesson-title">{{ lesson.title }}</span>
                </div>
                <span class="muted" style="font-size: 12px; flex-shrink: 0">{{ lesson.dur }}</span>
                <UiIcon name="lock" :size="14" style="color: var(--faint); flex-shrink: 0" />
              </li>
            </ul>
          </div>

          <div class="course-preview-modal__actions flex flex-wrap items-center">
            <button type="button" class="btn btn-primary btn-lg" @click="goEnroll">
              <UiIcon name="calendar" :size="18" /> Бүртгүүлж үзэх
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
.course-preview-modal {
  position: relative;
  width: 560px;
  max-width: 94vw;
  max-height: min(90vh, 820px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--sh-lg);
  display: flex;
  flex-direction: column;
}
.course-preview-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  padding: 8px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 10px;
}
.course-preview-modal__hero {
  height: 180px;
  position: relative;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.course-preview-modal__grain {
  position: absolute;
  inset: 0;
}
.course-preview-modal__level {
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  border: none;
}
.course-preview-modal__lock-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(11, 24, 30, 0.15);
}
.course-preview-modal__body {
  padding: 22px 26px 26px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.course-preview-modal__title {
  font-size: 22px;
  margin-bottom: 8px;
  padding-right: 36px;
}
.course-preview-modal__desc {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 14px;
}
.course-preview-modal__meta {
  gap: 16px;
  font-size: 13px;
  color: var(--faint);
  margin-bottom: 16px;
}
.course-preview-modal__price {
  margin-left: auto;
  font-weight: 700;
  color: var(--ink);
}
.course-preview-modal__notice {
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 18px;
}
.course-preview-modal__syllabus {
  margin-bottom: 22px;
}
.course-preview-modal__lesson-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.course-preview-modal__lesson {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 13.5px;
}
.course-preview-modal__lesson-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-tint);
  color: var(--primary);
}
.course-preview-modal__lesson-icon--reading {
  background: var(--sage-tint);
  color: var(--sage-deep);
}
.course-preview-modal__lesson-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.course-preview-modal__lesson-module {
  font-size: 11px;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.course-preview-modal__lesson-title {
  font-weight: 500;
  line-height: 1.35;
}
.course-preview-modal__actions {
  gap: 12px;
  padding-top: 4px;
}
</style>

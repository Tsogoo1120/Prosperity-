<script setup>
import { ref } from 'vue'
import { courses } from '@/data/union.js'
import { getCourseHours, getLessonCount } from '@/utils/course-stats.js'
import UiIcon from '@/components/common/UiIcon.vue'
import CoursePreviewModal from './CoursePreviewModal.vue'

const emit = defineEmits(['nav'])

const previewOpen = ref(false)
const selectedCourse = ref(null)

function openPreview(course) {
  selectedCourse.value = course
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
}

function onEnrollFromPreview() {
  emit('nav', 'enroll')
}
</script>

<template>
  <section class="mx-auto max-w-wrap" style="padding: 72px 16px">
    <div class="section-head">
      <div>
        <h2 style="font-size: clamp(28px, 5vw, 38px)">Одоогоор орсон байгаа хичээлүүд</h2>
      </div>
      <button class="btn btn-ghost" @click="emit('nav', 'student')">
        Бүгдийг нь үзэх <UiIcon name="arrowRight" :size="17" />
      </button>
    </div>
    <div class="grid-cols-4">
      <div
        v-for="(c, i) in courses"
        :key="c.id"
        class="card pop course-card"
        :style="{ animationDelay: i * 0.06 + 's', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer' }"
        role="button"
        tabindex="0"
        @click="openPreview(c)"
        @keydown.enter.prevent="openPreview(c)"
        @keydown.space.prevent="openPreview(c)"
      >
        <div
          class="course-card__media"
          :style="
            c.coverImage
              ? { backgroundImage: `url(${c.coverImage})` }
              : {
                  background: `linear-gradient(150deg, ${c.hue}, color-mix(in srgb, ${c.hue} 55%, #16313f))`,
                }
          "
        >
          <div class="grain" style="position: absolute; inset: 0" />
          <span
            class="chip"
            style="position: absolute; top: 12px; left: 12px; background: rgba(255, 255, 255, 0.92); color: var(--ink); border: none"
            >{{ c.level }}</span
          >
        </div>
        <div style="padding: 18px">
          <h3 style="font-size: 18px; margin-bottom: 7px">{{ c.title }}</h3>
          <p class="muted" style="font-size: 13.5px; line-height: 1.5; min-height: 40px">{{ c.subtitle }}</p>
          <div class="flex items-center" style="gap: 14px; margin-top: 12px; font-size: 12.5px; color: var(--faint)">
            <span class="flex items-center" style="gap: 6px"
              ><UiIcon name="video" :size="14" /> {{ getLessonCount(c) }} хичээл</span
            >
            <span class="flex items-center" style="gap: 6px"
              ><UiIcon name="clock" :size="14" /> {{ getCourseHours(c) }}ц</span
            >
          </div>
        </div>
      </div>
    </div>

    <CoursePreviewModal
      :open="previewOpen"
      :course="selectedCourse"
      @close="closePreview"
      @enroll="onEnrollFromPreview"
    />
  </section>
</template>

<style scoped>
.course-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.course-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sh-md);
}
.course-card__media {
  height: 132px;
  position: relative;
  background-size: cover;
  background-position: center;
}
</style>

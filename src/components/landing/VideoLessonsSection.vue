<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { getThumbnailUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'
import VideoLessonPreviewModal from './VideoLessonPreviewModal.vue'

const emit = defineEmits(['nav'])

const { session, profile } = useAuth()

const lessons = ref([])
const loading = ref(true)
const previewOpen = ref(false)
const selectedLesson = ref(null)
const selectedHue = ref('var(--primary)')

const HUES = ['var(--primary)', 'var(--sage-deep)', 'var(--clay)', 'var(--gold)']
function lessonHue(i) { return HUES[i % HUES.length] }

function openPreview(lesson, hue) {
  selectedLesson.value = lesson
  selectedHue.value = hue
  previewOpen.value = true
}

onMounted(async () => {
  const { data } = await supabase
    .from('video_lessons')
    .select('id, slug, title, description, category, thumbnail_path, duration_seconds, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
  lessons.value = data ?? []
  loading.value = false
})

const canWatch = computed(() => {
  const p = profile.value
  if (!p) return false
  if (p.role === 'admin') return true
  if (p.subscription_status === 'active') {
    if (!p.subscription_expires_at) return true
    return new Date(p.subscription_expires_at) > new Date()
  }
  return false
})

function fmtDur(s) {
  if (!s) return null
  const m = Math.floor(s / 60)
  const sec = String(s % 60).padStart(2, '0')
  return `${m}:${sec}`
}

function handleWatch() {
  if (canWatch.value) {
    emit('nav', 'student')
  } else {
    emit('nav', 'enroll')
  }
}
</script>

<template>
  <section v-if="!loading && lessons.length" class="mx-auto max-w-wrap" style="padding: 72px 16px">
    <div class="section-head">
      <div>
        <h2 style="font-size: clamp(28px, 5vw, 38px)">Видео хичээлүүд</h2>
        <p class="muted" style="font-size: 16px; margin-top: 8px; max-width: 540px">
          Захиалга авсан гишүүд бүх хичээлийг бүрэн үзэх боломжтой.
        </p>
      </div>
      <button class="btn btn-ghost" @click="handleWatch">
        {{ canWatch ? 'Хичээл үзэх' : 'Захиалга авах' }}
        <UiIcon name="arrowRight" :size="17" />
      </button>
    </div>

    <div class="grid-cols-4">
      <div
        v-for="(lesson, i) in lessons"
        :key="lesson.id"
        class="card pop course-card"
        :style="{ animationDelay: i * 0.06 + 's', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer' }"
        role="button"
        tabindex="0"
        @click="openPreview(lesson, lessonHue(i))"
        @keydown.enter.prevent="openPreview(lesson, lessonHue(i))"
        @keydown.space.prevent="openPreview(lesson, lessonHue(i))"
      >
        <!-- thumbnail / cover -->
        <div
          class="course-card__media"
          :style="getThumbnailUrl(lesson.thumbnail_path)
            ? { backgroundImage: `url(${getThumbnailUrl(lesson.thumbnail_path)})` }
            : { background: `linear-gradient(150deg, ${lessonHue(i)}, color-mix(in srgb, ${lessonHue(i)} 55%, #16313f))` }"
        >
          <div class="grain" style="position: absolute; inset: 0" />

          <!-- lock overlay for non-subscribers -->
          <div
            v-if="!canWatch"
            style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(12,29,37,0.5)"
          >
            <div
              style="width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.15); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center"
            >
              <UiIcon name="lock" :size="18" style="color: #fff" />
            </div>
          </div>

          <!-- play icon for subscribers -->
          <div
            v-else
            style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s"
            class="video-lesson-card__play"
          >
            <div
              style="width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center"
            >
              <UiIcon name="play" :size="18" style="color: var(--clay)" :fill="true" />
            </div>
          </div>

          <!-- badges -->
          <div style="position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; flex-wrap: wrap">
            <span
              v-if="lesson.category"
              class="chip"
              style="background: rgba(255,255,255,0.92); color: var(--ink); border: none; font-size: 11px"
            >{{ lesson.category }}</span>
          </div>

          <div v-if="fmtDur(lesson.duration_seconds)" style="position: absolute; bottom: 8px; right: 8px">
            <span
              class="chip"
              style="background: rgba(12,29,37,0.75); color: #fff; border: none; font-size: 11px; font-variant-numeric: tabular-nums"
            >
              <UiIcon name="clock" :size="11" /> {{ fmtDur(lesson.duration_seconds) }}
            </span>
          </div>
        </div>

        <!-- info -->
        <div style="padding: 18px">
          <h3 style="font-size: 18px; margin-bottom: 7px; line-height: 1.35">{{ lesson.title }}</h3>
          <p
            v-if="lesson.description"
            class="muted"
            style="font-size: 13.5px; line-height: 1.5; min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden"
          >{{ lesson.description }}</p>
          <p
            v-if="!canWatch"
            style="font-size: 12px; color: var(--muted); margin-top: 10px; display: flex; align-items: center; gap: 5px"
          >
            <UiIcon name="lock" :size="12" /> Захиалга шаардлагатай
          </p>
        </div>
      </div>
    </div>

    <!-- bottom CTA for non-subscribers -->
    <div v-if="!canWatch" style="margin-top: 32px; text-align: center">
      <button class="btn btn-primary" @click="emit('nav', 'enroll')">
        Захиалга авч бүх хичээлийг үзэх
        <UiIcon name="arrowRight" :size="17" />
      </button>
    </div>

    <VideoLessonPreviewModal
      :open="previewOpen"
      :lesson="selectedLesson"
      :can-watch="canWatch"
      :hue="selectedHue"
      @close="previewOpen = false"
      @watch="emit('nav', 'student')"
      @enroll="emit('nav', 'enroll')"
    />
  </section>
</template>

<style scoped>
.course-card__media {
  height: 132px;
  position: relative;
  background-size: cover;
  background-position: center;
}
.course-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.course-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sh-md);
}
.course-card:hover .video-lesson-card__play {
  opacity: 1 !important;
}
</style>

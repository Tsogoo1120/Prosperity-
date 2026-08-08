<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { getThumbnailUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'
import ContentLibraryModal from './ContentLibraryModal.vue'
import VideoLessonPreviewModal from './VideoLessonPreviewModal.vue'

const emit = defineEmits(['nav'])

const { session, profile } = useAuth()

const lessons = ref([])
const loading = ref(true)
const previewOpen = ref(false)
const libraryOpen = ref(false)
const selectedLesson = ref(null)
const selectedHue = ref('var(--primary)')
const displayedLessons = computed(() => lessons.value.slice(0, 4))

const HUES = ['var(--primary)', 'var(--sage-deep)', 'var(--clay)', 'var(--gold)']
function lessonHue(i) { return HUES[i % HUES.length] }

function openPreview(lesson, hue) {
  selectedLesson.value = lesson
  selectedHue.value = hue
  previewOpen.value = true
}

function openFromLibrary(lesson, i) {
  libraryOpen.value = false
  openPreview(lesson, lessonHue(i))
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

function goEnrollSubscription() {
  sessionStorage.setItem(
    'union-enroll-intent',
    JSON.stringify({ serviceId: 'subscription' }),
  )
  emit('nav', 'enroll')
}

function handleWatch(lessonId = selectedLesson.value?.id) {
  if (canWatch.value) {
    const intent = lessonId ? { view: 'learn', lessonId } : { view: 'learn' }
    sessionStorage.setItem('union-student-intent', JSON.stringify(intent))
    emit('nav', 'student')
  } else {
    goEnrollSubscription()
  }
}
</script>

<template>
  <section id="courses" v-if="!loading && lessons.length" class="mx-auto max-w-wrap" style="padding: 72px 16px; scroll-margin-top: 72px">
    <div class="section-head">
      <div>
        <h2 style="font-size: clamp(28px, 5vw, 38px)">Видео хичээлүүд</h2>
      </div>
      <span class="chip blue">Нийт {{ lessons.length }} хичээл</span>
    </div>

    <div class="video-lesson-list">
      <div
        v-for="(lesson, i) in displayedLessons"
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
        <div class="course-card__body">
          <h3 style="font-size: 18px; margin-bottom: 7px; line-height: 1.35">{{ lesson.title }}</h3>
          <p
            v-if="lesson.description"
            class="muted"
            style="font-size: 13.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden"
          >{{ lesson.description }}</p>
          <p
            v-if="!canWatch"
            style="font-size: 12px; color: var(--muted); margin-top: 10px; display: flex; align-items: center; gap: 5px"
          >
            <UiIcon name="lock" :size="12" /> Subscription шаардлагатай
          </p>
        </div>
      </div>
    </div>

    <!-- full library CTA -->
    <div style="margin-top: 32px; text-align: center">
      <button class="btn btn-primary" @click="libraryOpen = true">
        Дэлгэрэнгүй үзэх
        <UiIcon name="arrowRight" :size="17" />
      </button>
    </div>

    <ContentLibraryModal
      :open="libraryOpen"
      title="Бүх видео хичээл"
      :count-label="`Нийт ${lessons.length} хичээл`"
      @close="libraryOpen = false"
    >
      <div class="video-library-grid">
        <button
          v-for="(lesson, i) in lessons"
          :key="lesson.id"
          type="button"
          class="video-library-card"
          @click="openFromLibrary(lesson, i)"
        >
          <span
            class="video-library-card__media"
            :style="getThumbnailUrl(lesson.thumbnail_path)
              ? { backgroundImage: `url(${getThumbnailUrl(lesson.thumbnail_path)})` }
              : { background: `linear-gradient(150deg, ${lessonHue(i)}, color-mix(in srgb, ${lessonHue(i)} 55%, #16313f))` }"
          >
            <span class="grain video-library-card__grain" />
            <span class="video-library-card__icon">
              <UiIcon :name="canWatch ? 'play' : 'lock'" :size="19" :fill="canWatch" />
            </span>
            <span v-if="fmtDur(lesson.duration_seconds)" class="video-library-card__duration">
              {{ fmtDur(lesson.duration_seconds) }}
            </span>
          </span>
          <span class="video-library-card__body">
            <strong>{{ lesson.title }}</strong>
            <small>{{ lesson.category || (canWatch ? 'Видео хичээл' : 'Subscription шаардлагатай') }}</small>
          </span>
        </button>
      </div>
    </ContentLibraryModal>

    <VideoLessonPreviewModal
      :open="previewOpen"
      :lesson="selectedLesson"
      :can-watch="canWatch"
      :hue="selectedHue"
      @close="previewOpen = false"
      @watch="handleWatch"
      @enroll="goEnrollSubscription"
    />
  </section>
</template>

<style scoped>
.course-card__media {
  height: 148px;
  position: relative;
  background-size: cover;
  background-position: center;
}
.course-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}
.video-lesson-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.course-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 18px;
}
.course-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sh-md);
}
.course-card:focus-visible {
  outline: 2px solid var(--clay);
  outline-offset: 3px;
}
.course-card:hover .video-lesson-card__play {
  opacity: 1 !important;
}
.video-library-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.video-library-card {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--sh-sm);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.video-library-card:hover {
  transform: translateY(-3px);
  border-color: var(--clay);
  box-shadow: var(--sh);
}
.video-library-card__media {
  position: relative;
  display: block;
  height: 122px;
  background-position: center;
  background-size: cover;
}
.video-library-card__grain {
  position: absolute;
  inset: 0;
}
.video-library-card__icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgba(11, 24, 30, 0.18);
}
.video-library-card__icon :deep(svg) {
  box-sizing: content-box;
  padding: 10px;
  border-radius: 50%;
  background: rgba(11, 24, 30, 0.46);
}
.video-library-card__duration {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(11, 24, 30, 0.76);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
}
.video-library-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 14px 15px;
}
.video-library-card__body strong,
.video-library-card__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.video-library-card__body strong {
  font-size: 14px;
  line-height: 1.35;
}
.video-library-card__body small {
  color: var(--muted);
  font-size: 11.5px;
}
@media (max-width: 960px) {
  .video-lesson-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .video-library-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .video-lesson-list {
    grid-template-columns: 1fr;
  }
  .course-card__media {
    height: 164px;
  }
  .video-library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .video-library-card__media {
    height: 104px;
  }
}
</style>

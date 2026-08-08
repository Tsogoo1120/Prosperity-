<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { getThumbnailUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'
import ContentLibraryModal from './ContentLibraryModal.vue'

const emit = defineEmits(['nav'])
const { profile } = useAuth()

const tests = ref([])
const loading = ref(true)
const previewOpen = ref(false)
const libraryOpen = ref(false)
const selectedTest = ref(null)

onMounted(async () => {
  const { data } = await supabase
    .from('psychology_tests')
    .select('id, slug, title, description, cover_image_path, questions, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  tests.value = data ?? []
  loading.value = false
})

const canTakeTest = computed(() => {
  const p = profile.value
  if (!p) return false
  if (p.role === 'admin') return true
  if (p.subscription_status !== 'active') return false
  return !p.subscription_expires_at || new Date(p.subscription_expires_at) > new Date()
})
const displayedTests = computed(() => tests.value.slice(0, 4))

function questionCount(test) {
  return Array.isArray(test?.questions) ? test.questions.length : 0
}

function minuteEstimate(test) {
  return Math.max(1, Math.ceil(questionCount(test) * 0.75))
}

function openPreview(test) {
  selectedTest.value = test
  previewOpen.value = true
}

function openFromLibrary(test) {
  libraryOpen.value = false
  openPreview(test)
}

function goEnrollSubscription() {
  sessionStorage.setItem(
    'union-enroll-intent',
    JSON.stringify({ serviceId: 'subscription' }),
  )
  emit('nav', 'enroll')
}

function openTest(testId = selectedTest.value?.id) {
  if (!canTakeTest.value) {
    goEnrollSubscription()
    return
  }

  const intent = testId ? { view: 'assess', testId } : { view: 'assess' }
  sessionStorage.setItem('union-student-intent', JSON.stringify(intent))
  emit('nav', 'student')
}
</script>

<template>
  <section
    v-if="!loading && tests.length"
    id="psychology-tests"
    class="psychology-tests mx-auto max-w-wrap"
  >
    <div class="section-head">
      <div>
        <div class="kicker cool" style="margin-bottom: 10px">Өөрийгөө танин мэдэх</div>
        <h2 style="font-size: clamp(28px, 5vw, 38px)">Psychology тестүүд</h2>
      </div>
      <span class="chip blue">Нийт {{ tests.length }} тест</span>
    </div>

    <div class="psychology-test-list">
      <article
        v-for="(test, i) in displayedTests"
        :key="test.id"
        class="card pop psychology-test-card"
        :style="{ animationDelay: i * 0.06 + 's' }"
        role="button"
        tabindex="0"
        @click="openPreview(test)"
        @keydown.enter.prevent="openPreview(test)"
        @keydown.space.prevent="openPreview(test)"
      >
        <div
          class="psychology-test-card__media"
          :style="getThumbnailUrl(test.cover_image_path)
            ? { backgroundImage: `url(${getThumbnailUrl(test.cover_image_path)})` }
            : { background: 'linear-gradient(145deg, var(--primary-deep), var(--clay))' }"
        >
          <div class="grain psychology-test-card__grain" />
          <div class="psychology-test-card__symbol">
            <UiIcon :name="canTakeTest ? 'compass' : 'lock'" :size="25" />
          </div>
          <span class="chip psychology-test-card__badge">
            {{ questionCount(test) }} асуулт · {{ minuteEstimate(test) }} мин
          </span>
        </div>

        <div class="psychology-test-card__body">
          <span class="chip blue psychology-test-card__type">Psychology test</span>
          <h3>{{ test.title }}</h3>
          <p v-if="test.description" class="muted">{{ test.description }}</p>
          <span class="psychology-test-card__action">
            {{ canTakeTest ? 'Тест эхлүүлэх' : 'Subscription шаардлагатай' }}
            <UiIcon :name="canTakeTest ? 'arrowRight' : 'lock'" :size="15" />
          </span>
        </div>
      </article>
    </div>

    <div class="psychology-tests__cta">
      <button class="btn btn-primary" @click="libraryOpen = true">
        Дэлгэрэнгүй үзэх
        <UiIcon name="arrowRight" :size="17" />
      </button>
    </div>

    <ContentLibraryModal
      :open="libraryOpen"
      title="Бүх psychology тест"
      :count-label="`Нийт ${tests.length} тест`"
      @close="libraryOpen = false"
    >
      <div class="test-library-grid">
        <button
          v-for="test in tests"
          :key="test.id"
          type="button"
          class="test-library-card"
          @click="openFromLibrary(test)"
        >
          <span
            class="test-library-card__media"
            :style="getThumbnailUrl(test.cover_image_path)
              ? { backgroundImage: `url(${getThumbnailUrl(test.cover_image_path)})` }
              : { background: 'linear-gradient(145deg, var(--primary-deep), var(--clay))' }"
          >
            <span class="grain test-library-card__grain" />
            <span class="test-library-card__icon">
              <UiIcon :name="canTakeTest ? 'compass' : 'lock'" :size="20" />
            </span>
            <span class="test-library-card__meta">
              {{ questionCount(test) }} асуулт · {{ minuteEstimate(test) }} мин
            </span>
          </span>
          <span class="test-library-card__body">
            <strong>{{ test.title }}</strong>
            <small>{{ canTakeTest ? 'Psychology test' : 'Subscription шаардлагатай' }}</small>
          </span>
        </button>
      </div>
    </ContentLibraryModal>

    <Teleport to="body">
      <div v-if="previewOpen && selectedTest" class="test-preview-scrim" @click="previewOpen = false">
        <div class="card pop test-preview" role="dialog" aria-modal="true" @click.stop>
          <button
            type="button"
            class="btn btn-quiet test-preview__close"
            aria-label="Хаах"
            @click="previewOpen = false"
          >
            <UiIcon name="x" :size="18" />
          </button>

          <div
            class="test-preview__hero"
            :style="getThumbnailUrl(selectedTest.cover_image_path)
              ? { backgroundImage: `url(${getThumbnailUrl(selectedTest.cover_image_path)})` }
              : { background: 'linear-gradient(145deg, var(--primary-deep), var(--clay))' }"
          >
            <div class="grain psychology-test-card__grain" />
            <div class="test-preview__symbol">
              <UiIcon :name="canTakeTest ? 'compass' : 'lock'" :size="30" />
            </div>
            <span class="chip test-preview__meta">
              {{ questionCount(selectedTest) }} асуулт · {{ minuteEstimate(selectedTest) }} мин
            </span>
          </div>

          <div class="test-preview__body">
            <div class="kicker cool" style="margin-bottom: 9px">Psychology test</div>
            <h3>{{ selectedTest.title }}</h3>
            <p v-if="selectedTest.description" class="muted">{{ selectedTest.description }}</p>

            <div v-if="!canTakeTest" class="test-preview__notice">
              <UiIcon name="lock" :size="18" />
              <span>Энэ тест Subscription гишүүдэд нээлттэй.</span>
            </div>

            <div class="test-preview__actions">
              <button class="btn btn-primary btn-lg" @click="openTest(); previewOpen = false">
                <UiIcon :name="canTakeTest ? 'compass' : 'book'" :size="18" />
                {{ canTakeTest ? 'Тест эхлүүлэх' : 'Subscription авах' }}
              </button>
              <button class="btn btn-ghost" @click="previewOpen = false">Хаах</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.psychology-tests {
  padding: 72px 16px;
  scroll-margin-top: 72px;
}
.psychology-test-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.psychology-test-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.psychology-test-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sh-md);
}
.psychology-test-card:focus-visible {
  outline: 2px solid var(--clay);
  outline-offset: 3px;
}
.psychology-test-card__media {
  position: relative;
  height: 148px;
  background-size: cover;
  background-position: center;
}
.psychology-test-card__grain {
  position: absolute;
  inset: 0;
}
.psychology-test-card__symbol,
.test-preview__symbol {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
}
.psychology-test-card__symbol > :deep(svg),
.test-preview__symbol > :deep(svg) {
  box-sizing: content-box;
  padding: 13px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(7px);
}
.psychology-test-card__badge,
.test-preview__meta {
  position: absolute;
  right: 10px;
  bottom: 10px;
  border: 0;
  background: rgba(12, 29, 37, 0.75);
  color: #fff;
  font-size: 11px;
}
.psychology-test-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 18px;
}
.psychology-test-card__type {
  margin-bottom: 10px;
  font-size: 11px;
}
.psychology-test-card h3 {
  margin-bottom: 7px;
  font-size: 19px;
  line-height: 1.35;
}
.psychology-test-card p {
  display: -webkit-box;
  overflow: hidden;
  font-size: 13.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
.psychology-test-card__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: var(--clay-deep);
  font-size: 12.5px;
  font-weight: 700;
}
.psychology-tests__cta {
  margin-top: 32px;
  text-align: center;
}
.test-preview-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(11, 24, 30, 0.5);
  backdrop-filter: blur(4px);
}
.test-preview {
  position: relative;
  width: 520px;
  max-width: 94vw;
  max-height: min(90vh, 700px);
  overflow: hidden;
  border-radius: 20px;
  box-shadow: var(--sh-lg);
}
.test-preview__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
}
.test-preview__hero {
  position: relative;
  height: 200px;
  background-position: center;
  background-size: cover;
}
.test-preview__body {
  padding: 24px 26px 26px;
}
.test-preview__body h3 {
  padding-right: 34px;
  margin-bottom: 9px;
  font-size: 22px;
}
.test-preview__body > p {
  font-size: 14.5px;
  line-height: 1.6;
}
.test-preview__notice {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: 13.5px;
}
.test-preview__notice :deep(svg) {
  flex: none;
  color: var(--clay-deep);
}
.test-preview__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.test-library-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.test-library-card {
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
.test-library-card:hover {
  transform: translateY(-3px);
  border-color: var(--clay);
  box-shadow: var(--sh);
}
.test-library-card__media {
  position: relative;
  display: block;
  height: 122px;
  background-position: center;
  background-size: cover;
}
.test-library-card__grain {
  position: absolute;
  inset: 0;
}
.test-library-card__icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
}
.test-library-card__icon :deep(svg) {
  box-sizing: content-box;
  padding: 10px;
  border-radius: 50%;
  background: rgba(11, 24, 30, 0.35);
}
.test-library-card__meta {
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
.test-library-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 14px 15px;
}
.test-library-card__body strong,
.test-library-card__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.test-library-card__body strong {
  font-size: 14px;
  line-height: 1.35;
}
.test-library-card__body small {
  color: var(--muted);
  font-size: 11.5px;
}
@media (max-width: 960px) {
  .psychology-test-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .test-library-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .psychology-test-list {
    grid-template-columns: 1fr;
  }
  .psychology-test-card__media {
    height: 164px;
  }
  .test-library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .test-library-card__media {
    height: 104px;
  }
}
</style>

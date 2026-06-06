<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import CalmField from '@/components/common/CalmField.vue'
import { useAuth } from '@/composables/useAuth.js'
import { getPresignDownloadUrl, getThumbnailUrl } from '@/lib/videoUpload.js'

const props = defineProps({
  lesson: { type: Object, required: true },
  playing: { type: Boolean, default: false },
})
const emit = defineEmits(['update:playing'])

const { session } = useAuth()

// ── presigned URL resolution ───────────────────────────────────────
const resolvedUrl = ref(null)
const urlLoading = ref(false)
const urlError = ref(null)

const screenWidth = ref(window.innerWidth)
function updateScreenWidth() {
  screenWidth.value = window.innerWidth
}

const useVertical = computed(() => {
  return screenWidth.value <= 768 && !!props.lesson?.video_r2_key_vertical
})

const rawKey = computed(() => {
  if (useVertical.value) {
    return props.lesson?.video_r2_key_vertical ?? props.lesson?.video_r2_key ?? ''
  }
  return props.lesson?.video_r2_key ?? props.lesson?.video_r2_key_vertical ?? ''
})

function isR2Key(k) {
  return !!k && !k.startsWith('http://') && !k.startsWith('https://')
}

async function fetchPresignedUrl() {
  const key = rawKey.value
  resolvedUrl.value = null
  urlError.value = null
  if (!key) return

  if (!isR2Key(key)) {
    resolvedUrl.value = key
    return
  }

  const token = session.value?.access_token
  if (!token) { urlError.value = 'not_authenticated'; return }

  urlLoading.value = true
  const result = await getPresignDownloadUrl(props.lesson.id, token, useVertical.value ? 'vertical' : 'desktop')
  urlLoading.value = false

  if (result.error) {
    urlError.value = result.error
  } else {
    resolvedUrl.value = result.url
  }
}

watch([() => props.lesson?.id, useVertical], fetchPresignedUrl, { immediate: true })

// ── YouTube helpers ────────────────────────────────────────────────
function youtubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const ytId = computed(() => youtubeId(resolvedUrl.value))
const isYoutube = computed(() => !!ytId.value)
const embedUrl = computed(() =>
  ytId.value
    ? `https://www.youtube.com/embed/${ytId.value}?autoplay=0&rel=0&modestbranding=1`
    : '',
)

const posterUrl = computed(() => getThumbnailUrl(props.lesson?.thumbnail_path))

// ── mock player (no video assigned) ───────────────────────────────
const total = 408
const t = ref(124)
let iv = null

function tick() {
  clearInterval(iv)
  if (props.playing) {
    iv = setInterval(() => { t.value = Math.min(t.value + 1, total) }, 1000)
  }
}
watch(() => props.playing, tick, { immediate: true })
onMounted(() => {
  window.addEventListener('resize', updateScreenWidth)
})
onBeforeUnmount(() => {
  clearInterval(iv)
  window.removeEventListener('resize', updateScreenWidth)
})

const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')

function seek(e) {
  const r = e.currentTarget.getBoundingClientRect()
  t.value = Math.round(((e.clientX - r.left) / r.width) * total)
}
function toggle() { emit('update:playing', !props.playing) }
</script>

<template>
  <!-- ── Loading ── -->
  <div
    v-if="urlLoading"
    style="border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9; background: var(--surface-2); display: flex; align-items: center; justify-content: center"
  >
    <UiIcon name="clock" :size="28" style="opacity: 0.35" />
  </div>

  <!-- ── Subscription required ── -->
  <div
    v-else-if="urlError === 'subscription_required'"
    style="border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9; background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px"
  >
    <UiIcon name="lock" :size="32" style="opacity: 0.4" />
    <p style="font-size: 14px; color: var(--muted); text-align: center">Энэ хичээлийг үзэхэд идэвхтэй захиалга шаардлагатай.</p>
  </div>

  <!-- ── Error ── -->
  <div
    v-else-if="urlError"
    style="border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9; background: var(--surface-2); display: flex; align-items: center; justify-content: center"
  >
    <p style="font-size: 14px; color: var(--bad); text-align: center; padding: 20px">Видео ачааллахад алдаа гарлаа.</p>
  </div>

  <!-- ── YouTube embed ── -->
  <div v-else-if="isYoutube" style="border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9; background: #000">
    <iframe
      :src="embedUrl"
      style="width: 100%; height: 100%; border: none; display: block"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    />
  </div>

  <!-- ── Native video (R2 presigned or direct MP4) ── -->
  <div v-else-if="resolvedUrl" style="border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9; background: #000">
    <video
      :src="resolvedUrl"
      :poster="posterUrl ?? undefined"
      controls
      style="width: 100%; height: 100%; display: block; object-fit: contain"
    />
  </div>

  <!-- ── Mock player (no video key set) ── -->
  <div
    v-else
    class="grain"
    style="background: #0c1d25; border-radius: 16px; overflow: hidden; position: relative; aspect-ratio: 16/9"
    :style="posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
  >
    <div v-if="!posterUrl">
      <CalmField :style-override="{ opacity: 0.5 }" />
    </div>
    <div
      style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: rgba(12,29,37,0.6)"
    >
      <div
        style="color: rgba(255,255,255,0.75); font-family: var(--serif); font-style: italic; font-size: 20px; text-align: center; max-width: 420px; padding: 0 20px"
      >
        "{{ lesson.title }}"
      </div>
      <button
        style="width: 78px; height: 78px; border-radius: 50%; border: none; cursor: pointer; background: rgba(255,255,255,0.95); color: var(--clay); display: flex; align-items: center; justify-content: center; box-shadow: var(--sh-lg)"
        @click="toggle"
      >
        <UiIcon :name="playing ? 'pause' : 'play'" :size="32" :fill="!playing" />
      </button>
    </div>
    <div
      style="position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 20px 16px; background: linear-gradient(transparent, rgba(8,18,23,0.85))"
    >
      <div
        style="height: 5px; background: rgba(255,255,255,0.22); border-radius: 999px; margin-bottom: 12px; cursor: pointer"
        @click="seek"
      >
        <div :style="{ width: (t / total) * 100 + '%', height: '100%', background: 'var(--clay)', borderRadius: '999px', position: 'relative' }">
          <div style="position: absolute; right: -6px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%; background: #fff" />
        </div>
      </div>
      <div class="flex items-center justify-between" style="color: #fff">
        <div class="flex items-center" style="gap: 16px">
          <button style="background: none; border: none; color: #fff; cursor: pointer" @click="toggle">
            <UiIcon :name="playing ? 'pause' : 'play'" :size="20" :fill="!playing" />
          </button>
          <UiIcon name="volume" :size="19" />
          <span style="font-size: 13px; font-variant-numeric: tabular-nums; opacity: 0.85">{{ fmt(t) }} / {{ fmt(total) }}</span>
        </div>
        <div class="flex items-center" style="gap: 16px; opacity: 0.85">
          <span style="font-size: 12.5px; font-weight: 600; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; padding: 2px 7px">1.0×</span>
          <UiIcon name="settings" :size="19" /><UiIcon name="full" :size="19" />
        </div>
      </div>
    </div>
  </div>
</template>

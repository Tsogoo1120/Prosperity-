<script setup>
import { ref, onMounted } from 'vue'
import { introVideo } from '@/data/union.js'
import UiIcon from '@/components/common/UiIcon.vue'
import { supabase } from '@/lib/supabase.js'
import { getIntroVideoPublicUrl } from '@/lib/videoUpload.js'

const emit = defineEmits(['nav'])

const commercialVideo = ref(null)

onMounted(async () => {
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'intro_video_path')
    .maybeSingle()
  if (data?.value) commercialVideo.value = getIntroVideoPublicUrl(data.value)
})

function goEnrollSubscription() {
  sessionStorage.setItem(
    'union-enroll-intent',
    JSON.stringify({ serviceId: 'subscription' }),
  )
  emit('nav', 'enroll')
}
</script>

<template>
  <section
    id="intro"
    class="landing-section landing-section--band"
    style="background: var(--surface-2); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line)"
  >
    <div class="mx-auto max-w-wrap grid-video-intro">
      <div class="landing-reveal">
        <h2 style="font-size: clamp(28px, 5vw, 38px); line-height: 1.12; margin-bottom: 14px">
          {{ introVideo.headline }}
        </h2>
        <p style="font-size: 17px; color: var(--ink-soft); line-height: 1.65; max-width: 480px">
          {{ introVideo.description }}
        </p>
        <ul class="flex flex-col" style="gap: 12px; margin: 28px 0 32px; padding: 0; list-style: none">
          <li
            v-for="point in introVideo.highlights"
            :key="point"
            class="flex items-start"
            style="gap: 12px; font-size: 15px; line-height: 1.5"
          >
            <span style="color: var(--primary); flex-shrink: 0; margin-top: 2px">
              <UiIcon name="checkCircle" :size="19" />
            </span>
            {{ point }}
          </li>
        </ul>
        <div class="flex flex-wrap items-center btn-row--stack-mobile" style="gap: 16px">
          <button class="btn btn-primary btn-lg" @click="goEnrollSubscription">
            <UiIcon name="calendar" :size="18" /> subscription авах
          </button>
          <span class="muted flex items-center" style="gap: 8px; font-size: 14px">
            <UiIcon name="clock" :size="16" />
            {{ introVideo.duration }} watch
          </span>
        </div>
      </div>

      <div class="landing-reveal landing-reveal--scale intro-video-wrap" style="min-width: 0; transition-delay: 0.08s">
        <video
          class="intro-video"
          :src="commercialVideo"
          :title="introVideo.title"
          controls
          playsinline
          preload="metadata"
        />
        <p class="muted" style="font-size: 13px; margin-top: 12px; text-align: center">
          {{ introVideo.caption }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  background: #0c1d25;
  box-shadow: var(--sh-lg);
  object-fit: cover;
}
</style>

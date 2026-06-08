<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useLandingMotion } from '@/composables/useLandingMotion.js'
import TopNav from '@/components/landing/TopNav.vue'
import HeroSection from '@/components/landing/HeroSection.vue'
import VideoIntroSection from '@/components/landing/VideoIntroSection.vue'
import VideoLessonsSection from '@/components/landing/VideoLessonsSection.vue'
import MentorSection from '@/components/landing/MentorSection.vue'
import ClosingCta from '@/components/landing/ClosingCta.vue'
import SiteFooter from '@/components/landing/SiteFooter.vue'
import BookingModal from '@/components/landing/BookingModal.vue'

defineProps({
  theme: { type: String, default: 'light' },
})
const emit = defineEmits(['nav', 'toggle-theme'])

const booking = ref(false)
const mobileBarHidden = ref(false)

/** Hide fixed bar before CTA/footer; hysteresis stops edge flicker on mobile scroll. */
const MOBILE_BAR_HIDE_PX = 200
const MOBILE_BAR_SHOW_PX = 280

useLandingMotion()

let scrollRaf = 0

function distanceFromBottom(el) {
  return el.scrollHeight - (el.scrollTop + el.clientHeight)
}

function updateMobileBarVisibility(el) {
  const gap = distanceFromBottom(el)
  if (gap <= MOBILE_BAR_HIDE_PX) {
    mobileBarHidden.value = true
  } else if (gap >= MOBILE_BAR_SHOW_PX) {
    mobileBarHidden.value = false
  }
}

function onLandingScroll(e) {
  const el = e.target
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateMobileBarVisibility(el)
  })
}

function bindLandingScroll() {
  const el = document.querySelector('[data-scroll="landing"]')
  if (!el) return
  updateMobileBarVisibility(el)
  el.addEventListener('scroll', onLandingScroll, { passive: true })
  return el
}

let landingScrollEl = null

onMounted(() => {
  landingScrollEl = bindLandingScroll()
  window.addEventListener('resize', onLandingResize, { passive: true })
})

function onLandingResize() {
  if (!landingScrollEl) return
  updateMobileBarVisibility(landingScrollEl)
}

onBeforeUnmount(() => {
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  landingScrollEl?.removeEventListener('scroll', onLandingScroll)
  window.removeEventListener('resize', onLandingResize)
})
</script>

<template>
  <div
    data-scroll="landing"
    class="scroll-y landing-page landing-scroll"
    style="height: 100vh; overflow-y: auto"
  >
    <div class="landing-atmosphere" aria-hidden="true">
      <div class="landing-atmosphere__blob landing-atmosphere__blob--a" />
      <div class="landing-atmosphere__blob landing-atmosphere__blob--b" />
      <div class="landing-atmosphere__blob landing-atmosphere__blob--c" />
      <div class="landing-atmosphere__blob landing-atmosphere__blob--d" />
    </div>
    <TopNav
      :theme="theme"
      @nav="emit('nav', $event)"
      @book="booking = true"
      @toggle-theme="emit('toggle-theme')"
    />
    <HeroSection @nav="emit('nav', $event)" />
    <VideoIntroSection @nav="emit('nav', $event)" />
    <VideoLessonsSection @nav="emit('nav', $event)" />
    <MentorSection @book="booking = true" />
    <ClosingCta />
    <SiteFooter @nav="emit('nav', $event)" />
    <BookingModal :open="booking" @close="booking = false" />

    <div
      class="landing-mobile-bar show-mobile-only"
      :class="{ 'is-hidden': mobileBarHidden }"
      role="group"
      aria-label="Quick actions"
    >
      <button type="button" class="btn btn-ghost" @click="emit('nav', 'enroll')">Бүртгүүлэх</button>
      <button type="button" class="btn btn-primary" @click="booking = true">Цаг захиалах</button>
    </div>
  </div>
</template>

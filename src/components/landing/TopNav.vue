<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { scrollToLandingSection } from '@/composables/useLandingMotion.js'
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  theme: { type: String, default: 'light' },
})
const emit = defineEmits(['nav', 'book', 'toggle-theme'])

const scrolled = ref(false)
const menuOpen = ref(false)
let el = null

const navLinks = [
  { label: 'Courses', section: 'courses' },
  { label: 'Introduction', section: 'intro' },
  { label: 'Mentorship', section: 'mentor' },
]

const onScroll = () => {
  scrolled.value = el.scrollTop > 24
}

onMounted(() => {
  el = document.querySelector('[data-scroll="landing"]')
  if (el) el.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  if (el) el.removeEventListener('scroll', onScroll)
})

watch(menuOpen, (open) => {
  if (el) el.style.overflow = open ? 'hidden' : ''
})

function closeMenu() {
  menuOpen.value = false
}

function goToSection(section) {
  scrollToLandingSection(section)
  closeMenu()
}

function onNav(target) {
  closeMenu()
  emit('nav', target)
}

function onBook() {
  closeMenu()
  emit('book')
}
</script>

<template>
  <header
    class="landing-header"
    :class="{ 'landing-header--scrolled': scrolled, 'landing-header--menu-open': menuOpen }"
  >
    <div class="landing-header__bar mx-auto flex max-w-wrap items-center justify-between px-4 sm:px-8">
      <button type="button" class="landing-logo-btn" aria-label="Scroll to top" @click="goToSection('hero')">
        <UiLogo :size="21" />
      </button>

      <nav class="hide-mobile landing-header__nav" aria-label="Main">
        <button
          v-for="link in navLinks"
          :key="link.section"
          type="button"
          class="navlink"
          @click="goToSection(link.section)"
        >
          {{ link.label }}
        </button>
      </nav>

      <div class="hide-mobile flex items-center" style="gap: 12px">
        <button class="btn btn-ghost btn-sm" @click="emit('nav', 'login')">Нэвтрэх</button>
        <button class="btn btn-primary btn-sm" @click="emit('book')">Хувийн уншлага цаг захиалах</button>
      </div>

      <button
        class="show-mobile-only menu-toggle"
        :aria-expanded="menuOpen"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        @click="menuOpen = !menuOpen"
      >
        <UiIcon :name="menuOpen ? 'x' : 'menu'" :size="20" />
      </button>
    </div>

    <div class="mobile-nav-panel" :class="{ 'mobile-nav-panel--open': menuOpen }" :aria-hidden="!menuOpen">
      <nav class="mobile-nav-panel__inner" aria-label="Mobile">
        <button
          v-for="link in navLinks"
          :key="link.section"
          type="button"
          class="mobile-nav-link"
          @click="goToSection(link.section)"
        >
          {{ link.label }}
        </button>
        <div class="hr" style="margin: 12px 0" />
        <button type="button" class="btn btn-ghost btn-block" @click="onNav('login')">Нэвтрэх</button>
        <button type="button" class="btn btn-primary btn-block" @click="onBook">Book a consultation</button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: transparent;
  border-bottom: 1px solid transparent;
  transition:
    background 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.landing-header--scrolled,
.landing-header--menu-open {
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
  box-shadow: var(--sh-sm);
}
.landing-header__bar {
  height: 64px;
  gap: 12px;
}
.landing-logo-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 0;
  border: none;
  background: none;
  cursor: pointer;
  flex: none;
}
.landing-header__nav {
  display: flex;
  align-items: center;
  gap: 28px;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink-soft);
}
.navlink {
  position: relative;
  padding: 6px 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}
.navlink:hover {
  color: var(--ink);
}
.navlink::after {
  content: '';
  position: absolute;
  left: 0;
  right: 100%;
  bottom: 0;
  height: 2px;
  background: var(--clay);
  transition: right 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.navlink:hover::after {
  right: 0;
}
.mobile-nav-panel {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  border-bottom: 1px solid transparent;
  transition:
    max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease,
    border-color 0.35s ease;
}
.mobile-nav-panel--open {
  max-height: 420px;
  opacity: 1;
  pointer-events: auto;
  border-bottom-color: var(--line);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.mobile-nav-panel__inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
}
.mobile-nav-link {
  display: block;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  min-height: 48px;
  border: none;
  border-radius: var(--r-md);
  font-size: 16px;
  font-weight: 500;
  color: var(--ink-soft);
  background: transparent;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
}
.mobile-nav-link:active {
  transform: scale(0.98);
}
.mobile-nav-link:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.menu-toggle {
  margin-left: auto;
}
</style>

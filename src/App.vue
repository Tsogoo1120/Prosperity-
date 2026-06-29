<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTweaks } from '@/composables/useTweaks.js'
import { useAuth } from '@/composables/useAuth.js'
import LandingPage from '@/views/LandingPage.vue'
import LoginPage from '@/views/LoginPage.vue'
import EnrollPage from '@/views/EnrollPage.vue'
import StudentApp from '@/views/StudentApp.vue'
import AdminApp from '@/views/AdminApp.vue'

const { tweaks, setTweak } = useTweaks()
const { session, profile, loading, init, isAdmin } = useAuth()

const screen = ref(localStorage.getItem('union-screen') || 'landing')
function nav(s) {
  screen.value = s
  localStorage.setItem('union-screen', s)
  window.scrollTo(0, 0)
}

const theme = computed(() => (tweaks.dark ? 'dark' : 'light'))
const toggleTheme = () => setTweak('dark', !tweaks.dark)

const current = computed(
  () =>
    ({
      landing: LandingPage,
      login: LoginPage,
      enroll: EnrollPage,
      student: StudentApp,
      admin: AdminApp,
    })[screen.value] || LandingPage,
)

// After Google OAuth redirect, Supabase parses the URL hash and establishes the
// session asynchronously via onAuthStateChange — which can fire AFTER init()
// returns. So routing must wait until auth has settled (loading false + session
// present + profile loaded), not run once at mount. Drive it off a watcher.
let routed = false
function handlePostOAuth() {
  if (routed || loading.value || !session.value) return
  const postOAuth = sessionStorage.getItem('union-post-oauth')
  if (!postOAuth) return
  routed = true
  sessionStorage.removeItem('union-post-oauth')
  try {
    const parsed = JSON.parse(postOAuth)
    if (parsed.intent === 'login') {
      // Login flow: admin gets admin panel, others route by subscription
      if (isAdmin()) {
        nav('admin')
      } else {
        nav(profile.value?.subscription_status === 'active' ? 'student' : 'enroll')
      }
    } else {
      // Enroll flow: restore service + step
      sessionStorage.setItem('union-enroll-intent', postOAuth)
      nav('enroll')
    }
  } catch {
    nav('enroll')
  }
}

watch([loading, session, profile], handlePostOAuth)

onMounted(async () => {
  await init()
  handlePostOAuth()
})
</script>

<template>
  <div :key="screen" class="fade">
    <component
      :is="current"
      :theme="theme"
      @nav="nav"
      @toggle-theme="toggleTheme"
    />
  </div>

</template>

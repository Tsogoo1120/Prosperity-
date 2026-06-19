<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useSidebar } from '@/composables/useSidebar.js'
import { useAuth } from '@/composables/useAuth.js'
import StudentSidebar from '@/components/student/StudentSidebar.vue'
import StudentTopbar from '@/components/student/StudentTopbar.vue'
import DashboardView from '@/components/student/DashboardView.vue'
import LearnView from '@/components/student/LearnView.vue'
import AssessmentsView from '@/components/student/AssessmentsView.vue'
import ChallengeView from '@/components/student/ChallengeView.vue'
import SessionsView from '@/components/student/SessionsView.vue'
import CommunityView from '@/components/student/CommunityView.vue'
import BookingModal from '@/components/landing/BookingModal.vue'

const emit = defineEmits(['nav'])

const { session, profile, loading, signOut } = useAuth()

watchEffect(() => {
  if (loading.value) return
  if (!session.value) {
    emit('nav', 'login')
  } else if (profile.value?.subscription_status !== 'active') {
    emit('nav', 'enroll')
  }
})

const view = ref('dashboard')
const booking = ref(false)
const { open: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebar()

const userName = computed(() => {
  const name = profile.value?.full_name ?? session.value?.user?.user_metadata?.full_name ?? session.value?.user?.user_metadata?.name ?? ''
  return name || 'Student'
})

const firstName = computed(() => userName.value.split(' ')[0])

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const titles = computed(() => ({
  dashboard: [`${greeting()}, ${firstName.value}`, 'Welcome back to your learning journey.'],
  learn: ['Continue learning', null],
  assess: ['Assessments', 'Honest mirrors for where you are right now.'],
  challenge: ['31-Day Growth Challenge', 'A daily practice in becoming.'],
  sessions: ['My sessions', 'One-on-one mentorship and consultations.'],
  community: ['Community', 'Choose your collective reading and share your journey.'],
}))
const title = computed(() => (titles.value[view.value] || ['', null])[0])
const sub = computed(() => (titles.value[view.value] || ['', null])[1])

async function handleLogout() {
  await signOut()
  emit('nav', 'login')
}
</script>

<template>
  <div class="flex" style="min-height: 100vh; background: var(--surface)">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebar" />
    <StudentSidebar
      :view="view"
      :open="sidebarOpen"
      :user-name="userName"
      @set-view="view = $event"
      @nav="emit('nav', $event)"
      @close="closeSidebar"
      @logout="handleLogout"
    />
    <div class="flex flex-col" style="flex: 1; min-width: 0">
      <LearnView v-if="view === 'learn'" @set-view="view = $event" @menu="toggleSidebar" />

      <template v-else-if="view === 'assess'">
        <StudentTopbar :title="title" :sub="sub" @menu="toggleSidebar" />
        <AssessmentsView />
      </template>

      <template v-else-if="view === 'challenge'">
        <StudentTopbar :title="title" :sub="sub" @menu="toggleSidebar" />
        <ChallengeView />
      </template>

      <template v-else-if="view === 'sessions'">
        <StudentTopbar :title="title" :sub="sub" show-book @book="booking = true" @menu="toggleSidebar" />
        <SessionsView @book="booking = true" />
      </template>

      <template v-else-if="view === 'community'">
        <StudentTopbar :title="title" :sub="sub" @menu="toggleSidebar" />
        <CommunityView />
      </template>

      <template v-else>
        <StudentTopbar :title="title" :sub="sub" show-book @book="booking = true" @menu="toggleSidebar" />
        <DashboardView @set-view="view = $event" @book="booking = true" />
      </template>
    </div>
    <BookingModal :open="booking" @close="booking = false" />
  </div>
</template>

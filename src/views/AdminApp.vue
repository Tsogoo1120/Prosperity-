<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useSidebar } from '@/composables/useSidebar.js'
import { useAuth } from '@/composables/useAuth.js'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
import AdminHead from '@/components/admin/AdminHead.vue'
import AdminOverview from '@/components/admin/AdminOverview.vue'
import AdminAnnouncements from '@/components/admin/AdminAnnouncements.vue'
import AdminSchedule from '@/components/admin/AdminSchedule.vue'
import AdminPayments from '@/components/admin/AdminPayments.vue'
import AdminVideos from '@/components/admin/AdminVideos.vue'
import AdminTests from '@/components/admin/AdminTests.vue'
import AdminCommunity from '@/components/admin/AdminCommunity.vue'
import AdminMembers from '@/components/admin/AdminMembers.vue'

const emit = defineEmits(['nav'])

const { session, profile, signOut } = useAuth()

const userName = computed(() => {
  const name = profile.value?.full_name ?? session.value?.user?.user_metadata?.full_name ?? session.value?.user?.user_metadata?.name ?? ''
  return name || 'Admin'
})

const view = ref('overview')
const pending = ref(0)
const { open: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebar()

async function handleLogout() {
  await signOut()
  emit('nav', 'login')
}

async function loadPending() {
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  pending.value = count ?? 0
}

onMounted(loadPending)
watch(view, loadPending)

const heads = {
  overview: ['Overview', 'A calm command center for your practice.'],
  announcements: ['Announcements', 'Post messages every member sees on their dashboard.'],
  schedule: ['Schedule', 'Set availability and manage one-on-one sessions.'],
  payments: ['Payments', 'Verify receipts and approve enrollments.'],
  videos: ['Видео хичээлүүд', 'Хичээл нэмэх, засварлах, нийтлэх.'],
  tests: ['Сэтгэл зүйн тестүүд', 'Тест нэмэх, асуулт засварлах, нийтлэх.'],
  community: ['Community', 'Publish collective readings and moderate member posts.'],
  members: ['Members', 'View subscriber details, manage access, and review meeting orders.'],
}
</script>

<template>
  <div class="flex" style="min-height: 100vh; background: var(--surface)">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebar" />
    <AdminSidebar
      :view="view"
      :pending="pending"
      :open="sidebarOpen"
      :user-name="userName"
      @set-view="view = $event"
      @nav="emit('nav', $event)"
      @close="closeSidebar"
      @logout="handleLogout"
    />
    <div class="flex flex-col" style="flex: 1; min-width: 0">
      <AdminHead
        :title="heads[view]?.[0] ?? ''"
        :sub="heads[view]?.[1] ?? ''"
        @menu="toggleSidebar"
      />
      <AdminOverview v-if="view === 'overview'" :pending="pending" @set-view="view = $event" />
      <AdminAnnouncements v-else-if="view === 'announcements'" />
      <AdminSchedule v-else-if="view === 'schedule'" />
      <AdminPayments v-else-if="view === 'payments'" />
      <AdminVideos v-else-if="view === 'videos'" />
      <AdminTests v-else-if="view === 'tests'" />
      <AdminCommunity v-else-if="view === 'community'" />
      <AdminMembers v-else-if="view === 'members'" />
    </div>
  </div>
</template>

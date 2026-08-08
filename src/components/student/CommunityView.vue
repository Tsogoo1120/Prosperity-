<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import JourneyPostCard from '@/components/student/community/JourneyPostCard.vue'
import JourneyComposer from '@/components/student/community/JourneyComposer.vue'

const { session, profile } = useAuth()

const posts = ref([])
const loading = ref(true)
const composerOpen = ref(false)
const filter = ref('all')

const filters = [
  ['all', 'All journeys'],
  ['mine', 'My posts'],
]

async function fetchPosts() {
  loading.value = true
  const { data } = await supabase
    .from('community_posts')
    .select(`
      *,
      profiles ( full_name, avatar_url ),
      comments (
        id, user_id, body, created_at,
        profiles ( full_name, avatar_url )
      )
    `)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
  posts.value = data ?? []
  loading.value = false
}

onMounted(fetchPosts)

const filteredPosts = computed(() => {
  if (filter.value === 'mine') return posts.value.filter((p) => p.user_id === session.value?.user?.id)
  return posts.value
})

async function addComment({ postId, body }) {
  if (!session.value) return
  await supabase.from('comments').insert({ post_id: postId, user_id: session.value.user.id, body })
  await fetchPosts()
}

async function publishPost({ title, body }) {
  if (!session.value) return
  await supabase.from('community_posts').insert({ user_id: session.value.user.id, title, body })
  composerOpen.value = false
  filter.value = 'all'
  await fetchPosts()
}

const communityStats = computed(() => [
  { label: 'Journeys shared', value: String(posts.value.length) },
  { label: 'My posts', value: String(posts.value.filter((p) => p.user_id === session.value?.user?.id).length) },
])

const currentUser = computed(() => ({
  name: profile.value?.full_name ?? 'You',
  avatar_url: profile.value?.avatar_url ?? null,
}))
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow" style="max-width: 680px">
      <!-- Community banner -->
      <div
        class="card rise"
        style="border-radius: 18px; padding: 24px 28px; margin-bottom: 24px; background: linear-gradient(120deg, var(--primary-tint), var(--card)); position: relative; overflow: hidden"
      >
        <div class="flex flex-col sm:flex-row sm:items-center" style="gap: 20px">
          <div style="width: 56px; height: 56px; border-radius: 14px; background: var(--primary-tint); color: var(--primary-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
            <UiIcon name="users" :size="28" />
          </div>
          <div style="flex: 1">
            <h3 style="font-size: 20px; margin-bottom: 4px">Growth community</h3>
            <p class="muted" style="font-size: 14.5px; line-height: 1.5">
              Share your journey and support others with comments.
            </p>
          </div>
          <button class="btn btn-primary" @click="composerOpen = true">
            <UiIcon name="pen" :size="16" /> Share journey
          </button>
        </div>
        <div class="flex flex-wrap" style="gap: 20px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line)">
          <div v-for="s in communityStats" :key="s.label">
            <div style="font-family: var(--serif); font-weight: 700; font-size: 20px">{{ s.value }}</div>
            <div class="muted" style="font-size: 12.5px">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- Compose prompt card -->
      <button
        class="card rise flex w-full items-center text-left"
        style="border-radius: 14px; padding: 16px 18px; gap: 14px; margin-bottom: 20px; cursor: pointer; border: 1px solid var(--line); background: var(--card)"
        @click="composerOpen = true"
      >
        <UiAvatar :name="currentUser.name" :size="40" />
        <span class="muted" style="flex: 1; font-size: 14.5px">What's shifting in your journey today?</span>
      </button>

      <!-- Filters -->
      <div class="flex flex-wrap" style="gap: 8px; margin-bottom: 20px">
        <button
          v-for="[id, label] in filters"
          :key="id"
          class="chip"
          :class="filter === id ? 'clay' : ''"
          :style="filter !== id ? { background: 'var(--surface-2)', cursor: 'pointer', border: 'none' } : { cursor: 'pointer', border: 'none' }"
          @click="filter = id"
        >
          {{ label }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="muted" style="text-align: center; padding: 48px 24px; font-size: 14px">
        Loading…
      </div>

      <!-- Feed -->
      <div v-else-if="filteredPosts.length" class="flex flex-col" style="gap: 20px; padding-bottom: 32px">
        <JourneyPostCard
          v-for="(post, i) in filteredPosts"
          :key="post.id"
          :post="post"
          :current-user="currentUser"
          class="rise"
          :style="{ animationDelay: i * 0.05 + 's' }"
          @comment="addComment"
        />
      </div>

      <div v-else class="card card-pad rise" style="border-radius: 16px; text-align: center; padding: 48px 24px">
        <UiIcon name="message" :size="40" style="color: var(--faint); margin-bottom: 12px" />
        <h3 style="font-size: 17px; margin-bottom: 6px">No posts yet</h3>
        <p class="muted" style="font-size: 14px; margin-bottom: 18px">
          {{ filter === 'mine' ? 'You haven\'t shared a journey yet.' : 'Be the first to share something from your path.' }}
        </p>
        <button class="btn btn-primary" @click="composerOpen = true">
          <UiIcon name="pen" :size="16" /> Share your journey
        </button>
      </div>
    </div>

    <JourneyComposer
      :open="composerOpen"
      :current-user="currentUser"
      @close="composerOpen = false"
      @publish="publishPost"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import ReadingManager from '@/components/admin/ReadingManager.vue'
import { timeAgo } from '@/utils/time.js'

const section = ref('readings')
const sections = [
  ['readings', 'Collective reading', 'spark'],
  ['posts', 'Member posts', 'users'],
]

const posts = ref([])
const loading = ref(true)
const expandedId = ref(null)

async function fetchPosts() {
  loading.value = true
  const { data } = await supabase
    .from('community_posts')
    .select(`
      *,
      profiles ( full_name ),
      comments (
        id, user_id, body, is_hidden, created_at,
        profiles ( full_name )
      )
    `)
    .order('created_at', { ascending: false })
  posts.value = data ?? []
  loading.value = false
}

onMounted(fetchPosts)

const stats = computed(() => [
  { label: 'Total posts', value: posts.value.length },
  { label: 'Hidden posts', value: posts.value.filter((p) => p.is_hidden).length },
  { label: 'Total comments', value: posts.value.reduce((n, p) => n + (p.comments?.length ?? 0), 0) },
])

async function togglePost(post) {
  const next = !post.is_hidden
  const { error } = await supabase
    .from('community_posts')
    .update({ is_hidden: next })
    .eq('id', post.id)
  if (!error) post.is_hidden = next
}

async function toggleComment(comment) {
  const next = !comment.is_hidden
  const { error } = await supabase
    .from('comments')
    .update({ is_hidden: next })
    .eq('id', comment.id)
  if (!error) comment.is_hidden = next
}

</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow" style="max-width: 800px">

      <!-- Section tabs -->
      <div class="flex" style="gap: 6px; margin-bottom: 22px; background: var(--surface-2); padding: 5px; border-radius: 12px; max-width: 420px">
        <button
          v-for="[id, label, ic] in sections"
          :key="id"
          class="flex items-center justify-center"
          :style="{
            flex: 1,
            gap: '7px',
            padding: '9px 12px',
            borderRadius: '9px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: section === id ? 600 : 500,
            background: section === id ? 'var(--card)' : 'transparent',
            color: section === id ? 'var(--ink)' : 'var(--ink-soft)',
            boxShadow: section === id ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            transition: 'background .15s, color .15s',
          }"
          @click="section = id"
        >
          <UiIcon :name="ic" :size="16" /> {{ label }}
        </button>
      </div>

      <ReadingManager v-if="section === 'readings'" />

      <template v-else>
      <!-- Stats -->
      <div class="flex flex-wrap" style="gap: 12px; margin-bottom: 24px">
        <div
          v-for="s in stats"
          :key="s.label"
          class="card"
          style="padding: 16px 22px; border-radius: 14px; min-width: 130px"
        >
          <div style="font-family: var(--serif); font-weight: 700; font-size: 24px">{{ s.value }}</div>
          <div class="muted" style="font-size: 12.5px; margin-top: 2px">{{ s.label }}</div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="muted" style="text-align: center; padding: 48px 0; font-size: 14px">
        Loading…
      </div>

      <!-- Empty -->
      <div v-else-if="!posts.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 48px 24px">
        <UiIcon name="message" :size="40" style="color: var(--faint); margin-bottom: 12px" />
        <p class="muted" style="font-size: 14px">No community posts yet.</p>
      </div>

      <!-- Post list -->
      <div v-else class="flex flex-col" style="gap: 12px; padding-bottom: 40px">
        <div
          v-for="post in posts"
          :key="post.id"
          class="card"
          :style="{ borderRadius: '14px', overflow: 'hidden', opacity: post.is_hidden ? 0.55 : 1, transition: 'opacity .2s' }"
        >
          <!-- Post row -->
          <div class="flex items-start" style="padding: 16px 18px; gap: 12px">
            <UiAvatar :name="post.profiles?.full_name ?? 'Member'" :size="40" />
            <div style="flex: 1; min-width: 0">
              <div class="flex items-center flex-wrap" style="gap: 8px; margin-bottom: 4px">
                <span style="font-weight: 600; font-size: 14.5px">{{ post.profiles?.full_name ?? 'Member' }}</span>
                <span class="muted" style="font-size: 12.5px">{{ timeAgo(post.created_at) }}</span>
                <span
                  v-if="post.is_hidden"
                  style="font-size: 11.5px; background: var(--surface-2); color: var(--ink-soft); border-radius: 6px; padding: 2px 8px"
                >Hidden</span>
              </div>
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 5px; line-height: 1.3">{{ post.title }}</div>
              <p style="font-size: 13.5px; color: var(--ink-soft); line-height: 1.55">
                {{ post.body.length > 220 ? post.body.slice(0, 220) + '…' : post.body }}
              </p>
            </div>
            <div class="flex flex-col items-end" style="gap: 6px; flex-shrink: 0">
              <button
                class="btn btn-ghost btn-sm"
                @click="expandedId = expandedId === post.id ? null : post.id"
              >
                <UiIcon name="message" :size="14" />
                {{ post.comments?.length ?? 0 }}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                :style="post.is_hidden ? { color: 'var(--primary)' } : {}"
                @click="togglePost(post)"
              >
                <UiIcon :name="post.is_hidden ? 'eye' : 'lock'" :size="14" />
                {{ post.is_hidden ? 'Unhide' : 'Hide' }}
              </button>
            </div>
          </div>

          <!-- Comments panel -->
          <template v-if="expandedId === post.id">
            <div style="border-top: 1px solid var(--line); padding: 14px 18px 16px">
              <div v-if="post.comments?.length" class="flex flex-col" style="gap: 10px">
                <div
                  v-for="c in post.comments"
                  :key="c.id"
                  class="flex items-start"
                  :style="{ gap: '10px', opacity: c.is_hidden ? 0.45 : 1, transition: 'opacity .2s' }"
                >
                  <UiAvatar :name="c.profiles?.full_name ?? 'Member'" :size="30" />
                  <div style="flex: 1; min-width: 0; background: var(--surface-2); border-radius: 10px; padding: 9px 13px">
                    <div class="flex items-center justify-between" style="margin-bottom: 3px; gap: 8px">
                      <div class="flex items-center" style="gap: 6px; min-width: 0">
                        <span style="font-weight: 600; font-size: 13px">{{ c.profiles?.full_name ?? 'Member' }}</span>
                        <span class="muted" style="font-size: 11.5px">{{ timeAgo(c.created_at) }}</span>
                        <span v-if="c.is_hidden" class="muted" style="font-size: 11.5px">(hidden)</span>
                      </div>
                      <button
                        class="btn btn-ghost btn-sm"
                        style="padding: 2px 8px; font-size: 12px; flex-shrink: 0"
                        :style="c.is_hidden ? { color: 'var(--primary)' } : {}"
                        @click="toggleComment(c)"
                      >
                        {{ c.is_hidden ? 'Unhide' : 'Hide' }}
                      </button>
                    </div>
                    <p style="font-size: 13.5px; color: var(--ink-soft); line-height: 1.5">{{ c.body }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="muted" style="font-size: 13.5px">No comments on this post.</p>
            </div>
          </template>
        </div>
      </div>
      </template>

    </div>
  </div>
</template>

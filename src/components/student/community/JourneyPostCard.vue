<script setup>
import { ref, computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const props = defineProps({
  post: { type: Object, required: true },
  currentUser: { type: Object, required: true },
})

const emit = defineEmits(['comment'])

const showComments = ref(false)
const draft = ref('')

const authorName = computed(() => props.post.profiles?.full_name ?? 'Member')
const commentCount = computed(() => props.post.comments?.length ?? 0)

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function toggleComments() {
  showComments.value = !showComments.value
}

function submitComment() {
  const text = draft.value.trim()
  if (!text) return
  emit('comment', { postId: props.post.id, body: text })
  draft.value = ''
  showComments.value = true
}
</script>

<template>
  <article class="card rise" style="border-radius: 16px; overflow: hidden">
    <!-- Author header -->
    <div class="flex items-center" style="padding: 18px 20px 0; gap: 12px">
      <UiAvatar :name="authorName" :size="44" />
      <div style="flex: 1; min-width: 0">
        <div style="font-weight: 600; font-size: 15px">{{ authorName }}</div>
        <div class="muted" style="font-size: 13px">{{ timeAgo(post.created_at) }}</div>
      </div>
    </div>

    <!-- Title & body -->
    <div style="padding: 14px 20px 0">
      <h3 style="font-size: 17px; margin-bottom: 8px; line-height: 1.35">{{ post.title }}</h3>
      <p style="font-size: 15px; color: var(--ink-soft); line-height: 1.6">{{ post.body }}</p>
    </div>

    <!-- Actions -->
    <div
      class="flex items-center flex-wrap"
      style="padding: 16px 20px; gap: 8px; border-top: 1px solid var(--line); margin-top: 16px"
    >
      <button class="btn btn-ghost btn-sm" @click="toggleComments">
        <UiIcon name="message" :size="16" />
        {{ commentCount }} {{ commentCount === 1 ? 'comment' : 'comments' }}
      </button>
    </div>

    <!-- Comments thread -->
    <div v-if="showComments || commentCount" style="padding: 0 20px 18px">
      <div v-if="commentCount" class="flex flex-col" style="gap: 14px; margin-bottom: 14px">
        <div
          v-for="c in post.comments"
          :key="c.id"
          class="flex"
          style="gap: 10px"
        >
          <UiAvatar :name="c.profiles?.full_name ?? 'Member'" :size="32" />
          <div style="flex: 1; min-width: 0; background: var(--surface-2); border-radius: 12px; padding: 10px 14px">
            <div class="flex items-center justify-between" style="margin-bottom: 4px">
              <span style="font-weight: 600; font-size: 13.5px">{{ c.profiles?.full_name ?? 'Member' }}</span>
              <span class="muted" style="font-size: 12px">{{ timeAgo(c.created_at) }}</span>
            </div>
            <p style="font-size: 14px; color: var(--ink-soft); line-height: 1.5">{{ c.body }}</p>
          </div>
        </div>
      </div>

      <div v-if="showComments" class="flex" style="gap: 10px; align-items: flex-start">
        <UiAvatar :name="currentUser.name" :size="32" />
        <div style="flex: 1">
          <textarea
            v-model="draft"
            class="textarea"
            rows="2"
            placeholder="Leave a supportive comment…"
            style="width: 100%; font-size: 14px; resize: vertical; min-height: 56px"
            @keydown.enter.exact.prevent="submitComment"
          />
          <div class="flex justify-end" style="margin-top: 8px; gap: 8px">
            <button v-if="draft" class="btn btn-ghost btn-sm" @click="draft = ''">Cancel</button>
            <button class="btn btn-primary btn-sm" :disabled="!draft.trim()" @click="submitComment">
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const props = defineProps({
  currentUser: { type: Object, required: true },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'publish'])

const title = ref('')
const body = ref('')

function reset() {
  title.value = ''
  body.value = ''
}

function close() {
  reset()
  emit('close')
}

function publish() {
  const t = title.value.trim()
  const b = body.value.trim()
  if (!t || !b) return
  emit('publish', { title: t, body: b })
  reset()
}
</script>

<template>
  <div
    v-if="open"
    style="position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; padding: 16px"
    @click.self="close"
  >
    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px)" />
    <div
      class="card rise page-in"
      style="position: relative; width: 100%; max-width: 560px; border-radius: 18px 18px 16px 16px; max-height: 90vh; overflow-y: auto"
    >
      <div class="flex items-center justify-between" style="padding: 20px 22px 0">
        <h3 style="font-size: 18px">Share your journey</h3>
        <button class="btn btn-quiet btn-sm" style="padding: 6px" @click="close">
          <UiIcon name="x" :size="20" />
        </button>
      </div>

      <div style="padding: 18px 22px 22px">
        <div class="flex items-center" style="gap: 12px; margin-bottom: 18px">
          <UiAvatar :name="currentUser.name" :size="42" />
          <div style="font-weight: 600; font-size: 14.5px">{{ currentUser.name }}</div>
        </div>

        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">
          Title
        </label>
        <input
          v-model="title"
          type="text"
          placeholder="e.g. What shifted in me today"
          style="width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 15px; margin-bottom: 14px"
        />

        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">
          Your story
        </label>
        <textarea
          v-model="body"
          class="textarea"
          rows="5"
          placeholder="What shifted? What are you learning? Share like you would in a vlog journal…"
          style="width: 100%; font-size: 15px; margin-bottom: 16px"
        />

        <div class="flex" style="gap: 10px">
          <button class="btn btn-ghost btn-block" @click="close">Cancel</button>
          <button class="btn btn-primary btn-block" :disabled="!title.trim() || !body.trim()" @click="publish">
            <UiIcon name="upload" :size="16" /> Publish to community
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  lessonId: { type: String, required: true },
})

const text = ref('')
const saved = ref(true)
let timer = null

watch(
  () => props.lessonId,
  (id) => {
    text.value = localStorage.getItem('union-note-' + id) || ''
    saved.value = true
  },
  { immediate: true },
)

function onInput() {
  saved.value = false
  clearTimeout(timer)
  timer = setTimeout(() => {
    localStorage.setItem('union-note-' + props.lessonId, text.value)
    saved.value = true
  }, 600)
}

const stamps = ['00:42', '02:04', '03:30']
</script>

<template>
  <div class="flex flex-col" style="height: 100%">
    <div class="flex items-center justify-between" style="margin-bottom: 12px">
      <div class="flex items-center" :style="{ gap: '8px', fontSize: '12.5px', color: saved ? 'var(--sage-deep)' : 'var(--muted)' }">
        <span :style="{ width: '7px', height: '7px', borderRadius: '50%', background: saved ? 'var(--sage-deep)' : 'var(--clay)' }" />
        {{ saved ? 'All changes saved' : 'Saving…' }}
      </div>
      <button class="btn btn-quiet btn-sm" style="font-size: 12.5px; padding: 5px 8px"><UiIcon name="clock" :size="14" /> Timestamp</button>
    </div>
    <textarea
      v-model="text"
      class="textarea"
      placeholder="Write as you watch. Notes are saved against this lesson automatically…"
      style="flex: 1; resize: none; font-size: 14.5px; line-height: 1.7; border: none; background: var(--surface-2); border-radius: 12px; padding: 16px"
      @input="onInput"
    />
    <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 12px">
      <span v-for="s in stamps" :key="s" class="chip blue" style="cursor: pointer"><UiIcon name="play" :size="11" fill /> {{ s }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  title: { type: String, default: '' },
  sub: { type: [String, null], default: null },
  showBook: { type: Boolean, default: false },
})
const emit = defineEmits(['book', 'menu', 'open-lesson'])

// --- Lesson search -------------------------------------------------------
const q = ref('')
const results = ref([])
const open = ref(false)
const loading = ref(false)
const wrap = ref(null)
let timer = null

function fmtDur(s) {
  if (!s) return null
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

async function run(term) {
  loading.value = true
  const { data } = await supabase
    .from('video_lessons')
    .select('id, title, category, duration_seconds')
    .eq('is_published', true)
    .ilike('title', `%${term}%`)
    .order('sort_order', { ascending: true })
    .limit(6)
  results.value = data ?? []
  loading.value = false
}

// Debounce keystrokes so we hit Supabase at most ~4×/sec while typing.
watch(q, (val) => {
  clearTimeout(timer)
  const term = val.trim()
  if (!term) {
    results.value = []
    open.value = false
    return
  }
  open.value = true
  loading.value = true
  timer = setTimeout(() => run(term), 220)
})

function choose(l) {
  emit('open-lesson', l.id)
  q.value = ''
  results.value = []
  open.value = false
}

function onEnter() {
  if (results.value.length) choose(results.value[0])
}

// Close the dropdown on any click outside the search wrapper.
function onDocDown(e) {
  if (wrap.value && !wrap.value.contains(e.target)) open.value = false
}
watch(open, (v) => {
  if (v) document.addEventListener('mousedown', onDocDown)
  else document.removeEventListener('mousedown', onDocDown)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('mousedown', onDocDown)
})
</script>

<template>
  <div
    class="topbar-row"
    style="border-bottom: 1px solid var(--line); position: sticky; top: 0; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(10px); z-index: 20"
  >
    <div class="flex items-center" style="gap: 12px; min-width: 0">
      <button class="menu-toggle" aria-label="Open navigation" @click="emit('menu')">
        <UiIcon name="menu" :size="20" />
      </button>
      <div style="min-width: 0">
        <h2 style="font-size: clamp(18px, 4vw, 22px); line-height: 1.2">{{ title }}</h2>
        <div v-if="sub" class="muted hide-mobile" style="font-size: 13.5px; margin-top: 2px">{{ sub }}</div>
      </div>
    </div>
    <div class="flex items-center" style="gap: 8px; flex-shrink: 0">
      <!-- Lesson search -->
      <div ref="wrap" class="hide-mobile" style="position: relative">
        <div
          class="flex items-center"
          style="background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; gap: 9px; width: 230px; color: var(--faint)"
        >
          <UiIcon name="search" :size="17" />
          <input
            v-model="q"
            type="text"
            placeholder="Search lessons…"
            aria-label="Search lessons"
            style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13.5px; color: var(--ink)"
            @focus="q.trim() && (open = true)"
            @keydown.enter="onEnter"
            @keydown.esc="open = false"
          />
          <button
            v-if="q"
            class="search-clear"
            aria-label="Clear search"
            style="display: flex; border: none; background: transparent; cursor: pointer; color: var(--faint); padding: 0"
            @click="q = ''"
          >
            <UiIcon name="x" :size="14" />
          </button>
        </div>

        <!-- Results dropdown -->
        <div
          v-if="open"
          style="position: absolute; top: calc(100% + 6px); right: 0; width: 300px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--sh-lg); padding: 6px; z-index: 40; max-height: 360px; overflow-y: auto"
        >
          <div v-if="loading" class="muted" style="font-size: 13px; padding: 14px 12px">Хайж байна…</div>
          <template v-else-if="results.length">
            <button
              v-for="l in results"
              :key="l.id"
              class="search-result flex items-center text-left w-full"
              style="gap: 10px; padding: 10px 12px; border: none; background: transparent; cursor: pointer; border-radius: 9px"
              @click="choose(l)"
            >
              <span
                style="width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: var(--primary-tint); color: var(--primary-deep); display: flex; align-items: center; justify-content: center"
              >
                <UiIcon name="play" :size="14" fill />
              </span>
              <span style="flex: 1; min-width: 0">
                <span style="display: block; font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ l.title }}</span>
                <span class="muted" style="font-size: 12px">
                  {{ l.category || 'Хичээл' }}<template v-if="fmtDur(l.duration_seconds)"> · {{ fmtDur(l.duration_seconds) }}</template>
                </span>
              </span>
            </button>
          </template>
          <div v-else class="muted" style="font-size: 13px; padding: 14px 12px">Хичээл олдсонгүй.</div>
        </div>
      </div>

      <button v-if="showBook" class="btn btn-primary btn-sm hide-mobile" @click="emit('book')">
        <UiIcon name="calendar" :size="16" /> Book session
      </button>
      <button v-if="showBook" class="btn btn-primary btn-sm show-mobile-only" style="padding: 10px" title="Book session" @click="emit('book')">
        <UiIcon name="calendar" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-result:hover {
  background: var(--surface-2);
}
</style>

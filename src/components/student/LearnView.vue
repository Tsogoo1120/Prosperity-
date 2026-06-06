<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiIcon from '@/components/common/UiIcon.vue'
import VideoStage from './VideoStage.vue'
import NotesPanel from './NotesPanel.vue'

const emit = defineEmits(['set-view', 'menu'])

const { session } = useAuth()

const lessons = ref([])
const loading = ref(true)
const active = ref(null)
const playing = ref(false)
const tab = ref('notes')
const realtimeChannel = ref(null)
const doneIds = ref(new Set()) // lesson IDs completed by current user
const markingDone = ref(false)

const idx = computed(() => lessons.value.findIndex((l) => l.id === active?.value?.id))

function pick(l) {
  active.value = l
  playing.value = false
}

function go(d) {
  const n = lessons.value[idx.value + d]
  if (n) { active.value = n; playing.value = false }
}

function fmtDur(s) {
  if (!s) return null
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

const tabs = [
  ['notes', 'Notes', 'note'],
  ['contents', 'Contents', 'layers'],
]

async function loadProgress() {
  const uid = session.value?.user?.id
  if (!uid) return
  const { data } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', uid)
  doneIds.value = new Set((data ?? []).map((r) => r.lesson_id))
}

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('video_lessons')
    .select('id, slug, title, description, category, thumbnail_path, video_r2_key, video_r2_key_vertical, duration_seconds, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
  lessons.value = data ?? []
  const currentId = active.value?.id
  active.value = lessons.value.find((l) => l.id === currentId) ?? lessons.value[0]
  loading.value = false
}

async function toggleDone(lesson) {
  const uid = session.value?.user?.id
  if (!uid || markingDone.value) return
  markingDone.value = true
  if (doneIds.value.has(lesson.id)) {
    await supabase.from('lesson_progress').delete().eq('user_id', uid).eq('lesson_id', lesson.id)
    doneIds.value.delete(lesson.id)
    doneIds.value = new Set(doneIds.value) // trigger reactivity
  } else {
    await supabase.from('lesson_progress').upsert({ user_id: uid, lesson_id: lesson.id })
    doneIds.value = new Set([...doneIds.value, lesson.id])
  }
  markingDone.value = false
}

function subscribeToLessons() {
  if (realtimeChannel.value) return
  realtimeChannel.value = supabase
    .channel('video_lessons_student')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'video_lessons', filter: 'is_published=eq.true' },
      () => {
        load()
      }
    )
    .subscribe()
}

onMounted(async () => {
  await Promise.all([load(), loadProgress()])
  subscribeToLessons()
})

onBeforeUnmount(() => {
  if (realtimeChannel.value) {
    supabase.removeChannel(realtimeChannel.value)
    realtimeChannel.value = null
  }
})
</script>

<template>
  <div class="scroll-y" style="flex: 1; min-height: 100vh; overflow-y: auto; background: var(--surface)">
    <!-- top bar -->
    <div
      class="topbar-row-compact"
      style="border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--surface); z-index: 20"
    >
      <div class="flex items-center" style="gap: 12px; min-width: 0">
        <button class="menu-toggle" aria-label="Open navigation" @click="emit('menu')">
          <UiIcon name="menu" :size="20" />
        </button>
        <button class="btn btn-quiet btn-sm" @click="emit('set-view', 'dashboard')">
          <UiIcon name="arrowLeft" :size="16" />
        </button>
        <div style="min-width: 0">
          <div class="muted hide-mobile" style="font-size: 12.5px">Видео хичээлүүд</div>
          <div style="font-weight: 600; font-size: clamp(14px, 3.5vw, 15px); line-height: 1.3">
            {{ active?.title ?? '…' }}
          </div>
        </div>
      </div>
      <div class="flex items-center" style="gap: 8px; flex-shrink: 0">
        <button class="btn btn-ghost btn-sm hide-mobile" :disabled="idx === 0" @click="go(-1)">
          <UiIcon name="arrowLeft" :size="16" /> Өмнөх
        </button>
        <button class="btn btn-primary btn-sm" :disabled="idx === lessons.length - 1" @click="go(1)">
          <span class="hide-mobile">Дараах </span><UiIcon name="arrowRight" :size="16" />
        </button>
      </div>
    </div>

    <!-- loading -->
    <div v-if="loading" style="padding: 80px; text-align: center; color: var(--muted)">
      Уншиж байна…
    </div>

    <!-- empty -->
    <div v-else-if="!lessons.length" style="padding: 80px; text-align: center; color: var(--muted)">
      <UiIcon name="video" :size="36" style="display: block; margin: 0 auto 16px; opacity: 0.25" />
      <p style="font-size: 15px">Нийтэлсэн хичээл байхгүй байна.</p>
    </div>

    <!-- main layout -->
    <div v-else class="grid-split-learn">
      <!-- left: video + meta -->
      <div>
        <VideoStage :lesson="active" v-model:playing="playing" />

        <div class="flex flex-wrap items-center justify-between" style="margin: 22px 0 14px; gap: 12px">
          <div>
            <span v-if="active.category" class="chip blue" style="margin-bottom: 10px">
              <UiIcon name="layers" :size="13" /> {{ active.category }}
            </span>
            <span class="chip" style="margin-bottom: 10px; margin-left: 6px">
              Хичээл {{ idx + 1 }} / {{ lessons.length }}
            </span>
            <h2 style="font-size: 25px; margin-top: 10px">{{ active.title }}</h2>
          </div>
          <button
            :class="doneIds.has(active.id) ? 'btn btn-primary btn-sm' : 'btn btn-soft btn-sm'"
            :disabled="markingDone"
            @click="toggleDone(active)"
          >
            <UiIcon :name="doneIds.has(active.id) ? 'checkCircle' : 'check'" :size="16" />
            {{ doneIds.has(active.id) ? 'Дуусгасан' : 'Дуусгасан гэж тэмдэглэх' }}
          </button>
        </div>

        <p v-if="active.description" style="font-size: 16px; color: var(--ink-soft); line-height: 1.7; max-width: 640px">
          {{ active.description }}
        </p>
      </div>

      <!-- right: notes / contents -->
      <div
        class="card learn-panel"
        style="border-radius: 16px; padding: 18px; position: sticky; top: 88px; height: calc(100vh - 112px); display: flex; flex-direction: column"
      >
        <!-- tab switcher -->
        <div class="flex items-center" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px; margin-bottom: 16px">
          <button
            v-for="[id, lbl, ic] in tabs"
            :key="id"
            class="flex items-center justify-center"
            :style="{
              flex: 1, padding: '9px 0', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: tab === id ? 'var(--card)' : 'transparent',
              color: tab === id ? 'var(--ink)' : 'var(--muted)',
              fontWeight: 600, fontSize: '13.5px',
              boxShadow: tab === id ? 'var(--sh-sm)' : 'none', gap: '7px',
            }"
            @click="tab = id"
          >
            <UiIcon :name="ic" :size="16" /> {{ lbl }}
          </button>
        </div>

        <div class="scroll-y" style="flex: 1; overflow-y: auto; min-height: 0">
          <!-- notes panel -->
          <NotesPanel v-if="tab === 'notes'" :lesson-id="active.id" />

          <!-- lesson list -->
          <div v-else class="flex flex-col" style="gap: 4px">
            <button
              v-for="(l, i) in lessons"
              :key="l.id"
              class="flex items-center text-left w-full"
              :style="{
                gap: '12px', padding: '11px 12px', borderRadius: '10px', border: 'none',
                cursor: 'pointer',
                background: active?.id === l.id ? 'var(--primary-soft)' : 'transparent',
                color: active?.id === l.id ? 'var(--primary-deep)' : 'var(--ink)',
              }"
              @click="pick(l)"
            >
              <span
                :style="{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: active?.id === l.id ? 'var(--primary)' : doneIds.has(l.id) ? 'var(--good-tint)' : 'var(--surface-2)',
                  color: active?.id === l.id ? '#fff' : doneIds.has(l.id) ? 'var(--good)' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                }"
              >
                <UiIcon v-if="doneIds.has(l.id) && active?.id !== l.id" name="check" :size="14" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <div style="flex: 1; min-width: 0">
                <div style="font-size: 13.5px; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                  {{ l.title }}
                </div>
                <div class="muted" style="font-size: 12px; margin-top: 2px">
                  {{ l.category || 'Хичээл' }}
                  <template v-if="fmtDur(l.duration_seconds)"> · {{ fmtDur(l.duration_seconds) }}</template>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

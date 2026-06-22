<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import { timeAgo } from '@/utils/time.js'

// Tone presets — shared visual language with the student dashboard card.
const TONES = {
  info:      { label: 'Мэдээлэл', icon: 'bell',  hue: 'var(--primary-deep)', tint: 'var(--primary-tint)' },
  important: { label: 'Чухал',    icon: 'flame', hue: 'var(--clay-deep)',    tint: 'var(--clay-tint)' },
  event:     { label: 'Эвент',    icon: 'spark', hue: 'var(--sage-deep)',    tint: 'var(--sage-tint)' },
}
const toneList = Object.entries(TONES).map(([id, t]) => ({ id, ...t }))

const items = ref([])
const loading = ref(true)
const expandedId = ref(null)
const saving = ref(null)

// New-announcement draft
const draft = ref({ tone: 'info', title: '', body: '', pinned: false })
const creating = ref(false)

let realtimeChannel = null

function sortItems(rows) {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at) - new Date(a.created_at)
  })
}

async function load() {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  items.value = sortItems(data ?? [])
  loading.value = false
}

onMounted(() => {
  load()
  realtimeChannel = supabase
    .channel('admin-announcements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})

const stats = computed(() => [
  { label: 'Идэвхтэй', value: items.value.filter((a) => a.is_published).length },
  { label: 'Бэхэлсэн', value: items.value.filter((a) => a.pinned).length },
  { label: 'Нийт', value: items.value.length },
])

async function createAnnouncement() {
  const body = draft.value.body.trim()
  if (!body) return
  creating.value = true
  const { error } = await supabase.from('announcements').insert({
    tone: draft.value.tone,
    title: draft.value.title.trim() || null,
    body,
    pinned: draft.value.pinned,
    is_published: true,
  })
  if (!error) draft.value = { tone: 'info', title: '', body: '', pinned: false }
  creating.value = false
  // realtime refetches; load() also covers admins with realtime disabled
  await load()
}

async function saveItem(item) {
  saving.value = item.id
  await supabase
    .from('announcements')
    .update({ tone: item.tone, title: item.title?.trim() || null, body: item.body, pinned: item.pinned })
    .eq('id', item.id)
  saving.value = null
}

async function togglePublish(item) {
  const next = !item.is_published
  const { error } = await supabase
    .from('announcements')
    .update({ is_published: next })
    .eq('id', item.id)
  if (!error) item.is_published = next
}

async function togglePin(item) {
  const next = !item.pinned
  const { error } = await supabase
    .from('announcements')
    .update({ pinned: next })
    .eq('id', item.id)
  if (!error) {
    item.pinned = next
    items.value = sortItems(items.value)
  }
}

async function remove(item) {
  if (!confirm(`Delete this announcement? Members will no longer see it.`)) return
  const { error } = await supabase.from('announcements').delete().eq('id', item.id)
  if (!error) items.value = items.value.filter((a) => a.id !== item.id)
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow" style="max-width: 800px">

      <!-- Composer -->
      <div class="card" style="border-radius: 16px; padding: 20px 22px; margin-bottom: 20px">
        <h3 style="font-size: 16px; margin-bottom: 4px">New announcement</h3>
        <p class="muted" style="font-size: 13px; margin-bottom: 16px">
          Posts instantly to every member's dashboard.
        </p>

        <!-- Tone -->
        <div class="flex flex-wrap" style="gap: 8px; margin-bottom: 14px">
          <button
            v-for="t in toneList"
            :key="t.id"
            class="flex items-center"
            :style="{
              gap: '7px',
              padding: '8px 13px',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 600,
              border: '1px solid ' + (draft.tone === t.id ? t.hue : 'var(--line)'),
              background: draft.tone === t.id ? t.tint : 'transparent',
              color: draft.tone === t.id ? t.hue : 'var(--ink-soft)',
              transition: 'all .15s',
            }"
            @click="draft.tone = t.id"
          >
            <UiIcon :name="t.icon" :size="15" /> {{ t.label }}
          </button>
        </div>

        <input
          v-model="draft.title"
          type="text"
          placeholder="Title (optional)"
          style="width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 15px; margin-bottom: 12px"
        />
        <textarea
          v-model="draft.body"
          class="textarea"
          rows="3"
          placeholder="Write your message to members…"
          style="width: 100%; font-size: 14.5px; margin-bottom: 14px"
        />

        <div class="flex items-center justify-between" style="gap: 12px; flex-wrap: wrap">
          <button
            class="flex items-center"
            :style="{
              gap: '8px',
              padding: '8px 13px',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 500,
              border: '1px solid ' + (draft.pinned ? 'var(--gold)' : 'var(--line)'),
              background: draft.pinned ? 'var(--gold-tint)' : 'transparent',
              color: draft.pinned ? 'var(--clay-deep)' : 'var(--ink-soft)',
            }"
            @click="draft.pinned = !draft.pinned"
          >
            <UiIcon name="star" :size="15" :fill="draft.pinned" /> {{ draft.pinned ? 'Pinned' : 'Pin to top' }}
          </button>
          <button class="btn btn-primary" :disabled="!draft.body.trim() || creating" @click="createAnnouncement">
            <UiIcon name="upload" :size="16" /> Post announcement
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="flex flex-wrap" style="gap: 12px; margin-bottom: 22px">
        <div
          v-for="s in stats"
          :key="s.label"
          class="card"
          style="padding: 14px 20px; border-radius: 14px; min-width: 110px"
        >
          <div style="font-family: var(--serif); font-weight: 700; font-size: 22px">{{ s.value }}</div>
          <div class="muted" style="font-size: 12.5px; margin-top: 2px">{{ s.label }}</div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="muted" style="text-align: center; padding: 40px 0; font-size: 14px">Loading…</div>

      <!-- Empty -->
      <div v-else-if="!items.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 40px 24px">
        <UiIcon name="bell" :size="36" style="color: var(--faint); margin-bottom: 10px" />
        <p class="muted" style="font-size: 14px">No announcements yet. Post one above.</p>
      </div>

      <!-- List -->
      <div v-else class="flex flex-col" style="gap: 12px; padding-bottom: 40px">
        <div
          v-for="item in items"
          :key="item.id"
          class="card"
          :style="{ borderRadius: '14px', overflow: 'hidden', opacity: item.is_published ? 1 : 0.6, transition: 'opacity .2s' }"
        >
          <!-- Header row -->
          <div class="flex items-start" style="padding: 16px 18px; gap: 13px">
            <div
              :style="{
                width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                background: TONES[item.tone]?.tint ?? 'var(--surface-2)',
                color: TONES[item.tone]?.hue ?? 'var(--ink-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }"
            >
              <UiIcon :name="TONES[item.tone]?.icon ?? 'bell'" :size="19" />
            </div>
            <div style="flex: 1; min-width: 0">
              <div class="flex items-center flex-wrap" style="gap: 8px; margin-bottom: 3px">
                <span v-if="item.pinned" style="color: var(--gold)"><UiIcon name="star" :size="14" fill /></span>
                <span style="font-weight: 600; font-size: 15px">{{ item.title || TONES[item.tone]?.label }}</span>
                <span
                  v-if="!item.is_published"
                  style="font-size: 11.5px; background: var(--surface-2); color: var(--ink-soft); border-radius: 6px; padding: 2px 8px"
                >Hidden</span>
              </div>
              <p style="font-size: 13.5px; color: var(--ink-soft); line-height: 1.55; white-space: pre-wrap">{{ item.body }}</p>
              <div class="muted" style="font-size: 12px; margin-top: 6px">{{ timeAgo(item.updated_at) }}</div>
            </div>
            <div class="flex flex-col items-end" style="gap: 6px; flex-shrink: 0">
              <button class="btn btn-ghost btn-sm" :style="item.pinned ? { color: 'var(--gold)' } : {}" @click="togglePin(item)">
                <UiIcon name="star" :size="14" :fill="item.pinned" />
              </button>
              <button class="btn btn-ghost btn-sm" :style="!item.is_published ? { color: 'var(--primary)' } : {}" @click="togglePublish(item)">
                <UiIcon :name="item.is_published ? 'eye' : 'upload'" :size="14" />
                {{ item.is_published ? 'Hide' : 'Show' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="expandedId = expandedId === item.id ? null : item.id">
                <UiIcon name="pen" :size="14" /> {{ expandedId === item.id ? 'Close' : 'Edit' }}
              </button>
            </div>
          </div>

          <!-- Editor -->
          <div v-if="expandedId === item.id" style="border-top: 1px solid var(--line); padding: 18px">
            <div class="flex flex-wrap" style="gap: 8px; margin-bottom: 14px">
              <button
                v-for="t in toneList"
                :key="t.id"
                class="flex items-center"
                :style="{
                  gap: '7px', padding: '7px 12px', borderRadius: '9px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600,
                  border: '1px solid ' + (item.tone === t.id ? t.hue : 'var(--line)'),
                  background: item.tone === t.id ? t.tint : 'transparent',
                  color: item.tone === t.id ? t.hue : 'var(--ink-soft)',
                }"
                @click="item.tone = t.id; saveItem(item)"
              >
                <UiIcon :name="t.icon" :size="14" /> {{ t.label }}
              </button>
            </div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">Title</label>
            <input
              v-model="item.title"
              type="text"
              placeholder="Title (optional)"
              style="width: 100%; padding: 10px 13px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 14.5px; margin-bottom: 12px"
              @blur="saveItem(item)"
            />
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">Message</label>
            <textarea
              v-model="item.body"
              class="textarea"
              rows="4"
              style="width: 100%; font-size: 14.5px; margin-bottom: 8px"
              @blur="saveItem(item)"
            />
            <div class="flex items-center justify-between">
              <button class="btn btn-ghost btn-sm" style="color: var(--clay)" @click="remove(item)">
                <UiIcon name="x" :size="14" /> Delete
              </button>
              <span v-if="saving === item.id" class="muted" style="font-size: 12px">Saving…</span>
              <span v-else class="muted" style="font-size: 12px">Saved on blur</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

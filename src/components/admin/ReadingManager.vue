<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { uploadPublicImage, getPublicImageUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import { timeAgo } from '@/utils/time.js'

const readings = ref([])
const loading = ref(true)
const expandedId = ref(null)
const creating = ref(false)
const newTitle = ref('')
const newIntro = ref('')
const savingPile = ref(null)
const uploadingPile = ref(null)

async function fetchReadings() {
  loading.value = true
  const { data } = await supabase
    .from('collective_readings')
    .select('*, reading_piles(*), reading_picks(id)')
    .order('created_at', { ascending: false })
  readings.value = (data ?? []).map((r) => ({
    ...r,
    reading_piles: (r.reading_piles ?? []).sort((a, b) => a.position - b.position),
  }))
  loading.value = false
}

onMounted(fetchReadings)

async function createReading() {
  const title = newTitle.value.trim()
  if (!title) return
  creating.value = true
  const { data: r, error } = await supabase
    .from('collective_readings')
    .insert({ title, intro: newIntro.value.trim() || null })
    .select()
    .single()
  if (!error && r) {
    const piles = [1, 2, 3].map((position) => ({ reading_id: r.id, position, label: `Pile ${position}` }))
    await supabase.from('reading_piles').insert(piles)
    newTitle.value = ''
    newIntro.value = ''
    await fetchReadings()
    expandedId.value = r.id
  }
  creating.value = false
}

async function saveReadingMeta(reading) {
  await supabase
    .from('collective_readings')
    .update({ title: reading.title, intro: reading.intro })
    .eq('id', reading.id)
}

async function togglePublish(reading) {
  const next = !reading.is_published
  const { error } = await supabase
    .from('collective_readings')
    .update({ is_published: next, published_at: next ? new Date().toISOString() : null })
    .eq('id', reading.id)
  if (!error) reading.is_published = next
}

async function deleteReading(reading) {
  if (!confirm(`Delete reading "${reading.title}"? This removes its piles and all picks.`)) return
  const { error } = await supabase.from('collective_readings').delete().eq('id', reading.id)
  if (!error) readings.value = readings.value.filter((r) => r.id !== reading.id)
}

async function savePile(pile) {
  savingPile.value = pile.id
  await supabase
    .from('reading_piles')
    .update({ label: pile.label, article: pile.article })
    .eq('id', pile.id)
  savingPile.value = null
}

async function onPileImage(pile, file) {
  if (!file) {
    pile.image_path = null
    await supabase.from('reading_piles').update({ image_path: null }).eq('id', pile.id)
    return
  }
  uploadingPile.value = pile.id
  const { path, error } = await uploadPublicImage(file, 'reading')
  if (!error && path) {
    pile.image_path = path
    await supabase.from('reading_piles').update({ image_path: path }).eq('id', pile.id)
  }
  uploadingPile.value = null
}
</script>

<template>
  <div>
    <!-- New reading -->
    <div class="card" style="border-radius: 16px; padding: 20px 22px; margin-bottom: 20px">
      <h3 style="font-size: 16px; margin-bottom: 14px">New collective reading</h3>
      <input
        v-model="newTitle"
        type="text"
        placeholder="Reading title — e.g. This week's energy"
        style="width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 15px; margin-bottom: 12px"
      />
      <textarea
        v-model="newIntro"
        class="textarea"
        rows="2"
        placeholder="Short intro shown above the piles (optional)…"
        style="width: 100%; font-size: 14.5px; margin-bottom: 14px"
      />
      <button class="btn btn-primary" :disabled="!newTitle.trim() || creating" @click="createReading">
        <UiIcon name="plus" :size="16" /> Create reading + 3 piles
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="muted" style="text-align: center; padding: 40px 0; font-size: 14px">Loading…</div>

    <!-- Empty -->
    <div v-else-if="!readings.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 40px 24px">
      <UiIcon name="spark" :size="36" style="color: var(--faint); margin-bottom: 10px" />
      <p class="muted" style="font-size: 14px">No readings yet. Create one above.</p>
    </div>

    <!-- Reading list -->
    <div v-else class="flex flex-col" style="gap: 14px; padding-bottom: 40px">
      <div
        v-for="reading in readings"
        :key="reading.id"
        class="card"
        style="border-radius: 16px; overflow: hidden"
      >
        <!-- Header row -->
        <div class="flex items-center" style="padding: 16px 18px; gap: 12px">
          <div style="flex: 1; min-width: 0">
            <div class="flex items-center flex-wrap" style="gap: 8px; margin-bottom: 3px">
              <span style="font-weight: 600; font-size: 15.5px">{{ reading.title }}</span>
              <span
                class="chip"
                :style="reading.is_published
                  ? { background: 'var(--primary-tint)', color: 'var(--primary-deep)', border: 'none', fontSize: '11.5px' }
                  : { background: 'var(--surface-2)', color: 'var(--ink-soft)', border: 'none', fontSize: '11.5px' }"
              >{{ reading.is_published ? 'Published' : 'Draft' }}</span>
            </div>
            <div class="muted" style="font-size: 12.5px">
              {{ reading.reading_picks?.length ?? 0 }} picks · {{ timeAgo(reading.created_at) }}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="togglePublish(reading)">
            <UiIcon :name="reading.is_published ? 'eye' : 'upload'" :size="14" />
            {{ reading.is_published ? 'Unpublish' : 'Publish' }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="expandedId = expandedId === reading.id ? null : reading.id">
            <UiIcon name="pen" :size="14" /> {{ expandedId === reading.id ? 'Close' : 'Edit' }}
          </button>
        </div>

        <!-- Editor -->
        <div v-if="expandedId === reading.id" style="border-top: 1px solid var(--line); padding: 18px">
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">Title</label>
          <input
            v-model="reading.title"
            type="text"
            style="width: 100%; padding: 10px 13px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 14.5px; margin-bottom: 12px"
            @blur="saveReadingMeta(reading)"
          />
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink-soft)">Intro</label>
          <textarea
            v-model="reading.intro"
            class="textarea"
            rows="2"
            style="width: 100%; font-size: 14.5px; margin-bottom: 18px"
            @blur="saveReadingMeta(reading)"
          />

          <!-- Piles -->
          <div class="pile-edit-grid">
            <div
              v-for="pile in reading.reading_piles"
              :key="pile.id"
              style="border: 1px solid var(--line); border-radius: 14px; padding: 14px; background: var(--surface-2)"
            >
              <div style="font-weight: 600; font-size: 13.5px; margin-bottom: 10px">Pile {{ pile.position }}</div>

              <div style="aspect-ratio: 2/3; margin-bottom: 10px; border-radius: 12px; overflow: hidden">
                <ImageSlot
                  :src="getPublicImageUrl(pile.image_path) || ''"
                  shape="rounded"
                  :radius="12"
                  placeholder="Pile image"
                  style="width: 100%; height: 100%"
                  @change="(f) => onPileImage(pile, f)"
                />
              </div>
              <div v-if="uploadingPile === pile.id" class="muted" style="font-size: 12px; margin-bottom: 8px">Uploading…</div>

              <input
                v-model="pile.label"
                type="text"
                placeholder="Label"
                style="width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid var(--line); background: var(--card); font-size: 13.5px; margin-bottom: 8px"
                @blur="savePile(pile)"
              />
              <textarea
                v-model="pile.article"
                class="textarea"
                rows="6"
                placeholder="Tarot reading article for this pile…"
                style="width: 100%; font-size: 13.5px; margin-bottom: 8px"
                @blur="savePile(pile)"
              />
              <div class="flex items-center justify-between">
                <span v-if="savingPile === pile.id" class="muted" style="font-size: 12px">Saving…</span>
                <span v-else class="muted" style="font-size: 12px">Saved on blur</span>
                <button class="btn btn-ghost btn-sm" @click="savePile(pile)">Save</button>
              </div>
            </div>
          </div>

          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line)">
            <button class="btn btn-ghost btn-sm" style="color: var(--clay)" @click="deleteReading(reading)">
              <UiIcon name="x" :size="14" /> Delete reading
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pile-edit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
@media (max-width: 720px) {
  .pile-edit-grid { grid-template-columns: 1fr; }
}
</style>

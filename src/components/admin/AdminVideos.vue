<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import UiIcon from '@/components/common/UiIcon.vue'
import {
  uploadThumbnailToStorage,
  uploadVideoToR2,
  uploadVideoToCloudflareStream,
  readVideoDuration,
  getThumbnailUrl,
  uploadIntroVideoToStorage,
  getIntroVideoPublicUrl,
} from '@/lib/videoUpload.js'

const STREAM_ENABLED = !!import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE

const { session } = useAuth()

// --- intro video ---
const introVideoPath = ref(null)
const introVideoFile = ref(null)
const introVideoPreview = ref(null)
const introSaving = ref(false)
const introError = ref('')
const introStatus = ref('')

const introVideoUrl = computed(() => {
  if (introVideoPreview.value) return introVideoPreview.value
  return getIntroVideoPublicUrl(introVideoPath.value)
})

async function loadIntroVideo() {
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'intro_video_path')
    .maybeSingle()
  introVideoPath.value = data?.value ?? null
}

function onIntroVideoChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  introVideoFile.value = f
  if (introVideoPreview.value) URL.revokeObjectURL(introVideoPreview.value)
  introVideoPreview.value = URL.createObjectURL(f)
}

async function saveIntroVideo() {
  if (!introVideoFile.value) return
  introSaving.value = true
  introError.value = ''
  introStatus.value = 'Видео байршуулж байна…'
  const r = await uploadIntroVideoToStorage(introVideoFile.value)
  if (r.error) {
    introError.value = r.error
    introSaving.value = false
    introStatus.value = ''
    return
  }
  introStatus.value = 'Тохиргоо хадгалж байна…'
  const { error: dbErr } = await supabase
    .from('site_settings')
    .upsert({ key: 'intro_video_path', value: r.path, updated_at: new Date().toISOString() })
  if (dbErr) {
    introError.value = dbErr.message
  } else {
    introVideoPath.value = r.path
    introVideoFile.value = null
    if (introVideoPreview.value) { URL.revokeObjectURL(introVideoPreview.value); introVideoPreview.value = null }
  }
  introSaving.value = false
  introStatus.value = ''
}

// --- lessons ---
const list = ref([])
const loading = ref(true)
const showForm = ref(false)
const editId = ref(null)
const saving = ref(false)
const formError = ref('')
const uploadStatus = ref('')
const confirmDel = ref(null)

const thumbFile = ref(null)
const thumbPreview = ref(null)
const desktopFile = ref(null)
const verticalFile = ref(null)

const blank = () => ({
  title: '',
  slug: '',
  description: '',
  category: '',
  sort_order: 0,
  is_published: false,
  duration_seconds: '',
  video_r2_key: '',
  video_r2_key_vertical: '',
  video_stream_uid: '',
  video_stream_uid_vertical: '',
  thumbnail_path: '',
  _orig_published_at: null,
})
const form = ref(blank())

const thumbDisplayUrl = computed(() => {
  if (thumbPreview.value) return thumbPreview.value
  return getThumbnailUrl(form.value.thumbnail_path)
})

const realtimeChannel = ref(null)

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('video_lessons')
    .select('id, slug, title, description, category, thumbnail_path, video_r2_key, video_r2_key_vertical, video_stream_uid, video_stream_uid_vertical, duration_seconds, sort_order, is_published, published_at')
    .order('sort_order', { ascending: true })
  list.value = data ?? []
  loading.value = false
}

function subscribeToLessons() {
  if (realtimeChannel.value) return
  realtimeChannel.value = supabase
    .channel('video_lessons_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'video_lessons' },
      () => {
        load()
      }
    )
    .subscribe()
}

function resetFiles() {
  thumbFile.value = null
  if (thumbPreview.value) URL.revokeObjectURL(thumbPreview.value)
  thumbPreview.value = null
  desktopFile.value = null
  verticalFile.value = null
}

function startAdd() {
  form.value = blank()
  editId.value = null
  showForm.value = true
  formError.value = ''
  uploadStatus.value = ''
  resetFiles()
}

function startEdit(v) {
  form.value = {
    title: v.title,
    slug: v.slug,
    description: v.description ?? '',
    category: v.category ?? '',
    sort_order: v.sort_order,
    is_published: v.is_published,
    duration_seconds: v.duration_seconds ?? '',
    video_r2_key: v.video_r2_key ?? '',
    video_r2_key_vertical: v.video_r2_key_vertical ?? '',
    video_stream_uid: v.video_stream_uid ?? '',
    video_stream_uid_vertical: v.video_stream_uid_vertical ?? '',
    thumbnail_path: v.thumbnail_path ?? '',
    _orig_published_at: v.published_at ?? null,
  }
  editId.value = v.id
  showForm.value = true
  formError.value = ''
  uploadStatus.value = ''
  resetFiles()
}

function cancel() {
  showForm.value = false
  formError.value = ''
  uploadStatus.value = ''
  resetFiles()
}

watch(() => form.value.title, (t) => {
  if (!editId.value) {
    form.value.slug = t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
  }
})

function onThumbChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  thumbFile.value = f
  if (thumbPreview.value) URL.revokeObjectURL(thumbPreview.value)
  thumbPreview.value = URL.createObjectURL(f)
}

async function onDesktopChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  desktopFile.value = f
  const dur = await readVideoDuration(f)
  if (dur != null) form.value.duration_seconds = dur
}

function onVerticalChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  verticalFile.value = f
}

async function save() {
  if (!form.value.title.trim() || !form.value.slug.trim()) {
    formError.value = 'Гарчиг болон slug шаардлагатай'
    return
  }
  if (!editId.value && !desktopFile.value) {
    formError.value = 'Desktop видео файл сонгоно уу'
    return
  }

  saving.value = true
  formError.value = ''
  const token = session.value?.access_token
  const slug = form.value.slug.trim()

  let thumbnailPath = form.value.thumbnail_path || null
  let desktopKey = form.value.video_r2_key || null
  let verticalKey = form.value.video_r2_key_vertical || null
  let desktopStreamUid = form.value.video_stream_uid || null
  let verticalStreamUid = form.value.video_stream_uid_vertical || null

  if (thumbFile.value) {
    uploadStatus.value = 'Thumbnail байршуулж байна…'
    const r = await uploadThumbnailToStorage(thumbFile.value, slug)
    if (r.error) { formError.value = r.error; saving.value = false; uploadStatus.value = ''; return }
    thumbnailPath = r.path
  }

  if (desktopFile.value) {
    if (STREAM_ENABLED) {
      uploadStatus.value = 'Desktop видео Cloudflare Stream руу байршуулж байна… 0%'
      const r = await uploadVideoToCloudflareStream(desktopFile.value, 'desktop', token, (p) => {
        uploadStatus.value = `Desktop видео Cloudflare Stream руу байршуулж байна… ${Math.round(p * 100)}%`
      })
      if (r.error) { formError.value = r.error; saving.value = false; uploadStatus.value = ''; return }
      desktopStreamUid = r.uid
      desktopKey = null
    } else {
      uploadStatus.value = 'Desktop видео байршуулж байна…'
      const r = await uploadVideoToR2(desktopFile.value, 'video-lessons', 'desktop', token)
      if (r.error) { formError.value = r.error; saving.value = false; uploadStatus.value = ''; return }
      desktopKey = r.key
    }
  }

  if (verticalFile.value) {
    if (STREAM_ENABLED) {
      uploadStatus.value = 'Босоо видео Cloudflare Stream руу байршуулж байна… 0%'
      const r = await uploadVideoToCloudflareStream(verticalFile.value, 'vertical', token, (p) => {
        uploadStatus.value = `Босоо видео Cloudflare Stream руу байршуулж байна… ${Math.round(p * 100)}%`
      })
      if (r.error) { formError.value = r.error; saving.value = false; uploadStatus.value = ''; return }
      verticalStreamUid = r.uid
      verticalKey = null
    } else {
      uploadStatus.value = 'Босоо видео байршуулж байна…'
      const r = await uploadVideoToR2(verticalFile.value, 'video-lessons', 'vertical', token)
      if (r.error) { formError.value = r.error; saving.value = false; uploadStatus.value = ''; return }
      verticalKey = r.key
    }
  }

  uploadStatus.value = ''

  if (!desktopKey && !desktopStreamUid) {
    formError.value = 'Видео байршуулах шаардлагатай'
    saving.value = false
    return
  }

  const published_at = form.value.is_published
    ? (form.value._orig_published_at || new Date().toISOString())
    : null

  const payload = {
    title: form.value.title.trim(),
    slug,
    description: form.value.description.trim() || null,
    category: form.value.category.trim() || null,
    thumbnail_path: thumbnailPath,
    video_r2_key: desktopKey,
    video_r2_key_vertical: verticalKey,
    video_stream_uid: desktopStreamUid,
    video_stream_uid_vertical: verticalStreamUid,
    duration_seconds: form.value.duration_seconds ? Number(form.value.duration_seconds) : null,
    sort_order: Number(form.value.sort_order) || 0,
    is_published: form.value.is_published,
    published_at,
    updated_at: new Date().toISOString(),
  }

  const { error: err } = editId.value
    ? await supabase.from('video_lessons').update(payload).eq('id', editId.value)
    : await supabase.from('video_lessons').insert(payload)

  if (err) {
    formError.value = err.message
  } else {
    showForm.value = false
    resetFiles()
    await load()
  }
  saving.value = false
}

async function togglePublish(v) {
  const now = new Date().toISOString()
  await supabase.from('video_lessons').update({
    is_published: !v.is_published,
    published_at: !v.is_published ? now : null,
    updated_at: now,
  }).eq('id', v.id)
  await load()
}

async function del(id) {
  await supabase.from('video_lessons').delete().eq('id', id)
  confirmDel.value = null
  await load()
}

function fmtDur(s) {
  if (!s) return '—'
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function keyBasename(key) {
  if (!key) return null
  return key.split('/').pop() ?? key
}

onMounted(() => { load(); loadIntroVideo(); subscribeToLessons() })

onBeforeUnmount(() => {
  if (realtimeChannel.value) {
    supabase.removeChannel(realtimeChannel.value)
    realtimeChannel.value = null
  }
})
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 72px); overflow-y: auto">
    <div class="page-inset">
      <!-- landing intro video -->
      <div class="card card-pad" style="border-radius: 16px; margin-bottom: 28px">
        <h3 style="font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
          <UiIcon name="video" :size="18" style="opacity: 0.6" /> Нүүр хуудасны танилцуулга видео
        </h3>
        <div class="flex items-start" style="gap: 16px; flex-wrap: wrap">
          <div style="flex-shrink: 0">
            <video
              v-if="introVideoUrl"
              :src="introVideoUrl"
              style="width: 220px; aspect-ratio: 16/9; border-radius: 10px; background: #0c1d25; object-fit: cover; display: block"
              muted
              preload="metadata"
            />
            <div
              v-else
              style="width: 220px; aspect-ratio: 16/9; border-radius: 10px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; opacity: 0.4"
            >
              <UiIcon name="video" :size="32" />
            </div>
          </div>
          <div style="flex: 1; min-width: 220px">
            <p class="muted" style="font-size: 13px; margin-bottom: 10px">
              Нүүр хуудасны "Танилцуулга" хэсэгт тавигдах видео. Нийтэд харагдана.
            </p>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              class="input"
              style="padding: 6px; margin-bottom: 8px"
              @change="onIntroVideoChange"
            />
            <p v-if="introVideoFile" class="muted" style="font-size: 12px; margin-bottom: 10px">
              Сонгосон: {{ introVideoFile.name }} ({{ (introVideoFile.size / 1024 / 1024).toFixed(1) }} MB)
            </p>
            <div v-if="introStatus" style="font-size: 13px; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px">
              <UiIcon name="clock" :size="14" style="opacity: 0.6" /> {{ introStatus }}
            </div>
            <div v-if="introError" style="color: var(--bad); font-size: 13px; margin-bottom: 8px">{{ introError }}</div>
            <button
              class="btn btn-primary btn-sm"
              :disabled="!introVideoFile || introSaving"
              @click="saveIntroVideo"
            >
              {{ introSaving ? 'Хадгалж байна…' : 'Хадгалах' }}
            </button>
          </div>
        </div>
      </div>

      <!-- header -->
      <div class="flex items-center justify-between" style="margin-bottom: 24px">
        <div>
          <h2 style="font-size: 22px">Видео хичээлүүд</h2>
          <p class="muted" style="font-size: 14px; margin-top: 4px">{{ list.length }} хичээл нийт</p>
        </div>
        <button class="btn btn-primary btn-sm" @click="startAdd">
          <UiIcon name="plus" :size="16" /> Хичээл нэмэх
        </button>
      </div>

      <!-- form -->
      <div v-if="showForm" class="card card-pad" style="border-radius: 16px; margin-bottom: 24px">
        <h3 style="font-size: 17px; margin-bottom: 20px">{{ editId ? 'Хичээл засварлах' : 'Шинэ хичээл' }}</h3>

        <div class="admin-videos-form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px">
          <div class="field">
            <label>Гарчиг *</label>
            <input v-model="form.title" class="input" placeholder="Хичээлийн гарчиг" />
          </div>
          <div class="field">
            <label>Slug *</label>
            <input v-model="form.slug" class="input" placeholder="hichiyeliin-slug" />
          </div>
          <div class="field">
            <label>Ангилал</label>
            <input v-model="form.category" class="input" placeholder="Spirituality, Psychology …" />
          </div>
          <div class="field">
            <label>Үргэлжлэх хугацаа (секунд)</label>
            <input v-model="form.duration_seconds" class="input" type="number" min="0" placeholder="Видеоноос автоматаар уншина" />
          </div>
          <div class="field">
            <label>Дараалал (sort_order)</label>
            <input v-model="form.sort_order" class="input" type="number" min="0" placeholder="0" />
          </div>
        </div>

        <div class="field" style="margin-bottom: 14px">
          <label>Тайлбар</label>
          <textarea v-model="form.description" class="input textarea" rows="3" placeholder="Хичээлийн товч тайлбар…" style="resize: vertical" />
        </div>

        <!-- thumbnail -->
        <div class="field" style="margin-bottom: 14px">
          <label>Thumbnail зураг (JPEG/PNG/WebP, 3 MB хүртэл)</label>
          <div class="flex items-start" style="gap: 14px">
            <div
              v-if="thumbDisplayUrl"
              style="width: 140px; height: 78px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: var(--surface-2)"
            >
              <img :src="thumbDisplayUrl" style="width: 100%; height: 100%; object-fit: cover" alt="" />
            </div>
            <div
              v-else
              style="width: 140px; height: 78px; border-radius: 8px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0"
            >
              <UiIcon name="image" :size="24" style="opacity: 0.3" />
            </div>
            <div style="flex: 1">
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" class="input" style="padding: 6px" @change="onThumbChange" />
              <p v-if="form.thumbnail_path && !thumbFile" class="muted" style="font-size: 12px; margin-top: 5px">
                Одоогийн: {{ keyBasename(form.thumbnail_path) }}
              </p>
            </div>
          </div>
        </div>

        <!-- desktop video -->
        <div class="field" style="margin-bottom: 14px">
          <label>Desktop видео — 16:9{{ !editId ? ' (шаардлагатай)' : '' }}</label>
          <input type="file" accept="video/mp4,video/webm,video/quicktime" class="input" style="padding: 6px" @change="onDesktopChange" />
          <p v-if="desktopFile" class="muted" style="font-size: 12px; margin-top: 5px">
            Сонгосон: {{ desktopFile.name }} ({{ (desktopFile.size / 1024 / 1024).toFixed(1) }} MB)
          </p>
          <p v-else-if="form.video_r2_key" class="muted" style="font-size: 12px; margin-top: 5px">
            Одоогийн: {{ keyBasename(form.video_r2_key) }}
          </p>
        </div>

        <!-- vertical video -->
        <div class="field" style="margin-bottom: 16px">
          <label>Босоо видео — 9:16 (заавал биш)</label>
          <input type="file" accept="video/mp4,video/webm,video/quicktime" class="input" style="padding: 6px" @change="onVerticalChange" />
          <p v-if="verticalFile" class="muted" style="font-size: 12px; margin-top: 5px">
            Сонгосон: {{ verticalFile.name }} ({{ (verticalFile.size / 1024 / 1024).toFixed(1) }} MB)
          </p>
          <p v-else-if="form.video_r2_key_vertical" class="muted" style="font-size: 12px; margin-top: 5px">
            Одоогийн: {{ keyBasename(form.video_r2_key_vertical) }}
          </p>
        </div>

        <label class="flex items-center" style="gap: 10px; cursor: pointer; font-size: 14px; margin-bottom: 16px">
          <input type="checkbox" v-model="form.is_published" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--sage-deep)" />
          Нийтлэх — идэвхтэй гишүүд харах боломжтой
        </label>

        <div v-if="uploadStatus" style="font-size: 13.5px; color: var(--muted); margin-bottom: 12px; display: flex; align-items: center; gap: 8px">
          <UiIcon name="clock" :size="15" style="opacity: 0.6" />
          {{ uploadStatus }}
        </div>

        <div v-if="formError" style="color: var(--bad); font-size: 13.5px; margin-bottom: 14px">{{ formError }}</div>

        <div class="flex items-center" style="gap: 10px">
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            {{ saving ? (uploadStatus || 'Хадгалж байна…') : 'Хадгалах' }}
          </button>
          <button class="btn btn-ghost btn-sm" :disabled="saving" @click="cancel">Болих</button>
        </div>
      </div>

      <!-- loading -->
      <div v-if="loading" style="padding: 48px; text-align: center; color: var(--muted)">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
        Уншиж байна…
      </div>

      <!-- empty -->
      <div v-else-if="!list.length && !showForm" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)">
        <UiIcon name="video" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
        <p style="margin-bottom: 18px; font-size: 15px">Видео хичээл байхгүй байна.</p>
        <button class="btn btn-primary btn-sm" style="margin: 0 auto" @click="startAdd">
          <UiIcon name="plus" :size="16" /> Эхний хичээлийг нэмэх
        </button>
      </div>

      <!-- table -->
      <div v-else-if="list.length" class="card" style="border-radius: 16px; overflow: hidden">
        <div
          class="admin-videos-header"
          style="border-bottom: 1px solid var(--line); padding: 10px 20px; background: var(--surface-2);
                 display: grid; grid-template-columns: 56px 1fr 130px 90px 110px 110px;
                 gap: 12px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase"
        >
          <span></span>
          <span>Гарчиг</span>
          <span>Ангилал</span>
          <span>Хугацаа</span>
          <span>Статус</span>
          <span style="text-align: right">Үйлдэл</span>
        </div>
        <div
          v-for="v in list"
          :key="v.id"
          class="admin-videos-entry"
          style="display: grid; grid-template-columns: 56px 1fr 130px 90px 110px 110px;
                 gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--line-soft); align-items: center"
        >
          <div style="width: 56px; height: 32px; border-radius: 5px; overflow: hidden; background: var(--surface-2); flex-shrink: 0">
            <img
              v-if="getThumbnailUrl(v.thumbnail_path)"
              :src="getThumbnailUrl(v.thumbnail_path)"
              style="width: 100%; height: 100%; object-fit: cover"
              alt=""
            />
            <div v-else style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.3">
              <UiIcon name="video" :size="16" />
            </div>
          </div>

          <div>
            <div style="font-weight: 600; font-size: 14.5px">{{ v.title }}</div>
            <div class="muted" style="font-size: 12px; margin-top: 2px; display: flex; gap: 8px; align-items: center">
              <span>{{ v.slug }}</span>
              <span v-if="v.video_r2_key_vertical" style="opacity: 0.6; font-size: 11px">9:16 ✓</span>
            </div>
          </div>

          <span class="muted" style="font-size: 13px">{{ v.category || '—' }}</span>
          <span class="muted" style="font-size: 13px; font-variant-numeric: tabular-nums">{{ fmtDur(v.duration_seconds) }}</span>

          <button
            :class="v.is_published ? 'chip good' : 'chip'"
            style="cursor: pointer; border: none; font-size: 12px; white-space: nowrap"
            :title="v.is_published ? 'Харагдалтаас хасах' : 'Нийтлэх'"
            @click="togglePublish(v)"
          >
            {{ v.is_published ? 'Нийтэлсэн' : 'Хаалттай' }}
          </button>

          <div class="flex items-center justify-end" style="gap: 6px">
            <button class="btn btn-ghost btn-sm" style="padding: 8px" title="Засварлах" @click="startEdit(v)">
              <UiIcon name="pen" :size="15" />
            </button>
            <button
              class="btn btn-ghost btn-sm"
              style="padding: 8px; color: var(--bad); border-color: var(--bad-tint)"
              title="Устгах"
              @click="confirmDel = v.id"
            >
              <UiIcon name="x" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- confirm delete -->
    <div
      v-if="confirmDel"
      style="position: fixed; inset: 0; background: rgba(22,49,63,0.45); display: flex; align-items: center; justify-content: center; z-index: 200"
      @click.self="confirmDel = null"
    >
      <div class="card card-pad" style="border-radius: 18px; max-width: 380px; width: 90%">
        <h3 style="font-size: 18px; margin-bottom: 10px">Устгах уу?</h3>
        <p class="muted" style="font-size: 14px; margin-bottom: 22px; line-height: 1.5">
          Энэ хичээлийг устгах бол буцааж сэргээх боломжгүй.
        </p>
        <div class="flex items-center" style="gap: 10px">
          <button class="btn btn-sm" style="background: var(--bad); color: #fff" @click="del(confirmDel)">
            <UiIcon name="x" :size="15" /> Устгах
          </button>
          <button class="btn btn-ghost btn-sm" @click="confirmDel = null">Болих</button>
        </div>
      </div>
    </div>
  </div>
</template>

import { supabase } from '@/lib/supabase.js'

const THUMBNAILS_BUCKET = 'media-thumbnails'
const INTRO_BUCKET = 'media-public'

export function getThumbnailUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

export function getIntroVideoPublicUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(INTRO_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

export async function uploadThumbnailToStorage(file, slug) {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${slug}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(THUMBNAILS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  if (error) return { error: error.message }
  return { path }
}

export async function uploadIntroVideoToStorage(file) {
  const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase()
  const path = `intro-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(INTRO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  if (error) return { error: error.message }
  return { path }
}

function inferVideoContentType(file) {
  if (file.type) return file.type
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const map = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4' }
  return map[ext] ?? 'video/mp4'
}

export async function uploadVideoToR2(file, _bucket, variant, token) {
  const contentType = inferVideoContentType(file)

  const { data, error } = await supabase.functions.invoke('upload-video', {
    body: { filename: file.name, contentType, variant },
    headers: { Authorization: `Bearer ${token}` },
  })

  if (error) return { error: data?.error ?? error.message }
  if (data?.error) return { error: data.error }
  if (!data?.uploadUrl || !data?.key) return { error: 'presign_failed' }

  try {
    const res = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    })
    if (!res.ok) return { error: `R2 upload failed: ${res.status}` }
  } catch (err) {
    return { error: err?.message ?? 'R2 upload failed' }
  }

  return { key: data.key }
}

export async function getPresignDownloadUrl(lessonId, token, variant = 'desktop') {
  const res = await fetch('/api/get-video-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lessonId, variant }),
  })
  let data = null
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) return { error: data?.error ?? `HTTP ${res.status}` }
  return { url: data?.url ?? null }
}

export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(isFinite(video.duration) ? Math.round(video.duration) : null)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

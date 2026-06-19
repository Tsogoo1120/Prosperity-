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

export function getPublicImageUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(INTRO_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

export async function uploadPublicImage(file, prefix = 'reading') {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(INTRO_BUCKET)
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
    const headers = { 'Content-Type': contentType }
    if (data.cacheControl) headers['Cache-Control'] = data.cacheControl
    const res = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers,
    })
    if (!res.ok) return { error: `R2 upload failed: ${res.status}` }
  } catch (err) {
    const msg = err?.message ?? 'R2 upload failed'
    if (/failed to fetch|cors/i.test(msg)) {
      return { error: 'R2 CORS blocked: add CORS rule on union-videos bucket for this site origin (GET, PUT, HEAD)' }
    }
    return { error: msg }
  }

  return { key: data.key }
}

export async function uploadVideoToCloudflareStream(file, variant, token, onProgress) {
  const { data, error } = await supabase.functions.invoke('stream-upload-url', {
    body: { filename: file.name, variant },
    headers: { Authorization: `Bearer ${token}` },
  })
  let contextBody = null
  if (error?.context) {
    try {
      contextBody = error.context.clone ? await error.context.clone().json() : null
    } catch { contextBody = null }
  }

  if (error) return { error: data?.error ?? contextBody?.error ?? error.message }
  if (data?.error) return { error: data.error }
  if (!data?.uploadURL || !data?.uid) return { error: 'stream_presign_failed' }

  const form = new FormData()
  form.append('file', file)

  try {
    if (typeof XMLHttpRequest !== 'undefined' && onProgress) {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', data.uploadURL)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total)
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Stream upload failed: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Stream upload failed: network'))
        xhr.send(form)
      })
    } else {
      const res = await fetch(data.uploadURL, { method: 'POST', body: form })
      if (!res.ok) return { error: `Stream upload failed: ${res.status}` }
    }
  } catch (err) {
    return { error: err?.message ?? 'Stream upload failed' }
  }

  return { uid: data.uid }
}

export function getStreamIframeUrl(uid) {
  const code = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!uid || !code) return null
  return `https://customer-${code}.cloudflarestream.com/${uid}/iframe`
}

export function getStreamHlsUrl(uid) {
  const code = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!uid || !code) return null
  return `https://customer-${code}.cloudflarestream.com/${uid}/manifest/video.m3u8`
}

export function getStreamThumbnailUrl(uid) {
  const code = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!uid || !code) return null
  return `https://customer-${code}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`
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

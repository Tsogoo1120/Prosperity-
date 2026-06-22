import * as tus from 'tus-js-client'
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

const R2_CDN_BASE = 'https://cdn.tsogoo.site'

// Public CDN URL for an R2 video key (same scheme lesson playback uses).
export function getR2VideoUrl(key) {
  if (!key) return null
  if (/^https?:\/\//.test(key)) return key
  return `${R2_CDN_BASE}/${key}`
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

// tus PATCH chunk size. MUST be a multiple of 256 KiB and >= 5 MiB
// (Cloudflare Stream requirement). We use the 5 MiB minimum: on mobile the
// uplink is slow and drops often (cell handoffs, tunnels, the tab being
// backgrounded), so the smaller each chunk is, the more likely it finishes
// inside one "up" window — and on retry there is less data to re-send. CF
// recommends 50 MiB only for "reliable connections" (desktop wifi); one size
// has to serve both and the small one barely dents desktop throughput while
// being what lets the upload survive cellular.
const STREAM_CHUNK_SIZE = 5 * 1024 * 1024 // 5 MiB = 20 * 256 KiB (CF minimum)

// Pull a human-readable reason out of a tus DetailedError. tus's own
// err.message is opaque ("tus: failed to upload chunk …"); the actionable
// detail is the HTTP status + body of the failed PATCH/POST to Cloudflare.
function describeTusError(err) {
  const res = err?.originalResponse
  if (res) {
    const status = typeof res.getStatus === 'function' ? res.getStatus() : ''
    let body = ''
    try { body = (typeof res.getBody === 'function' ? res.getBody() : '') || '' } catch { body = '' }
    body = String(body).slice(0, 300)
    if (status || body) return `Stream upload failed (HTTP ${status || '?'})${body ? `: ${body}` : ''}`
  }
  const msg = err?.message || 'Stream upload failed'
  if (/load failed|network|failed to fetch/i.test(msg)) {
    return 'Stream upload failed: network dropped mid-upload. Стабиль интернэтээр дахин оролдоно уу.'
  }
  return msg
}

export async function uploadVideoToCloudflareStream(file, variant, token, onProgress) {
  // Some mobile pickers (iCloud / Google Drive files not yet downloaded
  // locally) hand back a 0-byte File. tus would stall forever — fail fast.
  if (!file || !file.size) {
    return { error: 'Файл хоосон байна. Видеог төхөөрөмж рүүгээ татаж аваад дахин сонгоно уу.' }
  }

  const { data, error } = await supabase.functions.invoke('stream-upload-url', {
    body: { filename: file.name, variant, size: file.size },
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

  // Resumable (tus) upload to the Cloudflare-provided one-time URL. tus is
  // required above Cloudflare's 200 MB single-POST cap.
  try {
    await new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        uploadUrl: data.uploadURL, // CF returned a pre-created tus resource
        chunkSize: STREAM_CHUNK_SIZE,
        // Cellular drops connections far more than wifi. Give tus many attempts
        // with long backoff so a 30–60s dead spot (elevator, tunnel, switching
        // apps) does not abort the whole upload — on each retry tus does a HEAD
        // to read the server's offset and resumes from there, not from 0.
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 60000],
        // We always presign a fresh one-time URL, so there is nothing to resume
        // across reloads. Disabling fingerprint storage avoids a localStorage
        // write that throws in iOS Safari Private Mode and aborts the upload.
        storeFingerprintForResuming: false,
        // tus's default policy stops retrying on several errors that are in
        // fact transient on mobile. Retry every network drop (no HTTP response)
        // and every transient/server status; only give up on real client
        // errors (bad request, auth, expired URL) that a retry cannot fix.
        onShouldRetry(err) {
          const status = err?.originalResponse?.getStatus?.() ?? 0
          if (status === 0) return true // network drop — always retry
          if (status === 409 || status === 423 || status === 429) return true
          return status >= 500
        },
        metadata: { name: file.name, filetype: file.type || 'video/mp4' },
        onProgress: (sent, total) => { if (onProgress) onProgress(sent / total) },
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      })
      upload.start()
    })
  } catch (err) {
    return { error: describeTusError(err) }
  }

  return { uid: data.uid }
}

export function getStreamIframeUrl(uid) {
  const code = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!uid || !code) return null
  return `https://customer-${code}.cloudflarestream.com/${uid}/iframe`
}

// Auto-generated poster frame for a Stream video — used as a thumbnail fallback
// when a lesson has no explicit thumbnail_path uploaded.
export function getStreamThumbnailUrl(uid) {
  const code = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!uid || !code) return null
  return `https://customer-${code}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`
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

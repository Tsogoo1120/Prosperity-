import { supabase } from '@/lib/supabase.js'

const THUMBNAILS_BUCKET = 'thumbnails'
const INTRO_BUCKET = 'intro-videos'

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

export async function uploadVideoToR2(file, _bucket, variant, token) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('variant', variant)

  const { data, error } = await supabase.functions.invoke('upload-video', {
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) return { error: error.message }
  return { key: data?.key ?? null }
}

export async function getPresignDownloadUrl(lessonId, token, variant = 'desktop') {
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f0e9bf'},body:JSON.stringify({sessionId:'f0e9bf',location:'videoUpload.js:getPresignDownloadUrl:entry',message:'Fetching presigned URL via same-origin API',data:{lessonId,variant,hasToken:!!token,apiPath:'/api/get-video-url'},timestamp:Date.now(),hypothesisId:'A,D'})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f0e9bf'},body:JSON.stringify({sessionId:'f0e9bf',location:'videoUpload.js:getPresignDownloadUrl:result',message:'API response received',data:{status:res.status,ok:res.ok,dataError:data?.error??null,hasUrl:!!data?.url},timestamp:Date.now(),hypothesisId:'D,E'})}).catch(()=>{});
  // #endregion
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

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
  const useDevApi = import.meta.env.DEV
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b137'},body:JSON.stringify({sessionId:'00b137',location:'videoUpload.js:getPresignDownloadUrl:entry',message:'Resolving video URL',data:{lessonId,variant,hasToken:!!token,useDevApi},timestamp:Date.now(),hypothesisId:'A,F'})}).catch(()=>{});
  // #endregion

  if (useDevApi) {
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
    fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b137'},body:JSON.stringify({sessionId:'00b137',location:'videoUpload.js:getPresignDownloadUrl:devResult',message:'Dev API response',data:{status:res.status,ok:res.ok,dataError:data?.error??null,hasUrl:!!data?.url},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (!res.ok) return { error: data?.error ?? `HTTP ${res.status}` }
    return { url: data?.url ?? null }
  }

  const { data, error } = await supabase.functions.invoke('get-video-url', {
    body: { lessonId, variant },
    headers: { Authorization: `Bearer ${token}` },
  })
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b137'},body:JSON.stringify({sessionId:'00b137',location:'videoUpload.js:getPresignDownloadUrl:edgeResult',message:'Edge function response',data:{hasError:!!error,errorMessage:error?.message??null,dataError:data?.error??null,hasUrl:!!data?.url},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (error) return { error: data?.error ?? error.message }
  if (data?.error) return { error: data.error }
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

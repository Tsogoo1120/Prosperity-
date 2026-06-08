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

  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'daec39'},body:JSON.stringify({sessionId:'daec39',location:'videoUpload.js:r2-presign',message:'upload-video presign result',data:{hasError:!!error,errorMessage:error?.message,dataError:data?.error,hasUploadUrl:!!data?.uploadUrl,origin:typeof location!=='undefined'?location.origin:null},timestamp:Date.now(),hypothesisId:'R2-A'})}).catch(()=>{});
  // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'daec39'},body:JSON.stringify({sessionId:'daec39',location:'videoUpload.js:r2-put',message:'R2 PUT result',data:{ok:res.ok,status:res.status,origin:typeof location!=='undefined'?location.origin:null},timestamp:Date.now(),hypothesisId:'R2-B'})}).catch(()=>{});
    // #endregion
    if (!res.ok) return { error: `R2 upload failed: ${res.status}` }
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'daec39'},body:JSON.stringify({sessionId:'daec39',location:'videoUpload.js:r2-put-catch',message:'R2 PUT failed',data:{errorMessage:err?.message,origin:typeof location!=='undefined'?location.origin:null},timestamp:Date.now(),hypothesisId:'R2-C'})}).catch(()=>{});
    // #endregion
    const msg = err?.message ?? 'R2 upload failed'
    if (/failed to fetch|cors/i.test(msg)) {
      return { error: 'R2 CORS blocked: add CORS rule on union-videos bucket for this site origin (GET, PUT, HEAD)' }
    }
    return { error: msg }
  }

  return { key: data.key }
}

export async function uploadVideoToCloudflareStream(file, variant, token, onProgress) {
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'daec39'},body:JSON.stringify({sessionId:'daec39',location:'videoUpload.js:invoke-start',message:'stream-upload-url invoke start',data:{variant,hasToken:!!token,filename:file?.name,fileSize:file?.size},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase.functions.invoke('stream-upload-url', {
    body: { filename: file.name, variant },
    headers: { Authorization: `Bearer ${token}` },
  })
  // #region agent log
  let contextBody = null
  if (error?.context) {
    try {
      const cloned = error.context.clone ? await error.context.clone().json() : null
      contextBody = cloned
    } catch { contextBody = 'parse_failed' }
  }
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'daec39'},body:JSON.stringify({sessionId:'daec39',location:'videoUpload.js:invoke-result',message:'stream-upload-url invoke result',data:{hasError:!!error,errorMessage:error?.message,errorName:error?.name,dataError:data?.error,dataKeys:data?Object.keys(data):[],contextStatus:error?.context?.status,contextBody},timestamp:Date.now(),hypothesisId:'A,B,C,D'})}).catch(()=>{});
  // #endregion

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

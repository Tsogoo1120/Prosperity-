import { supabase } from '@/lib/supabase.js'

const THUMBNAILS_BUCKET = 'media-thumbnails'
const INTRO_BUCKET = 'media-public'

export function getThumbnailUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path)
  const publicUrl = data?.publicUrl ?? null
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5414d7'},body:JSON.stringify({sessionId:'5414d7',location:'videoUpload.js:getThumbnailUrl',message:'Built thumbnail public URL',data:{path,bucket:THUMBNAILS_BUCKET,publicUrl},timestamp:Date.now(),hypothesisId:'H3,H4'})}).catch(()=>{});
  // #endregion
  return publicUrl
}

export function getIntroVideoPublicUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(INTRO_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

export async function uploadThumbnailToStorage(file, slug) {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${slug}-${Date.now()}.${ext}`
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5414d7'},body:JSON.stringify({sessionId:'5414d7',location:'videoUpload.js:thumbUploadStart',message:'Starting thumbnail upload',data:{slug,path,ext,fileType:file.type,fileSize:file.size,fileName:file.name},timestamp:Date.now(),hypothesisId:'H1,H2,H3'})}).catch(()=>{});
  // #endregion
  const { data: uploadData, error } = await supabase.storage
    .from(THUMBNAILS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5414d7'},body:JSON.stringify({sessionId:'5414d7',location:'videoUpload.js:thumbUploadResult',message:'Thumbnail upload response',data:{path,hasError:!!error,errorMsg:error?.message,errorStatus:error?.statusCode,uploadedPath:uploadData?.path,fullPath:uploadData?.fullPath},timestamp:Date.now(),hypothesisId:'H1,H3'})}).catch(()=>{});
  // #endregion
  if (error) return { error: error.message }
  const publicUrl = getThumbnailUrl(path)
  if (publicUrl) {
    try {
      const probe = await fetch(publicUrl, { method: 'HEAD' })
      // #region agent log
      fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5414d7'},body:JSON.stringify({sessionId:'5414d7',location:'videoUpload.js:thumbProbe',message:'HEAD probe on uploaded thumbnail',data:{path,publicUrl,status:probe.status,ok:probe.ok,contentType:probe.headers.get('content-type')},timestamp:Date.now(),hypothesisId:'H2,H5'})}).catch(()=>{});
      // #endregion
    } catch (probeErr) {
      // #region agent log
      fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5414d7'},body:JSON.stringify({sessionId:'5414d7',location:'videoUpload.js:thumbProbeError',message:'HEAD probe threw',data:{path,publicUrl,errorMessage:probeErr?.message},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
    }
  }
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

  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b8d68b'},body:JSON.stringify({sessionId:'b8d68b',location:'videoUpload.js:presignStart',message:'Starting presign request',data:{variant,contentType,fileName:file.name,fileSize:file.size,hasToken:!!token},timestamp:Date.now(),hypothesisId:'B,C,E'})}).catch(()=>{});
  // #endregion

  // Step 1: get presigned PUT URL from edge function (small JSON request, no file transfer)
  const { data, error } = await supabase.functions.invoke('upload-video', {
    body: { filename: file.name, contentType, variant },
    headers: { Authorization: `Bearer ${token}` },
  })

  // #region agent log
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b8d68b'},body:JSON.stringify({sessionId:'b8d68b',location:'videoUpload.js:presignResult',message:'Presign response',data:{hasError:!!error,errorMsg:error?.message,dataError:data?.error,hasUploadUrl:!!data?.uploadUrl,hasKey:!!data?.key},timestamp:Date.now(),hypothesisId:'B,C,E'})}).catch(()=>{});
  // #endregion

  if (error) return { error: data?.error ?? error.message }
  if (data?.error) return { error: data.error }
  if (!data?.uploadUrl || !data?.key) return { error: 'presign_failed' }

  // Step 2: upload file directly to R2 using the presigned URL (no size limit)
  try {
    const res = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    })

    // #region agent log
    fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b8d68b'},body:JSON.stringify({sessionId:'b8d68b',location:'videoUpload.js:r2PutResult',message:'R2 PUT response',data:{status:res.status,ok:res.ok,variant},timestamp:Date.now(),hypothesisId:'A,D'})}).catch(()=>{});
    // #endregion

    if (!res.ok) return { error: `R2 upload failed: ${res.status}` }
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b8d68b'},body:JSON.stringify({sessionId:'b8d68b',location:'videoUpload.js:r2PutError',message:'R2 PUT threw',data:{errorName:err?.name,errorMessage:err?.message,variant},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

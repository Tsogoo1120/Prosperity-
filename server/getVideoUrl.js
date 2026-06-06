import { createClient } from '@supabase/supabase-js'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function canAccessSubscriberContent(profile) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  if (profile.subscription_status === 'active') {
    if (!profile.subscription_expires_at) return true
    return new Date(profile.subscription_expires_at) > new Date()
  }
  return false
}

function getR2Client(env) {
  const accountId = env.R2_ACCOUNT_ID
  const endpoint = env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

function supabaseEnv(env) {
  return {
    url: env.VITE_SUPABASE_URL ?? env.SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

async function requireUser(authorization, env) {
  if (!authorization) return { error: 'not_authenticated', status: 401 }

  const { url, anonKey, serviceKey } = supabaseEnv(env)
  if (!url || !anonKey || !serviceKey) return { error: 'server_misconfigured', status: 500 }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(url, serviceKey)
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return { error: 'not_authenticated', status: 401 }
  return { user, admin }
}

async function presignDownload(env, key) {
  const client = getR2Client(env)
  const bucket = env.R2_BUCKET ?? 'union-videos'
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(client, cmd, { expiresIn: 3600 })
}

export async function resolveGetVideoUrl({ authorization, body }, env) {
  // #region agent log
  try{const fs=await import('node:fs');fs.appendFileSync('debug-f0e9bf.log',JSON.stringify({sessionId:'f0e9bf',location:'getVideoUrl.js:resolveGetVideoUrl:entry',message:'Resolving video URL',data:{hasAuth:!!authorization,lessonId:body?.lessonId,variant:body?.variant,hasR2Key:!!env.R2_ACCESS_KEY_ID,hasSupabaseUrl:!!(env.VITE_SUPABASE_URL??env.SUPABASE_URL)},timestamp:Date.now(),hypothesisId:'D,E'})+'\n')}catch{}
  // #endregion
  const auth = await requireUser(authorization, env)
  if (auth.error) return { status: auth.status, body: { error: auth.error } }

  const { user, admin } = auth
  const { data: profile } = await admin
    .from('profiles')
    .select('role, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (!canAccessSubscriberContent(profile)) {
    return { status: 403, body: { error: 'subscription_required' } }
  }

  const { lessonId, variant = 'desktop' } = body ?? {}
  if (!lessonId) return { status: 400, body: { error: 'missing_lesson_id' } }

  const { data: lesson } = await admin
    .from('video_lessons')
    .select('video_r2_key, video_r2_key_vertical, is_published')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson) return { status: 404, body: { error: 'not_found' } }
  if (profile?.role !== 'admin' && !lesson.is_published) {
    return { status: 404, body: { error: 'not_found' } }
  }

  const key = variant === 'vertical'
    ? (lesson.video_r2_key_vertical ?? lesson.video_r2_key)
    : (lesson.video_r2_key ?? lesson.video_r2_key_vertical)

  if (!key) return { status: 404, body: { error: 'no_video' } }

  try {
    const url = await presignDownload(env, key)
    // #region agent log
    try{const fs=await import('node:fs');fs.appendFileSync('debug-f0e9bf.log',JSON.stringify({sessionId:'f0e9bf',location:'getVideoUrl.js:resolveGetVideoUrl:success',message:'Presigned URL generated',data:{lessonId,variant,hasUrl:!!url},timestamp:Date.now(),hypothesisId:'E'})+'\n')}catch{}
    // #endregion
    return { status: 200, body: { url } }
  } catch (err) {
    console.error('[getVideoUrl] presign failed:', err)
    // #region agent log
    try{const fs=await import('node:fs');fs.appendFileSync('debug-f0e9bf.log',JSON.stringify({sessionId:'f0e9bf',location:'getVideoUrl.js:resolveGetVideoUrl:presignError',message:'Presign failed',data:{lessonId,errorName:err?.name,errorMessage:err?.message},timestamp:Date.now(),hypothesisId:'E'})+'\n')}catch{}
    // #endregion
    return { status: 500, body: { error: 'presign_failed' } }
  }
}

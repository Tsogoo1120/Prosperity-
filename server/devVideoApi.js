import { createClient } from '@supabase/supabase-js'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

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

async function requireUser(req, env) {
  const authHeader = req.headers.authorization
  if (!authHeader) return { error: 'not_authenticated', status: 401 }

  const userClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
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

async function handleGetVideoUrl(req, res, env) {
  const auth = await requireUser(req, env)
  if (auth.error) return sendJson(res, auth.status, { error: auth.error })

  const { user, admin } = auth
  const { data: profile } = await admin
    .from('profiles')
    .select('role, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (!canAccessSubscriberContent(profile)) {
    return sendJson(res, 403, { error: 'subscription_required' })
  }

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    return sendJson(res, 400, { error: 'bad_request' })
  }

  const { lessonId, variant = 'desktop' } = body
  if (!lessonId) return sendJson(res, 400, { error: 'missing_lesson_id' })

  const { data: lesson } = await admin
    .from('video_lessons')
    .select('video_r2_key, video_r2_key_vertical, is_published')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson) return sendJson(res, 404, { error: 'not_found' })
  if (profile?.role !== 'admin' && !lesson.is_published) {
    return sendJson(res, 404, { error: 'not_found' })
  }

  const key = variant === 'vertical'
    ? (lesson.video_r2_key_vertical ?? lesson.video_r2_key)
    : (lesson.video_r2_key ?? lesson.video_r2_key_vertical)

  if (!key) return sendJson(res, 404, { error: 'no_video' })

  try {
    const url = await presignDownload(env, key)
    return sendJson(res, 200, { url })
  } catch (err) {
    console.error('[devVideoApi] presign failed:', err)
    return sendJson(res, 500, { error: 'presign_failed' })
  }
}

export function createDevVideoApi(env) {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/get-video-url')) return next()
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }
    await handleGetVideoUrl(req, res, env)
  }
}

import { CORS, json, requireUser } from '../_shared/auth.ts'
import { generateR2Key, presignUpload, VIDEO_CACHE_CONTROL } from '../_shared/r2.ts'

const ALLOWED_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response

  const { user, admin } = auth

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return json({ error: 'forbidden' }, 403)
  }

  let body: { filename?: string; contentType?: string; variant?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const { filename, contentType = 'video/mp4', variant = 'desktop' } = body

  if (!filename) return json({ error: 'missing_filename' }, 400)
  if (!['desktop', 'vertical'].includes(variant)) return json({ error: 'invalid_variant' }, 400)
  if (!ALLOWED_TYPES.has(contentType)) return json({ error: 'invalid_content_type' }, 400)

  const key = generateR2Key('video-lessons', filename)

  try {
    const uploadUrl = await presignUpload(key, contentType, VIDEO_CACHE_CONTROL)
    return json({ key, uploadUrl, cacheControl: VIDEO_CACHE_CONTROL })
  } catch (err) {
    console.error('[upload-video] presign failed:', err)
    return json({ error: 'presign_failed' }, 500)
  }
})

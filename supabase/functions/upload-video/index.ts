import { CORS, json, requireUser } from '../_shared/auth.ts'
import { generateR2Key, putObject } from '../_shared/r2.ts'

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

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const file = form.get('file')
  const variant = String(form.get('variant') ?? 'desktop')
  if (!(file instanceof File)) return json({ error: 'missing_file' }, 400)
  if (!['desktop', 'vertical'].includes(variant)) return json({ error: 'invalid_variant' }, 400)

  const contentType = file.type || 'video/mp4'
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'invalid_content_type' }, 400)
  }

  const key = generateR2Key('video-lessons', file.name)

  try {
    const body = new Uint8Array(await file.arrayBuffer())
    await putObject(key, body, contentType)
    return json({ key })
  } catch (err) {
    console.error('[upload-video] upload failed:', err)
    return json({ error: 'upload_failed' }, 500)
  }
})

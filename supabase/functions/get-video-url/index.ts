import { CORS, canAccessSubscriberContent, json, requireUser } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response

  const { user, admin } = auth

  const { data: profile } = await admin
    .from('profiles')
    .select('role, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (!canAccessSubscriberContent(profile)) {
    return json({ error: 'subscription_required' }, 403)
  }

  let body: { lessonId?: string; variant?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const { lessonId, variant = 'desktop' } = body
  if (!lessonId) return json({ error: 'missing_lesson_id' }, 400)

  const { data: lesson } = await admin
    .from('video_lessons')
    .select('video_r2_key, video_r2_key_vertical, video_stream_uid, video_stream_uid_vertical, is_published')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson) return json({ error: 'not_found' }, 404)
  if (profile?.role !== 'admin' && !lesson.is_published) {
    return json({ error: 'not_found' }, 404)
  }

  const streamUid = variant === 'vertical'
    ? (lesson.video_stream_uid_vertical ?? lesson.video_stream_uid)
    : (lesson.video_stream_uid ?? lesson.video_stream_uid_vertical)

  if (streamUid) {
    const code = Deno.env.get('CLOUDFLARE_STREAM_CUSTOMER_CODE')
    if (!code) return json({ error: 'stream_not_configured' }, 500)
    const base = `https://customer-${code}.cloudflarestream.com/${streamUid}`
    return json({
      type: 'stream',
      uid: streamUid,
      iframeUrl: `${base}/iframe`,
      hlsUrl: `${base}/manifest/video.m3u8`,
      dashUrl: `${base}/manifest/video.mpd`,
      thumbnailUrl: `${base}/thumbnails/thumbnail.jpg`,
    })
  }

  const key = variant === 'vertical'
    ? (lesson.video_r2_key_vertical ?? lesson.video_r2_key)
    : (lesson.video_r2_key ?? lesson.video_r2_key_vertical)

  if (!key) return json({ error: 'no_video' }, 404)

  const CDN_BASE = Deno.env.get('CDN_BASE_URL') ?? 'https://cdn.tsogoo.site'
  return json({ type: 'r2', url: `${CDN_BASE}/${key}` })
})

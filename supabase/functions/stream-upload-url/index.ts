import { CORS, isUserAdmin, json, requireUser } from '../_shared/auth.ts'

// Admin-only. Requests a Cloudflare Stream direct creator upload URL.
// Client then POSTs the video file as multipart/form-data to the returned uploadURL.
// Returns the eventual Stream video UID immediately (resolved by Cloudflare).
//
// Required env:
//   CLOUDFLARE_API_TOKEN     — token with Stream:Edit permission
//   CLOUDFLARE_ACCOUNT_ID    — Cloudflare account ID
//
// Optional env:
//   STREAM_MAX_DURATION_SECONDS  — default 7200 (2h)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response

  const { user, admin } = auth

  if (!(await isUserAdmin(admin, user.id, user.email))) {
    return json({ error: 'forbidden' }, 403)
  }

  const token = Deno.env.get('CLOUDFLARE_API_TOKEN')
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
  if (!token || !accountId) return json({ error: 'stream_not_configured' }, 500)

  let body: { filename?: string; variant?: string; maxDurationSeconds?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const { filename, variant = 'desktop' } = body
  if (!['desktop', 'vertical'].includes(variant)) return json({ error: 'invalid_variant' }, 400)

  const maxDuration =
    Number(body.maxDurationSeconds) ||
    Number(Deno.env.get('STREAM_MAX_DURATION_SECONDS') ?? '7200')

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: maxDuration,
        requireSignedURLs: false,
        meta: {
          name: filename ?? 'lesson',
          variant,
          uploadedBy: user.id,
        },
      }),
    },
  )

  const data = await cfRes.json().catch(() => ({} as Record<string, unknown>))
  if (!cfRes.ok || !data?.success) {
    console.error('[stream-upload-url] cf api failed', cfRes.status, data)
    const msg = (data as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? 'stream_api_failed'
    return json({ error: msg }, 500)
  }

  const result = (data as { result?: { uploadURL?: string; uid?: string } }).result ?? {}
  if (!result.uploadURL || !result.uid) {
    return json({ error: 'stream_api_invalid_response' }, 500)
  }

  return json({ uploadURL: result.uploadURL, uid: result.uid })
})

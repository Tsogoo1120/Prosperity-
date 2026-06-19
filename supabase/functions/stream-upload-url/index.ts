import { CORS, isUserAdmin, json, requireUser } from '../_shared/auth.ts'

// Base64-encode a UTF-8 string for use in tus Upload-Metadata values.
function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

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

  let body: { filename?: string; variant?: string; size?: number; maxDurationSeconds?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const { filename, variant = 'desktop' } = body
  if (!['desktop', 'vertical'].includes(variant)) return json({ error: 'invalid_variant' }, 400)

  // tus requires the total size up front (Upload-Length).
  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) return json({ error: 'missing_size' }, 400)

  const maxDuration =
    Number(body.maxDurationSeconds) ||
    Number(Deno.env.get('STREAM_MAX_DURATION_SECONDS') ?? '7200')

  // Create a resumable (tus) direct creator upload. The single-POST direct
  // upload is capped at 200 MB by Cloudflare; tus has no such limit. The
  // one-time upload URL is returned in the Location header and the eventual
  // video UID in the stream-media-id header.
  const uploadMetadata = [
    `maxDurationSeconds ${b64utf8(String(maxDuration))}`,
    `name ${b64utf8(filename ?? 'lesson')}`,
  ].join(',')

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(size),
        'Upload-Metadata': uploadMetadata,
      },
    },
  )

  if (!cfRes.ok) {
    const errText = await cfRes.text().catch(() => '')
    console.error('[stream-upload-url] cf tus create failed', cfRes.status, errText)
    return json({ error: 'stream_api_failed' }, 500)
  }

  const uploadURL = cfRes.headers.get('Location')
  const uid = cfRes.headers.get('stream-media-id')
  if (!uploadURL || !uid) return json({ error: 'stream_api_invalid_response' }, 500)

  return json({ uploadURL, uid })
})

// Cron: flip active+past-expiry profiles to 'expired' and send expiry emails.
// Trigger via pg_cron or external scheduler with:
//   Authorization: Bearer <CRON_SECRET>
// Recommended schedule: daily at 00:00 UTC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { subscriptionExpiredTemplate } from '../_shared/templates.ts'
import { sendOne, SITE_URL } from '../_shared/resend.ts'
import { requireCronAuth } from '../_shared/auth.ts'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  const authErr = requireCronAuth(req)
  if (authErr) return authErr

  const admin = createClient(SB_URL, SB_SERVICE)
  const nowIso = new Date().toISOString()

  // Find active profiles past their expiry
  const { data: expired, error: fetchErr } = await admin
    .from('profiles')
    .select('id')
    .eq('subscription_status', 'active')
    .lt('subscription_expires_at', nowIso)

  if (fetchErr) {
    console.error('[sub-expire] fetch failed:', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
  }

  const userIds = (expired ?? []).map((r: { id: string }) => r.id)
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, flipped: 0, emailed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Bulk flip to expired
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ subscription_status: 'expired' })
    .in('id', userIds)

  if (updateErr) {
    console.error('[sub-expire] update failed:', updateErr)
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
  }

  // Email each just-expired user
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  let emailed = 0
  let emailErrors = 0
  for (const p of profiles ?? []) {
    if (!p.email) continue
    try {
      const tpl = subscriptionExpiredTemplate({ fullName: p.full_name, siteUrl: SITE_URL })
      await sendOne(p.email, tpl.subject, tpl.html, tpl.text, 'sub-expire')
      emailed++
    } catch (err) {
      emailErrors++
      console.error('[sub-expire] email failed for', p.id, err)
    }
  }

  console.info('[sub-expire]', { flipped: userIds.length, emailed, emailErrors })
  return new Response(
    JSON.stringify({ ok: true, flipped: userIds.length, emailed, emailErrors }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

// Cron: send 3-day and 1-day subscription expiry reminders.
// Trigger via pg_cron or external scheduler with:
//   Authorization: Bearer <CRON_SECRET>
// Recommended schedule: daily at 09:00 UTC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { subscriptionExpiringTemplate } from '../_shared/templates.ts'
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
  const now = new Date()
  const in1Day = new Date(now.getTime() + 86_400_000)
  const in3Days = new Date(now.getTime() + 3 * 86_400_000)

  let sent3Day = 0
  let sent1Day = 0
  let errors = 0

  // 3-day reminders: expiry in (now+1d, now+3d], stage = 0
  const { data: threeDay } = await admin
    .from('profiles')
    .select('id, email, full_name, subscription_expires_at')
    .eq('subscription_status', 'active')
    .eq('email_notifications', true)
    .eq('expiry_reminder_stage', 0)
    .gt('subscription_expires_at', in1Day.toISOString())
    .lte('subscription_expires_at', in3Days.toISOString())

  for (const u of threeDay ?? []) {
    if (!u.email || !u.subscription_expires_at) continue
    try {
      const tpl = subscriptionExpiringTemplate({
        fullName: u.full_name,
        siteUrl: SITE_URL,
        expiresAt: u.subscription_expires_at,
        daysLeft: 3,
      })
      await sendOne(u.email, tpl.subject, tpl.html, tpl.text, 'sub-expiring')
      await admin.from('profiles').update({ expiry_reminder_stage: 1 }).eq('id', u.id)
      sent3Day++
    } catch (err) {
      errors++
      console.error('[sub-expiring] 3-day reminder failed for', u.id, err)
    }
  }

  // 1-day reminders: expiry in (now, now+1d], stage <= 1
  const { data: oneDay } = await admin
    .from('profiles')
    .select('id, email, full_name, subscription_expires_at')
    .eq('subscription_status', 'active')
    .eq('email_notifications', true)
    .lte('expiry_reminder_stage', 1)
    .gt('subscription_expires_at', now.toISOString())
    .lte('subscription_expires_at', in1Day.toISOString())

  for (const u of oneDay ?? []) {
    if (!u.email || !u.subscription_expires_at) continue
    try {
      const tpl = subscriptionExpiringTemplate({
        fullName: u.full_name,
        siteUrl: SITE_URL,
        expiresAt: u.subscription_expires_at,
        daysLeft: 1,
      })
      await sendOne(u.email, tpl.subject, tpl.html, tpl.text, 'sub-expiring')
      await admin.from('profiles').update({ expiry_reminder_stage: 2 }).eq('id', u.id)
      sent1Day++
    } catch (err) {
      errors++
      console.error('[sub-expiring] 1-day reminder failed for', u.id, err)
    }
  }

  console.info('[sub-expiring]', { sent3Day, sent1Day, errors })
  return new Response(JSON.stringify({ ok: true, sent3Day, sent1Day, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

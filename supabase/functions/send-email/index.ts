import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  adminNewPaymentTemplate,
  coachingApprovedTemplate,
  coachingDeniedTemplate,
  paymentApprovedTemplate,
  paymentDeniedTemplate,
  paymentReceivedTemplate,
  welcomeTemplate,
} from '../_shared/templates.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Union <hello@union.mn>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://union.mn'
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendOne(to: string, subject: string, html: string, text: string): Promise<void> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
    })
    if (!res.ok) console.error('[send-email] Resend error:', await res.text())
  } catch (err) {
    console.error('[send-email] fetch failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  // Verify caller JWT
  const userClient = createClient(SB_URL, SB_ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(SB_URL, SB_SERVICE)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const { type } = body

  try {
    switch (type) {
      // ── Called after user first signs up ──────────────────────────────────
      case 'welcome': {
        const { userId } = body as { userId: string }
        if (userId !== user.id) return new Response('Forbidden', { status: 403 })
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()
        if (!profile?.email) break
        const tpl = welcomeTemplate({ fullName: profile.full_name, siteUrl: SITE_URL })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      // ── Called by user right after submitting payment ──────────────────────
      case 'payment_received': {
        const { userId, amount, currency } = body as {
          userId: string
          amount: number
          currency: string
        }
        if (userId !== user.id) return new Response('Forbidden', { status: 403 })
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()
        if (!profile?.email) break
        const tpl = paymentReceivedTemplate({
          fullName: profile.full_name,
          siteUrl: SITE_URL,
          amount: Number(amount),
          currency: String(currency),
        })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      // ── Called by user right after submitting payment (admin alert) ────────
      case 'admin_new_payment': {
        const { userId, paymentId } = body as { userId: string; paymentId: string }
        if (userId !== user.id) return new Response('Forbidden', { status: 403 })
        const [{ data: admins }, { data: userProfile }, { data: payment }] = await Promise.all([
          admin.from('profiles').select('email').eq('role', 'admin'),
          admin.from('profiles').select('email, full_name').eq('id', userId).single(),
          admin.from('payments').select('amount, currency, created_at').eq('id', paymentId).single(),
        ])
        const adminEmails = ((admins ?? []) as { email: string | null }[])
          .map((a) => a.email)
          .filter((e): e is string => !!e)
        if (!adminEmails.length || !userProfile?.email || !payment) break
        const tpl = adminNewPaymentTemplate({
          userEmail: userProfile.email,
          userFullName: userProfile.full_name,
          amount: Number(payment.amount),
          currency: payment.currency,
          submittedAt: payment.created_at,
          siteUrl: SITE_URL,
        })
        await Promise.allSettled(
          adminEmails.map((to) => sendOne(to, tpl.subject, tpl.html, tpl.text)),
        )
        break
      }

      // ── Admin actions — require admin role ────────────────────────────────
      case 'payment_approved': {
        const { userId } = body as { userId: string }
        const { data: caller } = await admin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name, subscription_expires_at')
          .eq('id', userId)
          .single()
        if (!profile?.email || !profile.subscription_expires_at) break
        const tpl = paymentApprovedTemplate({
          fullName: profile.full_name,
          siteUrl: SITE_URL,
          expiresAt: profile.subscription_expires_at,
        })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      case 'payment_denied': {
        const { userId, adminNote } = body as { userId: string; adminNote: string | null }
        const { data: caller } = await admin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()
        if (!profile?.email) break
        const tpl = paymentDeniedTemplate({
          fullName: profile.full_name,
          siteUrl: SITE_URL,
          adminNote: adminNote ?? null,
        })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      case 'coaching_approved': {
        const { slotId, adminNote } = body as { slotId: string; adminNote: string | null }
        const { data: caller } = await admin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
        const { data: slot } = await admin
          .from('coaching_slots')
          .select('user_id, start_at, end_at, meet_link')
          .eq('id', slotId)
          .single()
        if (!slot?.user_id) break
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', slot.user_id)
          .single()
        if (!profile?.email) break
        const tpl = coachingApprovedTemplate({
          fullName: profile.full_name,
          siteUrl: SITE_URL,
          slotStartAt: slot.start_at,
          slotEndAt: slot.end_at,
          adminNote: adminNote ?? null,
          meetLink: (slot as any).meet_link ?? null,
        })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      case 'coaching_denied': {
        const { slotId, adminNote } = body as { slotId: string; adminNote: string | null }
        const { data: caller } = await admin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
        const { data: slot } = await admin
          .from('coaching_slots')
          .select('user_id, start_at')
          .eq('id', slotId)
          .single()
        if (!slot?.user_id) break
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', slot.user_id)
          .single()
        if (!profile?.email) break
        const tpl = coachingDeniedTemplate({
          fullName: profile.full_name,
          siteUrl: SITE_URL,
          slotStartAt: slot.start_at,
          adminNote: adminNote ?? null,
        })
        await sendOne(profile.email, tpl.subject, tpl.html, tpl.text)
        break
      }

      default:
        return new Response('Unknown type', { status: 400 })
    }
  } catch (err) {
    console.error('[send-email] error:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

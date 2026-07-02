const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Union <hello@union.mn>'
export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://union.mn'

// Returns true when Resend accepted the message, so callers can surface
// delivery failures to the admin instead of silently swallowing them.
export async function sendOne(
  to: string,
  subject: string,
  html: string,
  text: string,
  tag = 'email',
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
    })
    if (!res.ok) {
      console.error(`[${tag}] Resend error:`, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error(`[${tag}] fetch failed:`, err)
    return false
  }
}

// Sends the same message to many recipients via Resend's batch endpoint
// (max 100 messages per request). Used for content broadcasts where the body
// is identical for every member.
export async function sendBroadcast(
  recipients: string[],
  subject: string,
  html: string,
  text: string,
  tag = 'broadcast',
): Promise<void> {
  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients
      .slice(i, i + 100)
      .map((to) => ({ from: EMAIL_FROM, to, subject, html, text }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (!res.ok) console.error(`[${tag}] Resend batch error:`, await res.text())
    } catch (err) {
      console.error(`[${tag}] batch fetch failed:`, err)
    }
  }
}

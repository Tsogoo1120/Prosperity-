export const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
export const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Union <hello@union.mn>'
export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://union.mn'

export async function sendOne(
  to: string,
  subject: string,
  html: string,
  text: string,
  tag = 'email',
): Promise<void> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
    })
    if (!res.ok) console.error(`[${tag}] Resend error:`, await res.text())
  } catch (err) {
    console.error(`[${tag}] fetch failed:`, err)
  }
}

// Google Calendar helper for consumer (@gmail.com) accounts.
//
// Consumer Gmail has no standalone "create a Meet link" API — a real Google
// Meet link can only be minted by inserting a Calendar event that requests
// conferenceData. So we create an event on the coach's calendar (no attendees,
// to avoid Google sending its own invite emails) and read back the hangoutLink.
//
// Auth is a long-lived OAuth refresh token for the coach's own Google account.
// Required env vars (Supabase secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Optional:
//   GOOGLE_CALENDAR_ID  (default 'primary')
//   GOOGLE_TIME_ZONE    (default 'Asia/Ulaanbaatar')

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars'

function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.access_token) throw new Error('Google token response missing access_token')
  return data.access_token as string
}

export type MeetEvent = {
  meetLink: string
  eventId: string
}

/**
 * Insert a Calendar event with an auto-generated Google Meet link.
 * No attendees are added — Google only emails attendees, and we send our own
 * branded email via Resend instead.
 */
export async function createMeetEvent(opts: {
  summary: string
  description?: string | null
  startAt: string // ISO
  endAt: string // ISO
}): Promise<MeetEvent> {
  const accessToken = await getAccessToken()
  const calendarId = encodeURIComponent(Deno.env.get('GOOGLE_CALENDAR_ID') ?? 'primary')
  const timeZone = Deno.env.get('GOOGLE_TIME_ZONE') ?? 'Asia/Ulaanbaatar'

  const res = await fetch(
    `${CAL_BASE}/${calendarId}/events?conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: opts.summary,
        description: opts.description ?? undefined,
        start: { dateTime: opts.startAt, timeZone },
        end: { dateTime: opts.endAt, timeZone },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Google event insert failed (${res.status}): ${await res.text()}`)
  }

  const event = await res.json()
  const meetLink: string | undefined =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find(
      (e: { entryPointType?: string; uri?: string }) => e.entryPointType === 'video',
    )?.uri

  if (!meetLink) {
    throw new Error('Google event created but no Meet link was returned')
  }

  return { meetLink, eventId: event.id as string }
}

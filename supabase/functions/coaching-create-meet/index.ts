import { CORS, isUserAdmin, json, requireUser } from '../_shared/auth.ts'
import { createMeetEvent } from '../_shared/google.ts'

// Admin-only. Given a pending coaching slot id, mints a Google Meet link by
// creating a Calendar event on the coach's calendar, then marks the slot booked
// and stores the link. The branded "approved" email is sent separately by the
// send-email function (which reads meet_link back from the slot).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response
  const { user, admin } = auth

  if (!(await isUserAdmin(admin, user.id, user.email))) {
    return json({ error: 'forbidden' }, 403)
  }

  let slotId: string
  try {
    const body = await req.json()
    slotId = body.slotId
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!slotId) return json({ error: 'missing_slot_id' }, 400)

  const { data: slot, error: slotErr } = await admin
    .from('coaching_slots')
    .select('id, start_at, end_at, description, status, service_type, user_id, meet_link')
    .eq('id', slotId)
    .single()

  if (slotErr || !slot) return json({ error: 'slot_not_found' }, 404)
  if (slot.status !== 'pending') return json({ error: 'slot_not_pending' }, 409)

  // Already has a link (e.g. retried after a partial failure) — reuse it.
  if (slot.meet_link) {
    const { error } = await admin
      .from('coaching_slots')
      .update({ status: 'booked' })
      .eq('id', slotId)
    if (error) return json({ error: 'update_failed', detail: error.message }, 500)
    return json({ ok: true, meetLink: slot.meet_link })
  }

  const serviceLabel = 'Онлайн уулзалт'

  let meet
  try {
    meet = await createMeetEvent({
      summary: `${serviceLabel} — Union`,
      description: slot.description ?? null,
      startAt: slot.start_at,
      endAt: slot.end_at,
    })
  } catch (err) {
    console.error('[coaching-create-meet] Google error:', err)
    return json({ error: 'google_failed', detail: String(err) }, 502)
  }

  const { error: updErr } = await admin
    .from('coaching_slots')
    .update({
      status: 'booked',
      meet_link: meet.meetLink,
      google_event_id: meet.eventId,
    })
    .eq('id', slotId)

  if (updErr) return json({ error: 'update_failed', detail: updErr.message }, 500)

  return json({ ok: true, meetLink: meet.meetLink })
})

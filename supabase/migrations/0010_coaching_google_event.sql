-- Store the Google Calendar event id for each booked coaching slot so the
-- event (and its auto-generated Google Meet link) can be cancelled or
-- rescheduled later. The Meet link itself already lives in meet_link.
ALTER TABLE public.coaching_slots
  ADD COLUMN IF NOT EXISTS google_event_id text;

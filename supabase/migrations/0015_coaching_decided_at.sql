-- Records when an admin approved (booked) or denied (cancelled) a booking
-- request, so the admin History tab can show decisions in time order.
ALTER TABLE public.coaching_slots
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- Backfill existing decided slots so they appear in history immediately.
UPDATE public.coaching_slots
SET decided_at = COALESCE(decided_at, created_at)
WHERE status IN ('booked', 'cancelled') AND user_id IS NOT NULL;

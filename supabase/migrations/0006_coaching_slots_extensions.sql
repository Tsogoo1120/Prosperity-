-- Add payment proof and Google Meet link columns to coaching_slots
ALTER TABLE public.coaching_slots
  ADD COLUMN IF NOT EXISTS payment_screenshot_path text,
  ADD COLUMN IF NOT EXISTS meet_link               text;

-- Replace authenticated-only SELECT with a policy that lets anon users
-- see available slots (needed for landing page) while still allowing
-- logged-in users to see their own slots and admins to see everything.
DROP POLICY IF EXISTS "coaching_slots_select_auth" ON public.coaching_slots;

CREATE POLICY "coaching_slots_select_available_or_own"
  ON public.coaching_slots FOR SELECT
  USING (
    status = 'available'
    OR auth.uid() = user_id
    OR is_admin()
  );

-- Allow authenticated users to claim an available slot (set status → pending)
-- USING checks the OLD row; WITH CHECK validates the NEW row values.
CREATE POLICY "coaching_slots_update_claim"
  ON public.coaching_slots FOR UPDATE
  USING (
    status = 'available'
    AND user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

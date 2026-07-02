-- The admin Payments queue subscribes to postgres_changes on payments so new
-- bookings/enrollments appear without a manual refresh. Realtime only emits
-- for tables in the supabase_realtime publication, so add payments (and
-- coaching_slots defensively — the schedule screens already subscribe to it).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in the publication
  WHEN undefined_object THEN NULL;   -- publication not present here
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.coaching_slots;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: lesson_progress
-- Tracks which video lessons a user has completed
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id  uuid NOT NULL REFERENCES public.video_lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_progress_select_own"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "lesson_progress_insert_own"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lesson_progress_delete_own"
  ON public.lesson_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Update coaching_slots: add 'cancelled' status support
-- (status already text, just documenting valid values:
--  available | pending | booked | cancelled)
-- ============================================================
-- No schema change needed — status is free-form text.
-- Adding index for common query patterns
CREATE INDEX IF NOT EXISTS coaching_slots_user_id_idx ON public.coaching_slots (user_id);
CREATE INDEX IF NOT EXISTS coaching_slots_status_idx ON public.coaching_slots (status);
CREATE INDEX IF NOT EXISTS coaching_slots_start_at_idx ON public.coaching_slots (start_at);
CREATE INDEX IF NOT EXISTS lesson_progress_user_id_idx ON public.lesson_progress (user_id);

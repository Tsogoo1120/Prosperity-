-- ============================================================
-- ANNOUNCEMENTS  (admin broadcast board)
--   Admin posts / edits short text messages. Every authenticated
--   user sees the published ones on their dashboard, in real time
--   (table is added to the supabase_realtime publication below).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text,
  body         text NOT NULL,
  tone         text NOT NULL DEFAULT 'info',   -- info | important | event
  is_published boolean NOT NULL DEFAULT true,
  pinned       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Any authenticated user reads published rows; admin reads everything.
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select"
  ON public.announcements FOR SELECT
  USING (is_published = true OR is_admin());

-- Admin has full control (insert / update / delete).
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
CREATE POLICY "announcements_admin_all"
  ON public.announcements FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Keep updated_at fresh on every edit.
CREATE OR REPLACE FUNCTION public.touch_announcement_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_announcement_updated_at();

-- Realtime: students receive admin edits instantly. Guarded so the
-- migration is safe to re-run and across environments.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in the publication
  WHEN undefined_object THEN NULL;   -- publication not present here
END $$;

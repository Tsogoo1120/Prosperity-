-- ============================================================
-- COLLECTIVE READING (tarot-style pile reading)
-- Admin publishes a reading with 3 piles (image + article).
-- Each user picks 1 pile and reveals its reading.
-- ============================================================

-- ============================================================
-- TABLE: collective_readings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collective_readings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  intro        text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collective_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collective_readings_select_published" ON public.collective_readings;
CREATE POLICY "collective_readings_select_published"
  ON public.collective_readings FOR SELECT
  USING (is_published = true OR is_admin());

DROP POLICY IF EXISTS "collective_readings_admin_all" ON public.collective_readings;
CREATE POLICY "collective_readings_admin_all"
  ON public.collective_readings FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: reading_piles  (exactly 3 per reading, positions 1..3)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reading_piles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id uuid NOT NULL REFERENCES public.collective_readings(id) ON DELETE CASCADE,
  position   int NOT NULL,
  label      text,
  image_path text,
  article    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reading_id, position)
);

ALTER TABLE public.reading_piles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_piles_select_auth" ON public.reading_piles;
CREATE POLICY "reading_piles_select_auth"
  ON public.reading_piles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reading_piles_admin_all" ON public.reading_piles;
CREATE POLICY "reading_piles_admin_all"
  ON public.reading_piles FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: reading_picks  (one pick per user per reading)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reading_picks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id uuid NOT NULL REFERENCES public.collective_readings(id) ON DELETE CASCADE,
  pile_id    uuid NOT NULL REFERENCES public.reading_piles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reading_id, user_id)
);

ALTER TABLE public.reading_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_picks_select_own" ON public.reading_picks;
CREATE POLICY "reading_picks_select_own"
  ON public.reading_picks FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "reading_picks_insert_own" ON public.reading_picks;
CREATE POLICY "reading_picks_insert_own"
  ON public.reading_picks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reading_picks_update_own" ON public.reading_picks;
CREATE POLICY "reading_picks_update_own"
  ON public.reading_picks FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

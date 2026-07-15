-- ============================================================
-- COLLECTIVE READING as a paid service (15,000 MNT / 30 days)
--
-- Access rule: active 50,000 MNT subscribers watch for free;
-- everyone else needs a paid reading pass (reading_access_expires_at).
-- A reading pass does NOT grant subscriber perks (no 30% discount
-- on personal tarot, no lessons/tests) — it only unlocks this content.
-- ============================================================

-- Reading pass expiry on the profile (renewed +30d per approved payment)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reading_access_expires_at timestamptz;

-- Each pile can now carry a Cloudflare Stream video the user watches
-- after picking that pile.
ALTER TABLE public.reading_piles
  ADD COLUMN IF NOT EXISTS video_uid text;

-- ============================================================
-- HELPER: has_reading_access()
-- true for admins, active subscribers, and unexpired reading passes
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_reading_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'admin' OR is_admin
        OR subscription_status = 'active'
        OR (reading_access_expires_at IS NOT NULL AND reading_access_expires_at > now())
      )
  );
END;
$$;

-- ============================================================
-- Tighten pile content to paying users (title/intro of the reading
-- itself stays visible as a teaser via collective_readings policies).
-- ============================================================
DROP POLICY IF EXISTS "reading_piles_select_auth" ON public.reading_piles;
DROP POLICY IF EXISTS "reading_piles_select_access" ON public.reading_piles;
CREATE POLICY "reading_piles_select_access"
  ON public.reading_piles FOR SELECT
  USING (has_reading_access() OR is_admin());

DROP POLICY IF EXISTS "reading_picks_insert_own" ON public.reading_picks;
CREATE POLICY "reading_picks_insert_own"
  ON public.reading_picks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_reading_access());

DROP POLICY IF EXISTS "reading_picks_update_own" ON public.reading_picks;
CREATE POLICY "reading_picks_update_own"
  ON public.reading_picks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND has_reading_access());

-- ============================================================
-- TABLE: reading_comments  (comments under a collective reading)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reading_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id uuid NOT NULL REFERENCES public.collective_readings(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  is_hidden  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reading_comments_reading_id_idx
  ON public.reading_comments (reading_id, created_at);

ALTER TABLE public.reading_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_comments_select_access" ON public.reading_comments;
CREATE POLICY "reading_comments_select_access"
  ON public.reading_comments FOR SELECT
  USING ((has_reading_access() AND is_hidden = false) OR is_admin());

DROP POLICY IF EXISTS "reading_comments_insert_own" ON public.reading_comments;
CREATE POLICY "reading_comments_insert_own"
  ON public.reading_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_reading_access());

DROP POLICY IF EXISTS "reading_comments_delete_own" ON public.reading_comments;
CREATE POLICY "reading_comments_delete_own"
  ON public.reading_comments FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "reading_comments_update_admin" ON public.reading_comments;
CREATE POLICY "reading_comments_update_admin"
  ON public.reading_comments FOR UPDATE
  USING (is_admin());

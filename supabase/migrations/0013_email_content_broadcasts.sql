-- ============================================================
-- Email content broadcasts
--   - ensure profiles.email_notifications exists (used by the
--     subscription-expiring cron and content broadcasts)
--   - add notified_at to content tables so a publish only ever
--     triggers one broadcast email
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.video_lessons
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE public.psychology_tests
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE public.collective_readings
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Backfill: content already published before this feature existed has already
-- had its "first publish", so mark it notified to avoid a surprise blast when
-- an old item is edited or re-toggled. Only brand-new publishes will email.
UPDATE public.video_lessons
  SET notified_at = COALESCE(published_at, now())
  WHERE is_published = true AND notified_at IS NULL;

UPDATE public.psychology_tests
  SET notified_at = COALESCE(published_at, now())
  WHERE is_published = true AND notified_at IS NULL;

UPDATE public.collective_readings
  SET notified_at = COALESCE(published_at, now())
  WHERE is_published = true AND notified_at IS NULL;

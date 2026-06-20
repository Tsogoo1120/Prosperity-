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

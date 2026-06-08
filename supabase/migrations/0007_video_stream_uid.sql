-- Cloudflare Stream support for video_lessons
-- Adds Stream video UIDs alongside existing R2 keys (fallback).

ALTER TABLE public.video_lessons
  ADD COLUMN IF NOT EXISTS video_stream_uid text,
  ADD COLUMN IF NOT EXISTS video_stream_uid_vertical text;

COMMENT ON COLUMN public.video_lessons.video_stream_uid IS
  'Cloudflare Stream video UID for horizontal/desktop variant. Preferred over video_r2_key when present.';
COMMENT ON COLUMN public.video_lessons.video_stream_uid_vertical IS
  'Cloudflare Stream video UID for vertical/mobile variant.';

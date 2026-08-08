-- Remove the collective reading feature and its dedicated access pass.
DROP TABLE IF EXISTS public.reading_comments CASCADE;
DROP TABLE IF EXISTS public.reading_picks CASCADE;
DROP TABLE IF EXISTS public.reading_piles CASCADE;
DROP TABLE IF EXISTS public.collective_readings CASCADE;

DROP FUNCTION IF EXISTS public.has_reading_access();

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS reading_access_expires_at;

-- Raise the media-public bucket file size limit to 1 GB so the landing intro
-- video can exceed the previous 500 MB cap (see 0009). The intro now uploads
-- via Supabase resumable (tus) uploads from the admin panel.
--
-- NOTE: the project-wide global upload limit (Dashboard -> Storage -> Settings)
-- must also be >= 1 GB, and the plan must permit it, or this bucket limit is
-- silently clamped.
UPDATE storage.buckets SET file_size_limit = 1073741824 WHERE id = 'media-public';

-- Raise file size limit on media-public so large intro videos can be uploaded.
-- Default project limit is 50 MB; landing-page videos routinely exceed that.
-- 500 MB = 524288000 bytes.
UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'media-public';

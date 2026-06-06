-- Publish the Big Five personality test so it appears in the student dashboard.
UPDATE psychology_tests
SET is_published = true,
    published_at = now(),
    updated_at   = now()
WHERE slug = 'big-five-personality';

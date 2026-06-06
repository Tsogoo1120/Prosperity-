-- Seed video lessons from Cloudflare R2 (union-videos bucket)
-- Titles are placeholders — edit from Admin → Видео хичээлүүд

INSERT INTO public.video_lessons
  (slug, title, description, category, video_r2_key, video_r2_key_vertical,
   thumbnail_path, duration_seconds, sort_order, is_published, published_at, updated_at)
VALUES
  (
    'lesson-1',
    'Хичээл 1',
    NULL, NULL,
    'videos/video-lessons/ce25fb04-d9a7-4843-b0d6-d17320dd5212.mp4',
    NULL, NULL, NULL, 1, true, now(), now()
  ),
  (
    'lesson-2',
    'Хичээл 2',
    NULL, NULL,
    'videos/video-lessons/6f1bff8f-de23-441f-a8f5-dde063e7482e.mp4',
    NULL, NULL, NULL, 2, true, now(), now()
  ),
  (
    'lesson-3',
    'Хичээл 3',
    NULL, NULL,
    'videos/video-lessons/7b7cfc47-1e55-42d2-b9f9-7c45ebdb3dd1.mp4',
    NULL, NULL, NULL, 3, true, now(), now()
  ),
  (
    'lesson-4',
    'Хичээл 4',
    NULL, NULL,
    'videos/video-lessons/095cb94b-7089-4c41-a0a2-8b5cfd539ba9.mp4',
    NULL, NULL, NULL, 4, true, now(), now()
  ),
  (
    'lesson-5',
    'Хичээл 5',
    NULL, NULL,
    'videos/video-lessons/f2cd75e5-b739-4547-aac7-8369dbfaecfa.mp4',
    NULL, NULL, NULL, 5, true, now(), now()
  ),
  (
    'lesson-6',
    'Хичээл 6',
    NULL, NULL,
    'videos/video-lessons/690aaeda-e2a6-4d6b-83d8-77807db7a690.mp4',
    NULL, NULL, NULL, 6, true, now(), now()
  ),
  (
    'lesson-7',
    'Хичээл 7',
    NULL, NULL,
    'videos/video-lessons/bca48d35-a0f3-4852-945b-14b7235e9ddf.mp4',
    NULL, NULL, NULL, 7, true, now(), now()
  ),
  (
    'lesson-8',
    'Хичээл 8',
    NULL, NULL,
    'videos/video-lessons/cb52a8ae-bc92-47a1-98e0-c5e793ec9f6c.mp4',
    NULL, NULL, NULL, 8, true, now(), now()
  ),
  (
    'lesson-9',
    'Хичээл 9',
    NULL, NULL,
    'videos/video-lessons/3dab126d-15d4-4c1d-b636-a0c08c35bbdb.mp4',
    NULL, NULL, NULL, 9, true, now(), now()
  )
ON CONFLICT (slug) DO UPDATE SET
  title                 = EXCLUDED.title,
  video_r2_key          = EXCLUDED.video_r2_key,
  video_r2_key_vertical = EXCLUDED.video_r2_key_vertical,
  sort_order            = EXCLUDED.sort_order,
  is_published          = EXCLUDED.is_published,
  published_at          = EXCLUDED.published_at,
  updated_at            = now();

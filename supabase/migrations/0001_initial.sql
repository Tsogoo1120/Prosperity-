-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               text,
  email                   text,
  phone                   text,
  avatar_url              text,
  role                    text NOT NULL DEFAULT 'student',
  subscription_status     text,
  subscription_expires_at timestamptz,
  expiry_reminder_stage   int NOT NULL DEFAULT 0,
  is_admin                boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"    ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_insert_admin"  ON public.profiles FOR INSERT WITH CHECK (is_admin());

-- Trigger: auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLE: video_lessons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_lessons (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text UNIQUE NOT NULL,
  title                   text NOT NULL,
  description             text,
  category                text,
  thumbnail_path          text,
  video_r2_key            text,
  video_r2_key_vertical   text,
  duration_seconds        int,
  sort_order              int NOT NULL DEFAULT 0,
  is_published            boolean NOT NULL DEFAULT false,
  published_at            timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_lessons_select_published"
  ON public.video_lessons FOR SELECT
  USING (is_published = true OR is_admin());

CREATE POLICY "video_lessons_admin_all"
  ON public.video_lessons FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: site_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_select_all"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "site_settings_admin_write"
  ON public.site_settings FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  screenshot_path  text,
  amount           numeric,
  currency         text NOT NULL DEFAULT 'MNT',
  status           text NOT NULL DEFAULT 'pending',
  service_type     text,
  bank_reference   text,
  reviewed_by      uuid REFERENCES auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own_or_admin"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "payments_insert_own"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payments_update_admin"
  ON public.payments FOR UPDATE
  USING (is_admin());

-- ============================================================
-- TABLE: psychology_tests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.psychology_tests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  title          text NOT NULL,
  description    text,
  cover_image_path text,
  questions      jsonb NOT NULL DEFAULT '[]',
  scoring_rules  jsonb NOT NULL DEFAULT '{}',
  is_published   boolean NOT NULL DEFAULT false,
  published_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.psychology_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psychology_tests_select_published"
  ON public.psychology_tests FOR SELECT
  USING (is_published = true OR is_admin());

CREATE POLICY "psychology_tests_admin_all"
  ON public.psychology_tests FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: test_results
-- ============================================================
CREATE TABLE IF NOT EXISTS public.test_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_id         uuid NOT NULL REFERENCES public.psychology_tests(id) ON DELETE CASCADE,
  answers         jsonb,
  result_summary  jsonb,
  score           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_results_select_own"
  ON public.test_results FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "test_results_insert_own"
  ON public.test_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE: community_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text,
  body       text,
  is_hidden  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_select_auth"
  ON public.community_posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "community_posts_insert_own"
  ON public.community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_posts_update_admin"
  ON public.community_posts FOR UPDATE
  USING (is_admin());

-- ============================================================
-- TABLE: comments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text,
  is_hidden  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_auth"
  ON public.comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_admin"
  ON public.comments FOR UPDATE
  USING (is_admin());

-- ============================================================
-- TABLE: mentor_availability
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentor_availability (
  day         text PRIMARY KEY,
  start_hour  int NOT NULL,
  end_hour    int NOT NULL
);

ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_availability_select_all"
  ON public.mentor_availability FOR SELECT
  USING (true);

CREATE POLICY "mentor_availability_admin_write"
  ON public.mentor_availability FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- TABLE: coaching_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coaching_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_at     timestamptz NOT NULL,
  end_at       timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'available',
  service_type text,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_slots_select_auth"
  ON public.coaching_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "coaching_slots_insert_own"
  ON public.coaching_slots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coaching_slots_admin_all"
  ON public.coaching_slots FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RPC: submit_payment_flip_pending
-- Sets current user's subscription_status to 'pending'
-- SECURITY DEFINER so anon clients cannot bypass RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_payment_flip_pending()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET subscription_status = 'pending'
  WHERE id = auth.uid()
    AND (subscription_status IS NULL OR subscription_status NOT IN ('active'));
END;
$$;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('media-thumbnails', 'media-thumbnails', true),
  ('media-public',     'media-public',     true),
  ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- media-thumbnails: public read, admin write
CREATE POLICY "media_thumbnails_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-thumbnails');

CREATE POLICY "media_thumbnails_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-thumbnails' AND is_admin());

CREATE POLICY "media_thumbnails_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-thumbnails' AND is_admin());

CREATE POLICY "media_thumbnails_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media-thumbnails' AND is_admin());

-- media-public: public read, admin write
CREATE POLICY "media_public_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-public');

CREATE POLICY "media_public_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-public' AND is_admin());

CREATE POLICY "media_public_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-public' AND is_admin());

CREATE POLICY "media_public_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media-public' AND is_admin());

-- payment-screenshots: users upload own, admin reads all
CREATE POLICY "payment_screenshots_select_admin"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-screenshots' AND is_admin());

CREATE POLICY "payment_screenshots_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "payment_screenshots_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

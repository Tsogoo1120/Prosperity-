-- Align is_admin() with frontend admin access and fix storage RLS for admin uploads.
-- Admin can be granted via profiles.role, profiles.is_admin, or site_settings.admin_email.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.site_settings s
    JOIN auth.users u ON u.id = auth.uid()
    WHERE s.key = 'admin_email'
      AND lower(trim(s.value)) = lower(trim(u.email))
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Persist admin role when the signed-in user's email matches site_settings.admin_email.
CREATE OR REPLACE FUNCTION public.claim_admin_if_allowlisted()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.site_settings
    WHERE key = 'admin_email'
      AND lower(trim(value)) = lower(trim(user_email))
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET role = 'admin', is_admin = true
  WHERE id = auth.uid()
    AND (role <> 'admin' OR is_admin IS NOT true);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_admin_if_allowlisted() TO authenticated;

-- Storage upsert needs UPDATE WITH CHECK in addition to INSERT/SELECT.
DROP POLICY IF EXISTS "media_thumbnails_admin_update" ON storage.objects;
CREATE POLICY "media_thumbnails_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-thumbnails' AND is_admin())
  WITH CHECK (bucket_id = 'media-thumbnails' AND is_admin());

DROP POLICY IF EXISTS "media_public_admin_update" ON storage.objects;
CREATE POLICY "media_public_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-public' AND is_admin())
  WITH CHECK (bucket_id = 'media-public' AND is_admin());

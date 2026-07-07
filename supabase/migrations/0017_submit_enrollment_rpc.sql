-- Atomic enrollment submission.
--
-- The client previously did three separate writes on payment submit:
--   1. UPDATE coaching_slots (claim the slot)
--   2. INSERT INTO payments
--   3. RPC submit_payment_flip_pending (subscription only)
-- If step 2 failed after step 1 succeeded, the slot was stranded in 'pending'
-- with no payment row and no path back to 'available'. This function performs
-- all three inside one transaction: any failure rolls everything back.

CREATE OR REPLACE FUNCTION public.submit_enrollment(
  p_screenshot_path  text,
  p_amount           numeric,
  p_service_type     text,
  p_bank_reference   text DEFAULT NULL,
  p_slot_id          uuid DEFAULT NULL,
  p_slot_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_screenshot_path IS NULL OR p_screenshot_path = '' THEN
    RAISE EXCEPTION 'screenshot_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- Claim the slot if this enrollment books a meeting. The status/user_id
  -- guards make concurrent claims race-safe: the second caller matches zero
  -- rows and gets slot_unavailable.
  IF p_slot_id IS NOT NULL THEN
    UPDATE public.coaching_slots
    SET status                  = 'pending',
        user_id                 = v_uid,
        description             = p_slot_description,
        payment_screenshot_path = p_screenshot_path
    WHERE id = p_slot_id
      AND status = 'available'
      AND user_id IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'slot_unavailable';
    END IF;
  END IF;

  INSERT INTO public.payments
    (user_id, screenshot_path, amount, currency, status, service_type, bank_reference)
  VALUES
    (v_uid, p_screenshot_path, p_amount, 'MNT', 'pending', p_service_type, p_bank_reference)
  RETURNING id INTO v_payment_id;

  -- Subscription purchases flip the profile to pending; meeting bookings
  -- (tarot etc.) must not touch subscription state.
  IF p_service_type = 'subscription' THEN
    UPDATE public.profiles
    SET subscription_status = 'pending'
    WHERE id = v_uid
      AND (subscription_status IS NULL OR subscription_status NOT IN ('active'));
  END IF;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_enrollment(text, numeric, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enrollment(text, numeric, text, text, uuid, text) TO authenticated;

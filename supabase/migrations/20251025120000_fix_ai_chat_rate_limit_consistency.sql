/*
  # Fix AI Chat Rate Limiting Consistency

  This migration consolidates and fixes all rate limiting functionality:

  ## Problems Fixed:
  1. Inconsistent return types between migrations (TABLE vs JSONB)
  2. Race condition causing counter to reset after increment
  3. Counter not incrementing properly

  ## Changes:
  1. **check_and_reset_ai_chat_limits Function**
     - Returns TABLE format (not JSONB) for frontend compatibility
     - Auto-creates records if missing
     - Properly resets counters after 24 hours
     - Simple and reliable implementation

  2. **increment_ai_chat_usage Function**
     - Returns boolean for success/failure
     - Atomically increments counter
     - Prevents race conditions with proper WHERE clause
     - Enforces limits correctly

  ## Important Notes:
  - Guest users: 5 prompts/day
  - Registered users: 25 prompts/day
  - Admins: Unlimited (bypassed in frontend)
  - Bonus prompt system removed - only daily limits enforced
  - IP validation removed for reliability (can be added later if needed)
*/

-- Drop existing functions to recreate with correct signatures
DROP FUNCTION IF EXISTS check_and_reset_ai_chat_limits(uuid, text);
DROP FUNCTION IF EXISTS increment_ai_chat_usage(uuid, text);

-- Recreate check_and_reset_ai_chat_limits with TABLE return type (simplified, no IP validation)
CREATE OR REPLACE FUNCTION check_and_reset_ai_chat_limits(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS TABLE(
  daily_limit integer,
  bonus_limit integer,
  used_count integer,
  remaining integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record ai_chat_usage_limits;
  v_now timestamptz := now();
  v_hours_since_reset numeric;
  v_base_limit integer := 5;
BEGIN
  -- Determine base limit
  IF p_user_id IS NOT NULL THEN
    v_base_limit := 25;
  ELSE
    v_base_limit := 5;
  END IF;

  -- Find existing record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE user_id = p_user_id;
  ELSE
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE session_id = p_session_id;
  END IF;

  -- If no record exists, create it
  IF v_record.id IS NULL THEN
    INSERT INTO ai_chat_usage_limits (
      user_id,
      session_id,
      daily_limit,
      bonus_limit,
      used_count,
      last_reset_at,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      p_session_id,
      v_base_limit,
      0,
      0,
      v_now,
      v_now,
      v_now
    )
    RETURNING * INTO v_record;
  ELSE
    -- Calculate hours since last reset
    v_hours_since_reset := EXTRACT(EPOCH FROM (v_now - v_record.last_reset_at)) / 3600;

    -- If more than 24 hours, reset limits
    IF v_hours_since_reset >= 24 THEN
      UPDATE ai_chat_usage_limits
      SET
        used_count = 0,
        bonus_limit = 0,
        last_reset_at = v_now,
        updated_at = v_now
      WHERE id = v_record.id
      RETURNING * INTO v_record;
    END IF;
  END IF;

  -- Return current state (bonus_limit always 0, only use daily_limit)
  RETURN QUERY SELECT
    v_record.daily_limit,
    0 as bonus_limit,
    v_record.used_count,
    (v_record.daily_limit - v_record.used_count) as remaining,
    v_record.last_reset_at + interval '24 hours' as reset_at;
END;
$$;

-- Recreate increment_ai_chat_usage (simplified, no IP validation)
CREATE OR REPLACE FUNCTION increment_ai_chat_usage(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_used integer;
  v_daily_limit integer;
  v_rows_updated integer;
BEGIN
  -- Get current usage and daily limit only
  IF p_user_id IS NOT NULL THEN
    SELECT used_count, daily_limit
    INTO v_current_used, v_daily_limit
    FROM ai_chat_usage_limits
    WHERE user_id = p_user_id;
  ELSE
    SELECT used_count, daily_limit
    INTO v_current_used, v_daily_limit
    FROM ai_chat_usage_limits
    WHERE session_id = p_session_id;
  END IF;

  -- If no record found, return false
  IF v_current_used IS NULL THEN
    RAISE NOTICE 'No usage record found - cannot increment';
    RETURN false;
  END IF;

  -- Check if limit would be exceeded (only check daily_limit)
  IF v_current_used >= v_daily_limit THEN
    RAISE NOTICE 'Rate limit exceeded: % >= %', v_current_used, v_daily_limit;
    RETURN false;
  END IF;

  -- Atomically increment the counter (only check daily_limit)
  IF p_user_id IS NOT NULL THEN
    UPDATE ai_chat_usage_limits
    SET
      used_count = used_count + 1,
      updated_at = now()
    WHERE user_id = p_user_id
      AND used_count < daily_limit;
  ELSE
    UPDATE ai_chat_usage_limits
    SET
      used_count = used_count + 1,
      updated_at = now()
    WHERE session_id = p_session_id
      AND used_count < daily_limit;
  END IF;

  -- Check if update was successful
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Successfully incremented usage count';
    RETURN true;
  ELSE
    RAISE NOTICE 'Failed to increment - concurrent limit reached';
    RETURN false;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_reset_ai_chat_limits(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_ai_chat_usage(uuid, text) TO authenticated, anon;

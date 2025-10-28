/*
  # Fix AI Chat Rate Limiting Consistency and IP Validation

  This migration consolidates and fixes all rate limiting functionality:

  ## Problems Fixed:
  1. Inconsistent return types between migrations (TABLE vs JSONB)
  2. Race condition causing counter to reset after increment
  3. IP validation not properly integrated with counter logic

  ## Changes:
  1. **Table Structure**
     - Ensures ip_address column exists with proper index
     - Keeps existing data intact

  2. **check_and_reset_ai_chat_limits Function**
     - Returns TABLE format (not JSONB) for frontend compatibility
     - Auto-creates records if missing
     - Validates IP address and invalidates sessions on IP change
     - Properly resets counters after 24 hours

  3. **increment_ai_chat_usage Function**
     - Validates IP address before incrementing
     - Returns boolean for success/failure
     - Atomically increments counter
     - Prevents race conditions

  ## Security:
  - Session hijacking protection via IP validation
  - Each user/session gets individual limits (not per-IP limits)
  - IP changes invalidate the session and create new record

  ## Important Notes:
  - Guest users: 5 prompts/day
  - Registered users: 25 prompts/day
  - Admins: Unlimited (bypassed in frontend)
  - IP address is validated but limits are per session/user, not per IP
*/

-- Ensure ip_address column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_chat_usage_limits' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE ai_chat_usage_limits ADD COLUMN ip_address inet;
  END IF;
END $$;

-- Ensure index exists for IP lookups
CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_limits_ip_address
ON ai_chat_usage_limits(ip_address);

-- Drop existing functions to recreate with correct signatures
DROP FUNCTION IF EXISTS check_and_reset_ai_chat_limits(uuid, text);
DROP FUNCTION IF EXISTS increment_ai_chat_usage(uuid, text);

-- Recreate check_and_reset_ai_chat_limits with TABLE return type and IP validation
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
  v_client_ip inet;
BEGIN
  -- Get client IP address
  v_client_ip := inet_client_addr();

  -- Fallback if no IP available
  IF v_client_ip IS NULL THEN
    v_client_ip := '0.0.0.0'::inet;
  END IF;

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

  -- If record exists, validate IP address
  IF v_record.id IS NOT NULL THEN
    -- Check for IP mismatch (potential session hijacking)
    IF v_record.ip_address IS NOT NULL AND v_record.ip_address != v_client_ip THEN
      -- IP changed - invalidate old session and create new one
      DELETE FROM ai_chat_usage_limits
      WHERE id = v_record.id;

      v_record := NULL;

      RAISE NOTICE 'IP address changed - session invalidated and recreated';
    END IF;
  END IF;

  -- If no record exists (or was just invalidated), create it
  IF v_record.id IS NULL THEN
    INSERT INTO ai_chat_usage_limits (
      user_id,
      session_id,
      ip_address,
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
      v_client_ip,
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
        updated_at = v_now,
        ip_address = v_client_ip
      WHERE id = v_record.id
      RETURNING * INTO v_record;
    ELSE
      -- Just update IP if needed (user may have dynamic IP)
      IF v_record.ip_address IS NULL OR v_record.ip_address != v_client_ip THEN
        UPDATE ai_chat_usage_limits
        SET ip_address = v_client_ip,
            updated_at = v_now
        WHERE id = v_record.id
        RETURNING * INTO v_record;
      END IF;
    END IF;
  END IF;

  -- Return current state in TABLE format
  RETURN QUERY SELECT
    v_record.daily_limit,
    v_record.bonus_limit,
    v_record.used_count,
    (v_record.daily_limit + v_record.bonus_limit - v_record.used_count) as remaining,
    v_record.last_reset_at + interval '24 hours' as reset_at;
END;
$$;

-- Recreate increment_ai_chat_usage with IP validation
CREATE OR REPLACE FUNCTION increment_ai_chat_usage(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record ai_chat_usage_limits;
  v_current_used integer;
  v_total_limit integer;
  v_client_ip inet;
  v_rows_updated integer;
BEGIN
  -- Get client IP address
  v_client_ip := inet_client_addr();

  IF v_client_ip IS NULL THEN
    v_client_ip := '0.0.0.0'::inet;
  END IF;

  -- Find the record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE user_id = p_user_id;
  ELSE
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE session_id = p_session_id;
  END IF;

  -- If no record found, return false (should call check_and_reset first)
  IF v_record.id IS NULL THEN
    RAISE NOTICE 'No usage record found - cannot increment';
    RETURN false;
  END IF;

  -- Validate IP address
  IF v_record.ip_address IS NOT NULL AND v_record.ip_address != v_client_ip THEN
    RAISE NOTICE 'IP address mismatch - possible session hijacking attempt';
    -- Delete invalid session
    DELETE FROM ai_chat_usage_limits WHERE id = v_record.id;
    RETURN false;
  END IF;

  -- Calculate current state
  v_current_used := v_record.used_count;
  v_total_limit := v_record.daily_limit + v_record.bonus_limit;

  -- Check if limit would be exceeded
  IF v_current_used >= v_total_limit THEN
    RAISE NOTICE 'Rate limit exceeded: % >= %', v_current_used, v_total_limit;
    RETURN false;
  END IF;

  -- Atomically increment the counter with IP validation
  IF p_user_id IS NOT NULL THEN
    UPDATE ai_chat_usage_limits
    SET
      used_count = used_count + 1,
      updated_at = now(),
      ip_address = v_client_ip
    WHERE user_id = p_user_id
      AND (ip_address IS NULL OR ip_address = v_client_ip)
      AND used_count < (daily_limit + bonus_limit);
  ELSE
    UPDATE ai_chat_usage_limits
    SET
      used_count = used_count + 1,
      updated_at = now(),
      ip_address = v_client_ip
    WHERE session_id = p_session_id
      AND (ip_address IS NULL OR ip_address = v_client_ip)
      AND used_count < (daily_limit + bonus_limit);
  END IF;

  -- Check if update was successful
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Successfully incremented usage count';
    RETURN true;
  ELSE
    RAISE NOTICE 'Failed to increment - concurrent limit or IP mismatch';
    RETURN false;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_reset_ai_chat_limits(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_ai_chat_usage(uuid, text) TO authenticated, anon;

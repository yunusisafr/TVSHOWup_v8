/*
  # Add IP Validation to AI Chat Rate Limiting

  1. Schema Changes
    - Add `ip_address` column to `ai_chat_usage_limits` table
    - Store IP address for each session/user to validate requests
    
  2. Security Enhancement
    - Session ID must match the IP address that created it
    - Prevents session ID manipulation across different networks
    - Each user/session maintains individual limits even from same IP
    
  3. Important Notes
    - Existing limits remain unchanged (5 for guests, 25 for registered users)
    - Multiple users from same IP each get their own individual limits
    - IP address is tracked but limits are per session/user, not per IP
*/

-- Add ip_address column to track the IP for each session
ALTER TABLE ai_chat_usage_limits 
ADD COLUMN IF NOT EXISTS ip_address inet;

-- Create index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_limits_ip_address 
ON ai_chat_usage_limits(ip_address);

-- Drop existing functions to allow modifications
DROP FUNCTION IF EXISTS check_and_reset_ai_chat_limits(uuid, text);
DROP FUNCTION IF EXISTS increment_ai_chat_usage(uuid, text);

-- Recreate the check_and_reset_ai_chat_limits function with IP validation
CREATE OR REPLACE FUNCTION check_and_reset_ai_chat_limits(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit_record ai_chat_usage_limits%ROWTYPE;
  v_daily_limit integer;
  v_hourly_limit integer;
  v_now timestamptz := now();
  v_client_ip inet;
BEGIN
  -- Get client IP address
  v_client_ip := inet_client_addr();
  
  -- If no IP available (shouldn't happen in normal cases), fall back to a placeholder
  IF v_client_ip IS NULL THEN
    v_client_ip := '0.0.0.0'::inet;
  END IF;

  -- Determine limits based on user status
  IF p_user_id IS NOT NULL THEN
    v_daily_limit := 25;
    v_hourly_limit := 10;
  ELSE
    v_daily_limit := 5;
    v_hourly_limit := 3;
  END IF;

  -- Try to find existing record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_limit_record
    FROM ai_chat_usage_limits
    WHERE user_id = p_user_id;
  ELSE
    SELECT * INTO v_limit_record
    FROM ai_chat_usage_limits
    WHERE session_id = p_session_id;
  END IF;

  -- If record exists, validate IP address
  IF FOUND THEN
    -- Check if IP has changed (session hijacking attempt)
    IF v_limit_record.ip_address IS NOT NULL AND v_limit_record.ip_address != v_client_ip THEN
      -- IP mismatch - invalidate session and create new record
      DELETE FROM ai_chat_usage_limits
      WHERE (user_id = p_user_id AND p_user_id IS NOT NULL)
         OR (session_id = p_session_id AND p_session_id IS NOT NULL);
      
      v_limit_record := NULL;
    END IF;
  END IF;

  -- If no valid record found, create new one
  IF v_limit_record IS NULL THEN
    INSERT INTO ai_chat_usage_limits (
      user_id,
      session_id,
      ip_address,
      daily_count,
      hourly_count,
      daily_reset_at,
      hourly_reset_at
    )
    VALUES (
      p_user_id,
      p_session_id,
      v_client_ip,
      0,
      0,
      v_now + interval '1 day',
      v_now + interval '1 hour'
    )
    RETURNING * INTO v_limit_record;
  ELSE
    -- Reset daily count if needed
    IF v_limit_record.daily_reset_at <= v_now THEN
      UPDATE ai_chat_usage_limits
      SET daily_count = 0,
          daily_reset_at = v_now + interval '1 day',
          ip_address = v_client_ip
      WHERE id = v_limit_record.id
      RETURNING * INTO v_limit_record;
    END IF;

    -- Reset hourly count if needed
    IF v_limit_record.hourly_reset_at <= v_now THEN
      UPDATE ai_chat_usage_limits
      SET hourly_count = 0,
          hourly_reset_at = v_now + interval '1 hour',
          ip_address = v_client_ip
      WHERE id = v_limit_record.id
      RETURNING * INTO v_limit_record;
    END IF;
  END IF;

  -- Return current status
  RETURN jsonb_build_object(
    'allowed', (v_limit_record.daily_count < v_daily_limit) AND (v_limit_record.hourly_count < v_hourly_limit),
    'daily_count', v_limit_record.daily_count,
    'daily_limit', v_daily_limit,
    'hourly_count', v_limit_record.hourly_count,
    'hourly_limit', v_hourly_limit,
    'daily_reset_at', v_limit_record.daily_reset_at,
    'hourly_reset_at', v_limit_record.hourly_reset_at
  );
END;
$$;

-- Recreate the increment_ai_chat_usage function with IP validation
CREATE OR REPLACE FUNCTION increment_ai_chat_usage(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit_record ai_chat_usage_limits%ROWTYPE;
  v_client_ip inet;
BEGIN
  -- Get client IP address
  v_client_ip := inet_client_addr();
  
  IF v_client_ip IS NULL THEN
    v_client_ip := '0.0.0.0'::inet;
  END IF;

  -- Find the record and validate IP
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_limit_record
    FROM ai_chat_usage_limits
    WHERE user_id = p_user_id;
  ELSE
    SELECT * INTO v_limit_record
    FROM ai_chat_usage_limits
    WHERE session_id = p_session_id;
  END IF;

  -- If record not found or IP mismatch, reject
  IF NOT FOUND OR (v_limit_record.ip_address IS NOT NULL AND v_limit_record.ip_address != v_client_ip) THEN
    RETURN false;
  END IF;

  -- Increment counters
  UPDATE ai_chat_usage_limits
  SET daily_count = daily_count + 1,
      hourly_count = hourly_count + 1,
      ip_address = v_client_ip
  WHERE id = v_limit_record.id;

  RETURN true;
END;
$$;
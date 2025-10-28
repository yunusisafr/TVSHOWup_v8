/*
  # Fix AI Chat Rate Limiting Auto-Initialization

  Updates check_and_reset_ai_chat_limits to automatically create records if they don't exist.
  This ensures users don't need separate initialization calls.
*/

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
) AS $$
DECLARE
  v_record ai_chat_usage_limits;
  v_now timestamptz := now();
  v_hours_since_reset numeric;
  v_base_limit integer := 5; -- default guest limit
BEGIN
  -- Find existing record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE user_id = p_user_id;
    v_base_limit := 25; -- registered user limit
  ELSE
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE session_id = p_session_id;
    v_base_limit := 5; -- guest limit
  END IF;

  -- If no record exists, create it automatically
  IF v_record.id IS NULL THEN
    INSERT INTO ai_chat_usage_limits (user_id, session_id, daily_limit, bonus_limit, used_count, last_reset_at)
    VALUES (p_user_id, p_session_id, v_base_limit, 0, 0, v_now)
    RETURNING * INTO v_record;
  END IF;

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

  -- Return current state
  RETURN QUERY SELECT 
    v_record.daily_limit,
    v_record.bonus_limit,
    v_record.used_count,
    (v_record.daily_limit + v_record.bonus_limit - v_record.used_count) as remaining,
    v_record.last_reset_at + interval '24 hours' as reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
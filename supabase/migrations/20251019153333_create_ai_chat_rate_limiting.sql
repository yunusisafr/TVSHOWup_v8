/*
  # AI Chat Rate Limiting & Reward System

  1. New Tables
    - `ai_chat_usage_limits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable) - null for anonymous users
      - `session_id` (text, nullable) - for anonymous users
      - `daily_limit` (integer) - base daily limit
      - `bonus_limit` (integer) - extra earned limits
      - `used_count` (integer) - prompts used today
      - `last_reset_at` (timestamptz) - when limits were last reset
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ai_chat_rewards`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `reward_type` (text) - 'ad_click', 'page_view', 'list_created'
      - `reward_amount` (integer) - bonus prompts earned
      - `earned_at` (timestamptz)
      - `expires_at` (timestamptz) - rewards expire after 24h

  2. Security
    - Enable RLS on both tables
    - Users can only access their own records
    - Anonymous users tracked by session_id

  3. Default Limits
    - Guests (anonymous): 5 per day
    - Registered users: 25 per day
    - Admins: 100 per day

  4. Rewards
    - Ad click: +5 prompts
    - Page view: +1 prompt
    - List created: +5 prompts
*/

-- Create ai_chat_usage_limits table
CREATE TABLE IF NOT EXISTS ai_chat_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  daily_limit integer NOT NULL DEFAULT 5,
  bonus_limit integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Create unique index for user_id
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_usage_limits_user_id_idx 
  ON ai_chat_usage_limits(user_id) 
  WHERE user_id IS NOT NULL;

-- Create unique index for session_id
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_usage_limits_session_id_idx 
  ON ai_chat_usage_limits(session_id) 
  WHERE session_id IS NOT NULL;

-- Create index for last_reset_at for efficient cleanup
CREATE INDEX IF NOT EXISTS ai_chat_usage_limits_reset_at_idx 
  ON ai_chat_usage_limits(last_reset_at);

-- Create ai_chat_rewards table
CREATE TABLE IF NOT EXISTS ai_chat_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('ad_click', 'page_view', 'list_created')),
  reward_amount integer NOT NULL DEFAULT 1,
  earned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create index for user_id and expiration
CREATE INDEX IF NOT EXISTS ai_chat_rewards_user_id_idx ON ai_chat_rewards(user_id);
CREATE INDEX IF NOT EXISTS ai_chat_rewards_expires_at_idx ON ai_chat_rewards(expires_at);

-- Enable RLS
ALTER TABLE ai_chat_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_usage_limits
CREATE POLICY "Users can view own usage limits"
  ON ai_chat_usage_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage limits"
  ON ai_chat_usage_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage limits"
  ON ai_chat_usage_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anonymous users can manage their session limits (no auth required)
CREATE POLICY "Anonymous users can view session limits"
  ON ai_chat_usage_limits FOR SELECT
  TO anon
  USING (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can insert session limits"
  ON ai_chat_usage_limits FOR INSERT
  TO anon
  WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Anonymous users can update session limits"
  ON ai_chat_usage_limits FOR UPDATE
  TO anon
  USING (session_id IS NOT NULL AND user_id IS NULL)
  WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

-- RLS Policies for ai_chat_rewards
CREATE POLICY "Users can view own rewards"
  ON ai_chat_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards"
  ON ai_chat_rewards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to check and reset limits if needed
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
BEGIN
  -- Find existing record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE user_id = p_user_id;
  ELSE
    SELECT * INTO v_record FROM ai_chat_usage_limits WHERE session_id = p_session_id;
  END IF;

  -- If no record exists, return NULL (will be created by app)
  IF v_record.id IS NULL THEN
    RETURN;
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

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_ai_chat_usage(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_current_used integer;
  v_total_limit integer;
BEGIN
  -- Get current usage and limits
  IF p_user_id IS NOT NULL THEN
    SELECT used_count, (daily_limit + bonus_limit) INTO v_current_used, v_total_limit
    FROM ai_chat_usage_limits
    WHERE user_id = p_user_id;
  ELSE
    SELECT used_count, (daily_limit + bonus_limit) INTO v_current_used, v_total_limit
    FROM ai_chat_usage_limits
    WHERE session_id = p_session_id;
  END IF;

  -- Check if limit exceeded
  IF v_current_used >= v_total_limit THEN
    RETURN false;
  END IF;

  -- Increment usage
  IF p_user_id IS NOT NULL THEN
    UPDATE ai_chat_usage_limits
    SET used_count = used_count + 1, updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE ai_chat_usage_limits
    SET used_count = used_count + 1, updated_at = now()
    WHERE session_id = p_session_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add bonus limit (rewards)
CREATE OR REPLACE FUNCTION add_ai_chat_bonus(
  p_user_id uuid,
  p_reward_type text,
  p_amount integer
)
RETURNS boolean AS $$
BEGIN
  -- Add reward record
  INSERT INTO ai_chat_rewards (user_id, reward_type, reward_amount)
  VALUES (p_user_id, p_reward_type, p_amount);

  -- Update bonus limit
  UPDATE ai_chat_usage_limits
  SET bonus_limit = bonus_limit + p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for expired rewards (should be run daily by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_rewards()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_chat_rewards WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
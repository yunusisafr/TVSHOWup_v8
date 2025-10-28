/*
  # Analytics System Schema

  1. New Tables
    - `analytics_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - for anonymous tracking)
      - `event_type` (text) - Type of event (page_view, search, discovery, etc.)
      - `event_data` (jsonb) - Event-specific data
      - `session_id` (text) - Browser session identifier
      - `page_url` (text) - URL where event occurred
      - `user_agent` (text) - Browser user agent
      - `timestamp` (timestamptz) - When event occurred
      - `created_at` (timestamptz)

    - `performance_metrics`
      - `id` (uuid, primary key)
      - `metric_name` (text) - Name of the metric (api_response_time, page_load_time, etc.)
      - `metric_value` (numeric) - Measured value
      - `context` (jsonb) - Additional context data
      - `timestamp` (timestamptz) - When metric was recorded
      - `created_at` (timestamptz)

    - `user_behaviors`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action_type` (text) - Type of action (view, rate, add_to_watchlist, etc.)
      - `content_id` (integer) - TMDB content ID
      - `content_type` (text) - movie or tv_show
      - `metadata` (jsonb) - Additional action data
      - `timestamp` (timestamptz) - When action occurred
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Analytics events: Public insert (for anonymous tracking), admin read
    - Performance metrics: Public insert, admin read
    - User behaviors: Users can insert their own, read their own, admin read all

  3. Indexes
    - Index on event_type, timestamp for fast querying
    - Index on user_id for user-specific queries
    - Index on metric_name for performance analysis
*/

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  page_url text,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_behaviors table
CREATE TABLE IF NOT EXISTS user_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  content_id integer,
  content_type text CHECK (content_type IN ('movie', 'tv_show')),
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_id ON user_behaviors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_action_type ON user_behaviors(action_type);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_timestamp ON user_behaviors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_content ON user_behaviors(content_id, content_type);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behaviors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_events
-- Allow anyone to insert events (for anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read analytics events
CREATE POLICY "Admins can read all analytics events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Users can read their own events
CREATE POLICY "Users can read own analytics events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for performance_metrics
-- Allow anyone to insert metrics
CREATE POLICY "Anyone can insert performance metrics"
  ON performance_metrics FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read performance metrics
CREATE POLICY "Admins can read all performance metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- RLS Policies for user_behaviors
-- Users can insert their own behaviors
CREATE POLICY "Users can insert own behaviors"
  ON user_behaviors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own behaviors
CREATE POLICY "Users can read own behaviors"
  ON user_behaviors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all behaviors
CREATE POLICY "Admins can read all behaviors"
  ON user_behaviors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Create function to clean old analytics data (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM analytics_events WHERE timestamp < now() - interval '90 days';
  DELETE FROM performance_metrics WHERE timestamp < now() - interval '90 days';
  DELETE FROM user_behaviors WHERE timestamp < now() - interval '90 days';
END;
$$;

-- Create function to get user insights
CREATE OR REPLACE FUNCTION get_user_insights(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_actions', COUNT(*),
    'movies_viewed', COUNT(*) FILTER (WHERE content_type = 'movie' AND action_type = 'view'),
    'tv_shows_viewed', COUNT(*) FILTER (WHERE content_type = 'tv_show' AND action_type = 'view'),
    'total_ratings', COUNT(*) FILTER (WHERE action_type = 'rate'),
    'watchlist_additions', COUNT(*) FILTER (WHERE action_type = 'add_to_watchlist'),
    'swipe_likes', COUNT(*) FILTER (WHERE action_type = 'swipe_like'),
    'swipe_dislikes', COUNT(*) FILTER (WHERE action_type = 'swipe_dislike'),
    'last_activity', MAX(timestamp)
  )
  INTO result
  FROM user_behaviors
  WHERE user_id = target_user_id
  AND timestamp > now() - interval '30 days';

  RETURN result;
END;
$$;

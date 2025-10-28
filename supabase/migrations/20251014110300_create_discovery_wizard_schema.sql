/*
  # Discovery Wizard Enhanced Schema

  ## Overview
  This migration creates the database structure for the enhanced Discovery Wizard feature,
  enabling personalized content recommendations based on mood, preferences, and user behavior.

  ## New Tables

  ### 1. user_discovery_preferences
  Stores user preferences for personalized recommendations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `mood_history` (jsonb) - Last 30 mood selections with timestamps
  - `genre_scores` (jsonb) - Dynamic scoring for each genre (0-100)
  - `preferred_actors` (text[]) - Array of favorite actor names/IDs
  - `preferred_directors` (text[]) - Array of favorite director names/IDs
  - `platforms` (text[]) - Available streaming platforms
  - `avg_rating_threshold` (numeric) - Minimum rating preference
  - `preferred_duration_min` (integer) - Minimum content duration in minutes
  - `preferred_duration_max` (integer) - Maximum content duration in minutes
  - `swipe_history` (jsonb) - Liked/disliked content for learning
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. discovery_badges
  Gamification system for tracking user exploration achievements
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `badge_type` (text) - Type of achievement (genre_explorer, hidden_gem_finder, etc.)
  - `earned_at` (timestamptz)
  - `metadata` (jsonb) - Additional badge information

  ### 3. group_discovery_sessions
  Enables group viewing mode where multiple users collaborate on content selection
  - `id` (uuid, primary key)
  - `session_code` (text, unique) - 6-character code for joining
  - `participants` (jsonb) - Array of participant data and their preferences
  - `selected_content_id` (text) - Final selected content TMDB ID
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz) - Session expiry (24 hours)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own preferences and badges
  - Group sessions accessible by all participants
*/

-- Create user_discovery_preferences table
CREATE TABLE IF NOT EXISTS user_discovery_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood_history jsonb DEFAULT '[]'::jsonb,
  genre_scores jsonb DEFAULT '{}'::jsonb,
  preferred_actors text[] DEFAULT ARRAY[]::text[],
  preferred_directors text[] DEFAULT ARRAY[]::text[],
  platforms text[] DEFAULT ARRAY[]::text[],
  avg_rating_threshold numeric DEFAULT 6.0,
  preferred_duration_min integer DEFAULT 60,
  preferred_duration_max integer DEFAULT 180,
  swipe_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create discovery_badges table
CREATE TABLE IF NOT EXISTS discovery_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_type text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_type)
);

-- Create group_discovery_sessions table
CREATE TABLE IF NOT EXISTS group_discovery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text UNIQUE NOT NULL,
  participants jsonb DEFAULT '[]'::jsonb NOT NULL,
  selected_content_id text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Enable Row Level Security
ALTER TABLE user_discovery_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_discovery_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_discovery_preferences
CREATE POLICY "Users can view own discovery preferences"
  ON user_discovery_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discovery preferences"
  ON user_discovery_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discovery preferences"
  ON user_discovery_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own discovery preferences"
  ON user_discovery_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for discovery_badges
CREATE POLICY "Users can view own badges"
  ON discovery_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON discovery_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for group_discovery_sessions
CREATE POLICY "Anyone can view active group sessions by code"
  ON group_discovery_sessions FOR SELECT
  TO authenticated
  USING (expires_at > now());

CREATE POLICY "Authenticated users can create group sessions"
  ON group_discovery_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Participants can update group sessions"
  ON group_discovery_sessions FOR UPDATE
  TO authenticated
  USING (expires_at > now());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_discovery_preferences_user_id 
  ON user_discovery_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_discovery_badges_user_id 
  ON discovery_badges(user_id);

CREATE INDEX IF NOT EXISTS idx_group_discovery_sessions_code 
  ON group_discovery_sessions(session_code);

CREATE INDEX IF NOT EXISTS idx_group_discovery_sessions_expires 
  ON group_discovery_sessions(expires_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_discovery_preferences
DROP TRIGGER IF EXISTS update_user_discovery_preferences_updated_at ON user_discovery_preferences;
CREATE TRIGGER update_user_discovery_preferences_updated_at
  BEFORE UPDATE ON user_discovery_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Social Features Schema

  1. New Tables
    - `social_recommendations`
      - User-to-user content recommendations
    - `user_following`
      - Follow/follower relationships
    - `shared_list_likes`
      - Likes on shared watchlists

  2. Security
    - Enable RLS on all tables
    - Users can manage their own data
    - Public can view public content

  3. Indexes
    - Optimized for social queries
*/

-- Create social_recommendations table
CREATE TABLE IF NOT EXISTS social_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id integer NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('movie', 'tv_show')),
  message text,
  rating numeric CHECK (rating >= 0 AND rating <= 10),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, content_id, content_type)
);

-- Create user_following table
CREATE TABLE IF NOT EXISTS user_following (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create shared_list_likes table
CREATE TABLE IF NOT EXISTS shared_list_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, list_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_social_recommendations_to_user ON social_recommendations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_social_recommendations_from_user ON social_recommendations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_social_recommendations_content ON social_recommendations(content_id, content_type);

CREATE INDEX IF NOT EXISTS idx_user_following_follower ON user_following(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_following_following ON user_following(following_id);

CREATE INDEX IF NOT EXISTS idx_shared_list_likes_user ON shared_list_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_list_likes_list ON shared_list_likes(list_id);

-- Enable RLS
ALTER TABLE social_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_following ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_list_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_recommendations

CREATE POLICY "Users can send recommendations"
  ON social_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can view recommendations sent to them"
  ON social_recommendations FOR SELECT
  TO authenticated
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());

CREATE POLICY "Users can delete recommendations they sent"
  ON social_recommendations FOR DELETE
  TO authenticated
  USING (from_user_id = auth.uid());

-- RLS Policies for user_following

CREATE POLICY "Users can follow others"
  ON user_following FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can view their following/followers"
  ON user_following FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can unfollow"
  ON user_following FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- RLS Policies for shared_list_likes

CREATE POLICY "Users can like lists"
  ON shared_list_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone can view list likes"
  ON shared_list_likes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can unlike lists"
  ON shared_list_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to get follower count
CREATE OR REPLACE FUNCTION get_follower_count(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count integer;
BEGIN
  SELECT COUNT(*)
  INTO count
  FROM user_following
  WHERE following_id = target_user_id;

  RETURN count;
END;
$$;

-- Function to get following count
CREATE OR REPLACE FUNCTION get_following_count(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count integer;
BEGIN
  SELECT COUNT(*)
  INTO count
  FROM user_following
  WHERE follower_id = target_user_id;

  RETURN count;
END;
$$;

-- Function to check if user is following another
CREATE OR REPLACE FUNCTION is_following(follower uuid, following uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM user_following
    WHERE follower_id = follower AND following_id = following
  ) INTO exists;

  RETURN exists;
END;
$$;

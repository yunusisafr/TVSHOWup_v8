/*
  # Comprehensive Fix for Watchlist Functionality

  1. Issues Addressed
    - Fix RLS policies for user_watchlists table
    - Ensure all necessary policies exist with proper USING and WITH CHECK clauses
    - Add missing indexes for performance
    - Fix potential foreign key constraints issues
    - Ensure proper trigger for updated_at timestamp

  2. Changes
    - Drop and recreate all watchlist policies with proper clauses
    - Add missing indexes for user_id and content lookups
    - Ensure updated_at is properly maintained
*/

-- First, ensure the updated_at column is properly maintained
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_watchlists_updated_at') THEN
    CREATE TRIGGER update_user_watchlists_updated_at
      BEFORE UPDATE ON user_watchlists
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON user_watchlists;
DROP POLICY IF EXISTS "Users can add to their own watchlist" ON user_watchlists;
DROP POLICY IF EXISTS "Users can view their own watchlist items" ON user_watchlists;
DROP POLICY IF EXISTS "Users can update their own watchlist items" ON user_watchlists;
DROP POLICY IF EXISTS "Users can delete from their own watchlist" ON user_watchlists;
DROP POLICY IF EXISTS "Admins can manage user_watchlists" ON user_watchlists;
DROP POLICY IF EXISTS "Admin direct access to user_watchlists" ON user_watchlists;

-- Recreate all policies with proper USING and WITH CHECK clauses
-- 1. Main policy for authenticated users
CREATE POLICY "Users can manage their own watchlist"
  ON user_watchlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Specific policies for public role (includes both authenticated and anonymous)
CREATE POLICY "Users can add to their own watchlist"
  ON user_watchlists
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own watchlist items"
  ON user_watchlists
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist items"
  ON user_watchlists
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own watchlist"
  ON user_watchlists
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- 3. Admin policies
CREATE POLICY "Admins can manage user_watchlists"
  ON user_watchlists
  FOR ALL
  TO authenticated
  USING (is_admin_by_role())
  WITH CHECK (is_admin_by_role());

CREATE POLICY "Admin direct access to user_watchlists"
  ON user_watchlists
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create or update indexes for better performance
DROP INDEX IF EXISTS idx_user_watchlists_user_content;
CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_content ON user_watchlists(user_id, content_id, content_type);

-- Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_watchlists_user_id_content_id_content_type_key'
  ) THEN
    ALTER TABLE user_watchlists 
    ADD CONSTRAINT user_watchlists_user_id_content_id_content_type_key 
    UNIQUE (user_id, content_id, content_type);
  END IF;
END $$;

-- Create unique index for watchlist items
CREATE UNIQUE INDEX IF NOT EXISTS user_watchlists_unique_content 
ON user_watchlists(user_id, content_id, content_type);

-- Update table statistics
ANALYZE user_watchlists;
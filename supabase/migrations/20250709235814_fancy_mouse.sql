/*
  # Fix Watchlist Button Policy

  1. Changes
    - Add missing WITH CHECK clause to "Users can manage their own watchlist" policy
    - This ensures authenticated users can properly add and update their watchlist items
    - Fixes the issue where the watchlist button wasn't working for logged-in users

  2. Security
    - Maintains existing security model
    - Only allows users to manage their own watchlist items
*/

-- Drop and recreate the policy with both USING and WITH CHECK clauses
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON user_watchlists;

CREATE POLICY "Users can manage their own watchlist"
  ON user_watchlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
/*
  # Fix Admin Panel RLS Policies

  ## Summary
  Adds additional RLS policies to ensure admin users can properly access
  and manage data in the admin panel.

  ## 1. Changes
    - Add admin policy for viewing all user profiles
    - Add admin policy for viewing all user lists
    - Add admin policy for viewing user watchlists (for stats)
    - Ensure admins can read all data needed for admin dashboard

  ## 2. Security
    - All policies check admin_users table for admin/editor role
    - Uses auth.uid() to verify authenticated user
    - Maintains security while allowing admin operations
*/

-- Policy for admins to view all user profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Admins can view all user profiles'
  ) THEN
    CREATE POLICY "Admins can view all user profiles"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
          AND admin_users.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Policy for admins to view all user lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_lists' 
    AND policyname = 'Admins can view all user lists'
  ) THEN
    CREATE POLICY "Admins can view all user lists"
      ON user_lists FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
          AND admin_users.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Policy for admins to view all watchlists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_watchlists' 
    AND policyname = 'Admins can view all watchlists'
  ) THEN
    CREATE POLICY "Admins can view all watchlists"
      ON user_watchlists FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
          AND admin_users.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;
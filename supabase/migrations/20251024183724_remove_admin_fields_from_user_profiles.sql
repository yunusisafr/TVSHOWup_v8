/*
  # Remove admin fields from user_profiles table

  1. Changes
    - Remove `is_admin` column from user_profiles table
    - Remove `admin_role` column from user_profiles table
  
  2. Reason
    - Admin status should ONLY be determined by the admin_users table
    - Users registered normally should have NO admin privileges by default
    - This prevents any confusion or automatic admin privileges
  
  3. Security
    - All admin checks now exclusively use the admin_users table
    - No automatic admin privileges for any user
    - Admin status must be explicitly granted through admin_users table
*/

-- Remove admin-related columns from user_profiles
DO $$
BEGIN
  -- Drop is_admin column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN is_admin;
  END IF;

  -- Drop admin_role column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'admin_role'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN admin_role;
  END IF;
END $$;

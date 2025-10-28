/*
  # Add Admin Role Column to User Profiles
  
  1. Changes
    - Add `admin_role` column to user_profiles table (admin, moderator, editor, null)
    - Migrate existing is_admin=true users to admin_role='admin'
    - Keep is_admin for backward compatibility
    
  2. Security
    - Maintains existing RLS policies
*/

-- Add admin_role column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'admin_role'
  ) THEN
    ALTER TABLE user_profiles 
      ADD COLUMN admin_role VARCHAR(20) CHECK (admin_role IN ('admin', 'moderator', 'editor'));
  END IF;
END $$;

-- Migrate existing is_admin users to admin role
UPDATE user_profiles 
SET admin_role = 'admin' 
WHERE is_admin = true AND admin_role IS NULL;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin_role ON user_profiles(admin_role) WHERE admin_role IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN user_profiles.admin_role IS 'Admin role: admin (full access), moderator (content moderation), editor (content editing)';

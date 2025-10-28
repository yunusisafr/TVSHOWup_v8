/*
  # Fix User Profiles Table and Policies

  1. Changes
    - Create user_profiles table if it doesn't exist
    - Add proper RLS policies for user_profiles
    - Fix the handle_new_user function to properly create profiles
    - Ensure all required columns exist with proper defaults

  2. Security
    - Maintain existing security model
    - Ensure users can only access their own profiles
    - Allow public read access for basic profile information
*/

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(255),
  country_code VARCHAR(2) DEFAULT 'TR',
  language_code VARCHAR(2) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Public can view user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all user profiles" ON user_profiles;

-- Create comprehensive policies for user_profiles
CREATE POLICY "Users can manage their own profile"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can view user profiles"
  ON user_profiles
  FOR SELECT
  TO public
  USING (true);

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  display_name_val TEXT;
BEGIN
  -- Get display name from metadata or email
  display_name_val := COALESCE(
    NEW.raw_user_meta_data->>'displayName',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Insert or update the user profile
  INSERT INTO user_profiles (
    id,
    email,
    display_name,
    avatar_url,
    country_code,
    language_code,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    display_name_val,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'TR',
    'tr',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
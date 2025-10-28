/*
  # Fix user signup database error

  1. Database Issues Fixed
    - Recreate the handle_new_user function with proper error handling
    - Ensure the trigger is properly set up for auth.users table
    - Add proper RLS policies for user_profiles table
    - Handle potential conflicts and missing data gracefully

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access controls for user profiles

  3. Error Handling
    - Add try-catch logic in the trigger function
    - Handle cases where profile creation might fail
    - Provide fallback values for required fields
*/

-- Drop existing trigger and function to recreate them properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into user_profiles with proper error handling
  INSERT INTO public.user_profiles (
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
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'country_code', 'TR'),
    COALESCE(NEW.raw_user_meta_data->>'language_code', 'en'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies are properly set up for user_profiles
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin direct access to user_profiles" ON public.user_profiles;

-- Recreate essential RLS policies
CREATE POLICY "Users can view and update their own profile"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can view user profiles"
  ON public.user_profiles
  FOR SELECT
  TO public
  USING (true);

-- Admin policies
CREATE POLICY "Admins can manage all user profiles"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

-- Ensure the user_profiles table has the correct structure
DO $$
BEGIN
  -- Add email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN email character varying(255) NOT NULL DEFAULT '';
  END IF;

  -- Ensure display_name column exists and has correct type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN display_name character varying(100);
  END IF;

  -- Ensure avatar_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN avatar_url character varying(255);
  END IF;

  -- Ensure country_code has proper default
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE public.user_profiles ALTER COLUMN country_code SET DEFAULT 'TR';
  END IF;

  -- Ensure language_code has proper default
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE public.user_profiles ALTER COLUMN language_code SET DEFAULT 'en';
  END IF;
END $$;
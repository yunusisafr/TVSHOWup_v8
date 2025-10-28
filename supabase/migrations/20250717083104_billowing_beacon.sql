/*
  # Make Display Name Required and Unique

  1. Schema Changes
    - Make display_name column NOT NULL in user_profiles table
    - Add UNIQUE constraint to display_name column
    - Update existing NULL display_name values with email prefix

  2. Validation
    - Add trigger function to validate display_name format
    - Ensure display_name is at least 3 characters
    - Allow only alphanumeric characters, underscores, and hyphens

  3. Security
    - Maintain existing RLS policies
*/

-- First, update any existing NULL display_name values
UPDATE public.user_profiles 
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL OR display_name = '';

-- Create validation function for display_name
CREATE OR REPLACE FUNCTION validate_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if display_name is at least 3 characters
  IF LENGTH(NEW.display_name) < 3 THEN
    RAISE EXCEPTION 'Display name must be at least 3 characters long';
  END IF;
  
  -- Check if display_name contains only allowed characters
  IF NEW.display_name !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Display name can only contain letters, numbers, underscores, and hyphens';
  END IF;
  
  -- Convert to lowercase for consistency
  NEW.display_name = LOWER(NEW.display_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the validation trigger (already exists, but ensure it's updated)
DROP TRIGGER IF EXISTS validate_display_name_trigger ON public.user_profiles;
CREATE TRIGGER validate_display_name_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION validate_display_name();

-- Make display_name NOT NULL
ALTER TABLE public.user_profiles 
ALTER COLUMN display_name SET NOT NULL;

-- Ensure display_name is unique (constraint already exists, but ensure it's there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_display_name_key' 
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_display_name_key UNIQUE (display_name);
  END IF;
END $$;
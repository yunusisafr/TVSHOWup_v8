/*
  # Make Display Name Required and Unique

  1. Changes
     - Add NOT NULL constraint to display_name column in user_profiles table
     - Add UNIQUE constraint to display_name column in user_profiles table
     - Add trigger to validate display_name on insert and update
  
  2. Security
     - No changes to RLS policies
*/

-- Add NOT NULL constraint to display_name column
ALTER TABLE public.user_profiles 
  ALTER COLUMN display_name SET NOT NULL;

-- Add UNIQUE constraint to display_name column
ALTER TABLE public.user_profiles 
  ADD CONSTRAINT user_profiles_display_name_key UNIQUE (display_name);

-- Create function to validate display_name format
CREATE OR REPLACE FUNCTION validate_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if display_name is not null and not empty
  IF NEW.display_name IS NULL OR LENGTH(TRIM(NEW.display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name cannot be empty';
  END IF;
  
  -- Check if display_name has at least 3 characters
  IF LENGTH(NEW.display_name) < 3 THEN
    RAISE EXCEPTION 'Display name must be at least 3 characters long';
  END IF;
  
  -- Check if display_name contains only allowed characters (alphanumeric, underscore, hyphen)
  IF NEW.display_name !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Display name can only contain letters, numbers, underscores, and hyphens';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate display_name on insert and update
CREATE TRIGGER validate_display_name_trigger
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_display_name();
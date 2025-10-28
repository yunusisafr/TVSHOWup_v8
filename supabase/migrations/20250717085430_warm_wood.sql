/*
  # Add public watchlist feature to user profiles

  1. New Columns
    - `is_watchlist_public` (boolean): Indicates if the user's watchlist is public
    - `public_watchlist_slug` (text): Unique slug for the public watchlist URL

  2. Functions
    - Create function to ensure watchlist slug uniqueness
    
  3. Triggers
    - Add trigger to generate unique slug when watchlist is made public
*/

-- Add columns to user_profiles if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_watchlist_public') THEN
    ALTER TABLE public.user_profiles ADD COLUMN is_watchlist_public BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'public_watchlist_slug') THEN
    ALTER TABLE public.user_profiles ADD COLUMN public_watchlist_slug TEXT UNIQUE;
  END IF;
END $$;

-- Create function to ensure watchlist slug uniqueness
CREATE OR REPLACE FUNCTION ensure_watchlist_slug_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  slug_exists BOOLEAN;
BEGIN
  -- If slug is already set and not changing, do nothing
  IF OLD.public_watchlist_slug IS NOT NULL AND NEW.public_watchlist_slug = OLD.public_watchlist_slug THEN
    RETURN NEW;
  END IF;
  
  -- If slug is explicitly set, use it as base
  IF NEW.public_watchlist_slug IS NOT NULL THEN
    base_slug := NEW.public_watchlist_slug;
  ELSE
    -- Otherwise generate from display_name
    base_slug := LOWER(REGEXP_REPLACE(NEW.display_name, '[^a-zA-Z0-9]', '', 'g'));
    
    -- If base_slug is empty or too short, use a fallback
    IF LENGTH(base_slug) < 3 THEN
      base_slug := 'user' || FLOOR(RANDOM() * 10000)::TEXT;
    END IF;
  END IF;
  
  -- Try the base slug first
  final_slug := base_slug;
  
  -- Check if slug exists
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.user_profiles 
      WHERE public_watchlist_slug = final_slug 
      AND id != NEW.id
    ) INTO slug_exists;
    
    EXIT WHEN NOT slug_exists;
    
    -- If exists, append counter and try again
    counter := counter + 1;
    final_slug := base_slug || counter::TEXT;
  END LOOP;
  
  -- Set the final unique slug
  NEW.public_watchlist_slug := final_slug;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_watchlist_slug_trigger ON public.user_profiles;

-- Create trigger to ensure slug uniqueness when watchlist is made public
CREATE TRIGGER ensure_watchlist_slug_trigger
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
WHEN (NEW.is_watchlist_public = true)
EXECUTE FUNCTION ensure_watchlist_slug_uniqueness();

-- Add RLS policy for public watchlists if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_watchlists' 
    AND policyname = 'Anyone can view public watchlists'
  ) THEN
    CREATE POLICY "Anyone can view public watchlists" 
    ON public.user_watchlists
    FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = user_watchlists.user_id
        AND user_profiles.is_watchlist_public = true
      )
    );
  END IF;
END $$;
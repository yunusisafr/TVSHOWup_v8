/*
  # Add Public Watchlist Feature

  1. New Fields
    - Add `is_watchlist_public` boolean field to user_profiles (default false)
    - Add `public_watchlist_slug` text field to user_profiles (unique, nullable)
  
  2. Functions
    - Create function to generate unique slugs for public watchlists
    - Create trigger to ensure slugs are unique
*/

-- Add new columns to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_watchlist_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS public_watchlist_slug TEXT UNIQUE;

-- Create function to generate unique slugs
CREATE OR REPLACE FUNCTION generate_unique_watchlist_slug(display_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  slug_exists BOOLEAN;
BEGIN
  -- Create base slug from display name (lowercase, replace spaces with hyphens)
  base_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]', '-', 'g'));
  
  -- Remove consecutive hyphens
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  
  -- Remove leading and trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- If empty after cleaning, use a default
  IF base_slug = '' THEN
    base_slug := 'user';
  END IF;
  
  -- Start with base slug
  final_slug := base_slug;
  
  -- Check if slug exists
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.user_profiles 
      WHERE public_watchlist_slug = final_slug
    ) INTO slug_exists;
    
    EXIT WHEN NOT slug_exists;
    
    -- Increment counter and append to slug
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::TEXT;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to ensure slug uniqueness when updating
CREATE OR REPLACE FUNCTION ensure_watchlist_slug_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- If watchlist is being made public and slug is null, generate one
  IF NEW.is_watchlist_public = true AND NEW.public_watchlist_slug IS NULL THEN
    NEW.public_watchlist_slug := generate_unique_watchlist_slug(NEW.display_name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_profiles
DROP TRIGGER IF EXISTS ensure_watchlist_slug_trigger ON public.user_profiles;
CREATE TRIGGER ensure_watchlist_slug_trigger
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
WHEN (NEW.is_watchlist_public = true)
EXECUTE FUNCTION ensure_watchlist_slug_uniqueness();

-- Create RLS policy for public watchlists
CREATE POLICY "Anyone can view public watchlists"
ON public.user_watchlists
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = user_watchlists.user_id
    AND user_profiles.is_watchlist_public = true
  )
);
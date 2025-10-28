/*
  # Fix Slug Generation - Use English Title

  1. Problem
    - Many content items have invalid slugs like "516696-" (just ID with hyphen)
    - This happens when original_title contains non-Latin characters (Cyrillic, Japanese, Korean, Arabic, etc.)
    - The regex [^a-z0-9\s-] removes all non-Latin characters, leaving empty slug

  2. Solution
    - Use English title (`title` for movies, `name` for TV shows) as PRIMARY source
    - These always contain Latin characters that work in URLs
    - Keep original_title as fallback only if title is missing
    - If both are non-Latin, transliterate or use generic fallback

  3. Changes
    - Update slug generation function to prioritize English titles
    - Fix all existing invalid slugs in database
    - Invalid slugs are: NULL, empty, or just "ID-" format
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_movies_slug ON movies;
DROP TRIGGER IF EXISTS trigger_tv_shows_slug ON tv_shows;

-- Create improved slug generation function
CREATE OR REPLACE FUNCTION generate_content_slug()
RETURNS TRIGGER AS $$
DECLARE
  source_text TEXT;
  clean_text TEXT;
BEGIN
  IF TG_TABLE_NAME = 'movies' THEN
    -- For movies: Use English title first, then original_title as fallback
    source_text := COALESCE(NEW.title, NEW.original_title, 'movie');
  ELSIF TG_TABLE_NAME = 'tv_shows' THEN
    -- For TV shows: Use English name first, then original_name as fallback
    source_text := COALESCE(NEW.name, NEW.original_name, 'tv-show');
  ELSE
    source_text := 'content';
  END IF;
  
  -- Convert to lowercase and trim
  clean_text := lower(trim(source_text));
  
  -- Remove all non-alphanumeric characters except spaces and hyphens
  clean_text := regexp_replace(clean_text, '[^a-z0-9\s-]', '', 'g');
  
  -- Replace multiple spaces with single hyphen
  clean_text := regexp_replace(clean_text, '\s+', '-', 'g');
  
  -- Replace multiple hyphens with single hyphen
  clean_text := regexp_replace(clean_text, '-+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');
  
  -- If cleaning resulted in empty string, use generic fallback
  IF clean_text = '' OR clean_text IS NULL THEN
    IF TG_TABLE_NAME = 'movies' THEN
      clean_text := 'movie';
    ELSE
      clean_text := 'tv-show';
    END IF;
  END IF;
  
  -- Combine ID with cleaned text
  NEW.slug := NEW.id::TEXT || '-' || clean_text;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers (will fire on UPDATE for all rows)
CREATE TRIGGER trigger_movies_slug
  BEFORE INSERT OR UPDATE ON movies
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '' OR NEW.slug ~ '^\d+-?$')
  EXECUTE FUNCTION generate_content_slug();

CREATE TRIGGER trigger_tv_shows_slug
  BEFORE INSERT OR UPDATE ON tv_shows
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '' OR NEW.slug ~ '^\d+-?$')
  EXECUTE FUNCTION generate_content_slug();

-- Fix all existing invalid slugs in movies (NULL, empty, or just "ID-")
UPDATE movies
SET slug = NULL
WHERE slug IS NULL 
   OR slug = '' 
   OR slug ~ '^\d+-?$';

-- Fix all existing invalid slugs in tv_shows (NULL, empty, or just "ID-")
UPDATE tv_shows
SET slug = NULL
WHERE slug IS NULL 
   OR slug = '' 
   OR slug ~ '^\d+-?$';

/*
  # Automatic Slug Generation for Movies and TV Shows

  This migration creates database triggers to automatically generate slugs for new content.
  
  1. Functions
    - `generate_content_slug()` - Creates slug from ID and original title/name
    - Handles NULL values gracefully
    - Uses original_title for movies, original_name for TV shows
  
  2. Triggers
    - `trigger_movies_slug` - Auto-generates slug for movies on INSERT and UPDATE
    - `trigger_tv_shows_slug` - Auto-generates slug for TV shows on INSERT and UPDATE
  
  3. Updates
    - Fixes all existing NULL slugs in movies table
    - Fixes all existing NULL slugs in tv_shows table

  This ensures all content always has a valid slug for URL generation.
*/

-- Create function to generate slug
CREATE OR REPLACE FUNCTION generate_content_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'movies' THEN
    -- For movies, use original_title (fallback to title)
    NEW.slug := NEW.id::TEXT || '-' || 
      regexp_replace(
        regexp_replace(
          lower(trim(COALESCE(NEW.original_title, NEW.title, 'content-' || NEW.id::TEXT))),
          '[^a-z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      );
  ELSIF TG_TABLE_NAME = 'tv_shows' THEN
    -- For TV shows, use original_name (fallback to name)
    NEW.slug := NEW.id::TEXT || '-' || 
      regexp_replace(
        regexp_replace(
          lower(trim(COALESCE(NEW.original_name, NEW.name, 'content-' || NEW.id::TEXT))),
          '[^a-z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      );
  END IF;
  
  -- Clean up multiple hyphens
  NEW.slug := regexp_replace(NEW.slug, '-+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  NEW.slug := regexp_replace(NEW.slug, '^-+|-+$', '', 'g');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for movies
DROP TRIGGER IF EXISTS trigger_movies_slug ON movies;
CREATE TRIGGER trigger_movies_slug
  BEFORE INSERT OR UPDATE ON movies
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '')
  EXECUTE FUNCTION generate_content_slug();

-- Create trigger for tv_shows
DROP TRIGGER IF EXISTS trigger_tv_shows_slug ON tv_shows;
CREATE TRIGGER trigger_tv_shows_slug
  BEFORE INSERT OR UPDATE ON tv_shows
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '')
  EXECUTE FUNCTION generate_content_slug();

-- Update all existing NULL or empty slugs in movies
UPDATE movies
SET slug = NULL  -- Trigger will regenerate it
WHERE slug IS NULL OR slug = '';

-- Update all existing NULL or empty slugs in tv_shows
UPDATE tv_shows
SET slug = NULL  -- Trigger will regenerate it
WHERE slug IS NULL OR slug = '';

-- Create index on slug columns for better performance
CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug);
CREATE INDEX IF NOT EXISTS idx_tv_shows_slug ON tv_shows(slug);
/*
  # Fix Slugs to Use Original Name/Title

  This migration updates all slugs to use original_name (for TV shows) and 
  original_title (for movies) to ensure consistent URLs across all languages.

  1. TV Shows
    - Update all slugs to use original_name
    - Format: {id}-{slugified-original-name}
  
  2. Movies
    - Update all slugs to use original_title
    - Format: {id}-{slugified-original-title}

  This ensures that URLs remain stable regardless of language selection.
*/

-- Function to create slug from text
CREATE OR REPLACE FUNCTION create_slug(content_id INTEGER, title TEXT) 
RETURNS TEXT AS $$
BEGIN
  IF title IS NULL OR title = '' THEN
    RETURN content_id::TEXT;
  END IF;
  
  RETURN content_id::TEXT || '-' || 
    regexp_replace(
      regexp_replace(
        lower(trim(title)),
        '[^a-z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update TV shows slugs to use original_name
UPDATE tv_shows
SET slug = create_slug(id, COALESCE(original_name, name))
WHERE slug IS NULL 
   OR slug != create_slug(id, COALESCE(original_name, name));

-- Update movies slugs to use original_title
UPDATE movies
SET slug = create_slug(id, COALESCE(original_title, title))
WHERE slug IS NULL 
   OR slug != create_slug(id, COALESCE(original_title, title));

-- Drop the helper function
DROP FUNCTION IF EXISTS create_slug(INTEGER, TEXT);

/*
  # Migrate Existing Content to Multilingual Structure

  1. Migration Overview
    - Updates existing movies and TV shows with multilingual translations
    - Preserves existing data while adding new translation fields
    - Uses existing title/overview as fallback for English translations

  2. Changes
    - Populates title_translations, overview_translations, tagline_translations for movies
    - Populates name_translations, overview_translations, tagline_translations for tv_shows
    - Sets default English translations from existing data
    - Prepares structure for additional language translations

  3. Notes
    - This migration only sets up the structure with English defaults
    - A separate script will fetch translations from TMDB for other languages
*/

-- Update existing movies with default English translations
UPDATE movies 
SET 
  title_translations = COALESCE(title_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(title, '')),
  overview_translations = COALESCE(overview_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(overview, '')),
  tagline_translations = COALESCE(tagline_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(tagline, ''))
WHERE 
  title_translations IS NULL 
  OR overview_translations IS NULL 
  OR tagline_translations IS NULL
  OR NOT (title_translations ? 'en')
  OR NOT (overview_translations ? 'en')
  OR NOT (tagline_translations ? 'en');

-- Update existing TV shows with default English translations
UPDATE tv_shows 
SET 
  name_translations = COALESCE(name_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(name, '')),
  overview_translations = COALESCE(overview_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(overview, '')),
  tagline_translations = COALESCE(tagline_translations, '{}')::jsonb || jsonb_build_object('en', COALESCE(tagline, ''))
WHERE 
  name_translations IS NULL 
  OR overview_translations IS NULL 
  OR tagline_translations IS NULL
  OR NOT (name_translations ? 'en')
  OR NOT (overview_translations ? 'en')
  OR NOT (tagline_translations ? 'en');

-- Create a function to check translation completeness
CREATE OR REPLACE FUNCTION check_translation_completeness()
RETURNS TABLE(
  content_type text,
  total_items bigint,
  items_with_en_title bigint,
  items_with_en_overview bigint,
  items_missing_translations bigint
) AS $$
BEGIN
  -- Check movies
  RETURN QUERY
  SELECT 
    'movies'::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE title_translations ? 'en')::bigint,
    COUNT(*) FILTER (WHERE overview_translations ? 'en')::bigint,
    COUNT(*) FILTER (WHERE NOT (title_translations ? 'en') OR NOT (overview_translations ? 'en'))::bigint
  FROM movies;
  
  -- Check TV shows
  RETURN QUERY
  SELECT 
    'tv_shows'::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE name_translations ? 'en')::bigint,
    COUNT(*) FILTER (WHERE overview_translations ? 'en')::bigint,
    COUNT(*) FILTER (WHERE NOT (name_translations ? 'en') OR NOT (overview_translations ? 'en'))::bigint
  FROM tv_shows;
END;
$$ LANGUAGE plpgsql;
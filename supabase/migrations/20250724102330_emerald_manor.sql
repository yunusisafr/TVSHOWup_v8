/*
  # Add Multilingual Content Support

  1. New Columns
    - `movies` table:
      - `title_translations` (jsonb) - Stores title translations for all supported languages
      - `overview_translations` (jsonb) - Stores overview translations for all supported languages  
      - `tagline_translations` (jsonb) - Stores tagline translations for all supported languages
    - `tv_shows` table:
      - `name_translations` (jsonb) - Stores name translations for all supported languages
      - `overview_translations` (jsonb) - Stores overview translations for all supported languages
      - `tagline_translations` (jsonb) - Stores tagline translations for all supported languages

  2. Changes
    - Add new JSONB columns to store multilingual content
    - Keep existing columns for backward compatibility
    - Add indexes for better query performance on JSONB fields
*/

-- Add multilingual columns to movies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'title_translations'
  ) THEN
    ALTER TABLE movies ADD COLUMN title_translations jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'overview_translations'
  ) THEN
    ALTER TABLE movies ADD COLUMN overview_translations jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'tagline_translations'
  ) THEN
    ALTER TABLE movies ADD COLUMN tagline_translations jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add multilingual columns to tv_shows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_shows' AND column_name = 'name_translations'
  ) THEN
    ALTER TABLE tv_shows ADD COLUMN name_translations jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_shows' AND column_name = 'overview_translations'
  ) THEN
    ALTER TABLE tv_shows ADD COLUMN overview_translations jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_shows' AND column_name = 'tagline_translations'
  ) THEN
    ALTER TABLE tv_shows ADD COLUMN tagline_translations jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add indexes for better performance on JSONB fields
CREATE INDEX IF NOT EXISTS idx_movies_title_translations ON movies USING gin (title_translations);
CREATE INDEX IF NOT EXISTS idx_movies_overview_translations ON movies USING gin (overview_translations);
CREATE INDEX IF NOT EXISTS idx_tv_shows_name_translations ON tv_shows USING gin (name_translations);
CREATE INDEX IF NOT EXISTS idx_tv_shows_overview_translations ON tv_shows USING gin (overview_translations);

-- Create function to get localized text from JSONB translations
CREATE OR REPLACE FUNCTION get_localized_text(translations jsonb, language_code text, fallback_language text DEFAULT 'en')
RETURNS text AS $$
BEGIN
  -- Return empty string if translations is null
  IF translations IS NULL THEN
    RETURN '';
  END IF;
  
  -- Try to get text in requested language
  IF translations ? language_code THEN
    RETURN translations ->> language_code;
  END IF;
  
  -- Fallback to fallback language (usually English)
  IF translations ? fallback_language THEN
    RETURN translations ->> fallback_language;
  END IF;
  
  -- If no translation found, return empty string
  RETURN '';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
/*
  # Add poster_paths_by_language column

  1. New Columns
    - Add `poster_paths_by_language` (jsonb) to `movies` table
    - Add `poster_paths_by_language` (jsonb) to `tv_shows` table
  
  2. Purpose
    - Store localized poster paths for different languages
    - Support multilingual poster display functionality
  
  3. Changes
    - Movies table: Add poster_paths_by_language column
    - TV Shows table: Add poster_paths_by_language column
*/

-- Add poster_paths_by_language column to movies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'poster_paths_by_language'
  ) THEN
    ALTER TABLE movies ADD COLUMN poster_paths_by_language jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add poster_paths_by_language column to tv_shows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_shows' AND column_name = 'poster_paths_by_language'
  ) THEN
    ALTER TABLE tv_shows ADD COLUMN poster_paths_by_language jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
/*
  # Add slug columns to movies and tv_shows tables

  1. Schema Changes
    - Add `slug` column to `movies` table
    - Add `slug` column to `tv_shows` table
    - Create unique indexes for slug columns
    - Add function to generate slugs from titles

  2. Security
    - No RLS changes needed as these are existing tables
*/

-- Add slug column to movies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.movies ADD COLUMN slug character varying(255);
  END IF;
END $$;

-- Add slug column to tv_shows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_shows' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.tv_shows ADD COLUMN slug character varying(255);
  END IF;
END $$;

-- Create unique index for movies slug (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'movies' AND indexname = 'movies_slug_key'
  ) THEN
    CREATE UNIQUE INDEX movies_slug_key ON public.movies USING btree (slug);
  END IF;
END $$;

-- Create unique index for tv_shows slug (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tv_shows' AND indexname = 'tv_shows_slug_key'
  ) THEN
    CREATE UNIQUE INDEX tv_shows_slug_key ON public.tv_shows USING btree (slug);
  END IF;
END $$;

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(title, '[^\w\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;
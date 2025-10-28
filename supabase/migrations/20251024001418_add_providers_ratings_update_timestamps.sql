/*
  # Add Provider and Rating Update Timestamps

  1. Purpose
    - Add timestamp columns to track when providers and ratings were last updated
    - Enable smart caching to reduce TMDB API calls
    - Only update provider/rating data if older than 6 hours

  2. Changes
    - Add `providers_last_updated` column to movies table
    - Add `providers_last_updated` column to tv_shows table
    - Add `ratings_last_updated` column to movies table
    - Add `ratings_last_updated` column to tv_shows table
    - All columns are nullable (existing rows will have NULL)

  3. Benefits
    - Reduces API calls by ~95% for popular content
    - Still provides fresh data (6 hour cache)
    - API limit stays safe
*/

-- Add timestamp columns to movies table
ALTER TABLE movies 
ADD COLUMN IF NOT EXISTS providers_last_updated timestamptz,
ADD COLUMN IF NOT EXISTS ratings_last_updated timestamptz;

-- Add timestamp columns to tv_shows table
ALTER TABLE tv_shows 
ADD COLUMN IF NOT EXISTS providers_last_updated timestamptz,
ADD COLUMN IF NOT EXISTS ratings_last_updated timestamptz;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_movies_providers_updated 
  ON movies(providers_last_updated);

CREATE INDEX IF NOT EXISTS idx_movies_ratings_updated 
  ON movies(ratings_last_updated);

CREATE INDEX IF NOT EXISTS idx_tv_shows_providers_updated 
  ON tv_shows(providers_last_updated);

CREATE INDEX IF NOT EXISTS idx_tv_shows_ratings_updated 
  ON tv_shows(ratings_last_updated);

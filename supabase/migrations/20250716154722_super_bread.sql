/*
  # Create Genres Table

  1. New Tables
    - `genres` - Stores movie and TV show genres
      - `id` (integer, primary key)
      - `name` (varchar, unique)
      - `created_at` (timestamptz)
  
  2. Default Content
    - Insert common genres from TMDB
*/

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert common genres from TMDB
INSERT INTO genres (id, name) VALUES
  (28, 'Action'),
  (12, 'Adventure'),
  (16, 'Animation'),
  (35, 'Comedy'),
  (80, 'Crime'),
  (99, 'Documentary'),
  (18, 'Drama'),
  (10751, 'Family'),
  (14, 'Fantasy'),
  (36, 'History'),
  (27, 'Horror'),
  (10402, 'Music'),
  (9648, 'Mystery'),
  (10749, 'Romance'),
  (878, 'Science Fiction'),
  (10770, 'TV Movie'),
  (53, 'Thriller'),
  (10752, 'War'),
  (37, 'Western'),
  (10759, 'Action & Adventure'),
  (10762, 'Kids'),
  (10763, 'News'),
  (10764, 'Reality'),
  (10765, 'Sci-Fi & Fantasy'),
  (10766, 'Soap'),
  (10767, 'Talk'),
  (10768, 'War & Politics')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Create content_genres table to link content to genres
CREATE TABLE IF NOT EXISTS content_genres (
  content_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  content_type content_type NOT NULL,
  PRIMARY KEY (content_id, genre_id, content_type)
);
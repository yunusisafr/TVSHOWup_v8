/*
  # Populate TMDB Genres

  1. New Data
    - Populate `genres` table with standard TMDB genre data
    - Includes both movie and TV show genres
    - Uses standard TMDB genre IDs for consistency

  2. Data Source
    - Standard TMDB genre list
    - Covers major genres used in movies and TV shows
    - Ensures Discovery Wizard Step 3 has data to display
*/

-- Insert standard TMDB genres
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
  -- TV Show specific genres
  (10759, 'Action & Adventure'),
  (10762, 'Kids'),
  (10763, 'News'),
  (10764, 'Reality'),
  (10765, 'Sci-Fi & Fantasy'),
  (10766, 'Soap'),
  (10767, 'Talk'),
  (10768, 'War & Politics')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  created_at = COALESCE(genres.created_at, now());
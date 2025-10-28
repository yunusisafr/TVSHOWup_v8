/*
  # TVSHOWup Database Schema - TMDB Compatible

  1. New Tables
    - `genres` - Store genre information
    - `countries` - Store country/region information
    - `languages` - Store language information
    - `providers` - Store streaming platform information
    - `movies` - Store movie information (TMDB compatible)
    - `tv_shows` - Store TV show information (TMDB compatible)
    - `content_genres` - Junction table for content-genre relationships
    - `content_providers` - Junction table for content-provider relationships (region-specific)
    - `user_watchlists` - Store user watchlist items
    - `user_watched` - Store user watched content
    - `content_comments` - Store user comments on content
    - `content_ratings` - Store user ratings
    - `api_cache` - Cache API responses to avoid redundant calls

  2. Security
    - Enable RLS on all user-related tables
    - Add policies for authenticated users
    - Public read access for content tables
    - User-specific access for personal data

  3. Indexes
    - Add indexes for frequently queried columns
    - Full-text search indexes for content discovery
*/

-- Create enum types
CREATE TYPE content_type AS ENUM ('movie', 'tv_show');
CREATE TYPE user_content_status AS ENUM ('want_to_watch', 'watching', 'watched', 'dropped');

-- Countries/Regions table
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  iso_3166_1 VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  iso_639_1 VARCHAR(2) UNIQUE NOT NULL,
  english_name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Genres table
CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaming providers table
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  logo_path VARCHAR(255),
  display_priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movies table (TMDB compatible)
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  imdb_id VARCHAR(20),
  title VARCHAR(500) NOT NULL,
  original_title VARCHAR(500),
  overview TEXT,
  release_date DATE,
  runtime INTEGER,
  status VARCHAR(50),
  tagline VARCHAR(500),
  adult BOOLEAN DEFAULT FALSE,
  budget BIGINT DEFAULT 0,
  revenue BIGINT DEFAULT 0,
  popularity DECIMAL(10,3) DEFAULT 0,
  vote_average DECIMAL(3,1) DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  poster_path VARCHAR(255),
  backdrop_path VARCHAR(255),
  original_language VARCHAR(2),
  homepage VARCHAR(500),
  video BOOLEAN DEFAULT FALSE,
  belongs_to_collection JSONB,
  production_companies JSONB,
  production_countries JSONB,
  spoken_languages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TV Shows table (TMDB compatible)
CREATE TABLE IF NOT EXISTS tv_shows (
  id INTEGER PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  original_name VARCHAR(500),
  overview TEXT,
  first_air_date DATE,
  last_air_date DATE,
  status VARCHAR(50),
  type VARCHAR(50),
  tagline VARCHAR(500),
  adult BOOLEAN DEFAULT FALSE,
  popularity DECIMAL(10,3) DEFAULT 0,
  vote_average DECIMAL(3,1) DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  poster_path VARCHAR(255),
  backdrop_path VARCHAR(255),
  original_language VARCHAR(2),
  homepage VARCHAR(500),
  in_production BOOLEAN DEFAULT FALSE,
  number_of_episodes INTEGER DEFAULT 0,
  number_of_seasons INTEGER DEFAULT 0,
  episode_run_time INTEGER[],
  origin_country VARCHAR(2)[],
  created_by JSONB,
  genres JSONB,
  keywords JSONB,
  languages VARCHAR(2)[],
  last_episode_to_air JSONB,
  next_episode_to_air JSONB,
  networks JSONB,
  production_companies JSONB,
  production_countries JSONB,
  seasons JSONB,
  spoken_languages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content genres junction table
CREATE TABLE IF NOT EXISTS content_genres (
  content_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  PRIMARY KEY (content_id, genre_id, content_type),
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- Content providers junction table (region-specific)
CREATE TABLE IF NOT EXISTS content_providers (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  provider_id INTEGER NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  monetization_type VARCHAR(20) NOT NULL, -- 'flatrate', 'buy', 'rent'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (country_code) REFERENCES countries(iso_3166_1) ON DELETE CASCADE,
  UNIQUE(content_id, content_type, provider_id, country_code, monetization_type)
);

-- User watchlists table
CREATE TABLE IF NOT EXISTS user_watchlists (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  status user_content_status DEFAULT 'want_to_watch',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(user_id, content_id, content_type)
);

-- User watched content table
CREATE TABLE IF NOT EXISTS user_watched (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 10),
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(user_id, content_id, content_type)
);

-- Content comments table
CREATE TABLE IF NOT EXISTS content_comments (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Content ratings table
CREATE TABLE IF NOT EXISTS content_ratings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  rating DECIMAL(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(user_id, content_id, content_type)
);

-- API cache table
CREATE TABLE IF NOT EXISTS api_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(255),
  country_code VARCHAR(2),
  language_code VARCHAR(2) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (country_code) REFERENCES countries(iso_3166_1),
  FOREIGN KEY (language_code) REFERENCES languages(iso_639_1)
);

-- Enable RLS
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watched ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own watchlist"
  ON user_watchlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own watched content"
  ON user_watched
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own comments"
  ON content_comments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read comments"
  ON content_comments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage their own ratings"
  ON content_ratings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own profile"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_movies_popularity ON movies(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_movies_vote_average ON movies(vote_average DESC);
CREATE INDEX IF NOT EXISTS idx_tv_shows_popularity ON tv_shows(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_tv_shows_first_air_date ON tv_shows(first_air_date DESC);
CREATE INDEX IF NOT EXISTS idx_tv_shows_vote_average ON tv_shows(vote_average DESC);
CREATE INDEX IF NOT EXISTS idx_content_providers_country ON content_providers(country_code);
CREATE INDEX IF NOT EXISTS idx_content_providers_content ON content_providers(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_user_watchlists_user ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watched_user ON user_watched(user_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_content ON content_comments(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_movies_title_search ON movies USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_tv_shows_name_search ON tv_shows USING gin(to_tsvector('english', name));
/*
  # Configure Public Access RLS Policies

  1. Enable public read access for content tables
  2. Configure proper RLS policies for authenticated operations
  3. Ensure security while allowing necessary access
*/

-- Movies table - Public read access
CREATE POLICY "Anyone can view movies" ON movies
  FOR SELECT TO public
  USING (true);

-- TV Shows table - Public read access
CREATE POLICY "Anyone can view tv_shows" ON tv_shows
  FOR SELECT TO public
  USING (true);

-- Genres table - Public read access
CREATE POLICY "Anyone can view genres" ON genres
  FOR SELECT TO public
  USING (true);

-- Countries table - Public read access
CREATE POLICY "Anyone can view countries" ON countries
  FOR SELECT TO public
  USING (true);

-- Languages table - Public read access
CREATE POLICY "Anyone can view languages" ON languages
  FOR SELECT TO public
  USING (true);

-- Providers table - Public read access
CREATE POLICY "Anyone can view providers" ON providers
  FOR SELECT TO public
  USING (true);

-- Content Providers table - Public read access
CREATE POLICY "Anyone can view content_providers" ON content_providers
  FOR SELECT TO public
  USING (true);

-- Content Genres table - Public read access
CREATE POLICY "Anyone can view content_genres" ON content_genres
  FOR SELECT TO public
  USING (true);

-- User Profiles - Public read access for basic info
CREATE POLICY "Anyone can view user profiles" ON user_profiles
  FOR SELECT TO public
  USING (true);

-- Enable RLS on reference tables if not already enabled
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;
/*
  # Create Sitemap Cache Table

  1. New Tables
    - `sitemap_cache`
      - `id` (integer, primary key) - Always 1, single row table
      - `content` (text) - The cached sitemap XML
      - `generated_at` (timestamptz) - When the sitemap was generated
      - `url_count` (integer) - Total number of URLs in sitemap
      - `last_error` (text, nullable) - Last error message if any
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `sitemap_cache` table
    - Add policy for public read access (sitemaps are public)
    - Add policy for service role write access only

  3. Notes
    - Single row table used as cache storage
    - Cache is invalidated based on updated_at timestamp
    - Fallback mechanism stores last successful generation
*/

CREATE TABLE IF NOT EXISTS sitemap_cache (
  id integer PRIMARY KEY DEFAULT 1,
  content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  url_count integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

ALTER TABLE sitemap_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitemap cache is publicly readable"
  ON sitemap_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage sitemap cache"
  ON sitemap_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sitemap_cache_updated_at ON sitemap_cache(updated_at);

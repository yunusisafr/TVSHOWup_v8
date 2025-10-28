/*
  # Fix RLS policies for provider tables

  1. Tables Updated
    - `providers` table: Add public read access policy
    - `content_providers` table: Add public read access policy
  
  2. Security Changes
    - Allow public (anonymous and authenticated) users to read provider data
    - Keep existing admin policies for write operations
    - Ensure provider data is accessible for content discovery features

  3. Rationale
    - Provider information (streaming platforms, logos, etc.) should be publicly accessible
    - Content-provider relationships need to be readable for filtering and discovery
    - This enables proper functioning of Discovery Wizard and content detail pages
*/

-- Fix providers table RLS policies
-- Drop existing restrictive policies and add public read access
DROP POLICY IF EXISTS "Enable read access for all users" ON providers;

-- Add comprehensive public read policy for providers
CREATE POLICY "Public read access to providers"
  ON providers
  FOR SELECT
  TO public
  USING (true);

-- Fix content_providers table RLS policies  
-- Drop existing restrictive policies and add public read access
DROP POLICY IF EXISTS "Enable read access for all users" ON content_providers;

-- Add comprehensive public read policy for content_providers
CREATE POLICY "Public read access to content_providers"
  ON content_providers
  FOR SELECT
  TO public
  USING (true);

-- Ensure both tables have RLS enabled (they should already be enabled)
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_providers ENABLE ROW LEVEL SECURITY;
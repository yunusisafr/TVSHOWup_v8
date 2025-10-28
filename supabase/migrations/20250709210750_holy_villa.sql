-- Create a function to check if user is admin by role if it doesn't exist
CREATE OR REPLACE FUNCTION is_admin_by_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'editor')
  );
END;
$$;

-- Update policies for movies table
DROP POLICY IF EXISTS "Authenticated users can update TMDB movies" ON movies;
CREATE POLICY "Authenticated users can update TMDB movies"
  ON movies
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Update policies for tv_shows table
DROP POLICY IF EXISTS "Authenticated users can update TMDB tv_shows" ON tv_shows;
CREATE POLICY "Authenticated users can update TMDB tv_shows"
  ON tv_shows
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add policies for admin users by role
DROP POLICY IF EXISTS "Admins by role can manage movies" ON movies;
CREATE POLICY "Admins by role can manage movies"
  ON movies
  FOR ALL
  TO authenticated
  USING (is_admin_by_role());

DROP POLICY IF EXISTS "Admins by role can manage tv_shows" ON tv_shows;
CREATE POLICY "Admins by role can manage tv_shows"
  ON tv_shows
  FOR ALL
  TO authenticated
  USING (is_admin_by_role());

-- Add read-only policies for service role
DROP POLICY IF EXISTS "Service role okuma izni - movies" ON movies;
CREATE POLICY "Service role okuma izni - movies"
  ON movies
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role okuma izni - tv_shows" ON tv_shows;
CREATE POLICY "Service role okuma izni - tv_shows"
  ON tv_shows
  FOR SELECT
  TO service_role
  USING (true);

-- Add read-only policies for authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to read movies" ON movies;
CREATE POLICY "Allow authenticated users to read movies"
  ON movies
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to read tv_shows" ON tv_shows;
CREATE POLICY "Allow authenticated users to read tv_shows"
  ON tv_shows
  FOR SELECT
  TO authenticated
  USING (true);

-- Add read-only policies for anonymous users
DROP POLICY IF EXISTS "Allow public read access to movies" ON movies;
CREATE POLICY "Allow public read access to movies"
  ON movies
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public read access to tv_shows" ON tv_shows;
CREATE POLICY "Allow public read access to tv_shows"
  ON tv_shows
  FOR SELECT
  TO anon
  USING (true);
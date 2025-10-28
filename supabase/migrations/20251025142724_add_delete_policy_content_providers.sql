/*
  # Add DELETE policy for content_providers table

  ## Changes
  - Add DELETE policy for authenticated users to allow updating provider data
  - Add DELETE policy for anon users to allow updating provider data

  ## Reason
  The contentUpdateService.ts tries to DELETE old providers before INSERT,
  but there was no DELETE policy, causing silent failures and duplicate key errors.
*/

-- Drop existing policies if they exist (from potential previous runs)
DROP POLICY IF EXISTS "Authenticated users can delete content providers" ON content_providers;
DROP POLICY IF EXISTS "Anon users can delete content providers" ON content_providers;

-- Allow authenticated users to delete content providers
CREATE POLICY "Authenticated users can delete content providers"
  ON content_providers
  FOR DELETE
  TO authenticated
  USING (true);

-- Allow anon users to delete content providers
CREATE POLICY "Anon users can delete content providers"
  ON content_providers
  FOR DELETE
  TO anon
  USING (true);

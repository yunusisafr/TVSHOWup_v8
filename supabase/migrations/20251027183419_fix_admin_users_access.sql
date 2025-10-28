/*
  # Fix Admin Users Table Access

  ## Summary
  Simplifies admin_users table RLS policies to allow authenticated users
  to check their own admin status.

  ## Changes
    - Drop existing complex policies
    - Add simple policy for users to check their own admin status
    - This allows AdminContext to properly verify admin status

  ## Security
    - Users can only see their own admin record (if they have one)
    - Uses auth.uid() for authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;

-- Allow authenticated users to check if they are admin
CREATE POLICY "Users can check their own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());
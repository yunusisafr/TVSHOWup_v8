/*
  # Create Ad Units Table

  1. New Tables
    - `ad_units`
      - `id` (uuid, primary key)
      - `name` (text) - Display name for the ad unit
      - `position` (text) - Ad placement position (header, footer, sidebar, content, etc.)
      - `ad_code` (text) - HTML/JS ad code from AdSense, Admatic, etc.
      - `is_active` (boolean) - Whether the ad is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - Admin user who created the ad
      - `updated_by` (uuid) - Admin user who last updated the ad

  2. Security
    - Enable RLS on `ad_units` table
    - Add policy for public read access (users need to see active ads)
    - Add policy for admin-only write access using admin_users table (id matches auth.uid)
*/

-- Create ad_units table
CREATE TABLE IF NOT EXISTS ad_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  ad_code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE ad_units ENABLE ROW LEVEL SECURITY;

-- Public can view active ads
CREATE POLICY "Anyone can view active ads"
  ON ad_units
  FOR SELECT
  USING (is_active = true);

-- Admins can view all ads (admin_users.id = auth.uid)
CREATE POLICY "Admins can view all ads"
  ON ad_units
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Admins can insert ads
CREATE POLICY "Admins can insert ads"
  ON ad_units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Admins can update ads
CREATE POLICY "Admins can update ads"
  ON ad_units
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Admins can delete ads
CREATE POLICY "Admins can delete ads"
  ON ad_units
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create index for position lookups
CREATE INDEX IF NOT EXISTS idx_ad_units_position_active ON ad_units(position, is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ad_units_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ad_units_updated_at ON ad_units;

CREATE TRIGGER ad_units_updated_at
  BEFORE UPDATE ON ad_units
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_units_updated_at();
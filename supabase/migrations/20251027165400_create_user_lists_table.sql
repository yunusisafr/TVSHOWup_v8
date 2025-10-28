/*
  # Create User Lists Table

  ## Summary
  Creates the missing `user_lists` table that allows users to create custom lists
  for organizing their content (movies and TV shows).

  ## 1. New Tables
    - `user_lists`
      - `id` (uuid, primary key) - Unique identifier for the list
      - `user_id` (uuid, foreign key) - References auth.users
      - `name` (text) - Name of the list
      - `description` (text, nullable) - Optional description
      - `is_public` (boolean) - Whether the list is publicly viewable
      - `created_at` (timestamptz) - When the list was created
      - `updated_at` (timestamptz) - When the list was last updated

    - `user_list_items`
      - `id` (uuid, primary key) - Unique identifier
      - `list_id` (uuid, foreign key) - References user_lists
      - `content_id` (integer) - TMDB content ID
      - `content_type` (text) - Either 'movie' or 'tv_show'
      - `notes` (text, nullable) - Optional user notes about the item
      - `sort_order` (integer) - Position in the list
      - `added_at` (timestamptz) - When item was added to list

  ## 2. Security
    - Enable RLS on both tables
    - Users can manage their own lists
    - Public can view public lists
    - Users can read their own private lists

  ## 3. Indexes
    - Index on user_id for fast user list queries
    - Index on list_id for fast item lookups
    - Unique constraint on user_id + name to prevent duplicate list names per user
*/

-- Create user_lists table
CREATE TABLE IF NOT EXISTS user_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create user_list_items table
CREATE TABLE IF NOT EXISTS user_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  content_id integer NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('movie', 'tv_show')),
  notes text,
  sort_order integer DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE(list_id, content_id, content_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON user_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_public ON user_lists(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_user_list_items_list_id ON user_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_user_list_items_content ON user_list_items(content_id, content_type);

-- Enable RLS
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_lists

CREATE POLICY "Users can view their own lists"
  ON user_lists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view public lists"
  ON user_lists FOR SELECT
  TO public
  USING (is_public = true);

CREATE POLICY "Users can create their own lists"
  ON user_lists FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own lists"
  ON user_lists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own lists"
  ON user_lists FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for user_list_items

CREATE POLICY "Users can view items in their own lists"
  ON user_list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view items in public lists"
  ON user_list_items FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.is_public = true
    )
  );

CREATE POLICY "Users can add items to their own lists"
  ON user_list_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own lists"
  ON user_list_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their own lists"
  ON user_list_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = user_list_items.list_id
      AND user_lists.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER user_lists_updated_at
  BEFORE UPDATE ON user_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_user_lists_updated_at();

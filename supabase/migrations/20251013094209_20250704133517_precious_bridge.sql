/*
  # Add Editor Review Field to Content Tables

  1. Changes
    - Add editor_review TEXT field to movies table
    - Add editor_review TEXT field to tv_shows table
    - Add indexes for better performance when filtering content with reviews

  2. Security
    - No RLS changes needed as these are content tables
    - Reviews will be managed by admin/editor users
*/

-- Add editor_review field to movies table
ALTER TABLE movies 
ADD COLUMN IF NOT EXISTS editor_review TEXT;

-- Add editor_review field to tv_shows table
ALTER TABLE tv_shows 
ADD COLUMN IF NOT EXISTS editor_review TEXT;

-- Add indexes for filtering content with editor reviews
CREATE INDEX IF NOT EXISTS idx_movies_editor_review ON movies(editor_review) WHERE editor_review IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_editor_review ON tv_shows(editor_review) WHERE editor_review IS NOT NULL;
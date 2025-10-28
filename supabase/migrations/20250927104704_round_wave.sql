/*
  # Add content translations to static pages

  1. New Columns
    - `content_translations` (jsonb) - Store content translations for different languages
  
  2. Changes
    - Add content_translations column to static_pages table with default empty JSON object
    - This enables multilingual content support for static pages
  
  3. Notes
    - Existing content will remain in the main content column (English)
    - Translations will be stored in the new content_translations column
    - The column is nullable and defaults to empty JSON object
*/

-- Add content_translations column to static_pages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'static_pages' AND column_name = 'content_translations'
  ) THEN
    ALTER TABLE static_pages ADD COLUMN content_translations jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for content_translations for better performance
CREATE INDEX IF NOT EXISTS idx_static_pages_content_translations 
ON static_pages USING gin (content_translations);
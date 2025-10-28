/*
  # Add meta_description_translations column to static_pages

  1. New Columns
    - `meta_description_translations` (jsonb) - Store meta description translations for different languages
  
  2. Changes
    - Add meta_description_translations column to static_pages table with default empty JSON object
    - This enables multilingual meta description support for static pages
  
  3. Notes
    - Existing meta_description will remain in the main meta_description column (English)
    - Translations will be stored in the new meta_description_translations column
    - The column is nullable and defaults to empty JSON object
*/

-- Add meta_description_translations column to static_pages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'static_pages' AND column_name = 'meta_description_translations'
  ) THEN
    ALTER TABLE static_pages ADD COLUMN meta_description_translations jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for meta_description_translations for better performance
CREATE INDEX IF NOT EXISTS idx_static_pages_meta_description_translations 
ON static_pages USING gin (meta_description_translations);
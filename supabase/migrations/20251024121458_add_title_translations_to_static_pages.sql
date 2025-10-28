/*
  # Add Missing title_translations Column

  1. Changes
    - Add `title_translations` JSONB column to `static_pages` table
    - This column was referenced in code but missing from schema
  
  2. Notes
    - Column stores multilingual title translations
    - Existing pages will have NULL until updated via admin panel
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'static_pages' AND column_name = 'title_translations'
  ) THEN
    ALTER TABLE static_pages ADD COLUMN title_translations JSONB;
  END IF;
END $$;

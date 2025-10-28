/*
  # Add is_published column to share_lists table

  1. Schema Changes
    - Add `is_published` column to `share_lists` table
    - Set default value to `false` for new records
    - Update existing records to have `is_published = false`

  2. Security
    - No RLS changes needed as existing policies will cover the new column

  3. Notes
    - This column will control whether a list is published/visible or in draft mode
    - Default value ensures existing lists remain in draft state until explicitly published
*/

-- Add is_published column to share_lists table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'share_lists' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE share_lists ADD COLUMN is_published boolean DEFAULT false;
  END IF;
END $$;

-- Update existing records to have is_published = false (draft state)
UPDATE share_lists SET is_published = false WHERE is_published IS NULL;
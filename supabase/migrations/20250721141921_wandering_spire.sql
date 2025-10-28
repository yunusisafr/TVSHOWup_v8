/*
  # Add foreign key relationship between share_lists and user_profiles

  1. Changes
    - Add foreign key constraint from share_lists.user_id to user_profiles.id
    - This enables Supabase to perform joins between these tables
    - Ensures data integrity by preventing orphaned share lists

  2. Security
    - No RLS changes needed as existing policies remain in effect
*/

-- Add foreign key constraint between share_lists and user_profiles
DO $$
BEGIN
  -- Check if the foreign key constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'share_lists_user_id_fkey' 
    AND table_name = 'share_lists'
  ) THEN
    ALTER TABLE share_lists 
    ADD CONSTRAINT share_lists_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
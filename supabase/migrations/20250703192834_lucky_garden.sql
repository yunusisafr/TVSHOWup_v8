/*
  # Add foreign key relationship between content_comments and user_profiles

  1. Changes
    - Add foreign key constraint from content_comments.user_id to user_profiles.id
    - This enables Supabase to properly join the tables when fetching comments with user profile data

  2. Security
    - No changes to existing RLS policies
    - Maintains existing data integrity
*/

-- Add foreign key constraint between content_comments and user_profiles
ALTER TABLE content_comments 
ADD CONSTRAINT content_comments_user_id_user_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
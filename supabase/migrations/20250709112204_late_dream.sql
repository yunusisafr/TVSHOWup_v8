/*
  # Update avatars bucket file size limit

  1. Changes
    - Reduce the file size limit for the avatars bucket from 2MB to 500KB
    - Keep all other settings (allowed MIME types, policies, etc.) unchanged

  2. Security
    - No changes to existing security policies
    - Only updates the file size limit configuration
*/

-- Update the avatars bucket to reduce file size limit to 500KB
UPDATE storage.buckets
SET file_size_limit = 512000 -- 500KB in bytes
WHERE id = 'avatars';
/*
  # Remove Custom Provider IDs and Use TMDB Native Providers

  1. Purpose
    - Remove custom Turkish provider IDs (9001-9004) that don't exist in TMDB
    - Keep only TMDB-native provider IDs
    - Update content_providers table to use correct TMDB provider IDs
    - Improve provider-content matching accuracy

  2. Changes
    - Delete custom provider records with IDs 9001, 9002, 9004
    - Keep only providers with actual TMDB IDs (8, 119, 337, 384, 350, 15, 531, 387, 307, 4405)
    - Update content_providers relationships to remove invalid provider references
    
  3. Impact
    - Provider filtering will now work correctly with TMDB API
    - Discovery wizard will return accurate results for provider-based searches
    - Turkish users will see actual available providers from TMDB for Turkey region
    
  4. Security
    - Maintains existing RLS policies
    - No breaking changes to application logic
*/

-- Remove custom provider IDs that don't exist in TMDB
DELETE FROM content_providers 
WHERE provider_id IN (9001, 9002, 9004);

DELETE FROM providers 
WHERE id IN (9001, 9002, 9004);

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Removed custom provider IDs: 9001 (Gain), 9002 (Tabii), 9004 (PuhuTV)';
  RAISE NOTICE 'These providers will be dynamically loaded from TMDB API based on user region';
END $$;

-- Verify remaining providers
DO $$
DECLARE
  provider_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO provider_count FROM providers;
  RAISE NOTICE 'Remaining provider count: %', provider_count;
END $$;
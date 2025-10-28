/*
  # Cleanup Network Providers from Watch List

  ## Problem
  Previously, edge functions were incorrectly adding TV show networks (broadcast metadata)
  as content providers (watch/streaming options). This created confusion with duplicate
  providers (e.g., Netflix ID:8 streaming vs Netflix ID:213 network).

  ## TMDB API Structure
  - **Watch Providers API**: /watch/providers - Returns actual streaming platforms
    (Netflix, Hulu, BluTV, etc.) with flatrate/rent/buy monetization types
  - **Networks API**: /tv/{id} - Returns broadcast networks (metadata only)
    Not meant for "where to watch" information

  ## Changes
  1. Remove content_providers entries that reference network-type providers
  2. Keep only streaming providers (from Watch Providers API)
  3. Optionally keep network providers in providers table for metadata
     but remove their content_providers relationships

  ## Impact
  - Users will only see actual watch/streaming options
  - No more duplicate providers (e.g., Netflix appearing twice)
  - Cleaner UI without confusion
  - Aligns with TMDB API's intended usage

  ## Security
  - Maintains existing RLS policies
  - No impact on user data or permissions
*/

-- Step 1: Log current state
DO $$
DECLARE
  network_provider_count INTEGER;
  network_content_provider_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO network_provider_count 
  FROM providers WHERE provider_type = 'network';
  
  SELECT COUNT(*) INTO network_content_provider_count
  FROM content_providers cp
  JOIN providers p ON cp.provider_id = p.id
  WHERE p.provider_type = 'network';
  
  RAISE NOTICE '📊 Current state:';
  RAISE NOTICE '  - Network providers in providers table: %', network_provider_count;
  RAISE NOTICE '  - Content-provider relationships using networks: %', network_content_provider_count;
END $$;

-- Step 2: Remove content_providers entries that reference network-type providers
-- These are the incorrect "watch provider" entries that should never have been added
DELETE FROM content_providers
WHERE provider_id IN (
  SELECT id FROM providers WHERE provider_type = 'network'
);

-- Step 3: Log cleanup results
DO $$
DECLARE
  remaining_network_providers INTEGER;
  remaining_content_providers INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_network_providers 
  FROM providers WHERE provider_type = 'network';
  
  SELECT COUNT(*) INTO remaining_content_providers
  FROM content_providers;
  
  RAISE NOTICE '✅ Cleanup complete:';
  RAISE NOTICE '  - Network providers still in providers table (metadata): %', remaining_network_providers;
  RAISE NOTICE '  - Total content_providers entries remaining: %', remaining_content_providers;
  RAISE NOTICE '  - Only Watch Providers API data remains in content_providers';
END $$;

-- Step 4: Optional - Remove network providers entirely if not needed for metadata
-- Uncomment if you want to completely remove network providers:
-- DELETE FROM providers WHERE provider_type = 'network';

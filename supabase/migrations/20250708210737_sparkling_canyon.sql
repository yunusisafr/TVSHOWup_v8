/*
  # Fix content_availability view PostgreSQL error

  1. Problem
    - The content_availability view is causing "cannot get array length of a scalar" error
    - This happens when array functions are applied to scalar values
    - The view needs to return individual rows, not aggregated arrays

  2. Solution
    - Drop and recreate the content_availability view
    - Return individual rows for each content-provider relationship
    - Include both explicit providers (from content_providers table) and implicit providers (networks from TV shows)
    - Ensure all columns are scalar values, not arrays

  3. View Structure
    - content_id: The ID of the movie/TV show
    - content_type: 'movie' or 'tv_show'
    - provider_id: The provider's ID
    - provider_name: The provider's name
    - logo_path: The provider's logo path
    - provider_type: The type of provider (streaming, network, etc.)
    - website_url: The provider's website
    - is_network: Boolean indicating if this is a network
    - country_code: The country code for availability
    - monetization_type: The monetization type (flatrate, buy, rent, etc.)
    - relationship_type: 'explicit' for content_providers, 'network' for TV show networks
*/

-- Drop the existing view if it exists
DROP VIEW IF EXISTS content_availability;

-- Create the corrected content_availability view
CREATE VIEW content_availability AS
-- Explicit provider relationships from content_providers table
SELECT 
  cp.content_id,
  cp.content_type,
  cp.provider_id,
  p.name as provider_name,
  p.logo_path,
  p.provider_type,
  p.website_url,
  p.is_network,
  cp.country_code,
  cp.monetization_type,
  'explicit' as relationship_type
FROM content_providers cp
JOIN providers p ON cp.provider_id = p.id
WHERE p.is_active = true

UNION ALL

-- Network relationships from TV shows (implicit providers)
SELECT 
  tv.id as content_id,
  'tv_show'::content_type as content_type,
  (network_data->>'id')::integer as provider_id,
  network_data->>'name' as provider_name,
  network_data->>'logo_path' as logo_path,
  'network'::provider_type_enum as provider_type,
  null as website_url,
  true as is_network,
  COALESCE(network_data->>'origin_country', 'US') as country_code,
  'flatrate' as monetization_type,
  'network' as relationship_type
FROM tv_shows tv,
LATERAL jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(tv.networks) = 'array' THEN tv.networks
    ELSE '[]'::jsonb
  END
) as network_data
WHERE tv.networks IS NOT NULL 
  AND jsonb_typeof(tv.networks) = 'array'
  AND jsonb_array_length(tv.networks) > 0;

-- Add comment to the view
COMMENT ON VIEW content_availability IS 'Unified view of content availability across providers and networks';
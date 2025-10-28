/*
  # Fix Provider Types in content_availability View

  1. Changes
    - Update content_availability view to correctly handle provider types
    - Ensure networks from TV shows are properly categorized based on providers table
    - Add proper JOIN with providers table to get accurate provider_type
    - Improve handling of monetization_type for networks
    - Fix relationship_type to be more descriptive

  2. Benefits
    - Correctly display Gain, Exxen and other platforms as streaming platforms
    - Maintain network information for TV channels
    - Improve UI display with accurate provider categorization
*/

-- Drop the existing view
DROP VIEW IF EXISTS content_availability;

-- Create the improved content_availability view with better provider type handling
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

-- Network relationships from TV shows with proper provider type lookup
SELECT 
  tv.id as content_id,
  'tv_show'::content_type as content_type,
  (network_data->>'id')::integer as provider_id,
  network_data->>'name' as provider_name,
  network_data->>'logo_path' as logo_path,
  -- Look up provider_type from providers table if available, otherwise default to network
  COALESCE(
    p.provider_type, 
    'network'::provider_type_enum
  ) as provider_type,
  -- Get website_url from providers table if available
  p.website_url,
  -- Use is_network from providers table if available, otherwise default to true
  COALESCE(
    p.is_network,
    true
  ) as is_network,
  COALESCE(
    p.country_of_origin,
    network_data->>'origin_country', 
    'US'
  ) as country_code,
  -- Use flatrate as default monetization type for networks
  'flatrate' as monetization_type,
  -- More descriptive relationship type
  CASE 
    WHEN p.id IS NOT NULL THEN 'network_provider' 
    ELSE 'network_only'
  END as relationship_type
FROM tv_shows tv,
LATERAL jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(tv.networks) = 'array' THEN tv.networks
    ELSE '[]'::jsonb
  END
) as network_data
-- Left join with providers to get provider information if available
LEFT JOIN providers p ON 
  p.id = (network_data->>'id')::integer OR 
  p.network_id = (network_data->>'id')::integer
WHERE tv.networks IS NOT NULL 
  AND jsonb_typeof(tv.networks) = 'array';

-- Add comment to the view
COMMENT ON VIEW content_availability IS 'Unified view of content availability across providers and networks';

-- Grant necessary permissions
GRANT SELECT ON content_availability TO authenticated, anon;
/*
  # Fix content_availability view error

  1. Changes
    - Drop the existing content_availability view
    - Recreate the view with proper JSONB type checking
    - Remove the problematic jsonb_array_length check that causes "cannot get array length of a scalar" error
    - Use CASE with jsonb_typeof to safely handle different JSONB types
    - Add better error handling for NULL or non-array networks data

  2. Security
    - Maintains existing security settings
    - No changes to RLS policies
*/

-- Drop the existing view if it exists
DROP VIEW IF EXISTS content_availability;

-- Create the fixed content_availability view with proper type checking
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
  AND jsonb_typeof(tv.networks) = 'array';

-- Add comment to the view
COMMENT ON VIEW content_availability IS 'Unified view of content availability across providers and networks';

-- Grant necessary permissions
GRANT SELECT ON content_availability TO authenticated, anon;

-- Update table statistics
ANALYZE tv_shows;
ANALYZE providers;
ANALYZE content_providers;
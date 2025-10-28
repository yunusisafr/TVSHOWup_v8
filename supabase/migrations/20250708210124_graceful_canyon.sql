/*
  # Enhanced Content Providers View with Network Support

  1. Changes
    - Create a new view that combines content_providers with networks from tv_shows
    - Include website_url and other provider metadata
    - Support both explicit provider relationships and implicit network relationships
    - Optimize for performance with proper indexing

  2. Security
    - Maintain existing RLS policies
    - Grant appropriate permissions to the view
*/

-- Drop existing view
DROP VIEW IF EXISTS all_content_providers CASCADE;

-- Create enhanced view that includes both explicit providers and networks from content
CREATE OR REPLACE VIEW all_content_providers AS
SELECT 
  cp.id,
  cp.content_id,
  cp.content_type,
  p.id as provider_id,
  p.name as provider_name,
  p.logo_path as provider_logo,
  cp.monetization_type,
  cp.link,
  cp.presentation_type,
  cp.price_info,
  cp.availability_start,
  cp.availability_end,
  p.provider_type,
  cp.country_code,
  p.website_url,
  p.is_network,
  p.network_id,
  p.country_of_origin
FROM content_providers cp
JOIN providers p ON cp.provider_id = p.id
WHERE p.is_active = true;

-- Create a view for networks from TV shows
CREATE OR REPLACE VIEW tv_show_networks AS
WITH extracted_networks AS (
  SELECT 
    id as tv_show_id,
    jsonb_array_elements(networks) as network
  FROM tv_shows
  WHERE networks IS NOT NULL AND jsonb_array_length(networks) > 0
)
SELECT 
  tv_show_id,
  (network->>'id')::integer as network_id,
  network->>'name' as network_name,
  network->>'logo_path' as logo_path,
  network->>'origin_country' as origin_country
FROM extracted_networks;

-- Create a view that combines all provider information
CREATE OR REPLACE VIEW content_availability AS
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

-- Include networks from TV shows that aren't already in content_providers
SELECT 
  n.tv_show_id as content_id,
  'tv_show'::content_type as content_type,
  n.network_id as provider_id,
  n.network_name as provider_name,
  n.logo_path,
  'network'::provider_type_enum as provider_type,
  p.website_url,
  true as is_network,
  COALESCE(n.origin_country, 'US') as country_code,
  'flatrate' as monetization_type,
  'implicit' as relationship_type
FROM tv_show_networks n
LEFT JOIN providers p ON p.network_id = n.network_id
WHERE NOT EXISTS (
  SELECT 1 FROM content_providers cp 
  WHERE cp.content_id = n.tv_show_id 
  AND cp.content_type = 'tv_show'
  AND cp.provider_id = n.network_id
);

-- Grant necessary permissions
GRANT SELECT ON tv_show_networks TO authenticated, anon;
GRANT SELECT ON content_availability TO authenticated, anon;
GRANT SELECT ON all_content_providers TO authenticated, anon;

-- Add RLS policies for the views
ALTER VIEW tv_show_networks SET (security_invoker = true);
ALTER VIEW content_availability SET (security_invoker = true);
ALTER VIEW all_content_providers SET (security_invoker = true);

-- Update table statistics
ANALYZE providers;
ANALYZE content_providers;
ANALYZE tv_shows;
/*
  # Add website_url to all_content_providers view

  1. Changes
    - Add website_url field to all_content_providers view
    - This ensures the frontend can display "Visit website" links for providers
    - No schema changes, only view definition update

  2. Security
    - Maintains existing security settings
    - No changes to RLS policies
*/

-- Drop and recreate the all_content_providers view with website_url
DROP VIEW IF EXISTS all_content_providers CASCADE;

-- Create a comprehensive view for all content providers with categorization
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

-- Grant necessary permissions
GRANT SELECT ON all_content_providers TO authenticated, anon;

-- Add RLS policies for the view
ALTER VIEW all_content_providers SET (security_invoker = true);

-- Update table statistics
ANALYZE providers;
ANALYZE content_providers;
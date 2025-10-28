/*
  # Update Turkish Streaming Platforms Classification

  1. Changes
    - Update Exxen from 'network' to 'streaming' provider type
    - Add TOD as a new Turkish streaming platform
    - Mark BluTV as inactive (replaced by Max)
    - Ensure all Turkish platforms are properly categorized

  2. Security
    - No changes to existing RLS policies
    - Maintains existing data integrity
*/

-- Update Exxen to be a streaming platform instead of network
UPDATE providers 
SET provider_type = 'streaming',
    is_network = false,
    description = 'Turkish premium streaming platform',
    updated_at = NOW()
WHERE id = 4405;

-- Add TOD as a new Turkish streaming platform
INSERT INTO providers (
  id, 
  name, 
  logo_path, 
  display_priority, 
  provider_type, 
  is_network, 
  country_of_origin, 
  supported_countries, 
  website_url, 
  description, 
  is_active
) VALUES (
  9020, -- Using a unique ID in the 9000 range like other Turkish platforms
  'TOD', 
  '/tod_logo.jpg', 
  20, 
  'streaming', 
  false, 
  'TR', 
  ARRAY['TR'], 
  'https://www.tod.com.tr', 
  'Turkish sports and entertainment streaming platform', 
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  display_priority = EXCLUDED.display_priority,
  provider_type = EXCLUDED.provider_type,
  is_network = EXCLUDED.is_network,
  country_of_origin = EXCLUDED.country_of_origin,
  supported_countries = EXCLUDED.supported_countries,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Mark BluTV as inactive (replaced by Max)
UPDATE providers 
SET is_active = false,
    description = 'Turkish streaming platform (now part of Max)',
    updated_at = NOW()
WHERE id = 9003 AND name = 'BluTV';

-- Ensure all other Turkish streaming platforms are correctly categorized
UPDATE providers 
SET provider_type = 'streaming',
    is_network = false,
    updated_at = NOW()
WHERE name IN ('Gain', 'Tabii', 'PuhuTV') 
  AND country_of_origin = 'TR';

-- Update table statistics
ANALYZE providers;
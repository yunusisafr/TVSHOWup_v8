/*
  # Update TOD Platform and Refine Provider Types

  1. Changes
    - Update Exxen to be a streaming platform instead of network
    - Add TOD as a new Turkish streaming platform
    - Mark BluTV as inactive (replaced by Max)
    - Ensure all Turkish streaming platforms are correctly categorized

  2. Security
    - No changes to RLS policies
    - Maintains existing security model
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

-- Add Max (formerly HBO Max) as active in Turkey
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
  384,
  'Max',
  '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg',
  4,
  'streaming',
  false,
  'US',
  ARRAY['US','GB','CA','AU','DE','FR','ES','IT','BR','MX','TR','NL','SE','NO','DK','FI'],
  'https://www.max.com',
  'Global streaming platform (formerly HBO Max)',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  supported_countries = EXCLUDED.supported_countries,
  description = EXCLUDED.description,
  website_url = EXCLUDED.website_url,
  updated_at = NOW();

-- Ensure all other Turkish streaming platforms are correctly categorized
UPDATE providers 
SET provider_type = 'streaming',
    is_network = false,
    updated_at = NOW()
WHERE name IN ('Gain', 'Tabii', 'PuhuTV') 
  AND country_of_origin = 'TR';

-- Update table statistics
ANALYZE providers;
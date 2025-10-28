/*
  # Add Mubi to providers table

  1. New Provider
    - `Mubi` - Arthouse and independent film streaming platform
    - TMDB Provider ID: 246
    - Supported in multiple countries worldwide
    - Display priority: 25 (between major platforms and regional ones)

  2. Details
    - Provider type: streaming
    - Website: https://mubi.com
    - Logo path: /mubi_logo.jpg
    - Active status: true
*/

-- Add Mubi to providers table
INSERT INTO providers (id, name, logo_path, display_priority, provider_type, is_active, supported_countries, website_url, description) VALUES
  (246, 'Mubi', '/mubi_logo.jpg', 25, 'streaming', true, 
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI','AT','CH','BE','IE','PT','PL','CZ','HU','RO','BG','HR','SI','SK','LT','LV','EE','GR','CY','MT','LU','IS','LI','AD','MC','SM','VA'], 
   'https://mubi.com', 
   'Arthouse and independent film streaming platform')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  display_priority = EXCLUDED.display_priority,
  provider_type = EXCLUDED.provider_type,
  is_active = EXCLUDED.is_active,
  supported_countries = EXCLUDED.supported_countries,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Update table statistics
ANALYZE providers;
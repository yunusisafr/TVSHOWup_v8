/*
  # Enhanced Provider System - Networks, Streaming, and Digital Purchase Support

  1. Changes
    - Update providers table to support different provider types
    - Add network support for TV shows
    - Enhance content_providers table with better categorization
    - Add indexes for performance

  2. Provider Types
    - streaming: Netflix, Prime Video, Disney+
    - network: Exxen, Show TV, ATV, BBC, CNN
    - digital_purchase: iTunes, Google Play, Microsoft Store
    - production_company: Warner Bros, Disney Studios

  3. Security
    - Maintain existing RLS policies
    - No breaking changes to existing data
*/

-- Add provider_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_type_enum') THEN
    CREATE TYPE provider_type_enum AS ENUM ('streaming', 'network', 'digital_purchase', 'production_company', 'free');
  END IF;
END $$;

-- Update providers table structure (safe updates)
DO $$
BEGIN
  -- Add provider_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'provider_type') THEN
    ALTER TABLE providers ADD COLUMN provider_type provider_type_enum DEFAULT 'streaming';
  END IF;
  
  -- Add is_network column for network identification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'is_network') THEN
    ALTER TABLE providers ADD COLUMN is_network BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add network_id for TMDB network mapping
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'network_id') THEN
    ALTER TABLE providers ADD COLUMN network_id INTEGER;
  END IF;
  
  -- Add country_of_origin for regional platforms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'country_of_origin') THEN
    ALTER TABLE providers ADD COLUMN country_of_origin VARCHAR(2);
  END IF;
END $$;

-- Update content_providers table for better categorization
DO $$
BEGIN
  -- Add availability_type for better categorization
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_providers' AND column_name = 'availability_type') THEN
    ALTER TABLE content_providers ADD COLUMN availability_type VARCHAR(50) DEFAULT 'streaming';
  END IF;
  
  -- Add quality information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_providers' AND column_name = 'quality') THEN
    ALTER TABLE content_providers ADD COLUMN quality VARCHAR(10) DEFAULT 'hd';
  END IF;
  
  -- Add subtitle/audio language support
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_providers' AND column_name = 'audio_languages') THEN
    ALTER TABLE content_providers ADD COLUMN audio_languages TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_providers' AND column_name = 'subtitle_languages') THEN
    ALTER TABLE content_providers ADD COLUMN subtitle_languages TEXT[];
  END IF;
END $$;

-- Insert/Update Turkish Networks (from TMDB)
INSERT INTO providers (id, name, logo_path, display_priority, provider_type, is_network, network_id, country_of_origin, supported_countries, website_url, description) VALUES
  -- Turkish Networks (TMDB Network IDs)
  (4405, 'Exxen', '/exxen_logo.jpg', 15, 'network', true, 4405, 'TR', ARRAY['TR'], 'https://www.exxen.com', 'Turkish premium streaming network'),
  (9011, 'Show TV', '/show_tv_logo.jpg', 16, 'network', true, 9011, 'TR', ARRAY['TR'], 'https://www.showtv.com.tr', 'Turkish television network'),
  (9012, 'ATV', '/atv_logo.jpg', 17, 'network', true, 9012, 'TR', ARRAY['TR'], 'https://www.atv.com.tr', 'Turkish television network'),
  (9013, 'Kanal D', '/kanal_d_logo.jpg', 18, 'network', true, 9013, 'TR', ARRAY['TR'], 'https://www.kanald.com.tr', 'Turkish television network'),
  (9014, 'TRT 1', '/trt1_logo.jpg', 19, 'network', true, 9014, 'TR', ARRAY['TR'], 'https://www.trt1.com.tr', 'Turkish public television'),
  (9015, 'Star TV', '/star_tv_logo.jpg', 20, 'network', true, 9015, 'TR', ARRAY['TR'], 'https://www.startv.com.tr', 'Turkish television network'),
  (9016, 'Fox TV', '/fox_tv_logo.jpg', 21, 'network', true, 9016, 'TR', ARRAY['TR'], 'https://www.fox.com.tr', 'Turkish television network'),
  
  -- International Networks
  (174, 'AMC', '/amc_logo.jpg', 50, 'network', true, 174, 'US', ARRAY['US','GB','CA'], 'https://www.amc.com', 'American cable network'),
  (49, 'HBO', '/hbo_logo.jpg', 51, 'network', true, 49, 'US', ARRAY['US','GB','CA','AU'], 'https://www.hbo.com', 'Premium cable network'),
  (213, 'Netflix', '/netflix_logo.jpg', 1, 'streaming', false, null, 'US', ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'], 'https://www.netflix.com', 'Global streaming platform'),
  (1024, 'BBC One', '/bbc_one_logo.jpg', 52, 'network', true, 1024, 'GB', ARRAY['GB'], 'https://www.bbc.co.uk/bbcone', 'British public television'),
  (2739, 'BBC Two', '/bbc_two_logo.jpg', 53, 'network', true, 2739, 'GB', ARRAY['GB'], 'https://www.bbc.co.uk/bbctwo', 'British public television')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  display_priority = EXCLUDED.display_priority,
  provider_type = EXCLUDED.provider_type,
  is_network = EXCLUDED.is_network,
  network_id = EXCLUDED.network_id,
  country_of_origin = EXCLUDED.country_of_origin,
  supported_countries = EXCLUDED.supported_countries,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Update existing providers with correct types
UPDATE providers SET 
  provider_type = 'streaming',
  is_network = false
WHERE name IN ('Netflix', 'Amazon Prime Video', 'Disney Plus', 'HBO Max', 'Apple TV Plus', 'Hulu', 'Paramount Plus');

UPDATE providers SET 
  provider_type = 'digital_purchase',
  is_network = false
WHERE name IN ('Apple iTunes', 'Google Play Movies', 'Microsoft Store', 'Amazon Video');

UPDATE providers SET 
  provider_type = 'free',
  is_network = false
WHERE name IN ('YouTube', 'Netflix basic with Ads');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_network ON providers(is_network) WHERE is_network = true;
CREATE INDEX IF NOT EXISTS idx_providers_network_id ON providers(network_id) WHERE network_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_country_origin ON providers(country_of_origin) WHERE country_of_origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_providers_availability ON content_providers(availability_type);
CREATE INDEX IF NOT EXISTS idx_content_providers_quality ON content_providers(quality);

-- Update table statistics
ANALYZE providers;
ANALYZE content_providers;
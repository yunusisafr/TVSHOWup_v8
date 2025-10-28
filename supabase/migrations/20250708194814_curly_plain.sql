-- Drop existing views that might reference provider_type
DROP VIEW IF EXISTS user_country_providers CASCADE;
DROP VIEW IF EXISTS all_content_providers CASCADE;

-- Drop existing enum and recreate with all necessary types
DO $$
BEGIN
  -- Drop existing enum if it exists and recreate with all types
  DROP TYPE IF EXISTS provider_type_enum CASCADE;
  CREATE TYPE provider_type_enum AS ENUM (
    'streaming',           -- Netflix, Amazon Prime, etc.
    'network',            -- TV networks like HBO, Exxen, Show TV
    'digital_purchase',   -- iTunes, Google Play, etc.
    'production_company', -- Production companies
    'free'               -- Free platforms like YouTube
  );
END $$;

-- Update providers table with enhanced structure
-- First drop the old provider_type column completely
ALTER TABLE providers DROP COLUMN IF EXISTS provider_type CASCADE;

-- Add new columns
ALTER TABLE providers 
  ADD COLUMN provider_type provider_type_enum DEFAULT 'streaming',
  ADD COLUMN IF NOT EXISTS is_network BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_id INTEGER,
  ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(2);

-- Update content_providers table for better matching
ALTER TABLE content_providers
  ADD COLUMN IF NOT EXISTS availability_type VARCHAR(50) DEFAULT 'streaming',
  ADD COLUMN IF NOT EXISTS quality VARCHAR(10) DEFAULT 'hd',
  ADD COLUMN IF NOT EXISTS audio_languages TEXT[],
  ADD COLUMN IF NOT EXISTS subtitle_languages TEXT[];

-- Clear existing providers and insert comprehensive list
TRUNCATE TABLE content_providers;
DELETE FROM providers;

-- Insert comprehensive provider list with proper categorization
INSERT INTO providers (id, name, logo_path, display_priority, provider_type, is_network, network_id, country_of_origin, supported_countries, website_url, description, is_active) VALUES
  -- Global Streaming Platforms
  (8, 'Netflix', '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', 1, 'streaming', false, null, 'US', 
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'], 
   'https://www.netflix.com', 'Global streaming platform', true),
  
  (119, 'Amazon Prime Video', '/emthp39XA2YScoYL1p0sdbAH2WA.jpg', 2, 'streaming', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.primevideo.com', 'Amazon streaming service', true),
  
  (337, 'Disney Plus', '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg', 3, 'streaming', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.disneyplus.com', 'Disney streaming platform', true),
  
  (384, 'HBO Max', '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg', 4, 'streaming', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.hbomax.com', 'HBO streaming service', true),
  
  (350, 'Apple TV Plus', '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg', 5, 'streaming', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://tv.apple.com', 'Apple streaming platform', true),
  
  -- Regional Streaming Platforms
  (15, 'Hulu', '/giwM8XX4V2AQb9vsoN7yti82tKK.jpg', 6, 'streaming', false, null, 'US',
   ARRAY['US','JP'], 'https://www.hulu.com', 'US streaming platform', true),
  
  (531, 'Paramount Plus', '/fi83B1oztoS47xxcemFdTOCo3Zk.jpg', 7, 'streaming', false, null, 'US',
   ARRAY['US','GB','CA','AU','BR','MX'], 'https://www.paramountplus.com', 'Paramount streaming service', true),
  
  -- Turkish Streaming Platforms
  (4405, 'Exxen', '/exxen_logo.jpg', 15, 'network', true, 4405, 'TR',
   ARRAY['TR'], 'https://www.exxen.com', 'Turkish premium streaming network', true),
  
  (9001, 'Gain', '/gain_logo.jpg', 16, 'streaming', false, null, 'TR',
   ARRAY['TR'], 'https://www.gain.tv', 'Turkish streaming platform', true),
  
  (9002, 'Tabii', '/tabii_logo.jpg', 17, 'streaming', false, null, 'TR',
   ARRAY['TR'], 'https://www.tabii.com', 'Turkish streaming platform', true),
  
  (9003, 'BluTV', '/blutv_logo.jpg', 18, 'streaming', false, null, 'TR',
   ARRAY['TR'], 'https://www.blutv.com', 'Turkish streaming platform', true),
  
  (9004, 'PuhuTV', '/puhutv_logo.jpg', 19, 'streaming', false, null, 'TR',
   ARRAY['TR'], 'https://www.puhutv.com', 'Turkish streaming platform', true),
  
  -- Turkish TV Networks
  (9011, 'Show TV', '/show_tv_logo.jpg', 25, 'network', true, 9011, 'TR',
   ARRAY['TR'], 'https://www.showtv.com.tr', 'Turkish television network', true),
  
  (9012, 'ATV', '/atv_logo.jpg', 26, 'network', true, 9012, 'TR',
   ARRAY['TR'], 'https://www.atv.com.tr', 'Turkish television network', true),
  
  (9013, 'Kanal D', '/kanal_d_logo.jpg', 27, 'network', true, 9013, 'TR',
   ARRAY['TR'], 'https://www.kanald.com.tr', 'Turkish television network', true),
  
  (9014, 'TRT 1', '/trt1_logo.jpg', 28, 'network', true, 9014, 'TR',
   ARRAY['TR'], 'https://www.trt1.com.tr', 'Turkish public television', true),
  
  (9015, 'Star TV', '/star_tv_logo.jpg', 29, 'network', true, 9015, 'TR',
   ARRAY['TR'], 'https://www.startv.com.tr', 'Turkish television network', true),
  
  (9016, 'Fox TV', '/fox_tv_logo.jpg', 30, 'network', true, 9016, 'TR',
   ARRAY['TR'], 'https://www.fox.com.tr', 'Turkish television network', true),
  
  -- International Networks
  (49, 'HBO', '/hbo_logo.jpg', 40, 'network', true, 49, 'US',
   ARRAY['US','GB','CA','AU'], 'https://www.hbo.com', 'Premium cable network', true),
  
  (174, 'AMC', '/amc_logo.jpg', 41, 'network', true, 174, 'US',
   ARRAY['US','GB','CA'], 'https://www.amc.com', 'American cable network', true),
  
  (1024, 'BBC One', '/bbc_one_logo.jpg', 42, 'network', true, 1024, 'GB',
   ARRAY['GB'], 'https://www.bbc.co.uk/bbcone', 'British public television', true),
  
  (2739, 'BBC Two', '/bbc_two_logo.jpg', 43, 'network', true, 2739, 'GB',
   ARRAY['GB'], 'https://www.bbc.co.uk/bbctwo', 'British public television', true),
  
  -- Digital Purchase Platforms
  (2, 'Apple iTunes', '/q6tl6Ib6X5FT80RMlcDbexIo4St.jpg', 50, 'digital_purchase', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.apple.com/itunes/', 'Apple digital store', true),
  
  (3, 'Google Play Movies', '/xTVM8ERirXh9dHBHM5JFDTrxnOK.jpg', 51, 'digital_purchase', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://play.google.com/store/movies', 'Google digital store', true),
  
  (68, 'Microsoft Store', '/yKUNdKHjvnMdOI8tJF4xG5XnNxv.jpg', 52, 'digital_purchase', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.microsoft.com/store', 'Microsoft digital store', true),
  
  (10, 'Amazon Video', '/emthp39XA2YScoYL1p0sdbAH2WA.jpg', 53, 'digital_purchase', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.amazon.com/gp/video', 'Amazon digital rental/purchase', true),
  
  -- Free Platforms
  (192, 'YouTube', '/dQeAar5H991VYporEjUspolDarG.jpg', 60, 'free', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','JP','KR','IN','BR','MX','TR','NL','SE','NO','DK','FI'],
   'https://www.youtube.com', 'Free video platform', true),
  
  (1796, 'Netflix basic with Ads', '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', 61, 'free', false, null, 'US',
   ARRAY['US','GB','CA','AU','DE','FR','ES','IT','BR','MX','TR'],
   'https://www.netflix.com', 'Netflix ad-supported tier', true);

-- Create comprehensive indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_network ON providers(is_network) WHERE is_network = true;
CREATE INDEX IF NOT EXISTS idx_providers_network_id ON providers(network_id) WHERE network_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_country_origin ON providers(country_of_origin) WHERE country_of_origin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_providers_countries ON providers USING gin(supported_countries) WHERE supported_countries IS NOT NULL;

-- Content providers indexes
CREATE INDEX IF NOT EXISTS idx_content_providers_lookup ON content_providers(content_id, content_type, country_code);
CREATE INDEX IF NOT EXISTS idx_content_providers_provider_country ON content_providers(provider_id, country_code);
CREATE INDEX IF NOT EXISTS idx_content_providers_availability ON content_providers(availability_type);
CREATE INDEX IF NOT EXISTS idx_content_providers_quality ON content_providers(quality);

-- Recreate views with the new enum type
CREATE OR REPLACE VIEW user_country_providers AS
SELECT 
  cp.content_id,
  cp.content_type,
  p.id as provider_id,
  p.name as provider_name,
  p.logo_path,
  cp.country_code,
  cp.monetization_type,
  cp.link
FROM content_providers cp
JOIN providers p ON cp.provider_id = p.id
WHERE p.is_active = true;

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
  cp.country_code
FROM content_providers cp
JOIN providers p ON cp.provider_id = p.id
WHERE p.is_active = true;

-- Grant necessary permissions
GRANT SELECT ON user_country_providers TO authenticated, anon;
GRANT SELECT ON all_content_providers TO authenticated, anon;

-- Add RLS policies for the views
ALTER VIEW user_country_providers SET (security_invoker = true);
ALTER VIEW all_content_providers SET (security_invoker = true);

-- Update table statistics
ANALYZE providers;
ANALYZE content_providers;

-- Add some sample content provider relationships for testing
-- This would typically be populated by the sync functions
INSERT INTO content_providers (content_id, content_type, provider_id, country_code, monetization_type, link, availability_type, quality) VALUES
  -- Sample Netflix content
  (1, 'movie', 8, 'US', 'flatrate', 'https://www.netflix.com', 'streaming', 'hd'),
  (1, 'movie', 8, 'TR', 'flatrate', 'https://www.netflix.com', 'streaming', 'hd'),
  (1, 'movie', 8, 'GB', 'flatrate', 'https://www.netflix.com', 'streaming', 'hd'),
  
  -- Sample Amazon Prime content
  (1, 'movie', 119, 'US', 'flatrate', 'https://www.primevideo.com', 'streaming', 'hd'),
  (1, 'movie', 119, 'TR', 'flatrate', 'https://www.primevideo.com', 'streaming', 'hd'),
  
  -- Sample digital purchase
  (1, 'movie', 2, 'US', 'buy', 'https://www.apple.com/itunes/', 'digital_purchase', 'hd'),
  (1, 'movie', 3, 'US', 'rent', 'https://play.google.com/store/movies', 'digital_purchase', 'hd')
ON CONFLICT (content_id, content_type, provider_id, country_code, monetization_type) DO NOTHING;
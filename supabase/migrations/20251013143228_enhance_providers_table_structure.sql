/*
  # Enhanced Provider Table Structure
  
  1. Changes
    - Add missing columns to providers table (provider_type, is_active, supported_countries, etc.)
    - Add missing columns to content_providers table (link, presentation_type, last_updated, etc.)
    - Create indexes for better query performance
    - Insert Turkish streaming platforms
    
  2. Security
    - Maintain existing RLS policies
    - All changes are additive and backward compatible
*/

-- Add missing columns to providers table
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'streaming',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS supported_countries TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(2),
  ADD COLUMN IF NOT EXISTS is_network BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS network_id INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing columns to content_providers table
ALTER TABLE content_providers
  ADD COLUMN IF NOT EXISTS link VARCHAR(500),
  ADD COLUMN IF NOT EXISTS presentation_type VARCHAR(50) DEFAULT 'hd',
  ADD COLUMN IF NOT EXISTS price_info JSONB,
  ADD COLUMN IF NOT EXISTS availability_start DATE,
  ADD COLUMN IF NOT EXISTS availability_end DATE,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT now();

-- Update existing providers with provider_type
UPDATE providers SET provider_type = 'streaming' WHERE id IN (8, 119, 337, 384, 1899, 350, 15, 531);
UPDATE providers SET provider_type = 'digital_purchase' WHERE id IN (2, 3);
UPDATE providers SET provider_type = 'free' WHERE id = 192;

-- Insert Turkish streaming platforms if they don't exist
INSERT INTO providers (id, name, logo_path, display_priority, provider_type, is_active, supported_countries, website_url, description, country_of_origin, is_network)
VALUES
  (9001, 'Gain', '/gain_logo.jpg', 16, 'streaming', true, ARRAY['TR'], 'https://www.gain.tv', 'Turkish streaming platform', 'TR', false),
  (9002, 'Tabii', '/tabii_logo.jpg', 17, 'streaming', true, ARRAY['TR'], 'https://www.tabii.com', 'Turkish streaming platform', 'TR', false),
  (9003, 'BluTV', '/blutv_logo.jpg', 18, 'streaming', true, ARRAY['TR'], 'https://www.blutv.com', 'Turkish streaming platform', 'TR', false),
  (9004, 'PuhuTV', '/puhutv_logo.jpg', 19, 'streaming', true, ARRAY['TR'], 'https://www.puhutv.com', 'Turkish streaming platform', 'TR', false),
  (4405, 'Exxen', '/exxen_logo.jpg', 15, 'network', true, ARRAY['TR'], 'https://www.exxen.com', 'Turkish premium streaming network', 'TR', true),
  (307, 'TOD', '/tod_logo.jpg', 20, 'streaming', true, ARRAY['TR'], 'https://www.tod.tv', 'Turkish streaming platform', 'TR', false)
ON CONFLICT (id) DO UPDATE SET
  provider_type = EXCLUDED.provider_type,
  is_active = EXCLUDED.is_active,
  supported_countries = EXCLUDED.supported_countries,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  country_of_origin = EXCLUDED.country_of_origin,
  is_network = EXCLUDED.is_network,
  updated_at = now();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(provider_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_providers_country ON providers USING gin(supported_countries);
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(is_active);

CREATE INDEX IF NOT EXISTS idx_content_providers_lookup ON content_providers(content_id, content_type, country_code);
CREATE INDEX IF NOT EXISTS idx_content_providers_provider ON content_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_content_providers_country ON content_providers(country_code);
CREATE INDEX IF NOT EXISTS idx_content_providers_updated ON content_providers(last_updated DESC);

-- Create unique constraint to prevent duplicate provider-content-country relationships
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_providers_unique 
  ON content_providers(content_id, content_type, provider_id, country_code, monetization_type);

-- Add trigger to update updated_at on providers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_providers_updated_at ON content_providers;
CREATE TRIGGER update_content_providers_updated_at
    BEFORE UPDATE ON content_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

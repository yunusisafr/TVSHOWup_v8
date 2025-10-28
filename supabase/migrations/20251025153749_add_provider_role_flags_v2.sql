/*
  # Add Provider Role Flags

  ## Purpose
  Track which role(s) each provider has in TMDB:
  - is_watch_provider: Can users watch content on this platform? (from Watch Providers API)
  - is_network_provider: Does this platform produce/broadcast content? (from Networks API)

  ## Examples
  - Netflix ID:8 → is_watch_provider=true, is_network_provider=false (streaming only)
  - Netflix ID:213 → is_watch_provider=false, is_network_provider=true (production only)
  - Exxen ID:1791 → is_watch_provider=true, is_network_provider=false (streaming)
  - Exxen ID:4405 → is_watch_provider=false, is_network_provider=true (production)
  - AMC ID:174 → is_watch_provider=false, is_network_provider=true (broadcast only)

  ## Note
  Some platforms like Exxen have TWO different TMDB IDs for their two roles.
  We keep both IDs and mark their roles appropriately.
*/

-- Add role flags to providers table
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS is_watch_provider BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_network_provider BOOLEAN DEFAULT false;

-- Update existing providers based on current provider_type
UPDATE providers 
SET 
  is_watch_provider = (provider_type IN ('streaming', 'free', 'digital_purchase')),
  is_network_provider = (provider_type = 'network');

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_providers_watch_provider ON providers(is_watch_provider) WHERE is_watch_provider = true;
CREATE INDEX IF NOT EXISTS idx_providers_network_provider ON providers(is_network_provider) WHERE is_network_provider = true;

-- Add comments
COMMENT ON COLUMN providers.is_watch_provider IS 'True if this provider is in TMDB Watch Providers API (users can watch content here)';
COMMENT ON COLUMN providers.is_network_provider IS 'True if this provider is in TMDB Networks API (produces/broadcasts content)';

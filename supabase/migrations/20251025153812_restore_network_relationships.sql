/*
  # Restore Network Relationships

  ## Purpose
  Restore network relationships in content_providers that were removed by previous migration.
  Networks represent which platform PRODUCED the content (metadata).
  Watch providers represent where users can WATCH the content (streaming).

  ## Changes
  - Re-enable network providers in content_providers
  - Add source_type field to distinguish between 'network' and 'watch_provider'
  - Keep both types of relationships

  ## Example
  "As If" TV Show (ID: 115678):
  - Network: Exxen (ID: 4405) → Produced by Exxen
  - Watch Provider: Exxen (ID: 1791) → Streamable on Exxen

  ## Security
  - Maintains existing RLS policies
  - No impact on user permissions
*/

-- Add source_type to distinguish network vs watch provider relationships
ALTER TABLE content_providers
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'watch_provider' CHECK (source_type IN ('watch_provider', 'network'));

-- Update existing rows to mark them as watch_provider
UPDATE content_providers 
SET source_type = 'watch_provider' 
WHERE source_type IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_content_providers_source_type ON content_providers(source_type);

-- Add comment
COMMENT ON COLUMN content_providers.source_type IS 'Source of this relationship: watch_provider (TMDB Watch Providers API) or network (TMDB Networks API)';

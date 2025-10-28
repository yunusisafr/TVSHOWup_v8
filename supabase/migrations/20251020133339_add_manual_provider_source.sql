/*
  # Add Manual Provider Source Tracking
  
  1. Changes
    - Add `data_source` column to content_providers table to track if provider is from TMDB or manually added
    - Create index on data_source for filtering
    - Update existing records to mark them as 'tmdb'
    
  2. Security
    - Maintains existing RLS policies
    - Backward compatible
*/

-- Add data_source column to track provider origin
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_providers' AND column_name = 'data_source'
  ) THEN
    ALTER TABLE content_providers 
      ADD COLUMN data_source VARCHAR(20) DEFAULT 'tmdb' CHECK (data_source IN ('tmdb', 'manual', 'hybrid'));
  END IF;
END $$;

-- Mark existing records as from TMDB
UPDATE content_providers SET data_source = 'tmdb' WHERE data_source IS NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_content_providers_source ON content_providers(data_source);

-- Add helpful comment
COMMENT ON COLUMN content_providers.data_source IS 'Source of provider data: tmdb (from TMDB API), manual (admin added), hybrid (TMDB + admin enriched)';

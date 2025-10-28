/*
  # Fix Provider Categorization

  1. Provider Types
    - Correctly categorize providers as 'streaming', 'network', 'digital_purchase', 'free', or 'production_company'
    - Fix specific cases like AMC (network) vs AMC+ (streaming)
    - Create helper views for provider analysis

  2. Changes
    - Update provider_type for all providers based on known categories
    - Create view to identify potential duplicate providers
*/

-- First, ensure the provider_type_enum type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_type_enum') THEN
    CREATE TYPE provider_type_enum AS ENUM ('digital_purchase', 'free', 'network', 'production_company', 'streaming');
  END IF;
END $$;

-- Update streaming services
UPDATE providers
SET 
  provider_type = 'streaming',
  updated_at = NOW()
WHERE 
  name ILIKE ANY(ARRAY[
    '%Netflix%', '%Amazon Prime%', '%Disney+%', '%HBO Max%', '%Max%', '%Apple TV+%', 
    '%Hulu%', '%Paramount+%', '%Peacock%', '%Discovery+%', '%BluTV%', '%Gain%', 
    '%Exxen%', '%Tabii%', '%TOD%', '%PuhuTV%', '%beIN CONNECT%', '%S Sport Plus%',
    '%Crunchyroll%', '%Funimation%', '%Crave%', '%Stan%', '%Hotstar%', '%Disney+ Hotstar%',
    '%Viaplay%', '%DAZN%', '%Mubi%', '%Shudder%', '%BritBox%', '%Acorn TV%'
  ]);

-- Update TV networks
UPDATE providers
SET 
  provider_type = 'network',
  updated_at = NOW()
WHERE 
  name ILIKE ANY(ARRAY[
    'AMC', '%BBC%', '%CBS%', '%NBC%', '%ABC%', '%Fox%', '%The CW%', '%PBS%', 
    '%Showtime%', '%Starz%', '%FX%', '%HBO%', '%TBS%', '%TNT%', '%USA Network%', 
    '%Syfy%', '%Comedy Central%', '%Adult Swim%', '%Cartoon Network%',
    '%Nickelodeon%', '%Disney Channel%', '%History Channel%', '%National Geographic%',
    '%Discovery Channel%', '%A&E%', '%Bravo%', '%E!%', '%Lifetime%', '%MTV%', '%VH1%', '%ESPN%',
    '%TRT%', '%Show TV%', '%Kanal D%', '%ATV%', '%Star TV%', '%Fox Türkiye%', '%TV8%',
    '%TRT 2%', '%TRT Belgesel%', '%TRT Çocuk%', '%TRT Spor%', '%NTV%', '%CNN Türk%',
    '%Habertürk%', '%DMAX%', '%TLC%'
  ])
AND NOT name ILIKE ANY(ARRAY[
  '%Netflix%', '%Amazon Prime%', '%Disney+%', '%HBO Max%', '%Max%', '%Apple TV+%', 
  '%Hulu%', '%Paramount+%', '%Peacock%', '%Discovery+%'
]);

-- Update digital purchase platforms
UPDATE providers
SET 
  provider_type = 'digital_purchase',
  updated_at = NOW()
WHERE 
  name ILIKE ANY(ARRAY[
    '%Google Play Movies%', '%Apple TV%', '%Amazon Video%', '%YouTube%', '%Microsoft Store%',
    '%Vudu%', '%Rakuten TV%', '%Sky Store%'
  ]);

-- Fix specific cases
-- Fix AMC (network)
UPDATE providers
SET 
  provider_type = 'network',
  updated_at = NOW()
WHERE 
  name = 'AMC';

-- Fix AMC+ (streaming)
UPDATE providers
SET 
  provider_type = 'streaming',
  updated_at = NOW()
WHERE 
  name = 'AMC+';

-- Set default for any remaining NULL values
UPDATE providers
SET 
  provider_type = 'streaming',
  updated_at = NOW()
WHERE 
  provider_type IS NULL;

-- Create a view to identify potential duplicate providers
CREATE OR REPLACE VIEW duplicate_providers AS
SELECT 
  LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) AS normalized_name,
  ARRAY_AGG(id) AS provider_ids,
  ARRAY_AGG(name) AS provider_names,
  ARRAY_AGG(provider_type) AS provider_types,
  COUNT(*) AS provider_count
FROM 
  providers
GROUP BY 
  LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'))
HAVING 
  COUNT(*) > 1;
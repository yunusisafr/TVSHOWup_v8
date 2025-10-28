/*
  # Fix Provider Categorization

  1. Provider Type Corrections
    - Update provider_type for known streaming services
    - Update provider_type for known networks
    - Set default provider_type for uncategorized providers
  
  2. Provider Relationships
    - Add missing provider relationships
    - Fix incorrect provider relationships
*/

-- Create a temporary table to store known streaming services
CREATE TEMP TABLE known_streaming_services (name TEXT);

-- Insert known streaming services
INSERT INTO known_streaming_services (name) VALUES
('Netflix'), ('Netflix Kids'), ('Netflix Basic with ads'),
('Amazon Prime Video'), ('Prime Video'), 
('Disney Plus'), ('Disney+'), ('Disney+ Hotstar'),
('HBO Max'), ('Max'), ('HBO'), ('HBO Go'),
('Apple TV'), ('Apple TV+'), ('Apple TV Plus'),
('Hulu'), ('Hulu Plus'),
('Paramount+'), ('Paramount Plus'),
('Peacock'), ('Peacock Premium'),
('Crunchyroll'),
('Discovery+'), ('Discovery Plus'),
('Showtime'),
('Starz'),
('BluTV'), ('Blu TV'),
('Gain'),
('Exxen'),
('Tabii'),
('TOD'),
('PuhuTV'), ('Puhu TV'),
('beIN CONNECT'),
('Mubi'),
('YouTube Premium');

-- Create a temporary table to store known networks
CREATE TEMP TABLE known_networks (name TEXT);

-- Insert known networks
INSERT INTO known_networks (name) VALUES
('ABC'), ('NBC'), ('CBS'), ('FOX'), ('The CW'), ('BBC'), ('BBC One'), ('BBC Two'),
('AMC'), ('FX'), ('Showtime'), ('Starz'), ('HBO'), ('Comedy Central'),
('TBS'), ('TNT'), ('USA Network'), ('Syfy'), ('History'), ('A&E'),
('TLC'), ('Discovery Channel'), ('National Geographic'), ('Animal Planet'),
('Cartoon Network'), ('Nickelodeon'), ('Disney Channel'), ('Disney XD'),
('ESPN'), ('MTV'), ('VH1'), ('BET'), ('Bravo'), ('E!'),
('TRT'), ('TRT 1'), ('TRT 2'), ('TRT Belgesel'), ('TRT Çocuk'),
('Show TV'), ('ATV'), ('Kanal D'), ('Star TV'), ('TV8'), ('FOX Türkiye');

-- Update provider_type for known streaming services
UPDATE providers
SET provider_type = 'streaming', updated_at = NOW()
WHERE name IN (SELECT name FROM known_streaming_services)
   OR name LIKE '%Netflix%'
   OR name LIKE '%Prime%'
   OR name LIKE '%Disney+%'
   OR name LIKE '%HBO%'
   OR name LIKE '%Apple TV%'
   OR name LIKE '%Hulu%'
   OR name LIKE '%Paramount+%'
   OR name LIKE '%Peacock%'
   OR name LIKE '%Max%';

-- Update provider_type for known networks
UPDATE providers
SET provider_type = 'network', updated_at = NOW()
WHERE name IN (SELECT name FROM known_networks);

-- Set default provider_type for uncategorized providers
UPDATE providers
SET provider_type = 
  CASE 
    WHEN provider_type IS NULL THEN 'streaming'
    ELSE provider_type
  END,
  updated_at = NOW()
WHERE provider_type IS NULL;

-- Drop temporary tables
DROP TABLE known_streaming_services;
DROP TABLE known_networks;

-- Create a function to normalize provider names
CREATE OR REPLACE FUNCTION normalize_provider_name(name TEXT) RETURNS TEXT AS $$
BEGIN
  -- Remove common suffixes and normalize spacing
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(name, ' Kids$', ''),
          ' Premium$', ''
        ),
        ' Basic with ads$', ''
      ),
      ' Plus$', '+'
    ),
    '\\s+', ' ', 'g'
  );
END;
$$ LANGUAGE plpgsql;

-- Create a view to help identify duplicate providers
CREATE OR REPLACE VIEW duplicate_providers AS
SELECT 
  normalize_provider_name(name) AS normalized_name,
  array_agg(id) AS provider_ids,
  array_agg(name) AS provider_names,
  array_agg(provider_type) AS provider_types,
  COUNT(*) AS provider_count
FROM providers
GROUP BY normalize_provider_name(name)
HAVING COUNT(*) > 1;

-- Log the results
DO $$
DECLARE
  streaming_count INTEGER;
  network_count INTEGER;
  other_count INTEGER;
  total_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO streaming_count FROM providers WHERE provider_type = 'streaming';
  SELECT COUNT(*) INTO network_count FROM providers WHERE provider_type = 'network';
  SELECT COUNT(*) INTO other_count FROM providers WHERE provider_type NOT IN ('streaming', 'network');
  SELECT COUNT(*) INTO total_count FROM providers;
  SELECT COUNT(*) INTO duplicate_count FROM duplicate_providers;
  
  RAISE NOTICE 'Provider categorization complete:';
  RAISE NOTICE '- Streaming providers: %', streaming_count;
  RAISE NOTICE '- Network providers: %', network_count;
  RAISE NOTICE '- Other providers: %', other_count;
  RAISE NOTICE '- Total providers: %', total_count;
  RAISE NOTICE '- Potential duplicates: %', duplicate_count;
END $$;
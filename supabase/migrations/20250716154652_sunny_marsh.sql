/*
  # Provider Categorization System

  1. Functions
    - `auto_categorize_provider()` - Automatically categorizes providers based on name patterns
    - `update_providers_updated_at()` - Updates the updated_at timestamp when providers are modified
  
  2. Triggers
    - Add trigger to automatically categorize providers on insert or update
    - Add trigger to update the updated_at timestamp
  
  3. Data Updates
    - Fix existing provider categorization for streaming services, digital purchase platforms, etc.
  
  4. Views
    - Create views for provider categorization analysis and duplicate detection
*/

-- Create a function to automatically categorize providers based on name patterns
CREATE OR REPLACE FUNCTION auto_categorize_provider()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't override if provider_type is already set and we're not forcing recategorization
  IF NEW.provider_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Known streaming services (subscription-based platforms)
  IF NEW.name ILIKE ANY(ARRAY[
    '%netflix%', '%prime video%', '%disney+%', '%disney plus%', '%hbo max%', '%max%', 
    '%apple tv+%', '%apple tv plus%', '%hulu%', '%paramount+%', '%peacock%', 
    '%discovery+%', '%blutv%', '%gain%', '%exxen%', '%tabii%', '%tod%', '%puhutv%', 
    '%bein connect%', '%s sport plus%', '%crunchyroll%', '%funimation%', '%crave%', 
    '%stan%', '%hotstar%', '%viaplay%', '%dazn%', '%mubi%', '%shudder%', '%britbox%', 
    '%acorn tv%', '%amc+%', '%showtime%', '%starz%', '%criterion%', '%curiosity%',
    '%kids%', '%junior%', '%plus%', '%premium%', '%go%'
  ]) THEN
    NEW.provider_type := 'streaming';
  
  -- Digital purchase platforms
  ELSIF NEW.name ILIKE ANY(ARRAY[
    '%google play%', '%apple tv%', '%amazon video%', '%youtube%', '%microsoft store%',
    '%vudu%', '%rakuten tv%', '%sky store%', '%fandango%'
  ]) THEN
    NEW.provider_type := 'digital_purchase';
  
  -- Free ad-supported platforms
  ELSIF NEW.name ILIKE ANY(ARRAY[
    '%tubi%', '%pluto%', '%roku%', '%imdb tv%', '%freevee%', '%crackle%', '%plex%'
  ]) THEN
    NEW.provider_type := 'free';
  
  -- TV Networks
  ELSIF NEW.name ILIKE ANY(ARRAY[
    '%amc%', '%bbc%', '%cbs%', '%nbc%', '%abc%', '%fox%', '%the cw%', '%pbs%', 
    '%fx%', '%hbo%', '%tbs%', '%tnt%', '%usa network%', '%syfy%', '%comedy central%', 
    '%adult swim%', '%cartoon network%', '%nickelodeon%', '%disney channel%', 
    '%history channel%', '%national geographic%', '%discovery channel%', '%a&e%', 
    '%bravo%', '%e!%', '%lifetime%', '%mtv%', '%vh1%', '%espn%', '%trt%', '%show tv%', 
    '%kanal d%', '%atv%', '%star tv%', '%fox türkiye%', '%tv8%', '%ntv%', '%cnn türk%', 
    '%habertürk%', '%dmax%', '%tlc%'
  ]) AND NOT NEW.name ILIKE ANY(ARRAY['%plus%', '%+%', '%max%', '%go%', '%kids%', '%premium%']) THEN
    NEW.provider_type := 'network';
  
  -- Default to streaming if we can't determine
  ELSE
    NEW.provider_type := 'streaming';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically categorize providers on insert or update
DROP TRIGGER IF EXISTS categorize_provider_trigger ON providers;
CREATE TRIGGER categorize_provider_trigger
BEFORE INSERT OR UPDATE ON providers
FOR EACH ROW
EXECUTE FUNCTION auto_categorize_provider();

-- Add trigger to update the updated_at timestamp
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
CREATE TRIGGER update_providers_updated_at
BEFORE UPDATE ON providers
FOR EACH ROW
EXECUTE FUNCTION update_providers_updated_at();

-- Fix existing provider categorization
-- First, fix all streaming services
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%netflix%', '%prime video%', '%disney+%', '%disney plus%', '%hbo max%', '%max%', 
  '%apple tv+%', '%apple tv plus%', '%hulu%', '%paramount+%', '%peacock%', 
  '%discovery+%', '%blutv%', '%gain%', '%exxen%', '%tabii%', '%tod%', '%puhutv%', 
  '%bein connect%', '%s sport plus%', '%crunchyroll%', '%funimation%', '%crave%', 
  '%stan%', '%hotstar%', '%viaplay%', '%dazn%', '%mubi%', '%shudder%', '%britbox%', 
  '%acorn tv%', '%amc+%', '%showtime%', '%starz%', '%criterion%', '%curiosity%',
  '%kids%', '%junior%', '%plus%', '%premium%', '%go%'
]);

-- Fix digital purchase platforms
UPDATE providers
SET provider_type = 'digital_purchase', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%google play%', '%apple tv%', '%amazon video%', '%youtube%', '%microsoft store%',
  '%vudu%', '%rakuten tv%', '%sky store%', '%fandango%'
]);

-- Fix free ad-supported platforms
UPDATE providers
SET provider_type = 'free', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%tubi%', '%pluto%', '%roku%', '%imdb tv%', '%freevee%', '%crackle%', '%plex%'
]);

-- Fix TV networks (but exclude those with streaming keywords)
UPDATE providers
SET provider_type = 'network', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%amc%', '%bbc%', '%cbs%', '%nbc%', '%abc%', '%fox%', '%the cw%', '%pbs%', 
  '%fx%', '%hbo%', '%tbs%', '%tnt%', '%usa network%', '%syfy%', '%comedy central%', 
  '%adult swim%', '%cartoon network%', '%nickelodeon%', '%disney channel%', 
  '%history channel%', '%national geographic%', '%discovery channel%', '%a&e%', 
  '%bravo%', '%e!%', '%lifetime%', '%mtv%', '%vh1%', '%espn%', '%trt%', '%show tv%', 
  '%kanal d%', '%atv%', '%star tv%', '%fox türkiye%', '%tv8%', '%ntv%', '%cnn türk%', 
  '%habertürk%', '%dmax%', '%tlc%'
])
AND NOT name ILIKE ANY(ARRAY['%plus%', '%+%', '%max%', '%go%', '%kids%', '%premium%']);

-- Specific fixes for common edge cases
-- Fix Netflix Kids and any Netflix variants
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%netflix%';

-- Fix HBO Max and HBO variants with "Max" or "+"
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%hbo%' AND (name ILIKE '%max%' OR name ILIKE '%+%');

-- Fix HBO (the network)
UPDATE providers
SET provider_type = 'network', updated_at = now()
WHERE name = 'HBO';

-- Fix AMC+ (streaming) vs AMC (network)
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name = 'AMC+' OR name ILIKE '%amc plus%';

UPDATE providers
SET provider_type = 'network', updated_at = now()
WHERE name = 'AMC';

-- Fix Exxen (should be streaming only)
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%exxen%';

-- Create a view to analyze provider categorization
CREATE OR REPLACE VIEW provider_categorization_analysis AS
SELECT 
  provider_type,
  count(*) as provider_count,
  array_agg(name) as provider_names
FROM providers
WHERE provider_type IS NOT NULL
GROUP BY provider_type
ORDER BY count(*) DESC;

-- Create a view to find duplicate providers
CREATE OR REPLACE VIEW duplicate_providers AS
SELECT 
  lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) as normalized_name,
  array_agg(id) as provider_ids,
  array_agg(name) as provider_names,
  array_agg(provider_type) as provider_types,
  count(*) as provider_count
FROM providers
GROUP BY normalized_name
HAVING count(*) > 1
ORDER BY count(*) DESC;
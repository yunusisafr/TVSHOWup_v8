/*
  # Fix Netflix Kids Provider Type

  1. Changes
    - Update Netflix Kids provider_type from 'network' to 'streaming'
    - Update any provider with 'Netflix' in the name to be of type 'streaming'
    - Ensure all streaming services are correctly categorized
*/

-- Fix Netflix Kids specifically
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%Netflix Kids%';

-- Fix all Netflix variants
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%Netflix%' AND provider_type != 'streaming';

-- Fix other common streaming services that might be miscategorized
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE (
  name ILIKE '%kids%' OR 
  name ILIKE '%junior%' OR
  name ILIKE '%plus%' OR
  name ILIKE '%+%' OR
  name ILIKE '%premium%' OR
  name ILIKE '%max%' OR
  name ILIKE '%go%'
) AND provider_type = 'network';

-- Fix specific known streaming services
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name IN (
  'Netflix', 'Amazon Prime Video', 'Disney+', 'HBO Max', 'Max', 'Apple TV+', 
  'Hulu', 'Paramount+', 'Peacock', 'Discovery+', 'BluTV', 'Gain', 
  'Exxen', 'Tabii', 'TOD', 'PuhuTV', 'beIN CONNECT', 'S Sport Plus',
  'Crunchyroll', 'Funimation', 'Crave', 'Stan', 'Hotstar', 'Disney+ Hotstar',
  'Viaplay', 'DAZN', 'Mubi', 'Shudder', 'BritBox', 'Acorn TV'
) AND provider_type != 'streaming';
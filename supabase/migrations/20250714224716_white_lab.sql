/*
  # Fix Streaming Platforms Categorization

  1. Updates
    - Correctly categorizes all streaming platforms as 'streaming'
    - Ensures Turkish platforms (Exxen, Tabii, PuhuTV, etc.) are categorized as 'streaming'
    - Fixes Netflix Kids and other sub-services to be categorized as 'streaming'
    - Updates provider_type for all providers based on their names
  
  2. Additions
    - Adds a function to automatically categorize providers
    - Creates a view to analyze provider categorization
*/

-- Bilinen streaming servislerini doğru şekilde kategorize et
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%Netflix%', '%Prime Video%', '%Disney+%', '%HBO Max%', '%Max%', '%Apple TV+%',
  '%Hulu%', '%Paramount+%', '%Peacock%', '%Discovery+%', '%BluTV%', '%Gain%',
  '%Exxen%', '%Tabii%', '%TOD%', '%PuhuTV%', '%beIN CONNECT%', '%S Sport Plus%',
  '%Crunchyroll%', '%Funimation%', '%Crave%', '%Stan%', '%Hotstar%', '%Disney+ Hotstar%',
  '%Viaplay%', '%DAZN%', '%Mubi%', '%Shudder%', '%BritBox%', '%Acorn TV%'
]);

-- Türk streaming platformlarını özellikle kontrol et ve düzelt
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%Exxen%', '%Tabii%', '%PuhuTV%', '%Puhu TV%', '%TOD%', '%Gain%', '%BluTV%', '%Blu TV%'
]);

-- Netflix Kids ve diğer alt hizmetleri düzelt
UPDATE providers
SET provider_type = 'streaming', updated_at = now()
WHERE name ILIKE '%Netflix%';

-- Dijital satın alma platformlarını doğru şekilde kategorize et
UPDATE providers
SET provider_type = 'digital_purchase', updated_at = now()
WHERE name ILIKE ANY(ARRAY[
  '%Google Play Movies%', '%Apple TV%', '%Amazon Video%', '%YouTube%', '%Microsoft Store%',
  '%Vudu%', '%Rakuten TV%', '%Sky Store%'
]) AND provider_type != 'streaming';

-- TV ağlarını doğru şekilde kategorize et
UPDATE providers
SET provider_type = 'network', updated_at = now()
WHERE (
  name ILIKE ANY(ARRAY[
    '%AMC%', '%BBC%', '%CBS%', '%NBC%', '%ABC%', '%Fox%', '%The CW%', '%PBS%', 
    '%Showtime%', '%Starz%', '%FX%', '%HBO%', '%TBS%', '%TNT%', '%USA Network%', 
    '%Syfy%', '%Comedy Central%', '%Adult Swim%', '%Cartoon Network%',
    '%Nickelodeon%', '%Disney Channel%', '%History Channel%', '%National Geographic%',
    '%Discovery Channel%', '%A&E%', '%Bravo%', '%E!%', '%Lifetime%', '%MTV%', '%VH1%', '%ESPN%',
    '%TRT 1%', '%Show TV%', '%Kanal D%', '%ATV%', '%Star TV%', '%Fox Türkiye%', '%TV8%',
    '%TRT 2%', '%TRT Belgesel%', '%TRT Çocuk%', '%TRT Spor%', '%NTV%', '%CNN Türk%',
    '%Habertürk%', '%DMAX%', '%TLC%'
  ])
  -- Streaming servisleri hariç tut
  AND NOT name ILIKE ANY(ARRAY[
    '%Netflix%', '%Prime%', '%Disney+%', '%HBO Max%', '%Max%', '%Apple TV%',
    '%Hulu%', '%Paramount+%', '%Peacock%', '%Discovery+%', '%BluTV%', '%Gain%',
    '%Exxen%', '%Tabii%', '%TOD%', '%PuhuTV%', '%beIN%', '%Sport Plus%'
  ])
);

-- Özel durumlar için düzeltmeler
-- AMC (network) ve AMC+ (streaming) ayrımı
UPDATE providers SET provider_type = 'network', updated_at = now() WHERE name = 'AMC';
UPDATE providers SET provider_type = 'streaming', updated_at = now() WHERE name = 'AMC+';

-- HBO (network) ve HBO Max (streaming) ayrımı
UPDATE providers SET provider_type = 'network', updated_at = now() WHERE name = 'HBO';
UPDATE providers SET provider_type = 'streaming', updated_at = now() WHERE name ILIKE '%HBO Max%';

-- Sağlayıcıları otomatik olarak kategorize eden fonksiyon
CREATE OR REPLACE FUNCTION categorize_provider()
RETURNS TRIGGER AS $$
DECLARE
  streaming_patterns TEXT[] := ARRAY[
    '%Netflix%', '%Prime Video%', '%Disney+%', '%HBO Max%', '%Max%', '%Apple TV+%',
    '%Hulu%', '%Paramount+%', '%Peacock%', '%Discovery+%', '%BluTV%', '%Gain%',
    '%Exxen%', '%Tabii%', '%TOD%', '%PuhuTV%', '%beIN CONNECT%', '%S Sport Plus%',
    '%Crunchyroll%', '%Funimation%', '%Crave%', '%Stan%', '%Hotstar%', '%Disney+ Hotstar%',
    '%Viaplay%', '%DAZN%', '%Mubi%', '%Shudder%', '%BritBox%', '%Acorn TV%'
  ];
  
  digital_purchase_patterns TEXT[] := ARRAY[
    '%Google Play Movies%', '%Apple TV%', '%Amazon Video%', '%YouTube%', '%Microsoft Store%',
    '%Vudu%', '%Rakuten TV%', '%Sky Store%'
  ];
  
  network_patterns TEXT[] := ARRAY[
    '%AMC%', '%BBC%', '%CBS%', '%NBC%', '%ABC%', '%Fox%', '%The CW%', '%PBS%', 
    '%Showtime%', '%Starz%', '%FX%', '%HBO%', '%TBS%', '%TNT%', '%USA Network%', 
    '%Syfy%', '%Comedy Central%', '%Adult Swim%', '%Cartoon Network%',
    '%Nickelodeon%', '%Disney Channel%', '%History Channel%', '%National Geographic%',
    '%Discovery Channel%', '%A&E%', '%Bravo%', '%E!%', '%Lifetime%', '%MTV%', '%VH1%', '%ESPN%',
    '%TRT 1%', '%Show TV%', '%Kanal D%', '%ATV%', '%Star TV%', '%Fox Türkiye%', '%TV8%',
    '%TRT 2%', '%TRT Belgesel%', '%TRT Çocuk%', '%TRT Spor%', '%NTV%', '%CNN Türk%',
    '%Habertürk%', '%DMAX%', '%TLC%'
  ];
  
  turkish_platforms TEXT[] := ARRAY[
    '%Exxen%', '%Tabii%', '%PuhuTV%', '%Puhu TV%', '%TOD%', '%Gain%', '%BluTV%', '%Blu TV%'
  ];
  
  i INTEGER;
BEGIN
  -- Türk platformları için özel kontrol
  FOR i IN 1..array_length(turkish_platforms, 1) LOOP
    IF NEW.name ILIKE turkish_platforms[i] THEN
      NEW.provider_type := 'streaming';
      RETURN NEW;
    END IF;
  END LOOP;

  -- Streaming servisleri için kontrol
  FOR i IN 1..array_length(streaming_patterns, 1) LOOP
    IF NEW.name ILIKE streaming_patterns[i] THEN
      NEW.provider_type := 'streaming';
      RETURN NEW;
    END IF;
  END LOOP;
  
  -- Dijital satın alma platformları için kontrol
  FOR i IN 1..array_length(digital_purchase_patterns, 1) LOOP
    IF NEW.name ILIKE digital_purchase_patterns[i] THEN
      NEW.provider_type := 'digital_purchase';
      RETURN NEW;
    END IF;
  END LOOP;
  
  -- TV ağları için kontrol
  FOR i IN 1..array_length(network_patterns, 1) LOOP
    -- Streaming servisi değilse ve network pattern'i eşleşiyorsa
    IF NEW.name ILIKE network_patterns[i] THEN
      -- Streaming servisi olup olmadığını kontrol et
      FOR j IN 1..array_length(streaming_patterns, 1) LOOP
        IF NEW.name ILIKE streaming_patterns[j] THEN
          NEW.provider_type := 'streaming';
          RETURN NEW;
        END IF;
      END LOOP;
      
      -- Streaming servisi değilse network olarak işaretle
      NEW.provider_type := 'network';
      RETURN NEW;
    END IF;
  END LOOP;
  
  -- Varsayılan olarak streaming
  IF NEW.provider_type IS NULL THEN
    NEW.provider_type := 'streaming';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur
CREATE TRIGGER categorize_provider_trigger
BEFORE INSERT OR UPDATE ON providers
FOR EACH ROW
EXECUTE FUNCTION categorize_provider();

-- Sağlayıcı kategorizasyonunu analiz etmek için görünüm oluştur
CREATE OR REPLACE VIEW provider_categorization_analysis AS
SELECT 
  provider_type,
  COUNT(*) as provider_count,
  ARRAY_AGG(name) as provider_names
FROM providers
GROUP BY provider_type
ORDER BY provider_count DESC;
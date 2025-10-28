/*
  # TMDB API ile %100 uyumlu veritabanı şeması

  1. Movies ve TV Shows tablolarına eksik sütunlar eklenir
  2. TMDB API ile uyumlu indeksler oluşturulur
  3. Performans optimizasyonları yapılır
  4. Veri doğrulama constraint'leri eklenir
  5. Otomatik updated_at trigger'ları eklenir
*/

-- Movies tablosunu TMDB API ile tam uyumlu hale getir
DO $$
BEGIN
  -- Eksik sütunları ekle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movies' AND column_name = 'genres') THEN
    ALTER TABLE movies ADD COLUMN genres JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movies' AND column_name = 'keywords') THEN
    ALTER TABLE movies ADD COLUMN keywords JSONB;
  END IF;
END $$;

-- TV Shows tablosu zaten tam uyumlu, sadece kontrol edelim
DO $$
BEGIN
  -- Tüm gerekli sütunlar zaten mevcut, sadece kontrol
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tv_shows' AND column_name = 'genres') THEN
    ALTER TABLE tv_shows ADD COLUMN genres JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tv_shows' AND column_name = 'keywords') THEN
    ALTER TABLE tv_shows ADD COLUMN keywords JSONB;
  END IF;
END $$;

-- Movies tablosu için performans indeksleri
CREATE INDEX IF NOT EXISTS idx_movies_genres ON movies USING gin(genres) WHERE genres IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_keywords ON movies USING gin(keywords) WHERE keywords IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_production_companies ON movies USING gin(production_companies) WHERE production_companies IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_spoken_languages ON movies USING gin(spoken_languages) WHERE spoken_languages IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_production_countries ON movies USING gin(production_countries) WHERE production_countries IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_belongs_to_collection ON movies USING gin(belongs_to_collection) WHERE belongs_to_collection IS NOT NULL;

-- Movies tablosu için basit indeksler
CREATE INDEX IF NOT EXISTS idx_movies_original_language ON movies(original_language);
CREATE INDEX IF NOT EXISTS idx_movies_adult ON movies(adult);
CREATE INDEX IF NOT EXISTS idx_movies_budget ON movies(budget DESC) WHERE budget > 0;
CREATE INDEX IF NOT EXISTS idx_movies_revenue ON movies(revenue DESC) WHERE revenue > 0;
CREATE INDEX IF NOT EXISTS idx_movies_runtime ON movies(runtime) WHERE runtime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_video ON movies(video);
CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id) WHERE imdb_id IS NOT NULL;

-- TV Shows tablosu için performans indeksleri
CREATE INDEX IF NOT EXISTS idx_tv_shows_genres ON tv_shows USING gin(genres) WHERE genres IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_keywords ON tv_shows USING gin(keywords) WHERE keywords IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_networks ON tv_shows USING gin(networks) WHERE networks IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_created_by ON tv_shows USING gin(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_seasons ON tv_shows USING gin(seasons) WHERE seasons IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_production_companies ON tv_shows USING gin(production_companies) WHERE production_companies IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_production_countries ON tv_shows USING gin(production_countries) WHERE production_countries IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_spoken_languages ON tv_shows USING gin(spoken_languages) WHERE spoken_languages IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_last_episode_to_air ON tv_shows USING gin(last_episode_to_air) WHERE last_episode_to_air IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_next_episode_to_air ON tv_shows USING gin(next_episode_to_air) WHERE next_episode_to_air IS NOT NULL;

-- TV Shows tablosu için basit indeksler
CREATE INDEX IF NOT EXISTS idx_tv_shows_original_language ON tv_shows(original_language);
CREATE INDEX IF NOT EXISTS idx_tv_shows_adult ON tv_shows(adult);
CREATE INDEX IF NOT EXISTS idx_tv_shows_status ON tv_shows(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_type ON tv_shows(type) WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_in_production ON tv_shows(in_production);
CREATE INDEX IF NOT EXISTS idx_tv_shows_number_of_seasons ON tv_shows(number_of_seasons DESC) WHERE number_of_seasons > 0;
CREATE INDEX IF NOT EXISTS idx_tv_shows_number_of_episodes ON tv_shows(number_of_episodes DESC) WHERE number_of_episodes > 0;
CREATE INDEX IF NOT EXISTS idx_tv_shows_last_air_date ON tv_shows(last_air_date DESC) WHERE last_air_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_origin_country ON tv_shows USING gin(origin_country) WHERE origin_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_languages ON tv_shows USING gin(languages) WHERE languages IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_episode_run_time ON tv_shows USING gin(episode_run_time) WHERE episode_run_time IS NOT NULL;

-- Composite indeksler (çoklu sütun aramaları için)
CREATE INDEX IF NOT EXISTS idx_movies_popularity_vote_avg ON movies(popularity DESC, vote_average DESC);
CREATE INDEX IF NOT EXISTS idx_movies_release_popularity ON movies(release_date DESC, popularity DESC) WHERE release_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_lang_popularity ON movies(original_language, popularity DESC) WHERE original_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_adult_popularity ON movies(adult, popularity DESC);
CREATE INDEX IF NOT EXISTS idx_movies_status_popularity ON movies(status, popularity DESC) WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tv_shows_popularity_vote_avg ON tv_shows(popularity DESC, vote_average DESC);
CREATE INDEX IF NOT EXISTS idx_tv_shows_air_popularity ON tv_shows(first_air_date DESC, popularity DESC) WHERE first_air_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_lang_popularity ON tv_shows(original_language, popularity DESC) WHERE original_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_adult_popularity ON tv_shows(adult, popularity DESC);
CREATE INDEX IF NOT EXISTS idx_tv_shows_status_popularity ON tv_shows(status, popularity DESC) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_shows_production_popularity ON tv_shows(in_production, popularity DESC);

-- Arama performansı için gelişmiş full-text search indeksleri
CREATE INDEX IF NOT EXISTS idx_movies_search_combined ON movies USING gin(
  (setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
   setweight(to_tsvector('english', COALESCE(original_title, '')), 'B') ||
   setweight(to_tsvector('english', COALESCE(overview, '')), 'C') ||
   setweight(to_tsvector('english', COALESCE(tagline, '')), 'D'))
) WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tv_shows_search_combined ON tv_shows USING gin(
  (setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
   setweight(to_tsvector('english', COALESCE(original_name, '')), 'B') ||
   setweight(to_tsvector('english', COALESCE(overview, '')), 'C') ||
   setweight(to_tsvector('english', COALESCE(tagline, '')), 'D'))
) WHERE name IS NOT NULL;

-- Trigger fonksiyonu (updated_at otomatik güncelleme için)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger'ları ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_movies_updated_at') THEN
    CREATE TRIGGER update_movies_updated_at 
      BEFORE UPDATE ON movies 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tv_shows_updated_at') THEN
    CREATE TRIGGER update_tv_shows_updated_at 
      BEFORE UPDATE ON tv_shows 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Veri doğrulama için check constraint'ler - Movies
DO $$
BEGIN
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_vote_average_check 
      CHECK (vote_average >= 0 AND vote_average <= 10);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_vote_count_check 
      CHECK (vote_count >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_popularity_check 
      CHECK (popularity >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_runtime_check 
      CHECK (runtime IS NULL OR runtime > 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_budget_check 
      CHECK (budget >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE movies ADD CONSTRAINT movies_revenue_check 
      CHECK (revenue >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Veri doğrulama için check constraint'ler - TV Shows
DO $$
BEGIN
  BEGIN
    ALTER TABLE tv_shows ADD CONSTRAINT tv_shows_vote_average_check 
      CHECK (vote_average >= 0 AND vote_average <= 10);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE tv_shows ADD CONSTRAINT tv_shows_vote_count_check 
      CHECK (vote_count >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE tv_shows ADD CONSTRAINT tv_shows_popularity_check 
      CHECK (popularity >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE tv_shows ADD CONSTRAINT tv_shows_episodes_check 
      CHECK (number_of_episodes >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE tv_shows ADD CONSTRAINT tv_shows_seasons_check 
      CHECK (number_of_seasons >= 0);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Tablo istatistiklerini güncelle
ANALYZE movies;
ANALYZE tv_shows;
ANALYZE content_genres;
ANALYZE content_providers;
ANALYZE providers;
ANALYZE genres;
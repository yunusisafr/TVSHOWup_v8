/*
  # Exxen Platformunu TMDB Verisiyle Ekle

  1. Changes
    - Exxen platformunu doğru TMDB ID'si (4405) ile ekle
    - Mevcut yanlış provider verilerini temizle
    - Türk platformları için doğru display priority ayarla

  2. Security
    - Sadece provider tablosunu günceller
    - Mevcut RLS politikaları korunur
*/

-- Önce mevcut yanlış Türk platform verilerini temizle
DELETE FROM providers WHERE id IN (1773, 1774, 1775, 1776, 1777);

-- Exxen'i doğru TMDB ID'si ile ekle (Network ID: 4405)
INSERT INTO providers (id, name, logo_path, display_priority) VALUES
  (4405, 'Exxen', '/exxen_logo.jpg', 15)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  display_priority = EXCLUDED.display_priority;

-- Diğer önemli Türk platformlarını da doğru ID'lerle ekle
-- (Bu ID'ler TMDB'den alınmalı, şimdilik placeholder)
INSERT INTO providers (id, name, logo_path, display_priority) VALUES
  (9001, 'Gain', '/gain_logo.jpg', 16),
  (9002, 'Tabii', '/tabii_logo.jpg', 17),
  (9003, 'BluTV', '/blutv_logo.jpg', 18),
  (9004, 'PuhuTV', '/puhutv_logo.jpg', 19)
ON CONFLICT (id) DO NOTHING;

-- Mevcut platformların display priority'lerini optimize et
UPDATE providers SET display_priority = 1 WHERE name ILIKE '%netflix%' AND display_priority != 1;
UPDATE providers SET display_priority = 2 WHERE name ILIKE '%amazon prime%' OR name ILIKE '%prime video%';
UPDATE providers SET display_priority = 3 WHERE name ILIKE '%disney%';
UPDATE providers SET display_priority = 4 WHERE name ILIKE '%hbo%' OR name ILIKE '%max%';
UPDATE providers SET display_priority = 5 WHERE name ILIKE '%apple tv%';

-- Türk platformları için özel priority aralığı (15-19)
-- Bu sayede global platformlar önce, Türk platformları sonra görünür

-- Provider tablosunu optimize et
ANALYZE providers;
/*
  # Exxen ve diğer Türk platformlarını ekle

  1. Exxen platformunu manuel olarak ekle
  2. Diğer bilinen Türk platformlarını da ekle
  3. Display priority'lerini ayarla
*/

-- Exxen platformunu ekle (TMDB'de bulunmuyorsa manuel ekle)
INSERT INTO providers (id, name, logo_path, display_priority) VALUES
  (1773, 'Exxen', '/exxen_logo.jpg', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_priority = EXCLUDED.display_priority;

-- Diğer önemli Türk platformlarını da ekle (eğer TMDB'de yoksa)
INSERT INTO providers (id, name, logo_path, display_priority) VALUES
  (1774, 'Gain', '/gain_logo.jpg', 5),
  (1775, 'Tabii', '/tabii_logo.jpg', 6),
  (1776, 'BluTV', '/blutv_logo.jpg', 7),
  (1777, 'PuhuTV', '/puhutv_logo.jpg', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_priority = EXCLUDED.display_priority;

-- Mevcut Netflix, Amazon Prime Video gibi platformların priority'lerini güncelle
UPDATE providers SET display_priority = 1 WHERE name ILIKE '%netflix%';
UPDATE providers SET display_priority = 2 WHERE name ILIKE '%amazon prime%' OR name ILIKE '%prime video%';
UPDATE providers SET display_priority = 3 WHERE name ILIKE '%disney%';
UPDATE providers SET display_priority = 9 WHERE name ILIKE '%max%' OR name ILIKE '%hbo%';
UPDATE providers SET display_priority = 10 WHERE name ILIKE '%apple tv%';

-- Türkiye'de yaygın olan diğer platformlar
UPDATE providers SET display_priority = 11 WHERE name ILIKE '%youtube%';
UPDATE providers SET display_priority = 12 WHERE name ILIKE '%google play%';
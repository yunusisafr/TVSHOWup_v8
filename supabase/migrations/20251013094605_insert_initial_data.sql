/*
  # Insert Initial Reference Data

  1. Languages
  2. Countries
  3. Genres (Movies and TV)
  4. Basic Providers
*/

-- Insert Languages
INSERT INTO languages (iso_639_1, english_name, native_name) VALUES
('en', 'English', 'English'),
('tr', 'Turkish', 'Türkçe'),
('de', 'German', 'Deutsch'),
('fr', 'French', 'Français'),
('es', 'Spanish', 'Español'),
('it', 'Italian', 'Italiano'),
('pt', 'Portuguese', 'Português'),
('ru', 'Russian', 'Русский'),
('ja', 'Japanese', '日本語'),
('ko', 'Korean', '한국어'),
('zh', 'Chinese', '中文'),
('ar', 'Arabic', 'العربية'),
('hi', 'Hindi', 'हिन्दी'),
('nl', 'Dutch', 'Nederlands'),
('sv', 'Swedish', 'Svenska'),
('no', 'Norwegian', 'Norsk'),
('da', 'Danish', 'Dansk'),
('fi', 'Finnish', 'Suomi'),
('pl', 'Polish', 'Polski'),
('el', 'Greek', 'Ελληνικά')
ON CONFLICT (iso_639_1) DO NOTHING;

-- Insert Countries
INSERT INTO countries (iso_3166_1, name, native_name) VALUES
('US', 'United States', 'United States'),
('TR', 'Turkey', 'Türkiye'),
('GB', 'United Kingdom', 'United Kingdom'),
('DE', 'Germany', 'Deutschland'),
('FR', 'France', 'France'),
('ES', 'Spain', 'España'),
('IT', 'Italy', 'Italia'),
('CA', 'Canada', 'Canada'),
('AU', 'Australia', 'Australia'),
('JP', 'Japan', '日本'),
('KR', 'South Korea', '대한민국'),
('BR', 'Brazil', 'Brasil'),
('MX', 'Mexico', 'México'),
('IN', 'India', 'भारत'),
('RU', 'Russia', 'Россия'),
('NL', 'Netherlands', 'Nederland'),
('SE', 'Sweden', 'Sverige'),
('NO', 'Norway', 'Norge'),
('DK', 'Denmark', 'Danmark'),
('FI', 'Finland', 'Suomi'),
('PL', 'Poland', 'Polska'),
('GR', 'Greece', 'Ελλάδα'),
('PT', 'Portugal', 'Portugal'),
('BE', 'Belgium', 'België'),
('CH', 'Switzerland', 'Schweiz'),
('AT', 'Austria', 'Österreich'),
('IE', 'Ireland', 'Ireland'),
('NZ', 'New Zealand', 'New Zealand'),
('CN', 'China', '中国'),
('AR', 'Argentina', 'Argentina')
ON CONFLICT (iso_3166_1) DO NOTHING;

-- Insert Movie and TV Genres (TMDB compatible IDs)
INSERT INTO genres (id, name) VALUES
-- Movie Genres
(28, 'Action'),
(12, 'Adventure'),
(16, 'Animation'),
(35, 'Comedy'),
(80, 'Crime'),
(99, 'Documentary'),
(18, 'Drama'),
(10751, 'Family'),
(14, 'Fantasy'),
(36, 'History'),
(27, 'Horror'),
(10402, 'Music'),
(9648, 'Mystery'),
(10749, 'Romance'),
(878, 'Science Fiction'),
(10770, 'TV Movie'),
(53, 'Thriller'),
(10752, 'War'),
(37, 'Western'),
-- TV Genres
(10759, 'Action & Adventure'),
(10762, 'Kids'),
(10763, 'News'),
(10764, 'Reality'),
(10765, 'Sci-Fi & Fantasy'),
(10766, 'Soap'),
(10767, 'Talk'),
(10768, 'War & Politics')
ON CONFLICT (id) DO NOTHING;

-- Insert Basic Streaming Providers
INSERT INTO providers (id, name, logo_path, display_priority) VALUES
(8, 'Netflix', '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', 1),
(119, 'Amazon Prime Video', '/emthp39XA2YScoYL1p0sdbAH2WA.jpg', 2),
(337, 'Disney Plus', '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg', 3),
(384, 'HBO Max', '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg', 4),
(1899, 'Max', '/6Q3ZYUNA9Hsgj6iWnVsw2gR5V6z.jpg', 4),
(350, 'Apple TV Plus', '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg', 5),
(15, 'Hulu', '/giwM8XX4V2AQb9vsoN7yti82tKK.jpg', 6),
(531, 'Paramount Plus', '/fi83B1oztoS47xxcemFdTOCo3Zk.jpg', 7),
(2, 'Apple iTunes', '/q6tl6Ib6X5FT80RMlcDbexIo4St.jpg', 50),
(3, 'Google Play Movies', '/xTVM8ERirXh9dHBHM5JFDTrxnOK.jpg', 51),
(192, 'YouTube', '/dQeAar5H991VYporEjUspolDarG.jpg', 60)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  display_priority = EXCLUDED.display_priority;
# TVSHOWup - Clean Multi-Language Architecture

## Overview
This document describes the clean, optimized architecture for handling multi-language content.

## Core Principles

### 1. Language & Country Model
```
countryCode (e.g., TR, US, DE) → Used for CONTENT FILTERING
  - Determines which streaming providers to show
  - Based on user's geographic location

languageCode (e.g., tr, en, de) → Used for UI & CONTENT TRANSLATION
  - Determines interface language
  - Determines which translation to display
  - Automatically synced with country (TR → tr, US → en, etc.)
```

**Key Rule**: Country and language are synchronized but serve different purposes.

### 2. TMDB Integration Strategy

#### ✅ CORRECT: Sync Once, Use Many Times
```
1. Content Import (via sync-tmdb-data)
   └─> Fetch basic content data

2. Translation Sync (via sync-content-translations)
   └─> Fetch ALL language translations once
   └─> Store in DB: name_translations, overview_translations, tagline_translations

3. Runtime Display
   └─> Read from DB only
   └─> Select translation based on languageCode
   └─> NO TMDB API calls during page view
```

#### ❌ WRONG: Fetching TMDB on Every Page Load
```
// DON'T DO THIS
const tmdbContent = await tmdbService.getTVShowDetails(id, languageCode)
```

### 3. Slug System (URL Structure)

**Rule**: ONE slug per content, based on `original_name`/`original_title`

```
Content: "10 Bin Adım" (Turkish show)
Slug: "115597-10-bin-adim" (always same, from original name)

URLs:
  /tr/tv_show/115597-10-bin-adim  → Shows Turkish translation
  /en/tv_show/115597-10-bin-adim  → Shows English translation
  /de/tv_show/115597-10-bin-adim  → Shows German translation
```

**Benefits**:
- No redirect loops when changing language
- SEO-friendly (one canonical slug)
- Language only affects display, not URL structure

### 4. Database Schema

#### TV Shows
```sql
CREATE TABLE tv_shows (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  original_name VARCHAR,
  overview TEXT,
  slug VARCHAR,

  -- Multi-language fields
  name_translations JSONB,      -- {"en": "...", "tr": "...", "de": "..."}
  overview_translations JSONB,  -- {"en": "...", "tr": "...", "de": "..."}
  tagline_translations JSONB,   -- {"en": "...", "tr": "...", "de": "..."}

  -- Additional data
  networks JSONB,               -- Stored as JSON array
  cast_data JSONB,              -- Cast/crew stored in DB
  crew_data JSONB,
  ...
)
```

#### Movies
```sql
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title VARCHAR NOT NULL,
  original_title VARCHAR,
  overview TEXT,
  slug VARCHAR,

  -- Multi-language fields
  title_translations JSONB,     -- {"en": "...", "tr": "...", "de": "..."}
  overview_translations JSONB,
  tagline_translations JSONB,
  ...
)
```

## Edge Functions

### 1. sync-content-translations (NEW)
**Purpose**: Sync all language translations for content
**When to use**: After importing new content or when translations need update

```bash
POST /functions/v1/sync-content-translations
{
  "contentId": 115597,
  "contentType": "tv_show",
  "tmdbApiKey": "xxx"
}
```

**What it does**:
1. Fetches content details in ALL supported languages (en, tr, de, fr, es, it, pt, ja, ko)
2. Stores translations in `name_translations`, `overview_translations`, `tagline_translations`
3. Generates and updates slug based on `original_name`

### 2. sync-content-providers
**Purpose**: Sync streaming platforms and networks for content
**When to use**: After importing content or when provider data needs update

### 3. sync-tmdb-data
**Purpose**: Import content basic data from TMDB
**When to use**: When adding new content to database

### 4. Redundant Functions (Can be removed)
- ❌ `sync-watch-providers` → Duplicate of sync-content-providers
- ❌ `update-provider-countries` → No longer needed

## Frontend Implementation

### ContentDetailPage.tsx
```typescript
// ✅ CORRECT APPROACH
const loadContent = async () => {
  // 1. Load from database ONLY
  const dbContent = await databaseService.getContentById(contentId, contentType)

  // 2. Apply translations based on current language
  const titleTranslations = dbContent.name_translations
  const displayTitle = titleTranslations[languageCode] || dbContent.name

  // 3. Set content - NO TMDB API CALL
  setContent({ ...dbContent, title: displayTitle })
}

// Language changes update display only (no reload)
useEffect(() => {
  if (content && languageCode) {
    const translations = content.name_translations
    const newTitle = translations[languageCode] || content.name
    setContent({ ...content, title: newTitle })
  }
}, [languageCode])
```

### Benefits of This Approach
1. **Fast**: No API calls during page load
2. **Stable**: No redirect loops or flickering
3. **Scalable**: Easy to add more languages
4. **SEO-friendly**: Consistent URLs across languages
5. **Offline-ready**: All data in database

## Testing Checklist

- [ ] Turkish content shows Turkish title when TR language selected
- [ ] Same content shows English title when EN language selected
- [ ] URL slug remains same when changing language
- [ ] No redirect loops when switching language
- [ ] Providers (GAİN, Netflix, etc.) display correctly
- [ ] Page loads without TMDB API calls

## Migration Path

For existing content without translations:

1. Run sync-content-translations for all content:
```sql
SELECT id FROM tv_shows WHERE name_translations IS NULL;
-- Then call sync-content-translations for each ID
```

2. Update slugs to use original_name:
```sql
UPDATE tv_shows
SET slug = CONCAT(id, '-', REGEXP_REPLACE(LOWER(original_name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug LIKE '%' || id || '%';
```

## Summary

**Old System Problems**:
- ❌ TMDB API called on every page load
- ❌ Different slugs for different languages
- ❌ Redirect loops
- ❌ Slow and unstable

**New System Benefits**:
- ✅ All translations stored in DB
- ✅ One canonical slug per content
- ✅ No API calls during runtime
- ✅ Fast, stable, scalable

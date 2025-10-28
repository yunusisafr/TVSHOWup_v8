import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Film, Tv, Calendar, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tmdbService } from '../lib/tmdb'
import { databaseService } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { createFullSlug, createSEOSlug, buildLanguagePath } from '../lib/utils'
import { SUPPORTED_LANGUAGES } from '../config/languages'
import { getUITranslation } from '../config/uiTranslations'

interface SearchResult {
  id: number
  title: string
  original_title?: string
  original_name?: string
  overview: string
  poster_path?: string
  vote_average: number
  vote_count: number
  popularity: number
  release_date?: string
  first_air_date?: string
  content_type: 'movie' | 'tv_show'
  original_language?: string
  isInDatabase: boolean
}

interface SearchDropdownProps {
  onSearch?: (query: string) => void
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ onSearch = () => {} }) => {
  const navigate = useNavigate()
  const { countryCode, languageCode, isLoading: preferencesLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Don't render until preferences are loaded
  if (preferencesLoading) {
    return (
      <div className="relative w-full">
        <div className="relative">
          <input
            type="text"
            disabled
            placeholder="Loading..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>
    )
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showResults || results.length === 0) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
          break
        case 'Enter':
          event.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleResultClick(results[selectedIndex])
          } else if (query.trim()) {
            handleSearch()
          }
          break
        case 'Escape':
          setShowResults(false)
          setSelectedIndex(-1)
          inputRef.current?.blur()
          break
      }
    }

    if (showResults) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showResults, results, selectedIndex, query])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.length >= 2) {
        performSearch()
      } else {
        setResults([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, languageCode, countryCode])

  const performSearch = async () => {
    if (query.length < 2) return

    try {
      setLoading(true)
      console.log(`🔍 Searching for "${query}" in ${languageCode} for ${countryCode}`)
      
      // Always search TMDB for fresh results
      console.log(`🌐 Searching TMDB for "${query}" in ${languageCode}`)
      const tmdbResults = await tmdbService.searchMulti(query, 1, languageCode, countryCode)
      
      if (!tmdbResults || !tmdbResults.results) {
        setResults([])
        setShowResults(false)
        return
      }
      
      const formattedResults: SearchResult[] = []
      const dbCheckPromises: Promise<boolean>[] = []
      
      // Process TMDB results
      const validResults = tmdbResults.results.filter(item => 
        (item.media_type === 'movie' || item.media_type === 'tv') && 
        (item.title || item.name) &&
        item.id
      )
      
      for (const item of validResults.slice(0, 8)) {
        const contentType = item.media_type === 'movie' ? 'movie' : 'tv_show'

        const result: SearchResult = {
          id: item.id,
          title: item.title || item.name || '',
          original_title: item.original_title,
          original_name: item.original_name,
          overview: item.overview || '',
          poster_path: item.poster_path,
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          popularity: item.popularity || 0,
          release_date: item.release_date,
          first_air_date: item.first_air_date,
          content_type: contentType,
          original_language: item.original_language,
          isInDatabase: false, // Will be updated below
        }

        formattedResults.push(result)
        
        // Check if exists in database (async)
        dbCheckPromises.push(
          databaseService.getContentById(item.id, contentType)
            .then(exists => !!exists)
            .catch(() => false)
        )
      }
      
      // Wait for database checks to complete
      const dbExistenceResults = await Promise.all(dbCheckPromises)
      
      // Update isInDatabase flags
      formattedResults.forEach((result, index) => {
        result.isInDatabase = dbExistenceResults[index]
      })
      
      // Sort results by relevance
      const sortedResults = formattedResults.sort((a, b) => {
        // 1. TMDB popularity score gets highest priority
        const popularityDiff = b.popularity - a.popularity
        if (Math.abs(popularityDiff) > 50) {
          return popularityDiff
        }
        
        // 2. Higher vote count indicates more popular/established content
        if (Math.abs(a.vote_count - b.vote_count) > 100) {
          return b.vote_count - a.vote_count
        }
        
        // 3. Exact matches get priority
        const aExact = a.title.toLowerCase() === query.toLowerCase()
        const bExact = b.title.toLowerCase() === query.toLowerCase()
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // 4. Title starts with query gets priority
        const aStarts = a.title.toLowerCase().startsWith(query.toLowerCase())
        const bStarts = b.title.toLowerCase().startsWith(query.toLowerCase())
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        
        // 5. Recent content gets priority (released in last 5 years)
        const currentYear = new Date().getFullYear()
        const aYear = a.release_date ? new Date(a.release_date).getFullYear() : (a.first_air_date ? new Date(a.first_air_date).getFullYear() : 0)
        const bYear = b.release_date ? new Date(b.release_date).getFullYear() : (b.first_air_date ? new Date(b.first_air_date).getFullYear() : 0)
        
        const aRecent = aYear >= currentYear - 5
        const bRecent = bYear >= currentYear - 5
        if (aRecent && !bRecent) return -1
        if (!aRecent && bRecent) return 1
        
        // 6. Content already in database gets slight boost (better data quality)
        if (a.isInDatabase && !b.isInDatabase) return -1
        if (!a.isInDatabase && b.isInDatabase) return 1
        
        // 7. For content with sufficient votes, prioritize by rating
        if (a.vote_count >= 100 && b.vote_count >= 100) {
          const ratingDiff = b.vote_average - a.vote_average
          if (Math.abs(ratingDiff) > 0.5) {
            return ratingDiff
          }
        }
        
        // 8. Final fallback to popularity
        return popularityDiff
      })

      setResults(sortedResults)
      setShowResults(true)
      setSelectedIndex(-1)
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setShowResults(false)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    if (value.length === 0) {
      setResults([])
      setShowResults(false)
      setSelectedIndex(-1)
    }
  }

  const handleSearch = () => {
    if (query.trim()) {
      const searchPath = buildLanguagePath(`/search?q=${encodeURIComponent(query.trim())}`, languageCode)
      navigate(searchPath)
      setShowResults(false)
      setQuery('')
      setSelectedIndex(-1)
      onSearch(query.trim())
    }
  }

  const handleResultClick = async (result: SearchResult) => {
    try {
      // Save content in background without blocking navigation
      saveContentToDatabase(result).catch(error => console.error("Background content save failed:", error))

      // Navigate to content page with language prefix
      // Always use original title for URL consistency
      const originalTitle = result.content_type === 'movie'
        ? (result.original_title || result.title)
        : (result.original_name || result.title);

      console.log(`🔗 Navigating to ${result.content_type} ${result.id} with original title: "${originalTitle}"`)

      const slug = createSEOSlug(result.id, originalTitle, result.title)
      console.log(`🔗 Generated slug: ${slug}`)

      // Format: /tr/movie/550-fight-club or /en/tv_show/1668-friends
      const contentPath = `/${languageCode}/${result.content_type}/${slug}`
      console.log(`🔗 Navigating to path: ${contentPath}`)

      navigate(contentPath)
      setShowResults(false)
      setQuery('')
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Error handling result click:', error)
      // Still navigate even if save fails - use fallback approach
      const originalTitle = result.content_type === 'movie'
        ? (result.original_title || result.title)
        : (result.original_name || result.title);

      const slug = createSEOSlug(result.id, originalTitle, result.title)
      const contentPath = `/${languageCode}/${result.content_type}/${slug}`
      console.log(`🔗 Fallback navigation to: ${contentPath}`)

      navigate(contentPath)
      setShowResults(false)
      setQuery('')
      setSelectedIndex(-1)
    }
  }

  const saveContentToDatabase = async (result: SearchResult) => {
    try {
      console.log(`💾 Saving comprehensive content data for ${result.content_type} ${result.id}`)
      
      // Get comprehensive content details from TMDB
      if (result.content_type === 'movie') {
        // Get movie details in English for original data and posters
        const originalMovieDetails = await tmdbService.getMovieDetails(result.id, 'en')
        
        // Get all available images for this movie to find language-specific posters
        const movieImages = await tmdbService.getMovieImages(result.id)
        
        // Process poster images by language
        const postersByLanguage = {}
        if (movieImages.posters && movieImages.posters.length > 0) {
          movieImages.posters.forEach(poster => {
            const lang = poster.iso_639_1 || 'null' // Use 'null' for language-neutral posters
            if (!postersByLanguage[lang] || poster.vote_average > (postersByLanguage[lang].vote_average || 0)) {
              postersByLanguage[lang] = {
                file_path: poster.file_path,
                vote_average: poster.vote_average || 0
              }
            }
          })
        }
        
        // Get translations for all supported languages
        const translations = {
          title: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getMovieDetails(result.id, lang)
            if (langDetails) {
              if (langDetails.title) translations.title[lang] = langDetails.title
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for movie ${result.id}:`, error)
          }
        }
        
        const movieData = {
          id: originalMovieDetails.id,
          title: originalMovieDetails.title,
          original_title: originalMovieDetails.original_title,
          overview: originalMovieDetails.overview,
          release_date: originalMovieDetails.release_date || null,
          runtime: originalMovieDetails.runtime || null,
          poster_path: originalMovieDetails.poster_path,
          poster_paths_by_language: JSON.stringify(postersByLanguage),
          backdrop_path: originalMovieDetails.backdrop_path,
          vote_average: originalMovieDetails.vote_average || 0,
          vote_count: originalMovieDetails.vote_count || 0,
          popularity: originalMovieDetails.popularity || 0,
          adult: originalMovieDetails.adult || false,
          original_language: originalMovieDetails.original_language,
          video: originalMovieDetails.video || false,
          budget: originalMovieDetails.budget || 0,
          revenue: originalMovieDetails.revenue || 0,
          status: originalMovieDetails.status,
          tagline: originalMovieDetails.tagline,
          homepage: originalMovieDetails.homepage,
          imdb_id: originalMovieDetails.imdb_id,
          belongs_to_collection: originalMovieDetails.belongs_to_collection ? JSON.stringify(originalMovieDetails.belongs_to_collection) : null,
          production_companies: originalMovieDetails.production_companies ? JSON.stringify(originalMovieDetails.production_companies) : null,
          production_countries: originalMovieDetails.production_countries ? JSON.stringify(originalMovieDetails.production_countries) : null,
          spoken_languages: originalMovieDetails.spoken_languages ? JSON.stringify(originalMovieDetails.spoken_languages) : null,
          genres: originalMovieDetails.genres ? JSON.stringify(originalMovieDetails.genres) : null,
          keywords: originalMovieDetails.keywords ? JSON.stringify(originalMovieDetails.keywords) : null,
          // Add multilingual translations
          title_translations: JSON.stringify(translations.title),
          overview_translations: JSON.stringify(translations.overview),
          tagline_translations: JSON.stringify(translations.tagline),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { error } = await databaseService.supabase
          .from('movies')
          .upsert(movieData)
        
        if (error) throw error
        
      } else if (result.content_type === 'tv_show') {
        // Get TV show details in English for original data and posters
        const originalTVDetails = await tmdbService.getTVShowDetails(result.id, 'en')
        
        // Get all available images for this TV show to find language-specific posters
        const tvImages = await tmdbService.getTVShowImages(result.id)
        
        // Process poster images by language
        const postersByLanguage = {}
        if (tvImages.posters && tvImages.posters.length > 0) {
          tvImages.posters.forEach(poster => {
            const lang = poster.iso_639_1 || 'null' // Use 'null' for language-neutral posters
            if (!postersByLanguage[lang] || poster.vote_average > (postersByLanguage[lang].vote_average || 0)) {
              postersByLanguage[lang] = {
                file_path: poster.file_path,
                vote_average: poster.vote_average || 0
              }
            }
          })
        }
        
        // Get translations for all supported languages
        const translations = {
          name: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getTVShowDetails(result.id, lang)
            if (langDetails) {
              if (langDetails.name) translations.name[lang] = langDetails.name
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for TV show ${result.id}:`, error)
          }
        }
        
        const tvData = {
          id: originalTVDetails.id,
          name: originalTVDetails.name,
          original_name: originalTVDetails.original_name,
          overview: originalTVDetails.overview,
          first_air_date: originalTVDetails.first_air_date || null,
          last_air_date: originalTVDetails.last_air_date || null,
          poster_path: originalTVDetails.poster_path,
          poster_paths_by_language: JSON.stringify(postersByLanguage),
          backdrop_path: originalTVDetails.backdrop_path,
          vote_average: originalTVDetails.vote_average || 0,
          vote_count: originalTVDetails.vote_count || 0,
          popularity: originalTVDetails.popularity || 0,
          adult: originalTVDetails.adult || false,
          original_language: originalTVDetails.original_language,
          status: originalTVDetails.status,
          type: originalTVDetails.type,
          tagline: originalTVDetails.tagline,
          homepage: originalTVDetails.homepage,
          in_production: originalTVDetails.in_production || false,
          number_of_episodes: originalTVDetails.number_of_episodes || 0,
          number_of_seasons: originalTVDetails.number_of_seasons || 0,
          episode_run_time: originalTVDetails.episode_run_time || null,
          origin_country: originalTVDetails.origin_country || null,
          created_by: originalTVDetails.created_by ? JSON.stringify(originalTVDetails.created_by) : null,
          genres: originalTVDetails.genres ? JSON.stringify(originalTVDetails.genres) : null,
          keywords: originalTVDetails.keywords ? JSON.stringify(originalTVDetails.keywords) : null,
          languages: originalTVDetails.languages || null,
          last_episode_to_air: originalTVDetails.last_episode_to_air ? JSON.stringify(originalTVDetails.last_episode_to_air) : null,
          next_episode_to_air: originalTVDetails.next_episode_to_air ? JSON.stringify(originalTVDetails.next_episode_to_air) : null,
          networks: originalTVDetails.networks ? JSON.stringify(originalTVDetails.networks) : null,
          production_companies: originalTVDetails.production_companies ? JSON.stringify(originalTVDetails.production_companies) : null,
          production_countries: originalTVDetails.production_countries ? JSON.stringify(originalTVDetails.production_countries) : null,
          seasons: originalTVDetails.seasons ? JSON.stringify(originalTVDetails.seasons) : null,
          spoken_languages: originalTVDetails.spoken_languages ? JSON.stringify(originalTVDetails.spoken_languages) : null,
          // Add multilingual translations
          name_translations: JSON.stringify(translations.name),
          overview_translations: JSON.stringify(translations.overview),
          tagline_translations: JSON.stringify(translations.tagline),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { error } = await databaseService.supabase
          .from('tv_shows')
          .upsert(tvData)
        
        if (error) throw error
      }

      // Sync watch providers after saving content
      await syncWatchProviders(result.id, result.content_type)
      
      console.log(`✅ Saved comprehensive ${result.content_type} ${result.id} with providers to database`)
    } catch (error) {
      console.error(`Error saving ${result.title} to database:`, error)
      throw error
    }
  }
  
  // Sync watch providers for content
  const syncWatchProviders = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-watch-providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: contentId,
          contentType: contentType,
          countries: [countryCode, 'US', 'GB', 'TR', 'DE', 'FR'],
          tmdbApiKey: import.meta.env.VITE_TMDB_API_KEY
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn(`Failed to sync providers for ${contentType} ${contentId}:`, errorData.error);
        return;
      }
      
      const result = await response.json();
      console.log(`✅ Synced providers for ${contentType} ${contentId}:`, result);
    } catch (error) {
      console.warn(`⚠️ Error syncing providers for ${contentType} ${contentId}:`, error);
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    setSelectedIndex(-1)
  }

  const getImageUrl = (path?: string) => {
    return path ? tmdbService.getImageUrl(path, 'w92') : '/placeholder-poster.jpg'
  }

  const getReleaseYear = (result: SearchResult) => {
    const date = result.release_date || result.first_air_date
    return date ? new Date(date).getFullYear() : 'TBA'
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true)
            }
          }}
          placeholder={getUITranslation('searchPlaceholder', languageCode)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          style={{ fontSize: '16px' }} // Prevents zoom on iOS
        />
        <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div 
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
        >
          {results.map((result, index) => (
            <button
              key={`${result.content_type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className={`w-full flex items-center space-x-3 p-3 hover:bg-gray-700 transition-colors text-left ${
                index === selectedIndex ? 'bg-gray-700' : ''
              }`}
            >
              {/* Poster */}
              <div className="w-12 h-16 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                <img
                  src={getImageUrl(result.poster_path)}
                  alt={result.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-poster.jpg'
                  }}
                />
              </div>

              {/* Content Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{result.title}</h3>
                
                <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    result.content_type === 'movie' ? 'bg-blue-600' : 'bg-green-600'
                  } text-white`}>
                    {result.content_type === 'movie' 
                      ? (languageCode === 'tr' ? 'Film' :
                         languageCode === 'de' ? 'Film' :
                         languageCode === 'fr' ? 'Film' :
                         languageCode === 'es' ? 'Película' :
                         languageCode === 'it' ? 'Film' :
                         'Movie') 
                      : (languageCode === 'tr' ? 'Dizi' :
                         languageCode === 'de' ? 'Serie' :
                         languageCode === 'fr' ? 'Série' :
                         languageCode === 'es' ? 'Serie' :
                         languageCode === 'it' ? 'Serie TV' :
                         'TV Show')}
                  </span>
                  
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{getReleaseYear(result)}</span>
                  </div>
                  
                  {result.vote_count >= 10 && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-400" />
                      <span>{result.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-300 text-sm line-clamp-2">
                  {result.overview || (languageCode === 'tr' ? 'Açıklama mevcut değil' :
                                       languageCode === 'de' ? 'Keine Beschreibung verfügbar' :
                                       languageCode === 'fr' ? 'Aucune description disponible' :
                                       languageCode === 'es' ? 'No hay descripción disponible' :
                                       languageCode === 'it' ? 'Nessuna descrizione disponibile' :
                                       'No description available')}
                </p>
              </div>
            </button>
          ))}
          
          {/* Show All Results Link */}
          <div className="border-t border-gray-700 p-3">
            <button
              onClick={handleSearch}
              className="w-full text-center text-primary-400 hover:text-primary-300 text-sm font-medium"
            >
              {languageCode === 'tr' ? `"${query}" için tüm sonuçları gör` :
               languageCode === 'de' ? `Alle Ergebnisse für "${query}" anzeigen` :
               languageCode === 'fr' ? `Voir tous les résultats pour "${query}"` :
               languageCode === 'es' ? `Ver todos los resultados para "${query}"` :
               languageCode === 'it' ? `Vedi tutti i risultati per "${query}"` :
               `See all results for "${query}"`}
            </button>
          </div>
        </div>
      )}
      
      {/* No Results Message */}
      {showResults && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4 text-center">
          <p className="text-gray-400">
            {languageCode === 'tr' ? `"${query}" için sonuç bulunamadı` :
             languageCode === 'de' ? `Keine Ergebnisse für "${query}" gefunden` :
             languageCode === 'fr' ? `Aucun résultat trouvé pour "${query}"` :
             languageCode === 'es' ? `No se encontraron resultados para "${query}"` :
             languageCode === 'it' ? `Nessun risultato trovato per "${query}"` :
             `No results found for "${query}"`}
          </p>
        </div>
      )}
    </div>
  )
}

export default SearchDropdown
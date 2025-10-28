import React, { useState, useEffect } from 'react'
import { Wand2, Play, Search, Filter, Star, Clock, Tv, Film, Bookmark, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { ContentItem, databaseService } from '../lib/database'
import { useAuth } from '../contexts/AuthContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import ContentCard from './ContentCard'
import { getLocalizedTitle } from '../lib/database'
import { tmdbService } from '../lib/tmdb'

interface Genre {
  id: number
  name: string
}

interface Provider {
  id: number
  name: string
  logo_path: string
  provider_type: string
}

interface WizardFilters {
  contentType: 'movie' | 'tv_show' | 'both'
  selectedProviders: number[]
  selectedGenres: number[]
  sortBy: 'vote_average' | 'popularity'
  minRating: number
  // TV Show specific filters
  maxSeasons?: number
  minSeasons?: number
  episodeDurationMin?: number
  episodeDurationMax?: number
  isMiniseries?: boolean
}

const DiscoveryWizard: React.FC = () => {
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const { wizardState, setWizardState } = useAuthPrompt()
  const { languageCode, countryCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  // Wizard container ref for auto-scrolling
  const wizardRef = React.useRef<HTMLDivElement>(null)
  
  // Wizard state
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [filters, setFilters] = useState<WizardFilters>({
    contentType: 'both',
    selectedProviders: [],
    selectedGenres: [],
    sortBy: 'popularity',
    minRating: 6.0
  })
  
  // Data state
  const [genres, setGenres] = useState<Genre[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [results, setResults] = useState<ContentItem[]>([])
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingResults, setSavingResults] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false)
  const [platformSearchQuery, setPlatformSearchQuery] = useState('')

  // Auto-scroll to wizard when step changes
  useEffect(() => {
    if (isExpanded && wizardRef.current) {
      wizardRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
    }
  }, [currentStep, isExpanded])

  // Initialize wizard state from context on mount
  useEffect(() => {
    if (wizardState) {
      console.log('🔄 Restoring wizard state from context:', wizardState)
      
      if (wizardState.filters) {
        setFilters(wizardState.filters)
      }
      
      if (wizardState.results && wizardState.results.length > 0) {
        setResults(wizardState.results)
        setIsExpanded(true)
        setCurrentStep(wizardState.step || 4) // Go to results step
      }
    }
  }, [wizardState])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [countryCode]) // Reload when country changes

  // Load user watchlist when user changes
  useEffect(() => {
    if (user) {
      loadUserWatchlist()
    } else {
      setUserWatchlistMap(new Map())
    }
  }, [user])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      
      console.log(`🔍 Loading discovery wizard data for country: ${countryCode}`)
      
      // Load genres and providers in parallel
      const [genresData, providersData] = await Promise.all([
        // Load genres directly from database
        databaseService.supabase
          .from('genres')
          .select('id, name')
          .order('name'),
        // Load providers for user's country
        databaseService.supabase
          .from('providers')
          .select('*')
          .eq('is_active', true)
          .order('display_priority', { ascending: true })
      ])
      
      // Handle genres
      if (genresData.error) {
        console.error('Error loading genres:', genresData.error)
        setGenres([])
      } else {
        console.log('✅ Loaded genres:', genresData.data?.length || 0)
        setGenres(genresData.data || [])
      }
      
      // Handle providers
      if (providersData.error) {
        console.error('Error loading providers:', providersData.error)
        setProviders([])
      } else {
        const allProviders = providersData.data || []
        console.log(`📺 Raw providers:`, allProviders.length)
        console.log('🔍 Discovery Wizard - All providers from database:', allProviders)
        console.log('🔍 Discovery Wizard - Provider count:', allProviders.length)
        console.log('🔍 Discovery Wizard - Sample providers:', allProviders.slice(0, 10).map(p => ({ id: p.id, name: p.name, type: p.provider_type })))
        
        // Use all providers without filtering, just sort by priority
        const sortedProviders = (providersData.data || [])
          .sort((a, b) => (a.display_priority || 999) - (b.display_priority || 999))
        
        console.log(`📺 Filtered providers for ${countryCode}:`, 
          sortedProviders.map(p => ({ 
            name: p.name, 
            type: p.provider_type, 
            countries: p.supported_countries 
          })))
        setProviders(sortedProviders)
      }
      
    } catch (error) {
      console.error('Error loading initial data:', error)
      // Set empty arrays on error to prevent UI issues
      setGenres([])
      setProviders([])
    } finally {
      setLoadingData(false)
    }
  }

  const loadUserWatchlist = async () => {
    if (!user) return
    
    try {
      const watchlist = await databaseService.getUserWatchlist(user.id)
      const watchlistMap = new Map<number, string>()
      watchlist.forEach(item => {
        watchlistMap.set(item.content_id, item.status)
      })
      setUserWatchlistMap(watchlistMap)
    } catch (error) {
      console.error('Error loading watchlist:', error)
    }
  }

  const handleSearch = async () => {
    try {
      setLoading(true)
      setError(null)
      setResults([])
      
      console.log('🔍 Discovery search with filters:', filters)
      console.log('🚀 Discovery Wizard - Starting discovery with filters:')
      console.log('  📺 Content Type:', filters.contentType)
      console.log('  🎭 Selected Platforms:', filters.selectedProviders)
      console.log('  🎨 Selected Genres:', filters.selectedGenres)
      console.log('  📊 Sort By:', filters.sortBy)
      console.log('  ⭐ Minimum Rating:', filters.minRating)
      console.log('  📺 Min Seasons:', filters.minSeasons)
      console.log('  📺 Max Seasons:', filters.maxSeasons)
      
      // Build search query based on filters
      const searchResults = await searchWithFilters(filters)

      console.log(`✅ Found ${searchResults.length} results`)

      if (searchResults.length === 0) {
        // Show helpful error message when no results found
        const hasProviderFilter = filters.selectedProviders.length > 0
        const hasGenreFilter = filters.selectedGenres.length > 0

        let errorMessage = ''
        if (languageCode === 'tr') {
          if (hasProviderFilter && hasGenreFilter) {
            errorMessage = 'Seçilen platform ve türlere uygun içerik bulunamadı. Platform veya tür filtrelerini kaldırmayı deneyin.'
          } else if (hasProviderFilter) {
            errorMessage = 'Seçilen platformda bu bölgede içerik bulunamadı. Farklı platformlar seçmeyi deneyin.'
          } else if (hasGenreFilter) {
            errorMessage = 'Seçilen türlere uygun içerik bulunamadı. Farklı türler seçmeyi deneyin.'
          } else {
            errorMessage = 'Kriterlere uygun içerik bulunamadı. Minimum puanı düşürmeyi veya farklı filtreler kullanmayı deneyin.'
          }
        } else {
          if (hasProviderFilter && hasGenreFilter) {
            errorMessage = 'No content found for the selected platforms and genres. Try removing platform or genre filters.'
          } else if (hasProviderFilter) {
            errorMessage = 'No content found for the selected platform in this region. Try selecting different platforms.'
          } else if (hasGenreFilter) {
            errorMessage = 'No content found for the selected genres. Try selecting different genres.'
          } else {
            errorMessage = 'No content found matching your criteria. Try lowering the minimum rating or using different filters.'
          }
        }
        setError(errorMessage)
      }

      setResults(searchResults)

      // Save wizard state to context for persistence
      setWizardState({
        filters,
        results: searchResults,
        step: 4
      })
      
    } catch (error) {
      console.error('Error in discovery search:', error)
      setError(languageCode === 'tr' ? 'Arama sırasında bir hata oluştu' : 'An error occurred during search')
    } finally {
      setLoading(false)
    }
  }

  const searchWithFilters = async (searchFilters: WizardFilters): Promise<ContentItem[]> => {
    try {
      console.log('🔍 Discovery search using TMDB with filters:', searchFilters)

      const results: ContentItem[] = []

      // When 'both' is selected, fetch equal amounts of movies and TV shows
      if (searchFilters.contentType === 'both') {
        console.log('🎬📺 Fetching BOTH movies and TV shows...')
        const [movieResults, tvResults] = await Promise.all([
          searchMoviesWithTMDB(searchFilters),
          searchTVShowsWithTMDB(searchFilters)
        ])

        console.log(`🎬 Movies found: ${movieResults.length}`)
        console.log(`📺 TV Shows found: ${tvResults.length}`)

        results.push(...movieResults)
        results.push(...tvResults)
      } else if (searchFilters.contentType === 'movie') {
        // Search movies only
        const movieResults = await searchMoviesWithTMDB(searchFilters)
        results.push(...movieResults)
      } else if (searchFilters.contentType === 'tv_show') {
        // Search TV shows only
        const tvResults = await searchTVShowsWithTMDB(searchFilters)
        results.push(...tvResults)
      }

      // Sort results
      const sortedResults = results.sort((a, b) => {
        if (searchFilters.sortBy === 'vote_average') {
          return b.vote_average - a.vote_average
        } else {
          return b.popularity - a.popularity
        }
      })

      console.log(`🎯 Final results: ${sortedResults.length} items (${sortedResults.filter(r => r.content_type === 'movie').length} movies, ${sortedResults.filter(r => r.content_type === 'tv_show').length} TV shows)`)
      return sortedResults.slice(0, 24) // Limit to 24 results
    } catch (error) {
      console.error('Error in TMDB discovery search:', error)
      setError(languageCode === 'tr' 
        ? 'Seçilen kriterlere uygun içerik bulunamadı. Farklı platform veya tür seçenekleri deneyin.'
        : 'No content found matching your criteria. Try different platform or genre selections.')
      return []
    }
  }

  const searchMoviesWithTMDB = async (searchFilters: WizardFilters): Promise<ContentItem[]> => {
    try {
      console.log('🎬 Searching movies with TMDB discover API')
      console.log('🎬 Discovery Wizard - Fetching movies from TMDB...')
      
      // Build TMDB discover options
      const discoverOptions: any = {
        page: 1,
        language: languageCode,
        region: countryCode,
        sortBy: searchFilters.sortBy === 'vote_average' ? 'vote_average.desc' : 'popularity.desc',
        voteCountGte: 5 // Lower threshold for more results
      }

      // Don't set releaseDateLte - it can be too restrictive
      
      // Apply genre filter
      if (searchFilters.selectedGenres.length > 0) {
        discoverOptions.withGenres = searchFilters.selectedGenres.join(',')
      }
      
      // Apply provider filter
      if (searchFilters.selectedProviders.length > 0) {
        // Get all provider IDs for selected platforms (including merged platforms)
        const allProviderIds: number[] = []
        
        searchFilters.selectedProviders.forEach(platformId => {
          const platform = providers.find(p => p.id === platformId)
          if (platform) {
            if (platform.ids && platform.ids.length > 0) {
              // This is a merged platform, add all its IDs
              allProviderIds.push(...platform.ids)
              console.log(`🔗 Discovery Wizard - Merged platform "${platform.name}" includes IDs:`, platform.ids)
            } else {
              // Single platform
              allProviderIds.push(platform.id)
              console.log(`🔗 Discovery Wizard - Single platform "${platform.name}" ID:`, platform.id)
            }
          }
        })
        
        console.log('🎯 Discovery Wizard - All provider IDs to send to TMDB:', allProviderIds)
        discoverOptions.withWatchProviders = allProviderIds.join(',')
        discoverOptions.watchRegion = countryCode
        console.log('🌍 Discovery Wizard - Watch region:', countryCode)
        console.log('📡 Discovery Wizard - Final with_watch_providers string:', discoverOptions.withWatchProviders)
      }
      
      // Apply minimum rating filter only if specified
      if (searchFilters.minRating && searchFilters.minRating > 5.0) {
        discoverOptions.voteAverageGte = searchFilters.minRating
      }
      
      console.log('📋 Discovery Wizard - Final TMDB discover params:', discoverOptions)

      // Use TMDB discover API
      const tmdbResults = await tmdbService.discoverMovies(discoverOptions)

      console.log('📊 Discovery Wizard - TMDB API Response:', {
        total_results: tmdbResults?.total_results || 0,
        total_pages: tmdbResults?.total_pages || 0,
        page: tmdbResults?.page || 0,
        results_count: tmdbResults?.results?.length || 0
      })

      if (!tmdbResults || !tmdbResults.results) {
        console.warn('⚠️ No TMDB movie results found. Response:', tmdbResults)
        return []
      }

      if (tmdbResults.results.length === 0) {
        console.warn('⚠️ TMDB returned empty results array. This might indicate:')
        console.warn('   - No content available for selected platform in this region')
        console.warn('   - Platform filter is too restrictive')
        console.warn('   - Try removing platform filters or selecting different genres')
        return []
      }

      console.log(`✅ Found ${tmdbResults.results.length} movies from TMDB`)
      console.log('🎬 Discovery Wizard - Movie results from TMDB:', tmdbResults.results?.length || 0)
      
      // Format TMDB results to ContentItem format
      const formattedResults: ContentItem[] = tmdbResults.results
        .filter((movie: any) => movie.poster_path && movie.overview && movie.vote_average >= 0)
        .map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          original_title: movie.original_title,
          overview: movie.overview,
          release_date: movie.release_date,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
          popularity: movie.popularity,
          adult: movie.adult,
          original_language: movie.original_language,
          content_type: 'movie' as const,
          hasProviders: true,
          // Add other required fields with defaults
          runtime: null,
          status: null,
          tagline: null,
          homepage: null,
          video: false,
          budget: 0,
          revenue: 0,
          imdb_id: null,
          belongs_to_collection: null,
          production_companies: null,
          production_countries: null,
          spoken_languages: null,
          genres: movie.genre_ids ? JSON.stringify(movie.genre_ids.map((id: number) => ({ id }))) : null,
          keywords: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      
      return formattedResults.slice(0, 12)
      
    } catch (error) {
      console.error('Error searching movies with TMDB:', error)
      return []
    }
  }

  const searchTVShowsWithTMDB = async (searchFilters: WizardFilters): Promise<ContentItem[]> => {
    try {
      console.log('📺 Searching TV shows with TMDB discover API')
      console.log('📺 Discovery Wizard - Fetching TV shows from TMDB...')

      // Build TMDB discover options
      const discoverOptions: any = {
        page: 1,
        language: languageCode,
        sortBy: searchFilters.sortBy === 'vote_average' ? 'vote_average.desc' : 'popularity.desc',
        voteCountGte: 5 // Lower threshold for more results
      }

      // Don't set firstAirDateLte - it can be too restrictive
      
      // Apply genre filter
      if (searchFilters.selectedGenres.length > 0) {
        discoverOptions.withGenres = searchFilters.selectedGenres.join(',')
      }
      
      // Apply provider filter
      if (searchFilters.selectedProviders.length > 0) {
        // Get all provider IDs for selected platforms (including merged platforms)
        const allProviderIds: number[] = []
        
        searchFilters.selectedProviders.forEach(platformId => {
          const platform = providers.find(p => p.id === platformId)
          if (platform) {
            if (platform.ids && platform.ids.length > 0) {
              // This is a merged platform, add all its IDs
              allProviderIds.push(...platform.ids)
              console.log(`🔗 Discovery Wizard - Merged platform "${platform.name}" includes IDs:`, platform.ids)
            } else {
              // Single platform
              allProviderIds.push(platform.id)
              console.log(`🔗 Discovery Wizard - Single platform "${platform.name}" ID:`, platform.id)
            }
          }
        })
        
        console.log('🎯 Discovery Wizard - All provider IDs to send to TMDB:', allProviderIds)
        discoverOptions.withWatchProviders = allProviderIds.join(',')
        discoverOptions.watchRegion = countryCode
        console.log('🌍 Discovery Wizard - Watch region:', countryCode)
        console.log('📡 Discovery Wizard - Final with_watch_providers string:', discoverOptions.withWatchProviders)
      }
      
      // Apply minimum rating filter only if specified
      if (searchFilters.minRating && searchFilters.minRating > 5.0) {
        discoverOptions.voteAverageGte = searchFilters.minRating
      }
      
      // Apply TV show specific filters
      if (searchFilters.isMiniseries) {
        // For miniseries, we'll filter client-side since TMDB doesn't have direct filter
        discoverOptions.withType = 'miniseries'
      }
      
      console.log('📋 Discovery Wizard - Final TMDB discover params:', discoverOptions)

      // Use TMDB discover API
      const tmdbResults = await tmdbService.discoverTVShows(discoverOptions)

      console.log('📊 Discovery Wizard - TMDB API Response:', {
        total_results: tmdbResults?.total_results || 0,
        total_pages: tmdbResults?.total_pages || 0,
        page: tmdbResults?.page || 0,
        results_count: tmdbResults?.results?.length || 0
      })

      if (!tmdbResults || !tmdbResults.results) {
        console.warn('⚠️ No TMDB TV show results found. Response:', tmdbResults)
        return []
      }

      if (tmdbResults.results.length === 0) {
        console.warn('⚠️ TMDB returned empty results array. This might indicate:')
        console.warn('   - No content available for selected platform in this region')
        console.warn('   - Platform filter is too restrictive')
        console.warn('   - Try removing platform filters or selecting different genres')
        return []
      }

      console.log(`✅ Found ${tmdbResults.results.length} TV shows from TMDB`)
      console.log('📺 Discovery Wizard - TV show results from TMDB:', tmdbResults.results?.length || 0)
      
      // Format TMDB results to ContentItem format
      let formattedResults: ContentItem[] = tmdbResults.results
        .filter((show: any) => show.poster_path && show.overview && show.vote_average >= 0)
        .map((show: any) => ({
          id: show.id,
          title: show.name,
          name: show.name,
          original_name: show.original_name,
          overview: show.overview,
          first_air_date: show.first_air_date,
          poster_path: show.poster_path,
          backdrop_path: show.backdrop_path,
          vote_average: show.vote_average,
          vote_count: show.vote_count,
          popularity: show.popularity,
          adult: show.adult,
          original_language: show.original_language,
          content_type: 'tv_show' as const,
          hasProviders: true,
          // Add other required fields with defaults
          last_air_date: null,
          status: null,
          type: null,
          tagline: null,
          homepage: null,
          in_production: false,
          number_of_episodes: 0,
          number_of_seasons: 0,
          episode_run_time: null,
          origin_country: show.origin_country || null,
          created_by: null,
          genres: show.genre_ids ? JSON.stringify(show.genre_ids.map((id: number) => ({ id }))) : null,
          keywords: null,
          languages: null,
          last_episode_to_air: null,
          next_episode_to_air: null,
          networks: null,
          production_companies: null,
          production_countries: null,
          seasons: null,
          spoken_languages: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      
      // Apply client-side filters for TV show specific options
      if (searchFilters.minSeasons || searchFilters.maxSeasons || searchFilters.isMiniseries) {
        // For these filters, we need to get detailed info from TMDB
        const detailedResults: ContentItem[] = []
        
        for (const show of formattedResults.slice(0, 20)) {
          try {
            const detailedShow = await tmdbService.getTVShowDetails(show.id, languageCode)
            
            // Apply season filters
            if (searchFilters.isMiniseries && detailedShow.number_of_seasons !== 1) {
              continue
            }
            
            if (searchFilters.minSeasons && detailedShow.number_of_seasons < searchFilters.minSeasons) {
              continue
            }
            
            if (searchFilters.maxSeasons && detailedShow.number_of_seasons > searchFilters.maxSeasons) {
              continue
            }
            
            console.log(`📺 Discovery Wizard - After season filter (${searchFilters.minSeasons}-${searchFilters.maxSeasons}):`, detailedResults.length)
            
            // Update the show with detailed info
            detailedResults.push({
              ...show,
              number_of_seasons: detailedShow.number_of_seasons,
              number_of_episodes: detailedShow.number_of_episodes,
              status: detailedShow.status,
              type: detailedShow.type,
              in_production: detailedShow.in_production
            })
            
          } catch (error) {
            console.warn(`Error getting detailed info for TV show ${show.id}:`, error)
            // Include the show anyway if we can't get detailed info
            detailedResults.push(show)
          }
        }
        
        return detailedResults.slice(0, 12)
      }
      
      return formattedResults.slice(0, 12)
      
    } catch (error) {
      console.error('Error searching TV shows with TMDB:', error)
      return []
    }
  }

  const handleWatchlistStatusChange = async (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    try {
      if (status === null) {
        await databaseService.removeFromWatchlist(user.id, contentId, contentType)
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.delete(contentId)
          return newMap
        })
      } else {
        await databaseService.addToWatchlist(user.id, contentId, contentType, status, {
          onConflict: 'user_id,content_id,content_type'
        })
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.set(contentId, status)
          return newMap
        })
      }
    } catch (error) {
      console.error('Error updating watchlist:', error)
    }
  }

  const handleSaveResults = () => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    if (results.length === 0) {
      setError(languageCode === 'tr' ? 'Kaydedilecek sonuç bulunamadı' : 'No results to save')
      return
    }
    
    setShowSaveConfirmation(true)
  }

  const confirmSaveResults = async () => {
    if (!user || results.length === 0) return
    
    try {
      setSavingResults(true)
      setShowSaveConfirmation(false)
      
      let savedCount = 0
      
      for (const item of results) {
        try {
          // Check if already in watchlist
          if (!userWatchlistMap.has(item.id)) {
            await databaseService.addToWatchlist(user.id, item.id, item.content_type, 'want_to_watch')
            savedCount++
          }
        } catch (error) {
          console.error(`Error saving ${item.title}:`, error)
        }
      }
      
      if (savedCount > 0) {
        setSaveSuccess(true)
        await loadUserWatchlist() // Refresh watchlist
        
        setTimeout(() => {
          setSaveSuccess(false)
        }, 3000)
      }
      
    } catch (error) {
      console.error('Discovery error:', error)
      setError(languageCode === 'tr'
        ? 'Keşif sırasında bir hata oluştu. Lütfen tekrar deneyin.'
        : 'An error occurred during discovery. Please try again.')
    } finally {
      setSavingResults(false)
    }
  }

  const resetWizard = () => {
    // Clear wizard state from context
    setWizardState(null)
    
    setFilters({
      contentType: 'both',
      selectedProviders: [],
      selectedGenres: [],
      sortBy: 'popularity',
      minRating: 6.0
    })
    setResults([])
    setCurrentStep(1)
    setError(null)
    setSaveSuccess(false)
  }

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1:
        return languageCode === 'tr' ? 'İçerik Türü' : 'Content Type'
      case 2:
        return languageCode === 'tr' ? 'Platformlar' : 'Platforms'
      case 3:
        return languageCode === 'tr' ? 'Türler' : 'Genres'
      case 4:
        return languageCode === 'tr' ? 'Tercihler' : 'Preferences'
      default:
        return ''
    }
  }

  // Sort providers to show global platforms first
  const getFilteredProviders = () => {
    let filteredProviders = providers
    
    // Apply search filter
    if (platformSearchQuery.trim()) {
      filteredProviders = providers.filter(provider =>
        provider.name.toLowerCase().includes(platformSearchQuery.toLowerCase())
      )
    }
    
    // Return filtered providers without sorting
    return filteredProviders
  }

  if (loadingData) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <div ref={wizardRef} className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/20">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
              <Wand2 className="w-8 h-8 text-purple-400 mr-3" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {languageCode === 'tr' ? 'Ne İzlemeliyim?' : 'What Should I Watch?'}
              </h2>
            </div>
            <p className="text-gray-300 text-lg">
              {languageCode === 'tr' ? 'Keşif Sihirbazı' : 'Discovery Wizard'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {languageCode === 'tr' 
                ? 'Tercihlerinize göre mükemmel içeriği bulun'
                : 'Find perfect content based on your preferences'}
            </p>
          </div>

          {!isExpanded ? (
            /* Collapsed State */
            <div className="text-center">
              <button
                onClick={() => setIsExpanded(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center mx-auto"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                {languageCode === 'tr' ? 'Sihirbazı Başlat' : 'Start Discovery'}
              </button>
            </div>
          ) : (
            /* Expanded State */
            <div className="space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-center space-x-2 mb-8">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= currentStep 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {step}
                    </div>
                    {step < 4 && (
                      <div className={`w-8 h-0.5 mx-2 ${
                        step < currentStep ? 'bg-purple-600' : 'bg-gray-700'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Content */}
              <div className="bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4 text-center">
                  {getStepTitle(currentStep)}
                </h3>

                {/* Step 1: Content Type */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, contentType: 'movie' }))}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          filters.contentType === 'movie'
                            ? 'border-purple-500 bg-purple-500/20 text-white'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <Film className="w-8 h-8 mx-auto mb-2" />
                        <div className="font-medium">
                          {languageCode === 'tr' ? 'Sadece Filmler' : 'Movies Only'}
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, contentType: 'tv_show' }))}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          filters.contentType === 'tv_show'
                            ? 'border-purple-500 bg-purple-500/20 text-white'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <Tv className="w-8 h-8 mx-auto mb-2" />
                        <div className="font-medium">
                          {languageCode === 'tr' ? 'Sadece Diziler' : 'TV Shows Only'}
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, contentType: 'both' }))}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          filters.contentType === 'both'
                            ? 'border-purple-500 bg-purple-500/20 text-white'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-center mb-2">
                          <Film className="w-6 h-6 mr-1" />
                          <Tv className="w-6 h-6" />
                        </div>
                        <div className="font-medium">
                          {languageCode === 'tr' ? 'Her İkisi' : 'Both'}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Platforms */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-gray-300 text-center mb-4">
                      {languageCode === 'tr' 
                        ? 'Hangi platformlardaki içerikleri keşfetmek istiyorsunuz?'
                        : 'Which platforms would you like to discover content from?'}
                    </p>
                    
                    {/* Platform Search */}
                    <div className="mb-6">
                      <div className="relative">
                        <input
                          type="text"
                          value={platformSearchQuery}
                          onChange={(e) => setPlatformSearchQuery(e.target.value)}
                          placeholder={languageCode === 'tr' ? 'Platform ara... (örn: Netflix, Exxen)' : 'Search platforms... (e.g. Netflix, Disney+)'}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                        {platformSearchQuery && (
                          <button
                            onClick={() => setPlatformSearchQuery('')}
                            className="absolute right-3 top-3.5 text-gray-400 hover:text-white transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Selected Platforms Count */}
                    {filters.selectedProviders.length > 0 && (
                      <div className="text-center mb-4">
                        <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm">
                          {languageCode === 'tr' 
                            ? `${filters.selectedProviders.length} platform seçildi`
                            : `${filters.selectedProviders.length} platforms selected`}
                        </span>
                      </div>
                    )}
                    
                    {/* Platform Search Results */}
                    {platformSearchQuery.trim() && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {getFilteredProviders().map((provider) => (
                          <button
                            key={provider.id}
                            onClick={() => {
                              setFilters(prev => ({
                                ...prev,
                                selectedProviders: prev.selectedProviders.includes(provider.id)
                                  ? prev.selectedProviders.filter(id => id !== provider.id)
                                  : [...prev.selectedProviders, provider.id]
                              }))
                            }}
                            className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                              filters.selectedProviders.includes(provider.id)
                                ? 'border-purple-500 bg-purple-500/20 text-white'
                                : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{provider.name}</span>
                              {filters.selectedProviders.includes(provider.id) && (
                                <Check className="w-5 h-5 text-purple-400" />
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {provider.provider_type === 'streaming' ? (languageCode === 'tr' ? 'Streaming' : 'Streaming') :
                               provider.provider_type === 'network' ? (languageCode === 'tr' ? 'TV Ağı' : 'TV Network') :
                               provider.provider_type === 'digital_purchase' ? (languageCode === 'tr' ? 'Dijital' : 'Digital') :
                               provider.provider_type === 'free' ? (languageCode === 'tr' ? 'Ücretsiz' : 'Free') :
                               (provider.provider_type || 'Platform')}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* No results message */}
                    {platformSearchQuery && getFilteredProviders().length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-400">
                          {languageCode === 'tr' 
                            ? `"${platformSearchQuery}" için platform bulunamadı`
                            : `No platforms found for "${platformSearchQuery}"`}
                        </p>
                      </div>
                    )}
                    
                    {filters.selectedProviders.length > 0 && (
                      <div>
                        <h4 className="text-white font-medium mb-3">
                          {languageCode === 'tr' ? 'Seçilen Platformlar:' : 'Selected Platforms:'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {filters.selectedProviders.map(providerId => {
                            const provider = providers.find(p => p.id === providerId)
                            if (!provider) return null
                            return (
                              <span
                                key={providerId}
                                className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm flex items-center"
                              >
                                {provider.name}
                                <button
                                  onClick={() => {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedProviders: prev.selectedProviders.filter(id => id !== providerId)
                                    }))
                                  }}
                                  className="ml-2 text-purple-300 hover:text-white"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    {filters.selectedProviders.length === 0 && !platformSearchQuery && (
                      <p className="text-yellow-400 text-sm text-center">
                        {languageCode === 'tr' 
                          ? 'Platform aramaya başlayın veya tümünü görmek için devam edin'
                          : 'Start searching for platforms or continue to see all'}
                      </p>
                    )}
                  </div>
                )}

                {/* Step 3: Genres */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-gray-300 text-center mb-4">
                      {languageCode === 'tr' 
                        ? 'Hangi türlerden hoşlanıyorsunuz?'
                        : 'What genres do you enjoy?'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                      {[
                        { id: 28, name: languageCode === 'tr' ? 'Aksiyon' : 'Action' },
                        { id: 12, name: languageCode === 'tr' ? 'Macera' : 'Adventure' },
                        { id: 16, name: languageCode === 'tr' ? 'Animasyon' : 'Animation' },
                        { id: 35, name: languageCode === 'tr' ? 'Komedi' : 'Comedy' },
                        { id: 80, name: languageCode === 'tr' ? 'Suç' : 'Crime' },
                        { id: 99, name: languageCode === 'tr' ? 'Belgesel' : 'Documentary' },
                        { id: 18, name: languageCode === 'tr' ? 'Drama' : 'Drama' },
                        { id: 10751, name: languageCode === 'tr' ? 'Aile' : 'Family' },
                        { id: 14, name: languageCode === 'tr' ? 'Fantastik' : 'Fantasy' },
                        { id: 36, name: languageCode === 'tr' ? 'Tarih' : 'History' },
                        { id: 27, name: languageCode === 'tr' ? 'Korku' : 'Horror' },
                        { id: 10402, name: languageCode === 'tr' ? 'Müzik' : 'Music' },
                        { id: 9648, name: languageCode === 'tr' ? 'Gizem' : 'Mystery' },
                        { id: 10749, name: languageCode === 'tr' ? 'Romantik' : 'Romance' },
                        { id: 878, name: languageCode === 'tr' ? 'Bilim Kurgu' : 'Science Fiction' },
                        { id: 10770, name: languageCode === 'tr' ? 'TV Film' : 'TV Movie' },
                        { id: 53, name: languageCode === 'tr' ? 'Gerilim' : 'Thriller' },
                        { id: 10752, name: languageCode === 'tr' ? 'Savaş' : 'War' },
                        { id: 37, name: languageCode === 'tr' ? 'Western' : 'Western' },
                        { id: 10759, name: languageCode === 'tr' ? 'Aksiyon & Macera' : 'Action & Adventure' },
                        { id: 10762, name: languageCode === 'tr' ? 'Çocuk' : 'Kids' },
                        { id: 10763, name: languageCode === 'tr' ? 'Haber' : 'News' },
                        { id: 10764, name: languageCode === 'tr' ? 'Reality' : 'Reality' },
                        { id: 10765, name: languageCode === 'tr' ? 'Bilim Kurgu & Fantastik' : 'Sci-Fi & Fantasy' },
                        { id: 10766, name: languageCode === 'tr' ? 'Pembe Dizi' : 'Soap' },
                        { id: 10767, name: languageCode === 'tr' ? 'Talk Show' : 'Talk' },
                        { id: 10768, name: languageCode === 'tr' ? 'Savaş & Politika' : 'War & Politics' }
                      ].map((genre) => (
                        <button
                          key={genre.id}
                          onClick={() => {
                            setFilters(prev => ({
                              ...prev,
                              selectedGenres: prev.selectedGenres.includes(genre.id)
                                ? prev.selectedGenres.filter(id => id !== genre.id)
                                : [...prev.selectedGenres, genre.id]
                            }))
                          }}
                          className={`p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                            filters.selectedGenres.includes(genre.id)
                              ? 'border-purple-500 bg-purple-500/20 text-white'
                              : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                          }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                    {filters.selectedGenres.length === 0 && (
                      <p className="text-yellow-400 text-sm text-center">
                        {languageCode === 'tr' 
                          ? 'En az bir tür seçin veya tümünü görmek için devam edin'
                          : 'Select at least one genre or continue to see all'}
                      </p>
                    )}
                  </div>
                )}

                {/* Step 4: Preferences */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    {/* Sorting Preference */}
                    <div>
                      <label className="block text-white font-medium mb-3">
                        {languageCode === 'tr' ? 'Sıralama Tercihi' : 'Sorting Preference'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, sortBy: 'vote_average' }))}
                          className={`p-3 rounded-lg border-2 transition-colors ${
                            filters.sortBy === 'vote_average'
                              ? 'border-purple-500 bg-purple-500/20 text-white'
                              : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <Star className="w-6 h-6 mx-auto mb-2" />
                          <div className="font-medium">
                            {languageCode === 'tr' ? 'IMDb Puanına Göre' : 'By IMDb Rating'}
                          </div>
                        </button>
                        
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, sortBy: 'popularity' }))}
                          className={`p-3 rounded-lg border-2 transition-colors ${
                            filters.sortBy === 'popularity'
                              ? 'border-purple-500 bg-purple-500/20 text-white'
                              : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                            📈
                          </div>
                          <div className="font-medium">
                            {languageCode === 'tr' ? 'Popülerliğe Göre' : 'By Popularity'}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Minimum Rating */}
                    <div>
                      <label className="block text-white font-medium mb-3">
                        {languageCode === 'tr' ? 'Minimum Puan' : 'Minimum Rating'}: {filters.minRating}
                      </label>
                      <input
                        type="range"
                        min="5.0"
                        max="9.0"
                        step="0.5"
                        value={filters.minRating}
                        onChange={(e) => setFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>5.0</span>
                        <span>9.0</span>
                      </div>
                    </div>

                    {/* TV Show Specific Filters */}
                    {(filters.contentType === 'tv_show' || filters.contentType === 'both') && (
                      <div className="space-y-4 border-t border-gray-700 pt-4">
                        <h4 className="text-white font-medium">
                          {languageCode === 'tr' ? 'Dizi Tercihleri' : 'TV Show Preferences'}
                        </h4>
                        
                        {/* Miniseries Option */}
                        <div className="flex items-center justify-between">
                          <label className="text-gray-300">
                            {languageCode === 'tr' ? 'Sadece Mini Diziler' : 'Miniseries Only'}
                          </label>
                          <button
                            onClick={() => setFilters(prev => ({ ...prev, isMiniseries: !prev.isMiniseries }))}
                            className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                              filters.isMiniseries ? 'bg-purple-500 justify-end' : 'bg-gray-600 justify-start'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full transform transition-transform ${
                              filters.isMiniseries ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                            }`}>
                              {filters.isMiniseries && <Check className="w-3 h-3 text-purple-500 m-auto" />}
                            </div>
                          </button>
                        </div>

                        {/* Season Range */}
                        {!filters.isMiniseries && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-300 text-sm mb-1">
                                {languageCode === 'tr' ? 'Min Sezon' : 'Min Seasons'}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={filters.minSeasons || ''}
                                onChange={(e) => setFilters(prev => ({ 
                                  ...prev, 
                                  minSeasons: e.target.value ? parseInt(e.target.value) : undefined 
                                }))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="1"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-300 text-sm mb-1">
                                {languageCode === 'tr' ? 'Max Sezon' : 'Max Seasons'}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={filters.maxSeasons || ''}
                                onChange={(e) => setFilters(prev => ({ 
                                  ...prev, 
                                  maxSeasons: e.target.value ? parseInt(e.target.value) : undefined 
                                }))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-3">
                  {currentStep > 1 && (
                    <button
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {languageCode === 'tr' ? 'Geri' : 'Back'}
                    </button>
                  )}
                  
                  <button
                    onClick={resetWizard}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {languageCode === 'tr' ? 'Sıfırla' : 'Reset'}
                  </button>
                </div>

                <div className="flex space-x-3">
                  {currentStep < 4 ? (
                    <button
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      {languageCode === 'tr' ? 'İleri' : 'Next'}
                    </button>
                  ) : (
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {languageCode === 'tr' ? 'Arıyor...' : 'Searching...'}
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          {languageCode === 'tr' ? 'Ara' : 'Search'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-red-400">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {saveSuccess && (
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-green-400">
                    {languageCode === 'tr' 
                      ? 'Sonuçlar izleme listenize kaydedildi!'
                      : 'Results saved to your watchlist!'}
                  </span>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && (
                <div className="border-t border-gray-700 pt-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                      {languageCode === 'tr' ? 'Keşif Sonuçları' : 'Discovery Results'}
                      <span className="text-gray-400 text-base ml-2">({results.length})</span>
                    </h3>
                    
                    {results.length > 0 && (
                      <button
                        onClick={handleSaveResults}
                        disabled={savingResults}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50"
                      >
                        {savingResults ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4 mr-2" />
                            {languageCode === 'tr' ? 'Sonuçları Kaydet' : 'Save Results'}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {results.map((item) => (
                      <ContentCard
                        key={`${item.content_type}-${item.id}`}
                        content={item}
                        onWatchlistStatusChange={handleWatchlistStatusChange}
                        watchlistStatus={userWatchlistMap.get(item.id) as any || 'none'}
                        onAuthRequired={() => openAuthPrompt('watchlist')}
                        variant="compact"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save Confirmation Modal */}
          {showSaveConfirmation && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-white mb-4">
                  {languageCode === 'tr' ? 'Sonuçları Kaydet' : 'Save Results'}
                </h3>
                <p className="text-gray-300 mb-6">
                  {languageCode === 'tr' 
                    ? `${results.length} içerik izleme listenize "İzlemek İstiyorum" olarak eklenecek. Bu sayede daha sonra kolayca bulabilir ve izleyebilirsiniz.`
                    : `${results.length} items will be added to your watchlist as "Want to Watch". This way you can easily find and watch them later.`}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSaveConfirmation(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {languageCode === 'tr' ? 'İptal' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmSaveResults}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {languageCode === 'tr' ? 'Kaydet' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DiscoveryWizard
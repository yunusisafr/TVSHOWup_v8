import React, { useState, useEffect, useRef } from 'react'
import { Wand2, Sparkles, Filter, ChevronDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { ContentItem } from '../lib/database'
import { useAuth } from '../contexts/AuthContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { tmdbService } from '../lib/tmdb'
import { MoodType, getGenresForMood } from '../lib/discoveryAlgorithm'
import { discoveryService } from '../lib/discoveryService'
import { discoveryCache } from '../lib/discoveryCache'
import MoodSelector from './MoodSelector'
import ContentCard from './ContentCard'
import SkeletonCard from './SkeletonCard'
import StreamingPlatformFilter from './StreamingPlatformFilter'
import { databaseService } from '../lib/database'
import { useLocation } from 'react-router-dom'

type DiscoveryMode = 'mood'

interface DiscoveryFilters {
  platforms: number[]
  contentType: 'all' | 'movie' | 'tv_show'
  yearFrom?: number
  yearTo?: number
  minRating: number
}

const DiscoveryWizardEnhanced: React.FC = () => {
  const { user } = useAuth()
  const { languageCode, countryCode } = useUserPreferences()
  const location = useLocation()
  const wizardRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [isExpanded, setIsExpanded] = useState(false)
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode | null>(null)
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<ContentItem[]>([])
  const [allResults, setAllResults] = useState<ContentItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<DiscoveryFilters>({
    platforms: [],
    contentType: 'all',
    minRating: 5.0
  })
  const [providers, setProviders] = useState<any[]>([])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToWizard = () => {
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const scrollToResults = () => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  useEffect(() => {
    loadProviders()
  }, [])

  useEffect(() => {
    const locationState = location.state as any

    // Priority 1: Location state from navigation (when user navigates back from detail page)
    if (locationState?.discoveryWizardState) {
      const state = locationState.discoveryWizardState
      console.log('🔄 Restoring wizard state from location:', state)
      const hasResults = state.results && state.results.length > 0
      setIsExpanded(hasResults ? true : (state.isExpanded || false))
      setDiscoveryMode(state.discoveryMode || null)
      setSelectedMood(state.selectedMood || null)
      setResults(state.results || [])
      setAllResults(state.allResults || [])
      setFilters(state.filters || { platforms: [], contentType: 'all', minRating: 5.0 })
      setCurrentPage(state.currentPage || 1)
      setShowFilters(state.showFilters || false)

      // Scroll to results if they exist
      if (hasResults) {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 300)
      }
      return
    }

    // Priority 2: SessionStorage (fallback or initial page load)
    const savedState = sessionStorage.getItem('discoveryWizardState')
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        console.log('🔄 Restoring wizard state from sessionStorage:', state)
        const hasResults = state.results && state.results.length > 0

        // Only restore if the state is recent (within last 30 minutes)
        const stateTimestamp = state.timestamp || 0
        const isRecent = Date.now() - stateTimestamp < 30 * 60 * 1000

        if (isRecent || hasResults) {
          setIsExpanded(hasResults ? true : (state.isExpanded || false))
          setDiscoveryMode(state.discoveryMode || null)
          setSelectedMood(state.selectedMood || null)
          setResults(state.results || [])
          setAllResults(state.allResults || [])
          setFilters(state.filters || { platforms: [], contentType: 'all', minRating: 5.0 })
          setCurrentPage(state.currentPage || 1)
          setShowFilters(state.showFilters || false)
        }
      } catch (e) {
        console.error('Error restoring wizard state:', e)
      }
    }
  }, [location.state])

  useEffect(() => {
    // Only save state if we have meaningful data to persist
    if (results.length > 0 || selectedMood || discoveryMode) {
      const state = {
        isExpanded,
        discoveryMode,
        selectedMood,
        results,
        allResults,
        filters,
        currentPage,
        showFilters,
        timestamp: Date.now()
      }
      sessionStorage.setItem('discoveryWizardState', JSON.stringify(state))
    }
  }, [isExpanded, discoveryMode, selectedMood, results, allResults, filters, currentPage, showFilters])

  const loadProviders = async () => {
    try {
      const { data, error } = await databaseService.supabase
        .from('providers')
        .select('*')
        .eq('is_active', true)
        .order('display_priority', { ascending: true })

      if (!error && data) {
        setProviders(data)
      }
    } catch (error) {
      console.error('Error loading providers:', error)
    }
  }

  const handleMoodSelect = async (mood: MoodType) => {
    // Prevent duplicate requests
    if (isProcessing || loading) {
      console.log('⚠️ Already processing a mood selection, ignoring duplicate request')
      return
    }

    try {
      setIsProcessing(true)
      setError(null)
      setSelectedMood(mood)
      setDiscoveryMode('mood')

      if (user) {
        await discoveryService.addMoodToHistory(user.id, mood)
      }

      await handleMoodBasedDiscovery(mood)
    } catch (error) {
      console.error('Error in handleMoodSelect:', error)
      setError(languageCode === 'tr'
        ? 'Ruh haline göre içerik yüklenirken bir hata oluştu'
        : 'An error occurred while loading content based on mood')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMoodBasedDiscovery = async (mood: MoodType) => {
    try {
      console.log('🎬 Starting mood-based discovery for:', mood)
      setLoading(true)
      setError(null)
      setResults([])
      setAllResults([])
      setShowFilters(true)

      const genres = getGenresForMood(mood)

      if (!genres || genres.length === 0) {
        console.error('❌ No genres found for mood:', mood)
        throw new Error('No genres found for selected mood')
      }

      console.log(`✅ Mood: "${mood}" mapped to genres:`, genres)
      console.log(`📊 TMDB Genre IDs: ${genres.join(', ')}`)

      console.log(`🎭 Discovering content for mood: ${mood} with genres: ${genres.join(', ')}`)

      // OPTIMIZED: Check cache first
      const cacheKey = discoveryCache.generateKey(mood, filters)
      const cachedResults = await discoveryCache.get(cacheKey)

      if (cachedResults && cachedResults.length > 0) {
        console.log('⚡ Using cached results')
        const uniqueCached = Array.from(
          new Map(cachedResults.map(item => [`${item.content_type}-${item.id}`, item])).values()
        )
        setAllResults(uniqueCached)
        setResults(uniqueCached.slice(0, 24))
        setCurrentPage(1)
        setRetryCount(0)
        setIsExpanded(true)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200)
        return
      }

      // ENHANCED: Fetch multiple pages initially to ensure we have enough trending content
      // This gives us ~120 results (60 movies + 60 TV shows) to work with
      console.log(`🔍 Discovery Parameters:`, {
        mood,
        genres: genres.join(','),
        platforms: filters.platforms,
        platformString: filters.platforms.join('|'),
        countryCode,
        languageCode,
        hasProviderFilter: filters.platforms.length > 0
      })

      const moviePages = await Promise.all([1, 2, 3].map(page =>
        tmdbService.discoverMovies({
          page,
          language: languageCode,
          region: countryCode,
          sortBy: 'popularity.desc',
          withGenres: genres.join(','),
          voteCountGte: 10,
          voteAverageGte: 5.0,
          withWatchProviders: filters.platforms.length > 0 ? filters.platforms.join('|') : undefined,
          watchRegion: filters.platforms.length > 0 ? countryCode : undefined
        }).catch(error => {
          console.error(`❌ Error fetching movies page ${page}:`, error)
          return null
        })
      ))

      const tvPages = await Promise.all([1, 2, 3].map(page =>
        tmdbService.discoverTVShows({
          page,
          language: languageCode,
          sortBy: 'popularity.desc',
          withGenres: genres.join(','),
          voteCountGte: 10,
          voteAverageGte: 5.0,
          withWatchProviders: filters.platforms.length > 0 ? filters.platforms.join('|') : undefined,
          watchRegion: filters.platforms.length > 0 ? countryCode : undefined
        }).catch(error => {
          console.error(`❌ Error fetching TV shows page ${page}:`, error)
          return null
        })
      ))

      // Combine all pages into single arrays
      const allMovies = moviePages
        .filter(p => p !== null && p.results)
        .flatMap(p => p?.results || [])

      const allTVShows = tvPages
        .filter(p => p !== null && p.results)
        .flatMap(p => p?.results || [])

      if (allMovies.length === 0 && allTVShows.length === 0) {
        throw new Error('Failed to fetch any content from TMDB')
      }

      console.log('📊 Raw API Response:', {
        moviePagesReceived: moviePages.filter(p => p !== null).length,
        tvPagesReceived: tvPages.filter(p => p !== null).length,
        movieCount: allMovies.length,
        tvCount: allTVShows.length,
        totalFetched: allMovies.length + allTVShows.length,
        movieSample: allMovies[0]?.title,
        tvSample: allTVShows[0]?.name
      })

      if (allMovies.length === 0 && allTVShows.length === 0) {
        console.warn('⚠️ No content found for mood and preferences, trying fallback...')
        // Try fallback without genre restriction
        const fallbackMovies = await tmdbService.discoverMovies({
          page: 1,
          language: languageCode,
          region: countryCode,
          sortBy: 'popularity.desc',
          voteCountGte: 10,
          voteAverageGte: 5.0
        })

        if (!fallbackMovies?.results || fallbackMovies.results.length === 0) {
          throw new Error('No content found for selected mood and preferences')
        }

        console.log('✅ Using fallback results')
        const fallbackContent = fallbackMovies.results.slice(0, 24).map((m: any) => ({
          id: m.id,
          title: m.title,
          overview: m.overview,
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          vote_average: m.vote_average,
          vote_count: m.vote_count,
          popularity: m.popularity,
          release_date: m.release_date,
          content_type: 'movie' as const,
          adult: false,
          original_language: m.original_language || 'en',
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
          genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
          keywords: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        setAllResults(fallbackContent)
        setResults(fallbackContent)
        setCurrentPage(1)
        setRetryCount(0)
        await new Promise(resolve => setTimeout(resolve, 100))
        setIsExpanded(true)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200)
        return
      }

      const allResults = [
        ...allMovies.map((m: any) => ({
          id: m.id,
          title: m.title,
          overview: m.overview,
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          vote_average: m.vote_average,
          vote_count: m.vote_count,
          popularity: m.popularity,
          release_date: m.release_date,
          content_type: 'movie' as const,
          adult: false,
          original_language: m.original_language || 'en',
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
          genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
          keywords: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        ...allTVShows.map((s: any) => ({
          id: s.id,
          name: s.name,
          title: s.name,
          overview: s.overview,
          poster_path: s.poster_path,
          backdrop_path: s.backdrop_path,
          vote_average: s.vote_average,
          vote_count: s.vote_count,
          popularity: s.popularity,
          first_air_date: s.first_air_date,
          content_type: 'tv_show' as const,
          adult: false,
          original_language: s.original_language || 'en',
          last_air_date: null,
          status: null,
          type: null,
          tagline: null,
          homepage: null,
          in_production: false,
          number_of_episodes: 0,
          number_of_seasons: 0,
          episode_run_time: null,
          origin_country: s.origin_country || [],
          created_by: null,
          genres: s.genre_ids ? JSON.stringify(s.genre_ids.map((id: number) => ({ id }))) : null,
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
      ]

      let sortedResults = allResults
        .filter((item: ContentItem) => item.vote_average >= 5.0)

      if (user) {
        const userWatchlist = await databaseService.getUserWatchlist(user.id)
        const watchedGenres = new Map<number, number>()

        for (const item of userWatchlist) {
          if (item.genres) {
            const itemGenres = typeof item.genres === 'string' ? JSON.parse(item.genres) : item.genres
            if (Array.isArray(itemGenres)) {
              itemGenres.forEach((g: any) => {
                const genreId = typeof g === 'number' ? g : g.id
                watchedGenres.set(genreId, (watchedGenres.get(genreId) || 0) + 1)
              })
            }
          }
        }

        sortedResults = sortedResults.map(item => {
          let personalizedScore = item.popularity

          if (item.genres) {
            const itemGenres = typeof item.genres === 'string' ? JSON.parse(item.genres) : item.genres
            if (Array.isArray(itemGenres)) {
              itemGenres.forEach((g: any) => {
                const genreId = typeof g === 'number' ? g : g.id
                if (watchedGenres.has(genreId)) {
                  personalizedScore += (watchedGenres.get(genreId) || 0) * 50
                }
              })
            }
          }

          return { ...item, personalizedScore }
        }) as any
        sortedResults = sortedResults.sort((a: any, b: any) => (b.personalizedScore || b.popularity) - (a.personalizedScore || a.popularity))
      } else {
        sortedResults = sortedResults.sort((a, b) => b.popularity - a.popularity)
      }

      const uniqueResults = Array.from(
        new Map(sortedResults.map(item => [`${item.content_type}-${item.id}`, item])).values()
      )

      if (uniqueResults.length === 0) {
        console.warn('⚠️ No results after filtering, retrying with relaxed criteria')
        // Fallback: Try without genre restriction if nothing found
        const fallbackMovies = await tmdbService.discoverMovies({
          page: 1,
          language: languageCode,
          region: countryCode,
          sortBy: 'popularity.desc',
          voteCountGte: 10,
          voteAverageGte: 5.0
        })

        if (fallbackMovies?.results && fallbackMovies.results.length > 0) {
          console.log('✅ Using fallback results without genre restriction')
          const fallbackResults = fallbackMovies.results.slice(0, 24).map((m: any) => ({
            id: m.id,
            title: m.title,
            overview: m.overview,
            poster_path: m.poster_path,
            backdrop_path: m.backdrop_path,
            vote_average: m.vote_average,
            vote_count: m.vote_count,
            popularity: m.popularity,
            release_date: m.release_date,
            content_type: 'movie' as const,
            adult: false,
            original_language: m.original_language || 'en',
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
            genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
            keywords: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))

          setAllResults(fallbackResults)
          setResults(fallbackResults)
          setCurrentPage(1)
          setRetryCount(0)
          await new Promise(resolve => setTimeout(resolve, 100))
          setIsExpanded(true)
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }, 200)
          return
        }

        throw new Error('No valid results after filtering')
      }

      console.log(`✅ Processed ${uniqueResults.length} unique results`)

      const movies = uniqueResults.filter(item => item.content_type === 'movie')
      const tvShows = uniqueResults.filter(item => item.content_type === 'tv_show')

      const balancedInitialResults: ContentItem[] = []
      let movieIndex = 0
      let tvIndex = 0

      while (balancedInitialResults.length < 24) {
        if (movieIndex < movies.length && (movieIndex < 12 || tvIndex >= tvShows.length)) {
          balancedInitialResults.push(movies[movieIndex++])
        }
        if (balancedInitialResults.length >= 24) break

        if (tvIndex < tvShows.length && (tvIndex < 12 || movieIndex >= movies.length)) {
          balancedInitialResults.push(tvShows[tvIndex++])
        }

        if (movieIndex >= movies.length && tvIndex >= tvShows.length) break
      }

      const finalResults = balancedInitialResults.length > 0 ? balancedInitialResults : uniqueResults.slice(0, 24)

      setAllResults(uniqueResults)
      setResults(finalResults)
      setCurrentPage(1)
      setRetryCount(0)

      // OPTIMIZED: Cache results for future use
      discoveryCache.set(cacheKey, uniqueResults, mood, filters).catch(err => {
        console.warn('Failed to cache results:', err)
      })

      // Wait for state to be set before expanding
      await new Promise(resolve => setTimeout(resolve, 100))
      setIsExpanded(true)

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 200)

      if (user) {
        discoveryService.checkAndAwardBadges(user.id).catch(err => {
          console.warn('Error checking badges:', err)
        })
      }

      console.log(`🎉 Successfully loaded ${finalResults.length} initial results`)
    } catch (error) {
      console.error('❌ Error in mood-based discovery:', error)
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // IMPROVED: More specific error messages
      let userMessage = ''
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        userMessage = languageCode === 'tr'
          ? 'Çok fazla istek gönderildi. Lütfen 30 saniye bekleyip tekrar deneyin.'
          : 'Too many requests. Please wait 30 seconds and try again.'
      } else if (errorMessage.includes('fetch') || errorMessage.includes('Network') || errorMessage.includes('Failed to fetch') || errorMessage.includes('abort')) {
        userMessage = languageCode === 'tr'
          ? 'Bağlantı hatası. İnternet bağlantınızı kontrol edin ve tekrar deneyin.'
          : 'Connection error. Check your internet connection and try again.'
      } else if (errorMessage.includes('No content found') || errorMessage.includes('No genres')) {
        userMessage = languageCode === 'tr'
          ? 'Bu ruh hali için içerik bulunamadı. Farklı bir ruh hali veya filtre deneyin.'
          : 'No content found for this mood. Try a different mood or filter.'
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        userMessage = languageCode === 'tr'
          ? 'Kimlik doğrulama hatası. Sayfa yenileniyor...'
          : 'Authentication error. Refreshing page...'
        setTimeout(() => window.location.reload(), 2000)
      } else {
        userMessage = languageCode === 'tr'
          ? `İçerik yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin. (${errorMessage.substring(0, 50)})`
          : `An error occurred while loading content. Please refresh the page. (${errorMessage.substring(0, 50)})`
      }

      console.log('📌 Setting error message:', userMessage)
      setError(userMessage)

      // Reset to mood selection state on error
      setSelectedMood(null)
      setResults([])
      setAllResults([])
    } finally {
      console.log('✅ Mood discovery completed, setting loading to false')
      setLoading(false)
    }
  }




  const resetWizard = () => {
    setDiscoveryMode(null)
    setSelectedMood(null)
    setResults([])
    setAllResults([])
    setCurrentPage(1)
    setFilters({ platforms: [], contentType: 'all', minRating: 5.0 })
    setError(null)
    setRetryCount(0)
    setIsProcessing(false)
    sessionStorage.removeItem('discoveryWizardState')
    scrollToTop()
  }

  const retryMoodDiscovery = async () => {
    if (!selectedMood || isProcessing || loading) return

    setRetryCount(prev => prev + 1)
    setError(null)
    await handleMoodBasedDiscovery(selectedMood)
  }

  const applyFilters = async () => {
    try {
      setLoading(true)

      // CRITICAL FIX: If platforms are selected, we need to fetch fresh data from TMDB
      // because the existing results may not have been filtered by platforms
      if (filters.platforms.length > 0 && selectedMood) {
        console.log(`🔄 Platform filter changed, fetching fresh results`)
        console.log(`📊 Filters:`, {
          platforms: filters.platforms,
          contentType: filters.contentType,
          minRating: filters.minRating,
          mood: selectedMood,
          countryCode
        })

        // Re-fetch with platform filters applied
        const genres = getGenresForMood(selectedMood)
        console.log(`🎭 Genres for ${selectedMood}:`, genres)

        const baseParams: any = {
          language: languageCode,
          region: countryCode,
          sortBy: 'popularity.desc',
          voteCountGte: 10,
          voteAverageGte: filters.minRating || 5.0,
          withWatchProviders: filters.platforms.join('|'),
          watchRegion: countryCode
        }

        if (genres && genres.length > 0) {
          baseParams.withGenres = genres.join(',')
        }

        if (filters.yearFrom) {
          baseParams.primaryReleaseDateGte = `${filters.yearFrom}-01-01`
          baseParams.firstAirDateGte = `${filters.yearFrom}-01-01`
        }

        if (filters.yearTo) {
          baseParams.primaryReleaseDateLte = `${filters.yearTo}-12-31`
          baseParams.firstAirDateLte = `${filters.yearTo}-12-31`
        }

        // Fetch fresh results with platform filters
        const fetchPromises = []

        if (filters.contentType === 'all' || filters.contentType === 'movie') {
          fetchPromises.push(
            ...([1, 2, 3].map(page =>
              tmdbService.discoverMovies({ ...baseParams, page }).catch(err => {
                console.error(`Error fetching movies page ${page}:`, err)
                return null
              })
            ))
          )
        }

        if (filters.contentType === 'all' || filters.contentType === 'tv_show') {
          console.log(`📺 Fetching TV shows with params:`, baseParams)
          fetchPromises.push(
            ...([1, 2, 3].map(page =>
              tmdbService.discoverTVShows({ ...baseParams, page }).catch(err => {
                console.error(`❌ Error fetching TV shows page ${page}:`, err)
                return null
              })
            ))
          )
        }

        console.log(`⏳ Waiting for ${fetchPromises.length} API calls...`)
        const pages = await Promise.all(fetchPromises)
        console.log(`✅ Received ${pages.filter(p => p !== null).length} successful responses`)

        const allMovies = pages
          .filter(p => p !== null && p.results)
          .flatMap(p => p?.results || [])
          .filter((item: any) => item.title) // Movies
          .map((m: any) => ({
            id: m.id,
            title: m.title,
            overview: m.overview,
            poster_path: m.poster_path,
            backdrop_path: m.backdrop_path,
            vote_average: m.vote_average,
            vote_count: m.vote_count,
            popularity: m.popularity,
            release_date: m.release_date,
            content_type: 'movie' as const,
            adult: false,
            original_language: m.original_language || 'en',
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
            genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
            keywords: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))

        const allTVShows = pages
          .filter(p => p !== null && p.results)
          .flatMap(p => p?.results || [])
          .filter((item: any) => item.name) // TV Shows

        console.log(`📊 Raw results: ${allMovies.length} movies, ${allTVShows.length} TV shows`)

        const mappedTVShows = allTVShows.map((s: any) => ({
            id: s.id,
            title: s.name,
            overview: s.overview,
            poster_path: s.poster_path,
            backdrop_path: s.backdrop_path,
            vote_average: s.vote_average,
            vote_count: s.vote_count,
            popularity: s.popularity,
            first_air_date: s.first_air_date,
            content_type: 'tv_show' as const,
            adult: false,
            original_language: s.original_language || 'en',
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
            genres: s.genre_ids ? JSON.stringify(s.genre_ids.map((id: number) => ({ id }))) : null,
            keywords: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))

        const freshResults = [...allMovies, ...mappedTVShows]
        const uniqueResults = Array.from(
          new Map(freshResults.map(item => [`${item.content_type}_${item.id}`, item])).values()
        )

        console.log(`✅ Final results: ${uniqueResults.length} items (${allMovies.length} movies + ${mappedTVShows.length} TV shows)`)

        if (uniqueResults.length === 0) {
          console.warn(`⚠️ No results with genre+platform combo! Trying without genre restriction...`)
          console.warn(`🔍 Original params:`, {
            genres,
            platforms: filters.platforms,
            contentType: filters.contentType,
            countryCode
          })

          // FALLBACK: Try without genre restriction if no results
          const fallbackParams: any = {
            language: languageCode,
            region: countryCode,
            sortBy: 'popularity.desc',
            voteCountGte: 10,
            voteAverageGte: filters.minRating || 5.0,
            withWatchProviders: filters.platforms.join('|'),
            watchRegion: countryCode
          }

          const fallbackPromises = []

          if (filters.contentType === 'tv_show') {
            console.log(`📺 FALLBACK: Fetching TV shows without genre filter`)
            fallbackPromises.push(
              ...([1, 2, 3, 4, 5].map(page =>
                tmdbService.discoverTVShows({ ...fallbackParams, page }).catch(() => null)
              ))
            )
          }

          const fallbackPages = await Promise.all(fallbackPromises)
          const fallbackTVShows = fallbackPages
            .filter(p => p !== null && p.results)
            .flatMap(p => p?.results || [])
            .filter((item: any) => item.name)
            .map((s: any) => ({
              id: s.id,
              title: s.name,
              overview: s.overview,
              poster_path: s.poster_path,
              backdrop_path: s.backdrop_path,
              vote_average: s.vote_average,
              vote_count: s.vote_count,
              popularity: s.popularity,
              first_air_date: s.first_air_date,
              content_type: 'tv_show' as const,
              adult: false,
              original_language: s.original_language || 'en',
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
              genres: s.genre_ids ? JSON.stringify(s.genre_ids.map((id: number) => ({ id }))) : null,
              keywords: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))

          console.log(`✅ FALLBACK results: ${fallbackTVShows.length} TV shows found without genre filter`)

          if (fallbackTVShows.length > 0) {
            setAllResults(fallbackTVShows)
            setResults(fallbackTVShows.slice(0, 24))
            setCurrentPage(1)
            setShowFilters(false)
            scrollToResults()
            return
          }
        }

        setAllResults(uniqueResults)
        setResults(uniqueResults.slice(0, 24))
        setCurrentPage(1)
        setShowFilters(false)
        scrollToResults()
        return
      }

      // If no platform filters, proceed with local filtering of existing results
      let filtered = [...allResults]

      if (filters.contentType !== 'all') {
        filtered = filtered.filter(item => item.content_type === filters.contentType)
      }

      if (filters.minRating > 0) {
        filtered = filtered.filter(item => item.vote_average >= filters.minRating)
      }

      if (filters.yearFrom) {
        filtered = filtered.filter(item => {
          const year = item.content_type === 'movie'
            ? item.release_date?.substring(0, 4)
            : item.first_air_date?.substring(0, 4)
          return year ? parseInt(year) >= filters.yearFrom! : false
        })
      }

      if (filters.yearTo) {
        filtered = filtered.filter(item => {
          const year = item.content_type === 'movie'
            ? item.release_date?.substring(0, 4)
            : item.first_air_date?.substring(0, 4)
          return year ? parseInt(year) <= filters.yearTo! : false
        })
      }

      // If we have less than 24 results after filtering, fetch more content
      if (filtered.length < 24 && selectedMood) {
        console.log(`⚠️ Only ${filtered.length} results after filtering, fetching more...`)

        const genres = getGenresForMood(selectedMood)
        const targetCount = 24
        const additionalNeeded = targetCount - filtered.length

        // Build API params based on filters
        const baseParams: any = {
          language: languageCode,
          region: countryCode,
          sortBy: 'popularity.desc',
          voteCountGte: 10,
          voteAverageGte: filters.minRating || 5.0
        }

        if (genres && genres.length > 0) {
          baseParams.withGenres = genres.join(',')
        }

        if (filters.yearFrom) {
          baseParams.primaryReleaseDateGte = `${filters.yearFrom}-01-01`
          baseParams.firstAirDateGte = `${filters.yearFrom}-01-01`
        }

        if (filters.yearTo) {
          baseParams.primaryReleaseDateLte = `${filters.yearTo}-12-31`
          baseParams.firstAirDateLte = `${filters.yearTo}-12-31`
        }

        if (filters.platforms.length > 0) {
          baseParams.withWatchProviders = filters.platforms.join('|')
          baseParams.watchRegion = countryCode
        }

        // Fetch additional pages based on content type filter
        let newContent: ContentItem[] = []
        const existingIds = new Set(allResults.map(r => `${r.content_type}_${r.id}`))

        if (filters.contentType === 'all' || filters.contentType === 'movie') {
          const moviePromises = [4, 5, 6].map(page =>
            tmdbService.discoverMovies({ ...baseParams, page }).catch(err => {
              console.error(`Error fetching movies page ${page}:`, err)
              return null
            })
          )

          const moviePages = await Promise.all(moviePromises)
          const movies = moviePages
            .filter(p => p !== null)
            .flatMap(p => p?.results || [])
            .filter((m: any) => !existingIds.has(`movie_${m.id}`))
            .map((m: any) => ({
              id: m.id,
              title: m.title,
              overview: m.overview,
              poster_path: m.poster_path,
              backdrop_path: m.backdrop_path,
              vote_average: m.vote_average,
              vote_count: m.vote_count,
              popularity: m.popularity,
              release_date: m.release_date,
              content_type: 'movie' as const,
              adult: false,
              original_language: m.original_language || 'en',
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
              genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
              keywords: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))

          newContent.push(...movies)
        }

        if (filters.contentType === 'all' || filters.contentType === 'tv_show') {
          const tvPromises = [4, 5, 6].map(page =>
            tmdbService.discoverTVShows({ ...baseParams, page }).catch(err => {
              console.error(`Error fetching TV shows page ${page}:`, err)
              return null
            })
          )

          const tvPages = await Promise.all(tvPromises)
          const tvShows = tvPages
            .filter(p => p !== null)
            .flatMap(p => p?.results || [])
            .filter((s: any) => !existingIds.has(`tv_show_${s.id}`))
            .map((s: any) => ({
              id: s.id,
              title: s.name,
              overview: s.overview,
              poster_path: s.poster_path,
              backdrop_path: s.backdrop_path,
              vote_average: s.vote_average,
              vote_count: s.vote_count,
              popularity: s.popularity,
              first_air_date: s.first_air_date,
              content_type: 'tv_show' as const,
              adult: false,
              original_language: s.original_language || 'en',
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
              genres: s.genre_ids ? JSON.stringify(s.genre_ids.map((id: number) => ({ id }))) : null,
              keywords: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))

          newContent.push(...tvShows)
        }

        console.log(`✅ Fetched ${newContent.length} additional items`)

        // OPTIMIZED: Platform filter already applied in API call via withWatchProviders
        // No need for additional filtering

        // Combine filtered results with new content
        const combined = [...filtered, ...newContent]
        const unique = Array.from(new Map(combined.map(item => [`${item.content_type}_${item.id}`, item])).values())

        filtered = unique.slice(0, 24)
        console.log(`🎯 Final count after fetching more: ${filtered.length}`)
      }

      setResults(filtered.slice(0, 24))
      setCurrentPage(1)
      setShowFilters(false)
      scrollToResults()
    } catch (error) {
      console.error('Error applying filters:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMoreResults = async () => {
    const nextPage = currentPage + 1
    const endIndex = nextPage * 24

    // If we have enough cached results, just display them
    if (allResults.length >= endIndex) {
      const moreResults = allResults.slice(0, endIndex)
      setResults(moreResults)
      setCurrentPage(nextPage)
      return
    }

    // Otherwise, fetch more content from TMDB
    if (!selectedMood) return

    try {
      setLoading(true)
      console.log(`🔄 Loading more results - fetching additional pages...`)

      const genres = getGenresForMood(selectedMood)
      const nextApiPage = Math.floor(allResults.length / 20) + 1 // TMDB returns ~20 results per page

      const baseParams: any = {
        language: languageCode,
        region: countryCode,
        sortBy: 'popularity.desc',
        voteCountGte: 10,
        voteAverageGte: filters.minRating || 5.0
      }

      if (genres && genres.length > 0) {
        baseParams.withGenres = genres.join(',')
      }

      if (filters.platforms.length > 0) {
        baseParams.withWatchProviders = filters.platforms.join('|')
        baseParams.watchRegion = countryCode
      }

      if (filters.yearFrom) {
        baseParams.releaseDateGte = `${filters.yearFrom}-01-01`
        baseParams.firstAirDateGte = `${filters.yearFrom}-01-01`
      }

      if (filters.yearTo) {
        baseParams.releaseDateLte = `${filters.yearTo}-12-31`
        baseParams.firstAirDateLte = `${filters.yearTo}-12-31`
      }

      // Fetch 2 more pages for each content type
      const fetchPromises = []

      if (filters.contentType === 'all' || filters.contentType === 'movie') {
        fetchPromises.push(
          ...([nextApiPage, nextApiPage + 1].map(page =>
            tmdbService.discoverMovies({ ...baseParams, page }).catch(err => {
              console.error(`Error fetching movies page ${page}:`, err)
              return null
            })
          ))
        )
      }

      if (filters.contentType === 'all' || filters.contentType === 'tv_show') {
        fetchPromises.push(
          ...([nextApiPage, nextApiPage + 1].map(page =>
            tmdbService.discoverTVShows({ ...baseParams, page }).catch(err => {
              console.error(`Error fetching TV shows page ${page}:`, err)
              return null
            })
          ))
        )
      }

      const pages = await Promise.all(fetchPromises)
      const existingIds = new Set(allResults.map(r => `${r.content_type}_${r.id}`))

      const newMovies = pages
        .filter(p => p !== null && p.results)
        .flatMap(p => p?.results || [])
        .filter((item: any) => item.title && !existingIds.has(`movie_${item.id}`))
        .map((m: any) => ({
          id: m.id,
          title: m.title,
          overview: m.overview,
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          vote_average: m.vote_average,
          vote_count: m.vote_count,
          popularity: m.popularity,
          release_date: m.release_date,
          content_type: 'movie' as const,
          adult: false,
          original_language: m.original_language || 'en',
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
          genres: m.genre_ids ? JSON.stringify(m.genre_ids.map((id: number) => ({ id }))) : null,
          keywords: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

      const newTVShows = pages
        .filter(p => p !== null && p.results)
        .flatMap(p => p?.results || [])
        .filter((item: any) => item.name && !existingIds.has(`tv_show_${item.id}`))
        .map((s: any) => ({
          id: s.id,
          title: s.name,
          overview: s.overview,
          poster_path: s.poster_path,
          backdrop_path: s.backdrop_path,
          vote_average: s.vote_average,
          vote_count: s.vote_count,
          popularity: s.popularity,
          first_air_date: s.first_air_date,
          content_type: 'tv_show' as const,
          adult: false,
          original_language: s.original_language || 'en',
          last_air_date: null,
          status: null,
          type: null,
          tagline: null,
          homepage: null,
          in_production: false,
          number_of_episodes: 0,
          number_of_seasons: 0,
          episode_run_time: null,
          origin_country: s.origin_country || [],
          created_by: null,
          genres: s.genre_ids ? JSON.stringify(s.genre_ids.map((id: number) => ({ id }))) : null,
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

      const newContent = [...newMovies, ...newTVShows]
      const updatedAllResults = [...allResults, ...newContent]

      console.log(`✅ Loaded ${newContent.length} more results. Total: ${updatedAllResults.length}`)

      setAllResults(updatedAllResults)
      setResults(updatedAllResults.slice(0, endIndex))
      setCurrentPage(nextPage)
    } catch (error) {
      console.error('Error loading more results:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasMoreResults = () => {
    // Always show "Load More" button as TMDB has thousands of results
    // We'll fetch more pages dynamically when needed
    return discoveryMode === 'mood' && selectedMood && results.length >= 24
  }

  if (!isExpanded) {
    return (
      <div ref={wizardRef} className="px-3 sm:px-6 lg:px-8 py-8 bg-gradient-to-b from-slate-900 via-slate-800 to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/40 to-cyan-900/40 rounded-2xl p-8 border-2 border-emerald-500/30 shadow-2xl">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Wand2 className="w-10 h-10 text-blue-400 mr-3" />
                <h2 className="text-3xl sm:text-4xl font-bold text-white">
                  {languageCode === 'tr' ? 'Ne İzlemeliyim?' : 'What Should I Watch?'}
                </h2>
              </div>
              <p className="text-gray-300 text-lg mb-8">
                {languageCode === 'tr'
                  ? 'Ruh haline göre öneriler al'
                  : 'Get recommendations based on your mood'}
              </p>

              <button
                onClick={() => {
                  setIsExpanded(true)
                  setDiscoveryMode('mood')
                  scrollToWizard()
                }}
                className="bg-gradient-to-br from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center mx-auto text-lg shadow-lg"
              >
                <span className="text-2xl mr-3">🎭</span>
                {languageCode === 'tr' ? 'Ruh Halime Göre Keşfet' : 'Discover By My Mood'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (discoveryMode === 'swipe' && !showSwipeResults) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 py-8 bg-gradient-to-b from-slate-900 via-slate-800 to-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/40 to-cyan-900/40 rounded-2xl p-6 border-2 border-emerald-500/30 shadow-2xl">
            <div className="mb-6">
              <button
                onClick={resetWizard}
                className="text-gray-400 hover:text-white transition-colors flex items-center"
              >
                ← {languageCode === 'tr' ? 'Geri' : 'Back'}
              </button>
            </div>

            {swipeContents.length > 0 ? (
              <SwipeDiscovery
                contents={swipeContents}
                onLike={(content) => console.log('Liked:', content)}
                onDislike={(content) => console.log('Disliked:', content)}
                onComplete={handleSwipeComplete}
                languageCode={languageCode}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  {languageCode === 'tr' ? 'İçerikler yükleniyor...' : 'Loading contents...'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={wizardRef} className="px-3 sm:px-6 lg:px-8 py-8 bg-gradient-to-b from-slate-900 via-slate-800 to-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/40 to-cyan-900/40 rounded-2xl p-8 border-2 border-emerald-500/30 shadow-2xl">
          {discoveryMode === 'mood' && !selectedMood ? (
            <div>
              <div className="mb-6">
                <button
                  onClick={() => {
                    resetWizard()
                    scrollToTop()
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={loading || isProcessing}
                >
                  ← {languageCode === 'tr' ? 'Geri' : 'Back'}
                </button>
              </div>
              <MoodSelector
                selectedMood={selectedMood || undefined}
                onMoodSelect={handleMoodSelect}
                languageCode={languageCode}
              />
            </div>
          ) : discoveryMode === 'mood' && selectedMood && results.length === 0 && !error ? (
            <div>
              <div className="mb-6">
                <button
                  onClick={() => {
                    resetWizard()
                    scrollToTop()
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={loading || isProcessing}
                >
                  ← {languageCode === 'tr' ? 'Geri' : 'Back'}
                </button>
              </div>
            </div>
          ) : null}

          {error && !loading && (
            <div className="mb-6 bg-red-900/30 border border-red-500/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-red-400 font-semibold mb-2">
                    {languageCode === 'tr' ? 'Bir Hata Oluştu' : 'An Error Occurred'}
                  </h4>
                  <p className="text-gray-300 mb-4">{error}</p>
                  <button
                    onClick={retryMoodDiscovery}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
                  >
                    <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    {languageCode === 'tr' ? 'Tekrar Dene' : 'Try Again'}
                    {retryCount > 0 && ` (${retryCount})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400 mb-2">
                {languageCode === 'tr' ? 'Öneriler hazırlanıyor...' : 'Preparing suggestions...'}
              </p>
              {retryCount > 0 && (
                <p className="text-sm text-gray-500">
                  {languageCode === 'tr' ? `Deneme ${retryCount + 1}` : `Attempt ${retryCount + 1}`}
                </p>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div ref={resultsRef} className="mt-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h3 className="text-2xl font-bold text-white">
                  {languageCode === 'tr' ? 'Önerilen İçerikler' : 'Recommended Content'}
                  <span className="text-gray-400 text-base ml-2">
                    ({results.length})
                  </span>
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {discoveryMode === 'mood' && (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all text-sm font-semibold shadow-lg ${
                        showFilters
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white animate-pulse'
                      }`}
                    >
                      <Filter className="w-5 h-5" />
                      {showFilters
                        ? (languageCode === 'tr' ? 'Filtreler Aktif' : 'Filters Active')
                        : (languageCode === 'tr' ? 'Sonuçları Filtrele' : 'Filter Results')}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      resetWizard()
                      scrollToTop()
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors text-sm whitespace-nowrap"
                  >
                    {languageCode === 'tr' ? 'Yeni Keşif' : 'New Discovery'}
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="bg-gray-800/80 rounded-xl p-6 mb-6 border border-gray-700">
                  <h4 className="text-lg font-bold text-white mb-6">
                    {languageCode === 'tr' ? 'Filtreleme Seçenekleri' : 'Filter Options'}
                  </h4>

                  {/* Content Type Filter - PRIMARY POSITION */}
                  <div className="mb-6 pb-6 border-b border-gray-700">
                    <label className="block text-base font-semibold text-white mb-4">
                      {languageCode === 'tr' ? 'İçerik Türü' : 'Content Type'}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setFilters({ ...filters, contentType: 'all' })}
                        className={`px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                          filters.contentType === 'all'
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105 ring-2 ring-blue-400'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}
                      >
                        <div className="text-2xl mb-1">🎬</div>
                        <div className="text-sm">{languageCode === 'tr' ? 'Tümü' : 'All'}</div>
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, contentType: 'movie' })}
                        className={`px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                          filters.contentType === 'movie'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105 ring-2 ring-purple-400'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}
                      >
                        <div className="text-2xl mb-1">🎥</div>
                        <div className="text-sm">{languageCode === 'tr' ? 'Filmler' : 'Movies'}</div>
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, contentType: 'tv_show' })}
                        className={`px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                          filters.contentType === 'tv_show'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg scale-105 ring-2 ring-emerald-400'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}
                      >
                        <div className="text-2xl mb-1">📺</div>
                        <div className="text-sm">{languageCode === 'tr' ? 'Diziler' : 'TV Shows'}</div>
                      </button>
                    </div>
                  </div>

                  {/* Streaming Platform Filter */}
                  <div className="mb-6 pb-6 border-b border-gray-700">
                    <StreamingPlatformFilter
                      selectedPlatforms={filters.platforms}
                      onSelectionChange={(platforms) => setFilters({ ...filters, platforms })}
                      languageCode={languageCode}
                      countryCode={countryCode}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {languageCode === 'tr' ? 'Minimum Puan' : 'Minimum Rating'}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="10"
                        step="0.5"
                        value={filters.minRating}
                        onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-400 mt-1">
                        <span>5.0</span>
                        <span className="text-blue-400 font-semibold">{filters.minRating.toFixed(1)}</span>
                        <span>10.0</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {languageCode === 'tr' ? 'Yıl Aralığı' : 'Year Range'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="1980"
                          value={filters.yearFrom || ''}
                          onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-1/2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="2024"
                          value={filters.yearTo || ''}
                          onChange={(e) => setFilters({ ...filters, yearTo: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-1/2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={applyFilters}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
                    >
                      {languageCode === 'tr' ? 'Uygula' : 'Apply Filters'}
                    </button>
                    <button
                      onClick={() => {
                        setFilters({ platforms: [], contentType: 'all', minRating: 5.0 })
                        setResults(allResults.slice(0, 24))
                        setCurrentPage(1)
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {languageCode === 'tr' ? 'Sıfırla' : 'Reset'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {loading && results.length === 0 ? (
                  Array(24).fill(0).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                  results.map((item) => (
                    <ContentCard
                      key={`${item.content_type}-${item.id}`}
                      content={item}
                      variant="compact"
                      preserveWizardState={true}
                    />
                  ))
                )}
              </div>

              {hasMoreResults() && discoveryMode === 'mood' && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMoreResults}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-3 rounded-lg transition-all font-semibold flex items-center mx-auto gap-2 shadow-lg"
                  >
                    <ChevronDown className="w-5 h-5" />
                    {languageCode === 'tr' ? 'Daha Fazla Yükle' : 'Load More'}
                    <span className="text-sm opacity-80">
                      ({results.length} / {allResults.length})
                    </span>
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DiscoveryWizardEnhanced

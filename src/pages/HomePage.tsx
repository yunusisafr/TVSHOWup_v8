import React, { useState, useEffect } from 'react'
import FeaturedContentSection from '../components/FeaturedContentSection'
import GenreFilterSection from '../components/GenreFilterSection'
import HorizontalContentRow from '../components/HorizontalContentRow'
import IntroSection from '../components/IntroSection'
import AIChatDiscovery from '../components/AIChatDiscovery'
import { ContentItem, databaseService } from '../lib/database'
import { testSupabaseConnection } from '../lib/supabase'
import { tmdbService } from '../lib/tmdb'
import { useTranslation } from '../lib/i18n'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useAuth } from '../contexts/AuthContext'
import ShareListSelectModal from '../components/ShareListSelectModal'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getLocalizedTitle, getLocalizedOverview, getLocalizedListName, getLocalizedListDescription } from '../lib/database'

const HomePage: React.FC = () => {
  const { countryCode, languageCode, isLoading: preferencesLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const navigate = useNavigate()
  const location = useLocation()
  const [contentSections, setContentSections] = useState<{
    trending: ContentItem[]
    netflixContent: ContentItem[],
    disneyContent: ContentItem[],
    primeContent: ContentItem[],
    maxContent: ContentItem[],
    publicLists: any[]
  }>({
    trending: [],
    netflixContent: [],
    disneyContent: [],
    primeContent: [],
    maxContent: [],
    publicLists: []
  })
  const [loading, setLoading] = useState(true)
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  // Share list modal state
  const [showShareListModal, setShowShareListModal] = useState(false)
  const [selectedContentForShareList, setSelectedContentForShareList] = useState<number | null>(null)
  const [selectedContentTypeForShareList, setSelectedContentTypeForShareList] = useState<'movie' | 'tv_show' | null>(null)

  // AI Chat modal state - controlled by URL hash
  const [showAIChat, setShowAIChat] = useState(false)

  // Sync AI chat state with URL hash
  useEffect(() => {
    const hash = location.hash
    setShowAIChat(hash === '#ai-chat')
  }, [location.hash])

  const openAIChat = () => {
    navigate('#ai-chat', { replace: false })
  }

  const closeAIChat = () => {
    // Remove hash from URL
    if (location.hash === '#ai-chat') {
      navigate(location.pathname + location.search, { replace: false })
    }
  }
  
  const loadTrendingContent = async (limit: number): Promise<ContentItem[]> => {
    try {
      console.log(`🔍 Loading trending content with language: ${languageCode}`)
      const trendingContent = await databaseService.getTrendingContent(languageCode, limit)
      
      // If language is not English, try to fetch localized content for the first few items
      if (languageCode !== 'en') {
        const localizedPromises = trendingContent.slice(0, 5).map(async (item) => {
          try {
            // First try to get localized content from database translations
            let localizedTitle = getLocalizedTitle(item, languageCode);
            let localizedOverview = getLocalizedOverview(item, languageCode);
            
            // If no database translation, fetch from TMDB
            if (!localizedTitle || localizedTitle === item.title || !localizedOverview) {
              const localizedItem = item.content_type === 'movie' 
                ? await tmdbService.getMovieDetails(item.id, languageCode)
                : await tmdbService.getTVShowDetails(item.id, languageCode);
              
              if (localizedItem) {
                localizedTitle = item.content_type === 'movie' ? localizedItem.title : localizedItem.name;
                localizedOverview = localizedItem.overview;
                console.log(`✅ Got localized trending content for ${item.id} in ${languageCode}`)
              }
            }
            
            if (localizedTitle || localizedOverview) {
              return {
                ...item,
                title: localizedTitle || item.title,
                overview: localizedOverview || item.overview
              };
            }
            return item;
          } catch (error) {
            console.warn(`Error fetching localized content for ${item.id}:`, error);
            return item;
          }
        });
        
        const localizedItems = await Promise.all(localizedPromises);
        
        // Replace the first few items with localized versions
        trendingContent.splice(0, localizedItems.length, ...localizedItems);
      }
      
      return trendingContent;
    } catch (error) {
      console.warn('Error loading trending content:', error)
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network'))) {
        throw error // Re-throw network errors to be handled by parent
      }
      return []
    }
  }

  const loadContentByProvider = async (providerId: number, limit: number = 12): Promise<ContentItem[]> => {
    try {
      // Get content providers for this provider
     console.log(`🔍 Loading content for provider ID ${providerId} in country ${countryCode} with language ${languageCode}`)
      const { data: contentProviders, error: providersError } = await databaseService.supabase
        .from('content_providers')
        .select('content_id, content_type')
        .eq('provider_id', providerId)
        .eq('country_code', countryCode)
        .limit(100);
      
      if (providersError) {
        console.error(`Error fetching content providers for ${providerId}:`, providersError)
        return []
      }
      
     console.log(`✅ Found ${contentProviders?.length || 0} content items for provider ${providerId}`)
      if (!contentProviders || contentProviders.length === 0) {
       console.log(`⚠️ No content found for provider ${providerId} in country ${countryCode}`)
        return [];
      }
      
      // Separate movie and TV show IDs
      const movieIds = contentProviders
        .filter(cp => cp.content_type === 'movie')
        .map(cp => cp.content_id);
      
      const tvShowIds = contentProviders
        .filter(cp => cp.content_type === 'tv_show')
        .map(cp => cp.content_id);
      
      // Fetch movies and TV shows in parallel
      const [moviesResult, tvShowsResult] = await Promise.allSettled([
        movieIds.length > 0 ? databaseService.supabase
          .from('movies')
          .select('*')
          .in('id', movieIds)
          .order('popularity', { ascending: false })
          .limit(Math.ceil(limit/2)) : Promise.resolve({ data: [] }),
        
        tvShowIds.length > 0 ? databaseService.supabase
          .from('tv_shows')
          .select('*')
          .in('id', tvShowIds)
          .order('popularity', { ascending: false })
          .limit(Math.floor(limit/2)) : Promise.resolve({ data: [] })
      ])
      
      const movies = moviesResult.status === 'fulfilled' ? moviesResult.value : { data: [] }
      const tvShows = tvShowsResult.status === 'fulfilled' ? tvShowsResult.value : { data: [] }
      
      // If language is not English, try to fetch localized content
      let formattedMovies = [];
      let formattedTVShows = [];
      
      // Use only database translations for faster loading
      if (movies.data && movies.data.length > 0) {
        formattedMovies = movies.data.map(movie => ({
          ...movie,
          title: getLocalizedTitle(movie, languageCode) || movie.title,
          overview: getLocalizedOverview(movie, languageCode) || movie.overview,
          content_type: 'movie' as const
        }));
      } else {
        formattedMovies = [];
      }
      
      // Use only database translations for faster loading
      if (tvShows.data && tvShows.data.length > 0) {
        formattedTVShows = tvShows.data.map(show => ({
          ...show,
          title: getLocalizedTitle(show, languageCode) || show.name,
          overview: getLocalizedOverview(show, languageCode) || show.overview,
          content_type: 'tv_show' as const
        }));
      } else {
        formattedTVShows = [];
      }
      
      // Combine and sort by popularity
      return [...formattedMovies, ...formattedTVShows]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);
      
    } catch (error) {
      console.error('Error loading content by provider:', error);
      return [];
    }
  }

  const loadPublicLists = async (limit: number = 6): Promise<any[]> => {
    try {
      console.log(`🔍 Loading public lists with limit: ${limit}`)
      const publicLists = await databaseService.getPublicShareLists('created_at', 'desc', undefined, limit)
      
      // For each list, get preview content
      const listsWithPreview = await Promise.all(
        publicLists.map(async (list) => {
          try {
            // Get list items for preview
            const { data: listItems } = await databaseService.supabase
              .from('share_list_items')
              .select('content_id, content_type')
              .order('order_index', { ascending: true })
              .eq('list_id', list.id)
              .limit(5)
            
            if (!listItems || listItems.length === 0) {
              return { ...list, preview_content: [], item_count: 0 }
            }
            
            // Separate movie and TV show IDs
            const movieIds = listItems
              .filter(item => item.content_type === 'movie')
              .map(item => item.content_id)
            
            const tvShowIds = listItems
              .filter(item => item.content_type === 'tv_show')
              .map(item => item.content_id)
            
            // Fetch content details in parallel
            const [moviesResult, tvShowsResult] = await Promise.allSettled([
              movieIds.length > 0 ? databaseService.supabase
                .from('movies')
                .select('id, title, poster_path')
                .in('id', movieIds) : Promise.resolve({ data: [] }),
              
              tvShowIds.length > 0 ? databaseService.supabase
                .from('tv_shows')
                .select('id, name, poster_path')
                .in('id', tvShowIds) : Promise.resolve({ data: [] })
            ])
            
            const movies = moviesResult.status === 'fulfilled' ? moviesResult.value.data || [] : []
            const tvShows = tvShowsResult.status === 'fulfilled' ? tvShowsResult.value.data || [] : []
            
            // Format content for preview
            const previewContent = [
              ...movies.map(movie => ({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                content_type: 'movie' as const
              })),
              ...tvShows.map(show => ({
                id: show.id,
                title: show.name,
                poster_path: show.poster_path,
                content_type: 'tv_show' as const
              }))
            ]
            
            // Sort by original order from listItems
            const orderedPreview = listItems.map(item => 
              previewContent.find(content => 
                content.id === item.content_id && content.content_type === item.content_type
              )
            ).filter(Boolean)
            
            return {
              ...list,
              preview_content: orderedPreview,
              item_count: listItems.length
            }
            
          } catch (error) {
            console.warn(`Error loading preview for list ${list.id}:`, error)
            return { ...list, preview_content: [], item_count: 0 }
          }
        })
      )
      
      console.log(`✅ Loaded ${listsWithPreview.length} public lists`)
      return listsWithPreview
      
    } catch (error) {
      console.warn('Error loading public lists:', error)
      return []
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    setError(null)
    setRetryCount(prev => prev + 1)
    // Clear TMDB cache before retrying
    tmdbService.clearCache()
    
    try {
      // Add longer delay for network issues
      const delay = Math.min(2000 * retryCount, 10000); // Exponential backoff, max 10s
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      await loadContent()
    } catch (error) {
      console.error('Retry failed:', error);
      setError('Retry failed. This appears to be a network connectivity issue with the preview environment. Please try refreshing the page.');
    } finally {
      setTimeout(() => setIsRetrying(false), 100);
    }
  }

  const loadContent = async () => {
    try {
      setLoading(true)
      setError(null)
      setIsRetrying(false)
      
      console.log(`🔄 Loading homepage content for ${countryCode} in ${languageCode}`)
      
      // Test Supabase connection first
      const isConnected = await testSupabaseConnection()
      if (!isConnected) {
        throw new Error('Database connection failed. Please check your internet connection and try again.')
      }
      
      // Load all content sections in parallel
      const [
        trendingData,
        netflixData,
        disneyData,
        primeData,
        maxData,
        publicListsData
      ] = await Promise.all([
        loadTrendingContent(24),
        loadContentByProvider(8, 12), // Netflix
        loadContentByProvider(337, 12), // Disney+
        loadContentByProvider(119, 12), // Prime Video
        loadContentByProvider(1899, 12), // Max
        loadPublicLists(6)
      ])
      
      console.log(`✅ Loaded content sections:`, {
        trending: trendingData.length,
        netflix: netflixData.length,
        disney: disneyData.length,
        prime: primeData.length,
        max: maxData.length,
        publicLists: publicListsData.length
      })

      setContentSections({
        trending: trendingData,
        netflixContent: netflixData,
        disneyContent: disneyData,
        primeContent: primeData,
        maxContent: maxData,
        publicLists: publicListsData
      })

    } catch (error) {
      console.error('💥 Error loading content:', error)
      let errorMessage = error instanceof Error ? error.message : 'Failed to load content'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Listen for preferences changes
  useEffect(() => {
    const handlePreferencesChanged = (event: any) => {
      console.log('🌐 Preferences changed event received:', event.detail)
      // Reload if country or language changed
      if (event.detail.countryChanged || event.detail.languageChanged) {
        loadContent()
      }
    }

    window.addEventListener('preferencesChanged', handlePreferencesChanged)
    return () => window.removeEventListener('preferencesChanged', handlePreferencesChanged)
  }, [])

  const loadContentByType = async (
    contentType: 'movie' | 'tv_show', 
    limit: number = 20
  ): Promise<ContentItem[]> => {
    try {
      console.log(`🔍 Loading ${contentType} content with language: ${languageCode}`)
      const table = contentType === 'movie' ? 'movies' : 'tv_shows' 
      const dateField = contentType === 'movie' ? 'release_date' : 'first_air_date'
      
      // Get content from database
      const { data } = await databaseService.supabase
        .from(table)
        .select(contentType === 'movie' 
          ? `id, title, overview, ${dateField}, poster_path, backdrop_path,
             vote_average, vote_count, popularity, adult, original_language`
          : `id, name, overview, ${dateField}, poster_path, backdrop_path,
             vote_average, vote_count, popularity, adult, original_language`
        )
        .not('overview', 'is', null)
        .not('poster_path', 'is', null)
        .gte('vote_count', 5)
        .order('popularity', { ascending: false })
        .limit(limit)

      // Filter out specific content if needed
      if (contentType === 'movie' && data) {
        const filteredData = data.filter(movie => 
          !movie.title || (!movie.title.toLowerCase().includes('ballerina') && !movie.title.toLowerCase().includes('barbie'))
        )

        // If language is not English, try to fetch localized descriptions
        if (languageCode !== 'en') {
          console.log(`🌐 Processing localized content for ${filteredData.length} items in ${languageCode}`)
          // For each item, try to get localized content from database first, then TMDB
          const localizedPromises = filteredData.slice(0, 15).map(async (item) => {
            try {
              // First try to get localized content from database translations
              let localizedTitle = getLocalizedTitle(item, languageCode);
              let localizedOverview = getLocalizedOverview(item, languageCode);
              
              // If no database translation, fetch from TMDB
              if (!localizedTitle || localizedTitle === (contentType === 'movie' ? item.title : item.name) || !localizedOverview) {
                const localizedItem = contentType === 'movie' 
                  ? await tmdbService.getMovieDetails(item.id, languageCode)
                  : await tmdbService.getTVShowDetails(item.id, languageCode);
                
                if (localizedItem) {
                  localizedTitle = contentType === 'movie' ? localizedItem.title : localizedItem.name;
                  localizedOverview = localizedItem.overview;
                  console.log(`✅ Got localized content for ${item.id} in ${languageCode}`)
                }
              }
              
              if (localizedTitle || localizedOverview) {
                return {
                  ...item,
                  title: localizedTitle || (contentType === 'movie' ? item.title : item.name),
                  overview: localizedOverview || item.overview
                };
              }
              return item;
            } catch (error) {
              console.warn(`Error fetching localized content for ${item.id}:`, error);
              return item;
            }
          });
          
          // Wait for all localized content to be fetched
          const localizedItems = await Promise.all(localizedPromises);
          const result = localizedItems.map(item => ({
            ...item,
            title: getLocalizedTitle(item, languageCode) || (contentType === 'movie' ? item.title : item.name),
            content_type: contentType,
            hasProviders: false
          }));
          
          // Add remaining items (non-localized)
          const remainingItems = filteredData.slice(10).map(item => ({
            ...item,
            title: getLocalizedTitle(item, languageCode) || (contentType === 'movie' ? item.title : item.name),
            content_type: contentType,
            hasProviders: false
          }));
          
          return [...result, ...remainingItems];
        }

        const remainingItems = filteredData.slice(15).map(item => ({
          ...item,
          title: getLocalizedTitle(item, languageCode) || (contentType === 'movie' ? item.title : item.name),
          content_type: contentType,
          hasProviders: false
        }));
      }
      
      // Default return if no movie-specific filtering
      return data?.map(item => ({
        ...item,
        title: getLocalizedTitle(item, languageCode) || (contentType === 'movie' ? item.title : item.name),
        content_type: contentType,
        hasProviders: false
      })) || [];
    } catch (error) {
      console.warn(`Error loading ${contentType} content:`, error)
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network'))) {
        throw error // Re-throw network errors to be handled by parent
      }
      return []
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

  const handleWatchlistStatusChange = async (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user) return
    
    try {
      if (status === null) {
        // Remove from watchlist
        await databaseService.removeFromWatchlist(user.id, contentId, contentType)
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.delete(contentId)
          return newMap
        })
      } else {
        // Add to watchlist with specified status
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

  // Handle share list toggle
  const handleShareListToggle = (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    // Open share list modal
    setSelectedContentForShareList(contentId)
    setSelectedContentTypeForShareList(contentType)
    setShowShareListModal(true)
  }

  // Load content when preferences are ready
  useEffect(() => {
    if (!preferencesLoading && countryCode && languageCode) {
      loadContent()
      loadUserWatchlist()
    }
  }, [countryCode, languageCode, preferencesLoading, user])

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-red-400 mb-4">
              Content Loading Error
            </h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {isRetrying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Retrying...
                </>
              ) : (
                <>🔄 Retry Loading</>
              )}
            </button>
            {retryCount > 0 && (
              <p className="text-gray-400 text-sm mt-2">
                Retry attempt: {retryCount}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">

      {/* AI Discovery Assistant - Collapsible Header */}
      <div className="px-3 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={openAIChat}
            className="w-full bg-gradient-to-r from-purple-800/40 to-blue-800/40 backdrop-blur-md hover:from-purple-800/60 hover:to-blue-800/60 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl border border-purple-500/30 p-4 sm:p-5 flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg shrink-0 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white leading-tight mb-1">
                  <span className="hidden sm:inline">
                    {languageCode === 'tr' ? 'TVSHOWup AI Keşif Asistanı' :
                     languageCode === 'de' ? 'TVSHOWup KI-Entdeckungsassistent' :
                     languageCode === 'fr' ? 'Assistant de Découverte IA TVSHOWup' :
                     languageCode === 'es' ? 'Asistente de Descubrimiento IA TVSHOWup' :
                     languageCode === 'it' ? 'Assistente di Scoperta IA TVSHOWup' :
                     'TVSHOWup AI Discovery Assistant'}
                  </span>
                  <span className="sm:hidden">
                    {languageCode === 'tr' ? 'TVSHOWup AI Keşif' :
                     languageCode === 'de' ? 'TVSHOWup KI-Entdeckung' :
                     languageCode === 'fr' ? 'Découverte IA TVSHOWup' :
                     languageCode === 'es' ? 'Descubrimiento IA TVSHOWup' :
                     languageCode === 'it' ? 'Scoperta IA TVSHOWup' :
                     'TVSHOWup AI Discovery'}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-300">
                  {languageCode === 'tr' ? 'AI ile mükemmel içerik keşfedin' :
                   languageCode === 'de' ? 'Entdecken Sie perfekte Inhalte mit KI' :
                   languageCode === 'fr' ? 'Découvrez du contenu parfait avec l\'IA' :
                   languageCode === 'es' ? 'Descubre contenido perfecto con IA' :
                   languageCode === 'it' ? 'Scopri contenuti perfetti con l\'IA' :
                   'Discover perfect content with AI'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs sm:text-sm text-purple-300 hidden sm:inline">
                {languageCode === 'tr' ? 'Tıkla' :
                 languageCode === 'de' ? 'Klicken' :
                 languageCode === 'fr' ? 'Cliquez' :
                 languageCode === 'es' ? 'Haga clic' :
                 languageCode === 'it' ? 'Clicca' :
                 'Click'}
              </span>
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Intro Section */}
      <IntroSection />

      {/* AI Chat Full Screen Modal */}
      {showAIChat && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm">
          <div className="w-full h-full flex flex-col">
            <AIChatDiscovery onClose={closeAIChat} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pb-8 pt-6 sm:pt-8">
        <div className="space-y-8">
          {/* Trending Section */}
          {contentSections.trending.length > 0 && (
            <HorizontalContentRow
              title={t.trendingNow}
              content={contentSections.trending}
              onWatchlistStatusChange={handleWatchlistStatusChange}
              userWatchlistMap={userWatchlistMap}
              loading={loading}
              onAuthRequired={() => openAuthPrompt('watchlist')}
              onShareListToggle={handleShareListToggle}
              shareListMap={new Map()} // Empty map since we're using modal
            />
          )}
          
          {/* Max Content Section */}
          {contentSections.maxContent.length > 0 && (
            <div className="py-6 bg-gradient-to-r from-gray-800/70 to-transparent rounded-xl mx-4 sm:mx-6 lg:mx-8 mb-8">
              <HorizontalContentRow
                title={t.maxBest}
                content={contentSections.maxContent}
                onWatchlistStatusChange={handleWatchlistStatusChange}
                userWatchlistMap={userWatchlistMap}
                loading={loading}
                onAuthRequired={() => openAuthPrompt('watchlist')}
                isHighlighted={true}
                onShareListToggle={handleShareListToggle}
                shareListMap={new Map()} // Empty map since we're using modal
              />
            </div>
          )}

          {/* Netflix Content Section */}
          {contentSections.netflixContent.length > 0 && (
            <div className="py-6 bg-gradient-to-r from-red-600/30 to-transparent rounded-xl mx-4 sm:mx-6 lg:mx-8 mb-8">
              <HorizontalContentRow
                title={t.netflixPopular}
                content={contentSections.netflixContent}
                onWatchlistStatusChange={handleWatchlistStatusChange}
                userWatchlistMap={userWatchlistMap}
                loading={loading}
                onAuthRequired={() => openAuthPrompt('watchlist')}
                isHighlighted={true}
                onShareListToggle={handleShareListToggle}
                shareListMap={new Map()} // Empty map since we're using modal
              />
            </div>
          )}

          {/* Disney+ Content Section */}
          {contentSections.disneyContent.length > 0 && (
            <div className="py-6 bg-gradient-to-r from-blue-900/30 to-transparent rounded-xl mx-4 sm:mx-6 lg:mx-8 mb-8">
              <HorizontalContentRow
                title={t.disneyPicks}
                content={contentSections.disneyContent}
                onWatchlistStatusChange={handleWatchlistStatusChange}
                userWatchlistMap={userWatchlistMap}
                loading={loading}
                onAuthRequired={() => openAuthPrompt('watchlist')}
                isHighlighted={true}
                onShareListToggle={handleShareListToggle}
                shareListMap={new Map()} // Empty map since we're using modal
              />
            </div>
          )}

          {/* Prime Video Content Section */}
          {contentSections.primeContent.length > 0 && (
            <div className="py-6 bg-gradient-to-r from-blue-500/30 to-transparent rounded-xl mx-4 sm:mx-6 lg:mx-8 mb-8">
              <HorizontalContentRow
                title={t.primeDiscover}
                content={contentSections.primeContent}
                onWatchlistStatusChange={handleWatchlistStatusChange}
                userWatchlistMap={userWatchlistMap}
                loading={loading}
                onAuthRequired={() => openAuthPrompt('watchlist')}
                isHighlighted={true}
                onShareListToggle={handleShareListToggle}
                shareListMap={new Map()} // Empty map since we're using modal
              />
            </div>
          )}
          
          {/* Public Lists Section */}
          {contentSections.publicLists && contentSections.publicLists.length > 0 && (
            <div className="px-3 sm:px-6 lg:px-8">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {languageCode === 'tr' ? 'Topluluk Listeleri' :
                     languageCode === 'de' ? 'Community-Listen' :
                     languageCode === 'fr' ? 'Listes de la communauté' :
                     languageCode === 'es' ? 'Listas de la comunidad' :
                     languageCode === 'it' ? 'Liste della community' :
                     'Community Lists'}
                  </h2>
                  <Link 
                    to="/discover-lists"
                    className="text-primary-400 hover:text-primary-300 text-sm flex items-center"
                  >
                    {languageCode === 'tr' ? 'Tümünü Gör' :
                     languageCode === 'de' ? 'Alle anzeigen' :
                     languageCode === 'fr' ? 'Voir tout' :
                     languageCode === 'es' ? 'Ver todo' :
                     languageCode === 'it' ? 'Vedi tutti' :
                     'See All'}
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {(contentSections.publicLists || []).map((list) => (
                    <Link
                      key={list.id}
                      to={`/${languageCode}/u/${list.user_display_name}/my-suggestion-lists`}
                      className="bg-gray-800 rounded-lg p-4 sm:p-6 hover:bg-gray-700/50 transition-colors group overflow-hidden"
                    >
                      {/* Content Preview Section */}
                      {list.preview_content && list.preview_content.length > 0 && (
                        <div className="mb-4">
                          <div className="flex space-x-2 overflow-hidden">
                            {list.preview_content.slice(0, 5).map((content, index) => (
                              <div 
                                key={`${content.content_type}-${content.id}`}
                                className="flex-shrink-0 w-12 h-16 bg-gray-700 rounded-sm overflow-hidden"
                                style={{ zIndex: 5 - index }}
                              >
                                <img
                                  src={content.poster_path 
                                    ? tmdbService.getImageUrl(content.poster_path, 'w154')
                                    : '/placeholder-poster.jpg'
                                  }
                                  alt={content.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder-poster.jpg'
                                  }}
                                />
                              </div>
                            ))}
                            {list.item_count && list.item_count > 5 && (
                              <div className="flex-shrink-0 w-12 h-16 bg-gray-600 rounded-sm flex items-center justify-center">
                                <span className="text-white text-xs font-medium">
                                  +{list.item_count - 5}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* List Info */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 mr-2">
                          <h3 className="text-lg font-bold text-white line-clamp-2 group-hover:text-primary-400 transition-colors mb-1">
                            {getLocalizedListName(list, languageCode)}
                          </h3>
                        </div>
                      </div>

                      {getLocalizedListDescription(list, languageCode) && (
                        <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                          {getLocalizedListDescription(list, languageCode)}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-gray-400 text-sm">
                        <div className="flex items-center space-x-4">
                          {list.user_display_name && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{list.user_display_name}</span>
                            </div>
                          )}
                          
                          {list.item_count !== undefined && (
                            <div className="flex items-center">
                              {/* Item count hidden */}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {!loading && Object.values(contentSections).every(section => section.length === 0) && (
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="max-w-7xl mx-auto">
                <div className="text-center py-12">
                  <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-white mb-4">
                      No Content Available
                    </h3>
                    <p className="text-gray-400 mb-6">
                      No content found. Please import content to get started.
                    </p>
                    <button
                      onClick={handleRetry}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Share List Modal */}
      <ShareListSelectModal
        isOpen={showShareListModal}
        onClose={() => {
          setShowShareListModal(false)
          setSelectedContentForShareList(null)
          setSelectedContentTypeForShareList(null)
        }}
        contentId={selectedContentForShareList || 0}
        contentType={selectedContentTypeForShareList || 'movie'}
      />
    </div>
  )
}

export default HomePage
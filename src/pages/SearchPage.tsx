import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ContentGrid from '../components/ContentGrid'
import GenreFilterSection from '../components/GenreFilterSection'
import { ContentItem, databaseService } from '../lib/database'
import { tmdbService } from '../lib/tmdb'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useTranslation } from '../lib/i18n'
import { useAuth } from '../contexts/AuthContext'
import ShareListSelectModal from '../components/ShareListSelectModal'
import { createSEOSlug } from '../lib/utils'

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { countryCode, languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const [searchResults, setSearchResults] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  const [savingContent, setSavingContent] = useState<Set<string>>(new Set())
  
  // Reset watchlist map when user logs out
  useEffect(() => {
    if (!user) {
      setUserWatchlistMap(new Map());
    }
  }, [user]);

  const query = searchParams.get('q') || ''
  const genreId = searchParams.get('genre') || ''
  const genreName = searchParams.get('genreName') || ''
  const providerId = searchParams.get('provider') || ''
  const providerName = searchParams.get('providerName') || ''
  const viewMode = searchParams.get('view') || ''
  


  // Listen for preferences changes
  useEffect(() => {
    const handlePreferencesChanged = (event: any) => {
      console.log('🌐 Preferences changed event received in SearchPage:', event.detail);
      // Reload if country or language changed and we have an active search
      if ((event.detail.countryChanged || event.detail.languageChanged) && (query || genreId || providerId)) {
        console.log('🔄 Language changed, refreshing search results...');
        searchContent(query);
      }
    };
    
    window.addEventListener('preferencesChanged', handlePreferencesChanged);
    
    return () => {
      window.removeEventListener('preferencesChanged', handlePreferencesChanged);
    };
  }, [query, genreId, providerId, languageCode]);

  useEffect(() => {
    if (query || genreId || providerId) {
      searchContent(query)
    }
  }, [query, genreId, providerId, countryCode, languageCode])

  useEffect(() => {
    if (user) {
      loadUserWatchlist()
    }
  }, [user])

  const searchContent = async (searchQuery: string) => {
    try {
      setLoading(true)

      // If searching by provider
      if (providerId && !searchQuery && !genreId) {
        console.log(`🔍 Searching for provider ID ${providerId} in ${languageCode} for ${countryCode}`)
        
        // Get content by provider
        const providerResults = await searchContentByProvider(parseInt(providerId))
        setSearchResults(providerResults)
        return
      }
      
      // If searching by genre
      if (genreId && !searchQuery && !providerId) {
        console.log(`🔍 Searching for genre ID ${genreId} in ${languageCode} for ${countryCode}`)
        
        // Get content by genre
        const genreResults = await searchContentByGenre(parseInt(genreId))
        setSearchResults(genreResults)
        return
      }
      
      console.log(`🔍 Searching for "${searchQuery}" in ${languageCode} for ${countryCode}`)
      
      // Always search TMDB for fresh and comprehensive results
      console.log(`🌐 Searching TMDB for "${searchQuery}" in ${languageCode}`)
      const tmdbResults = await tmdbService.searchMulti(searchQuery, 1, languageCode, countryCode)
      
      if (!tmdbResults || !tmdbResults.results) {
        setSearchResults([])
        return
      }
      
      const formattedResults: ContentItem[] = []
      
      // Process TMDB results
      const validResults = tmdbResults.results.filter(item => 
        (item.media_type === 'movie' || item.media_type === 'tv') && 
        (item.title || item.name) &&
        item.id
      )
      
      for (const item of validResults.slice(0, 24)) {
        if (item.media_type === 'movie' || item.media_type === 'tv') {
          const contentType = item.media_type === 'movie' ? 'movie' : 'tv_show'
          const originalTitle = item.media_type === 'movie'
            ? (item.original_title || item.title)
            : (item.original_name || item.name)

          formattedResults.push({
            id: item.id,
            title: item.title || item.name,
            original_title: item.media_type === 'movie' ? originalTitle : undefined,
            original_name: item.media_type === 'tv' ? originalTitle : undefined,
            slug: createSEOSlug(item.id, originalTitle, originalTitle),
            overview: item.overview || '',
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
            popularity: item.popularity || 0,
            adult: item.adult || false,
            original_language: item.original_language,
            release_date: item.release_date,
            first_air_date: item.first_air_date,
            content_type: contentType,
            hasProviders: true // All TMDB results are considered valid
          })
        }
      }
      
      // Sort results by relevance (same criteria as SearchDropdown)
      const sortedResults = formattedResults.sort((a, b) => {
        // Exact matches first
        const aExact = a.title.toLowerCase() === searchQuery.toLowerCase()
        const bExact = b.title.toLowerCase() === searchQuery.toLowerCase()
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Title starts with query
        const aStarts = a.title.toLowerCase().startsWith(searchQuery.toLowerCase())
        const bStarts = b.title.toLowerCase().startsWith(searchQuery.toLowerCase())
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        
        // Quality score (vote average for content with enough votes)
        if (a.vote_count >= 100 && b.vote_count >= 100) {
          if (Math.abs(a.vote_average - b.vote_average) > 0.5) {
            return b.vote_average - a.vote_average
          }
        }
        
        return b.popularity - a.popularity
      })
      
      setSearchResults(sortedResults)
    } catch (error) {
      console.error('Error searching content:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  // New function to search content by genre
  const searchContentByGenre = async (genreId: number): Promise<ContentItem[]> => {
    try {
      // First try to get movies with this genre
      const { data: movies } = await databaseService.supabase
        .from('movies')
        .select('*')
        .order('popularity', { ascending: false })
        .limit(50)
      
      // Then try to get TV shows with this genre
      const { data: tvShows } = await databaseService.supabase
        .from('tv_shows')
        .select('*')
        .order('popularity', { ascending: false })
        .limit(50)
      
      // Filter content that has the specified genre
      const filteredMovies = (movies || []).filter(movie => {
        try {
          const genres = typeof movie.genres === 'string' 
            ? JSON.parse(movie.genres) 
            : movie.genres;
          
          return genres && genres.some((g: any) => g.id === genreId);
        } catch (e) {
          return false;
        }
      }).map(movie => ({
        ...movie,
        title: getLocalizedTitle(movie, languageCode) || movie.title,
        content_type: 'movie' as const
      }));
      
      const filteredTVShows = (tvShows || []).filter(show => {
        try {
          const genres = typeof show.genres === 'string' 
            ? JSON.parse(show.genres) 
            : show.genres;
          
          return genres && genres.some((g: any) => g.id === genreId);
        } catch (e) {
          return false;
        }
      }).map(show => ({
        ...show,
        title: getLocalizedTitle(show, languageCode) || show.name,
        content_type: 'tv_show' as const
      }));
      
      // Combine and sort by popularity
      return [...filteredMovies, ...filteredTVShows]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 24);
      
    } catch (error) {
      console.error('Error searching by genre:', error);
      return [];
    }
  };

  // New function to search content by provider
  const searchContentByProvider = async (providerId: number): Promise<ContentItem[]> => {
    try {
      console.log(`🔍 Searching content by provider ${providerId} for country ${countryCode}`)
      
      // Get content providers for this provider
      const { data: contentProviders } = await databaseService.supabase
        .from('content_providers')
        .select('content_id, content_type')
        .eq('provider_id', providerId)
        .eq('country_code', countryCode)
        .limit(100);
      
      console.log(`📊 Found ${contentProviders?.length || 0} content items for provider ${providerId} in ${countryCode}`)
      
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
      const [movies, tvShows] = await Promise.all([
        movieIds.length > 0 ? databaseService.supabase
          .from('movies')
          .select('*')
          .in('id', movieIds)
          .order('popularity', { ascending: false })
          .limit(50) : { data: [] },
        
        tvShowIds.length > 0 ? databaseService.supabase
          .from('tv_shows')
          .select('*')
          .in('id', tvShowIds)
          .order('popularity', { ascending: false })
          .limit(50) : { data: [] }
      ]);
      
      // Format movies
      const formattedMovies = (movies.data || []).map(movie => ({
        ...movie,
        title: getLocalizedTitle(movie, languageCode) || movie.title,
        content_type: 'movie' as const
      }));
      
      // Format TV shows
      const formattedTVShows = (tvShows.data || []).map(show => ({
        ...show,
        title: getLocalizedTitle(show, languageCode) || show.name,
        content_type: 'tv_show' as const
      }));
      
      // Combine and sort by popularity
      return [...formattedMovies, ...formattedTVShows]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 24);
      
    } catch (error) {
      console.error('Error searching by provider:', error);
      return [];
    }
  };

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
    
    // First, ensure the content exists in the database
    const contentKey = `${contentType}-${contentId}`
    if (!savingContent.has(contentKey)) {
      setSavingContent(prev => new Set(prev).add(contentKey))
      
      try {
        // Check if content exists in database
        const existingContent = await databaseService.getContentById(contentId, contentType)
        
        if (!existingContent) {
          console.log(`💾 Content not in database, saving ${contentType} ${contentId}...`)
          await saveContentToDatabase(contentId, contentType)
        }
      } catch (error) {
        console.error(`Error ensuring content exists: ${error}`)
      } finally {
        setSavingContent(prev => {
          const newSet = new Set(prev)
          newSet.delete(contentKey)
          return newSet
        })
      }
    }
    
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
      
      // Reload watchlist to get updated statuses
      loadUserWatchlist()
    } catch (error) {
      console.error('Error updating watchlist:', error)
    }
  }
  
  // Save TMDB content to database
  const saveContentToDatabase = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      // Use edge function to save content with proper permissions and provider sync
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-tmdb-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save-content',
          contentId: contentId,
          contentType: contentType,
          languageCode: languageCode,
          countryCode: countryCode,
          tmdbApiKey: import.meta.env.VITE_TMDB_API_KEY
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save content');
      }
      
      const result = await response.json();
      console.log(`✅ Saved ${contentType} ${contentId} via edge function:`, result);
      
      // Also sync watch providers
      await syncWatchProviders(contentId, contentType);
      
    } catch (error) {
      console.error(`❌ Error saving ${contentType} ${contentId}:`, error)
      throw error
    }
  }
  
  // Sync watch providers for content using edge function
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

  const movies = searchResults.filter(item => item.content_type === 'movie')
  const tvShows = searchResults.filter(item => item.content_type === 'tv_show')

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 px-3 sm:px-0">
            {providerId
              ? (providerName 
                  ? `${providerName} ${languageCode === 'tr' ? 'İçerikleri' : 'Content'}`
                  : (languageCode === 'tr' ? 'Platform Araması' : 'Platform Search'))
              : genreId 
              ? (genreName 
                  ? `${genreName} ${languageCode === 'tr' ? 'İçerikleri' : 'Content'}`
                  : (languageCode === 'tr' ? 'Tür Araması' : 'Genre Search'))
              : viewMode === 'genres'
                ? (languageCode === 'tr' ? 'Tüm Türler' : 'All Genres')
                : viewMode === 'providers'
                ? (languageCode === 'tr' ? 'Tüm Platformlar' : 'All Platforms')
                : t.searchResults}
          </h1>
          {query && (
            <p className="text-gray-400 px-3 sm:px-0">
              {loading 
                ? t.loading
                : (languageCode === 'tr' 
                    ? `"${query}" için ${searchResults.length} sonuç bulundu`
                    : `Found ${searchResults.length} results for "${query}"`
                  )
              }
            </p>
          )}
          {genreId && genreName && (
            <p className="text-gray-400 px-3 sm:px-0">
              {loading 
                ? (languageCode === 'tr' ? 'İçerikler yükleniyor...' : 'Loading content...') 
                : (languageCode === 'tr' 
                    ? `${searchResults.length} içerik bulundu`
                    : `Found ${searchResults.length} items`
                  )
              }
            </p>
          )}
          {providerId && providerName && (
            <p className="text-gray-400 px-3 sm:px-0">
              {loading 
                ? (languageCode === 'tr' ? 'İçerikler yükleniyor...' : 'Loading content...') 
                : (languageCode === 'tr' 
                    ? `${searchResults.length} içerik bulundu`
                    : `Found ${searchResults.length} items`
                  )
              }
            </p>
          )}
        </div>

        {!query && !genreId && (
          <div className="text-center py-12 text-gray-400">
            <p>
              {languageCode === 'tr' 
                ? 'Film ve dizi bulmak için arama yapın'
                : 'Enter a search query to find movies and TV shows'
              }
            </p>
          </div>
        )}

        {(query || genreId) && !loading && searchResults.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>
              {genreId
                ? (languageCode === 'tr' 
                    ? `Bu türde içerik bulunamadı`
                    : `No content found for this genre`)
                : (languageCode === 'tr' 
                    ? `"${query}" için sonuç bulunamadı`
                    : `No results found for "${query}"`)
              }
            </p>
            <p className="mt-2">
              {languageCode === 'tr'
                ? 'Farklı anahtar kelimeler deneyin veya yazımınızı kontrol edin'
                : 'Try different keywords or check your spelling'
              }
            </p>
          </div>
        )}

        {movies.length > 0 && (
          <ContentGrid
            title={t.movies}
            content={movies}
            loading={loading}
            onWatchlistStatusChange={handleWatchlistStatusChange}
            userWatchlistMap={userWatchlistMap}
            onAuthRequired={() => openAuthPrompt('watchlist')}
          />
        )}

        {tvShows.length > 0 && (
          <ContentGrid
            title={t.tvShows}
            content={tvShows}
            loading={loading}
            onWatchlistStatusChange={handleWatchlistStatusChange}
            userWatchlistMap={userWatchlistMap}
            onAuthRequired={() => openAuthPrompt('watchlist')}
          />
        )}
      </div>
    </div>
  )
}

export default SearchPage
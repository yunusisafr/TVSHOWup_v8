const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

// Cache duration in milliseconds (30 minutes)
const CACHE_DURATION_MS = 30 * 60 * 1000

export interface TMDBMovie {
  id: number
  imdb_id?: string
  title: string
  original_title: string
  overview: string
  release_date: string
  runtime?: number
  status?: string
  tagline?: string
  adult: boolean
  budget?: number
  revenue?: number
  popularity: number
  vote_average: number
  vote_count: number
  poster_path?: string
  backdrop_path?: string
  original_language: string
  homepage?: string
  video: boolean
  belongs_to_collection?: any
  genres: Array<{ id: number; name: string }>
  keywords?: { keywords: Array<{ id: number; name: string }> }
  production_companies: Array<{ id: number; name: string; logo_path?: string; origin_country: string }>
  production_countries: Array<{ iso_3166_1: string; name: string }>
  spoken_languages: Array<{ iso_639_1: string; english_name: string; name: string }>
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  last_air_date?: string
  status?: string
  type?: string
  tagline?: string
  adult: boolean
  popularity: number
  vote_average: number
  vote_count: number
  poster_path?: string
  backdrop_path?: string
  original_language: string
  homepage?: string
  in_production: boolean
  number_of_episodes: number
  number_of_seasons: number
  episode_run_time: number[]
  origin_country: string[]
  created_by: Array<{ id: number; name: string; profile_path?: string }>
  genres: Array<{ id: number; name: string }>
  keywords?: { results: Array<{ id: number; name: string }> }
  languages: string[]
  last_episode_to_air?: any
  next_episode_to_air?: any
  networks: Array<{ id: number; name: string; logo_path?: string; origin_country: string }>
  production_companies: Array<{ id: number; name: string; logo_path?: string; origin_country: string }>
  production_countries: Array<{ iso_3166_1: string; name: string }>
  seasons: Array<{ 
    id: number
    name: string
    overview: string
    poster_path?: string
    season_number: number
    episode_count: number
    air_date?: string
  }>
  spoken_languages: Array<{ iso_639_1: string; english_name: string; name: string }>
}

export interface TMDBProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export interface TMDBWatchProvider {
  results: {
    [countryCode: string]: {
      link: string
      flatrate?: TMDBProvider[]
      buy?: TMDBProvider[]
      rent?: TMDBProvider[]
      ads?: TMDBProvider[]
    }
  }
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path?: string
  order: number
  gender?: number
  known_for_department?: string
}

export interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path?: string
  gender?: number
  known_for_department?: string
}

export interface TMDBCredits {
  cast: TMDBCastMember[]
  crew: TMDBCrewMember[]
}

export interface TMDBCountry {
  iso_3166_1: string
  english_name: string
  native_name?: string
}

export interface TMDBLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

export interface TMDBSearchResult {
  page: number
  results: Array<{
    id: number
    media_type: 'movie' | 'tv' | 'person'
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    overview: string
    poster_path?: string
    backdrop_path?: string
    vote_average: number
    vote_count: number
    popularity: number
    adult: boolean
    original_language: string
    release_date?: string
    first_air_date?: string
    genre_ids: number[]
    video?: boolean
    origin_country?: string[]
  }>
  total_pages: number
  total_results: number
}

class TMDBService {
  // In-memory cache for API responses
  private apiCache: Map<string, { data: any, timestamp: number }> = new Map()

  private async fetchFromTMDB(endpoint: string): Promise<any> {
    if (!TMDB_API_KEY) {
      throw new Error('TMDB API key is not configured')
    }

    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`
    
    // Create a cache key from the endpoint
    const cacheKey = endpoint
    
    // Check if we have a cached response and it's still valid
    const cachedResponse = this.apiCache.get(cacheKey)
    if (cachedResponse) {
      const now = Date.now()
      if (now - cachedResponse.timestamp < CACHE_DURATION_MS) {
        console.log(`🔄 Using cached TMDB data for: ${endpoint}`)
        return cachedResponse.data
      } else {
        // Cache expired, remove it
        this.apiCache.delete(cacheKey)
      }
    }
    
    console.log(`🌐 TMDB API Request: ${endpoint}`)
    
    // Add retry logic for network issues
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 TMDB API attempt ${attempt}/3 for: ${endpoint}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MovieApp/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ TMDB API Response: ${endpoint} - Success`);
        
        // Cache the response with current timestamp
        this.apiCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        return data;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ TMDB API attempt ${attempt} failed for ${endpoint}:`, error);
        
        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('403')) {
            throw error; // Don't retry auth errors
          }
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    console.error(`❌ All TMDB API attempts failed for ${endpoint}:`, lastError);
    throw lastError || new Error('TMDB API request failed after all retries');
  }

  // Get all countries
  async getCountries(): Promise<TMDBCountry[]> {
    return this.fetchFromTMDB('/configuration/countries')
  }

  // Get all languages
  async getLanguages(): Promise<TMDBLanguage[]> {
    return this.fetchFromTMDB('/configuration/languages')
  }

  // Get trending movies and TV shows
  async getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week', language: string = 'en') {
    return this.fetchFromTMDB(`/trending/${mediaType}/${timeWindow}?language=${language}`)
  }

  // Get trending movies with pagination
  async getTrendingMovies(page: number = 1, timeWindow: 'day' | 'week' = 'week', language: string = 'en') {
    return this.fetchFromTMDB(`/trending/movie/${timeWindow}?page=${page}&language=${language}`)
  }

  // Get trending TV shows with pagination
  async getTrendingTVShows(page: number = 1, timeWindow: 'day' | 'week' = 'week', language: string = 'en') {
    return this.fetchFromTMDB(`/trending/tv/${timeWindow}?page=${page}&language=${language}`)
  }

  // Discover TV shows by country and popularity
  async discoverTVShows(options: {
    page?: number
    region?: string
    language?: string
    sortBy?: 'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc'
    withWatchProviders?: string
    watchRegion?: string
    voteCountGte?: number
    firstAirDateGte?: string
    firstAirDateLte?: string
    withGenres?: string
    voteAverageGte?: number
  } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      sort_by: options.sortBy || 'popularity.desc',
      ...(options.region && { region: options.region }),
      ...(options.language && { language: options.language }),
      ...(options.withWatchProviders && { with_watch_providers: options.withWatchProviders }),
      ...(options.watchRegion && { watch_region: options.watchRegion }),
      ...(options.voteCountGte && { 'vote_count.gte': options.voteCountGte.toString() }),
      ...(options.firstAirDateGte && { 'first_air_date.gte': options.firstAirDateGte }),
      ...(options.firstAirDateLte && { 'first_air_date.lte': options.firstAirDateLte }),
      ...(options.withGenres && { with_genres: options.withGenres }),
      ...(options.voteAverageGte && { 'vote_average.gte': options.voteAverageGte.toString() })
    })
    
    return this.fetchFromTMDB(`/discover/tv?${params}`)
  }

  // Discover movies by country and popularity
  async discoverMovies(options: {
    page?: number
    region?: string
    language?: string
    sortBy?: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc'
    withWatchProviders?: string
    watchRegion?: string
    voteCountGte?: number
    releaseDateGte?: string
    releaseDateLte?: string
    withGenres?: string
    voteAverageGte?: number
  } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      sort_by: options.sortBy || 'popularity.desc',
      ...(options.region && { region: options.region }),
      ...(options.language && { language: options.language }),
      ...(options.withWatchProviders && { with_watch_providers: options.withWatchProviders }),
      ...(options.watchRegion && { watch_region: options.watchRegion }),
      ...(options.voteCountGte && { 'vote_count.gte': options.voteCountGte.toString() }),
      ...(options.releaseDateGte && { 'release_date.gte': options.releaseDateGte }),
      ...(options.releaseDateLte && { 'release_date.lte': options.releaseDateLte }),
      ...(options.withGenres && { with_genres: options.withGenres }),
      ...(options.voteAverageGte && { 'vote_average.gte': options.voteAverageGte.toString() })
    })
    
    return this.fetchFromTMDB(`/discover/movie?${params}`)
  }

  // Get popular movies
  async getPopularMovies(page: number = 1, region?: string, language: string = 'en') {
    const params = new URLSearchParams({
      page: page.toString(),
      language,
      ...(region && { region })
    })
    return this.fetchFromTMDB(`/movie/popular?${params}`)
  }

  // Get popular TV shows
  async getPopularTVShows(page: number = 1, language: string = 'en') {
    return this.fetchFromTMDB(`/tv/popular?page=${page}&language=${language}`)
  }

  // Get movie details with all additional data
  async getMovieDetails(id: number, language: string = 'en', appendToResponse?: string): Promise<TMDBMovie> {
    const params = new URLSearchParams({ 
      language,
      append_to_response: appendToResponse || 'keywords,credits,watch/providers,videos,images,reviews,similar,recommendations'
    })
    return this.fetchFromTMDB(`/movie/${id}?${params}`)
  }

  // Get TV show details with all additional data
  async getTVShowDetails(id: number, language: string = 'en', appendToResponse?: string): Promise<TMDBTVShow> {
    const params = new URLSearchParams({
      language,
      append_to_response: appendToResponse || 'keywords,credits,watch/providers,videos,images,reviews,similar,recommendations'
    })
    return this.fetchFromTMDB(`/tv/${id}?${params}`)
  }

  // Get movie credits (cast and crew)
  async getMovieCredits(id: number, language: string = 'en'): Promise<TMDBCredits> {
    return this.fetchFromTMDB(`/movie/${id}/credits?language=${language}`)
  }

  // Get TV show credits (cast and crew)
  async getTVShowCredits(id: number, language: string = 'en'): Promise<TMDBCredits> {
    return this.fetchFromTMDB(`/tv/${id}/credits?language=${language}`)
  }

  // Get watch providers for a movie
  async getMovieWatchProviders(id: number): Promise<TMDBWatchProvider> {
    return this.fetchFromTMDB(`/movie/${id}/watch/providers`)
  }

  // Get watch providers for a TV show
  async getTVShowWatchProviders(id: number): Promise<TMDBWatchProvider> {
    return this.fetchFromTMDB(`/tv/${id}/watch/providers`)
  }

  // Search movies and TV shows
  async searchMulti(query: string, page: number = 1, language: string = 'en', region?: string): Promise<TMDBSearchResult> {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      page: page.toString(),
      language,
      include_adult: 'false',
      ...(region && { region })
    })
    return this.fetchFromTMDB(`/search/multi?${params}`)
  }

  // Search movies
  async searchMovies(query: string, page: number = 1, language: string = 'en', region?: string) {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      page: page.toString(),
      language,
      include_adult: 'false',
      ...(region && { region })
    })
    return this.fetchFromTMDB(`/search/movie?${params}`)
  }

  // Search TV shows
  async searchTVShows(query: string, page: number = 1, language: string = 'en') {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      page: page.toString(),
      language,
      include_adult: 'false'
    })
    return this.fetchFromTMDB(`/search/tv?${params}`)
  }

  // Enhanced search with filters
  async searchWithFilters(options: {
    query: string
    page?: number
    language?: string
    region?: string
    year?: number
    primaryReleaseYear?: number
    includeAdult?: boolean
  }): Promise<TMDBSearchResult> {
    const params = new URLSearchParams({
      query: encodeURIComponent(options.query),
      page: (options.page || 1).toString(),
      language: options.language || 'en',
      include_adult: (options.includeAdult || false).toString(),
      ...(options.region && { region: options.region }),
      ...(options.year && { year: options.year.toString() }),
      ...(options.primaryReleaseYear && { primary_release_year: options.primaryReleaseYear.toString() })
    })
    return this.fetchFromTMDB(`/search/multi?${params}`)
  }

  // Get trending content with enhanced options
  async getTrendingEnhanced(options: {
    mediaType?: 'movie' | 'tv' | 'all'
    timeWindow?: 'day' | 'week'
    language?: string
    region?: string
    page?: number
  } = {}) {
    const {
      mediaType = 'all',
      timeWindow = 'week',
      language = 'en',
      region,
      page = 1
    } = options

    const params = new URLSearchParams({
      language,
      page: page.toString(),
      ...(region && { region })
    })

    return this.fetchFromTMDB(`/trending/${mediaType}/${timeWindow}?${params}`)
  }

  // Get all available watch providers for movies
  async getAvailableProviders(language: string = 'en') {
    return this.fetchFromTMDB(`/watch/providers/movie?language=${language}`)
  }

  // Get all available watch providers for TV shows
  async getAvailableTVProviders(language: string = 'en') {
    return this.fetchFromTMDB(`/watch/providers/tv?language=${language}`)
  }

  // Get available providers for a specific region (movie)
  async getAvailableProvidersForRegion(region: string, language: string = 'en') {
    return this.fetchFromTMDB(`/watch/providers/movie?language=${language}&watch_region=${region}`)
  }

  // Get available TV providers for a specific region
  async getAvailableTVProvidersForRegion(region: string, language: string = 'en') {
    return this.fetchFromTMDB(`/watch/providers/tv?language=${language}&watch_region=${region}`)
  }

  // Get comprehensive streaming services (both providers and networks)
  // Get movie videos (trailers, teasers, etc.)
  async getMovieVideos(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/movie/${id}/videos?language=${language}`)
  }

  // Get TV show videos
  async getTVShowVideos(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/tv/${id}/videos?language=${language}`)
  }

  // Get movie images (posters, backdrops)
  async getMovieImages(id: number) {
    return this.fetchFromTMDB(`/movie/${id}/images`)
  }

  // Get TV show images
  async getTVShowImages(id: number) {
    return this.fetchFromTMDB(`/tv/${id}/images`)
  }

  // Get movie reviews
  async getMovieReviews(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/movie/${id}/reviews?language=${language}&page=${page}`)
  }

  // Get TV show reviews
  async getTVShowReviews(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/tv/${id}/reviews?language=${language}&page=${page}`)
  }

  // Get similar movies
  async getSimilarMovies(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/movie/${id}/similar?language=${language}&page=${page}`)
  }

  // Get similar TV shows
  async getSimilarTVShows(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/tv/${id}/similar?language=${language}&page=${page}`)
  }

  // Get movie recommendations
  async getMovieRecommendations(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/movie/${id}/recommendations?language=${language}&page=${page}`)
  }

  // Get TV show recommendations
  async getTVShowRecommendations(id: number, language: string = 'en', page: number = 1) {
    return this.fetchFromTMDB(`/tv/${id}/recommendations?language=${language}&page=${page}`)
  }

  // Get image URL
  getImageUrl(path: string, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500', content?: any, languageCode?: string, useOriginalPoster: boolean = true) {
    if (!path) return '/placeholder-poster.jpg'
    
    // Always use original poster if requested (default behavior)
    if (useOriginalPoster) {
      return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
    }
    
    // If content and languageCode are provided, try to get language-specific poster
    if (content && languageCode && content.poster_paths_by_language) {
      try {
        const postersByLanguage = typeof content.poster_paths_by_language === 'string' 
          ? JSON.parse(content.poster_paths_by_language)
          : content.poster_paths_by_language
        
        // Priority 1: User's current language
        if (postersByLanguage[languageCode]) {
          return `${TMDB_IMAGE_BASE_URL}/${size}${postersByLanguage[languageCode].file_path || postersByLanguage[languageCode]}?v=${Date.now()}${cacheBuster}`
        }
        
        // Priority 2: Original language of the content
        if (content.original_language && postersByLanguage[content.original_language]) {
          return `${TMDB_IMAGE_BASE_URL}/${size}${postersByLanguage[content.original_language].file_path || postersByLanguage[content.original_language]}?v=${Date.now()}${cacheBuster}`
        }
        
        // Priority 3: English
        if (postersByLanguage['en']) {
          return `${TMDB_IMAGE_BASE_URL}/${size}${postersByLanguage['en'].file_path || postersByLanguage['en']}?v=${Date.now()}${cacheBuster}`
        }
        
        // Priority 4: Language-neutral (null)
        if (postersByLanguage['null']) {
          return `${TMDB_IMAGE_BASE_URL}/${size}${postersByLanguage['null'].file_path || postersByLanguage['null']}?v=${Date.now()}${cacheBuster}`
        }
        
        // Priority 5: Any available poster
        const availablePosters = Object.values(postersByLanguage)
        if (availablePosters.length > 0) {
          const firstPoster = availablePosters[0]
          return `${TMDB_IMAGE_BASE_URL}/${size}${firstPoster.file_path || firstPoster}?v=${Date.now()}${cacheBuster}`
        }
      } catch (error) {
        console.warn('Error parsing poster_paths_by_language:', error)
        // Fall back to original poster
      }
    }
    
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
  }

  // Get backdrop image URL
  getBackdropUrl(path: string, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280') {
    if (!path) return '/placeholder-backdrop.jpg'
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
  }

  // Get person profile image URL
  getProfileUrl(path: string, size: 'w45' | 'w185' | 'h632' | 'original' = 'w185') {
    if (!path) return '/placeholder-profile.jpg'
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
  }

  // Get provider logo URL
  getProviderLogoUrl(path: string, size: 'w45' | 'w92' | 'w154' | 'w185' | 'w300' | 'original' = 'w92') {
    if (!path || path === 'null' || path === '') return '/placeholder-provider.jpg'
    
    // Ensure path starts with / for TMDB URLs
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    return `${TMDB_IMAGE_BASE_URL}/${size}${cleanPath}`
  }
  
  // Clear the cache
  clearCache(): void {
    console.log('🧹 Clearing TMDB API cache')
    this.apiCache.clear()
  }
  
  // Get cache stats
  getCacheStats(): { size: number, keys: string[] } {
    return {
      size: this.apiCache.size,
      keys: Array.from(this.apiCache.keys())
    }
  }

  // Get person details (actor, director, etc.)
  async getPersonDetails(id: number, language: string = 'en') {
    const params = new URLSearchParams({
      language,
      append_to_response: 'movie_credits,tv_credits,combined_credits,external_ids,images'
    })
    return this.fetchFromTMDB(`/person/${id}?${params}`)
  }

  // Get person movie credits
  async getPersonMovieCredits(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/person/${id}/movie_credits?language=${language}`)
  }

  // Get person TV credits
  async getPersonTVCredits(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/person/${id}/tv_credits?language=${language}`)
  }

  // Get person combined credits (movies and TV shows)
  async getPersonCombinedCredits(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/person/${id}/combined_credits?language=${language}`)
  }

  // Get person images
  async getPersonImages(id: number) {
    return this.fetchFromTMDB(`/person/${id}/images`)
  }

  // Search for a person by name
  async searchPerson(query: string, language: string = 'en') {
    const params = new URLSearchParams({
      query,
      language,
      page: '1'
    })
    return this.fetchFromTMDB(`/search/person?${params}`)
  }

  // Get person credits (combined cast and crew)
  async getPersonCredits(id: number, language: string = 'en') {
    return this.fetchFromTMDB(`/person/${id}/combined_credits?language=${language}`)
  }
}

export const tmdbService = new TMDBService()
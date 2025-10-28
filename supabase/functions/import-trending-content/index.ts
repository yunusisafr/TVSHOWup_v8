import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Helper function to retry fetch requests with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      lastError = error as Error
      console.warn(`Fetch attempt ${attempt + 1} failed for ${url}:`, error.message)
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError!
}

interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  release_date: string
  runtime?: number
  poster_path?: string
  backdrop_path?: string
  vote_average: number
  vote_count: number
  popularity: number
  adult: boolean
  original_language: string
  genre_ids: number[]
  video: boolean
  budget?: number
  revenue?: number
  status?: string
  tagline?: string
  homepage?: string
  imdb_id?: string
  belongs_to_collection?: any
  production_companies?: any[]
  production_countries?: any[]
  spoken_languages?: any[]
  genres?: any[]
  keywords?: any
}

interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  last_air_date?: string
  poster_path?: string
  backdrop_path?: string
  vote_average: number
  vote_count: number
  popularity: number
  adult: boolean
  original_language: string
  genre_ids: number[]
  origin_country: string[]
  status?: string
  type?: string
  tagline?: string
  homepage?: string
  in_production?: boolean
  number_of_episodes?: number
  number_of_seasons?: number
  episode_run_time?: number[]
  created_by?: any[]
  genres?: any[]
  keywords?: any
  languages?: string[]
  last_episode_to_air?: any
  next_episode_to_air?: any
  networks?: any[]
  production_companies?: any[]
  production_countries?: any[]
  seasons?: any[]
  spoken_languages?: any[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get TMDB API key
    let TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
    
    if (!TMDB_API_KEY && req.method === 'POST') {
      try {
        const body = await req.json()
        TMDB_API_KEY = body.tmdbApiKey
      } catch (error) {
        // Continue with URL params
      }
    }
    
    if (!TMDB_API_KEY) {
      const url = new URL(req.url)
      TMDB_API_KEY = url.searchParams.get('tmdbApiKey')
    }
    
    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY is required. Please provide it as a URL parameter (?tmdbApiKey=your_key) or in the request body.')
    }

    const url = new URL(req.url)
    const clearExisting = url.searchParams.get('clear') === 'true'
    const movieCount = parseInt(url.searchParams.get('movieCount') || '250')
    const tvCount = parseInt(url.searchParams.get('tvCount') || '250')

    let results = {
      cleared: { movies: 0, tvShows: 0, contentProviders: 0 },
      imported: { movies: 0, tvShows: 0, errors: 0 },
      providers: { updated: 0, created: 0 }
    }

    // Step 1: Clear existing content if requested
    if (clearExisting) {
      console.log('🗑️ Clearing existing content...')
      
      // Clear content providers first (foreign key constraint)
      const { error: clearProvidersError } = await supabaseClient
        .from('content_providers')
        .delete()
        .neq('id', 0) // Delete all
      
      if (clearProvidersError) {
        console.error('Error clearing content providers:', clearProvidersError)
      } else {
        const { count: providersCount } = await supabaseClient
          .from('content_providers')
          .select('*', { count: 'exact', head: true })
        results.cleared.contentProviders = providersCount || 0
      }

      // Clear movies
      const { error: clearMoviesError } = await supabaseClient
        .from('movies')
        .delete()
        .neq('id', 0) // Delete all
      
      if (clearMoviesError) {
        console.error('Error clearing movies:', clearMoviesError)
      } else {
        results.cleared.movies = 0 // All cleared
      }

      // Clear TV shows
      const { error: clearTVError } = await supabaseClient
        .from('tv_shows')
        .delete()
        .neq('id', 0) // Delete all
      
      if (clearTVError) {
        console.error('Error clearing TV shows:', clearTVError)
      } else {
        results.cleared.tvShows = 0 // All cleared
      }

      console.log('✅ Existing content cleared')
    }

    // Step 2: Import trending movies (with automatic provider sync)
    console.log(`🎬 Importing ${movieCount} trending movies with providers...`)
    await importTrendingMovies(supabaseClient, TMDB_API_KEY, movieCount, results)

    // Step 3: Import trending TV shows (with automatic provider sync)
    console.log(`📺 Importing ${tvCount} trending TV shows with providers...`)
    await importTrendingTVShows(supabaseClient, TMDB_API_KEY, tvCount, results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Trending content import completed',
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function importTrendingMovies(supabaseClient: any, apiKey: string, count: number, results: any) {
  try {
    const pagesNeeded = Math.ceil(count / 20) // TMDB returns 20 items per page
    let importedCount = 0
    const supportedLanguages = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el']

    for (let page = 1; page <= pagesNeeded && importedCount < count; page++) {
      console.log(`Fetching trending movies page ${page}...`)
      
      const response = await fetchWithRetry(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&page=${page}&language=en-US`
      )
      
      if (!response.ok) {
        console.error(`TMDB API error for movies page ${page}: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      
      for (const movie of data.results) {
        if (importedCount >= count) break
        
        try {
          // Get detailed movie information in English (for original data and posters)
          const detailResponse = await fetchWithRetry(
            `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&language=en-US&append_to_response=keywords`
          )
          
          let originalMovie = movie
          if (detailResponse.ok) {
            originalMovie = await detailResponse.json()
          }
          
          // Get translations for all supported languages
          const translations = {
            title: {},
            overview: {},
            tagline: {}
          }
          
          // Fetch translations for each supported language
          for (const lang of supportedLanguages) {
            try {
              const langResponse = await fetchWithRetry(
                `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&language=${lang}`
              )
              
              if (langResponse.ok) {
                const langMovie = await langResponse.json()
                if (langMovie.title) translations.title[lang] = langMovie.title
                if (langMovie.overview) translations.overview[lang] = langMovie.overview
                if (langMovie.tagline) translations.tagline[lang] = langMovie.tagline
              }
            } catch (error) {
              console.warn(`Failed to get ${lang} translation for movie ${movie.id}:`, error)
            }
            
            // Rate limiting between language requests
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          // Prepare movie data for insertion
          const movieData = {
            id: originalMovie.id,
            title: originalMovie.title,
            original_title: originalMovie.original_title,
            overview: originalMovie.overview,
            release_date: originalMovie.release_date || null,
            runtime: originalMovie.runtime || null,
            poster_path: originalMovie.poster_path, // Always use original English poster
            backdrop_path: originalMovie.backdrop_path, // Always use original backdrop
            vote_average: originalMovie.vote_average || 0,
            vote_count: originalMovie.vote_count || 0,
            popularity: originalMovie.popularity || 0,
            adult: originalMovie.adult || false,
            original_language: originalMovie.original_language,
            video: originalMovie.video || false,
            budget: originalMovie.budget || 0,
            revenue: originalMovie.revenue || 0,
            status: originalMovie.status,
            tagline: originalMovie.tagline,
            homepage: originalMovie.homepage,
            imdb_id: originalMovie.imdb_id,
            belongs_to_collection: originalMovie.belongs_to_collection ? JSON.stringify(originalMovie.belongs_to_collection) : null,
            production_companies: originalMovie.production_companies ? JSON.stringify(originalMovie.production_companies) : null,
            production_countries: originalMovie.production_countries ? JSON.stringify(originalMovie.production_countries) : null,
            spoken_languages: originalMovie.spoken_languages ? JSON.stringify(originalMovie.spoken_languages) : null,
            genres: originalMovie.genres ? JSON.stringify(originalMovie.genres) : null,
            keywords: originalMovie.keywords ? JSON.stringify(originalMovie.keywords) : null,
            // Add multilingual translations
            title_translations: JSON.stringify(translations.title),
            overview_translations: JSON.stringify(translations.overview),
            tagline_translations: JSON.stringify(translations.tagline),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          // Insert movie
          const { error } = await supabaseClient
            .from('movies')
            .upsert(movieData)

          if (error) {
            console.error(`Error inserting movie ${movie.id}:`, error)
            results.imported.errors++
          } else {
            console.log(`✅ Imported movie: ${originalMovie.title} with ${supportedLanguages.length} language translations`)
            results.imported.movies++
            importedCount++

            // Immediately sync providers for this movie
            const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
            await syncContentProviders(supabaseClient, originalMovie.id, 'movie', apiKey, countries, results)
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.error(`Error processing movie ${movie.id}:`, error)
          results.imported.errors++
        }
      }
      
      // Rate limiting between pages
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
  } catch (error) {
    console.error('Error importing trending movies:', error)
    results.imported.errors++
  }
}

async function importTrendingTVShows(supabaseClient: any, apiKey: string, count: number, results: any) {
  try {
    const pagesNeeded = Math.ceil(count / 20) // TMDB returns 20 items per page
    let importedCount = 0
    const supportedLanguages = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el']

    for (let page = 1; page <= pagesNeeded && importedCount < count; page++) {
      console.log(`Fetching trending TV shows page ${page}...`)
      
      const response = await fetchWithRetry(
        `https://api.themoviedb.org/3/trending/tv/week?api_key=${apiKey}&page=${page}&language=en-US`
      )
      
      if (!response.ok) {
        console.error(`TMDB API error for TV shows page ${page}: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      
      for (const tvShow of data.results) {
        if (importedCount >= count) break
        
        try {
          // Get detailed TV show information in English (for original data and posters)
          const detailResponse = await fetchWithRetry(
            `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${apiKey}&language=en-US&append_to_response=keywords`
          )
          
          let originalTVShow = tvShow
          if (detailResponse.ok) {
            originalTVShow = await detailResponse.json()
          }
          
          // Get translations for all supported languages
          const translations = {
            name: {},
            overview: {},
            tagline: {}
          }
          
          // Fetch translations for each supported language
          for (const lang of supportedLanguages) {
            try {
              const langResponse = await fetchWithRetry(
                `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${apiKey}&language=${lang}`
              )
              
              if (langResponse.ok) {
                const langTVShow = await langResponse.json()
                if (langTVShow.name) translations.name[lang] = langTVShow.name
                if (langTVShow.overview) translations.overview[lang] = langTVShow.overview
                if (langTVShow.tagline) translations.tagline[lang] = langTVShow.tagline
              }
            } catch (error) {
              console.warn(`Failed to get ${lang} translation for TV show ${tvShow.id}:`, error)
            }
            
            // Rate limiting between language requests
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          // Prepare TV show data for insertion
          const tvShowData = {
            id: originalTVShow.id,
            name: originalTVShow.name,
            original_name: originalTVShow.original_name,
            overview: originalTVShow.overview,
            first_air_date: originalTVShow.first_air_date || null,
            last_air_date: originalTVShow.last_air_date || null,
            poster_path: originalTVShow.poster_path, // Always use original English poster
            backdrop_path: originalTVShow.backdrop_path, // Always use original backdrop
            vote_average: originalTVShow.vote_average || 0,
            vote_count: originalTVShow.vote_count || 0,
            popularity: originalTVShow.popularity || 0,
            adult: originalTVShow.adult || false,
            original_language: originalTVShow.original_language,
            status: originalTVShow.status,
            type: originalTVShow.type,
            tagline: originalTVShow.tagline,
            homepage: originalTVShow.homepage,
            in_production: originalTVShow.in_production || false,
            number_of_episodes: originalTVShow.number_of_episodes || 0,
            number_of_seasons: originalTVShow.number_of_seasons || 0,
            episode_run_time: originalTVShow.episode_run_time || null,
            origin_country: originalTVShow.origin_country || null,
            created_by: originalTVShow.created_by ? JSON.stringify(originalTVShow.created_by) : null,
            genres: originalTVShow.genres ? JSON.stringify(originalTVShow.genres) : null,
            keywords: originalTVShow.keywords ? JSON.stringify(originalTVShow.keywords) : null,
            languages: originalTVShow.languages || null,
            last_episode_to_air: originalTVShow.last_episode_to_air ? JSON.stringify(originalTVShow.last_episode_to_air) : null,
            next_episode_to_air: originalTVShow.next_episode_to_air ? JSON.stringify(originalTVShow.next_episode_to_air) : null,
            networks: originalTVShow.networks ? JSON.stringify(originalTVShow.networks) : null,
            production_companies: originalTVShow.production_companies ? JSON.stringify(originalTVShow.production_companies) : null,
            production_countries: originalTVShow.production_countries ? JSON.stringify(originalTVShow.production_countries) : null,
            seasons: originalTVShow.seasons ? JSON.stringify(originalTVShow.seasons) : null,
            spoken_languages: originalTVShow.spoken_languages ? JSON.stringify(originalTVShow.spoken_languages) : null,
            // Add multilingual translations
            name_translations: JSON.stringify(translations.name),
            overview_translations: JSON.stringify(translations.overview),
            tagline_translations: JSON.stringify(translations.tagline),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          // Insert TV show
          const { error } = await supabaseClient
            .from('tv_shows')
            .upsert(tvShowData)
          
          if (error) {
            console.error(`Error inserting TV show ${tvShow.id}:`, error)
            results.imported.errors++
          } else {
            console.log(`✅ Imported TV show: ${originalTVShow.name} with ${supportedLanguages.length} language translations`)
            results.imported.tvShows++
            importedCount++

            // Sync networks (broadcast metadata)
            if (originalTVShow.networks && originalTVShow.networks.length > 0) {
              for (const network of originalTVShow.networks) {
                await supabaseClient
                  .from('providers')
                  .upsert({
                    id: network.id,
                    name: network.name,
                    logo_path: network.logo_path || null,
                    display_priority: 999,
                    provider_type: 'network',
                    is_watch_provider: false,
                    is_network_provider: true,
                    is_active: true,
                    country_of_origin: network.origin_country || null,
                    updated_at: new Date().toISOString()
                  })

                await supabaseClient
                  .from('content_providers')
                  .upsert({
                    content_id: originalTVShow.id,
                    content_type: 'tv_show',
                    provider_id: network.id,
                    country_code: network.origin_country || 'TR',
                    monetization_type: 'flatrate',
                    source_type: 'network',
                    link: `https://www.themoviedb.org/network/${network.id}`,
                    last_updated: new Date().toISOString(),
                    data_source: 'tmdb'
                  }, {
                    onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
                  })
              }
            }

            // Sync watch providers
            const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
            await syncContentProviders(supabaseClient, originalTVShow.id, 'tv_show', apiKey, countries, results)
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.error(`Error processing TV show ${tvShow.id}:`, error)
          results.imported.errors++
        }
      }
      
      // Rate limiting between pages
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
  } catch (error) {
    console.error('Error importing trending TV shows:', error)
    results.imported.errors++
  }
}

async function syncContentProviders(
  supabaseClient: any, 
  contentId: number, 
  contentType: string, 
  apiKey: string, 
  countries: string[],
  results: any
) {
  try {
    const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
    const providersResponse = await fetchWithRetry(
      `https://api.themoviedb.org/3/${tmdbType}/${contentId}/watch/providers?api_key=${apiKey}`
    )
    
    if (!providersResponse.ok) {
      return
    }
    
    const providersData = await providersResponse.json()
    
    // Process providers for specified countries
    for (const countryCode of countries) {
      const countryData = providersData.results?.[countryCode]
      if (!countryData) continue
      
      // Process different monetization types
      const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads', 'free'] as const
      
      for (const monetizationType of monetizationTypes) {
        const providers = countryData[monetizationType] || []
        
        for (const provider of providers) {
          // Ensure provider exists in providers table
          await upsertProvider(supabaseClient, provider, results)
          
          // Insert content provider relationship
          await supabaseClient
            .from('content_providers')
            .upsert({
              content_id: contentId,
              content_type: contentType,
              provider_id: provider.provider_id,
              country_code: countryCode.toUpperCase(),
              monetization_type: monetizationType,
              link: countryData.link,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
            })
        }
      }
    }
    
  } catch (error) {
    console.error(`Error syncing providers for ${contentType} ${contentId}:`, error)
  }
}

async function upsertProvider(supabaseClient: any, provider: any, results: any) {
  try {
    const { data: existingProvider } = await supabaseClient
      .from('providers')
      .select('id')
      .eq('id', provider.provider_id)
      .maybeSingle()
    
    const providerData = {
      id: provider.provider_id,
      name: provider.provider_name,
      logo_path: provider.logo_path,
      display_priority: provider.display_priority || 0,
      provider_type: 'streaming',
      is_active: true,
      updated_at: new Date().toISOString()
    }
    
    if (existingProvider) {
      await supabaseClient
        .from('providers')
        .update(providerData)
        .eq('id', provider.provider_id)
      results.providers.updated++
    } else {
      await supabaseClient
        .from('providers')
        .insert(providerData)
      results.providers.created++
    }
  } catch (error) {
    console.error(`Error upserting provider ${provider.provider_id}:`, error)
  }
}

async function upsertNetworkProvider(supabaseClient: any, network: any, results: any) {
  try {
    const { data: existingProvider } = await supabaseClient
      .from('providers')
      .select('id')
      .eq('id', network.id)
      .maybeSingle()
    
    const providerData = {
      id: network.id,
      name: network.name,
      logo_path: network.logo_path || null,
      display_priority: 999, // Lower priority for networks
      provider_type: 'network', // From TMDB networks API
      is_active: true,
      country_of_origin: network.origin_country || null,
      updated_at: new Date().toISOString()
    }
    
    if (existingProvider) {
      await supabaseClient
        .from('providers')
        .update(providerData)
        .eq('id', network.id)
      results.providers.updated++
      console.log(`Updated network provider: ${network.name}`)
    } else {
      await supabaseClient
        .from('providers')
        .insert(providerData)
      results.providers.created++
      console.log(`Inserted network provider: ${network.name}`)
    }
  } catch (error) {
    console.error(`Error upserting network provider ${network.id}:`, error)
  }
}
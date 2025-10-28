import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const KNOWN_STREAMING_SERVICES = [
  'netflix', 'disney+', 'amazon prime video', 'hbo max', 'hulu', 'apple tv+', 'paramount+', 'peacock', 'youtube premium',
  'exxen', 'gain', 'tabii', 'tod', 'blutv', 'puhu tv', 'puhu', 'gain tv'
];

function determineProviderType(providerName: string): string {
  const nameLower = providerName.toLowerCase();

  if (KNOWN_STREAMING_SERVICES.some(service => nameLower.includes(service))) {
    return 'streaming';
  }

  if (nameLower.includes('tv') && !nameLower.includes('apple tv') && !nameLower.includes('tv+') ||
      nameLower.includes('channel') || nameLower.includes('network') || nameLower.includes('broadcasting')) {
    return 'network';
  }
  return 'streaming';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

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
}

interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  poster_path?: string
  backdrop_path?: string
  vote_average: number
  vote_count: number
  popularity: number
  adult: boolean
  original_language: string
  genre_ids: number[]
  origin_country: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
    let requestBody: any = {}
    
    if (!TMDB_API_KEY && req.method === 'POST') {
      try {
        requestBody = await req.json()
        TMDB_API_KEY = requestBody.tmdbApiKey
        
        if (requestBody.action === 'save-content') {
          const { contentId, contentType, languageCode, countryCode, tmdbApiKey } = requestBody
          
          if (!contentId || !contentType || !tmdbApiKey) {
            throw new Error('Missing required parameters: contentId, contentType, tmdbApiKey')
          }
          
          console.log(`💾 Saving ${contentType} ${contentId} with multi-language support`)

          const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
          const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}&language=en-US&append_to_response=keywords,credits`

          const detailsResponse = await fetchWithRetry(detailsUrl)
          if (!detailsResponse.ok) {
            throw new Error(`TMDB API error: ${detailsResponse.status}`)
          }

          const details = await detailsResponse.json()

          const supportedLanguages = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el']
          const translations = {
            title: {},
            name: {},
            overview: {},
            tagline: {}
          }

          for (const lang of supportedLanguages) {
            try {
              const langUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}&language=${lang}`
              const langResponse = await fetchWithRetry(langUrl)

              if (langResponse.ok) {
                const langData = await langResponse.json()
                if (contentType === 'movie') {
                  if (langData.title) translations.title[lang] = langData.title
                  if (langData.overview) translations.overview[lang] = langData.overview
                  if (langData.tagline) translations.tagline[lang] = langData.tagline
                } else {
                  if (langData.name) translations.name[lang] = langData.name
                  if (langData.overview) translations.overview[lang] = langData.overview
                  if (langData.tagline) translations.tagline[lang] = langData.tagline
                }
              }
            } catch (error) {
              console.warn(`Failed to get ${lang} translation for ${contentType} ${contentId}:`, error)
            }

            await new Promise(resolve => setTimeout(resolve, 50))
          }

          console.log(`✅ Fetched translations for ${supportedLanguages.length} languages`)
          
          if (contentType === 'movie') {
            const movieData = {
              id: details.id,
              title: details.title,
              original_title: details.original_title,
              overview: details.overview,
              release_date: details.release_date || null,
              runtime: details.runtime || null,
              poster_path: details.poster_path,
              backdrop_path: details.backdrop_path,
              vote_average: details.vote_average || 0,
              vote_count: details.vote_count || 0,
              popularity: details.popularity || 0,
              adult: details.adult || false,
              original_language: details.original_language,
              video: details.video || false,
              budget: details.budget || 0,
              revenue: details.revenue || 0,
              status: details.status,
              tagline: details.tagline,
              homepage: details.homepage,
              imdb_id: details.imdb_id,
              belongs_to_collection: details.belongs_to_collection ? JSON.stringify(details.belongs_to_collection) : null,
              production_companies: details.production_companies ? JSON.stringify(details.production_companies) : null,
              production_countries: details.production_countries ? JSON.stringify(details.production_countries) : null,
              spoken_languages: details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
              genres: details.genres ? JSON.stringify(details.genres) : null,
              keywords: details.keywords ? JSON.stringify(details.keywords) : null,
              cast_data: details.credits?.cast ? JSON.stringify(details.credits.cast) : null,
              crew_data: details.credits?.crew ? JSON.stringify(details.credits.crew) : null,
              title_translations: JSON.stringify(translations.title),
              overview_translations: JSON.stringify(translations.overview),
              tagline_translations: JSON.stringify(translations.tagline),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            const { error } = await supabaseClient
              .from('movies')
              .upsert(movieData)

            if (error) throw error

            console.log(`🔄 Syncing streaming providers for movie ${contentId}`)
            const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
            await syncStreamingProviders(supabaseClient, contentId, 'movie', tmdbApiKey, countries)

          } else if (contentType === 'tv_show') {
            const tvData = {
              id: details.id,
              name: details.name,
              original_name: details.original_name,
              overview: details.overview,
              first_air_date: details.first_air_date || null,
              last_air_date: details.last_air_date || null,
              poster_path: details.poster_path,
              backdrop_path: details.backdrop_path,
              vote_average: details.vote_average || 0,
              vote_count: details.vote_count || 0,
              popularity: details.popularity || 0,
              adult: details.adult || false,
              original_language: details.original_language,
              status: details.status,
              type: details.type,
              tagline: details.tagline,
              homepage: details.homepage,
              in_production: details.in_production || false,
              number_of_episodes: details.number_of_episodes || 0,
              number_of_seasons: details.number_of_seasons || 0,
              episode_run_time: details.episode_run_time || null,
              origin_country: details.origin_country || null,
              created_by: details.created_by ? JSON.stringify(details.created_by) : null,
              genres: details.genres ? JSON.stringify(details.genres) : null,
              keywords: details.keywords ? JSON.stringify(details.keywords) : null,
              languages: details.languages || null,
              last_episode_to_air: details.last_episode_to_air ? JSON.stringify(details.last_episode_to_air) : null,
              next_episode_to_air: details.next_episode_to_air ? JSON.stringify(details.next_episode_to_air) : null,
              networks: details.networks ? JSON.stringify(details.networks) : null,
              production_companies: details.production_companies ? JSON.stringify(details.production_companies) : null,
              production_countries: details.production_countries ? JSON.stringify(details.production_countries) : null,
              seasons: details.seasons ? JSON.stringify(details.seasons) : null,
              spoken_languages: details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
              cast_data: details.credits?.cast ? JSON.stringify(details.credits.cast) : null,
              crew_data: details.credits?.crew ? JSON.stringify(details.credits.crew) : null,
              name_translations: JSON.stringify(translations.name),
              overview_translations: JSON.stringify(translations.overview),
              tagline_translations: JSON.stringify(translations.tagline),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            const { error } = await supabaseClient
              .from('tv_shows')
              .upsert(tvData)
            
            if (error) throw error

            // Sync networks (broadcast metadata - who produced/aired the content)
            if (details.networks && details.networks.length > 0) {
              console.log(`📺 Syncing ${details.networks.length} networks for TV show ${contentId}`)

              for (const network of details.networks) {
                // Add network to providers table
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

                // Add network relationship to content_providers
                await supabaseClient
                  .from('content_providers')
                  .upsert({
                    content_id: contentId,
                    content_type: 'tv_show',
                    provider_id: network.id,
                    country_code: network.origin_country || 'TR',
                    monetization_type: 'flatrate',
                    source_type: 'network',
                    link: `https://www.themoviedb.org/network/${network.id}`,
                    last_updated: new Date().toISOString()
                  }, {
                    onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
                  })

                console.log(`✅ Added network ${network.name}`)
              }
            }

            console.log(`🔄 Syncing watch providers for TV show ${contentId}`)
            const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
            await syncStreamingProviders(supabaseClient, contentId, 'tv_show', tmdbApiKey, countries)
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: `${contentType} ${contentId} saved successfully`,
              timestamp: new Date().toISOString()
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        
        if (requestBody.action === 'sync-networks') {
          const { contentIds, tmdbApiKey } = requestBody
          
          if (!contentIds || !Array.isArray(contentIds) || !tmdbApiKey) {
            throw new Error('Missing required parameters: contentIds (array), tmdbApiKey')
          }
          
          console.log(`🔄 Syncing networks for ${contentIds.length} TV shows`)
          
          let syncResults = {
            processed: 0,
            networksAdded: 0,
            errors: 0
          }
          
          for (const contentId of contentIds) {
            try {
              syncResults.processed++
              
              const detailsUrl = `https://api.themoviedb.org/3/tv/${contentId}?api_key=${tmdbApiKey}&language=en`
              const detailsResponse = await fetch(detailsUrl)
              
              if (!detailsResponse.ok) {
                console.error(`TMDB API error for TV show ${contentId}: ${detailsResponse.status}`)
                syncResults.errors++
                continue
              }
              
              const details = await detailsResponse.json()

              // NOTE: Networks are broadcast metadata, NOT watch providers
              if (details.networks && details.networks.length > 0) {
                console.log(`📺 TV show ${details.name} has ${details.networks.length} networks (metadata only)`)
              }
              
              await new Promise(resolve => setTimeout(resolve, 100))
              
            } catch (error) {
              console.error(`Error processing TV show ${contentId}:`, error)
              syncResults.errors++
            }
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Network sync completed',
              results: syncResults,
              timestamp: new Date().toISOString()
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        
        if (requestBody.action === 'sync-all-networks') {
          const { tmdbApiKey } = requestBody
          
          if (!tmdbApiKey) {
            throw new Error('Missing required parameter: tmdbApiKey')
          }
          
          console.log(`🔄 Syncing networks for ALL TV shows`)
          
          const { data: allTVShows, error: tvShowsError } = await supabaseClient
            .from('tv_shows')
            .select('id, name')
            .order('popularity', { ascending: false })
            .limit(500)
          
          if (tvShowsError) {
            throw new Error(`Error fetching TV shows: ${tvShowsError.message}`)
          }
          
          let syncResults = {
            processed: 0,
            networksAdded: 0,
            errors: 0,
            exxenShows: 0,
            gainShows: 0
          }
          
          for (const tvShow of allTVShows || []) {
            try {
              syncResults.processed++
              
              const detailsUrl = `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${tmdbApiKey}&language=en`
              const detailsResponse = await fetch(detailsUrl)
              
              if (!detailsResponse.ok) {
                console.error(`TMDB API error for TV show ${tvShow.id}: ${detailsResponse.status}`)
                syncResults.errors++
                continue
              }
              
              const details = await detailsResponse.json()

              // NOTE: Networks are broadcast metadata, NOT watch providers
              if (details.networks && details.networks.length > 0) {
                console.log(`📺 TV show ${details.name} has ${details.networks.length} networks (metadata only)`)
              }
              
              await new Promise(resolve => setTimeout(resolve, 150))
              
            } catch (error) {
              console.error(`Error processing TV show ${tvShow.id}:`, error)
              syncResults.errors++
            }
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              message: 'All networks sync completed',
              results: syncResults,
              timestamp: new Date().toISOString()
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      } catch (error) {
      }
    }
    
    if (!TMDB_API_KEY) {
      const url = new URL(req.url)
      TMDB_API_KEY = url.searchParams.get('tmdbApiKey')
    }

    // Check request body for tmdbApiKey
    if (!TMDB_API_KEY && requestBody.tmdbApiKey) {
      TMDB_API_KEY = requestBody.tmdbApiKey
    }

    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY is required. Please provide it as a URL parameter (?tmdbApiKey=your_key) or in the request body.')
    }

    if (requestBody.contentId && requestBody.contentType) {
      const contentId = parseInt(requestBody.contentId)
      const contentType = requestBody.contentType

      console.log(`🔄 Updating ${contentType} with ID ${contentId} from TMDB`)

      try {
        const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'

        const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=keywords,credits`
        const detailsResponse = await fetchWithRetry(detailsUrl)

        if (!detailsResponse.ok) {
          throw new Error(`TMDB API error: ${detailsResponse.status} - Content not found`)
        }

        const details = await detailsResponse.json()

        const supportedLanguages = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el']
        const translations = {
          title: {},
          name: {},
          overview: {},
          tagline: {}
        }

        for (const lang of supportedLanguages) {
          try {
            const langUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${TMDB_API_KEY}&language=${lang}`
            const langResponse = await fetchWithRetry(langUrl)

            if (langResponse.ok) {
              const langData = await langResponse.json()
              if (contentType === 'movie') {
                if (langData.title) translations.title[lang] = langData.title
                if (langData.overview) translations.overview[lang] = langData.overview
                if (langData.tagline) translations.tagline[lang] = langData.tagline
              } else {
                if (langData.name) translations.name[lang] = langData.name
                if (langData.overview) translations.overview[lang] = langData.overview
                if (langData.tagline) translations.tagline[lang] = langData.tagline
              }
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation:`, error)
          }

          await new Promise(resolve => setTimeout(resolve, 50))
        }

        console.log(`✅ Fetched translations for ${supportedLanguages.length} languages`)

        if (contentType === 'movie') {
          const movieData = {
            id: details.id,
            title: details.title,
            original_title: details.original_title,
            overview: details.overview,
            release_date: details.release_date || null,
            runtime: details.runtime || null,
            poster_path: details.poster_path,
            backdrop_path: details.backdrop_path,
            vote_average: details.vote_average || 0,
            vote_count: details.vote_count || 0,
            popularity: details.popularity || 0,
            adult: details.adult || false,
            original_language: details.original_language,
            video: details.video || false,
            budget: details.budget || 0,
            revenue: details.revenue || 0,
            status: details.status,
            tagline: details.tagline,
            homepage: details.homepage,
            imdb_id: details.imdb_id,
            belongs_to_collection: details.belongs_to_collection ? JSON.stringify(details.belongs_to_collection) : null,
            production_companies: details.production_companies ? JSON.stringify(details.production_companies) : null,
            production_countries: details.production_countries ? JSON.stringify(details.production_countries) : null,
            spoken_languages: details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
            genres: details.genres ? JSON.stringify(details.genres) : null,
            keywords: details.keywords ? JSON.stringify(details.keywords) : null,
            cast_data: details.credits?.cast ? JSON.stringify(details.credits.cast) : null,
            crew_data: details.credits?.crew ? JSON.stringify(details.credits.crew) : null,
            title_translations: JSON.stringify(translations.title),
            overview_translations: JSON.stringify(translations.overview),
            tagline_translations: JSON.stringify(translations.tagline),
            updated_at: new Date().toISOString()
          }

          const { error } = await supabaseClient
            .from('movies')
            .upsert(movieData)

          if (error) throw error

          console.log(`🔄 Syncing streaming providers for movie ${contentId}`)
          const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
          await syncStreamingProviders(supabaseClient, contentId, 'movie', TMDB_API_KEY, countries)

        } else if (contentType === 'tv_show') {
          const tvData = {
            id: details.id,
            name: details.name,
            original_name: details.original_name,
            overview: details.overview,
            first_air_date: details.first_air_date || null,
            last_air_date: details.last_air_date || null,
            poster_path: details.poster_path,
            backdrop_path: details.backdrop_path,
            vote_average: details.vote_average || 0,
            vote_count: details.vote_count || 0,
            popularity: details.popularity || 0,
            adult: details.adult || false,
            original_language: details.original_language,
            status: details.status,
            type: details.type,
            tagline: details.tagline,
            homepage: details.homepage,
            in_production: details.in_production || false,
            number_of_episodes: details.number_of_episodes || 0,
            number_of_seasons: details.number_of_seasons || 0,
            episode_run_time: details.episode_run_time || null,
            origin_country: details.origin_country || null,
            created_by: details.created_by ? JSON.stringify(details.created_by) : null,
            genres: details.genres ? JSON.stringify(details.genres) : null,
            keywords: details.keywords ? JSON.stringify(details.keywords) : null,
            languages: details.languages || null,
            last_episode_to_air: details.last_episode_to_air ? JSON.stringify(details.last_episode_to_air) : null,
            next_episode_to_air: details.next_episode_to_air ? JSON.stringify(details.next_episode_to_air) : null,
            networks: details.networks ? JSON.stringify(details.networks) : null,
            production_companies: details.production_companies ? JSON.stringify(details.production_companies) : null,
            production_countries: details.production_countries ? JSON.stringify(details.production_countries) : null,
            seasons: details.seasons ? JSON.stringify(details.seasons) : null,
            spoken_languages: details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
            cast_data: details.credits?.cast ? JSON.stringify(details.credits.cast) : null,
            crew_data: details.credits?.crew ? JSON.stringify(details.credits.crew) : null,
            name_translations: JSON.stringify(translations.name),
            overview_translations: JSON.stringify(translations.overview),
            tagline_translations: JSON.stringify(translations.tagline),
            updated_at: new Date().toISOString()
          }

          const { error } = await supabaseClient
            .from('tv_shows')
            .upsert(tvData)

          if (error) throw error

          // NOTE: Networks are broadcast metadata, NOT watch providers
          if (details.networks && details.networks.length > 0) {
            console.log(`📺 TV show has ${details.networks.length} networks (metadata only)`)
          }

          console.log(`🔄 Syncing streaming providers for TV show ${contentId}`)
          const countries = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
          await syncStreamingProviders(supabaseClient, contentId, 'tv_show', TMDB_API_KEY, countries)
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `${contentType} ${contentId} updated successfully`,
            content: details,
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } catch (error) {
        console.error(`Error updating ${contentType} ${contentId}:`, error)
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
    }

    const url = new URL(req.url)
    const action = requestBody.action || url.searchParams.get('action') || 'sync-missing'
    const contentType = requestBody.type || url.searchParams.get('type') || 'both'
    const limit = parseInt(requestBody.limit || url.searchParams.get('limit') || '50')

    let results = {
      movies: { updated: 0, errors: 0 },
      tvShows: { updated: 0, errors: 0 },
      providers: { updated: 0, errors: 0 }
    }

    if (contentType === 'movie' || contentType === 'both') {
      console.log('🎬 Syncing movie data...')
      
      const { data: movies, error: moviesError } = await supabaseClient
        .from('movies')
        .select('id, title, overview, poster_path, backdrop_path, runtime')
        .or('overview.is.null,poster_path.is.null,backdrop_path.is.null,runtime.is.null')
        .limit(limit)

      if (moviesError) {
        console.error('Error fetching movies:', moviesError)
      } else if (movies) {
        console.log(`Found ${movies.length} movies with missing data`)
        
        for (const movie of movies) {
          try {
            const tmdbResponse = await fetchWithRetry(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`
            )
            
            if (tmdbResponse.ok) {
              const tmdbMovie = await tmdbResponse.json()
              
              const updateData: any = {}
              
              if (!movie.overview && tmdbMovie.overview) {
                updateData.overview = tmdbMovie.overview
              }
              if (!movie.poster_path && tmdbMovie.poster_path) {
                updateData.poster_path = tmdbMovie.poster_path
              }
              if (!movie.backdrop_path && tmdbMovie.backdrop_path) {
                updateData.backdrop_path = tmdbMovie.backdrop_path
              }
              if (!movie.runtime && tmdbMovie.runtime) {
                updateData.runtime = tmdbMovie.runtime
              }
              
              if (tmdbMovie.tagline) updateData.tagline = tmdbMovie.tagline
              if (tmdbMovie.status) updateData.status = tmdbMovie.status
              if (tmdbMovie.budget) updateData.budget = tmdbMovie.budget
              if (tmdbMovie.revenue) updateData.revenue = tmdbMovie.revenue
              if (tmdbMovie.homepage) updateData.homepage = tmdbMovie.homepage
              if (tmdbMovie.imdb_id) updateData.imdb_id = tmdbMovie.imdb_id
              
              updateData.updated_at = new Date().toISOString()
              
              if (Object.keys(updateData).length > 1) {
                const { error: updateError } = await supabaseClient
                  .from('movies')
                  .update(updateData)
                  .eq('id', movie.id)
                
                if (updateError) {
                  console.error(`Error updating movie ${movie.id}:`, updateError)
                  results.movies.errors++
                } else {
                  console.log(`✅ Updated movie: ${movie.title}`)
                  results.movies.updated++
                }
              }
              
            } else {
              console.error(`TMDB API error for movie ${movie.id}: ${tmdbResponse.status}`)
              results.movies.errors++
            }
            
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (error) {
            console.error(`Error processing movie ${movie.id}:`, error)
            results.movies.errors++
          }
        }
      }
    }

    if (contentType === 'tv' || contentType === 'both') {
      console.log('📺 Syncing TV show data...')
      
      const { data: tvShows, error: tvError } = await supabaseClient
        .from('tv_shows')
        .select('id, name, overview, poster_path, backdrop_path, number_of_episodes, number_of_seasons')
        .or('overview.is.null,poster_path.is.null,backdrop_path.is.null,number_of_episodes.is.null')
        .limit(limit)

      if (tvError) {
        console.error('Error fetching TV shows:', tvError)
      } else if (tvShows) {
        console.log(`Found ${tvShows.length} TV shows with missing data`)
        
        for (const tvShow of tvShows) {
          try {
            const tmdbResponse = await fetchWithRetry(
              `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${TMDB_API_KEY}&language=en-US`
            )
            
            if (tmdbResponse.ok) {
              const tmdbTVShow = await tmdbResponse.json()
              
              const updateData: any = {}
              
              if (!tvShow.overview && tmdbTVShow.overview) {
                updateData.overview = tmdbTVShow.overview
              }
              if (!tvShow.poster_path && tmdbTVShow.poster_path) {
                updateData.poster_path = tmdbTVShow.poster_path
              }
              if (!tvShow.backdrop_path && tmdbTVShow.backdrop_path) {
                updateData.backdrop_path = tmdbTVShow.backdrop_path
              }
              if (!tvShow.number_of_episodes && tmdbTVShow.number_of_episodes) {
                updateData.number_of_episodes = tmdbTVShow.number_of_episodes
              }
              if (!tvShow.number_of_seasons && tmdbTVShow.number_of_seasons) {
                updateData.number_of_seasons = tmdbTVShow.number_of_seasons
              }
              
              if (tmdbTVShow.tagline) updateData.tagline = tmdbTVShow.tagline
              if (tmdbTVShow.status) updateData.status = tmdbTVShow.status
              if (tmdbTVShow.type) updateData.type = tmdbTVShow.type
              if (tmdbTVShow.homepage) updateData.homepage = tmdbTVShow.homepage
              if (tmdbTVShow.last_air_date) updateData.last_air_date = tmdbTVShow.last_air_date
              if (tmdbTVShow.in_production !== undefined) updateData.in_production = tmdbTVShow.in_production
              if (tmdbTVShow.episode_run_time) updateData.episode_run_time = tmdbTVShow.episode_run_time
              if (tmdbTVShow.origin_country) updateData.origin_country = tmdbTVShow.origin_country
              if (tmdbTVShow.created_by) updateData.created_by = tmdbTVShow.created_by
              if (tmdbTVShow.genres) updateData.genres = tmdbTVShow.genres
              if (tmdbTVShow.networks) updateData.networks = tmdbTVShow.networks
              if (tmdbTVShow.production_companies) updateData.production_companies = tmdbTVShow.production_companies
              if (tmdbTVShow.seasons) updateData.seasons = tmdbTVShow.seasons
              
              updateData.updated_at = new Date().toISOString()
              
              if (Object.keys(updateData).length > 1) {
                const { error: updateError } = await supabaseClient
                  .from('tv_shows')
                  .update(updateData)
                  .eq('id', tvShow.id)
                
                if (updateError) {
                  console.error(`Error updating TV show ${tvShow.id}:`, updateError)
                  results.tvShows.errors++
                } else {
                  console.log(`✅ Updated TV show: ${tvShow.name}`)
                  results.tvShows.updated++
                }
              }
              
              // NOTE: Networks are broadcast metadata, NOT watch providers
              if (tmdbTVShow.networks && tmdbTVShow.networks.length > 0) {
                console.log(`📺 TV show ${tvShow.name} has ${tmdbTVShow.networks.length} networks (metadata only)`)
              }
              
            } else {
              console.error(`TMDB API error for TV show ${tvShow.id}: ${tmdbResponse.status}`)
              results.tvShows.errors++
            }
            
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (error) {
            console.error(`Error processing TV show ${tvShow.id}:`, error)
            results.tvShows.errors++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TMDB data sync completed',
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

async function syncStreamingProviders(
  supabaseClient: any,
  contentId: number,
  contentType: string,
  apiKey: string,
  countries: string[]
) {
  try {
    const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
    const providersResponse = await fetchWithRetry(
      `https://api.themoviedb.org/3/${tmdbType}/${contentId}/watch/providers?api_key=${apiKey}`
    )

    if (!providersResponse.ok) {
      console.warn(`Failed to fetch providers for ${contentType} ${contentId}`)
      return
    }

    const providersData = await providersResponse.json()

    for (const countryCode of countries) {
      const countryData = providersData.results?.[countryCode]
      if (!countryData) continue

      const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads', 'free'] as const

      for (const monetizationType of monetizationTypes) {
        const providers = countryData[monetizationType] || []

        for (const provider of providers) {
          await supabaseClient
            .from('providers')
            .upsert({
              id: provider.provider_id,
              name: provider.provider_name,
              logo_path: provider.logo_path,
              display_priority: provider.display_priority || 0,
              provider_type: 'streaming',
              is_watch_provider: true,
              is_network_provider: false,
              is_active: true,
              updated_at: new Date().toISOString()
            })

          await supabaseClient
            .from('content_providers')
            .upsert({
              content_id: contentId,
              content_type: contentType,
              provider_id: provider.provider_id,
              country_code: countryCode.toUpperCase(),
              monetization_type: monetizationType,
              source_type: 'watch_provider',
              link: countryData.link,
              presentation_type: 'hd',
              last_updated: new Date().toISOString(),
              data_source: 'tmdb'
            }, {
              onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
            })

          console.log(`✅ Added streaming provider ${provider.provider_name} (${monetizationType}) for ${countryCode}`)
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing streaming providers for ${contentType} ${contentId}:`, error)
  }
}
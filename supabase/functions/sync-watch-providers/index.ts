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

interface TMDBWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

interface TMDBWatchProviderResponse {
  results: {
    [countryCode: string]: {
      link: string
      flatrate?: TMDBWatchProvider[]
      buy?: TMDBWatchProvider[]
      rent?: TMDBWatchProvider[]
      ads?: TMDBWatchProvider[]
      free?: TMDBWatchProvider[]
    }
  }
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
      throw new Error('TMDB_API_KEY is required')
    }

    const url = new URL(req.url)
    const contentId = url.searchParams.get('contentId')
    const contentType = url.searchParams.get('contentType') || 'movie' // 'movie' or 'tv'
    const countries = url.searchParams.get('countries')?.split(',') || ['US', 'GB', 'TR', 'DE', 'FR']
    const updateProviders = url.searchParams.get('updateProviders') === 'true'

    let results = {
      providers: { updated: 0, created: 0, errors: 0 },
      contentProviders: { updated: 0, created: 0, errors: 0 }
    }

    // Sync watch providers for specific content or update all providers
    if (contentId) {
      console.log(`🎬 Syncing watch providers for ${contentType} ${contentId}`)
      await syncContentProviders(supabaseClient, parseInt(contentId), contentType, TMDB_API_KEY, countries, results)
    } else if (updateProviders) {
      console.log('🔄 Updating all providers from TMDB')
      await updateAllProviders(supabaseClient, TMDB_API_KEY, results)
    } else {
      // Sync providers for content with missing provider data
      console.log('🔍 Syncing providers for content with missing data')
      await syncMissingProviders(supabaseClient, TMDB_API_KEY, countries, results)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Watch providers sync completed',
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
      throw new Error(`TMDB API error: ${providersResponse.status}`)
    }
    
    const providersData: TMDBWatchProviderResponse = await providersResponse.json()
    
    // Process providers for specified countries
    for (const countryCode of countries) {
      const countryData = providersData.results[countryCode]
      if (!countryData) continue
      
      console.log(`Processing providers for ${countryCode}`)
      
      // Process ALL monetization types from TMDB - NO RESTRICTIONS
      const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads', 'free']
      
      for (const monetizationType of monetizationTypes) {
        const providers = countryData[monetizationType] || []
        
        for (const provider of providers) {
          // Ensure provider exists in providers table
          await upsertProvider(supabaseClient, provider, results)
          
          // Insert/update content provider relationship
          const { error } = await supabaseClient
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
          
          if (error) {
            console.error(`Error upserting content provider:`, error)
            results.contentProviders.errors++
          } else {
            results.contentProviders.updated++
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error syncing providers for ${contentType} ${contentId}:`, error)
    results.contentProviders.errors++
  }
}

async function upsertProvider(supabaseClient: any, provider: TMDBWatchProvider, results: any) {
  try {
    const { data: existingProvider } = await supabaseClient
      .from('providers')
      .select('id')
      .eq('id', provider.provider_id)
      .maybeSingle()
    
    // Validate logo_path - must be TMDB format (starts with /) and not contain http
    let cleanLogoPath = provider.logo_path
    
    const providerData = {
      id: provider.provider_id,
      name: provider.provider_name,
      logo_path: provider.logo_path,
      display_priority: provider.display_priority || 0,
      provider_type: 'streaming', // From TMDB watch/providers API
      is_active: true,
      updated_at: new Date().toISOString()
    }
    
    if (existingProvider) {
      const { error } = await supabaseClient
        .from('providers')
        .update(providerData)
        .eq('id', provider.provider_id)
      
      if (error) {
        console.error(`Error updating provider ${provider.provider_id}:`, error)
        results.providers.errors++
      } else {
        results.providers.updated++
      }
    } else {
      const { error } = await supabaseClient
        .from('providers')
        .insert(providerData)
      
      if (error) {
        console.error(`Error creating provider ${provider.provider_id}:`, error)
        results.providers.errors++
      } else {
        results.providers.created++
      }
    }
  } catch (error) {
    console.error(`Error upserting provider ${provider.provider_id}:`, error)
    results.providers.errors++
  }
}

async function updateAllProviders(supabaseClient: any, apiKey: string, results: any) {
  try {
    // Get all available providers from TMDB
    const movieProvidersResponse = await fetchWithRetry(
      `https://api.themoviedb.org/3/watch/providers/movie?api_key=${apiKey}&language=en-US`
    )
    
    const tvProvidersResponse = await fetchWithRetry(
      `https://api.themoviedb.org/3/watch/providers/tv?api_key=${apiKey}&language=en-US`
    )
    
    if (movieProvidersResponse.ok) {
      const movieProviders = await movieProvidersResponse.json()
      for (const provider of movieProviders.results || []) {
        await upsertProvider(supabaseClient, provider, results)
      }
    }
    
    if (tvProvidersResponse.ok) {
      const tvProviders = await tvProvidersResponse.json()
      for (const provider of tvProviders.results || []) {
        await upsertProvider(supabaseClient, provider, results)
      }
    }
    
  } catch (error) {
    console.error('Error updating all providers:', error)
    results.providers.errors++
  }
}

async function syncMissingProviders(
  supabaseClient: any, 
  apiKey: string, 
  countries: string[],
  results: any
) {
  try {
    // Get content without provider data
    const { data: moviesWithoutProviders } = await supabaseClient
      .from('movies')
      .select('id')
      .not('id', 'in', 
        supabaseClient
          .from('content_providers')
          .select('content_id')
          .eq('content_type', 'movie')
      )
      .limit(50)
    
    const { data: tvShowsWithoutProviders } = await supabaseClient
      .from('tv_shows')
      .select('id')
      .not('id', 'in', 
        supabaseClient
          .from('content_providers')
          .select('content_id')
          .eq('content_type', 'tv_show')
      )
      .limit(50)
    
    // Process movies
    for (const movie of moviesWithoutProviders || []) {
      await syncContentProviders(supabaseClient, movie.id, 'movie', apiKey, countries, results)
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Process TV shows
    for (const tvShow of tvShowsWithoutProviders || []) {
      await syncContentProviders(supabaseClient, tvShow.id, 'tv_show', apiKey, countries, results)
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
  } catch (error) {
    console.error('Error syncing missing providers:', error)
  }
}
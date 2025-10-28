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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
    const contentIdParam = url.searchParams.get('contentId');
    const contentTypeParam = url.searchParams.get('contentType');

    const action = url.searchParams.get('action') || 'sync-all'
    const countries = url.searchParams.get('countries')?.split(',') || ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'KR']
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const syncContentType = url.searchParams.get('contentType')

    let results = {
      providers: { updated: 0, created: 0, errors: 0, deactivated: 0 },
      contentProviders: { created: 0, updated: 0, removed: 0, errors: 0 },
      content: { processed: 0, withProviders: 0, withoutProviders: 0 },
      summary: { totalCountries: countries.length, processedContent: 0, newProviderRelations: 0 }
    }

    console.log(`🚀 Starting content-provider sync for action: ${action}`)
    console.log(`📍 Countries: ${countries.join(', ')}`)
    console.log(`📊 Limit: ${limit}`)

    if (contentIdParam && contentTypeParam) {
      console.log(`🎬 Syncing specific content: ${contentTypeParam} ${contentIdParam}`);
      const hasProviders = await syncContentProviders(
        supabaseClient, parseInt(contentIdParam), contentTypeParam, TMDB_API_KEY, countries, results
      );
      results.content.processed = 1;
      if (hasProviders) results.content.withProviders = 1;
      else results.content.withoutProviders = 1;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Content-provider sync completed', action, results, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function syncContentProviders(
  supabaseClient: any, contentId: number, contentType: string, apiKey: string, countries: string[], results: any
): Promise<boolean> {
  try {
    const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
    console.log(`📡 Fetching TMDB providers for ${tmdbType} ${contentId}`)

    const providersResponse = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${contentId}/watch/providers?api_key=${apiKey}`
    )
    
    if (!providersResponse.ok) {
      if (providersResponse.status === 404) {
        console.log(`⚠️ Content ${contentId} not found in TMDB`)
        return false
      }
      throw new Error(`TMDB API error: ${providersResponse.status}`)
    }
    
    const providersData: TMDBWatchProviderResponse = await providersResponse.json()
    let hasAnyProviders = false
    
    await supabaseClient.from('content_providers').delete().eq('content_id', contentId).eq('content_type', contentType)
    
    for (const countryCode of countries) {
      const countryData = providersData.results[countryCode]
      if (!countryData) {
        console.log(`📍 No providers for ${countryCode}`)
        continue
      }
      
      console.log(`📍 Processing providers for ${countryCode}`)
      hasAnyProviders = true
      
      const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads', 'free'] as const
      
      for (const monetizationType of monetizationTypes) {
        const providers = countryData[monetizationType] || []
        
        for (const provider of providers) {
          try {
            await upsertProvider(supabaseClient, provider, countryCode, results)
            
            const { error } = await supabaseClient
              .from('content_providers')
              .insert({
                content_id: contentId,
                content_type: contentType,
                provider_id: provider.provider_id,
                country_code: countryCode.toUpperCase(),
                monetization_type: monetizationType,
                link: countryData.link,
                presentation_type: 'hd',
                last_updated: new Date().toISOString(),
                data_source: 'tmdb'
              })
            
            if (error) {
              console.error(`❌ Error creating content provider relation:`, error)
              results.contentProviders.errors++
            } else {
              console.log(`✅ Added ${provider.provider_name} (${monetizationType})`)
              results.contentProviders.created++
              results.summary.newProviderRelations++
            }
          } catch (error) {
            console.error(`❌ Error processing provider ${provider.provider_id}:`, error)
            results.contentProviders.errors++
          }
        }
      }
    }
    
    return hasAnyProviders
  } catch (error) {
    console.error(`❌ Error syncing providers for ${contentType} ${contentId}:`, error)
    results.contentProviders.errors++
    return false
  }
}

async function upsertProvider(supabaseClient: any, provider: TMDBWatchProvider, countryCode: string, results: any) {
  try {
    const { data: existingProvider } = await supabaseClient
      .from('providers')
      .select('id, name, logo_path, supported_countries')
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
      let supportedCountries = existingProvider.supported_countries || []
      if (!supportedCountries.includes(countryCode.toUpperCase())) {
        supportedCountries.push(countryCode.toUpperCase())
      }
      
      const { error } = await supabaseClient
        .from('providers')
        .update({ ...providerData, supported_countries: supportedCountries })
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
        .insert({
          ...providerData,
          supported_countries: [countryCode.toUpperCase()],
          website_url: null,
          description: `Streaming platform: ${provider.provider_name}`
        })
      
      if (error) {
        console.error(`Error creating provider ${provider.provider_id}:`, error)
        results.providers.errors++
      } else {
        console.log(`🆕 Created new provider: ${provider.provider_name}`)
        results.providers.created++
      }
    }
  } catch (error) {
    console.error(`Error upserting provider ${provider.provider_id}:`, error)
    results.providers.errors++
  }
}
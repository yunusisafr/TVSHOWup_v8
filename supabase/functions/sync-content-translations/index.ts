import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Languages to fetch translations for
const SUPPORTED_LANGUAGES = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el']

// Generate slug from title
function generateSlug(id: number, title: string): string {
  if (!title) return `${id}`

  return `${id}-${title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')}`
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

    const { contentId, contentType, tmdbApiKey } = await req.json()

    if (!contentId || !contentType || !tmdbApiKey) {
      throw new Error('Missing required parameters: contentId, contentType, tmdbApiKey')
    }

    console.log(`🌐 Syncing translations for ${contentType} ${contentId}`)

    const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
    const translations: any = {}
    const overviewTranslations: any = {}
    const taglineTranslations: any = {}

    // Fetch translations for each language
    for (const lang of SUPPORTED_LANGUAGES) {
      try {
        const url = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}&language=${lang}`
        const response = await fetch(url)

        if (response.ok) {
          const data = await response.json()

          if (contentType === 'movie') {
            if (data.title) translations[lang] = data.title
            if (data.overview) overviewTranslations[lang] = data.overview
            if (data.tagline) taglineTranslations[lang] = data.tagline
          } else {
            if (data.name) translations[lang] = data.name
            if (data.overview) overviewTranslations[lang] = data.overview
            if (data.tagline) taglineTranslations[lang] = data.tagline
          }

          console.log(`✅ Fetched ${lang} translation`)
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${lang} translation:`, error)
      }
    }

    // Fetch original language content for slug generation
    const originalResponse = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}`
    )
    const originalData = await originalResponse.json()

    const originalTitle = contentType === 'movie'
      ? (originalData.original_title || originalData.title)
      : (originalData.original_name || originalData.name)

    const slug = generateSlug(contentId, originalTitle)

    // Update database
    const table = contentType === 'tv_show' ? 'tv_shows' : 'movies'
    const updateData: any = {
      slug,
      updated_at: new Date().toISOString()
    }

    if (contentType === 'movie') {
      updateData.title_translations = translations
      updateData.overview_translations = overviewTranslations
      updateData.tagline_translations = taglineTranslations
    } else {
      updateData.name_translations = translations
      updateData.overview_translations = overviewTranslations
      updateData.tagline_translations = taglineTranslations
    }

    const { error } = await supabaseClient
      .from(table)
      .update(updateData)
      .eq('id', contentId)

    if (error) throw error

    console.log(`✅ Updated ${contentType} ${contentId} with translations and slug: ${slug}`)

    return new Response(
      JSON.stringify({
        success: true,
        contentId,
        contentType,
        slug,
        languagesSynced: Object.keys(translations),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error syncing translations:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

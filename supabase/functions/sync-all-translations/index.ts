import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

const SUPPORTED_LANGUAGES = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el'];

function generateSlug(id: number, title: string): string {
  if (!title) return `${id}`;

  return `${id}-${title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

async function syncContentTranslations(
  contentId: number,
  contentType: 'movie' | 'tv_show',
  tmdbApiKey: string,
  supabaseClient: any
) {
  const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie';
  const translations: any = {};
  const overviewTranslations: any = {};
  const taglineTranslations: any = {};

  for (const lang of SUPPORTED_LANGUAGES) {
    try {
      const url = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}&language=${lang}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        if (contentType === 'movie') {
          if (data.title) translations[lang] = data.title;
          if (data.overview) overviewTranslations[lang] = data.overview;
          if (data.tagline) taglineTranslations[lang] = data.tagline;
        } else {
          if (data.name) translations[lang] = data.name;
          if (data.overview) overviewTranslations[lang] = data.overview;
          if (data.tagline) taglineTranslations[lang] = data.tagline;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.warn(`Failed to fetch ${lang} for ${contentType} ${contentId}`);
    }
  }

  const originalResponse = await fetch(
    `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${tmdbApiKey}`
  );
  const originalData = await originalResponse.json();

  const originalTitle = contentType === 'movie'
    ? (originalData.original_title || originalData.title)
    : (originalData.original_name || originalData.name);

  const slug = generateSlug(contentId, originalTitle);

  const table = contentType === 'tv_show' ? 'tv_shows' : 'movies';
  const updateData: any = {
    slug,
    updated_at: new Date().toISOString()
  };

  if (contentType === 'movie') {
    updateData.title_translations = translations;
    updateData.overview_translations = overviewTranslations;
    updateData.tagline_translations = taglineTranslations;
  } else {
    updateData.name_translations = translations;
    updateData.overview_translations = overviewTranslations;
    updateData.tagline_translations = taglineTranslations;
  }

  const { error: updateError } = await supabaseClient
    .from(table)
    .update(updateData)
    .eq('id', contentId);

  if (updateError) {
    throw new Error(`Database update failed for ${contentType} ${contentId}: ${updateError.message}`);
  }

  return { contentId, contentType, slug };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const tmdbApiKey = Deno.env.get("TMDB_API_KEY");

    if (!tmdbApiKey) {
      return new Response(JSON.stringify({
        error: "TMDB API key not configured"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { batchSize = 50, contentType = 'both' } = await req.json();

    console.log(`🌐 Starting bulk translation sync (batch size: ${batchSize})`);

    const results = {
      movies: { synced: 0, failed: 0 },
      tvShows: { synced: 0, failed: 0 }
    };

    if (contentType === 'both' || contentType === 'movie') {
      const { data: movies } = await supabaseClient
        .from('movies')
        .select('id')
        .or('title_translations.is.null,title_translations.eq.{}')
        .limit(batchSize);

      console.log(`📽️ Found ${movies?.length || 0} movies without translations`);

      if (movies && movies.length > 0) {
        for (const movie of movies) {
          try {
            await syncContentTranslations(movie.id, 'movie', tmdbApiKey, supabaseClient);
            results.movies.synced++;
            console.log(`✅ Synced movie ${movie.id} (${results.movies.synced}/${movies.length})`);
          } catch (error) {
            results.movies.failed++;
            console.error(`❌ Failed to sync movie ${movie.id}:`, error);
          }
        }
      }
    }

    if (contentType === 'both' || contentType === 'tv_show') {
      const { data: tvShows } = await supabaseClient
        .from('tv_shows')
        .select('id')
        .or('name_translations.is.null,name_translations.eq.{}')
        .limit(batchSize);

      console.log(`📺 Found ${tvShows?.length || 0} TV shows without translations`);

      if (tvShows && tvShows.length > 0) {
        for (const show of tvShows) {
          try {
            await syncContentTranslations(show.id, 'tv_show', tmdbApiKey, supabaseClient);
            results.tvShows.synced++;
            console.log(`✅ Synced TV show ${show.id} (${results.tvShows.synced}/${tvShows.length})`);
          } catch (error) {
            results.tvShows.failed++;
            console.error(`❌ Failed to sync TV show ${show.id}:`, error);
          }
        }
      }
    }

    console.log(`✅ Bulk sync completed:`, results);

    return new Response(JSON.stringify({
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("❌ Bulk translation sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return new Response(JSON.stringify({
      error: "Internal server error",
      details: errorMessage,
      stack: errorStack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
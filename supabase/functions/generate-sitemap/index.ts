import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPPORTED_LANGUAGES = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'el'];
const BASE_URL = 'https://www.tvshowup.com';
const CACHE_DURATION_SECONDS = 7200;
const MAX_URLS_PER_SITEMAP = 50000;

interface ContentItem {
  id: number;
  slug: string;
  updated_at: string;
  title_translations?: any;
}

interface SitemapCache {
  content: string;
  generated_at: string;
  url_count: number;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createContentUrl(id: number, slug: string, language: string, contentType: 'movie' | 'tv_show'): string {
  const slugPart = slug && slug !== `${id}--` ? slug : `${id}`;
  return `${BASE_URL}/${language}/${contentType}/${slugPart}`;
}

function generateUrlBlock(
  id: number,
  slug: string,
  updatedAt: string,
  contentType: 'movie' | 'tv_show',
  titleTranslations?: any
): string {
  const lastmod = new Date(updatedAt).toISOString().split('T')[0];
  let urlBlocks = '';

  for (const lang of SUPPORTED_LANGUAGES) {
    const url = createContentUrl(id, slug, lang, contentType);

    let hreflangs = '';
    for (const altLang of SUPPORTED_LANGUAGES) {
      const altUrl = createContentUrl(id, slug, altLang, contentType);
      hreflangs += `    <xhtml:link rel="alternate" hreflang="${escapeXml(altLang)}" href="${escapeXml(altUrl)}"/>\n`;
    }
    hreflangs += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(createContentUrl(id, slug, 'en', contentType))}"/>\n`;

    urlBlocks += `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${hreflangs}  </url>
`;
  }

  return urlBlocks;
}

async function getCachedSitemap(supabaseUrl: string, supabaseKey: string): Promise<SitemapCache | null> {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(
      `${supabaseUrl}/rest/v1/sitemap_cache?id=eq.1&select=content,generated_at,url_count`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const cache = data[0];
    const generatedAt = new Date(cache.generated_at);
    const now = new Date();
    const ageInSeconds = (now.getTime() - generatedAt.getTime()) / 1000;

    if (ageInSeconds < CACHE_DURATION_SECONDS) {
      console.log(`Returning cached sitemap (age: ${Math.floor(ageInSeconds)}s)`);
      return cache;
    }

    console.log(`Cache expired (age: ${Math.floor(ageInSeconds)}s, max: ${CACHE_DURATION_SECONDS}s)`);
    return null;
  } catch (error) {
    console.error('Error fetching cached sitemap:', error);
    return null;
  }
}

async function saveSitemapCache(
  supabaseUrl: string,
  supabaseKey: string,
  content: string,
  urlCount: number
): Promise<void> {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/sitemap_cache`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 1,
        content,
        url_count: urlCount,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('Failed to save sitemap cache:', await response.text());
    } else {
      console.log(`Sitemap cache saved successfully (${urlCount} URLs)`);
    }
  } catch (error) {
    console.error('Error saving sitemap cache:', error);
  }
}

async function getFallbackSitemap(supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  try {
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(
      `${supabaseUrl}/rest/v1/sitemap_cache?id=eq.1&select=content`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    console.log('Returning fallback sitemap from cache');
    return data[0].content;
  } catch (error) {
    console.error('Error fetching fallback sitemap:', error);
    return null;
  }
}

async function generateSitemap(supabaseUrl: string, supabaseKey: string): Promise<{ sitemap: string; urlCount: number }> {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const [moviesResponse, tvShowsResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/movies?adult=eq.false&select=id,slug,updated_at,title_translations&order=popularity.desc.nullslast`, {
      headers,
    }),
    fetch(`${supabaseUrl}/rest/v1/tv_shows?adult=eq.false&select=id,slug,updated_at,name_translations&order=popularity.desc.nullslast`, {
      headers,
    }),
  ]);

  if (!moviesResponse.ok || !tvShowsResponse.ok) {
    throw new Error('Failed to fetch content from database');
  }

  const movies: ContentItem[] = await moviesResponse.json();
  const tvShows: ContentItem[] = await tvShowsResponse.json();

  const totalContentItems = movies.length + tvShows.length;
  const totalUrlsWithLanguages = (totalContentItems * SUPPORTED_LANGUAGES.length) + (3 * SUPPORTED_LANGUAGES.length);

  if (totalUrlsWithLanguages > MAX_URLS_PER_SITEMAP) {
    console.warn(`Warning: Total URLs (${totalUrlsWithLanguages}) exceeds sitemap limit (${MAX_URLS_PER_SITEMAP})`);
  }

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  const staticPages = ['', 'search', 'discover-lists'];
  for (const page of staticPages) {
    for (const lang of SUPPORTED_LANGUAGES) {
      const url = page ? `${BASE_URL}/${lang}/${page}` : `${BASE_URL}/${lang}/`;

      let hreflangs = '';
      for (const altLang of SUPPORTED_LANGUAGES) {
        const altUrl = page ? `${BASE_URL}/${altLang}/${page}` : `${BASE_URL}/${altLang}/`;
        hreflangs += `    <xhtml:link rel="alternate" hreflang="${escapeXml(altLang)}" href="${escapeXml(altUrl)}"/>\n`;
      }
      const defaultUrl = page ? `${BASE_URL}/en/${page}` : `${BASE_URL}/en/`;
      hreflangs += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(defaultUrl)}"/>\n`;

      sitemap += `  <url>
    <loc>${escapeXml(url)}</loc>
    <changefreq>daily</changefreq>
    <priority>${page === '' ? '1.0' : '0.9'}</priority>
${hreflangs}  </url>
`;
    }
  }

  for (const movie of movies) {
    sitemap += generateUrlBlock(movie.id, movie.slug, movie.updated_at, 'movie', movie.title_translations);
  }

  for (const tvShow of tvShows) {
    sitemap += generateUrlBlock(tvShow.id, tvShow.slug, tvShow.updated_at, 'tv_show', tvShow.title_translations);
  }

  sitemap += `</urlset>`;

  return { sitemap, urlCount: totalUrlsWithLanguages };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    if (!forceRefresh) {
      const cached = await getCachedSitemap(supabaseUrl, supabaseKey);
      if (cached) {
        return new Response(cached.content, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600",
            "X-Cache": "HIT",
            "X-URL-Count": cached.url_count.toString(),
          },
        });
      }
    }

    const { sitemap, urlCount } = await generateSitemap(supabaseUrl, supabaseKey);

    await saveSitemapCache(supabaseUrl, supabaseKey, sitemap, urlCount);

    return new Response(sitemap, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600",
        "X-Cache": "MISS",
        "X-URL-Count": urlCount.toString(),
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);

    const fallback = await getFallbackSitemap(supabaseUrl, supabaseKey);
    if (fallback) {
      return new Response(fallback, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
          "X-Cache": "FALLBACK",
          "X-Error": "true",
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to generate sitemap',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
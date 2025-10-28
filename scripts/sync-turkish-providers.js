import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncProvidersForContent(contentId, contentType) {
  try {
    console.log(`\n🔄 Syncing providers for ${contentType} ${contentId}`);

    // Call the edge function instead of direct DB operations
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sync-content-providers?contentId=${contentId}&contentType=${contentType}&countries=TR&tmdbApiKey=${TMDB_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ Edge function error: ${response.status} - ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`  ✅ Synced successfully:`, result.contentProviders || result);
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting Turkish content provider sync...\n');

  // Fetch Turkish TV shows via API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tv_shows?select=id,name,original_name&original_language=eq.tr&order=popularity.desc`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const tvShows = await response.json();
  console.log(`📺 Found ${tvShows.length} Turkish TV shows\n`);

  let processed = 0;
  for (const show of tvShows) {
    await syncProvidersForContent(show.id, 'tv_show');
    processed++;

    // Rate limiting
    await sleep(500);

    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: ${processed}/${tvShows.length}`);
    }
  }

  console.log(`\n✅ Completed! Processed ${processed} TV shows`);
}

main().catch(console.error);

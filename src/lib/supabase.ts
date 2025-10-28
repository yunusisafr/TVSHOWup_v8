import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
console.log('Supabase URL:', supabaseUrl ? 'Loaded' : 'NOT LOADED')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Loaded' : 'NOT LOADED')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', { 
    url: supabaseUrl ? 'Present' : 'Missing', 
    key: supabaseAnonKey ? 'Present' : 'Missing' 
  })
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token'
  },
  global: {
    headers: {
      'X-Client-Info': 'tvshowup-web'
    }
  },
  cookieOptions: {
    domain: typeof window !== 'undefined' && window.location.hostname.includes('tvshowup.com')
      ? '.tvshowup.com'
      : undefined,
    path: '/',
    sameSite: 'lax'
  }
})

// Test connection function
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('🔍 Testing Supabase connection...')

    // Simple connection test with shorter timeout
    const { error } = await supabase.from('movies').select('id').limit(1);

    if (!error) {
      console.log('✅ Supabase connection test successful');
      return true;
    }

    console.error('❌ Supabase connection test failed:', error);
    return false;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false
  }
}

// Helper function to verify and refresh session
export const verifyAndRefreshSession = async (): Promise<boolean> => {
  try {
    console.log('🔄 Verifying and refreshing session...')

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Session verification error:', error)
      return false
    }

    if (!session) {
      console.log('⚠️ No session found')
      return false
    }

    // Try to refresh the session
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

    if (refreshError) {
      console.error('❌ Session refresh error:', refreshError)
      return false
    }

    if (refreshedSession) {
      console.log('✅ Session verified and refreshed successfully')
      return true
    }

    console.log('⚠️ Session refresh returned no session')
    return false
  } catch (error) {
    console.error('❌ Unexpected error verifying session:', error)
    return false
  }
}

export type Database = {
  public: {
    Tables: {
      movies: {
        Row: {
          id: number
          title: string
          original_title: string
          overview: string
          release_date: string
          runtime: number
          poster_path: string
          backdrop_path: string
          vote_average: number
          vote_count: number
          popularity: number
          adult: boolean
          original_language: string
          poster_paths_by_language: any
          created_at: string
          updated_at: string
        }
      }
      tv_shows: {
        Row: {
          id: number
          name: string
          original_name: string
          overview: string
          first_air_date: string
          poster_path: string
          backdrop_path: string
          vote_average: number
          vote_count: number
          popularity: number
          adult: boolean
          original_language: string
          poster_paths_by_language: any
          created_at: string
          updated_at: string
        }
      }
      providers: {
        Row: {
          id: number
          name: string
          logo_path: string
          display_priority: number
          provider_type: string
          is_active: boolean
          supported_countries: string[]
          website_url: string
          description: string
          created_at: string
          updated_at: string
        }
      }
      content_providers: {
        Row: {
          id: number
          content_id: number
          content_type: 'movie' | 'tv_show'
          provider_id: number
          country_code: string
          monetization_type: string
        }
      }
      user_watchlists: {
        Row: {
          id: number
          user_id: string
          content_id: number
          content_type: 'movie' | 'tv_show'
          status: 'want_to_watch' | 'watching' | 'watched' | 'dropped'
          added_at: string
          updated_at: string
        }
      }
      content_comments: {
        Row: {
          id: number
          user_id: string
          content_id: number
          content_type: 'movie' | 'tv_show'
          comment: string
          created_at: string
          updated_at: string
        }
      }
      content_ratings: {
        Row: {
          id: number
          user_id: string
          content_id: number
          content_type: 'movie' | 'tv_show'
          rating: number
          created_at: string
          updated_at: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          updated_at: string
          username: string
          full_name: string
          avatar_url: string
          website: string
          email: string
          country_code: string
          language_code: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string
          country_code: string
          language_code: string
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
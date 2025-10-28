import { supabase } from './supabase'

import { useTranslation } from './i18n';

export interface ShareList {
  id: string
  user_id: string
  name: string
  description?: string
  is_public: boolean
  slug?: string
  created_at: string
  updated_at: string
  item_count?: number
  user_display_name?: string
  preview_content?: ContentItem[]
  name_translations?: any
  description_translations?: any
  auto_translate?: boolean
}

export interface ShareListItem {
  id: string
  list_id: string
  content_id: number
  content_type: 'movie' | 'tv_show'
  added_at: string
}

export interface StaticPage {
  id: string
  slug: string
  title: string
  content: string
  meta_description?: string
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
  title_translations?: Record<string, string>
  content_translations?: Record<string, string>
  meta_description_translations?: Record<string, string>
}

export interface ContentItem {
  id: number
  title: string
  overview?: string
  poster_path?: string
  poster_paths_by_language?: any
  backdrop_path?: string
  vote_average: number
  vote_count: number
  popularity: number
  adult?: boolean
  original_language?: string
  release_date?: string
  first_air_date?: string
  content_type: 'movie' | 'tv_show'
  hasProviders?: boolean
  providers?: any[]
  genres?: any
  watchlist_status?: string
  // Multilingual fields
  title_translations?: any
  overview_translations?: any
  tagline_translations?: any
  name_translations?: any
  tagline?: string
}

export interface WatchlistItem {
  id: number
  user_id: string
  content_id: number
  content_type: 'movie' | 'tv_show'
  status: 'want_to_watch' | 'watching' | 'watched' | 'dropped'
  added_at: string
  updated_at: string
}

export interface UserWatchlistItem {
  id: number
  user_id: string
  content_id: number
  content_type: 'movie' | 'tv_show'
  status: 'want_to_watch' | 'watching' | 'watched' | 'dropped'
  added_at: string
  updated_at: string
}

// Consolidated provider interface for UI display
export interface ConsolidatedProvider {
  name: string;
  logo_path: string;
  provider_ids: number[];
  provider_types: string[];
  display_priority: number;
  is_active: boolean;
  supported_countries: string[];
}

class DatabaseService {
  // Expose supabase client for direct access when needed
  get supabase() {
    return supabase
  }

  async getShareLists(
    userId: string, 
    sortBy: 'name' | 'created_at' | 'item_count' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    searchQuery?: string,
    isPublicFilter?: 'all' | 'public' | 'private',
    isPublishedFilter?: boolean
  ): Promise<ShareList[]> {
    try {
      let query = supabase
        .from('share_lists')
        .select('*')
        .eq('user_id', userId)

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`)
      }

      // Apply public/private filter
      if (isPublicFilter === 'public') {
        query = query.eq('is_public', true)
      } else if (isPublicFilter === 'private') {
        query = query.eq('is_public', false)
      }

      // Apply published filter
      if (isPublishedFilter !== undefined) {
        query = query.eq('is_published', isPublishedFilter)
      }

      // Apply sorting (only for database columns)
      if (sortBy !== 'item_count') {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      } else {
        // For item_count, we'll sort on the client side after getting the data
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching share lists:', error)
        throw error
      }

      // Get item count for each list
      const listsWithCounts = await Promise.all(
        (data || []).map(async (list) => {
          try {
            const { count, error: countError } = await supabase
              .from('share_list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id)

            if (countError) {
              console.error('Error getting item count for list:', list.id, countError)
              return { ...list, item_count: 0 }
            }

            return { ...list, item_count: count || 0 }
          } catch (error) {
            console.error('Error processing list:', list.id, error)
            return { ...list, item_count: 0 }
          }
        })
      )

      // Sort by item_count if requested (client-side sorting)
      if (sortBy === 'item_count') {
        listsWithCounts.sort((a, b) => {
          const aCount = a.item_count || 0
          const bCount = b.item_count || 0
          return sortOrder === 'asc' ? aCount - bCount : bCount - aCount
        })
      }

      return listsWithCounts
    } catch (error) {
      console.error('Error in getShareLists:', error)
      throw error
    }
  }

  async getPublicShareLists(
    sortBy: 'name' | 'created_at' | 'item_count' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    searchQuery?: string,
    limit: number = 20
  ): Promise<ShareList[]> {
    try {
      console.log('🔍 Fetching public share lists...')
      let query = supabase
        .from('share_lists')
        .select('*')
        .eq('is_public', true)
        .eq('is_published', true)
        .limit(limit)

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`)
      }

      // Apply sorting (only for database columns)
      if (sortBy !== 'item_count') {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      } else {
        // For item_count, we'll sort on the client side after getting the data
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching public share lists:', error)
        throw error
      }

      console.log(`✅ Fetched ${data?.length || 0} public share lists`)
      
      // Get unique user IDs
      const userIds = [...new Set((data || []).map(list => list.user_id))]
      
      // Fetch user profiles separately
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds)
      
      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError)
      }
      
      // Create a map of user_id to display_name
      const userProfileMap = new Map()
      userProfiles?.forEach(profile => {
        userProfileMap.set(profile.id, profile.display_name)
      })

      // Transform data to include user_display_name, get item counts, and preview content
      const listsWithCounts = await Promise.all(
        (data || []).map(async (list: any) => {
          try {
            const { count, error: countError } = await supabase
              .from('share_list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id)

            if (countError) {
              console.error('Error getting item count for list:', list.id, countError)
              return {
                ...list,
                user_display_name: userProfileMap.get(list.user_id) || 'Anonymous',
                item_count: 0,
                preview_content: []
              }
            }

            // Get preview content (first 5 items)
            const { data: previewItems, error: previewError } = await supabase
              .from('share_list_items')
              .select('content_id, content_type')
              .eq('list_id', list.id)
              .order('added_at', { ascending: false })
              .limit(5)

            if (previewError) {
              console.error('Error getting preview items for list:', list.id, previewError)
              return {
                ...list,
                user_display_name: userProfileMap.get(list.user_id) || 'Anonymous',
                item_count: count || 0,
                preview_content: []
              }
            }

            let previewContent: ContentItem[] = []
            
            if (previewItems && previewItems.length > 0) {
              // Fetch content details for preview items
              const movieIds = previewItems.filter(item => item.content_type === 'movie').map(item => item.content_id)
              const tvShowIds = previewItems.filter(item => item.content_type === 'tv_show').map(item => item.content_id)
              
              const [moviesResult, tvShowsResult] = await Promise.allSettled([
                movieIds.length > 0 ? supabase
                  .from('movies')
                  .select('id, title, poster_path')
                  .in('id', movieIds) : Promise.resolve({ data: [] }),
                tvShowIds.length > 0 ? supabase
                  .from('tv_shows')
                  .select('id, name, poster_path')
                  .in('id', tvShowIds) : Promise.resolve({ data: [] })
              ])
              
              const moviesData = moviesResult.status === 'fulfilled' ? moviesResult.value : { data: [] }
              const tvShowsData = tvShowsResult.status === 'fulfilled' ? tvShowsResult.value : { data: [] }
              
              // Format and combine preview content
              const formattedMovies = (moviesData.data || []).map(movie => ({
                ...movie,
                title: movie.title,
                content_type: 'movie' as const
              }))
              
              const formattedTVShows = (tvShowsData.data || []).map(show => ({
                ...show,
                title: show.name,
                content_type: 'tv_show' as const
              }))
              
              // Maintain original order from previewItems
              previewContent = previewItems.map(item => {
                if (item.content_type === 'movie') {
                  return formattedMovies.find(movie => movie.id === item.content_id)
                } else {
                  return formattedTVShows.find(show => show.id === item.content_id)
                }
              }).filter(Boolean) as ContentItem[]
            }
            
            return {
              ...list,
              user_display_name: userProfileMap.get(list.user_id) || 'Anonymous',
              item_count: count || 0,
              preview_content: previewContent
            }
          } catch (error) {
            console.error('Error processing public list:', list.id, error)
            return {
              ...list,
              user_display_name: userProfileMap.get(list.user_id) || 'Anonymous',
              item_count: 0,
              preview_content: []
            }
          }
        })
      )

      // Sort by item_count if requested (client-side sorting)
      if (sortBy === 'item_count') {
        listsWithCounts.sort((a, b) => {
          const aCount = a.item_count || 0
          const bCount = b.item_count || 0
          return sortOrder === 'asc' ? aCount - bCount : bCount - aCount
        })
      }

      return listsWithCounts
    } catch (error) {
      console.error('Error in getPublicShareLists:', error)
      return []
    }
  }

  async createShareList(
    userId: string,
    name: string,
    description?: string,
    isPublic: boolean = true,
    isPublished: boolean = false
  ): Promise<ShareList | null> {
    try {
      const { data, error } = await supabase
        .from('share_lists')
        .insert({
          user_id: userId,
          name,
          description,
          is_public: isPublic,
          is_published: isPublished
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating share list:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createShareList:', error)
      return null
    }
  }

  async updateShareList(
    listId: string,
    updates: {
      name?: string
      description?: string | null
      is_public?: boolean
      is_published?: boolean
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_lists')
        .update(updates)
        .eq('id', listId)

      if (error) {
        console.error('Error updating share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in updateShareList:', error)
      return false
    }
  }

  async deleteShareList(listId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_lists')
        .delete()
        .eq('id', listId)

      if (error) {
        console.error('Error deleting share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in deleteShareList:', error)
      return false
    }
  }

  async getShareListById(listId: string): Promise<ShareList | null> {
    try {
      console.log(`🔍 Fetching share list by ID: ${listId}`)
      const { data, error } = await supabase
        .from('share_lists')
        .select(`
          *,
          users(
            user_profiles(display_name)
          )
        `)
        .eq('id', listId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching share list:', error)
        return null
      }

      if (!data) {
        console.log(`❌ No share list found with ID: ${listId}`)
        return null
      }

      console.log(`✅ Found share list: ${data.name}`)
      return {
        ...data,
        user_display_name: data.users?.user_profiles?.display_name
      }
    } catch (error) {
      console.error('Error in getShareListById:', error)
      return null
    }
  }

  async getShareListBySlug(slug: string): Promise<ShareList | null> {
    try {
      console.log(`🔍 Fetching share list by slug: ${slug}`)
      const { data, error } = await supabase
        .from('share_lists')
        .select(`
          *,
          user_profiles(display_name)
        `)
        .eq('slug', slug)
        .maybeSingle()

      if (error) {
        console.error('Error fetching share list by slug:', error)
        return null
      }

      if (!data) {
        console.log(`❌ No share list found with slug: ${slug}`)
        return null
      }

      console.log(`✅ Found share list by slug: ${data.name}`)
      return {
        ...data,
        user_display_name: data.users?.user_profiles?.display_name
      }
    } catch (error) {
      console.error('Error in getShareListBySlug:', error)
      return null
    }
  }

  async getShareListItems(listId: string): Promise<ShareListItem[]> {
    try {
      const { data, error } = await supabase
        .from('share_list_items')
        .select('*')
        .eq('list_id', listId)
        .order('added_at', { ascending: false })

      if (error) {
        console.error('Error fetching share list items:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getShareListItems:', error)
      return []
    }
  }

  async addToShareList(
    listId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_list_items')
        .insert({
          list_id: listId,
          content_id: contentId,
          content_type: contentType
        })

      if (error) {
        console.error('Error adding to share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in addToShareList:', error)
      return false
    }
  }

  async removeFromShareList(
    listId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)

      if (error) {
        console.error('Error removing from share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in removeFromShareList:', error)
      return false
    }
  }

  async getUserWatchlist(userId: string): Promise<UserWatchlistItem[]> {
    try {
      const { data, error } = await supabase
        .from('user_watchlists')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false })

      if (error) {
        console.error('Error fetching user watchlist:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserWatchlist:', error)
      return []
    }
  }

  async addToWatchlist(
    userId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show',
    status: 'want_to_watch' | 'watching' | 'watched' | 'dropped' = 'want_to_watch',
    options?: { onConflict?: string }
  ): Promise<boolean> {
    try {
      let query = supabase
        .from('user_watchlists')
        .upsert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          status
        }, options)

      const { error } = await query

      if (error) {
        console.error('Error adding to watchlist:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in addToWatchlist:', error)
      return false
    }
  }

  async removeFromWatchlist(
    userId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_watchlists')
        .delete()
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)

      if (error) {
        console.error('Error removing from watchlist:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in removeFromWatchlist:', error)
      return false
    }
  }

  async updateWatchlistStatus(
    userId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show',
    status: 'want_to_watch' | 'watching' | 'watched' | 'dropped'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_watchlists')
        .update({ status })
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)

      if (error) {
        console.error('Error updating watchlist status:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in updateWatchlistStatus:', error)
      return false
    }
  }

  // Static Pages Methods
  async getAllStaticPages(includeUnpublished: boolean = false): Promise<StaticPage[]> {
    try {
      let query = supabase
        .from('static_pages')
        .select('*')
        .order('created_at', { ascending: false })

      if (!includeUnpublished) {
        query = query.eq('is_published', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching static pages:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllStaticPages:', error)
      return []
    }
  }

  async getStaticPage(slug: string): Promise<StaticPage | null> {
    try {
      const { data, error } = await this.supabase
        .from('static_pages')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Page not found
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Error fetching static page:', error)
      return null
    }
  }

  async createStaticPage(pageData: Partial<StaticPage>, createdBy?: string): Promise<StaticPage | null> {
    try {
      const { data, error } = await this.supabase
        .from('static_pages')
        .insert({
          ...pageData,
          created_by: createdBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating static page:', error)
      return null
    }
  }

  async updateStaticPage(id: string, pageData: Partial<StaticPage>, updatedBy?: string): Promise<StaticPage | null> {
    try {
      const { data, error } = await this.supabase
        .from('static_pages')
        .update({
          ...pageData,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating static page:', error)
      return null
    }
  }

  async deleteStaticPage(pageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('static_pages')
        .delete()
        .eq('id', pageId)

      if (error) {
        console.error('Error deleting static page:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in deleteStaticPage:', error)
      return false
    }
  }

  // Content Methods
  async getContentById(contentId: number, contentType: 'movie' | 'tv_show'): Promise<ContentItem | null> {
    try {
      const table = contentType === 'movie' ? 'movies' : 'tv_shows'
      const titleField = contentType === 'movie' ? 'title' : 'name'
      
      const { data, error } = await supabase
        .from(table)
        .select(`
          *,
          ${contentType === 'movie' ? 'title_translations, overview_translations, tagline_translations' : 'name_translations, overview_translations, tagline_translations'}
        `)
        .eq('id', contentId)
        .maybeSingle()

      if (error) {
        console.error(`Error fetching ${contentType} ${contentId}:`, error)
        return null
      }

      if (!data) {
        console.log(`No ${contentType} found with ID: ${contentId}`)
        return null
      }

      return {
        ...data,
        title: data[titleField],
        content_type: contentType
      }
    } catch (error) {
      console.error('Error in getContentById:', error)
      return null
    }
  }

  async getTrendingContent(languageCode: string = 'en', limit: number = 20): Promise<ContentItem[]> {
    try {
      // Get trending movies
      const { data: movies } = await supabase
        .from('movies')
        .select(`
          *,
          title_translations,
          overview_translations,
          tagline_translations
        `)
        .not('overview', 'is', null)
        .not('poster_path', 'is', null)
        .gte('vote_count', 10)
        .order('popularity', { ascending: false })
        .limit(Math.ceil(limit / 2))

      // Get trending TV shows
      const { data: tvShows } = await supabase
        .from('tv_shows')
        .select(`
          *,
          name_translations,
          overview_translations,
          tagline_translations
        `)
        .not('overview', 'is', null)
        .not('poster_path', 'is', null)
        .gte('vote_count', 10)
        .order('popularity', { ascending: false })
        .limit(Math.floor(limit / 2))

      // Format and combine results
      const formattedMovies = (movies || []).map(movie => ({
        ...movie,
        title: getLocalizedTitle(movie, languageCode) || movie.title,
        content_type: 'movie' as const
      }))

      const formattedTVShows = (tvShows || []).map(show => ({
        ...show,
        title: getLocalizedTitle(show, languageCode) || show.name,
        content_type: 'tv_show' as const
      }))

      return [...formattedMovies, ...formattedTVShows]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit)
    } catch (error) {
      console.error('Error in getTrendingContent:', error)
      return []
    }
  }

  async getContentProviders(contentId: number, contentType: 'movie' | 'tv_show', countryCode: string): Promise<any[]> {
    try {
      console.log(`🔍 Getting content providers for ${contentType} ${contentId} in country ${countryCode}`)
      console.log(`🔍 Getting providers for ${contentType} ${contentId} in country ${countryCode}`)
      // First try the view, then fallback to direct table query
      let { data, error } = await supabase
        .from('all_content_providers')
        .select('*')
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('country_code', countryCode)
        .order('provider_name')
      
      console.log(`📊 Found ${data?.length || 0} providers from view for ${contentType} ${contentId} in ${countryCode}`)
      
      // If view fails due to RLS, try direct table query
      if (error || !data || data.length === 0) {
        console.log(`🔄 Fallback to direct content_providers query for ${contentType} ${contentId} in ${countryCode}. View error:`, error)
        const { data: directData, error: directError } = await supabase
          .from('content_providers')
          .select(`
            *,
            providers (
              id,
              name,
              logo_path,
              provider_type,
              website_url,
              country_of_origin,
              supported_countries
            )
          `)
          .eq('content_id', contentId)
          .eq('content_type', contentType)
          .eq('country_code', countryCode)
        
        console.log(`📊 Direct query found ${directData?.length || 0} providers for ${contentType} ${contentId} in ${countryCode}`)
        
        // Log Turkish platforms specifically
        if (directData && directData.length > 0) {
          const turkishPlatforms = directData.filter(item => {
            const name = item.providers?.name?.toLowerCase() || ''
            return name.includes('gain') || name.includes('exxen') || name.includes('tabii') || name.includes('tod') || 
                   name.includes('blutv') || name.includes('puhu')
          })
          
          if (turkishPlatforms.length > 0) {
            console.log(`🇹🇷 Turkish platforms found:`, turkishPlatforms.map(p => ({
              name: p.providers?.name,
              type: p.providers?.provider_type,
              countries: p.providers?.supported_countries
            })))
          } else {
            console.log(`🇹🇷 No Turkish platforms found for ${contentType} ${contentId}`)
          }
        }
        
        if (directError) {
          console.error('Error fetching content providers (direct):', directError)
          return []
        }
        
        // Transform the data to match the expected format for direct query
        data = (directData || []).map(item => ({
          id: item.id,
          content_id: item.content_id,
          content_type: item.content_type,
          provider_id: item.provider_id,
          provider_name: item.providers?.name || 'Unknown',
          provider_logo: item.providers?.logo_path || null,
          logo_path: item.providers?.logo_path || null,
          name: item.providers?.name || 'Unknown',
          monetization_type: item.monetization_type,
          link: item.link,
          presentation_type: item.presentation_type,
          price_info: item.price_info,
          availability_start: item.availability_start,
          availability_end: item.availability_end,
          provider_type: item.providers?.provider_type || 'streaming',
          country_code: item.country_code,
          website_url: item.providers?.website_url || null,
          is_network: item.providers?.is_network || false,
          network_id: item.providers?.network_id || null,
          country_of_origin: item.providers?.country_of_origin || null,
          supported_countries: item.providers?.supported_countries || []
        }));
      } else {
        console.log(`📊 View query found ${data?.length || 0} providers for ${contentType} ${contentId} in ${countryCode}`)
        
        // Log Turkish platforms specifically from view data
        if (data && data.length > 0) {
          const turkishPlatforms = data.filter(item => {
            const name = item.provider_name?.toLowerCase() || ''
            return name.includes('gain') || name.includes('exxen') || name.includes('tabii') || name.includes('tod') || 
                   name.includes('blutv') || name.includes('puhu')
          })
          
          if (turkishPlatforms.length > 0) {
            console.log(`🇹🇷 Turkish platforms found via view:`, turkishPlatforms.map(p => ({
              name: p.provider_name,
              type: p.provider_type,
              country: p.country_code
            })))
          } else {
            console.log(`🇹🇷 No Turkish platforms found via view for ${contentType} ${contentId}`)
          }
        }
      }

      // Log detailed provider information for debugging
      console.log(`✅ Returning ${data?.length || 0} providers for ${contentType} ${contentId} in ${countryCode}:`)
      if (data && data.length > 0) {
        data.forEach(p => {
          const name = p.provider_name || p.name
          const isTurkish = name?.toLowerCase().includes('gain') || name?.toLowerCase().includes('exxen') || 
                           name?.toLowerCase().includes('tabii') || name?.toLowerCase().includes('tod') ||
                           name?.toLowerCase().includes('blutv') || name?.toLowerCase().includes('puhu')
          
          console.log(`  ${isTurkish ? '🇹🇷' : '📺'} ${name} (Type: ${p.provider_type}, Country: ${p.country_code}, Monetization: ${p.monetization_type})`)
        })
      } else {
        console.log(`  ❌ No providers found for ${contentType} ${contentId} in ${countryCode} - this is why platforms don't show`)
        
        // Check if content exists in content_providers table at all
        const { data: anyProviders } = await supabase
          .from('content_providers')
          .select('country_code, providers(name)')
          .eq('content_id', contentId)
          .eq('content_type', contentType)
          .limit(5)
        
        if (anyProviders && anyProviders.length > 0) {
          console.log(`  ℹ️ Content has providers in other countries:`, anyProviders.map(p => `${p.providers?.name} (${p.country_code})`))
        } else {
          console.log(`  ⚠️ Content has NO providers in any country - needs provider sync`)
        }
      }
      
      // If no providers found, check if we need to sync this content's providers
      if ((!data || data.length === 0)) {
        console.log('🔄 No providers found, this content may need provider sync')
        console.log(`💡 To add providers for ${contentType} ${contentId}, run provider sync from admin panel`)
        
        // Check if this content exists in our database at all
        const table = contentType === 'movie' ? 'movies' : 'tv_shows'
        const { data: contentExists } = await this.supabase
          .from(table)
          .select('id')
          .eq('id', contentId)
          .single()
        
        if (!contentExists) {
          console.log(`❌ Content ${contentType} ${contentId} not found in database - needs to be imported first`)
        } else {
          console.log(`✅ Content ${contentType} ${contentId} exists in database but has no providers`)
        }
      }
      console.log(`📊 Found ${data?.length || 0} providers for ${contentType} ${contentId} in ${countryCode}:`, 
        data?.map(p => ({ name: p.provider_name, type: p.provider_type, monetization: p.monetization_type })))
      
      return data || []
    } catch (error) {
      console.error('Error in getContentProviders:', error)
      return []
    }
  }

  async searchContent(query: string, countryCode: string, languageCode: string, limit: number = 20): Promise<ContentItem[]> {
    try {
      // Search movies
      const { data: movies } = await supabase
        .from('movies')
        .select(`
          *,
          title_translations,
          overview_translations,
          tagline_translations
        `)
        .or(`title.ilike.%${query}%,overview.ilike.%${query}%`)
        .not('poster_path', 'is', null)
        .order('popularity', { ascending: false })
        .limit(Math.ceil(limit / 2))

      // Search TV shows
      const { data: tvShows } = await supabase
        .from('tv_shows')
        .select(`
          *,
          name_translations,
          overview_translations,
          tagline_translations
        `)
        .or(`name.ilike.%${query}%,overview.ilike.%${query}%`)
        .not('poster_path', 'is', null)
        .order('popularity', { ascending: false })
        .limit(Math.floor(limit / 2))

      // Format and combine results
      const formattedMovies = (movies || []).map(movie => ({
        ...movie,
        title: getLocalizedTitle(movie, languageCode) || movie.title,
        content_type: 'movie' as const,
        hasProviders: true
      }))

      const formattedTVShows = (tvShows || []).map(show => ({
        ...show,
        title: getLocalizedTitle(show, languageCode) || show.name,
        content_type: 'tv_show' as const,
        hasProviders: true
      }))

      return [...formattedMovies, ...formattedTVShows]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit)
    } catch (error) {
      console.error('Error in searchContent:', error)
      return []
    }
  }

  // User Profile Methods
  async getUserProfile(userId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getUserProfile:', error)
      return null
    }
  }

  async getUserProfileBySlug(slug: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('public_watchlist_slug', slug)
        .single()

      if (error) {
        console.error('Error fetching user profile by slug:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getUserProfileBySlug:', error)
      return null
    }
  }

  async getUserProfileByDisplayName(displayName: string): Promise<any | null> {
    try {
      console.log(`🔍 Searching for user with display_name: "${displayName}"`)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('display_name', displayName)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile by display name:', error)
        return null
      }
      
      if (data) {
        console.log(`✅ Found user profile for "${displayName}":`, data)
      } else {
        console.log(`❌ No user found with display_name: "${displayName}"`)
      }
      
      return data
    } catch (error) {
      console.error('Error in getUserProfileByDisplayName:', error)
      return null
    }
  }

  async updateUserProfilePublicWatchlist(userId: string, isPublic: boolean, slug?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_watchlist_public: isPublic,
          public_watchlist_slug: slug,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating user profile public watchlist:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in updateUserProfilePublicWatchlist:', error)
      return false
    }
  }

  // Share List Content Methods
  async addContentToShareList(listId: string, contentId: number, contentType: 'movie' | 'tv_show'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_list_items')
        .insert({
          list_id: listId,
          content_id: contentId,
          content_type: contentType
        })

      if (error) {
        console.error('Error adding content to share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in addContentToShareList:', error)
      return false
    }
  }

  async removeContentFromShareList(listId: string, contentId: number, contentType: 'movie' | 'tv_show'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('share_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)

      if (error) {
        console.error('Error removing content from share list:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Error in removeContentFromShareList:', error)
      return false
    }
  }

  // Platform Research Methods
  // Discovery Wizard Methods
  async getAvailableGenres(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name')
      
      if (error) {
        console.error('Error fetching genres:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error in getAvailableGenres:', error)
      return []
    }
  }

  async getAllActiveProviders(countryCode: string): Promise<any[]> {
    try {
      console.log(`🔍 Getting active providers for country: ${countryCode}`)
      
      let query = supabase
        .from('providers')
        .select('id, name, logo_path, provider_type, supported_countries, country_of_origin, display_priority, is_active')
        .eq('is_active', true)
        .order('display_priority')
      
      // Filter by country - check if supported_countries array contains the countryCode
      // Use overlaps to check if the supported_countries array contains our countryCode
      query = query.overlaps('supported_countries', [countryCode.toUpperCase()])
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching providers:', error)
        return []
      }
      
      console.log(`✅ Found ${data?.length || 0} active providers for ${countryCode}:`, 
        data?.map(p => ({ name: p.name, type: p.provider_type, countries: p.supported_countries })) || [])
      
      return data || []
    } catch (error) {
      console.error('Error in getAllActiveProviders:', error)
      return []
    }
  }
}

// Helper function to get localized text from JSONB translations
export function getLocalizedText(translations: any, languageCode: string, fallbackLanguage: string = 'en'): string {
  if (!translations) return '';
  
  // If translations is a string, try to parse it as JSON
  if (typeof translations === 'string') {
    try {
      translations = JSON.parse(translations);
    } catch (e) {
      console.warn('Failed to parse translations JSON:', e);
      return translations; // Return as is if not valid JSON
    }
  }
  
  // If translations is not an object, return empty string
  if (typeof translations !== 'object' || translations === null) {
    return '';
  }
  
  console.log(`🔤 Getting localized text for ${languageCode}:`, translations);
  
  // Try to get text in requested language
  if (translations[languageCode]) {
    console.log(`✅ Found translation for ${languageCode}:`, translations[languageCode]);
    return translations[languageCode];
  }
  
  // Fallback to fallback language (usually English)
  if (translations[fallbackLanguage]) {
    console.log(`🔄 Using fallback language ${fallbackLanguage}:`, translations[fallbackLanguage]);
    return translations[fallbackLanguage];
  }
  
  console.log(`❌ No translation found for ${languageCode} or ${fallbackLanguage}`);
  // If no translation found, return empty string
  return '';
}

// Helper function to get localized title for content
export function getLocalizedTitle(content: ContentItem, languageCode: string): string {
  if (content.content_type === 'movie') {
    const localizedTitle = getLocalizedText(content.title_translations, languageCode);
    return localizedTitle || content.title || '';
  } else {
    const localizedName = getLocalizedText(content.name_translations, languageCode);
    return localizedName || content.title || '';
  }
}

// Helper function to get localized overview for content
export function getLocalizedOverview(content: ContentItem, languageCode: string): string {
  return getLocalizedText(content.overview_translations, languageCode) || content.overview || '';
}

// Helper function to get localized tagline for content
export function getLocalizedTagline(content: ContentItem, languageCode: string): string {
  return getLocalizedText(content.tagline_translations, languageCode) || content.tagline || '';
}

// Helper function to get localized list name
export function getLocalizedListName(list: ShareList, languageCode: string): string {
  // Import translations directly to avoid hook usage in utility function
  const translations = {
    en: {
      'My Favorites': 'My Favorites',
      'Favorilerim': 'My Favorites',
      'Mis Favoritos': 'My Favorites',
      'Mes Favoris': 'My Favorites',
      'Meine Favoriten': 'My Favorites',
      'I Miei Preferiti': 'My Favorites',
      'Watch Later': 'Watch Later',
      'Sonra İzle': 'Watch Later',
      'Ver más tarde': 'Watch Later',
      'Regarder plus tard': 'Watch Later',
      'Später ansehen': 'Watch Later',
      'Guarda dopo': 'Watch Later',
      'Best Movies': 'Best Movies',
      'En İyi Filmler': 'Best Movies',
      'Mejores Películas': 'Best Movies',
      'Meilleurs Films': 'Best Movies',
      'Beste Filme': 'Best Movies',
      'Migliori Film': 'Best Movies',
      'Action Movies': 'Action Movies',
      'Aksiyon Filmleri': 'Action Movies',
      'Películas de Acción': 'Action Movies',
      'Films d\'Action': 'Action Movies',
      'Action-Filme': 'Action Movies',
      'Film d\'Azione': 'Action Movies',
      'Comedy Shows': 'Comedy Shows',
      'Komedi Dizileri': 'Comedy Shows',
      'Series de Comedia': 'Comedy Shows',
      'Séries Comiques': 'Comedy Shows',
      'Comedy-Serien': 'Comedy Shows',
      'Serie Comiche': 'Comedy Shows',
      'Must Watch': 'Must Watch',
      'Mutlaka İzle': 'Must Watch',
      'Imprescindible': 'Must Watch',
      'À voir absolument': 'Must Watch',
      'Unbedingt ansehen': 'Must Watch',
      'Da vedere assolutamente': 'Must Watch'
    },
    tr: {
      'My Favorites': 'Favorilerim',
      'Favorilerim': 'Favorilerim',
      'Mis Favoritos': 'Favorilerim',
      'Mes Favoris': 'Favorilerim',
      'Meine Favoriten': 'Favorilerim',
      'I Miei Preferiti': 'Favorilerim',
      'Watch Later': 'Sonra İzle',
      'Sonra İzle': 'Sonra İzle',
      'Ver más tarde': 'Sonra İzle',
      'Regarder plus tard': 'Sonra İzle',
      'Später ansehen': 'Sonra İzle',
      'Guarda dopo': 'Sonra İzle',
      'Best Movies': 'En İyi Filmler',
      'En İyi Filmler': 'En İyi Filmler',
      'Mejores Películas': 'En İyi Filmler',
      'Meilleurs Films': 'En İyi Filmler',
      'Beste Filme': 'En İyi Filmler',
      'Migliori Film': 'En İyi Filmler',
      'Action Movies': 'Aksiyon Filmleri',
      'Aksiyon Filmleri': 'Aksiyon Filmleri',
      'Películas de Acción': 'Aksiyon Filmleri',
      'Films d\'Action': 'Aksiyon Filmleri',
      'Action-Filme': 'Aksiyon Filmleri',
      'Film d\'Azione': 'Aksiyon Filmleri',
      'Comedy Shows': 'Komedi Dizileri',
      'Komedi Dizileri': 'Komedi Dizileri',
      'Series de Comedia': 'Komedi Dizileri',
      'Séries Comiques': 'Komedi Dizileri',
      'Comedy-Serien': 'Komedi Dizileri',
      'Serie Comiche': 'Komedi Dizileri',
      'Must Watch': 'Mutlaka İzle',
      'Mutlaka İzle': 'Mutlaka İzle',
      'Imprescindible': 'Mutlaka İzle',
      'À voir absolument': 'Mutlaka İzle',
      'Unbedingt ansehen': 'Mutlaka İzle',
      'Da vedere assolutamente': 'Mutlaka İzle'
    },
    de: {
      'My Favorites': 'Meine Favoriten',
      'Favorilerim': 'Meine Favoriten',
      'Mis Favoritos': 'Meine Favoriten',
      'Mes Favoris': 'Meine Favoriten',
      'Meine Favoriten': 'Meine Favoriten',
      'I Miei Preferiti': 'Meine Favoriten',
      'Watch Later': 'Später ansehen',
      'Sonra İzle': 'Später ansehen',
      'Ver más tarde': 'Später ansehen',
      'Regarder plus tard': 'Später ansehen',
      'Später ansehen': 'Später ansehen',
      'Guarda dopo': 'Später ansehen',
      'Best Movies': 'Beste Filme',
      'En İyi Filmler': 'Beste Filme',
      'Mejores Películas': 'Beste Filme',
      'Meilleurs Films': 'Beste Filme',
      'Beste Filme': 'Beste Filme',
      'Migliori Film': 'Beste Filme',
      'Action Movies': 'Action-Filme',
      'Aksiyon Filmleri': 'Action-Filme',
      'Películas de Acción': 'Action-Filme',
      'Films d\'Action': 'Action-Filme',
      'Action-Filme': 'Action-Filme',
      'Film d\'Azione': 'Action-Filme',
      'Comedy Shows': 'Comedy-Serien',
      'Komedi Dizileri': 'Comedy-Serien',
      'Series de Comedia': 'Comedy-Serien',
      'Séries Comiques': 'Comedy-Serien',
      'Comedy-Serien': 'Comedy-Serien',
      'Serie Comiche': 'Comedy-Serien',
      'Must Watch': 'Unbedingt ansehen',
      'Mutlaka İzle': 'Unbedingt ansehen',
      'Imprescindible': 'Unbedingt ansehen',
      'À voir absolument': 'Unbedingt ansehen',
      'Unbedingt ansehen': 'Unbedingt ansehen',
      'Da vedere assolutamente': 'Unbedingt ansehen'
    },
    es: {
      'My Favorites': 'Mis Favoritos',
      'Favorilerim': 'Mis Favoritos',
      'Mis Favoritos': 'Mis Favoritos',
      'Mes Favoris': 'Mis Favoritos',
      'Meine Favoriten': 'Mis Favoritos',
      'I Miei Preferiti': 'Mis Favoritos',
      'Watch Later': 'Ver más tarde',
      'Sonra İzle': 'Ver más tarde',
      'Ver más tarde': 'Ver más tarde',
      'Regarder plus tard': 'Ver más tarde',
      'Später ansehen': 'Ver más tarde',
      'Guarda dopo': 'Ver más tarde',
      'Best Movies': 'Mejores Películas',
      'En İyi Filmler': 'Mejores Películas',
      'Mejores Películas': 'Mejores Películas',
      'Meilleurs Films': 'Mejores Películas',
      'Beste Filme': 'Mejores Películas',
      'Migliori Film': 'Mejores Películas',
      'Action Movies': 'Películas de Acción',
      'Aksiyon Filmleri': 'Películas de Acción',
      'Películas de Acción': 'Películas de Acción',
      'Films d\'Action': 'Películas de Acción',
      'Action-Filme': 'Películas de Acción',
      'Film d\'Azione': 'Películas de Acción',
      'Comedy Shows': 'Series de Comedia',
      'Komedi Dizileri': 'Series de Comedia',
      'Series de Comedia': 'Series de Comedia',
      'Séries Comiques': 'Series de Comedia',
      'Comedy-Serien': 'Series de Comedia',
      'Serie Comiche': 'Series de Comedia',
      'Must Watch': 'Imprescindible',
      'Mutlaka İzle': 'Imprescindible',
      'Imprescindible': 'Imprescindible',
      'À voir absolument': 'Imprescindible',
      'Unbedingt ansehen': 'Imprescindible',
      'Da vedere assolutamente': 'Imprescindible'
    },
    fr: {
      'My Favorites': 'Mes Favoris',
      'Favorilerim': 'Mes Favoris',
      'Mis Favoritos': 'Mes Favoris',
      'Mes Favoris': 'Mes Favoris',
      'Meine Favoriten': 'Mes Favoris',
      'I Miei Preferiti': 'Mes Favoris',
      'Watch Later': 'Regarder plus tard',
      'Sonra İzle': 'Regarder plus tard',
      'Ver más tarde': 'Regarder plus tard',
      'Regarder plus tard': 'Regarder plus tard',
      'Später ansehen': 'Regarder plus tard',
      'Guarda dopo': 'Regarder plus tard',
      'Best Movies': 'Meilleurs Films',
      'En İyi Filmler': 'Meilleurs Films',
      'Mejores Películas': 'Meilleurs Films',
      'Meilleurs Films': 'Meilleurs Films',
      'Beste Filme': 'Meilleurs Films',
      'Migliori Film': 'Meilleurs Films',
      'Action Movies': 'Films d\'Action',
      'Aksiyon Filmleri': 'Films d\'Action',
      'Películas de Acción': 'Films d\'Action',
      'Films d\'Action': 'Films d\'Action',
      'Action-Filme': 'Films d\'Action',
      'Film d\'Azione': 'Films d\'Action',
      'Comedy Shows': 'Séries Comiques',
      'Komedi Dizileri': 'Séries Comiques',
      'Series de Comedia': 'Séries Comiques',
      'Séries Comiques': 'Séries Comiques',
      'Comedy-Serien': 'Séries Comiques',
      'Serie Comiche': 'Séries Comiques',
      'Must Watch': 'À voir absolument',
      'Mutlaka İzle': 'À voir absolument',
      'Imprescindible': 'À voir absolument',
      'À voir absolument': 'À voir absolument',
      'Unbedingt ansehen': 'À voir absolument',
      'Da vedere assolutamente': 'À voir absolument'
    },
    it: {
      'My Favorites': 'I Miei Preferiti',
      'Favorilerim': 'I Miei Preferiti',
      'Mis Favoritos': 'I Miei Preferiti',
      'Mes Favoris': 'I Miei Preferiti',
      'Meine Favoriten': 'I Miei Preferiti',
      'I Miei Preferiti': 'I Miei Preferiti',
      'Watch Later': 'Guarda dopo',
      'Sonra İzle': 'Guarda dopo',
      'Ver más tarde': 'Guarda dopo',
      'Regarder plus tard': 'Guarda dopo',
      'Später ansehen': 'Guarda dopo',
      'Guarda dopo': 'Guarda dopo',
      'Best Movies': 'Migliori Film',
      'En İyi Filmler': 'Migliori Film',
      'Mejores Películas': 'Migliori Film',
      'Meilleurs Films': 'Migliori Film',
      'Beste Filme': 'Migliori Film',
      'Migliori Film': 'Migliori Film',
      'Action Movies': 'Film d\'Azione',
      'Aksiyon Filmleri': 'Film d\'Azione',
      'Películas de Acción': 'Film d\'Azione',
      'Films d\'Action': 'Film d\'Azione',
      'Action-Filme': 'Film d\'Azione',
      'Film d\'Azione': 'Film d\'Azione',
      'Comedy Shows': 'Serie Comiche',
      'Komedi Dizileri': 'Serie Comiche',
      'Series de Comedia': 'Serie Comiche',
      'Séries Comiques': 'Serie Comiche',
      'Comedy-Serien': 'Serie Comiche',
      'Serie Comiche': 'Serie Comiche',
      'Must Watch': 'Da vedere assolutamente',
      'Mutlaka İzle': 'Da vedere assolutamente',
      'Imprescindible': 'Da vedere assolutamente',
      'À voir absolument': 'Da vedere assolutamente',
      'Unbedingt ansehen': 'Da vedere assolutamente',
      'Da vedere assolutamente': 'Da vedere assolutamente'
    }
  };
  
  if (!list.name) return '';
  
  // Get translations for the current language
  const langTranslations = translations[languageCode as keyof typeof translations] || translations.en;
  
  // Check if we have a translation for this list name
  const translation = langTranslations[list.name as keyof typeof langTranslations];
  if (translation) {
    return translation;
  }
  
  // If no translation found, return original name
  return list.name;
}

// Helper function to get localized list description
export const getLocalizedListDescription = (list: any, languageCode: string): string => {
  if (!list) return '';
  
  try {
    const descriptions = list.description_translations;
    if (descriptions && typeof descriptions === 'object') {
      return descriptions[languageCode] || descriptions['en'] || list.description || '';
    }
  } catch (error) {
    console.warn('Error parsing description translations:', error);
  }
  
  return list.description || '';
};

// Helper functions for localized static page content
export const getLocalizedStaticPageTitle = (page: StaticPage, languageCode: string): string => {
  if (!page.title_translations) return page.title
  
  try {
    const translations = typeof page.title_translations === 'string' 
      ? JSON.parse(page.title_translations)
      : page.title_translations
    
    return translations[languageCode] || page.title
  } catch (error) {
    console.warn('Error parsing title translations:', error)
    return page.title
  }
}

export const getLocalizedStaticPageContent = (page: StaticPage, languageCode: string): string => {
  if (!page.content_translations) return page.content
  
  try {
    const translations = typeof page.content_translations === 'string' 
      ? JSON.parse(page.content_translations)
      : page.content_translations
    
    return translations[languageCode] || page.content
  } catch (error) {
    console.warn('Error parsing content translations:', error)
    return page.content
  }
}

export const getLocalizedStaticPageMetaDescription = (page: StaticPage, languageCode: string): string => {
  if (!page.meta_description_translations) return page.meta_description || ''
  
  try {
    const translations = typeof page.meta_description_translations === 'string' 
      ? JSON.parse(page.meta_description_translations)
      : page.meta_description_translations
    
    return translations[languageCode] || page.meta_description || ''
  } catch (error) {
    console.warn('Error parsing meta description translations:', error)
    return page.meta_description || ''
  }
}

// Get consolidated providers (merge providers with same name)
export const getConsolidatedProviders = async (): Promise<ConsolidatedProvider[]> => {
  try {
    const { data: providers, error } = await supabase
      .from('providers')
      .select('*')
      .eq('is_active', true)
      .order('display_priority', { ascending: true });
    
    if (error) {
      console.error('Error fetching providers:', error);
      return [];
    }
    
    if (!providers || providers.length === 0) {
      return [];
    }
    
    // Group providers by name (case-insensitive)
    const providerGroups = new Map<string, any[]>();
    
    providers.forEach(provider => {
      const normalizedName = provider.name.toLowerCase().trim();
      if (!providerGroups.has(normalizedName)) {
        providerGroups.set(normalizedName, []);
      }
      providerGroups.get(normalizedName)!.push(provider);
    });
    
    // Consolidate each group into a single provider entry
    const consolidatedProviders: ConsolidatedProvider[] = [];
    
    for (const [normalizedName, providerGroup] of providerGroups) {
      // Use the first provider as the base (usually has the best data)
      const baseProvider = providerGroup[0];
      
      // Collect all IDs and types from the group
      const providerIds = providerGroup.map(p => p.id);
      const providerTypes = [...new Set(providerGroup.map(p => p.provider_type))];
      
      // Use the best logo_path (prefer non-null values)
      const bestLogoPath = providerGroup.find(p => p.logo_path)?.logo_path || baseProvider.logo_path;
      
      // Use the best display priority (lowest number = highest priority)
      const bestDisplayPriority = Math.min(...providerGroup.map(p => p.display_priority || 999));
      
      // Combine supported countries
      const allSupportedCountries = new Set<string>();
      providerGroup.forEach(p => {
        if (p.supported_countries && Array.isArray(p.supported_countries)) {
          p.supported_countries.forEach(country => allSupportedCountries.add(country));
        }
      });
      
      consolidatedProviders.push({
        name: baseProvider.name, // Use original casing from first provider
        logo_path: bestLogoPath,
        provider_ids: providerIds,
        provider_types: providerTypes,
        display_priority: bestDisplayPriority,
        is_active: true,
        supported_countries: Array.from(allSupportedCountries)
      });
    }
    
    // Sort by display priority, then by name
    consolidatedProviders.sort((a, b) => {
      if (a.display_priority !== b.display_priority) {
        return a.display_priority - b.display_priority;
      }
      return a.name.localeCompare(b.name);
    });
    
    console.log(`📊 Consolidated ${providers.length} providers into ${consolidatedProviders.length} unique entries`);
    
    return consolidatedProviders;
    
  } catch (error) {
    console.error('Error getting consolidated providers:', error);
    return [];
  }
};

export const databaseService = new DatabaseService()
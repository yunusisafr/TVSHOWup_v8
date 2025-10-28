import { supabase } from './supabase'
import { ContentItem } from './database'

export interface SocialRecommendation {
  id: string
  from_user_id: string
  to_user_id: string
  content_id: number
  content_type: 'movie' | 'tv_show'
  message?: string
  rating?: number
  created_at: string
  from_user?: {
    id: string
    display_name?: string
    avatar_url?: string
  }
}

export interface UserFollowing {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface SharedList {
  id: string
  user_id: string
  title: string
  description?: string
  is_public: boolean
  items: Array<{
    content_id: number
    content_type: 'movie' | 'tv_show'
    added_at: string
  }>
  likes_count: number
  created_at: string
  user?: {
    display_name?: string
    avatar_url?: string
  }
}

class SocialService {
  async sendRecommendation(
    fromUserId: string,
    toUserId: string,
    contentId: number,
    contentType: 'movie' | 'tv_show',
    message?: string,
    rating?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('social_recommendations')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          content_id: contentId,
          content_type: contentType,
          message,
          rating
        })
        .select()
        .single()

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to send recommendation:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  async getRecommendations(userId: string, limit: number = 20): Promise<SocialRecommendation[]> {
    try {
      const { data, error } = await supabase
        .from('social_recommendations')
        .select(`
          *,
          from_user:user_profiles!from_user_id(id, display_name, avatar_url)
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Failed to get recommendations:', error)
      return []
    }
  }

  async followUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_following')
        .insert({
          follower_id: followerId,
          following_id: followingId
        })

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to follow user:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  async unfollowUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_following')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to unfollow user:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_following')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle()

      if (error) throw error

      return !!data
    } catch (error) {
      console.error('Failed to check following status:', error)
      return false
    }
  }

  async getFollowers(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_following')
        .select('follower_id')
        .eq('following_id', userId)

      if (error) throw error

      return data?.map(f => f.follower_id) || []
    } catch (error) {
      console.error('Failed to get followers:', error)
      return []
    }
  }

  async getFollowing(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_following')
        .select('following_id')
        .eq('follower_id', userId)

      if (error) throw error

      return data?.map(f => f.following_id) || []
    } catch (error) {
      console.error('Failed to get following:', error)
      return []
    }
  }

  async getFollowingRecommendations(userId: string, limit: number = 50): Promise<ContentItem[]> {
    try {
      const following = await this.getFollowing(userId)

      if (following.length === 0) {
        return []
      }

      const { data, error } = await supabase
        .from('user_behaviors')
        .select('*')
        .in('user_id', following)
        .in('action_type', ['rate', 'add_to_watchlist', 'swipe_like'])
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) throw error

      const contentMap = new Map<string, { count: number; avgRating: number; totalRating: number }>()

      data?.forEach(behavior => {
        if (!behavior.content_id) return

        const key = `${behavior.content_type}-${behavior.content_id}`
        const existing = contentMap.get(key)

        const rating = behavior.metadata?.rating || 0

        if (existing) {
          existing.count++
          existing.totalRating += rating
          existing.avgRating = existing.totalRating / existing.count
        } else {
          contentMap.set(key, {
            count: 1,
            avgRating: rating,
            totalRating: rating
          })
        }
      })

      const topContent = Array.from(contentMap.entries())
        .sort((a, b) => b[1].count - a[1].count || b[1].avgRating - a[1].avgRating)
        .slice(0, 20)
        .map(([key]) => key)

      return []
    } catch (error) {
      console.error('Failed to get following recommendations:', error)
      return []
    }
  }

  async getTrendingContent(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<Array<{
    content_id: number
    content_type: 'movie' | 'tv_show'
    score: number
    view_count: number
    rating_count: number
    avg_rating: number
  }>> {
    try {
      const hours = timeRange === 'day' ? 24 : timeRange === 'week' ? 168 : 720
      const startDate = new Date()
      startDate.setHours(startDate.getHours() - hours)

      const { data, error } = await supabase
        .from('user_behaviors')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .in('action_type', ['view', 'rate', 'add_to_watchlist'])

      if (error) throw error

      const contentScores = new Map<string, {
        views: number
        ratings: number[]
        watchlist: number
      }>()

      data?.forEach(behavior => {
        if (!behavior.content_id) return

        const key = `${behavior.content_type}-${behavior.content_id}`
        const existing = contentScores.get(key) || { views: 0, ratings: [], watchlist: 0 }

        if (behavior.action_type === 'view') {
          existing.views++
        } else if (behavior.action_type === 'rate' && behavior.metadata?.rating) {
          existing.ratings.push(behavior.metadata.rating)
        } else if (behavior.action_type === 'add_to_watchlist') {
          existing.watchlist++
        }

        contentScores.set(key, existing)
      })

      const trending = Array.from(contentScores.entries())
        .map(([key, stats]) => {
          const [contentType, contentId] = key.split('-')
          const avgRating = stats.ratings.length > 0
            ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
            : 0

          const score = (
            stats.views * 1.0 +
            stats.ratings.length * 2.0 +
            stats.watchlist * 1.5 +
            avgRating * 5
          )

          return {
            content_id: parseInt(contentId),
            content_type: contentType as 'movie' | 'tv_show',
            score,
            view_count: stats.views,
            rating_count: stats.ratings.length,
            avg_rating: avgRating
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)

      return trending
    } catch (error) {
      console.error('Failed to get trending content:', error)
      return []
    }
  }

  async likeSharedList(userId: string, listId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('shared_list_likes')
        .insert({
          user_id: userId,
          list_id: listId
        })

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to like list:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  async unlikeSharedList(userId: string, listId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('shared_list_likes')
        .delete()
        .eq('user_id', userId)
        .eq('list_id', listId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to unlike list:', error)
      return { success: false, error: (error as Error).message }
    }
  }
}

export const socialService = new SocialService()
export default socialService

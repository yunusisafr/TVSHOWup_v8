import { supabase } from './supabase'

export interface UserDiscoveryPreferences {
  id: string
  user_id: string
  mood_history: Array<{ mood: string; timestamp: string }>
  genre_scores: Record<string, number>
  preferred_actors: string[]
  preferred_directors: string[]
  platforms: string[]
  avg_rating_threshold: number
  preferred_duration_min: number
  preferred_duration_max: number
  swipe_history: Array<{ content_id: number; action: 'like' | 'dislike'; timestamp: string }>
  created_at: string
  updated_at: string
}

export interface DiscoveryBadge {
  id: string
  user_id: string
  badge_type: string
  earned_at: string
  metadata: Record<string, any>
}

export interface GroupDiscoverySession {
  id: string
  session_code: string
  participants: Array<{
    user_id: string
    username: string
    mood?: string
    preferences?: any
  }>
  selected_content_id?: string
  created_at: string
  expires_at: string
}

class DiscoveryService {
  async getUserPreferences(userId: string): Promise<UserDiscoveryPreferences | null> {
    const { data, error } = await supabase
      .from('user_discovery_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user preferences:', error)
      return null
    }

    return data
  }

  async createOrUpdatePreferences(userId: string, preferences: Partial<UserDiscoveryPreferences>): Promise<void> {
    const existing = await this.getUserPreferences(userId)

    if (existing) {
      const { error } = await supabase
        .from('user_discovery_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating preferences:', error)
        throw error
      }
    } else {
      const { error } = await supabase
        .from('user_discovery_preferences')
        .insert({
          user_id: userId,
          ...preferences
        })

      if (error) {
        console.error('Error creating preferences:', error)
        throw error
      }
    }
  }

  async addMoodToHistory(userId: string, mood: string): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    const moodHistory = prefs?.mood_history || []

    moodHistory.push({
      mood,
      timestamp: new Date().toISOString()
    })

    const recentHistory = moodHistory.slice(-30)

    await this.createOrUpdatePreferences(userId, {
      mood_history: recentHistory as any
    })
  }

  async addSwipeAction(userId: string, contentId: number, action: 'like' | 'dislike'): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    const swipeHistory = prefs?.swipe_history || []

    swipeHistory.push({
      content_id: contentId,
      action,
      timestamp: new Date().toISOString()
    })

    const recentHistory = swipeHistory.slice(-100)

    await this.createOrUpdatePreferences(userId, {
      swipe_history: recentHistory as any
    })
  }

  async updateGenreScore(userId: string, genreId: number, delta: number): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    const genreScores = prefs?.genre_scores || {}

    const currentScore = genreScores[genreId.toString()] || 50
    const newScore = Math.max(0, Math.min(100, currentScore + delta))

    genreScores[genreId.toString()] = newScore

    await this.createOrUpdatePreferences(userId, {
      genre_scores: genreScores as any
    })
  }

  async getUserBadges(userId: string): Promise<DiscoveryBadge[]> {
    const { data, error } = await supabase
      .from('discovery_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })

    if (error) {
      console.error('Error fetching badges:', error)
      return []
    }

    return data || []
  }

  async awardBadge(userId: string, badgeType: string, metadata: Record<string, any> = {}): Promise<void> {
    const { error } = await supabase
      .from('discovery_badges')
      .insert({
        user_id: userId,
        badge_type: badgeType,
        metadata
      })

    if (error && error.code !== '23505') {
      console.error('Error awarding badge:', error)
      throw error
    }
  }

  async createGroupSession(): Promise<string> {
    const sessionCode = this.generateSessionCode()

    const { error } = await supabase
      .from('group_discovery_sessions')
      .insert({
        session_code: sessionCode,
        participants: [],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })

    if (error) {
      console.error('Error creating group session:', error)
      throw error
    }

    return sessionCode
  }

  async joinGroupSession(sessionCode: string, userId: string, username: string, mood?: string): Promise<void> {
    const { data: session, error: fetchError } = await supabase
      .from('group_discovery_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (fetchError || !session) {
      throw new Error('Session not found or expired')
    }

    const participants = session.participants || []

    const existingIndex = participants.findIndex((p: any) => p.user_id === userId)
    if (existingIndex >= 0) {
      participants[existingIndex] = { user_id: userId, username, mood }
    } else {
      participants.push({ user_id: userId, username, mood })
    }

    const { error: updateError } = await supabase
      .from('group_discovery_sessions')
      .update({ participants })
      .eq('session_code', sessionCode)

    if (updateError) {
      console.error('Error joining group session:', updateError)
      throw updateError
    }
  }

  async getGroupSession(sessionCode: string): Promise<GroupDiscoverySession | null> {
    const { data, error } = await supabase
      .from('group_discovery_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error('Error fetching group session:', error)
      return null
    }

    return data
  }

  private generateSessionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  async checkAndAwardBadges(userId: string): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    const badges = await this.getUserBadges(userId)
    const badgeTypes = new Set(badges.map(b => b.badge_type))

    if (!prefs) return

    const genreScores = prefs.genre_scores || {}
    const uniqueGenresExplored = Object.keys(genreScores).length

    if (uniqueGenresExplored >= 10 && !badgeTypes.has('genre_explorer_bronze')) {
      await this.awardBadge(userId, 'genre_explorer_bronze', { genres_explored: uniqueGenresExplored })
    }

    if (uniqueGenresExplored >= 20 && !badgeTypes.has('genre_explorer_silver')) {
      await this.awardBadge(userId, 'genre_explorer_silver', { genres_explored: uniqueGenresExplored })
    }

    const swipeHistory = prefs.swipe_history || []
    const totalSwipes = swipeHistory.length

    if (totalSwipes >= 50 && !badgeTypes.has('swipe_master_bronze')) {
      await this.awardBadge(userId, 'swipe_master_bronze', { total_swipes: totalSwipes })
    }

    const moodHistory = prefs.mood_history || []
    const uniqueMoods = new Set(moodHistory.map((m: any) => m.mood)).size

    if (uniqueMoods >= 5 && !badgeTypes.has('mood_explorer')) {
      await this.awardBadge(userId, 'mood_explorer', { unique_moods: uniqueMoods })
    }
  }
}

export const discoveryService = new DiscoveryService()

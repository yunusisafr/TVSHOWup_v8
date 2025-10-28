import { supabase } from './supabase'

export interface AnalyticsEvent {
  id?: string
  user_id?: string
  event_type: string
  event_data: Record<string, any>
  session_id?: string
  timestamp?: string
  page_url?: string
  user_agent?: string
}

export interface PerformanceMetric {
  id?: string
  metric_name: string
  metric_value: number
  context?: Record<string, any>
  timestamp?: string
}

export interface UserBehavior {
  id?: string
  user_id?: string
  action_type: string
  content_id?: number
  content_type?: 'movie' | 'tv_show'
  metadata?: Record<string, any>
  timestamp?: string
}

class AnalyticsService {
  private sessionId: string
  private eventQueue: AnalyticsEvent[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly FLUSH_INTERVAL_MS = 5000

  constructor() {
    this.sessionId = this.generateSessionId()
    this.startAutoFlush()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private startAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    this.flushInterval = setInterval(() => {
      this.flushEvents()
    }, this.FLUSH_INTERVAL_MS)
  }

  async trackEvent(
    eventType: string,
    eventData: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const event: AnalyticsEvent = {
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
      session_id: this.sessionId,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }

    this.eventQueue.push(event)

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      await this.flushEvents()
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const eventsToSend = [...this.eventQueue]
    this.eventQueue = []

    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert(eventsToSend)

      if (error) {
        console.error('Failed to send analytics events:', error)
        this.eventQueue = [...eventsToSend, ...this.eventQueue]
      }
    } catch (error) {
      console.error('Analytics flush error:', error)
      this.eventQueue = [...eventsToSend, ...this.eventQueue]
    }
  }

  async trackPerformance(
    metricName: string,
    metricValue: number,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        metric_name: metricName,
        metric_value: metricValue,
        context,
        timestamp: new Date().toISOString()
      }

      const { error } = await supabase
        .from('performance_metrics')
        .insert(metric)

      if (error) {
        console.error('Failed to track performance:', error)
      }
    } catch (error) {
      console.error('Performance tracking error:', error)
    }
  }

  async trackUserBehavior(
    userId: string,
    actionType: string,
    contentId?: number,
    contentType?: 'movie' | 'tv_show',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const behavior: UserBehavior = {
        user_id: userId,
        action_type: actionType,
        content_id: contentId,
        content_type: contentType,
        metadata,
        timestamp: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_behaviors')
        .insert(behavior)

      if (error) {
        console.error('Failed to track user behavior:', error)
      }
    } catch (error) {
      console.error('User behavior tracking error:', error)
    }
  }

  async getAnalyticsSummary(userId?: string, days: number = 7) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    try {
      let query = supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', startDate.toISOString())

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) throw error

      const summary = {
        totalEvents: data?.length || 0,
        eventsByType: {} as Record<string, number>,
        uniqueSessions: new Set(data?.map(e => e.session_id)).size,
        topPages: {} as Record<string, number>
      }

      data?.forEach(event => {
        summary.eventsByType[event.event_type] = (summary.eventsByType[event.event_type] || 0) + 1
        if (event.page_url) {
          summary.topPages[event.page_url] = (summary.topPages[event.page_url] || 0) + 1
        }
      })

      return summary
    } catch (error) {
      console.error('Failed to get analytics summary:', error)
      return null
    }
  }

  async getPerformanceMetrics(metricName?: string, hours: number = 24) {
    const startDate = new Date()
    startDate.setHours(startDate.getHours() - hours)

    try {
      let query = supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })

      if (metricName) {
        query = query.eq('metric_name', metricName)
      }

      const { data, error } = await query

      if (error) throw error

      const metrics = data || []
      const byName: Record<string, { avg: number; min: number; max: number; count: number }> = {}

      metrics.forEach(m => {
        if (!byName[m.metric_name]) {
          byName[m.metric_name] = { avg: 0, min: Infinity, max: -Infinity, count: 0 }
        }

        const stat = byName[m.metric_name]
        stat.count++
        stat.avg += m.metric_value
        stat.min = Math.min(stat.min, m.metric_value)
        stat.max = Math.max(stat.max, m.metric_value)
      })

      Object.keys(byName).forEach(key => {
        byName[key].avg = byName[key].avg / byName[key].count
      })

      return { metrics, summary: byName }
    } catch (error) {
      console.error('Failed to get performance metrics:', error)
      return null
    }
  }

  async getUserBehaviorInsights(userId: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    try {
      const { data, error } = await supabase
        .from('user_behaviors')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })

      if (error) throw error

      const behaviors = data || []

      const insights = {
        totalActions: behaviors.length,
        actionsByType: {} as Record<string, number>,
        favoriteGenres: {} as Record<number, number>,
        watchingPatterns: {
          movieCount: 0,
          tvShowCount: 0,
          averageRating: 0,
          totalRatings: 0
        },
        peakActivity: {
          hourOfDay: {} as Record<number, number>,
          dayOfWeek: {} as Record<number, number>
        }
      }

      behaviors.forEach(b => {
        insights.actionsByType[b.action_type] = (insights.actionsByType[b.action_type] || 0) + 1

        if (b.content_type === 'movie') {
          insights.watchingPatterns.movieCount++
        } else if (b.content_type === 'tv_show') {
          insights.watchingPatterns.tvShowCount++
        }

        if (b.metadata?.rating) {
          insights.watchingPatterns.averageRating += b.metadata.rating
          insights.watchingPatterns.totalRatings++
        }

        if (b.metadata?.genres) {
          const genres = Array.isArray(b.metadata.genres) ? b.metadata.genres : []
          genres.forEach((genreId: number) => {
            insights.favoriteGenres[genreId] = (insights.favoriteGenres[genreId] || 0) + 1
          })
        }

        const timestamp = new Date(b.timestamp!)
        const hour = timestamp.getHours()
        const day = timestamp.getDay()

        insights.peakActivity.hourOfDay[hour] = (insights.peakActivity.hourOfDay[hour] || 0) + 1
        insights.peakActivity.dayOfWeek[day] = (insights.peakActivity.dayOfWeek[day] || 0) + 1
      })

      if (insights.watchingPatterns.totalRatings > 0) {
        insights.watchingPatterns.averageRating /= insights.watchingPatterns.totalRatings
      }

      return insights
    } catch (error) {
      console.error('Failed to get user behavior insights:', error)
      return null
    }
  }

  trackPageView(pageName: string, userId?: string) {
    this.trackEvent('page_view', { page: pageName }, userId)
  }

  trackSearch(query: string, resultCount: number, userId?: string) {
    this.trackEvent('search', { query, resultCount }, userId)
  }

  trackDiscovery(mood: string, filters: any, resultCount: number, userId?: string) {
    this.trackEvent('discovery', { mood, filters, resultCount }, userId)
  }

  trackContentView(contentId: number, contentType: 'movie' | 'tv_show', userId?: string) {
    this.trackEvent('content_view', { contentId, contentType }, userId)
    if (userId) {
      this.trackUserBehavior(userId, 'view', contentId, contentType)
    }
  }

  trackAddToWatchlist(contentId: number, contentType: 'movie' | 'tv_show', userId?: string) {
    this.trackEvent('add_to_watchlist', { contentId, contentType }, userId)
    if (userId) {
      this.trackUserBehavior(userId, 'add_to_watchlist', contentId, contentType)
    }
  }

  trackRating(contentId: number, contentType: 'movie' | 'tv_show', rating: number, userId?: string) {
    this.trackEvent('rating', { contentId, contentType, rating }, userId)
    if (userId) {
      this.trackUserBehavior(userId, 'rate', contentId, contentType, { rating })
    }
  }

  trackSwipe(contentId: number, contentType: 'movie' | 'tv_show', direction: 'like' | 'dislike', userId?: string) {
    this.trackEvent('swipe', { contentId, contentType, direction }, userId)
    if (userId) {
      this.trackUserBehavior(userId, `swipe_${direction}`, contentId, contentType)
    }
  }

  cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flushEvents()
  }
}

export const analyticsService = new AnalyticsService()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analyticsService.cleanup()
  })
}

export default analyticsService

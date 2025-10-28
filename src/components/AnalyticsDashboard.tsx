import React, { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Users, Zap, Clock, Eye, Heart, Star, Activity } from 'lucide-react'
import { analyticsService } from '../lib/analytics'
import { useAuth } from '../contexts/AuthContext'

interface DashboardStats {
  totalEvents: number
  uniqueSessions: number
  topEvents: Array<{ type: string; count: number }>
  recentActivity: number
}

interface PerformanceStats {
  avgLoadTime: number
  avgSearchTime: number
  avgDiscoveryTime: number
  cacheHitRate: number
}

interface UserInsights {
  totalActions: number
  movieCount: number
  tvShowCount: number
  averageRating: number
  favoriteGenres: Array<{ id: number; count: number }>
  peakHour: number
  peakDay: number
}

const AnalyticsDashboard: React.FC<{ languageCode: string }> = ({ languageCode }) => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [performance, setPerformance] = useState<PerformanceStats | null>(null)
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(7)

  useEffect(() => {
    loadDashboardData()
  }, [user, timeRange])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)

      const [summaryData, metricsData, behaviorData] = await Promise.all([
        analyticsService.getAnalyticsSummary(user.id, timeRange),
        analyticsService.getPerformanceMetrics(undefined, timeRange * 24),
        analyticsService.getUserBehaviorInsights(user.id, timeRange)
      ])

      if (summaryData) {
        const topEventTypes = Object.entries(summaryData.eventsByType)
          .map(([type, count]) => ({ type, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setStats({
          totalEvents: summaryData.totalEvents,
          uniqueSessions: summaryData.uniqueSessions,
          topEvents: topEventTypes,
          recentActivity: topEventTypes[0]?.count || 0
        })
      }

      if (metricsData) {
        const { summary } = metricsData
        setPerformance({
          avgLoadTime: summary['page_load_time']?.avg || 0,
          avgSearchTime: summary['search_time']?.avg || 0,
          avgDiscoveryTime: summary['discovery_time']?.avg || 0,
          cacheHitRate: summary['cache_hit_rate']?.avg || 0
        })
      }

      if (behaviorData) {
        const topGenres = Object.entries(behaviorData.favoriteGenres)
          .map(([id, count]) => ({ id: parseInt(id), count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        const peakHour = Object.entries(behaviorData.peakActivity.hourOfDay)
          .reduce((max, [hour, count]) =>
            (count as number) > (max.count as number) ? { hour: parseInt(hour), count: count as number } : max,
            { hour: 0, count: 0 }
          )

        const peakDay = Object.entries(behaviorData.peakActivity.dayOfWeek)
          .reduce((max, [day, count]) =>
            (count as number) > (max.count as number) ? { day: parseInt(day), count: count as number } : max,
            { day: 0, count: 0 }
          )

        setInsights({
          totalActions: behaviorData.totalActions,
          movieCount: behaviorData.watchingPatterns.movieCount,
          tvShowCount: behaviorData.watchingPatterns.tvShowCount,
          averageRating: behaviorData.watchingPatterns.averageRating,
          favoriteGenres: topGenres,
          peakHour: peakHour.hour,
          peakDay: peakDay.day
        })
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDayName = (day: number) => {
    const days = languageCode === 'tr'
      ? ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[day]
  }

  const getEventTypeName = (type: string) => {
    const names: Record<string, { en: string; tr: string }> = {
      'page_view': { en: 'Page Views', tr: 'Sayfa Görüntüleme' },
      'search': { en: 'Searches', tr: 'Aramalar' },
      'discovery': { en: 'Discoveries', tr: 'Keşifler' },
      'content_view': { en: 'Content Views', tr: 'İçerik Görüntüleme' },
      'add_to_watchlist': { en: 'Watchlist Adds', tr: 'İzleme Listesine Ekleme' },
      'rating': { en: 'Ratings', tr: 'Puanlamalar' },
      'swipe': { en: 'Swipes', tr: 'Kaydırmalar' }
    }
    return names[type]?.[languageCode] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <BarChart3 className="w-7 h-7 mr-3 text-blue-500" />
          {languageCode === 'tr' ? 'Analitik Panosu' : 'Analytics Dashboard'}
        </h2>

        <div className="flex gap-2">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days as 7 | 30 | 90)}
              className={`px-4 py-2 rounded-lg transition-all ${
                timeRange === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {days} {languageCode === 'tr' ? 'gün' : 'days'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{stats?.totalEvents || 0}</span>
          </div>
          <div className="text-sm opacity-90">
            {languageCode === 'tr' ? 'Toplam Aktivite' : 'Total Activity'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{stats?.uniqueSessions || 0}</span>
          </div>
          <div className="text-sm opacity-90">
            {languageCode === 'tr' ? 'Benzersiz Oturum' : 'Unique Sessions'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Eye className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">
              {(insights?.movieCount || 0) + (insights?.tvShowCount || 0)}
            </span>
          </div>
          <div className="text-sm opacity-90">
            {languageCode === 'tr' ? 'Görüntülenen İçerik' : 'Content Viewed'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Star className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">
              {insights?.averageRating.toFixed(1) || '0.0'}
            </span>
          </div>
          <div className="text-sm opacity-90">
            {languageCode === 'tr' ? 'Ortalama Puan' : 'Average Rating'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
            {languageCode === 'tr' ? 'Popüler Aktiviteler' : 'Popular Activities'}
          </h3>
          <div className="space-y-3">
            {stats?.topEvents.map((event, index) => (
              <div key={event.type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-mono text-sm">#{index + 1}</span>
                  <span className="text-gray-300">{getEventTypeName(event.type)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-700 rounded-full h-2 w-24 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${Math.min((event.count / (stats?.totalEvents || 1)) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-gray-400 font-mono text-sm w-12 text-right">
                    {event.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-400" />
            {languageCode === 'tr' ? 'Performans Metrikleri' : 'Performance Metrics'}
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">
                  {languageCode === 'tr' ? 'Sayfa Yükleme' : 'Page Load'}
                </span>
                <span className="text-gray-300">{performance?.avgLoadTime.toFixed(0)}ms</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${Math.min((performance?.avgLoadTime || 0) / 30, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">
                  {languageCode === 'tr' ? 'Arama Süresi' : 'Search Time'}
                </span>
                <span className="text-gray-300">{performance?.avgSearchTime.toFixed(0)}ms</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${Math.min((performance?.avgSearchTime || 0) / 10, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">
                  {languageCode === 'tr' ? 'Cache İsabet Oranı' : 'Cache Hit Rate'}
                </span>
                <span className="text-gray-300">{(performance?.cacheHitRate || 0).toFixed(1)}%</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full"
                  style={{ width: `${performance?.cacheHitRate || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Heart className="w-5 h-5 mr-2 text-pink-400" />
            {languageCode === 'tr' ? 'İzleme Alışkanlıkları' : 'Watching Habits'}
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'Filmler' : 'Movies'}
              </span>
              <span className="text-white font-bold">{insights?.movieCount || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'Diziler' : 'TV Shows'}
              </span>
              <span className="text-white font-bold">{insights?.tvShowCount || 0}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-700">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'En Aktif Saat' : 'Peak Hour'}
              </span>
              <span className="text-white font-bold">
                {insights?.peakHour.toString().padStart(2, '0')}:00
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'En Aktif Gün' : 'Peak Day'}
              </span>
              <span className="text-white font-bold">{getDayName(insights?.peakDay || 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-cyan-400" />
            {languageCode === 'tr' ? 'Aktivite Özeti' : 'Activity Summary'}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'Toplam Aksiyon' : 'Total Actions'}
              </span>
              <span className="text-white font-bold">{insights?.totalActions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'Günlük Ortalama' : 'Daily Average'}
              </span>
              <span className="text-white font-bold">
                {((insights?.totalActions || 0) / timeRange).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                {languageCode === 'tr' ? 'Oturum Başına' : 'Per Session'}
              </span>
              <span className="text-white font-bold">
                {((stats?.totalEvents || 0) / (stats?.uniqueSessions || 1)).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard

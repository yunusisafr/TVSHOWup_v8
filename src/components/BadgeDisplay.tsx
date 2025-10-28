import React, { useEffect, useState } from 'react'
import { Award, Star, Sparkles, Trophy, Zap, Film, Tv, Heart, TrendingUp } from 'lucide-react'
import { discoveryService, DiscoveryBadge } from '../lib/discoveryService'

interface BadgeDisplayProps {
  userId: string
  languageCode: string
  compact?: boolean
}

const BADGE_CONFIG: Record<string, {
  icon: React.ElementType
  color: string
  gradient: string
  nameEn: string
  nameTr: string
  descriptionEn: string
  descriptionTr: string
}> = {
  'genre_explorer_bronze': {
    icon: Star,
    color: 'text-amber-600',
    gradient: 'from-amber-600 to-amber-400',
    nameEn: 'Genre Explorer',
    nameTr: 'Tür Kaşifi',
    descriptionEn: 'Explored 10+ different genres',
    descriptionTr: '10+ farklı tür keşfetti'
  },
  'genre_explorer_silver': {
    icon: Star,
    color: 'text-gray-400',
    gradient: 'from-gray-400 to-gray-300',
    nameEn: 'Master Explorer',
    nameTr: 'Usta Kaşif',
    descriptionEn: 'Explored 20+ different genres',
    descriptionTr: '20+ farklı tür keşfetti'
  },
  'genre_explorer_gold': {
    icon: Star,
    color: 'text-yellow-400',
    gradient: 'from-yellow-400 to-yellow-200',
    nameEn: 'Genre Master',
    nameTr: 'Tür Ustası',
    descriptionEn: 'Explored all genres',
    descriptionTr: 'Tüm türleri keşfetti'
  },
  'swipe_master_bronze': {
    icon: Zap,
    color: 'text-orange-500',
    gradient: 'from-orange-500 to-orange-300',
    nameEn: 'Quick Decider',
    nameTr: 'Hızlı Karar Verici',
    descriptionEn: 'Made 50+ swipe decisions',
    descriptionTr: '50+ kaydırma kararı verdi'
  },
  'swipe_master_silver': {
    icon: Zap,
    color: 'text-purple-400',
    gradient: 'from-purple-400 to-purple-300',
    nameEn: 'Swipe Expert',
    nameTr: 'Kaydırma Uzmanı',
    descriptionEn: 'Made 200+ swipe decisions',
    descriptionTr: '200+ kaydırma kararı verdi'
  },
  'mood_explorer': {
    icon: Heart,
    color: 'text-pink-500',
    gradient: 'from-pink-500 to-pink-300',
    nameEn: 'Mood Master',
    nameTr: 'Ruh Hali Ustası',
    descriptionEn: 'Tried 5+ different moods',
    descriptionTr: '5+ farklı ruh hali denedi'
  },
  'early_adopter': {
    icon: TrendingUp,
    color: 'text-green-500',
    gradient: 'from-green-500 to-green-300',
    nameEn: 'Early Adopter',
    nameTr: 'Erken Kullanan',
    descriptionEn: 'Discovered new releases',
    descriptionTr: 'Yeni çıkanları keşfetti'
  },
  'binge_watcher': {
    icon: Tv,
    color: 'text-blue-500',
    gradient: 'from-blue-500 to-blue-300',
    nameEn: 'Binge Watcher',
    nameTr: 'Maraton İzleyici',
    descriptionEn: 'Watched entire TV series',
    descriptionTr: 'Tüm diziyi izledi'
  },
  'movie_buff': {
    icon: Film,
    color: 'text-red-500',
    gradient: 'from-red-500 to-red-300',
    nameEn: 'Movie Buff',
    nameTr: 'Film Tutkunu',
    descriptionEn: 'Watched 100+ movies',
    descriptionTr: '100+ film izledi'
  },
  'hidden_gem_finder': {
    icon: Sparkles,
    color: 'text-cyan-500',
    gradient: 'from-cyan-500 to-cyan-300',
    nameEn: 'Hidden Gem Finder',
    nameTr: 'Gizli Hazine Bulucu',
    descriptionEn: 'Found underrated content',
    descriptionTr: 'Az bilinen içerikleri buldu'
  }
}

const BadgeCard: React.FC<{
  badge: DiscoveryBadge
  config: typeof BADGE_CONFIG[string]
  languageCode: string
  compact?: boolean
}> = ({ badge, config, languageCode, compact }) => {
  const Icon = config.icon
  const earnedDate = new Date(badge.earned_at).toLocaleDateString(
    languageCode === 'tr' ? 'tr-TR' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  )

  if (compact) {
    return (
      <div
        className="relative group"
        title={languageCode === 'tr' ? config.nameTr : config.nameEn}
      >
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border-2 border-gray-700 hover:border-gray-600 transition-all hover:scale-105 group">
      <div className="flex items-start gap-4">
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-xl flex-shrink-0`}>
          <Icon className="w-8 h-8 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white mb-1 truncate">
            {languageCode === 'tr' ? config.nameTr : config.nameEn}
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            {languageCode === 'tr' ? config.descriptionTr : config.descriptionEn}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Award className="w-3 h-3" />
            <span>{earnedDate}</span>
          </div>
          {badge.metadata && Object.keys(badge.metadata).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex flex-wrap gap-2 text-xs">
                {badge.metadata.genres_explored && (
                  <span className="bg-gray-700 px-2 py-1 rounded">
                    {languageCode === 'tr' ? `${badge.metadata.genres_explored} tür` : `${badge.metadata.genres_explored} genres`}
                  </span>
                )}
                {badge.metadata.total_swipes && (
                  <span className="bg-gray-700 px-2 py-1 rounded">
                    {languageCode === 'tr' ? `${badge.metadata.total_swipes} kaydırma` : `${badge.metadata.total_swipes} swipes`}
                  </span>
                )}
                {badge.metadata.unique_moods && (
                  <span className="bg-gray-700 px-2 py-1 rounded">
                    {languageCode === 'tr' ? `${badge.metadata.unique_moods} ruh hali` : `${badge.metadata.unique_moods} moods`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ userId, languageCode, compact = false }) => {
  const [badges, setBadges] = useState<DiscoveryBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBadges()
  }, [userId])

  const loadBadges = async () => {
    try {
      setLoading(true)
      const userBadges = await discoveryService.getUserBadges(userId)
      setBadges(userBadges)
    } catch (error) {
      console.error('Error loading badges:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-400 mb-2">
          {languageCode === 'tr' ? 'Henüz Rozet Yok' : 'No Badges Yet'}
        </h3>
        <p className="text-sm text-gray-500">
          {languageCode === 'tr'
            ? 'Keşif yapmaya başla ve rozetler kazan!'
            : 'Start discovering to earn badges!'}
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const config = BADGE_CONFIG[badge.badge_type]
          if (!config) return null

          return (
            <BadgeCard
              key={badge.id}
              badge={badge}
              config={config}
              languageCode={languageCode}
              compact
            />
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Trophy className="w-7 h-7 mr-3 text-yellow-500" />
          {languageCode === 'tr' ? 'Rozetlerim' : 'My Badges'}
        </h2>
        <span className="text-sm text-gray-400">
          {badges.length} {languageCode === 'tr' ? 'rozet' : 'badges'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge) => {
          const config = BADGE_CONFIG[badge.badge_type]
          if (!config) return null

          return (
            <BadgeCard
              key={badge.id}
              badge={badge}
              config={config}
              languageCode={languageCode}
            />
          )
        })}
      </div>
    </div>
  )
}

export default BadgeDisplay

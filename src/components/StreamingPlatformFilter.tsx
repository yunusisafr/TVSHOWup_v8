import React, { useState, useEffect } from 'react'
import { Check, Tv, X, Sparkles } from 'lucide-react'
import { tmdbService } from '../lib/tmdb'

interface StreamingPlatform {
  id: number
  name: string
  logo_path: string | null
  provider_type?: string
  display_priority?: number
  country_of_origin?: string
}

interface StreamingPlatformFilterProps {
  selectedPlatforms: number[]
  onSelectionChange: (platforms: number[]) => void
  languageCode: string
  countryCode: string
  onApply?: () => void
}

// Global providers - always visible
const GLOBAL_STREAMING_PLATFORMS = [
  { id: 8, name: 'Netflix', priority: 1, logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  { id: 119, name: 'Amazon Prime Video', priority: 2, logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  { id: 337, name: 'Disney Plus', priority: 3, logo: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  { id: 384, name: 'HBO Max', priority: 4, logo: '/aS2zvJWn9mwiCOeaaCkIh4wleZS.jpg' },
  { id: 350, name: 'Apple TV Plus', priority: 5, logo: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg' },
  { id: 15, name: 'Hulu', priority: 6, logo: '/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg' },
  { id: 531, name: 'Paramount Plus', priority: 7, logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  { id: 387, name: 'Peacock', priority: 8, logo: '/8GIem9CR5naHWkreCu5HZazn2Iu.jpg' },
]

const StreamingPlatformFilter: React.FC<StreamingPlatformFilterProps> = ({
  selectedPlatforms,
  onSelectionChange,
  languageCode,
  countryCode,
  onApply
}) => {
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    loadPlatforms()
  }, [countryCode])

  const loadPlatforms = async () => {
    try {
      setLoading(true)
      console.log(`🔍 Loading providers for country: ${countryCode}`)

      // Fetch actual providers from TMDB API for the specific region
      const [movieProviders, tvProviders] = await Promise.all([
        tmdbService.getAvailableProvidersForRegion(countryCode, languageCode).catch(err => {
          console.warn('Failed to fetch movie providers:', err)
          return { results: [] }
        }),
        tmdbService.getAvailableTVProvidersForRegion(countryCode, languageCode).catch(err => {
          console.warn('Failed to fetch TV providers:', err)
          return { results: [] }
        })
      ])

      console.log('📺 TMDB Movie Providers:', movieProviders)
      console.log('📺 TMDB TV Providers:', tvProviders)

      // Combine and deduplicate providers
      const tmdbProviders = new Map<number, any>()

      if (movieProviders?.results) {
        movieProviders.results.forEach((p: any) => {
          tmdbProviders.set(p.provider_id, p)
        })
      }

      if (tvProviders?.results) {
        tvProviders.results.forEach((p: any) => {
          if (!tmdbProviders.has(p.provider_id)) {
            tmdbProviders.set(p.provider_id, p)
          }
        })
      }

      const platformsData: StreamingPlatform[] = []

      // Add global platforms that are available in this region
      GLOBAL_STREAMING_PLATFORMS.forEach(platform => {
        if (tmdbProviders.has(platform.id)) {
          const tmdbData = tmdbProviders.get(platform.id)
          platformsData.push({
            id: platform.id,
            name: tmdbData.provider_name || platform.name,
            logo_path: tmdbData.logo_path || platform.logo,
            display_priority: platform.priority
          })
          tmdbProviders.delete(platform.id)
        }
      })

      // Add remaining regional providers from TMDB
      let priorityCounter = 100
      tmdbProviders.forEach((provider) => {
        platformsData.push({
          id: provider.provider_id,
          name: provider.provider_name,
          logo_path: provider.logo_path,
          display_priority: priorityCounter++
        })
      })

      // Sort by display priority
      platformsData.sort((a, b) => (a.display_priority || 999) - (b.display_priority || 999))

      console.log(`✅ Loaded ${platformsData.length} providers for ${countryCode}:`, platformsData.map(p => p.name))
      setPlatforms(platformsData)
    } catch (error) {
      console.error('Error loading platforms:', error)
      // Fallback to global platforms only
      setPlatforms(GLOBAL_STREAMING_PLATFORMS.map(p => ({
        id: p.id,
        name: p.name,
        logo_path: p.logo,
        display_priority: p.priority
      })))
    } finally {
      setLoading(false)
    }
  }

  const togglePlatform = (platformId: number) => {
    const newSelection = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(id => id !== platformId)
      : [...selectedPlatforms, platformId]

    onSelectionChange(newSelection)
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  const selectPopular = () => {
    const popularIds = platforms.slice(0, 5).map(p => p.id)
    onSelectionChange(popularIds)
  }

  const visiblePlatforms = showAll ? platforms : platforms.slice(0, 8)

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-blue-400" />
          <h4 className="text-lg font-bold text-white">
            {languageCode === 'tr' ? 'Yayın Platformları' : 'Streaming Platforms'}
          </h4>
          {selectedPlatforms.length > 0 && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
              {selectedPlatforms.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedPlatforms.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              {languageCode === 'tr' ? 'Temizle' : 'Clear'}
            </button>
          )}
          <button
            onClick={selectPopular}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            {languageCode === 'tr' ? 'Popüler' : 'Popular'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visiblePlatforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id)
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/50'
                }
                hover:scale-102 active:scale-98
              `}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden">
                  {platform.logo_path ? (
                    <img
                      src={tmdbService.getProviderLogoUrl(platform.logo_path, 'w92')}
                      alt={platform.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <Tv className={`w-6 h-6 text-gray-500 ${platform.logo_path ? 'hidden' : ''}`} />
                </div>
                <span className="text-xs font-medium text-white text-center line-clamp-2 min-h-[2rem]">
                  {platform.name}
                </span>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {platforms.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors py-2"
        >
          {showAll
            ? (languageCode === 'tr' ? 'Daha Az Göster' : 'Show Less')
            : (languageCode === 'tr' ? `${platforms.length - 8} Daha Fazla Göster` : `Show ${platforms.length - 8} More`)}
        </button>
      )}

      {selectedPlatforms.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <p className="text-sm text-gray-300">
            {languageCode === 'tr'
              ? `${selectedPlatforms.length} platform seçildi. Sonuçlar yalnızca bu platformlarda mevcut içerikleri gösterecek.`
              : `${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''} selected. Results will show content available only on these platforms.`}
          </p>
        </div>
      )}

      {onApply && (
        <button
          onClick={onApply}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg transition-colors font-semibold shadow-lg"
        >
          {languageCode === 'tr' ? 'Filtreyi Uygula' : 'Apply Filter'}
        </button>
      )}
    </div>
  )
}

export default StreamingPlatformFilter

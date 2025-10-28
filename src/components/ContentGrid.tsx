import React from 'react'
import ContentCard from './ContentCard'
import { ContentItem } from '../lib/database'
import { getLocalizedTitle } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'

interface ContentGridProps {
  title: string
  content: ContentItem[]
  loading?: boolean
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  userWatchlistMap?: Map<number, string> // content_id -> status
  onAuthRequired?: () => void
  onShareListToggle?: (contentId: number, contentType: 'movie' | 'tv_show') => void
  shareListMap?: Map<number, boolean> // content_id -> isInShareList
  hideCardActions?: boolean
}

const ContentGrid: React.FC<ContentGridProps> = ({ 
  title, 
  content, 
  loading = false, 
  onWatchlistStatusChange,
  userWatchlistMap = new Map(),
  onAuthRequired,
  onShareListToggle,
  shareListMap = new Map(),
  hideCardActions = false
}) => {
  const { languageCode } = useUserPreferences()
  
  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-[2/3] bg-gray-700" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-700 rounded w-1/2" />
                <div className="h-3 bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (content.length === 0) {
    return (
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          <p>No content found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">{title}</h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {content.map((item) => (
          <ContentCard
            key={`${item.content_type}-${item.id}`}
            content={{
              ...item,
              title: getLocalizedTitle(item, languageCode) || item.title
            }}
            onWatchlistStatusChange={onWatchlistStatusChange}
            onAuthRequired={onAuthRequired}
            watchlistStatus={userWatchlistMap.get(item.id) as any || 'none'}
            onShareListToggle={onShareListToggle}
            isInShareList={shareListMap.has(item.id)}
            hideActions={hideCardActions}
          />
        ))}
      </div>
    </div>
  )
}

export default ContentGrid
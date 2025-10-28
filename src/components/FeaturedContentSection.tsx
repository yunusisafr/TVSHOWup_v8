import React from 'react'
import { ContentItem } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import HorizontalContentRow from './HorizontalContentRow'

interface FeaturedContentSectionProps {
  title: string
  content: ContentItem[]
  loading?: boolean
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  userWatchlistMap?: Map<number, string>
  onAuthRequired?: () => void
  variant?: 'default' | 'highlight'
  cardLayoutVariant?: 'default' | 'horizontal-genre' | 'featured-provider'
}

const FeaturedContentSection: React.FC<FeaturedContentSectionProps> = ({
  title,
  content,
  loading = false,
  onWatchlistStatusChange,
  userWatchlistMap = new Map(),
  onAuthRequired,
  variant = 'default',
  cardLayoutVariant = 'default'
}) => {
  const { languageCode } = useUserPreferences()
  
  // Determine if this is the Max's Best section
  const isMaxBestSection = title === (languageCode === 'tr' ? 'Max\'in En İyileri' : 'Max\'s Best');

  if (content.length === 0) {
    return null
  }

  return (
    <div className={`py-8 ${variant === 'highlight' ? 'bg-gray-800/50 rounded-xl mx-4 sm:mx-6 lg:mx-8' : ''}`}>
      <div className="max-w-7xl mx-auto">
        {/* Render as a horizontal carousel */}
        <HorizontalContentRow
          title={title}
          content={content}
          loading={loading}
          onWatchlistStatusChange={onWatchlistStatusChange}
          userWatchlistMap={userWatchlistMap}
          onAuthRequired={onAuthRequired}
          isHighlighted={variant === 'highlight'}
          cardLayoutVariant={cardLayoutVariant}
          extraInfo={undefined}
        />
      </div>
    </div>
  )
}

export default FeaturedContentSection
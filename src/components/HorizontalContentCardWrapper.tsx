import React from 'react'
import { useInView } from 'react-intersection-observer'
import ContentCard from './ContentCard'
import { ContentItem } from '../lib/database'

interface HorizontalContentCardWrapperProps {
  item: ContentItem
  index: number
  cardLayoutVariant: 'default' | 'horizontal-genre' | 'featured-provider'
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  onAuthRequired?: () => void
  userWatchlistMap: Map<number, string>
  onShareListToggle?: (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => void
  isInShareList?: boolean
  preserveWizardState?: boolean
}

const HorizontalContentCardWrapper: React.FC<HorizontalContentCardWrapperProps> = ({
  item,
  index,
  cardLayoutVariant,
  onWatchlistStatusChange,
  onAuthRequired,
  userWatchlistMap,
  onShareListToggle,
  isInShareList = false,
  preserveWizardState = false
}) => {
  // Use useInView hook for lazy loading
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px 0px',
  });

  return (
    <div 
      ref={ref}
      key={`${item.content_type}-${item.id}`} 
      className={`flex-shrink-0 ${
        cardLayoutVariant === 'horizontal-genre' 
          ? 'w-[calc(100%-2rem)] sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(33.333%-1rem)] h-48' 
          : cardLayoutVariant === 'featured-provider'
            ? 'w-40 xs:w-48 sm:w-56 md:w-60 lg:w-64 xl:w-72'
            : 'w-36 xs:w-44 sm:w-52 md:w-56 lg:w-60 xl:w-64'
      }`}
    >
      {inView ? (
        <ContentCard
          content={item}
          onWatchlistStatusChange={onWatchlistStatusChange}
          watchlistStatus={userWatchlistMap.get(item.id) as any || 'none'}
          onAuthRequired={onAuthRequired}
          variant={cardLayoutVariant === 'featured-provider' ? 'featured' : 'default'}
          layoutVariant={cardLayoutVariant}
          onShareListToggle={onShareListToggle}
          isInShareList={isInShareList}
          preserveWizardState={preserveWizardState}
        />
      ) : (
        cardLayoutVariant === 'horizontal-genre' ? (
          <div className="bg-gray-800 rounded-lg overflow-hidden animate-pulse h-48 flex w-full shadow-md">
            <div className="w-36 bg-gray-700" />
            <div className="p-4 space-y-2 flex-1">
              <div className="h-4 bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
              <div className="h-3 bg-gray-700 rounded w-full" />
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-[2/3] bg-gray-700" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default HorizontalContentCardWrapper
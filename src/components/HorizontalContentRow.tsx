import React, { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HorizontalContentCardWrapper from './HorizontalContentCardWrapper'
import { ContentItem } from '../lib/database'
import { getLocalizedTitle } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { getLanguageMetadata } from '../config/languages'

interface HorizontalContentRowProps {
  title: string
  content: ContentItem[]
  loading?: boolean
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  onAuthRequired?: () => void
  userWatchlistMap?: Map<number, string> // content_id -> status
  isHighlighted?: boolean
  extraInfo?: React.ReactNode
  cardLayoutVariant?: 'default' | 'horizontal-genre' | 'featured-provider'
  onShareListToggle?: (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => void
  shareListMap?: Map<number, boolean>
  preserveWizardState?: boolean
}

const HorizontalContentRow: React.FC<HorizontalContentRowProps> = ({
  title,
  content,
  loading = false,
  onWatchlistStatusChange,
  onAuthRequired,
  userWatchlistMap = new Map(),
  isHighlighted = false,
  extraInfo,
  cardLayoutVariant = 'default',
  onShareListToggle,
  shareListMap = new Map(),
  preserveWizardState = false
}) => {
  const { languageCode } = useUserPreferences()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const languageMetadata = getLanguageMetadata(languageCode)
  const isRTL = languageMetadata?.isRTL || false

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollAmount = container.clientWidth * 0.8 // Scroll 80% of visible width

    // In RTL, scrolling logic is reversed
    let newScrollLeft: number
    if (isRTL) {
      // RTL: left button scrolls right (positive), right button scrolls left (negative)
      newScrollLeft = direction === 'left'
        ? container.scrollLeft + scrollAmount
        : container.scrollLeft - scrollAmount
    } else {
      // LTR: normal behavior
      newScrollLeft = direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount
    }

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    })
  }

  const handleScroll = () => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const { scrollLeft, scrollWidth, clientWidth } = container

    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }

  // Update arrow visibility when content changes
  React.useEffect(() => {
    handleScroll()
  }, [content])

  if (loading) {
    return (
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">{title}</h2>
          <div className="flex space-x-3 sm:space-x-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={`loading-${index}`} 
                className="flex-shrink-0 w-36 xs:w-44 sm:w-52 md:w-56 lg:w-60 xl:w-64"
              >
                <div className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-[2/3] bg-gray-700" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (content.length === 0) {
    return null
  }

  return (
    <div className={`px-3 sm:px-6 lg:px-8 group content-row-container ${isHighlighted ? 'py-0' : ''}`}>
      <div className="max-w-7xl mx-auto px-0 sm:px-2">
        {title && (
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
            {extraInfo && (
              <div>
                {extraInfo}
              </div>
            )}
          </div>
        )}
        
        <div className="relative">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className={`content-row-arrow ${isRTL ? 'right-0' : 'left-0'}`}
              aria-label="Scroll left"
            >
              {isRTL ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
            </button>
          )}

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className={`content-row-arrow ${isRTL ? 'left-0' : 'right-0'}`}
              aria-label="Scroll right"
            >
              {isRTL ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
            </button>
          )}

          {/* Content Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`flex overflow-x-auto scrollbar-hide pb-4 scroll-smooth ${isRTL ? 'space-x-reverse space-x-4 pl-4' : 'space-x-4 pr-4'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {content.map((item, index) => {
              return (
                <HorizontalContentCardWrapper
                  key={`${item.content_type}-${item.id}`}
                  item={{
                    ...item,
                    title: getLocalizedTitle(item, languageCode) || item.title
                  }}
                  index={index}
                  cardLayoutVariant={cardLayoutVariant}
                  onWatchlistStatusChange={onWatchlistStatusChange}
                  onAuthRequired={onAuthRequired}
                  userWatchlistMap={userWatchlistMap}
                  onShareListToggle={onShareListToggle}
                  isInShareList={shareListMap.has(item.id)}
                  preserveWizardState={preserveWizardState}
                />
              );
            })}
            {/* Add some padding at the end */}
            <div className="flex-shrink-0 w-8"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HorizontalContentRow
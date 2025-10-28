import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Star, Calendar, Plus, Check, Eye, X, Share2, FolderPlus, Folder } from 'lucide-react'
import { ContentItem, databaseService } from '../lib/database'
import { tmdbService } from '../lib/tmdb'
import { createFullSlug, createSEOSlug, buildLanguagePath } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { Link, useLocation } from 'react-router-dom'
import ShareListSelectModal from './ShareListSelectModal'
import RatingModal from './RatingModal'
import { getLocalizedTitle, getLocalizedOverview, getLocalizedTagline } from '../lib/database'
import { createPersonSlug } from '../lib/utils'

// Define a type for watchlist status
type WatchlistStatusType = 'none' | 'want_to_watch' | 'watching' | 'watched' | 'dropped'

interface ContentCardProps {
  content: ContentItem
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  onAuthRequired?: () => void
  watchlistStatus?: WatchlistStatusType
  isInShareList?: boolean
  onShareListToggle?: (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => void
  variant?: 'default' | 'compact' | 'featured'
  layoutVariant?: 'default' | 'horizontal-genre' | 'featured-provider'
  showShareListButton?: boolean
  hideActions?: boolean
  preserveWizardState?: boolean
}

const ContentCard: React.FC<ContentCardProps> = ({
  content,
  onWatchlistStatusChange = undefined,
  onAuthRequired,
  watchlistStatus = 'none',
  isInShareList = false,
  onShareListToggle,
  variant = 'default',
  layoutVariant = 'default',
  showShareListButton = true,
  hideActions = false,
  preserveWizardState = false
}) => {
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const { countryCode, languageCode, isLoading: preferencesLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const location = useLocation()
  const [showStatusPicker, setShowStatusPicker] = useState<boolean>(false)
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<WatchlistStatusType>(watchlistStatus)
  const [isInShareListState, setIsInShareListState] = useState(isInShareList)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [showShareListModal, setShowShareListModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [userRating, setUserRating] = useState<number>(0)
  const [imageUrl, setImageUrl] = useState<string>('')

  // Separate refs for the button and the dropdown
  const watchlistButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Define loadUserRating function before useEffect that uses it
  const loadUserRating = useCallback(async () => {
    if (!user || !content) return

    try {
      const { data } = await databaseService.supabase
        .from('content_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('content_id', content.id)
        .eq('content_type', content.content_type)
        .maybeSingle()

      if (data) {
        setUserRating(data.rating)
      }
    } catch (error) {
      console.error('Error loading user rating:', error)
    }
  }, [user, content])

  // Update useEffect to react to watchlistStatus prop changes
  useEffect(() => {
    // Update currentStatus when watchlistStatus prop changes
    if (watchlistStatus !== undefined) {
      setCurrentStatus(watchlistStatus)
    }
  }, [watchlistStatus])

  // Update share list state when prop changes
  useEffect(() => {
    setIsInShareListState(isInShareList)
  }, [isInShareList])

  // Load user rating when component mounts or user/content changes
  useEffect(() => {
    if (user && content) {
      loadUserRating()
    }
  }, [user, content, loadUserRating])

  // Update image URL when language or content changes
  useEffect(() => {
    const newImageUrl = tmdbService.getImageUrl(content.poster_path || '', 'w342', content, languageCode, true)
    setImageUrl(newImageUrl)
  }, [content, languageCode, content.poster_path])

  // Listen for preferences changes to update poster
  useEffect(() => {
    const handlePreferencesChanged = (event: any) => {
      if (event.detail.countryChanged || event.detail.languageChanged) {
        console.log('🖼️ Country/Language changed, keeping original poster for content:', content.id)
        const newImageUrl = tmdbService.getImageUrl(content.poster_path || '', 'w342', content, languageCode, true)
        setImageUrl(newImageUrl)
      }
    }

    window.addEventListener('preferencesChanged', handlePreferencesChanged)
    return () => window.removeEventListener('preferencesChanged', handlePreferencesChanged)
  }, [content, languageCode])

  // CRITICAL: All remaining useEffect hooks MUST come BEFORE any early returns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStatusPicker &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          watchlistButtonRef.current &&
          !watchlistButtonRef.current.contains(event.target as Node)) {
        setShowStatusPicker(false)
      }
    }

    if (showStatusPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showStatusPicker])

  // Calculate dropdown position
  useEffect(() => {
    if (showStatusPicker && watchlistButtonRef.current && dropdownRef.current) {
      const updatePosition = () => {
        if (!watchlistButtonRef.current || !dropdownRef.current) return;

        const buttonRect = watchlistButtonRef.current.getBoundingClientRect()
        const dropdownHeight = dropdownRef.current.offsetHeight || 200
        const dropdownWidth = 200
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const spaceBelow = viewportHeight - buttonRect.bottom
        const spaceAbove = buttonRect.top
        const spaceRight = viewportWidth - buttonRect.left

        const shouldOpenUpward = spaceBelow < dropdownHeight + 20 && spaceAbove > spaceBelow

        let leftPos = buttonRect.left
        if (spaceRight < dropdownWidth + 20 && buttonRect.right > dropdownWidth) {
          leftPos = buttonRect.right - dropdownWidth
        }

        setDropdownStyle({
          position: 'fixed',
          top: shouldOpenUpward ? 'auto' : `${Math.min(buttonRect.bottom + 8, viewportHeight - dropdownHeight - 10)}px`,
          bottom: shouldOpenUpward ? `${Math.max(viewportHeight - buttonRect.top + 8, 10)}px` : 'auto',
          left: `${Math.max(10, Math.min(leftPos, viewportWidth - dropdownWidth - 10))}px`,
          minWidth: `${Math.max(buttonRect.width, 200)}px`,
          maxWidth: `${viewportWidth - 20}px`,
          zIndex: 10002
        })
      }

      updatePosition()

      const handleScroll = () => {
        if (showStatusPicker) {
          updatePosition()
        }
      }

      const handleResize = () => {
        if (showStatusPicker) {
          updatePosition()
        }
      }

      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [showStatusPicker])

  // FIXED: Early return AFTER all hooks
  if (preferencesLoading) {
    return (
      <div className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
        <div className="aspect-[2/3] bg-gray-700" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    )
  }

  // Generate SEO-friendly URL with language prefix
  const getContentUrl = () => {
    // Always use original title for URL consistency
    const originalTitle = content.content_type === 'movie'
      ? content.original_title || content.title
      : content.original_name || content.name || content.title;

    // Use existing slug or create one
    const slug = content.slug || createSEOSlug(content.id, content.title || content.name || '', originalTitle || '')

    // Format: /tr/movie/550-fight-club or /en/tv_show/1668-friends
    return `/${languageCode}/${content.content_type}/${slug}`
  }

  // Get navigation state to preserve discovery wizard state
  const getNavigationState = () => {
    // Save AI chat scroll position before navigation
    const aiChatScrollContainer = document.querySelector('.ai-chat-container .chat-scroll-area') as HTMLElement;
    if (aiChatScrollContainer) {
      const scrollPos = aiChatScrollContainer.scrollTop;
      sessionStorage.setItem('aiChatScrollPosition', scrollPos.toString());
      console.log('💾 Saved AI chat scroll before navigation:', scrollPos);
    }

    if (!preserveWizardState) return undefined

    // Try to get wizard state from sessionStorage or location state
    const locationState = location.state as any
    const wizardStateFromLocation = locationState?.discoveryWizardState

    if (wizardStateFromLocation) {
      return { discoveryWizardState: wizardStateFromLocation }
    }

    // Fallback to sessionStorage
    const savedState = sessionStorage.getItem('discoveryWizardState')
    if (savedState) {
      try {
        const wizardState = JSON.parse(savedState)
        return { discoveryWizardState: wizardState }
      } catch (e) {
        console.error('Error parsing wizard state:', e)
      }
    }

    return undefined
  }

  const handleWatchlistAction = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Toggle status picker
    setShowStatusPicker(prevState => !prevState)
  }

  // Handle clicking outside to close status picker
  const handleStatusChange = async (status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (isAddingToWatchlist) return
    
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired()
      } else {
        openAuthPrompt('watchlist')
      }
      setShowStatusPicker(false)
      return
    }

    setShowStatusPicker(false)
    setIsAddingToWatchlist(true)

    try {
      if (status === null) {
        // Remove from watchlist
        await databaseService.removeFromWatchlist(user?.id || '', content.id, content.content_type)
        setCurrentStatus('none')
      } else {
        // Add to watchlist with specified status
        await databaseService.addToWatchlist(user.id, content.id, content.content_type, status, {
          onConflict: 'user_id,content_id,content_type' 
        })
        setCurrentStatus(status)
      }
      // Notify parent component about the status change
      if (onWatchlistStatusChange) {
        onWatchlistStatusChange(content.id, content.content_type, status)
      } else {
        // If no parent handler, update local state
        if (status === null) {
          setCurrentStatus('none')
        } else {
          setCurrentStatus(status)
        }
      }
    } catch (error: any) {
      console.error('Error updating watchlist status:', error)
    } finally {
      setIsAddingToWatchlist(false)
    }
  }

  // Handle clicking outside to close status picker
  const handleOutsideClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }
  
  const handleCardClick = () => {
    setShowStatusPicker(false)
  }

  const handleMarkAsWatched = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired()
      } else {
        openAuthPrompt('watchlist')
      }
      return
    }
    
    setIsAddingToWatchlist(true)
    
    try {
      if (currentStatus === 'watched') {
        // Change back to want to watch
        await databaseService.addToWatchlist(user.id, content.id, content.content_type, 'want_to_watch', { 
          onConflict: 'user_id,content_id,content_type' 
        })
        setCurrentStatus('want_to_watch')
      } else {
        // Mark as watched
        await databaseService.addToWatchlist(user.id, content.id, content.content_type, 'watched', {
          onConflict: 'user_id,content_id,content_type' 
        })
        setCurrentStatus('watched')
      }
      
      // Call the parent component's handler to update UI
      if (onWatchlistStatusChange) {
        onWatchlistStatusChange(content.id, content.content_type, 'watched')
      } else {
        // If no parent handler, update local state
        setCurrentStatus('watched')
      }
    } catch (error) {
      console.error('Error updating watch status:', error)
    } finally {
      setIsAddingToWatchlist(false)
    }
  }

  // Handle share list toggle
  const handleShareListToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired()
      } else {
        openAuthPrompt('watchlist')
      }
      return
    }
    
    // Open share list modal instead of direct toggle
    setShowShareListModal(true)
  }

  const handleRate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired()
      } else {
        openAuthPrompt('rate')
      }
      return
    }
    
    setShowRatingModal(true)
  }

  const handleRatingSubmit = async (rating: number) => {
    if (!user || !content) return

    try {
      await databaseService.supabase
        .from('content_ratings')
        .upsert({
          user_id: user.id,
          content_id: content.id,
          content_type: content.content_type,
          rating
        })

      setUserRating(rating)
    } catch (error) {
      console.error('Error saving rating:', error)
    }
  }

  const getReleaseYear = () => {
    const date = content.release_date || content.first_air_date
    if (!date) {
      return languageCode === 'tr' ? 'Belirsiz' : 
             languageCode === 'de' ? 'Unbekannt' :
             languageCode === 'fr' ? 'À déterminer' :
             languageCode === 'es' ? 'Por anunciar' :
             languageCode === 'it' ? 'Da annunciare' : 'TBA';
    }
    return new Date(date).getFullYear()
  }

  // Get localized content text
  const localizedTitle = getLocalizedTitle(content, languageCode)
  const localizedOverview = getLocalizedOverview(content, languageCode)
  const localizedTagline = getLocalizedTagline(content, languageCode)

  // Parse genres if they exist
  const getGenres = () => {
    if (!content.genres) return [];
    
    try {
      return typeof content.genres === 'string' 
        ? JSON.parse(content.genres) 
        : content.genres;
    } catch (e) {
      return [];
    }
  }

  const getMonetizationTypeLabel = (types: string[]) => {
    if (types.includes('flatrate')) return 'Streaming'
    if (types.includes('buy')) return 'Buy'
    if (types.includes('rent')) return 'Rent'
    if (types.includes('ads')) return 'Free with Ads'
    return types[0] || 'Unknown'
  }

  const getProviderTypeLabel = (type?: string) => {
    // Simplified - just return the type or 'Platform'
    return type || 'Platform'
  }

  const getWatchlistButtonConfig = () => {
    switch (currentStatus) {
      case 'want_to_watch':
        return {
          text: languageCode === 'tr' ? 'Listede' : (languageCode === 'fr' ? 'Dans la liste' : (languageCode === 'de' ? 'In Liste' : (languageCode === 'es' ? 'En lista' : (languageCode === 'it' ? 'In lista' : 'In List')))),
          bgColor: 'bg-blue-600 hover:bg-blue-700',
          title: languageCode === 'tr' ? 'İzleme listesi durumu' : (languageCode === 'fr' ? 'Statut de la liste' : (languageCode === 'de' ? 'Watchlist-Status' : (languageCode === 'es' ? 'Estado de la lista' : (languageCode === 'it' ? 'Stato della lista' : 'Watchlist status')))),
          icon: <Check className="w-4 h-4 mr-1" />
        }
      case 'watching':
        return {
          text: t.watching,
          bgColor: 'bg-yellow-600 hover:bg-yellow-700',
          title: languageCode === 'tr' ? 'İzleme listesi durumu' : (languageCode === 'fr' ? 'Statut de la liste' : (languageCode === 'de' ? 'Watchlist-Status' : (languageCode === 'es' ? 'Estado de la lista' : (languageCode === 'it' ? 'Stato della lista' : 'Watchlist status')))),
          icon: <Eye className="w-4 h-4 mr-1" />
        }
      case 'watched':
        return {
          text: t.watched,
          bgColor: 'bg-green-600 hover:bg-green-700',
          title: languageCode === 'tr' ? 'İzleme listesi durumu' : (languageCode === 'fr' ? 'Statut de la liste' : (languageCode === 'de' ? 'Watchlist-Status' : (languageCode === 'es' ? 'Estado de la lista' : (languageCode === 'it' ? 'Stato della lista' : 'Watchlist status')))),
          icon: <Check className="w-4 h-4 mr-1" />
        }
      default:
        return {
          text: t.addToWatchlist,
          bgColor: 'bg-white/10 hover:bg-primary-500',
          title: languageCode === 'tr' ? 'İzleme listesine ekle' : (languageCode === 'fr' ? 'Ajouter à la liste' : (languageCode === 'de' ? 'Zur Watchlist hinzufügen' : (languageCode === 'es' ? 'Añadir a la lista' : (languageCode === 'it' ? 'Aggiungi alla lista' : 'Add to watchlist')))),
          icon: <Plus className="w-4 h-4 mr-1" />
        }
    }
  }

  return (
    <div className="relative">
      {layoutVariant === 'horizontal-genre' ? (
        <div 
          className={`group relative ${content.content_type === 'movie' ? 'bg-blue-900/30' : 'bg-green-900/30'} rounded-lg overflow-hidden content-card flex h-48 shadow-md ${
            variant === 'featured' ? 'featured-card shadow-xl border border-gray-700' : ''
          }`}
          onClick={handleCardClick}
        >
          <Link to={getContentUrl()} state={getNavigationState()} className="flex flex-row w-full">
            {/* Poster Image - Horizontal Layout */}
            <div className="relative w-32 sm:w-36 bg-gray-700 overflow-hidden rounded-l-lg flex-shrink-0">
              <img
                src={imageUrl}
                alt={localizedTitle}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-poster.jpg'
                }}
              />
              
              {/* Content Type Badge */}
              <div className={`absolute top-2 left-2 backdrop-blur-sm px-1.5 py-0.5 rounded-md transition-all duration-300 ${
                content.content_type === 'movie' 
                  ? 'bg-primary-500/90 group-hover:bg-primary-500' 
                  : 'bg-green-600/90 group-hover:bg-green-600'
              }`}>
                <span className="text-[10px] text-white font-medium uppercase">
                  {content.content_type === 'movie' 
                    ? (languageCode === 'tr' ? 'FİLM' : t.movie.toUpperCase()) 
                    : (languageCode === 'tr' ? 'DİZİ' : t.tvShow.toUpperCase())}
                </span>
              </div>
            </div>
            
            {/* Content Info - Horizontal Layout with button on right */}
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div className="h-full flex flex-col">
                <h3 className="font-bold text-white text-base mb-2 line-clamp-1">
                  {localizedTitle}
                </h3>
                
                <div className="flex items-center space-x-2 text-gray-300 text-sm mb-2">
                  <div className="flex items-center">
                    <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                    <span className="font-medium">{content.vote_average.toFixed(1)}</span>
                  </div>
                  <span>•</span>
                  <span>{getReleaseYear()}</span>
                  
                  {/* Genre Tags */}
                  {getGenres().length > 0 && getGenres().slice(0, 1).map((genre: any) => (
                    <span key={genre.id}>
                      <span>•</span>
                      <span className="text-gray-300">{genre.name}</span>
                    </span>
                  ))}
                </div>
                
                {/* Description */}
                <p className="text-xs text-gray-400 line-clamp-4 leading-tight mt-1 flex-grow mb-4">
                  {localizedOverview || 'No description available.'}
                </p>
                
                {/* Watchlist Button - Positioned at bottom right */}
                <div className="absolute bottom-3 right-3">
                  {/* Share List Button */}
                  {showShareListButton && (
                    <button 
                      onClick={handleShareListToggle}
                      className={`mr-2 p-2 rounded-lg transition-colors relative z-10 ${
                        isInShareListState 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                          : 'bg-white/20 hover:bg-purple-500 text-white'
                      }`}
                      title={languageCode === 'tr' ? 'Listelerime Ekle' : 'Add to Lists'}
                    >
                      {isInShareListState ? (
                        <Folder className="w-4 h-4" />
                      ) : (
                        <FolderPlus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleWatchlistAction(e);
                    }}
                    disabled={isAddingToWatchlist}
                    ref={watchlistButtonRef}
                    className={`flex items-center justify-center space-x-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm text-white whitespace-nowrap ${
                      currentStatus === 'none' 
                        ? 'bg-white/20 hover:bg-primary-500' 
                        : getWatchlistButtonConfig().bgColor
                    }`}
                    title={getWatchlistButtonConfig().title}
                  >
                    {isAddingToWatchlist ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="flex-shrink-0 mr-0.5">{getWatchlistButtonConfig().icon}</span>
                        <span className="whitespace-nowrap text-[8px] xs:text-[9px]">{getWatchlistButtonConfig().text}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Link>
        </div>
      ) : layoutVariant === 'featured-provider' ? (
        <div 
          className={`group relative bg-gray-800 rounded-lg overflow-hidden content-card ${
            variant === 'featured' ? 'featured-card shadow-xl border border-gray-700' : ''
          }`}
          onClick={handleCardClick}
        >
          <Link to={getContentUrl()} state={getNavigationState()} className="block">
            <div className="relative aspect-[2/3] bg-gray-700 overflow-hidden rounded-t-lg">
              <img
                src={imageUrl}
                alt={localizedTitle}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-poster.jpg'
                }}
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300" />
              
              {/* Rating Badge */}
              <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md flex items-center space-x-1 transition-all duration-300">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-sm text-white font-medium">
                  {content.vote_average.toFixed(1)}
                </span>
              </div>

              {/* Content Type Badge */}
              <div className={`absolute top-3 left-3 backdrop-blur-sm px-2 py-1 rounded-md ${
                content.content_type === 'movie' 
                  ? 'bg-primary-500/90' 
                  : 'bg-green-600/90'
              }`}>
                <span className="text-sm text-white font-medium uppercase">
                  {content.content_type === 'movie' 
                    ? (languageCode === 'tr' ? 'FİLM' : t.movie.toUpperCase()) 
                    : (languageCode === 'tr' ? 'DİZİ' : t.tvShow.toUpperCase())}
                </span>
              </div>
            </div>
            
            {/* Watchlist Button - Featured Provider Layout */}
            <div className="p-3 pt-2">
              <button 
                onClick={handleWatchlistAction}
                disabled={isAddingToWatchlist}
                ref={watchlistButtonRef}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-lg font-medium transition-colors text-sm text-white ${
                  currentStatus === 'none' 
                    ? 'bg-white/10 hover:bg-primary-500' 
                    : getWatchlistButtonConfig().bgColor
                }`}
                title={getWatchlistButtonConfig().title}
              >
                {isAddingToWatchlist ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="flex-shrink-0">{getWatchlistButtonConfig().icon}</span>
                    <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs ml-1">{getWatchlistButtonConfig().text}</span>
                  </>
                )}
              </button>
            </div>
          </Link>
          
        </div>
      ) : (
        <div 
          className={`group relative bg-gray-800 rounded-lg overflow-hidden content-card ${
            variant === 'featured' ? 'featured-card shadow-xl border border-gray-700' : ''
          }`}
          onClick={handleCardClick}
        >
          <Link to={getContentUrl()} state={getNavigationState()} className="block">
            {/* Poster Image - Default Layout */}
            <div className={`relative aspect-[2/3] bg-gray-700 overflow-hidden rounded-t-lg ${
              variant === 'featured' ? 'border-b-2 border-blue-600/30' : ''
            }`}>
              <img
                src={imageUrl}
                alt={localizedTitle}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-poster.jpg'
                }}
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300" />
              
              {/* Rating Badge */}
              <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md flex items-center space-x-1 transition-all duration-300">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className={`text-xs text-white font-medium ${variant === 'featured' ? 'text-sm' : ''}`}>
                  {content.vote_average.toFixed(1)}
                </span>
              </div>

              {/* Content Type Badge */}
              <div className={`absolute top-3 left-3 backdrop-blur-sm px-2 py-1 rounded-md ${
                content.content_type === 'movie' 
                  ? 'bg-primary-500/90' 
                  : 'bg-green-600/90'
              }`}>
                <span className={`text-xs text-white font-medium uppercase ${variant === 'featured' ? 'text-sm' : ''}`}>
                  {content.content_type === 'movie' 
                    ? (languageCode === 'tr' ? 'FİLM' : t.movie.toUpperCase()) 
                    : (languageCode === 'tr' ? 'DİZİ' : t.tvShow.toUpperCase())}
                </span>
              </div>
            </div>
          </Link>
            
          {/* Watchlist Button - Default Layout */}
          <div className="p-3 pt-2">
            {hideActions ? (
              /* Simple content info without action buttons */
              <div className="text-center">
                <h3 className="text-white text-sm font-medium line-clamp-1 mb-1">
                  {localizedTitle}
                </h3>
                <div className="flex items-center justify-center text-gray-400 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{getReleaseYear()}</span>
                </div>
              </div>
            ) : (
              <>
                {/* Title */}
                <h3 className="text-white text-sm font-medium line-clamp-2 mb-2 text-center min-h-[2.5rem]">
                  {localizedTitle}
                </h3>

                {/* Compact Action Buttons Row */}
                <div className="flex items-center justify-center space-x-2">
                {/* Watchlist Button */}
                <button 
                  onClick={handleWatchlistAction}
                  disabled={isAddingToWatchlist}
                  ref={watchlistButtonRef}
                  className={`p-2 rounded-lg transition-colors ${
                    currentStatus === 'none' 
                      ? 'bg-white/10 hover:bg-primary-500 text-white' 
                      : getWatchlistButtonConfig().bgColor.replace('text-white', '') + ' text-white'
                  }`}
                  title={getWatchlistButtonConfig().title}
                >
                  {isAddingToWatchlist ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="flex-shrink-0">{getWatchlistButtonConfig().icon}</span>
                  )}
                </button>
                
                {/* Share List Button */}
                {showShareListButton && (
                  <button 
                    onClick={handleShareListToggle}
                    className={`p-2 rounded-lg transition-colors relative z-10 ${
                      isInShareListState 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'bg-white/10 hover:bg-purple-500 text-white'
                    }`}
                    title={languageCode === 'tr' ? 'Öneri Listelerime Ekle' : 'Add to Suggestion Lists'}
                  >
                    {isInShareListState ? (
                      <Folder className="w-4 h-4" />
                    ) : (
                      <FolderPlus className="w-4 h-4" />
                    )}
                  </button>
                )}
                
                {/* Like/Rating Button */}
                <button 
                  onClick={handleRate}
                  className="p-2 rounded-lg bg-white/10 hover:bg-yellow-500 text-white transition-colors"
                  title={languageCode === 'tr' ? 'Puanla' : 'Rate'}
                >
                  {userRating > 0 ? (
                    <span className="text-xs font-bold">{userRating}</span>
                  ) : (
                    <Star className="w-4 h-4" />
                  )}
                </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Share List Modal */}
      {showShareListModal && (
        <ShareListSelectModal
          isOpen={showShareListModal}
          onClose={() => setShowShareListModal(false)}
          contentId={content.id}
          contentType={content.content_type}
          onContentChangeInList={() => {
            // Optional: Could be used for real-time updates in other contexts
          }}
        />
      )}
      
      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleRatingSubmit}
        currentRating={userRating}
        contentTitle={localizedTitle}
      />
      
      {/* Status picker dropdown - Rendered via Portal to avoid overflow:hidden issues */}
      {showStatusPicker && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px]"
          style={dropdownStyle}
          onClick={handleOutsideClick}
        >
          <div className="p-2 space-y-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange('want_to_watch');
              }}
              className={`flex items-center px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                currentStatus === 'want_to_watch'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>{t.wantToWatch}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange('watching');
              }}
              className={`flex items-center px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                currentStatus === 'watching'
                  ? 'bg-yellow-600 text-white'
                  : 'hover:bg-gray-700 text-white'
              }`}
            >
              <Eye className="w-4 h-4 mr-2" />
              <span>{t.watching}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange('watched');
              }}
              className={`flex items-center px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                currentStatus === 'watched'
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-gray-700 text-white'
              }`}
            >
              <Check className="w-4 h-4 mr-2" />
              <span>{t.watched}</span>
            </button>

            {currentStatus && currentStatus !== 'none' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(null);
                }}
                className="flex items-center px-3 py-3 rounded-lg text-left text-sm hover:bg-red-600/20 text-red-300 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                <span>{t.delete}</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default ContentCard
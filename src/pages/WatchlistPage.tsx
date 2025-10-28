// pages/WatchlistPage.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ContentItem, databaseService, ShareList, WatchlistItem } from '../lib/database'
import ContentCard from '../components/ContentCard'
import WatchlistListView from '../components/WatchlistListView'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useTranslation } from '../lib/i18n' 
import { Bookmark, CheckCircle, Eye, Grid, List as ListIcon, Share2, Globe, Copy, Check, LinkIcon, Save, AlertCircle, X } from 'lucide-react'
import { tmdbService } from '../lib/tmdb'
import { Link } from 'react-router-dom'

// Define a type for watchlist items with content details
interface WatchlistContentItem extends ContentItem {
  watchlist_status: 'want_to_watch' | 'watching' | 'watched' | 'dropped'
}

const WatchlistPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { openAuthPrompt } = useAuthPrompt()
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'watchlist' | 'watching' | 'watched' | 'sharelist'>(
    (localStorage.getItem('watchlist_active_tab') as 'watchlist' | 'watching' | 'watched' | 'sharelist') || 'watchlist'
  )
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('watchlist_view_mode') as 'grid' | 'list') || 'grid'
  )
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [watchlistContent, setWatchlistContent] = useState<WatchlistContentItem[]>([])
  const [watchingContent, setWatchingContent] = useState<WatchlistContentItem[]>([])
  const [watchedContent, setWatchedContent] = useState<WatchlistContentItem[]>([])
  // Temporarily disable share list feature
  
  // Public watchlist state
  const [isWatchlistPublic, setIsWatchlistPublic] = useState(false)
  const [publicWatchlistSlug, setPublicWatchlistSlug] = useState('')
  const [savingWatchlistSettings, setSavingWatchlistSettings] = useState(false)
  const [watchlistSettingsError, setWatchlistSettingsError] = useState<string | null>(null)
  const [watchlistSettingsSuccess, setWatchlistSettingsSuccess] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showShareWatchlistPanel, setShowShareWatchlistPanel] = useState(false)
  
  // const [shareListContent, setShareListContent] = useState<ContentItem[]>([])
  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  // const [shareList, setShareList] = useState<ShareList | null>(null)
  // const [shareListMap, setShareListMap] = useState<Map<number, boolean>>(new Map())
  
  // Track localization status
  const [isLocalizing, setIsLocalizing] = useState(false)
  
  // Reset watchlist content when user logs out
  useEffect(() => {
    if (!user) {
      setWatchlistContent([]);
      setWatchingContent([]);
      setWatchedContent([]);
      // Temporarily disable share list feature
      // setShareListContent([]);
      // setShareListMap(new Map());
    }
  }, [user]);

  // Function to update watchlist status in UI immediately
  const updateWatchlistStatus = (contentId: number, contentType: 'movie' | 'tv_show', newStatus: 'want_to_watch' | 'watching' | 'watched' | 'dropped' | null) => {
    // If removing from watchlist
    if (newStatus === null) {
      if (activeTab === 'watchlist') {
        setWatchlistContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
      } else if (activeTab === 'watching') {
        setWatchingContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
      } else {
        setWatchedContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
      }
      return
    }
    
    // If marking as watched
    if (newStatus === 'watched') {
      // Find the item in watchlist content
      const itemToMove = watchlistContent.find(item => item.id === contentId && item.content_type === contentType)
      if (itemToMove) {
        // Remove from watchlist
        setWatchlistContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
        
        // Add to watched with updated status
        const updatedItem = {...itemToMove, watchlist_status: 'watched' as const}
        setWatchedContent(prev => [updatedItem, ...prev])
      }
      return
    }
    
    // If marking as watching
    if (newStatus === 'watching') {
      // Find the item in watchlist content
      const itemToMove = watchlistContent.find(item => item.id === contentId && item.content_type === contentType)
      if (itemToMove) {
        // Remove from watchlist
        setWatchlistContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
        
        // Add to watching with updated status
        const updatedItem = {...itemToMove, watchlist_status: 'watching' as const}
        setWatchingContent(prev => [updatedItem, ...prev])
      }
    }
  }

  // Handle public watchlist settings update
  const handleWatchlistSettingsUpdate = async () => {
    if (!user) return
    
    try {
      setSavingWatchlistSettings(true)
      setWatchlistSettingsError(null)
      setWatchlistSettingsSuccess(false)
      
      const success = await databaseService.updateUserProfilePublicWatchlist(
        user.id,
        isWatchlistPublic,
        publicWatchlistSlug || undefined
      )
      
      if (!success) {
        throw new Error(languageCode === 'tr' 
          ? 'İzleme listesi ayarları güncellenirken bir hata oluştu' 
          : 'Failed to update watchlist settings')
      }
      
      // If turning on public access, fetch the generated slug
      if (isWatchlistPublic && !publicWatchlistSlug) {
        const updatedProfile = await databaseService.getUserProfile(user.id)
        if (updatedProfile && updatedProfile.public_watchlist_slug) {
          setPublicWatchlistSlug(updatedProfile.public_watchlist_slug)
        }
      }
      
      setWatchlistSettingsSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setWatchlistSettingsSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      console.error('Error updating watchlist settings:', error)
      setWatchlistSettingsError(error.message || 'Failed to update watchlist settings')
    } finally {
      setSavingWatchlistSettings(false)
    }
  }

  // Copy public watchlist link to clipboard
  const copyWatchlistLink = () => {
    if (!publicWatchlistSlug) return

    const link = `${window.location.origin}/${languageCode}/u/${publicWatchlistSlug}/mylist`
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      })
      .catch(err => {
        console.error('Could not copy text: ', err)
      })
  }

  // Share public watchlist link
  const sharePublicWatchlist = () => {
    if (!publicWatchlistSlug) return

    const shareUrl = `${window.location.origin}/${languageCode}/u/${publicWatchlistSlug}/mylist`

    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: languageCode === 'tr' ? 'İzleme Listem' : 'My Watchlist',
        text: languageCode === 'tr'
          ? 'İzleme listeme göz atın!'
          : 'Check out my watchlist!',
        url: shareUrl
      }).catch(error => {
        // Handle different types of share errors
        if (error.name === 'NotAllowedError') {
          console.warn('Share permission denied, falling back to clipboard')
        } else {
          console.error('Error sharing:', error)
        }
        // Fallback to clipboard for all error types
        copyPublicWatchlistLink()
      })
    } else {
      // Fallback to clipboard
      copyPublicWatchlistLink()
    }
  }
  
  // Copy public watchlist link to clipboard
  const copyPublicWatchlistLink = () => {
    if (!publicWatchlistSlug) return

    const link = `${window.location.origin}/${languageCode}/u/${publicWatchlistSlug}/mylist`
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedPublicLink(true)
        setTimeout(() => setCopiedPublicLink(false), 2000)
      })
      .catch(err => {
        console.error('Could not copy text: ', err)
      })
  }

  // Generate new slug
  const generateNewSlug = async () => {
    if (!user) return
    
    try {
      setSavingWatchlistSettings(true)
      setWatchlistSettingsError(null)
      
      // Set slug to null to trigger automatic generation
      const success = await databaseService.updateUserProfilePublicWatchlist(
        user.id,
        true,
        null
      )
      
      if (!success) {
        throw new Error(languageCode === 'tr' 
          ? 'Yeni bağlantı oluşturulurken bir hata oluştu' 
          : 'Failed to generate new link')
      }
      
      // Fetch the new slug
      const updatedProfile = await databaseService.getUserProfile(user.id)
      if (updatedProfile && updatedProfile.public_watchlist_slug) {
        setPublicWatchlistSlug(updatedProfile.public_watchlist_slug)
      }
      
      setWatchlistSettingsSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setWatchlistSettingsSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      console.error('Error generating new slug:', error)
      setWatchlistSettingsError(error.message || 'Failed to generate new link')
    } finally {
      setSavingWatchlistSettings(false)
    }
  }

  // Function to update share list status in UI immediately
  // Temporarily disable share list feature
  // const updateShareListStatus = (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => {
  //   if (add) {
  //     // If adding to share list, update the map
  //     setShareListMap(prev => {
  //       const newMap = new Map(prev);
  //       newMap.set(contentId, true);
  //       return newMap;
  //     });
  //   } else {
  //     // If removing from share list, update the map
  //     setShareListMap(prev => {
  //       const newMap = new Map(prev);
  //       newMap.delete(contentId);
  //       return newMap;
  //     });
  //     
  //     // If we're on the share list tab, remove the item from the list
  //     if (activeTab === 'sharelist') {
  //       setShareListContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)));
  //     }
  //   }
  // }

  useEffect(() => {
    const loadWatchlist = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Get user's watchlist items
        const watchlistItems = await databaseService.getUserWatchlist(user.id);
        // Get user profile to check public watchlist settings
        if (user) {
          const userProfile = await databaseService.getUserProfile(user.id)
          if (userProfile) {
            setIsWatchlistPublic(userProfile.is_watchlist_public || false)
            setPublicWatchlistSlug(userProfile.public_watchlist_slug || '')
          }
        }
        
        setWatchlist(watchlistItems);
        
        console.log(`📋 Loaded ${watchlistItems.length} watchlist items`);
        
        // Prepare arrays for content items - we'll only load basic info, no need for descriptions
        const contentItems: WatchlistContentItem[] = [];
        const watchedItems: WatchlistContentItem[] = [];
        const watchingItems: WatchlistContentItem[] = [];
        
        for (const item of watchlistItems) {
          try {
            const content = await databaseService.getContentById(item.content_id, item.content_type);
            if (content) {
              const contentWithStatus = {
                ...content,
                watchlist_status: item.status // Add watchlist status to content item
              };
              
              if (item.status === 'watched') {
                console.log(`👁️ Found watched item: ${content.title}`);
                watchedItems.push(contentWithStatus);
              } else if (item.status === 'watching') {
                console.log(`📺 Found watching item: ${content.title}`);
                watchingItems.push(contentWithStatus);
              } else {
                console.log(`📝 Found watchlist item: ${content.title} (${item.status})`);
                contentItems.push(contentWithStatus);
              }
            }
          } catch (error) {
            console.error(`Error fetching content ${item.content_id}:`, error);
          }
        }
        
        setWatchlistContent(contentItems);
        setWatchingContent(watchingItems);
        setWatchedContent(watchedItems);
        
      } catch (error) {
        console.error('Error loading watchlist:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadWatchlist();
  }, [user, refreshTrigger, languageCode]);

  // Load share list content
  // Temporarily disable share list feature
  // useEffect(() => {
  //   const loadShareList = async () => {
  //     if (!user) return;
  //     
  //     try {
  //       setLoading(true);
  //       
  //       // Get user's default share list
  //       const defaultList = await databaseService.getDefaultShareList(user.id);
  //       if (!defaultList) {
  //         console.log('No default share list found');
  //         setLoading(false);
  //         return;
  //       }
  //       
  //       setShareList(defaultList);
  //       
  //       // Get items in the share list
  //       const shareItems = await databaseService.getShareListItems(defaultList.id);
  //       console.log(`📋 Loaded ${shareItems.length} share list items`);
  //       
  //       // Create a map for quick lookup
  //       const newShareListMap = new Map<number, boolean>();
  //       
  //       // Load content details for each item
  //       const contentItems: ContentItem[] = [];
  //       
  //       for (const item of shareItems) {
  //         try {
  //           const content = await databaseService.getContentById(item.content_id, item.content_type);
  //           if (content) {
  //             contentItems.push(content);
  //             newShareListMap.set(content.id, true);
  //           }
  //         } catch (error) {
  //           console.error(`Error fetching content ${item.content_id}:`, error);
  //         }
  //       }
  //       
  //       setShareListContent(contentItems);
  //       setShareListMap(newShareListMap);
  //       
  //     } catch (error) {
  //       console.error('Error loading share list:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   
  //   if (activeTab === 'sharelist' && user) {
  //     loadShareList();
  //   }
  // }, [user, activeTab, refreshTrigger]);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('watchlist_active_tab', activeTab);
  }, [activeTab]);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('watchlist_view_mode', viewMode);
  }, [viewMode]);

  const handleWatchlistStatusChange = async (contentId: number, contentType: 'movie' | 'tv_show', newStatus: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user) return;

    console.log(`🔄 Changing watchlist status for ${contentType} ${contentId} to ${newStatus}`);

    try {
      // Update UI immediately for responsive feel
      updateWatchlistStatus(contentId, contentType, newStatus);
      
      if (newStatus === null) {
        console.log(`🗑️ Removing ${contentType} ${contentId} from watchlist`);
        await databaseService.removeFromWatchlist(user?.id || '', contentId, contentType);
      } else {
        console.log(`📝 Setting ${contentType} ${contentId} status to ${newStatus}`);
        await databaseService.addToWatchlist(user?.id || '', contentId, contentType, newStatus, {
          onConflict: 'user_id,content_id,content_type'
        });
      }

      // Trigger refresh to ensure data consistency
      setTimeout(() => setRefreshTrigger(prev => prev + 1), 300);
    } catch (error: any) {
      console.error(`Error updating watchlist status to ${newStatus}:`, error);
      alert(`İzleme listesi güncellenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    }
  };

  const handleTabChange = (tab: 'watchlist' | 'watching' | 'watched' | 'sharelist') => {
    setActiveTab(tab);
    localStorage.setItem('watchlist_active_tab', tab);
  };

  // View mode change function temporarily hidden
  // const handleViewModeChange = (mode: 'grid' | 'list') => {
  //   setViewMode(mode);
  // };

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Don't render anything while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Don't render if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Handle share list toggle
  const handleShareListToggle = async (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => {
    // Temporarily disable share list feature
    console.log('Share list feature is temporarily disabled');
    // Feature temporarily disabled
  };

  // Handle share list sharing
  // Temporarily disable share list feature
  // const handleShareList = () => {
  //   if (!shareList) return;
  //   
  //   // Create share URL
  //   const shareUrl = `${window.location.origin}/share/${shareList.slug || shareList.id}`;
  //   
  //   // Check if Web Share API is available
  //   if (navigator.share) {
  //     navigator.share({
  //       title: shareList.name,
  //       text: shareList.description || 'Check out my watchlist on TVSHOWup!',
  //       url: shareUrl
  //     }).catch(error => {
  //       console.error('Error sharing:', error);
  //       // Fallback to clipboard
  //       copyToClipboard(shareUrl);
  //     });
  //   } else {
  //     // Fallback to clipboard
  //     copyToClipboard(shareUrl);
  //   }
  // };
  
  // Helper function to copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert(languageCode === 'tr' ? 'Paylaşım bağlantısı panoya kopyalandı!' : 'Share link copied to clipboard!');
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  };

  return ( 
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8">
        {/* Share Watchlist Button */}
        <div className="flex justify-center mb-4 px-3 sm:px-0">
          <button
            onClick={() => setShowShareWatchlistPanel(!showShareWatchlistPanel)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors text-sm"
          >
            <Share2 className="w-4 h-4 mr-2" />
            {languageCode === 'tr' ? 'İzleme Listesini Paylaş' :
             languageCode === 'de' ? 'Watchlist teilen' :
             languageCode === 'fr' ? 'Partager la liste de visionnage' :
             languageCode === 'es' ? 'Compartir lista de seguimiento' :
             languageCode === 'it' ? 'Condividi watchlist' :
             'Share Watchlist'}
          </button>
        </div>
        
        <div className="flex justify-center mb-6 px-3 sm:px-0">
          {/* Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto scrollbar-hide w-auto">
            <button 
              onClick={() => handleTabChange('watchlist')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'watchlist'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={t.watchlist}
            >
              <Bookmark className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="whitespace-nowrap text-xs sm:text-sm">
                {t.watchlist}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('watching')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'watching'
                  ? 'bg-yellow-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={t.watching}
            >
              <Eye className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="whitespace-nowrap text-xs sm:text-sm">
                {t.watching}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('watched')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'watched'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={t.watched}
            >
              <CheckCircle className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="whitespace-nowrap text-xs sm:text-sm">
                {t.watched}
              </span>
            </button>
            {/* Temporarily disable share list tab */}
            {/* <button
              onClick={() => handleTabChange('sharelist')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sharelist'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={languageCode === 'tr' ? 'Paylaşım Listesi' : 'Share List'}
            >
              <Share2 className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="whitespace-nowrap text-xs sm:text-sm">
                {languageCode === 'tr' ? 'Paylaşım Listesi' : 'Share List'}
              </span>
            </button> */}
          </div>
          
          {/* View Mode Switcher */}
          {/* View selection temporarily hidden */}
          {/* <div className="flex bg-gray-800 rounded-lg p-1 self-center mx-auto sm:mx-0 mb-2 sm:mb-0">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={t.gridView}
            >
              <Grid className="w-4 h-4 mr-1" />
              <span className="text-xs hidden xs:inline">{t.gridView}</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              aria-label={t.listView}
            >
              <ListIcon className="w-4 h-4 mr-1" />
              <span className="text-xs hidden xs:inline">{t.listView}</span>
            </button>
          </div> */}
        </div>
        
        {/* Share Watchlist Panel */}
        {showShareWatchlistPanel && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6 mx-3 sm:mx-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Share2 className="w-5 h-5 mr-2" />
                {languageCode === 'tr' ? 'İzleme Listesini Paylaş' : 'Share Watchlist'}
              </h2>
              <button
                onClick={() => setShowShareWatchlistPanel(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label={languageCode === 'tr' ? 'Kapat' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Share Page Button - Show at top when public */}
            {isWatchlistPublic && publicWatchlistSlug && (
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
                <div className="w-full mb-2">
                  <p className="text-green-400 text-sm font-medium">
                    {languageCode === 'tr' ? '✅ İzleme listeniz herkese açık!' : '✅ Your watchlist is public!'}
                  </p>
                </div>
                <Link
                  to={`/${languageCode}/u/${publicWatchlistSlug}/mylist`}
                  target="_blank"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors text-sm flex-1 justify-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {languageCode === 'tr' ? 'Sayfamı Aç' : 'Open My Page'}
                </Link>
                
                <button
                  onClick={sharePublicWatchlist}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors text-sm flex-1 justify-center"
                >
                  {copiedPublicLink ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Kopyalandı!' : 'Copied!'}
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Sayfayı Paylaş' : 'Share Page'}
                    </>
                  )}
                </button>
              </div>
            )}
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">
                    {languageCode === 'tr' ? 'İzleme Listemi Herkese Açık Yap' : 'Make My Watchlist Public'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {languageCode === 'tr' 
                      ? 'İzleme listenizi herkesle paylaşın. Diğer kullanıcılar izleme listenizi görebilir.'
                      : 'Share your watchlist with everyone. Other users can see what you\'re watching.'}
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => setIsWatchlistPublic(!isWatchlistPublic)}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                      isWatchlistPublic ? 'bg-primary-500 justify-end' : 'bg-gray-600 justify-start'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full transform transition-transform ${
                      isWatchlistPublic ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                    }`}>
                      {isWatchlistPublic && <Check className="w-3 h-3 text-primary-500 m-auto" />}
                    </div>
                  </button>
                </div>
              </div>
              
              {isWatchlistPublic && (
                <>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-white font-medium mb-2">
                      {languageCode === 'tr' ? 'Herkese Açık Bağlantı' : 'Public Link'}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <div className="bg-gray-800 text-gray-300 py-2 px-3 rounded-lg flex-1 overflow-x-auto whitespace-nowrap text-sm">
                        {publicWatchlistSlug
                          ? `${window.location.origin}/${languageCode}/u/${publicWatchlistSlug}/mylist`
                          : (languageCode === 'tr' ? 'Bağlantı oluşturuluyor...' : 'Generating link...')}
                      </div>
                      <button
                        onClick={copyWatchlistLink}
                        disabled={!publicWatchlistSlug}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                        title={languageCode === 'tr' ? 'Bağlantıyı Kopyala' : 'Copy Link'}
                      >
                        {copiedLink ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    <p>
                      {languageCode === 'tr'
                        ? 'İzleme listenizi herkese açık yaptığınızda, herkes izleme listenizi görebilir. İzleme listenizi özel yapmak için yukarıdaki düğmeyi kapatın.'
                        : 'When you make your watchlist public, anyone can see your watchlist. To make your watchlist private, toggle the switch above.'}
                    </p>
                  </div>
                </>
              )}
              
              {/* Error and Success Messages */}
              {watchlistSettingsError && (
                <div className="bg-red-900/20 border border-red-500 rounded-md p-3 text-red-400 flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{watchlistSettingsError}</span>
                </div>
              )}
              
              {watchlistSettingsSuccess && (
                <div className="bg-green-900/20 border border-green-500 rounded-md p-3 text-green-400">
                  {languageCode === 'tr' 
                    ? 'İzleme listesi ayarları başarıyla güncellendi.' 
                    : 'Watchlist settings have been updated successfully.'}
                </div>
              )}
              
              {/* Save Button */}
              <div>
                <button
                  onClick={async () => {
                    await handleWatchlistSettingsUpdate();
                    // Close the panel after successful save
                    if (!watchlistSettingsError) {
                      setShowShareWatchlistPanel(false);
                    }
                  }}
                  disabled={savingWatchlistSettings}
                  className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-md transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingWatchlistSettings ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Ayarları Kaydet' : 'Save Settings'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 px-3 sm:px-0">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={`loading-${index}`} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-gray-700" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'watchlist' && watchlistContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'İzleme Listeniz Boş' : 'Your Watchlist is Empty'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'İzlemek istediğiniz filmleri ve dizileri ekleyin.'
                  : 'Add movies and TV shows you want to watch.'
                }
              </p>
            </div>
          </div>
        ) : activeTab === 'watching' && watchingContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'İzlediğiniz İçerik Yok' : 'No Watching Content'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'İzlemeye başladığınız filmleri ve dizileri "İzleniyor" olarak işaretleyin.'
                  : 'Mark movies and TV shows you are currently watching as "Watching" to see them here.'}
              </p>
            </div>
          </div>
        ) : activeTab === 'watched' && watchedContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'İzlediğiniz İçerik Yok' : 'No Watched Content'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'İzlediğiniz filmleri ve dizileri "İzlendi" olarak işaretleyin.'
                  : 'Mark movies and TV shows as "Watched" to see them here.'
                }
              </p>
            </div>
          </div>
        ) : activeTab === 'sharelist' && shareListContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'Paylaşım Listeniz Boş' : 'Your Share List is Empty'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'İçerik kartlarındaki klasör simgesine tıklayarak paylaşım listenize ekleyin.'
                  : 'Add items to your share list by clicking the folder icon on content cards.'
                }
              </p>
            </div>
          </div>
        ) : (
          viewMode === 'grid' ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 px-3 sm:px-0">
            {activeTab === 'watchlist' 
              ? watchlistContent.map((item) => (
                  <ContentCard 
                    key={`${item.content_type}-${item.id}`}
                    content={item}
                    watchlistStatus={item.watchlist_status}
                    onWatchlistStatusChange={handleWatchlistStatusChange}
                    onAuthRequired={() => openAuthPrompt('watchlist')}
                    // Temporarily disable share list feature
                    // isInShareList={shareListMap.has(item.id)}
                    // onShareListToggle={handleShareListToggle}
                  />
                ))
              : activeTab === 'watching'
              ? watchingContent.map((item) => (
                  <ContentCard
                    key={`${item.content_type}-${item.id}`}
                    content={item}
                    watchlistStatus={item.watchlist_status}
                    onWatchlistStatusChange={handleWatchlistStatusChange}
                    onAuthRequired={() => openAuthPrompt('watchlist')}
                    // Temporarily disable share list feature
                    // isInShareList={shareListMap.has(item.id)}
                    // onShareListToggle={handleShareListToggle}
                  />
                ))
              : activeTab === 'watched'
              ? watchedContent.map((item) => (
                  <ContentCard
                    key={`${item.content_type}-${item.id}`}
                    content={item}
                    watchlistStatus={item.watchlist_status}
                    onWatchlistStatusChange={handleWatchlistStatusChange}
                    onAuthRequired={() => openAuthPrompt('watchlist')}
                    // Temporarily disable share list feature
                    // isInShareList={shareListMap.has(item.id)}
                    // onShareListToggle={handleShareListToggle}
                  />
                ))
              : null
                 // Temporarily disable share list feature
                 // : shareListContent.map((item) => (
                 //     <ContentCard
                 //       key={`${item.content_type}-${item.id}`}
                 //       content={item}
                 //       watchlistStatus={null}
                 //       onWatchlistStatusChange={handleWatchlistStatusChange}
                 //       onAuthRequired={() => openAuthPrompt('watchlist')}
                 //       isInShareList={true}
                 //       onShareListToggle={handleShareListToggle}
                 //     />
                 //   ))
            }
          </div> : (
            <WatchlistListView
              content={
                activeTab === 'watchlist' 
                  ? watchlistContent
                  : activeTab === 'watching'
                  ? watchingContent
                  : activeTab === 'watched'
                  ? watchedContent
                  : []
                  // Temporarily disable share list feature
                  // : shareListContent
              }
              onWatchlistStatusChange={handleWatchlistStatusChange}
              onAuthRequired={() => openAuthPrompt('watchlist')}
              // Temporarily disable share list feature
              // shareListMap={shareListMap}
              // onShareListToggle={handleShareListToggle}
            />
          )
        )}
        
      </div>
    </div>
  );
};

export default WatchlistPage;
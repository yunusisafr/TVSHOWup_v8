import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Eye, Calendar, Star, Bookmark, CheckCircle } from 'lucide-react'
import { ContentItem, databaseService } from '../lib/database'
import { WatchlistItem } from '../lib/database'
import { getLocalizedTitle } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import ContentGrid from '../components/ContentGrid'
import { useAuth } from '../contexts/AuthContext'
import { tmdbService } from '../lib/tmdb'

const PublicWatchlistPage: React.FC = () => {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { user } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'watchlist' | 'watching' | 'watched'>('watchlist')
  const [userProfile, setUserProfile] = useState<any | null>(null)
  const [wantToWatchContent, setWantToWatchContent] = useState<ContentItem[]>([])
  const [watchingContent, setWatchingContent] = useState<ContentItem[]>([])
  const [watchedContent, setWatchedContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  
  useEffect(() => {
    if (!username) return
    
    loadPublicWatchlist()
  }, [username])
  
  useEffect(() => {
    if (user && userProfile) {
      setIsOwner(user.id === userProfile.id)
    }
  }, [user, userProfile])
  
  const loadPublicWatchlist = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get user profile by slug
      const profile = await databaseService.getUserProfileBySlug(username!)
      
      if (!profile) {
        setError(languageCode === 'tr' ? 'Kullanıcı bulunamadı' : 'User not found')
        setLoading(false)
        return
      }
      
      setUserProfile(profile)
      
      // Check if watchlist is public
      if (!profile.is_watchlist_public) {
        setError(languageCode === 'tr' ? 'Bu izleme listesi herkese açık değil' : 'This watchlist is not public')
        setLoading(false)
        return
      }
      
      // Get public watchlist content
      const watchlistItems = await databaseService.getUserWatchlist(profile.id)
      
      // Separate items by status
      const wantToWatchItems: WatchlistItem[] = []
      const watchingItems: WatchlistItem[] = []
      const watchedItems: WatchlistItem[] = []
      
      watchlistItems.forEach(item => {
        if (item.status === 'want_to_watch') {
          wantToWatchItems.push(item)
        } else if (item.status === 'watching') {
          watchingItems.push(item)
        } else if (item.status === 'watched') {
          watchedItems.push(item)
        }
      })
      
      // Fetch content details for each category
      const fetchContentForItems = async (items: WatchlistItem[]): Promise<ContentItem[]> => {
        const contentItems: ContentItem[] = []
        for (const item of items) {
          try {
            const content = await databaseService.getContentById(item.content_id, item.content_type)
            if (content) {
              contentItems.push(content)
            }
          } catch (error) {
            console.error(`Error fetching content ${item.content_id}:`, error)
          }
        }
        return contentItems
      }
      
      // Fetch content for each category in parallel
      const [wantToWatch, watching, watched] = await Promise.all([
        fetchContentForItems(wantToWatchItems),
        fetchContentForItems(watchingItems),
        fetchContentForItems(watchedItems)
      ])
      
      setWantToWatchContent(wantToWatch)
      setWatchingContent(watching)
      setWatchedContent(watched)
      
    } catch (error) {
      console.error('Error loading public watchlist:', error)
      setError(languageCode === 'tr' ? 'İzleme listesi yüklenirken bir hata oluştu' : 'Error loading watchlist')
    } finally {
      setLoading(false)
    }
  }
  
  // Function to add content to your own watchlist
  const addToMyWatchlist = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    if (!user) {
      navigate('/login', { state: { redirectPath: `/u/${username}/watchlist` } })
      return
    }
    
    try {
      await databaseService.addToWatchlist(user.id, contentId, contentType, 'want_to_watch')
      // Show success message or notification
      alert(languageCode === 'tr' 
        ? 'İçerik izleme listenize eklendi' 
        : 'Content added to your watchlist')
    } catch (error) {
      console.error('Error adding to watchlist:', error)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-[2/3] bg-gray-700"></div>
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              {error || (languageCode === 'tr' ? 'Kullanıcı bulunamadı' : 'User not found')}
            </h2>
            <p className="text-gray-400 mb-6">
              {languageCode === 'tr' 
                ? 'Bu kullanıcı bulunamadı veya izleme listesi herkese açık değil.'
                : 'This user could not be found or their watchlist is not public.'}
            </p>
            <button
              onClick={() => navigate(`/${languageCode}`)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {languageCode === 'tr' ? 'Ana Sayfaya Dön' : 'Return to Home'}
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          {languageCode === 'tr' ? 'Geri' : 'Back'}
        </button>
        
        {/* User Profile Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            {userProfile.avatar_url ? (
              <img 
                src={userProfile.avatar_url}
                alt={userProfile.display_name}
                className="w-16 h-16 rounded-full object-cover mr-4"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.style.display = 'none';
                  // Text initial fallback
                  e.currentTarget.parentElement!.innerHTML = `
                    <div class="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mr-4">
                      <span class="text-white text-xl font-bold">${userProfile.display_name.charAt(0).toUpperCase()}</span>
                    </div>
                  `;
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mr-4">
                <span className="text-white text-xl font-bold">{userProfile.display_name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <span>@{userProfile.display_name}</span>
              </h1>
              <p className="text-gray-400">
                {languageCode === 'tr' ? 'İzleme Listesi' : 'Watchlist'}
              </p>
            </div>
            
            {isOwner && (
              <div className="ml-auto">
                <button
                  onClick={() => navigate(`/${languageCode}/watchlist`)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {languageCode === 'tr' ? 'Listeyi Düzenle' : 'Edit List'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        {/* Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto scrollbar-hide mb-6 w-auto max-w-md">
          <button 
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'watchlist' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
            aria-label={t.watchlist}
          >
            <Bookmark className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="whitespace-nowrap text-xs sm:text-sm">
              {t.watchlist}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('watching')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'watching' ? 'bg-yellow-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
            aria-label={t.watching}
          >
            <Eye className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="whitespace-nowrap text-xs sm:text-sm">
              {t.watching}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('watched')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'watched' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
            aria-label={t.watched}
          >
            <CheckCircle className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="whitespace-nowrap text-xs sm:text-sm">
              {t.watched}
            </span>
          </button>
        </div>
        
        {/* Get current content based on active tab */}
        {(() => {
          const currentContent = 
            activeTab === 'watchlist' ? wantToWatchContent :
            activeTab === 'watching' ? watchingContent :
            watchedContent;
          
          if (currentContent.length === 0) {
            return (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-white mb-4">
                    {activeTab === 'watchlist' 
                      ? (languageCode === 'tr' ? 'İzleme Listesi Boş' : 'Watchlist is Empty')
                      : activeTab === 'watching'
                      ? (languageCode === 'tr' ? 'İzleniyor Listesi Boş' : 'Watching List is Empty')
                      : (languageCode === 'tr' ? 'İzlendi Listesi Boş' : 'Watched List is Empty')
                    }
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {languageCode === 'tr' 
                      ? 'Bu kullanıcının bu kategoride henüz içeriği yok.'
                      : 'This user has no content in this category yet.'
                    }
                  </p>
                </div>
              </div>
            );
          }
          
          return (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                {activeTab === 'watchlist' 
                  ? t.watchlist
                  : activeTab === 'watching'
                  ? t.watching
                  : t.watched
                }
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {currentContent.map((item) => (
                  <div key={`${item.content_type}-${item.id}`} className="bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <a href={`/${languageCode}/${item.content_type}/${item.slug || createSEOSlug(item.id, item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title), item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title))}`} className="block">
                      <div className="relative aspect-[2/3] bg-gray-700">
                        <img
                          src={item.poster_path ? tmdbService.getImageUrl(item.poster_path, 'w342') : '/placeholder-poster.jpg'}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-poster.jpg'
                          }}
                        />
                        
                        {/* Content Type Badge */}
                        <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white ${
                          item.content_type === 'movie' ? 'bg-primary-500' : 'bg-green-600'
                        }`}>
                          {item.content_type === 'movie' 
                            ? (languageCode === 'tr' ? 'Film' : t.movie) 
                            : (languageCode === 'tr' ? 'Dizi' : t.tvShow)}
                        </div>
                        
                        {/* Rating Badge */}
                        <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center">
                          <Star className="w-3 h-3 text-yellow-400 mr-1" />
                          <span className="text-xs text-white">{item.vote_average.toFixed(1)}</span>
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <h3 className="font-medium text-white text-sm line-clamp-1">
                          {getLocalizedTitle(item, languageCode) || item.title}
                        </h3>
                        <div className="flex items-center text-gray-400 text-xs mt-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>
                            {(item.release_date || item.first_air_date) 
                              ? new Date(item.release_date || item.first_air_date).getFullYear() 
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </a>
                    
                    {/* Add to My Watchlist Button (only for non-owners) */}
                    {!isOwner && (
                      <div className="px-3 pb-3">
                        <button
                          onClick={() => addToMyWatchlist(item.id, item.content_type)}
                          className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {languageCode === 'tr' ? 'Listeme Ekle' : 'Add to My List'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  )
}

export default PublicWatchlistPage

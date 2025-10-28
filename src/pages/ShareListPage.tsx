import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Share2, Copy, Check, ArrowLeft, Globe, Lock, Edit, Save, X } from 'lucide-react'
import { ContentItem, ShareList, databaseService } from '../lib/database'
import { getLocalizedListName, getLocalizedListDescription } from '../lib/database'
import { useAuth } from '../contexts/AuthContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import ContentGrid from '../components/ContentGrid'
import { useAuthPrompt } from '../contexts/AuthPromptContext'

const ShareListPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { openAuthPrompt } = useAuthPrompt()
  
  const [shareList, setShareList] = useState<ShareList | null>(null)
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [listName, setListName] = useState('')
  const [listDescription, setListDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  
  useEffect(() => {
    if (!slug) return
    
    loadShareList()
  }, [slug])
  
  useEffect(() => {
    if (user && shareList) {
      setIsOwner(user.id === shareList.user_id)
      
      if (user.id === shareList.user_id) {
        loadUserWatchlist()
      }
    }
  }, [user, shareList])
  
  const loadShareList = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try to get share list by ID first (since we're using ID in the URL)
      let list = await databaseService.getShareListById(slug!)
      
      // If not found by ID, try by slug
      if (!list) {
        list = await databaseService.getShareListBySlug(slug!)
      }

      // If list is not public and current user is not the owner, show error
      if (list && !list.is_public && (!user || user.id !== list.user_id)) {
        setError(languageCode === 'tr' ? 'Bu liste herkese açık değil veya erişim izniniz yok.' : 'This list is not public or you do not have access.')
        setLoading(false)
        return
      }
      
      if (!list) {
        setError(languageCode === 'tr' ? 'Paylaşım listesi bulunamadı' : 'Share list not found')
        setLoading(false)
        return
      }
      
      setShareList(list)
      setListName(list.name)
      setListDescription(list.description || '')
      setIsPublic(list.is_public)
      
      // Get list items
      const items = await databaseService.getShareListItems(list.id)
      console.log(`📋 Found ${items.length} items in list ${list.id}`)
      
      // Load content details for each item
      const contentItems: ContentItem[] = []
      
      for (const item of items) {
        try {
          const contentItem = await databaseService.getContentById(item.content_id, item.content_type)
          if (contentItem) {
            contentItems.push(contentItem)
            console.log(`✅ Loaded content: ${contentItem.title}`)
          }
        } catch (error) {
          console.error(`Error fetching content ${item.content_id}:`, error)
        }
      }
      
      console.log(`📊 Total content items loaded: ${contentItems.length}`)
      setContent(contentItems)
      
    } catch (error) {
      console.error('Error loading share list:', error)
      setError(languageCode === 'tr' ? 'Paylaşım listesi yüklenirken bir hata oluştu' : 'Error loading share list')
    } finally {
      setLoading(false)
    }
  }
  
  const loadUserWatchlist = async () => {
    if (!user) return
    
    try {
      const watchlist = await databaseService.getUserWatchlist(user.id)
      const watchlistMap = new Map<number, string>()
      watchlist.forEach(item => {
        watchlistMap.set(item.content_id, item.status)
      })
      setUserWatchlistMap(watchlistMap)
    } catch (error) {
      console.error('Error loading watchlist:', error)
    }
  }
  
  const handleWatchlistStatusChange = async (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    try {
      if (status === null) {
        // Remove from watchlist
        await databaseService.removeFromWatchlist(user.id, contentId, contentType)
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.delete(contentId)
          return newMap
        })
      } else {
        // Add to watchlist with specified status
        await databaseService.addToWatchlist(user.id, contentId, contentType, status, {
          onConflict: 'user_id,content_id,content_type'
        })
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.set(contentId, status)
          return newMap
        })
      }
    } catch (error) {
      console.error('Error updating watchlist:', error)
    }
  }
  
  const handleShareList = () => {
    if (!shareList) return

    // Create share URL with language prefix
    const shareUrl = `${window.location.origin}/${languageCode}/share/${shareList.slug || shareList.id}`

    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: shareList.name,
        text: shareList.description || 'Check out my watchlist on TVSHOWup!',
        url: shareUrl
      }).catch(error => {
        console.error('Error sharing:', error)
        // Fallback to clipboard
        copyToClipboard(shareUrl)
      })
    } else {
      // Fallback to clipboard
      copyToClipboard(shareUrl)
    }
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(err => {
        console.error('Could not copy text: ', err)
      })
  }
  
  const handleSaveChanges = async () => {
    if (!shareList || !isOwner) return
    
    try {
      setIsSaving(true)
      
      const success = await databaseService.updateShareList(shareList.id, {
        name: listName,
        description: listDescription,
        is_public: isPublic
      })
      
      if (success) {
        // Update local state
        setShareList({
          ...shareList,
          name: listName,
          description: listDescription,
          is_public: isPublic
        })
        
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error updating share list:', error)
    } finally {
      setIsSaving(false)
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
  
  if (error || !shareList) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              {error || (languageCode === 'tr' ? 'Paylaşım listesi bulunamadı' : 'Share list not found')}
            </h2>
            <p className="text-gray-400 mb-6">
              {languageCode === 'tr' 
                ? 'Bu paylaşım listesi bulunamadı veya artık mevcut değil.'
                : 'This share list could not be found or is no longer available.'}
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
        
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="listName" className="block text-sm font-medium text-gray-300 mb-1">
                  {languageCode === 'tr' ? 'Liste Adı' : 'List Name'}
                </label>
                <input
                  id="listName"
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={languageCode === 'tr' ? 'Liste adı girin' : 'Enter list name'}
                />
              </div>
              
              <div>
                <label htmlFor="listDescription" className="block text-sm font-medium text-gray-300 mb-1">
                  {languageCode === 'tr' ? 'Açıklama' : 'Description'}
                </label>
                <textarea
                  id="listDescription"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={languageCode === 'tr' ? 'Liste açıklaması girin' : 'Enter list description'}
                  rows={3}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="isPublic"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded"
                />
                <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-300">
                  {languageCode === 'tr' ? 'Herkese açık' : 'Public'}
                </label>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Kaydet' : 'Save'}
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setListName(shareList.name)
                    setListDescription(shareList.description || '')
                    setIsPublic(shareList.is_public)
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                >
                  <X className="w-4 h-4 mr-2" />
                  {languageCode === 'tr' ? 'İptal' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
                    {getLocalizedListName(shareList, languageCode)}
                    {isPublic ? (
                      <Globe className="w-4 h-4 ml-2 text-green-400" />
                    ) : (
                      <Lock className="w-4 h-4 ml-2 text-yellow-400" />
                    )}
                  </h1>
                  {getLocalizedListDescription(shareList, languageCode) && (
                    <p className="text-gray-400">{getLocalizedListDescription(shareList, languageCode)}</p>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  {isOwner && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Düzenle' : 'Edit'}
                    </button>
                  )}
                  
                  <button
                    onClick={handleShareList}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {languageCode === 'tr' ? 'Kopyalandı!' : 'Copied!'}
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 mr-2" />
                        {languageCode === 'tr' ? 'Paylaş' : 'Share'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Content */}
        {content.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'Bu Liste Boş' : 'This List is Empty'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'Bu paylaşım listesinde henüz içerik yok.'
                  : 'There are no items in this share list yet.'
                }
              </p>
              {isOwner && (
                <p className="text-gray-400">
                  {languageCode === 'tr' 
                    ? 'İçerik kartlarındaki klasör simgesine tıklayarak paylaşım listenize ekleyin.'
                    : 'Add items to your share list by clicking the folder icon on content cards.'
                  }
                </p>
              )}
            </div>
          </div>
        ) : (
          <ContentGrid
            title={languageCode === 'tr' ? 'Paylaşılan İçerikler' : 'Shared Content'}
            content={content}
            onWatchlistStatusChange={isOwner ? handleWatchlistStatusChange : undefined}
            userWatchlistMap={userWatchlistMap}
            onAuthRequired={() => openAuthPrompt('watchlist')}
          />
        )}
      </div>
    </div>
  )
}

export default ShareListPage
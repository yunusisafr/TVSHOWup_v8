import React, { useState, useEffect } from 'react'
import { X, Calendar, Star, Film, Tv, Trash2, Check, AlertCircle } from 'lucide-react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { databaseService, ContentItem } from '../lib/database'
import { tmdbService } from '../lib/tmdb'
import { createFullSlug, createSEOSlug } from '../lib/utils'
import { Link } from 'react-router-dom'

interface ListContentDisplayModalProps {
  isOpen: boolean
  onClose: () => void
  listId: string
  listName: string
  onContentRemoved?: () => void
}

const ListContentDisplayModal: React.FC<ListContentDisplayModalProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
  onContentRemoved
}) => {
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingContentId, setRemovingContentId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && listId) {
      loadListContent()
    }
  }, [isOpen, listId])

  const loadListContent = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get list items
      const items = await databaseService.getShareListItems(listId)
      
      // Load content details for each item
      const contentItems: ContentItem[] = []
      
      for (const item of items) {
        try {
          const contentItem = await databaseService.getContentById(item.content_id, item.content_type)
          if (contentItem) {
            contentItems.push(contentItem)
          }
        } catch (error) {
          console.error(`Error fetching content ${item.content_id}:`, error)
        }
      }
      
      setContent(contentItems)
      
    } catch (error) {
      console.error('Error loading list content:', error)
      setError(languageCode === 'tr' ? 'Liste içeriği yüklenirken bir hata oluştu' : 'Error loading list content')
    } finally {
      setLoading(false)
    }
  }

  const getReleaseYear = (item: ContentItem) => {
    const date = item.release_date || item.first_air_date
    return date ? new Date(date).getFullYear() : 'TBA'
  }

  const handleRemoveContent = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      setRemovingContentId(contentId)
      setRemoveError(null)
      
      const success = await databaseService.removeContentFromShareList(listId, contentId, contentType)
      
      if (success) {
        // Remove from local state
        setContent(prev => prev.filter(item => !(item.id === contentId && item.content_type === contentType)))
        
        // Notify parent component
        if (onContentRemoved) {
          onContentRemoved()
        }
      } else {
        setRemoveError(languageCode === 'tr' ? 'İçerik çıkarılırken hata oluştu' : 'Error removing content')
      }
    } catch (error) {
      console.error('Error removing content:', error)
      setRemoveError(languageCode === 'tr' ? 'İçerik çıkarılırken hata oluştu' : 'Error removing content')
    } finally {
      setRemovingContentId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]">
      <div className="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {listName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {removeError && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 mb-4 flex items-start">
              <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{removeError}</span>
            </div>
          )}
          
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="bg-gray-700 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-[2/3] bg-gray-600"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
            </div>
          ) : content.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">
                {languageCode === 'tr' ? 'Bu listede henüz içerik yok' : 'No content in this list yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {content.map((item) => (
                <div
                  key={`${item.content_type}-${item.id}`}
                  className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition-colors group relative"
                >
                  <Link
                    to={`/${languageCode}/${item.content_type}/${item.slug || createSEOSlug(item.id,
                      item.content_type === 'movie' ? item.original_title || item.title : item.original_name || item.title,
                      item.content_type === 'movie' ? item.original_title || item.title : item.original_name || item.title)}`}
                    onClick={onClose}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] bg-gray-600">
                      <img
                        src={item.poster_path
                          ? tmdbService.getImageUrl(item.poster_path, 'w342', item, languageCode)
                          : '/placeholder-poster.jpg'
                        }
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-poster.jpg'
                        }}
                      />
                      
                      {/* Content Type Badge */}
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white ${
                        item.content_type === 'movie' ? 'bg-primary-500' : 'bg-green-600'
                      }`}>
                        {item.content_type === 'movie' 
                          ? (languageCode === 'tr' ? 'Film' : 'Movie') 
                          : (languageCode === 'tr' ? 'Dizi' : 'TV Show')}
                      </div>
                      
                      {/* Rating Badge */}
                      <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center">
                        <Star className="w-3 h-3 text-yellow-400 mr-1" />
                        <span className="text-xs text-white">{item.vote_average.toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <h3 className="font-medium text-white text-sm line-clamp-1 group-hover:text-primary-400 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center text-gray-400 text-xs mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{getReleaseYear(item)}</span>
                      </div>
                    </div>
                  </Link>
                  
                  {/* Remove Button - Always visible at bottom */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemoveContent(item.id, item.content_type)
                    }}
                    disabled={removingContentId === item.id}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-b-lg text-xs font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                    title={languageCode === 'tr' ? 'Listeden Çıkar' : 'Remove from List'}
                  >
                    {removingContentId === item.id ? (
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    <span>
                      {removingContentId === item.id 
                        ? (languageCode === 'tr' ? 'Çıkarılıyor...' : 'Removing...')
                        : (languageCode === 'tr' ? 'Listeden Çıkar' : 'Remove from List')
                      }
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ListContentDisplayModal
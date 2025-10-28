import React, { useState, useEffect } from 'react'
import { Globe, Calendar, User } from 'lucide-react'
import { ShareList, ContentItem, databaseService } from '../lib/database'
import { getLocalizedListName, getLocalizedListDescription } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import ContentGrid from './ContentGrid'

interface PublicShareListSectionProps {
  list: ShareList
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  userWatchlistMap?: Map<number, string>
  onAuthRequired?: () => void
}

const PublicShareListSection: React.FC<PublicShareListSectionProps> = ({
  list,
  onWatchlistStatusChange,
  userWatchlistMap = new Map(),
  onAuthRequired
}) => {
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadListContent()
  }, [list.id])

  const loadListContent = async () => {
    try {
      setLoading(true)
      setError(null)
      
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
      console.error('Error loading list content:', error)
      setError(languageCode === 'tr' ? 'Liste içeriği yüklenirken bir hata oluştu' : 'Error loading list content')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(languageCode === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="mb-12">
      {/* List Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            {getLocalizedListName(list, languageCode)}
            <Globe className="w-5 h-5 ml-2 text-green-400" title={languageCode === 'tr' ? 'Herkese Açık' : 'Public'} />
          </h2>
        </div>

        {getLocalizedListDescription(list, languageCode) && (
          <p className="text-gray-300 mb-4 leading-relaxed">
            {getLocalizedListDescription(list, languageCode)}
          </p>
        )}

        <div className="flex items-center text-gray-400 text-sm space-x-4">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{formatDate(list.created_at)}</span>
          </div>
          
          {list.user_display_name && (
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              <span>{list.user_display_name}</span>
            </div>
          )}
          
          {list.item_count !== undefined && (
            <div className="flex items-center">
              <span className="font-medium text-white">{list.item_count}</span>
              <span className="ml-1">
                {list.item_count === 1 
                  ? (languageCode === 'tr' ? 'içerik' : 'item')
                  : (languageCode === 'tr' ? 'içerik' : 'items')
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* List Content */}
      {error ? (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : content.length === 0 && !loading ? (
        <div className="text-center py-8">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white mb-2">
              {languageCode === 'tr' ? 'Bu Liste Boş' : 'This List is Empty'}
            </h3>
            <p className="text-gray-400">
              {languageCode === 'tr' 
                ? 'Bu öneri listesinde henüz içerik yok.'
                : 'There are no items in this suggestion list yet.'
              }
            </p>
          </div>
        </div>
      ) : (
        <ContentGrid
          title="" // Empty title since we show it above
          content={content}
          loading={loading}
          onWatchlistStatusChange={onWatchlistStatusChange}
          userWatchlistMap={userWatchlistMap}
          onAuthRequired={onAuthRequired}
        />
      )}
    </div>
  )
}

export default PublicShareListSection
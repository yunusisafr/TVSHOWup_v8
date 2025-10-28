import React, { useState } from 'react'
import { Calendar, Star, Eye, Check, Bookmark, X, Film, Tv, MoreHorizontal, FolderPlus, Folder } from 'lucide-react'
import { ContentItem } from '../lib/database'
import { getLocalizedTitle } from '../lib/database'
import { tmdbService } from '../lib/tmdb'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { createSEOSlug } from '../lib/utils'

interface WatchlistListViewProps {
  content: ContentItem[]
  onWatchlistStatusChange?: (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => void
  onShareListToggle?: (contentId: number, contentType: 'movie' | 'tv_show', add: boolean) => void
  onAuthRequired?: () => void
  shareListMap?: Map<number, boolean> // Kept for future use
}

const WatchlistListView: React.FC<WatchlistListViewProps> = ({
  content,
  onWatchlistStatusChange,
  onShareListToggle,
  shareListMap = new Map(),
  onAuthRequired
}) => {
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)

  if (content.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">
          {t.noData}
        </p>
      </div>
    )
  }

  const getWatchlistStatusIcon = (item: ContentItem) => {
    if (!item.watchlist_status) return null;
    
    switch (item.watchlist_status) {
      case 'want_to_watch':
        return <Bookmark className="w-4 h-4 text-blue-400" />;
      case 'watching':
        return <Eye className="w-4 h-4 text-yellow-400" />;
      case 'watched':
        return <Check className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  }

  const getWatchlistStatusText = (item: ContentItem) => {
    if (!item.watchlist_status) return '';
    
    switch (item.watchlist_status) {
      case 'want_to_watch':
        return t.wantToWatch;
      case 'watching':
        return t.watching;
      case 'watched':
        return t.watched;
      default:
        return '';
    }
  }

  const getWatchlistStatusColor = (item: ContentItem) => {
    if (!item.watchlist_status) return '';
    
    switch (item.watchlist_status) {
      case 'want_to_watch':
        return 'text-blue-400';
      case 'watching':
        return 'text-yellow-400';
      case 'watched':
        return 'text-green-400';
      default:
        return '';
    }
  }

  const getReleaseYear = (item: ContentItem) => {
    const date = item.release_date || item.first_air_date;
    return date ? new Date(date).getFullYear() : 'TBA';
  }

  const handleStatusChange = (item: ContentItem, status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (onWatchlistStatusChange) {
      onWatchlistStatusChange(item.id, item.content_type, status);
      setActiveDropdown(null);
    }
  }

  const toggleDropdown = (contentId: number) => {
    setActiveDropdown(activeDropdown === contentId ? null : contentId);
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown !== null) {
        const dropdowns = document.querySelectorAll('.status-dropdown');
        let clickedInside = false;
        
        dropdowns.forEach(dropdown => {
          if (dropdown.contains(event.target as Node)) {
            clickedInside = true;
          }
        });
        
        if (!clickedInside) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  return (
    <div className="bg-gray-800 rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full watchlist-table">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider">
                {languageCode === 'tr' ? 'İçerik' : 'Content'}
              </th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                {languageCode === 'tr' ? 'Tür' : 'Type'}
              </th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                {languageCode === 'tr' ? 'Yıl' : 'Year'}
              </th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider">
                {languageCode === 'tr' ? 'Durum' : 'Status'}
              </th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider">
                {languageCode === 'tr' ? 'İşlemler' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {content.map((item) => (
              <tr key={`${item.content_type}-${item.id}`} className="hover:bg-gray-700/50">
                <td className="px-2 py-2 sm:px-4 sm:py-3">
                  <Link to={`/${languageCode}/${item.content_type}/${item.slug || createSEOSlug(item.id, item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title), item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title))}`} className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-8 mr-3 hidden xs:block">
                      <img
                        src={item.poster_path ? tmdbService.getImageUrl(item.poster_path, 'w92') : '/placeholder-poster.jpg'} 
                        alt={item.title}
                        className="h-12 w-8 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-poster.jpg'
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-white line-clamp-1 truncate max-w-[100px] xs:max-w-[150px] sm:max-w-full">{item.title}</div>
                      <div className="text-xs text-gray-400 hidden sm:block">
                        {item.vote_average > 0 && (
                          <div className="flex items-center">
                            <Star className="w-3 h-3 text-yellow-400 mr-1" />
                            <span>{item.vote_average.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap hidden sm:table-cell">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    item.content_type === 'movie' 
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-green-600/20 text-green-400'
                  }`}>
                    {item.content_type === 'movie' 
                      ? (languageCode === 'tr' ? 'Film' : t.movie) 
                      : (languageCode === 'tr' ? 'Dizi' : t.tvShow)}
                  </span>
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm text-gray-400 hidden sm:table-cell">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {getReleaseYear(item)}
                  </div>
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  <div className={`flex items-center ${getWatchlistStatusColor(item)} px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md`}>
                    {getWatchlistStatusIcon(item)}
                    <span className="ml-1 text-[9px] xs:text-[10px] sm:text-xs">{getWatchlistStatusText(item)}</span>
                  </div>
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-1 relative status-dropdown">
                    {/* Share List Toggle Button */}
                    {/* Temporarily disable share list feature */}
                    {/* <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onShareListToggle) {
                          onShareListToggle(item.id, item.content_type, !shareListMap.has(item.id));
                        }
                      }}
                      className={`text-gray-400 hover:text-white hover:bg-gray-700 p-1 rounded ${
                        shareListMap.has(item.id) ? 'text-purple-400' : ''
                      }`}
                      aria-label={languageCode === 'tr' ? 'Paylaşım Listesi' : 'Share List'}
                    >
                      {shareListMap.has(item.id) ? (
                        <Folder className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <FolderPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button> */}
                    
                    <button
                      onClick={() => toggleDropdown(item.id)}
                      className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 rounded"
                      aria-label={languageCode === 'tr' ? 'İşlemler' : 'Actions'}
                    >
                      <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    
                    {activeDropdown === item.id && (
                      <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-xl p-2 border border-gray-700 w-44 z-50">
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleStatusChange(item, 'want_to_watch')}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                              item.watchlist_status === 'want_to_watch' 
                               ? 'bg-blue-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Bookmark className="w-4 h-4 mr-2" />
                            <span>{t.wantToWatch}</span>
                          </button>
                          
                          <button
                            onClick={() => handleStatusChange(item, 'watching')}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                              item.watchlist_status === 'watching' 
                               ? 'bg-yellow-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            <span>{t.watching}</span>
                          </button>
                          
                          <button
                            onClick={() => handleStatusChange(item, 'watched')}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                              item.watchlist_status === 'watched' 
                               ? 'bg-green-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            <span>{t.watched}</span>
                          </button>
                          
                          <div className="border-t border-gray-700 my-1"></div>
                          
                          <button
                            onClick={() => handleStatusChange(item, null)}
                           className="flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-red-600/20 text-red-300 transition-colors"
                          >
                            <X className="w-4 h-4 mr-2" />
                            <span>{t.delete}</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <Link
                      to={`/${languageCode}/${item.content_type}/${item.slug || createSEOSlug(item.id, item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title), item.content_type === 'movie' ? (item.original_title || item.title) : (item.original_name || item.title))}`}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 p-1 rounded"
                      aria-label={languageCode === 'tr' ? 'İçeriğe Git' : 'Go to Content'}
                    >
                      {item.content_type === 'movie' ? (
                        <Film className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default WatchlistListView
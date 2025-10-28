import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { databaseService, ShareList } from '../lib/database';
import { getLocalizedListName, getLocalizedListDescription } from '../lib/database';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { tmdbService } from '../lib/tmdb';
import { Calendar, User, AlertCircle } from 'lucide-react';

const DiscoverListsPage: React.FC = () => {
  const { languageCode } = useUserPreferences();
  const { t } = useTranslation(languageCode);

  const [publicLists, setPublicLists] = useState<ShareList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicLists();
  }, []); // Load once on mount

  const loadPublicLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const lists = await databaseService.getPublicShareLists('created_at', 'desc', undefined, 20);
      setPublicLists(lists);
    } catch (err: any) {
      console.error('Error loading public lists:', err);
      setError(err.message || (languageCode === 'tr' ? 'Herkese açık listeler yüklenirken bir hata oluştu.' : 'Error loading public lists.'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(languageCode === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          {languageCode === 'tr' ? 'Herkese Açık Listeleri Keşfet' :
           languageCode === 'de' ? 'Öffentliche Listen entdecken' :
           languageCode === 'fr' ? 'Découvrir les listes publiques' :
           languageCode === 'es' ? 'Descubrir listas públicas' :
           languageCode === 'it' ? 'Scopri liste pubbliche' :
           'Discover Public Lists'}
        </h1>


        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : publicLists.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'Herkese Açık Liste Bulunamadı' :
                 languageCode === 'de' ? 'Keine öffentlichen Listen gefunden' :
                 languageCode === 'fr' ? 'Aucune liste publique trouvée' :
                 languageCode === 'es' ? 'No se encontraron listas públicas' :
                 languageCode === 'it' ? 'Nessuna lista pubblica trovata' :
                 'No Public Lists Found'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' ? 'Henüz herkese açık liste bulunmuyor.' :
                 languageCode === 'de' ? 'Noch keine öffentlichen Listen verfügbar.' :
                 languageCode === 'fr' ? 'Aucune liste publique disponible pour le moment.' :
                 languageCode === 'es' ? 'Aún no hay listas públicas disponibles.' :
                 languageCode === 'it' ? 'Nessuna lista pubblica ancora disponibile.' :
                 'No public lists available yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicLists.map((list) => (
              <div key={list.id} className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700/50 transition-colors">
                <Link to={`/${languageCode}/u/${list.user_display_name}/my-suggestion-lists`} className="block">
                    {/* Content Preview Section */}
                    {list.preview_content && list.preview_content.length > 0 && (
                      <div className="mb-4">
                        <div className="flex space-x-2 overflow-hidden">
                          {list.preview_content.slice(0, 5).map((content, index) => (
                            <div 
                              key={`${content.content_type}-${content.id}`}
                              className="flex-shrink-0 w-12 h-16 bg-gray-700 rounded-sm overflow-hidden"
                              style={{ zIndex: 5 - index }}
                            >
                              <img
                                src={content.poster_path 
                                  ? tmdbService.getImageUrl(content.poster_path, 'w154')
                                  : '/placeholder-poster.jpg'
                                }
                                alt={content.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder-poster.jpg'
                                }}
                              />
                            </div>
                          ))}
                          {list.item_count && list.item_count > 5 && (
                            <div className="flex-shrink-0 w-12 h-16 bg-gray-600 rounded-sm flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                +{list.item_count - 5}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* List Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 mr-2">
                        <h3 className="text-lg font-bold text-white line-clamp-2 group-hover:text-primary-400 transition-colors mb-1">
                          {getLocalizedListName(list, languageCode)}
                        </h3>
                      </div>
                    </div>

                    {getLocalizedListDescription(list, languageCode) && (
                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                        {getLocalizedListDescription(list, languageCode)}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-gray-400 text-sm">
                      <div className="flex items-center space-x-4">
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
                            {/* Item count hidden */}
                          </div>
                        )}
                      </div>
                    </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverListsPage;
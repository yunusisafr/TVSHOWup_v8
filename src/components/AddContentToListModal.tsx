import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Check, Loader2, AlertCircle, Film, Tv, Star, Calendar } from 'lucide-react';
import { tmdbService } from '../lib/tmdb';
import { databaseService } from '../lib/database';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { SUPPORTED_LANGUAGES } from '../config/languages';
import { getUITranslation } from '../config/uiTranslations';

interface SearchResult {
  id: number;
  title: string;
  overview: string;
  poster_path?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  content_type: 'movie' | 'tv_show';
  original_language?: string;
  isInDatabase: boolean;
}

interface AddContentToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
}

export default function AddContentToListModal({
  isOpen,
  onClose,
  listId,
  listName,
}: AddContentToListModalProps) {
  const { countryCode, languageCode } = useUserPreferences();
  const { t } = useTranslation(languageCode);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingContentId, setAddingContentId] = useState<number | null>(null);
  const [addedContentIds, setAddedContentIds] = useState<Set<number>>(new Set());
  const [existingContentIds, setExistingContentIds] = useState<Set<number>>(new Set());

  // Load existing content in the list when modal opens
  useEffect(() => {
    if (isOpen && listId) {
      loadExistingContent();
    }
  }, [isOpen, listId]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setAddedContentIds(new Set());
    }
  }, [isOpen]);

  const loadExistingContent = async () => {
    try {
      const items = await databaseService.getShareListItems(listId);
      const contentIds = new Set(items.map(item => item.content_id));
      setExistingContentIds(contentIds);
    } catch (error) {
      console.error('Error loading existing content:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }
    
    if (searchQuery.length < 2) {
      setError(languageCode === 'tr' ? 'En az 2 karakter girin' : 'Enter at least 2 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Searching for "${searchQuery}" in ${languageCode} for ${countryCode}`);
      
      // Search TMDB for content with better error handling
      let tmdbResults;
      try {
        tmdbResults = await tmdbService.searchMulti(searchQuery, 1, languageCode, countryCode);
        console.log(`📊 TMDB returned ${tmdbResults.results?.length || 0} results`);
      } catch (tmdbError) {
        console.error('TMDB search error:', tmdbError);
        throw new Error(languageCode === 'tr' ? 'Arama servisi şu anda kullanılamıyor' : 'Search service is currently unavailable');
      }
      
      if (!tmdbResults || !tmdbResults.results) {
        throw new Error(languageCode === 'tr' ? 'Arama sonucu alınamadı' : 'No search results received');
      }
      
      const formattedResults: SearchResult[] = [];
      const dbCheckPromises: Promise<boolean>[] = [];
      
      // Process TMDB results
      const validResults = tmdbResults.results.filter(item => 
        (item.media_type === 'movie' || item.media_type === 'tv') && 
        (item.title || item.name) &&
        item.id
      );
      
      console.log(`✅ Found ${validResults.length} valid results`);
      
      for (const item of validResults.slice(0, 12)) {
        const contentType = item.media_type === 'movie' ? 'movie' : 'tv_show';
        
        const result: SearchResult = {
          id: item.id,
          title: item.title || item.name || '',
          overview: item.overview || '',
          poster_path: item.poster_path,
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          popularity: item.popularity || 0,
          release_date: item.release_date,
          first_air_date: item.first_air_date,
          content_type: contentType,
          original_language: item.original_language,
          isInDatabase: false, // Will be updated below
        };
        
        formattedResults.push(result);
        
        // Check if exists in database (async)
        dbCheckPromises.push(
          databaseService.getContentById(item.id, contentType)
            .then(exists => !!exists)
            .catch(() => false)
        );
      }
      
      if (formattedResults.length === 0) {
        setError(languageCode === 'tr' ? `"${searchQuery}" için sonuç bulunamadı` : `No results found for "${searchQuery}"`);
        setSearchResults([]);
        return;
      }
      
      // Wait for database checks to complete
      const dbExistenceResults = await Promise.all(dbCheckPromises);
      
      // Update isInDatabase flags
      formattedResults.forEach((result, index) => {
        result.isInDatabase = dbExistenceResults[index];
      });
      
      // Sort results by relevance
      const sortedResults = formattedResults.sort((a, b) => {
        // Exact matches first
        const aExact = a.title.toLowerCase() === searchQuery.toLowerCase();
        const bExact = b.title.toLowerCase() === searchQuery.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Content already in database gets slight boost
        if (a.isInDatabase && !b.isInDatabase) return -1;
        if (!a.isInDatabase && b.isInDatabase) return 1;
        
        // Title starts with query
        const aStarts = a.title.toLowerCase().startsWith(searchQuery.toLowerCase());
        const bStarts = b.title.toLowerCase().startsWith(searchQuery.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Quality score
        if (a.vote_count >= 100 && b.vote_count >= 100) {
          if (Math.abs(a.vote_average - b.vote_average) > 0.5) {
            return b.vote_average - a.vote_average;
          }
        }
        
        return b.popularity - a.popularity;
      });

      setSearchResults(sortedResults);
      console.log(`🎯 Displaying ${sortedResults.length} sorted results`);
      
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : (languageCode === 'tr' ? 'Arama sırasında bir hata oluştu' : 'An error occurred during search'));
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContent = async (content: SearchResult) => {
    setAddingContentId(content.id);
    setError(null);

    try {
      // If not in database, save it first
      if (!content.isInDatabase) {
        console.log(`💾 Saving ${content.title} to database...`);
        await saveContentToDatabase(content);
      }

      // Add to share list
      const success = await databaseService.addContentToShareList(
        listId,
        content.id,
        content.content_type
      );

      if (success) {
        setAddedContentIds(prev => new Set(prev).add(content.id));
        setExistingContentIds(prev => new Set(prev).add(content.id));
      } else {
        setError(languageCode === 'tr' ? 'İçerik eklenirken hata oluştu' : 'Error adding content');
      }
    } catch (error) {
      console.error('Error adding content:', error);
      setError(languageCode === 'tr' ? 'İçerik eklenirken hata oluştu' : 'Error adding content');
    } finally {
      setAddingContentId(null);
    }
  };

  const saveContentToDatabase = async (result: SearchResult) => {
    try {
      if (result.content_type === 'movie') {
        // Get movie details in user's language for text content
        const localizedMovieDetails = await tmdbService.getMovieDetails(result.id, languageCode)
        
        // Get movie details in English for original posters and fallback data
        const originalMovieDetails = await tmdbService.getMovieDetails(result.id, 'en')
        
        // Get all available images for this movie to find language-specific posters
        const movieImages = await tmdbService.getMovieImages(result.id)
        
        // Process poster images by language
        const postersByLanguage = {}
        if (movieImages.posters && movieImages.posters.length > 0) {
          movieImages.posters.forEach(poster => {
            const lang = poster.iso_639_1 || 'null' // Use 'null' for language-neutral posters
            if (!postersByLanguage[lang] || poster.vote_average > (postersByLanguage[lang].vote_average || 0)) {
              postersByLanguage[lang] = {
                file_path: poster.file_path,
                vote_average: poster.vote_average || 0
              }
            }
          })
        }
        
        // Select the best poster based on priority: user's language > original language > English > highest rated
        let selectedPosterPath = originalMovieDetails.poster_path // fallback
        
        if (Object.keys(postersByLanguage).length > 0) {
          // Priority 1: User's current language
          if (postersByLanguage[languageCode]) {
            selectedPosterPath = postersByLanguage[languageCode].file_path
          }
          // Priority 2: Original language of the content
          else if (postersByLanguage[originalMovieDetails.original_language]) {
            selectedPosterPath = postersByLanguage[originalMovieDetails.original_language].file_path
          }
          // Priority 3: English
          else if (postersByLanguage['en']) {
            selectedPosterPath = postersByLanguage['en'].file_path
          }
          // Priority 4: Language-neutral (null)
          else if (postersByLanguage['null']) {
            selectedPosterPath = postersByLanguage['null'].file_path
          }
          // Priority 5: Highest rated poster
          else {
            const bestPoster = Object.values(postersByLanguage).reduce((best, current) => 
              current.vote_average > best.vote_average ? current : best
            )
            selectedPosterPath = bestPoster.file_path
          }
        }
        
        // Get translations for all supported languages
        const translations = {
          title: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getMovieDetails(result.id, lang)
            if (langDetails) {
              if (langDetails.title) translations.title[lang] = langDetails.title
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for movie ${result.id}:`, error)
          }
        }
        
        const movieData = {
          id: originalMovieDetails.id,
          title: originalMovieDetails.title, // Keep original title for backward compatibility
          original_title: originalMovieDetails.original_title,
          overview: originalMovieDetails.overview, // Keep original overview for backward compatibility
          release_date: originalMovieDetails.release_date || null,
          runtime: originalMovieDetails.runtime || null,
          poster_path: originalMovieDetails.poster_path, // Always use original English poster
          poster_paths_by_language: JSON.stringify(postersByLanguage), // Store all available posters by language
          backdrop_path: originalMovieDetails.backdrop_path, // Always use original backdrop
          vote_average: originalMovieDetails.vote_average || 0,
          vote_count: originalMovieDetails.vote_count || 0,
          popularity: originalMovieDetails.popularity || 0,
          adult: originalMovieDetails.adult || false,
          original_language: originalMovieDetails.original_language,
          video: originalMovieDetails.video || false,
          budget: originalMovieDetails.budget || 0,
          revenue: originalMovieDetails.revenue || 0,
          status: originalMovieDetails.status,
          tagline: originalMovieDetails.tagline, // Keep original tagline for backward compatibility
          homepage: originalMovieDetails.homepage,
          imdb_id: originalMovieDetails.imdb_id,
          belongs_to_collection: originalMovieDetails.belongs_to_collection ? JSON.stringify(originalMovieDetails.belongs_to_collection) : null,
          production_companies: originalMovieDetails.production_companies ? JSON.stringify(originalMovieDetails.production_companies) : null,
          production_countries: originalMovieDetails.production_countries ? JSON.stringify(originalMovieDetails.production_countries) : null,
          spoken_languages: originalMovieDetails.spoken_languages ? JSON.stringify(originalMovieDetails.spoken_languages) : null,
          genres: originalMovieDetails.genres ? JSON.stringify(originalMovieDetails.genres) : null,
          keywords: originalMovieDetails.keywords ? JSON.stringify(originalMovieDetails.keywords) : null,
          // Add multilingual translations
          title_translations: JSON.stringify(translations.title),
          overview_translations: JSON.stringify(translations.overview),
          tagline_translations: JSON.stringify(translations.tagline),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await databaseService.supabase
          .from('movies')
          .upsert(movieData);
        
        if (error) throw error;
        
      } else if (result.content_type === 'tv_show') {
        // Get TV show details in user's language for text content
        const localizedTVDetails = await tmdbService.getTVShowDetails(result.id, languageCode)
        
        // Get TV show details in English for original posters and fallback data
        const originalTVDetails = await tmdbService.getTVShowDetails(result.id, 'en')
        
        // Get all available images for this TV show to find language-specific posters
        const tvImages = await tmdbService.getTVShowImages(result.id)
        
        // Process poster images by language
        const postersByLanguage = {}
        if (tvImages.posters && tvImages.posters.length > 0) {
          tvImages.posters.forEach(poster => {
            const lang = poster.iso_639_1 || 'null' // Use 'null' for language-neutral posters
            if (!postersByLanguage[lang] || poster.vote_average > (postersByLanguage[lang].vote_average || 0)) {
              postersByLanguage[lang] = {
                file_path: poster.file_path,
                vote_average: poster.vote_average || 0
              }
            }
          })
        }
        
        // Select the best poster based on priority: user's language > original language > English > highest rated
        let selectedPosterPath = originalTVDetails.poster_path // fallback
        
        if (Object.keys(postersByLanguage).length > 0) {
          // Priority 1: User's current language
          if (postersByLanguage[languageCode]) {
            selectedPosterPath = postersByLanguage[languageCode].file_path
          }
          // Priority 2: Original language of the content
          else if (postersByLanguage[originalTVDetails.original_language]) {
            selectedPosterPath = postersByLanguage[originalTVDetails.original_language].file_path
          }
          // Priority 3: English
          else if (postersByLanguage['en']) {
            selectedPosterPath = postersByLanguage['en'].file_path
          }
          // Priority 4: Language-neutral (null)
          else if (postersByLanguage['null']) {
            selectedPosterPath = postersByLanguage['null'].file_path
          }
          // Priority 5: Highest rated poster
          else {
            const bestPoster = Object.values(postersByLanguage).reduce((best, current) => 
              current.vote_average > best.vote_average ? current : best
            )
            selectedPosterPath = bestPoster.file_path
          }
        }
        
        // Get translations for all supported languages
        const translations = {
          name: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getTVShowDetails(result.id, lang)
            if (langDetails) {
              if (langDetails.name) translations.name[lang] = langDetails.name
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for TV show ${result.id}:`, error)
          }
        }
        
        const tvData = {
          id: originalTVDetails.id,
          name: originalTVDetails.name, // Keep original name for backward compatibility
          original_name: originalTVDetails.original_name,
          overview: originalTVDetails.overview, // Keep original overview for backward compatibility
          first_air_date: originalTVDetails.first_air_date || null,
          last_air_date: originalTVDetails.last_air_date || null,
          poster_path: originalTVDetails.poster_path, // Always use original English poster
          poster_paths_by_language: JSON.stringify(postersByLanguage), // Store all available posters by language
          backdrop_path: originalTVDetails.backdrop_path, // Always use original backdrop
          vote_average: originalTVDetails.vote_average || 0,
          vote_count: originalTVDetails.vote_count || 0,
          popularity: originalTVDetails.popularity || 0,
          adult: originalTVDetails.adult || false,
          original_language: originalTVDetails.original_language,
          status: originalTVDetails.status,
          type: originalTVDetails.type,
          tagline: originalTVDetails.tagline, // Keep original tagline for backward compatibility
          homepage: originalTVDetails.homepage,
          in_production: originalTVDetails.in_production || false,
          number_of_episodes: originalTVDetails.number_of_episodes || 0,
          number_of_seasons: originalTVDetails.number_of_seasons || 0,
          episode_run_time: originalTVDetails.episode_run_time || null,
          origin_country: originalTVDetails.origin_country || null,
          created_by: originalTVDetails.created_by ? JSON.stringify(originalTVDetails.created_by) : null,
          genres: originalTVDetails.genres ? JSON.stringify(originalTVDetails.genres) : null,
          keywords: originalTVDetails.keywords ? JSON.stringify(originalTVDetails.keywords) : null,
          languages: originalTVDetails.languages || null,
          last_episode_to_air: originalTVDetails.last_episode_to_air ? JSON.stringify(originalTVDetails.last_episode_to_air) : null,
          next_episode_to_air: originalTVDetails.next_episode_to_air ? JSON.stringify(originalTVDetails.next_episode_to_air) : null,
          networks: originalTVDetails.networks ? JSON.stringify(originalTVDetails.networks) : null,
          production_companies: originalTVDetails.production_companies ? JSON.stringify(originalTVDetails.production_companies) : null,
          production_countries: originalTVDetails.production_countries ? JSON.stringify(originalTVDetails.production_countries) : null,
          seasons: originalTVDetails.seasons ? JSON.stringify(originalTVDetails.seasons) : null,
          spoken_languages: originalTVDetails.spoken_languages ? JSON.stringify(originalTVDetails.spoken_languages) : null,
          // Add multilingual translations
          name_translations: JSON.stringify(translations.name),
          overview_translations: JSON.stringify(translations.overview),
          tagline_translations: JSON.stringify(translations.tagline),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await databaseService.supabase
          .from('tv_shows')
          .upsert(tvData);
        
        if (error) throw error;
      }
      
      // Also save watch providers
      await saveWatchProviders(result.id, result.content_type);
      
    } catch (error) {
      console.error(`Error saving ${result.title} to database:`, error);
      throw error;
    }
  };

  const saveWatchProviders = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      const providersData = contentType === 'movie' 
        ? await tmdbService.getMovieWatchProviders(contentId)
        : await tmdbService.getTVShowWatchProviders(contentId);
      
      const countries = [countryCode, 'US', 'GB', 'TR', 'DE', 'FR'];
      
      for (const countryCode of countries) {
        const countryData = providersData.results[countryCode];
        if (!countryData) continue;
        
        const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads'] as const;
        
        for (const monetizationType of monetizationTypes) {
          const providers = countryData[monetizationType] || [];
          
          for (const provider of providers) {
            const { data: existingProvider } = await databaseService.supabase
              .from('providers')
              .select('id')
              .eq('id', provider.provider_id)
              .single();
            
            if (!existingProvider) {
              await databaseService.supabase
                .from('providers')
                .upsert({
                  id: provider.provider_id,
                  name: provider.provider_name,
                  logo_path: provider.logo_path,
                  display_priority: provider.display_priority || 0,
                  provider_type: 'streaming',
                  is_active: true,
                  updated_at: new Date().toISOString()
                });
            }
            
            await databaseService.supabase
              .from('content_providers')
              .upsert({
                content_id: contentId,
                content_type: contentType,
                provider_id: provider.provider_id,
                country_code: countryCode.toUpperCase(),
                monetization_type: monetizationType,
                link: countryData.link,
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
              });
          }
        }
      }
    } catch (error) {
      console.warn(`Error saving providers for ${contentType} ${contentId}:`, error);
    }
  };

  const getImageUrl = (path?: string) => {
    return path ? tmdbService.getImageUrl(path, 'w92') : '/placeholder-poster.jpg';
  };

  const getReleaseYear = (result: SearchResult) => {
    const date = result.release_date || result.first_air_date;
    return date ? new Date(date).getFullYear() : 'TBA';
  };

  const isContentInList = (contentId: number) => {
    return existingContentIds.has(contentId) || addedContentIds.has(contentId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {languageCode === 'tr' ? `"${listName}" Listesine İçerik Ekle` : `Add Content to "${listName}"`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Section */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={getUITranslation('searchPlaceholder', languageCode)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                languageCode === 'tr' ? 'Ara' : 'Search'
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {searchResults.length === 0 && !loading && searchQuery.length >= 2 && (
            <div className="text-center py-8 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p>{languageCode === 'tr' ? `"${searchQuery}" için sonuç bulunamadı` : `No results found for "${searchQuery}"`}</p>
            </div>
          )}

          {searchResults.length === 0 && !loading && searchQuery.length < 2 && (
            <div className="text-center py-8 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p>{languageCode === 'tr' ? 'Aramaya başlamak için en az 2 karakter girin' : 'Enter at least 2 characters to start searching'}</p>
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map((result) => (
              <div
                key={`${result.content_type}-${result.id}`}
                className="flex items-center space-x-4 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {/* Poster */}
                <div className="w-16 h-24 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={getImageUrl(result.poster_path)}
                    alt={result.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-poster.jpg';
                    }}
                  />
                </div>

                {/* Content Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{result.title}</h3>
                  
                  <div className="flex items-center space-x-3 text-sm text-gray-400 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      result.content_type === 'movie' ? 'bg-blue-600' : 'bg-green-600'
                    } text-white`}>
                      {result.content_type === 'movie' 
                        ? (languageCode === 'tr' ? 'Film' : 'Movie') 
                        : (languageCode === 'tr' ? 'Dizi' : 'TV Show')}
                    </span>
                    
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{getReleaseYear(result)}</span>
                    </div>
                    
                    {result.vote_count >= 10 && (
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-400" />
                        <span>{result.vote_average.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-gray-300 text-sm line-clamp-2">
                    {result.overview || (languageCode === 'tr' ? 'Açıklama mevcut değil' : 'No description available')}
                  </p>
                </div>

                {/* Add Button */}
                <div className="flex-shrink-0">
                  {isContentInList(result.id) ? (
                    <div className="flex items-center text-green-400 px-4 py-2">
                      <Check className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">
                        {languageCode === 'tr' ? 'Eklendi' : 'Added'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddContent(result)}
                      disabled={addingContentId === result.id}
                      className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingContentId === result.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {languageCode === 'tr' ? 'Ekleniyor...' : 'Adding...'}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          {languageCode === 'tr' ? 'Ekle' : 'Add'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
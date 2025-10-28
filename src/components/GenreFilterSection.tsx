import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Tv, ChevronRight } from 'lucide-react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { supabase } from '../lib/supabase';

// Define a Genre interface
interface Genre {
  id: number;
  name: string;
}

// Define props for the component
interface GenreFilterSectionProps {
  title?: string;
}

const GenreFilterSection: React.FC<GenreFilterSectionProps> = ({ 
  title = 'Genres' 
}) => {
  const navigate = useNavigate();
  const { languageCode, isLoading: preferencesLoading } = useUserPreferences();
  const { t } = useTranslation(languageCode);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  // Don't render until preferences are loaded
  if (preferencesLoading) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-800 rounded w-1/4 mb-4"></div>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-8 w-20 bg-gray-700 rounded-full animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    try {
      setLoading(true);
      
      // Get genres from the database
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name');
      
      if (error) {
        console.error('Error fetching genres:', error);
        return;
      }
      
      // Filter out any genres that might not be relevant or are duplicates
      const filteredGenres = data
        .filter(genre => genre.name && genre.name.length > 0)
        // Sort by name for better UX
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setGenres(filteredGenres);
    } catch (error) {
      console.error('Error in fetchGenres:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreClick = (genreId: number, genreName: string) => {
    navigate(`/search?genre=${genreId}&genreName=${encodeURIComponent(genreName)}`);
  };

  // Define genre colors for visual variety
  const getGenreColor = (index: number): string => {
    const colors = [
      'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400',
      'bg-green-600/20 hover:bg-green-600/30 text-green-400',
      'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400',
      'bg-red-600/20 hover:bg-red-600/30 text-red-400',
      'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400',
      'bg-pink-600/20 hover:bg-pink-600/30 text-pink-400',
      'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400',
      'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400',
      'bg-teal-600/20 hover:bg-teal-600/30 text-teal-400',
      'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{title}</h2>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{t.genres}</h2>
            {Array.from({ length: 12 }).map((_, index) => (
              <div 
                key={index} 
                className="h-10 w-24 bg-gray-700 rounded-full"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (genres.length === 0) {
    return null;
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {languageCode === 'tr' ? 'Türler' :
             languageCode === 'de' ? 'Genres' :
             languageCode === 'fr' ? 'Genres' :
             languageCode === 'es' ? 'Géneros' :
             languageCode === 'it' ? 'Generi' :
             'Genres'}
          </h2>
          <button 
            onClick={() => navigate('/search?view=genres')}
            className="text-primary-400 hover:text-primary-300 text-sm flex items-center"
          >
            {languageCode === 'tr' ? 'Tümünü Gör' :
             languageCode === 'de' ? 'Alle anzeigen' :
             languageCode === 'fr' ? 'Voir tout' :
             languageCode === 'es' ? 'Ver todo' :
             languageCode === 'it' ? 'Vedi tutti' :
             'See All'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {genres.slice(0, 16).map((genre, index) => (
            <button
              key={genre.id}
              onClick={() => handleGenreClick(genre.id, genre.name)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${getGenreColor(index)}`}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GenreFilterSection;
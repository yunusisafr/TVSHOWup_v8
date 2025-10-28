import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Film, Tv, User, TrendingUp, Clock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tmdbService } from '../lib/tmdb'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { createSEOSlug, buildLanguagePath } from '../lib/utils'

interface SearchResult {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  poster_path?: string
  profile_path?: string
  release_date?: string
  first_air_date?: string
  vote_average?: number
}

interface SmartSearchBarProps {
  placeholder?: string
  autoFocus?: boolean
  onClose?: () => void
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  placeholder,
  autoFocus = false,
  onClose
}) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { languageCode } = useUserPreferences()

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  const debouncedSearch = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([])
        return
      }

      setLoading(true)
      try {
        const results = await tmdbService.searchMulti(searchQuery, 1, languageCode)
        const filtered = results.results
          .filter((r: SearchResult) =>
            (r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person') &&
            (r.poster_path || r.profile_path)
          )
          .slice(0, 8)

        setSuggestions(filtered)
      } catch (error) {
        console.error('Search error:', error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300),
    [languageCode]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)
    debouncedSearch(value)
  }

  const handleClear = () => {
    setQuery('')
    setSuggestions([])
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const saveRecentSearch = (searchTerm: string) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  const handleResultClick = (result: SearchResult) => {
    const searchTerm = result.title || result.name || ''
    saveRecentSearch(searchTerm)

    if (result.media_type === 'movie') {
      const originalTitle = result.original_title || result.title || ''
      const slug = createSEOSlug(result.id, originalTitle, result.title || originalTitle)
      const path = `/${languageCode}/movie/${slug}`
      console.log(`🔗 [SmartSearch] Navigating to movie ${result.id} with slug: ${slug}`)
      navigate(path)
    } else if (result.media_type === 'tv') {
      const originalName = result.original_name || result.name || ''
      const slug = createSEOSlug(result.id, originalName, result.name || originalName)
      const path = `/${languageCode}/tv_show/${slug}`
      console.log(`🔗 [SmartSearch] Navigating to TV show ${result.id} with slug: ${slug}`)
      navigate(path)
    } else if (result.media_type === 'person') {
      const personSlug = createPersonSlug(result.id, result.name || '')
      console.log(`🔗 [SmartSearch] Navigating to person ${result.id} with slug: ${personSlug}`)
      navigate(`/${languageCode}/person/${personSlug}`)
    }

    setQuery('')
    setSuggestions([])
    onClose?.()
  }

  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    debouncedSearch(search)
    inputRef.current?.focus()
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleResultClick(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      handleClear()
      onClose?.()
    }
  }

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-4 h-4" />
      case 'tv':
        return <Tv className="w-4 h-4" />
      case 'person':
        return <User className="w-4 h-4" />
      default:
        return <Search className="w-4 h-4" />
    }
  }

  const showDropdown = query.length >= 2 || (query.length === 0 && recentSearches.length > 0)

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (languageCode === 'tr' ? 'Film, dizi veya kişi ara...' : 'Search movies, TV shows, or people...')}
          className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 pl-12 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
        {loading && (
          <Loader2 className="absolute right-4 top-3.5 w-5 h-5 text-blue-400 animate-spin" />
        )}
        {query && !loading && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-3.5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto"
        >
          {query.length === 0 && recentSearches.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center text-sm text-gray-400">
                  <Clock className="w-4 h-4 mr-2" />
                  {languageCode === 'tr' ? 'Son Aramalar' : 'Recent Searches'}
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {languageCode === 'tr' ? 'Temizle' : 'Clear'}
                </button>
              </div>
              <div className="space-y-2">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentSearchClick(search)}
                    className="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 rounded transition-colors flex items-center"
                  >
                    <Search className="w-4 h-4 mr-3 text-gray-500" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="p-2">
              {suggestions.map((result, index) => (
                <button
                  key={`${result.media_type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                    selectedIndex === index
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex-shrink-0 w-12 h-16 bg-gray-700 rounded overflow-hidden mr-3">
                    {(result.poster_path || result.profile_path) ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${result.poster_path || result.profile_path}`}
                        alt={result.title || result.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getMediaIcon(result.media_type)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium truncate">
                      {result.title || result.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1 opacity-80">
                      <span className="flex items-center">
                        {getMediaIcon(result.media_type)}
                        <span className="ml-1">
                          {result.media_type === 'movie'
                            ? (languageCode === 'tr' ? 'Film' : 'Movie')
                            : result.media_type === 'tv'
                            ? (languageCode === 'tr' ? 'Dizi' : 'TV Show')
                            : (languageCode === 'tr' ? 'Kişi' : 'Person')}
                        </span>
                      </span>
                      {result.vote_average && result.vote_average > 0 && (
                        <span className="flex items-center">
                          ⭐ {result.vote_average.toFixed(1)}
                        </span>
                      )}
                      {(result.release_date || result.first_air_date) && (
                        <span>
                          {(result.release_date || result.first_air_date)?.substring(0, 4)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && suggestions.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{languageCode === 'tr' ? 'Sonuç bulunamadı' : 'No results found'}</p>
              <p className="text-sm mt-1">
                {languageCode === 'tr'
                  ? 'Farklı bir arama terimi deneyin'
                  : 'Try a different search term'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SmartSearchBar

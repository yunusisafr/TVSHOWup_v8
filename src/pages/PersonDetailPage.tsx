import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Calendar, MapPin, Star, Film, Tv, ExternalLink } from 'lucide-react'
import { tmdbService } from '../lib/tmdb'
import { databaseService } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { extractIdFromSlug, createPersonSlug, generateSlug } from '../lib/utils'
import ContentCard from '../components/ContentCard'
import { useAuth } from '../contexts/AuthContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { SUPPORTED_LANGUAGES } from '../config/languages'

interface PersonDetails {
  id: number
  name: string
  biography: string
  birthday?: string
  deathday?: string
  place_of_birth?: string
  profile_path?: string
  known_for_department: string
  popularity: number
  gender: number
  adult: boolean
  imdb_id?: string
  homepage?: string
  also_known_as: string[]
  movie_credits?: {
    cast: any[]
    crew: any[]
  }
  tv_credits?: {
    cast: any[]
    crew: any[]
  }
  combined_credits?: {
    cast: any[]
    crew: any[]
  }
}

const PersonDetailPage: React.FC = () => {
  const { id: urlId, slug: urlSlug } = useParams<{ id: string; slug?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const { languageCode } = useUserPreferences()
  const { countryCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  // Extract actual ID from URL parameter (could be just ID or ID-slug format)
  const actualId = urlSlug ? urlId : (extractIdFromSlug(urlId!) || urlId)
  
  const [person, setPerson] = useState<PersonDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies')
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  const [contentWithProviders, setContentWithProviders] = useState<any[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [showAllMovies, setShowAllMovies] = useState(false)
  const [showAllTVShows, setShowAllTVShows] = useState(false)
  const INITIAL_DISPLAY_COUNT = 8

  const saveWatchProviders = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      // Get watch providers from TMDB
      const providers = contentType === 'movie' 
        ? await tmdbService.getMovieWatchProviders(contentId)
        : await tmdbService.getTVShowWatchProviders(contentId)
      
      if (!providers || !providers.results) {
        console.log(`No providers found for ${contentType} ${contentId}`)
        return
      }

      // Process each country's providers
      for (const [countryCode, countryData] of Object.entries(providers.results)) {
        const countryProviders = countryData as any
        
        // Process different monetization types
        const monetizationTypes = ['flatrate', 'buy', 'rent', 'ads', 'free']
        
        for (const monetizationType of monetizationTypes) {
          const providerList = countryProviders[monetizationType]
          if (!providerList || !Array.isArray(providerList)) continue
          
          for (const provider of providerList) {
            try {
              // First, ensure the provider exists in the providers table
              const { error: providerError } = await databaseService.supabase
                .from('providers')
                .upsert({
                  id: provider.provider_id,
                  name: provider.provider_name,
                  logo_path: provider.logo_path,
                  display_priority: provider.display_priority || 0,
                  is_active: true,
                  provider_type: 'streaming'
                })
              
              if (providerError) {
                console.error('Error upserting provider:', providerError)
                continue
              }
              
              // Then, save the content-provider relationship
              const { error: contentProviderError } = await databaseService.supabase
                .from('content_providers')
                .upsert({
                  content_id: contentId,
                  content_type: contentType,
                  provider_id: provider.provider_id,
                  country_code: countryCode.toUpperCase(),
                  monetization_type: monetizationType,
                  link: countryProviders.link || null,
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'content_id,content_type,provider_id,country_code,monetization_type'
                })
              
              if (contentProviderError) {
                console.error('Error upserting content provider:', contentProviderError)
              }
            } catch (error) {
              console.error(`Error processing provider ${provider.provider_name}:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error saving watch providers for ${contentType} ${contentId}:`, error)
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
      console.error('Error loading user watchlist:', error)
    }
  }

  const handleWatchlistStatusChange = async (contentId: number, newStatus: string, contentType: 'movie' | 'tv_show') => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }

    try {
      if (newStatus === 'none') {
        await databaseService.removeFromWatchlist(user.id, contentId, contentType)
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.delete(contentId)
          return newMap
        })
      } else {
        await databaseService.addToWatchlist(user.id, contentId, contentType, newStatus as any)
        setUserWatchlistMap(prev => new Map(prev.set(contentId, newStatus)))
      }
    } catch (error) {
      console.error('Error updating watchlist:', error)
    }
  }

  useEffect(() => {
    if (actualId) {
      loadPersonDetails()
    }
  }, [actualId, languageCode])

  useEffect(() => {
    if (user) {
      loadUserWatchlist()
    }
  }, [user])

  useEffect(() => {
    if (person) {
      loadContentWithProviders()
    }
  }, [person, activeTab, countryCode, showAllMovies, showAllTVShows])
  // Update meta data when person details load
  useEffect(() => {
    if (person) {
      updateMetaData()
    }
    
    // Cleanup function to reset meta data when component unmounts
    return () => {
      resetMetaData()
    }
  }, [person, languageCode])

  const loadPersonDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // For Arabic, fallback to English if biography is not available
      const requestLanguage = languageCode === 'ar' ? 'en' : languageCode
      const personData = await tmdbService.getPersonDetails(parseInt(actualId!), requestLanguage)
      setPerson(personData)

      // Check if we need to redirect to SEO-friendly URL
      if (personData) {
        const expectedSlug = createPersonSlug(personData.id, personData.name)
        const currentPath = window.location.pathname

        // Extract language code from current path
        const pathSegments = currentPath.split('/').filter(Boolean)
        const currentLang = pathSegments[0] || 'en'

        // Build expected path with language prefix
        const expectedPath = `/${currentLang}/person/${expectedSlug}`

        // If current URL doesn't match expected SEO-friendly URL, redirect
        if (currentPath !== expectedPath && !urlSlug) {
          console.log(`🔄 Redirecting from ${currentPath} to ${expectedPath} for SEO`)
          navigate(expectedPath, { replace: true })
          return
        }
      }

    } catch (error) {
      console.error('Error loading person details:', error)
      setError('Failed to load person details')
    } finally {
      setLoading(false)
    }
  }

  const saveContentToDatabase = async (credit: any, contentType: 'movie' | 'tv_show') => {
    try {
      console.log(`💾 Saving comprehensive content data for ${contentType} ${credit.id}`)
      
      if (contentType === 'movie') {
        // Get movie details in English for original data and posters
        const originalMovieDetails = await tmdbService.getMovieDetails(credit.id, 'en')
        
        // Get all available images for this movie to find language-specific posters
        const movieImages = await tmdbService.getMovieImages(credit.id)
        
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
        
        // Get translations for all supported languages
        const translations = {
          title: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getMovieDetails(credit.id, lang)
            if (langDetails) {
              if (langDetails.title) translations.title[lang] = langDetails.title
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for movie ${credit.id}:`, error)
          }
        }
        
        const movieData = {
          id: originalMovieDetails.id,
          title: originalMovieDetails.title,
          original_title: originalMovieDetails.original_title,
          overview: originalMovieDetails.overview,
          release_date: originalMovieDetails.release_date || null,
          runtime: originalMovieDetails.runtime || null,
          poster_path: originalMovieDetails.poster_path,
          poster_paths_by_language: JSON.stringify(postersByLanguage),
          backdrop_path: originalMovieDetails.backdrop_path,
          vote_average: originalMovieDetails.vote_average || 0,
          vote_count: originalMovieDetails.vote_count || 0,
          popularity: originalMovieDetails.popularity || 0,
          adult: originalMovieDetails.adult || false,
          original_language: originalMovieDetails.original_language,
          video: originalMovieDetails.video || false,
          budget: originalMovieDetails.budget || 0,
          revenue: originalMovieDetails.revenue || 0,
          status: originalMovieDetails.status,
          tagline: originalMovieDetails.tagline,
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
        }
        
        const { error } = await databaseService.supabase
          .from('movies')
          .upsert(movieData)
        
        if (error) throw error
        
      } else if (contentType === 'tv_show') {
        // Get TV show details in English for original data and posters
        const originalTVDetails = await tmdbService.getTVShowDetails(credit.id, 'en')
        
        // Get all available images for this TV show to find language-specific posters
        const tvImages = await tmdbService.getTVShowImages(credit.id)
        
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
        
        // Get translations for all supported languages
        const translations = {
          name: {},
          overview: {},
          tagline: {}
        }

        // Fetch translations for each supported language
        for (const lang of SUPPORTED_LANGUAGES) {
          try {
            const langDetails = await tmdbService.getTVShowDetails(credit.id, lang)
            if (langDetails) {
              if (langDetails.name) translations.name[lang] = langDetails.name
              if (langDetails.overview) translations.overview[lang] = langDetails.overview
              if (langDetails.tagline) translations.tagline[lang] = langDetails.tagline
            }
          } catch (error) {
            console.warn(`Failed to get ${lang} translation for TV show ${credit.id}:`, error)
          }
        }
        
        const tvData = {
          id: originalTVDetails.id,
          name: originalTVDetails.name,
          original_name: originalTVDetails.original_name,
          overview: originalTVDetails.overview,
          first_air_date: originalTVDetails.first_air_date || null,
          last_air_date: originalTVDetails.last_air_date || null,
          poster_path: originalTVDetails.poster_path,
          poster_paths_by_language: JSON.stringify(postersByLanguage),
          backdrop_path: originalTVDetails.backdrop_path,
          vote_average: originalTVDetails.vote_average || 0,
          vote_count: originalTVDetails.vote_count || 0,
          popularity: originalTVDetails.popularity || 0,
          adult: originalTVDetails.adult || false,
          original_language: originalTVDetails.original_language,
          status: originalTVDetails.status,
          type: originalTVDetails.type,
          tagline: originalTVDetails.tagline,
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
        }
        
        const { error } = await databaseService.supabase
          .from('tv_shows')
          .upsert(tvData)
        
        if (error) throw error
      }
      
      // Sync watch providers after saving content
      await syncWatchProviders(credit.id, contentType)
      
    } catch (error) {
      console.error(`Error saving ${credit.title || credit.name} to database:`, error);
      throw error;
    }
  };

  // Sync watch providers for content
  const syncWatchProviders = async (contentId: number, contentType: 'movie' | 'tv_show') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-watch-providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: contentId,
          contentType: contentType,
          countries: [countryCode, 'US', 'GB', 'TR', 'DE', 'FR'],
          tmdbApiKey: import.meta.env.VITE_TMDB_API_KEY
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn(`Failed to sync providers for ${contentType} ${contentId}:`, errorData.error);
        return;
      }
      
      const result = await response.json();
      console.log(`✅ Synced providers for ${contentType} ${contentId}:`, result);
    } catch (error) {
      console.warn(`⚠️ Error syncing providers for ${contentType} ${contentId}:`, error);
    }
  }

  const shouldUpdateContent = (dbContent: any, languageCode: string) => {
    if (!dbContent) return true
    
    // Check if we have localized title/name for the current language
    const hasLocalizedTitle = dbContent.title || dbContent.name
    
    // Check if we have localized overview for the current language
    const hasLocalizedOverview = dbContent.overview
    
    // If we're missing localized data, we should update
    return !hasLocalizedTitle || !hasLocalizedOverview
  }

  const loadContentWithProviders = async () => {
    if (!person) return
    
    try {
      setLoadingProviders(true)
      
      const allCredits = getTopCredits(activeTab)
      const isShowingAll = activeTab === 'movies' ? showAllMovies : showAllTVShows
      const displayCount = isShowingAll ? allCredits.length : INITIAL_DISPLAY_COUNT
      
      const topCredits = allCredits.slice(0, displayCount)
      
      console.log(`Loading content for ${activeTab}:`, {
        totalCredits: allCredits.length,
        displayCount,
        isShowingAll,
        topCreditsLength: topCredits.length
      })
      
      // For each content item, ensure it's in database with current language and get providers
      const contentWithProviderData = await Promise.all(
        topCredits.map(async (credit) => {
          try {
            const contentType = activeTab === 'movies' ? 'movie' : 'tv_show'
            
            // Check if content exists in database (non-blocking)
            const dbContent = await databaseService.getContentById(credit.id, contentType)
            
            // Start background operations without blocking UI
            if (!dbContent || shouldUpdateContent(dbContent, languageCode)) {
              // Save content in background without blocking
              saveContentToDatabase(credit, contentType)
                .then(() => saveWatchProviders(credit.id, contentType))
                .catch(error => console.error(`Background sync failed for ${credit.title || credit.name}:`, error))
            } else {
              // Save providers in background if content exists
              saveWatchProviders(credit.id, contentType)
                .catch(error => console.error(`Background provider sync failed for ${credit.title || credit.name}:`, error))
            }
            
            // Get current provider information (this can be empty initially and updated later)
            let providers = []
            try {
              providers = await databaseService.getContentProviders(
                credit.id,
                contentType,
                countryCode
              )
            } catch (error) {
              console.warn(`Could not load providers for ${credit.title || credit.name}:`, error)
            }
            
            return {
              ...(dbContent || credit),
              title: dbContent?.title || credit.title || credit.name,
              content_type: contentType,
              providers: providers || [],
              // Add additional fields from TMDB credit data
              vote_average: dbContent?.vote_average || credit.vote_average || 0,
              vote_count: dbContent?.vote_count || credit.vote_count || 0,
              popularity: dbContent?.popularity || credit.popularity || 0,
              poster_path: dbContent?.poster_path || credit.poster_path,
              backdrop_path: dbContent?.backdrop_path || credit.backdrop_path,
              overview: dbContent?.overview || credit.overview || '',
              release_date: dbContent?.release_date || credit.release_date,
              first_air_date: dbContent?.first_air_date || credit.first_air_date
            }
          } catch (error) {
            console.error(`Error loading providers for ${credit.title || credit.name}:`, error)
            return {
              ...credit,
              title: credit.title || credit.name,
              content_type: activeTab === 'movies' ? 'movie' : 'tv_show',
              providers: [],
              vote_average: credit.vote_average || 0,
              vote_count: credit.vote_count || 0,
              popularity: credit.popularity || 0,
              overview: credit.overview || ''
            }
          }
        })
      )
      
      setContentWithProviders(contentWithProviderData)
      console.log(`✅ Loaded ${contentWithProviderData.length} content items for ${activeTab}`)
    } catch (error) {
      console.error('Error loading content with providers:', error)
      setContentWithProviders([])
    } finally {
      setLoadingProviders(false)
    }
  }

  const updateMetaData = () => {
    if (!person) return
    
    // Update page title
    const personName = person.name || 'Person'
    const knownFor = getKnownFor()
    
    document.title = `${personName} - ${knownFor} | TVSHOWup`
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      let description = ''
      
      if (person.biography) {
        // Truncate biography to 155 characters for optimal SEO
        description = person.biography.length > 155 
          ? person.biography.substring(0, 152) + '...'
          : person.biography
      } else {
        // Fallback description
        const birthYear = person.birthday ? new Date(person.birthday).getFullYear() : ''
        const birthInfo = birthYear ? ` (${languageCode === 'tr' ? 'd.' : 'b.'} ${birthYear})` : ''
        
        const filmographyText = languageCode === 'tr' ? 'filmografi, biyografi ve detaylı bilgiler' :
                                languageCode === 'ar' ? 'الأفلام، السيرة الذاتية والمعلومات التفصيلية' :
                                'filmography, biography and detailed information'
        description = `${personName}${birthInfo} - ${knownFor}, ${filmographyText} - TVSHOWup`
      }
      
      metaDescription.setAttribute('content', description)
    }
    
    // Update Open Graph meta tags for social sharing
    updateOpenGraphTags()
  }
  
  const updateOpenGraphTags = () => {
    if (!person) return
    
    const personName = person.name || 'Person'
    const knownFor = getKnownFor()
    
    // Update or create Open Graph title
    let ogTitle = document.querySelector('meta[property="og:title"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    ogTitle.setAttribute('content', `${personName} - ${knownFor}`)
    
    // Update or create Open Graph description
    let ogDescription = document.querySelector('meta[property="og:description"]')
    if (!ogDescription) {
      ogDescription = document.createElement('meta')
      ogDescription.setAttribute('property', 'og:description')
      document.head.appendChild(ogDescription)
    }
    const description = person.biography || `${personName} - ${knownFor} information on TVSHOWup`
    ogDescription.setAttribute('content', description.length > 155 ? description.substring(0, 152) + '...' : description)
    
    // Update or create Open Graph image
    let ogImage = document.querySelector('meta[property="og:image"]')
    if (!ogImage) {
      ogImage = document.createElement('meta')
      ogImage.setAttribute('property', 'og:image')
      document.head.appendChild(ogImage)
    }
    const imageUrl = person.profile_path 
      ? tmdbService.getProfileUrl(person.profile_path, 'h632')
      : `${window.location.origin}/tvshowup_logo-01.png`
    ogImage.setAttribute('content', imageUrl)
    
    // Update or create Open Graph type
    let ogType = document.querySelector('meta[property="og:type"]')
    if (!ogType) {
      ogType = document.createElement('meta')
      ogType.setAttribute('property', 'og:type')
      document.head.appendChild(ogType)
    }
    ogType.setAttribute('content', 'profile')
    
    // Update or create Open Graph URL
    let ogUrl = document.querySelector('meta[property="og:url"]')
    if (!ogUrl) {
      ogUrl = document.createElement('meta')
      ogUrl.setAttribute('property', 'og:url')
      document.head.appendChild(ogUrl)
    }
    ogUrl.setAttribute('content', window.location.href)
  }
  
  const resetMetaData = () => {
    // Reset to default title and description when leaving the page
    document.title = 'TVSHOWup - Find Your Next Show'
    
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', 'The World\'s Most Practical and Enjoyable Watchlist is on TVSHOWup. And it\'s free! Discover TV shows and movies on all streaming platforms. Create lists, update your viewing status, and share them with friends.')
    }
  }

  const getAge = () => {
    if (!person?.birthday) return null
    const birthDate = new Date(person.birthday)
    const today = person.deathday ? new Date(person.deathday) : new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1
    }
    return age
  }

  const getGender = () => {
    if (!person) return t.notSpecified
    switch (person.gender) {
      case 1: return t.female
      case 2: return t.male
      case 3: return t.nonBinary
      default: return t.notSpecified
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString(languageCode === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getKnownFor = () => {
    if (!person?.known_for_department) return t.acting
    switch (person.known_for_department) {
      case 'Acting': return t.acting
      case 'Directing': return t.directing
      case 'Writing': return t.writing
      case 'Production': return t.production
      case 'Sound': return t.sound
      case 'Camera': return t.camera
      case 'Editing': return t.editing
      case 'Art': return t.artDirection
      case 'Costume & Make-Up': return t.costumeAndMakeup
      case 'Visual Effects': return t.visualEffects
      default: return person.known_for_department
    }
  }

  const getTopCredits = (type: 'movies' | 'tv') => {
    if (!person) return []
    
    // Use combined_credits for comprehensive data, including both cast and crew
    const castCredits = person.combined_credits?.cast || []
    const crewCredits = person.combined_credits?.crew || []
    const allCredits = [...castCredits, ...crewCredits]
    
    // Filter by media type and remove duplicates
    const mediaType = type === 'movies' ? 'movie' : 'tv'
    const filteredCredits = allCredits.filter(credit => credit.media_type === mediaType)
    
    // Remove duplicates based on content ID and media type using a more robust key
    const uniqueCredits = new Map()
    filteredCredits.forEach(credit => {
      const key = `${credit.id}-${credit.media_type}`
      // Keep the credit with higher popularity or vote_average if popularity is same
      if (!uniqueCredits.has(key) || 
          credit.popularity > (uniqueCredits.get(key).popularity || 0) ||
          (credit.popularity === (uniqueCredits.get(key).popularity || 0) && 
           credit.vote_average > (uniqueCredits.get(key).vote_average || 0))) {
        uniqueCredits.set(key, credit)
      }
    })
    
    const credits = Array.from(uniqueCredits.values())
    
    return credits
      .filter(credit => 
        credit.poster_path && 
        credit.vote_average > 0 && 
        (credit.title || credit.name) // Ensure we have a title
      )
      .sort((a, b) => b.popularity - a.popularity)
  }

  const handleShowMore = () => {
    if (activeTab === 'movies') {
      setShowAllMovies(true)
    } else {
      setShowAllTVShows(true)
    }
  }

  const handleShowLess = () => {
    if (activeTab === 'movies') {
      setShowAllMovies(false)
    } else {
      setShowAllTVShows(false)
    }
  }

  // Reset show more state when switching tabs
  useEffect(() => {
    setShowAllMovies(false)
    setShowAllTVShows(false)
  }, [activeTab])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 animate-pulse">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
              <div className="h-6 bg-gray-800 rounded w-3/4"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 bg-gray-800 rounded w-1/2"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-800 rounded"></div>
                <div className="h-4 bg-gray-800 rounded"></div>
                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {t.personNotFound}
          </h1>
          <p className="text-gray-400 mb-8">
            {error || t.personNotFoundMessage}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            {t.goBack}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          {t.back}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <div className="space-y-6">
            {/* Profile Image */}
            <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden">
              {person.profile_path ? (
                <img
                  src={tmdbService.getProfileUrl(person.profile_path, 'h632')}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-profile.jpg'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-gray-500 text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-3xl font-bold">{person.name.charAt(0)}</span>
                    </div>
                    <p>{t.noPhoto}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Personal Info */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {t.personalInfo}
              </h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400 text-sm">
                    {t.knownFor}:
                  </span>
                  <p className="text-white">{getKnownFor()}</p>
                </div>

                <div>
                  <span className="text-gray-400 text-sm">
                    {t.gender}:
                  </span>
                  <p className="text-white">{getGender()}</p>
                </div>

                {person.birthday && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      {t.birthday}:
                    </span>
                    <div className="flex items-center text-white">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDate(person.birthday)}</span>
                      {getAge() && (
                        <span className="text-gray-400 ml-2">
                          ({getAge()} {t.yearsOld})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {person.deathday && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      {t.deathday}:
                    </span>
                    <div className="flex items-center text-white">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDate(person.deathday)}</span>
                    </div>
                  </div>
                )}

                {person.place_of_birth && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      {t.placeOfBirth}:
                    </span>
                    <div className="flex items-center text-white">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>{person.place_of_birth}</span>
                    </div>
                  </div>
                )}

                {person.also_known_as && person.also_known_as.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      {t.alsoKnownAs}:
                    </span>
                    <div className="text-white">
                      {person.also_known_as.slice(0, 3).map((name, index) => (
                        <p key={index} className="text-sm">{name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* External Links */}
              {person.imdb_id && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <a
                    href={`https://www.imdb.com/name/${person.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    IMDb
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Biography and Credits */}
          <div className="lg:col-span-2 space-y-8">
            {/* Name and Biography */}
            <div>
              <h1 className="text-4xl font-bold text-white mb-6">{person.name}</h1>
              
              {person.biography && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">
                    {t.biography}
                  </h2>
                  <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                    {person.biography || t.noBiographyAvailable}
                  </div>
                </div>
              )}
            </div>

            {/* Credits */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                {t.knownForProductions}
              </h2>

              {/* Tab Navigation */}
              <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('movies')}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'movies'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Film className="w-4 h-4 mr-2" />
                  {t.movies}
                  {getTopCredits('movies').length > 0 && (
                    <span className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded-full">
                      {getTopCredits('movies').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('tv')}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'tv'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Tv className="w-4 h-4 mr-2" />
                  {t.tvShows}
                  {getTopCredits('tv').length > 0 && (
                    <span className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded-full">
                      {getTopCredits('tv').length}
                    </span>
                  )}
                </button>
              </div>

              {/* Credits Grid */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {contentWithProviders.map((content) => (
                    <ContentCard
                      key={`${content.content_type}-${content.id}`}
                      content={content}
                      onWatchlistStatusChange={handleWatchlistStatusChange}
                      watchlistStatus={userWatchlistMap.get(content.id) as any || 'none'}
                      onAuthRequired={() => openAuthPrompt('watchlist')}
                      variant="compact"
                      hideActions={false}
                    />
                  ))}
                </div>

                {/* Show More/Less Button */}
                {(() => {
                  const allCredits = getTopCredits(activeTab)
                  const isShowingAll = activeTab === 'movies' ? showAllMovies : showAllTVShows
                  const currentlyDisplayed = contentWithProviders.length
                  
                  console.log(`Debug: ${activeTab} - Total credits: ${allCredits.length}, Currently displayed: ${currentlyDisplayed}, Showing all: ${isShowingAll}`)
                  
                  if (allCredits.length > INITIAL_DISPLAY_COUNT && !isShowingAll) {
                    return (
                      <div className="text-center mt-6">
                        <button
                          onClick={handleShowMore}
                          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
                        >
                          {t.showMore} ({allCredits.length - INITIAL_DISPLAY_COUNT} {languageCode === 'tr' ? 'daha' : languageCode === 'ar' ? 'المزيد' : 'more'})
                        </button>
                      </div>
                    )
                  } else if (allCredits.length > INITIAL_DISPLAY_COUNT && isShowingAll) {
                    return (
                      <div className="text-center mt-6">
                        <button
                          onClick={handleShowLess}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
                        >
                          {t.showLess}
                        </button>
                      </div>
                    )
                  }
                  return null
                })()}

                {loadingProviders && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div key={index} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                        <div className="aspect-[2/3] bg-gray-700" />
                        <div className="p-4 space-y-2">
                          <div className="h-4 bg-gray-700 rounded w-3/4" />
                          <div className="h-3 bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingProviders && contentWithProviders.length === 0 && getTopCredits(activeTab).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>
                      {languageCode === 'tr' ? 'Bu kategoride yapım bulunamadı.' :
                       languageCode === 'ar' ? 'لم يتم العثور على أعمال في هذه الفئة.' :
                       'No credits found in this category.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PersonDetailPage
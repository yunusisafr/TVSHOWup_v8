import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Star, Calendar, Clock, Play, Plus, Info, Share2, Heart, MessageCircle, ChevronLeft, Eye, Check, X, User } from 'lucide-react'
import { FolderPlus } from 'lucide-react'
import { ContentItem, databaseService } from '../lib/database'
import { tmdbService } from '../lib/tmdb'
import { contentUpdateService } from '../lib/contentUpdateService'
import { extractIdFromSlug, createFullSlug, createSEOSlug, buildLanguagePath, createPersonSlug } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useTranslation } from '../lib/i18n'
import { rateLimitService } from '../lib/rateLimitService'
import { StructuredDataGenerator } from '../lib/structuredData'
import { getUITranslation } from '../config/uiTranslations'
import RatingModal from '../components/RatingModal'
import ShareListSelectModal from '../components/ShareListSelectModal'

interface ContentDetailPageProps {
  contentType: 'movie' | 'tv_show'
}

const ContentDetailPage: React.FC<ContentDetailPageProps> = ({ contentType }) => {
  const { id: urlId, slug: urlSlug } = useParams<{ id: string; slug?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { countryCode, languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { openAuthPrompt } = useAuthPrompt()

  // Extract actual ID from URL parameter
  // URL can be: /movie/123 or /movie/123-slug or /movie/123/slug
  const actualId = urlId ? (extractIdFromSlug(urlId) || urlId) : null
  
  const [content, setContent] = useState<ContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [allProviders, setAllProviders] = useState<any[]>([])
  const [cast, setCast] = useState<any[]>([])
  const [crew, setCrew] = useState<any[]>([])
  const [currentStatus, setCurrentStatus] = useState<'none' | 'want_to_watch' | 'watching' | 'watched' | 'dropped'>('none')
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [userRating, setUserRating] = useState<number>(0)
  const [showShareListModal, setShowShareListModal] = useState(false)
  const [showWatchlistOptions, setShowWatchlistOptions] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [showAllProviders, setShowAllProviders] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Refs for dropdown positioning
  const watchlistButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (actualId) {
      loadContent()
    }
  }, [actualId, contentType, languageCode])

  // Update meta data when content loads
  useEffect(() => {
    if (content) {
      updateMetaData()
      updateStructuredData()
    }

    // Cleanup function to reset meta data when component unmounts
    return () => {
      resetMetaData()
      StructuredDataGenerator.removeStructuredData()
    }
  }, [content, languageCode])

  useEffect(() => {
    if (user && content) {
      loadUserWatchlistStatus()
      loadUserRating()
    }
  }, [user, content])

  useEffect(() => {
    if (content && user) {
      rateLimitService.trackPageView(user.id);
    }
  }, [content, user])

  // Load providers from database when content loads or country changes
  useEffect(() => {
    if (content && countryCode) {
      console.log(`🔄 Country code changed to ${countryCode}, reloading providers...`)
      loadContentProviders()
    }
  }, [content, countryCode])

  // Update displayed content when language changes (no reload needed)
  useEffect(() => {
    if (content && languageCode) {
      console.log(`🌐 Language changed to ${languageCode}, updating translations...`)

      // Get translated title and overview
      let displayTitle = content.title || content.name;
      let displayOverview = content.overview || '';
      let displayTagline = content.tagline || '';

      const titleTranslations = content.name_translations || content.title_translations;
      const overviewTranslations = content.overview_translations;
      const taglineTranslations = content.tagline_translations;

      if (titleTranslations) {
        const parsed = typeof titleTranslations === 'string' ? JSON.parse(titleTranslations) : titleTranslations;
        displayTitle = parsed[languageCode] || displayTitle;
      }

      if (overviewTranslations) {
        const parsed = typeof overviewTranslations === 'string' ? JSON.parse(overviewTranslations) : overviewTranslations;
        displayOverview = parsed[languageCode] || displayOverview;
      }

      if (taglineTranslations) {
        const parsed = typeof taglineTranslations === 'string' ? JSON.parse(taglineTranslations) : taglineTranslations;
        displayTagline = parsed[languageCode] || displayTagline;
      }

      // Update content with new translations
      setContent({
        ...content,
        title: displayTitle,
        overview: displayOverview,
        tagline: displayTagline
      })
    }
  }, [languageCode])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showWatchlistOptions && 
          dropdownRef.current && 
          !dropdownRef.current.contains(event.target as Node) &&
          watchlistButtonRef.current && 
          !watchlistButtonRef.current.contains(event.target as Node)) {
        setShowWatchlistOptions(false)
      }
    }

    if (showWatchlistOptions) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showWatchlistOptions])

  // Calculate dropdown position
  useEffect(() => {
    const calculatePosition = () => {
      if (showWatchlistOptions && watchlistButtonRef.current && dropdownRef.current) {
        const buttonRect = watchlistButtonRef.current.getBoundingClientRect();
        const dropdownElement = dropdownRef.current;
        const viewportHeight = window.innerHeight;

        const dropdownHeight = dropdownElement.offsetHeight;
        const padding = 8;

        let newTop: number | 'auto' = 'auto';
        let newBottom: number | 'auto' = 'auto';

        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        if (spaceBelow >= dropdownHeight + padding || spaceBelow >= spaceAbove) {
          newTop = buttonRect.bottom + padding;
        } else {
          newBottom = viewportHeight - buttonRect.top + padding;
        }

        let newLeft = buttonRect.left;
        const dropdownWidth = dropdownElement.offsetWidth;

        if (newLeft + dropdownWidth > window.innerWidth) {
          newLeft = window.innerWidth - dropdownWidth - padding;
        }
        if (newLeft < 0) {
          newLeft = padding;
        }

        setDropdownStyle({
          top: newTop,
          bottom: newBottom,
          left: newLeft,
        });
      } else {
        setDropdownStyle({});
      }
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
    };
  }, [showWatchlistOptions]);

  const loadContent = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validate actualId
      if (!actualId) {
        console.error('❌ No content ID provided in URL')
        setError('Invalid content URL')
        setLoading(false)
        return
      }

      const contentId = parseInt(actualId, 10)
      if (isNaN(contentId)) {
        console.error(`❌ Invalid content ID: ${actualId}`)
        setError('Invalid content ID')
        setLoading(false)
        return
      }

      console.log(`🔍 Loading content details for ${contentType} ${contentId}`)

      // Get content from database (ALL data including translations)
      let dbContent = await databaseService.getContentById(contentId, contentType)

      // If content not found in database, fetch from TMDB API directly for fast loading
      if (!dbContent) {
        console.log(`⚠️ Content ${contentId} not found in database, fetching from TMDB API...`)

        try {
          // Fetch directly from TMDB API with user's language
          const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'

          // Always fetch in user's language first
          const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=${languageCode}&append_to_response=credits,keywords,watch/providers`

          const tmdbResponse = await fetch(tmdbUrl)

          if (!tmdbResponse.ok) {
            throw new Error(`TMDB API error: ${tmdbResponse.status}`)
          }

          let tmdbData = await tmdbResponse.json()

          // If overview is empty in user's language, fallback to English
          if (!tmdbData.overview || tmdbData.overview.trim() === '') {
            console.log(`⚠️ No overview in ${languageCode}, fetching English fallback...`)
            const tmdbUrlEn = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=en`
            const tmdbResponseEn = await fetch(tmdbUrlEn)
            if (tmdbResponseEn.ok) {
              const tmdbDataEn = await tmdbResponseEn.json()
              // Use English data only if user's language is empty
              tmdbData.overview = tmdbDataEn.overview || tmdbData.overview
              tmdbData.tagline = tmdbData.tagline || tmdbDataEn.tagline
            }
          }

          // Convert TMDB data to our format immediately for display
          // Genres are already in user's language from TMDB API
          dbContent = {
            id: tmdbData.id,
            title: tmdbData.title || tmdbData.name,
            name: tmdbData.name || tmdbData.title,
            original_title: tmdbData.original_title || tmdbData.original_name,
            original_name: tmdbData.original_name || tmdbData.original_title,
            overview: tmdbData.overview,
            poster_path: tmdbData.poster_path,
            backdrop_path: tmdbData.backdrop_path,
            vote_average: tmdbData.vote_average,
            vote_count: tmdbData.vote_count,
            popularity: tmdbData.popularity,
            release_date: tmdbData.release_date || tmdbData.first_air_date,
            first_air_date: tmdbData.first_air_date,
            runtime: tmdbData.runtime || tmdbData.episode_run_time?.[0],
            status: tmdbData.status,
            tagline: tmdbData.tagline,
            genres: tmdbData.genres, // Genres come in user's language from TMDB
            cast_data: tmdbData.credits?.cast,
            crew_data: tmdbData.credits?.crew,
            adult: tmdbData.adult,
            original_language: tmdbData.original_language,
            content_type: contentType,
            slug: createSEOSlug(tmdbData.id, tmdbData.title || tmdbData.name, tmdbData.original_title || tmdbData.original_name)
          }

          console.log(`✅ Genres loaded in ${languageCode}:`, tmdbData.genres?.map((g: any) => g.name).join(', '))

          console.log(`✅ Content loaded from TMDB API for immediate display in ${languageCode}`)

          // Extract and set cast and crew from TMDB
          if (tmdbData.credits?.cast) {
            const castList = tmdbData.credits.cast.slice(0, 10)
            console.log(`🎭 Setting ${castList.length} cast members:`, castList.map(c => c.name))
            setCast(castList)
          } else {
            console.warn('⚠️ No cast data in TMDB response')
          }
          if (tmdbData.credits?.crew) {
            const crewList = tmdbData.credits.crew.slice(0, 5)
            console.log(`🎬 Setting ${crewList.length} crew members:`, crewList.map(c => c.name))
            setCrew(crewList)
          } else {
            console.warn('⚠️ No crew data in TMDB response')
          }

          // Extract watch providers from TMDB response (if available)
          const tmdbProviders = []

          if (tmdbData['watch/providers']?.results?.[countryCode]) {
            const countryProviders = tmdbData['watch/providers'].results[countryCode]

            // Collect all provider types (flatrate, rent, buy)
            if (countryProviders.flatrate) {
              countryProviders.flatrate.forEach((p: any) => {
                tmdbProviders.push({
                  id: p.provider_id,
                  provider_id: p.provider_id,
                  name: p.provider_name,
                  provider_name: p.provider_name,
                  logo_path: p.logo_path,
                  provider_logo: p.logo_path,
                  provider_type: 'subscription',
                  monetization_type: 'flatrate',
                  display_priority: p.display_priority || 0,
                  is_active: true
                })
              })
            }

            if (countryProviders.rent) {
              countryProviders.rent.forEach((p: any) => {
                tmdbProviders.push({
                  id: p.provider_id,
                  provider_id: p.provider_id,
                  name: p.provider_name,
                  provider_name: p.provider_name,
                  logo_path: p.logo_path,
                  provider_logo: p.logo_path,
                  provider_type: 'rent',
                  monetization_type: 'rent',
                  display_priority: p.display_priority || 100,
                  is_active: true
                })
              })
            }

            if (countryProviders.buy) {
              countryProviders.buy.forEach((p: any) => {
                tmdbProviders.push({
                  id: p.provider_id,
                  provider_id: p.provider_id,
                  name: p.provider_name,
                  provider_name: p.provider_name,
                  logo_path: p.logo_path,
                  provider_logo: p.logo_path,
                  provider_type: 'buy',
                  monetization_type: 'buy',
                  display_priority: p.display_priority || 200,
                  is_active: true
                })
              })
            }
          }

          // Always set providers state (even if empty) to trigger UI update
          setProviders(tmdbProviders)
          setAllProviders(tmdbProviders)
          console.log(`✅ Loaded ${tmdbProviders.length} providers from TMDB for ${countryCode}`)

          // Save to database in background (non-blocking) with all language translations
          saveContentToDatabase(contentId, contentType).catch(err => {
            console.error('Background save error:', err)
          })

        } catch (error) {
          console.error(`❌ Error fetching content from TMDB:`, error)
          setError('Content not found')
          setLoading(false)
          return
        }
      }

      // Check URL slug and fix if needed (but continue loading content)
      // We accept any of these formats:
      // - /movie/123 (just ID)
      // - /movie/123-any-slug (ID with slug)
      // As long as the ID matches, we show the content
      const dbSlug = dbContent.slug;
      let shouldFixUrl = false;

      if (dbSlug && dbSlug.trim() !== '') {
        const currentPath = window.location.pathname;
        const pathSegments = currentPath.split('/').filter(Boolean);
        const currentSlugOrId = pathSegments[pathSegments.length - 1] || '';

        // Extract ID from current URL segment (might be "123" or "123-some-slug")
        const currentId = extractIdFromSlug(currentSlugOrId) || currentSlugOrId;

        // If URL has slug but it's wrong, we'll fix it AFTER loading content
        // BUT: Only if user provided a slug (not just ID)
        if (currentSlugOrId.includes('-') && currentSlugOrId !== dbSlug) {
          shouldFixUrl = true;
          console.log(`🔄 Will fix URL slug from "${currentSlugOrId}" to "${dbSlug}" after loading content`);
        }
      }

      // Get translated title and overview from DB
      let displayTitle = dbContent.title || dbContent.name;
      let displayOverview = dbContent.overview || '';
      let displayTagline = dbContent.tagline || '';

      // Apply translations if available
      const titleTranslations = dbContent.name_translations || dbContent.title_translations;
      const overviewTranslations = dbContent.overview_translations;
      const taglineTranslations = dbContent.tagline_translations;

      console.log(`🌍 Language: ${languageCode}, Overview translations:`, overviewTranslations ? 'exists' : 'missing')

      if (titleTranslations) {
        try {
          const parsed = typeof titleTranslations === 'string' ? JSON.parse(titleTranslations) : titleTranslations;
          if (parsed[languageCode]) {
            displayTitle = parsed[languageCode];
            console.log(`✅ Title translation found for ${languageCode}`)
          } else {
            console.log(`⚠️ No title translation for ${languageCode}, using original`)
          }
        } catch (e) {
          console.warn('Failed to parse title translations:', e)
        }
      }

      if (overviewTranslations) {
        try {
          const parsed = typeof overviewTranslations === 'string' ? JSON.parse(overviewTranslations) : overviewTranslations;
          if (parsed[languageCode] && parsed[languageCode].trim() !== '') {
            displayOverview = parsed[languageCode];
            console.log(`✅ Overview translation found for ${languageCode}`)
          } else {
            console.log(`⚠️ No overview translation for ${languageCode}, fetching from TMDB...`)
            // Fetch from TMDB in user's language
            try {
              const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
              const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=${languageCode}`
              const tmdbResponse = await fetch(tmdbUrl)
              if (tmdbResponse.ok) {
                const tmdbData = await tmdbResponse.json()
                if (tmdbData.overview && tmdbData.overview.trim() !== '') {
                  displayOverview = tmdbData.overview
                  console.log(`✅ Fetched overview from TMDB in ${languageCode}`)
                }
              }
            } catch (err) {
              console.error('Failed to fetch overview from TMDB:', err)
            }
          }
        } catch (e) {
          console.warn('Failed to parse overview translations:', e)
        }
      } else {
        // No translations in DB, fetch from TMDB
        console.log(`⚠️ No overview_translations in DB, fetching from TMDB in ${languageCode}...`)
        try {
          const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
          const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=${languageCode}`
          const tmdbResponse = await fetch(tmdbUrl)
          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json()
            if (tmdbData.overview && tmdbData.overview.trim() !== '') {
              displayOverview = tmdbData.overview
              console.log(`✅ Fetched overview from TMDB in ${languageCode}`)
            }
          }
        } catch (err) {
          console.error('Failed to fetch overview from TMDB:', err)
        }
      }

      if (taglineTranslations) {
        try {
          const parsed = typeof taglineTranslations === 'string' ? JSON.parse(taglineTranslations) : taglineTranslations;
          displayTagline = parsed[languageCode] || displayTagline;
        } catch (e) {
          console.warn('Failed to parse tagline translations:', e)
        }
      }

      // Parse cast and crew from DB (if available)
      let castData = [];
      let crewData = [];
      let hasCastData = false;
      let hasCrewData = false;

      if (dbContent.cast_data) {
        try {
          castData = typeof dbContent.cast_data === 'string' ? JSON.parse(dbContent.cast_data) : dbContent.cast_data;
          if (castData && castData.length > 0) {
            const castList = castData.slice(0, 10)
            console.log(`🎭 Setting ${castList.length} cast members from DB:`, castList.map(c => c.name))
            setCast(castList);
            hasCastData = true;
          }
        } catch (e) {
          console.warn('❌ Failed to parse cast_data:', e);
        }
      }

      if (!hasCastData) {
        console.log('ℹ️ No cast_data in DB, will fetch from TMDB')
      }

      if (dbContent.crew_data) {
        try {
          crewData = typeof dbContent.crew_data === 'string' ? JSON.parse(dbContent.crew_data) : dbContent.crew_data;
          if (crewData && crewData.length > 0) {
            const crewList = crewData.slice(0, 5)
            console.log(`🎬 Setting ${crewList.length} crew members from DB:`, crewList.map(c => c.name))
            setCrew(crewList);
            hasCrewData = true;
          }
        } catch (e) {
          console.warn('❌ Failed to parse crew_data:', e);
        }
      }

      if (!hasCrewData) {
        console.log('ℹ️ No crew_data in DB, will fetch from TMDB')
      }

      // If cast or crew data missing from DB, fetch from TMDB
      if (!hasCastData || !hasCrewData) {
        console.log(`🔄 Fetching missing cast/crew data from TMDB for content ${contentId}`)
        try {
          const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
          const tmdbCreditsUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}/credits?api_key=${import.meta.env.VITE_TMDB_API_KEY}`
          const tmdbCreditsResponse = await fetch(tmdbCreditsUrl)

          if (tmdbCreditsResponse.ok) {
            const tmdbCreditsData = await tmdbCreditsResponse.json()

            if (!hasCastData && tmdbCreditsData.cast) {
              const castList = tmdbCreditsData.cast.slice(0, 10)
              console.log(`🎭 Setting ${castList.length} cast members from TMDB:`, castList.map(c => c.name))
              setCast(castList)
            }

            if (!hasCrewData && tmdbCreditsData.crew) {
              const crewList = tmdbCreditsData.crew.slice(0, 5)
              console.log(`🎬 Setting ${crewList.length} crew members from TMDB:`, crewList.map(c => c.name))
              setCrew(crewList)
            }
          }
        } catch (tmdbError) {
          console.error('❌ Error fetching credits from TMDB:', tmdbError)
        }
      }

      // Fetch genres in user's language from TMDB if not in DB or if different language
      let genresInUserLanguage = dbContent.genres
      if (languageCode !== 'en') {
        console.log(`🔄 Fetching genres in ${languageCode} from TMDB...`)
        try {
          const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
          const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${contentId}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=${languageCode}`
          const tmdbResponse = await fetch(tmdbUrl)
          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json()
            if (tmdbData.genres && tmdbData.genres.length > 0) {
              genresInUserLanguage = tmdbData.genres
              console.log(`✅ Genres in ${languageCode}:`, tmdbData.genres.map((g: any) => g.name).join(', '))
            }
          }
        } catch (err) {
          console.error('Failed to fetch genres from TMDB:', err)
        }
      }

      // Set final content with translations
      const finalContent = {
        ...dbContent,
        title: displayTitle,
        overview: displayOverview,
        tagline: displayTagline,
        genres: genresInUserLanguage, // Use genres in user's language
        content_type: contentType
      }

      setContent(finalContent)
      console.log(`✅ Content loaded from DB with ${languageCode} translations`)

      // Fix URL if needed (AFTER content is loaded and displayed)
      if (shouldFixUrl && dbSlug) {
        const expectedPath = buildLanguagePath(`/${contentType}/${dbSlug}`, languageCode);
        console.log(`🔄 Fixing URL to: ${expectedPath}`);
        // Use replace to avoid adding to browser history
        window.history.replaceState({}, '', expectedPath);
      }
    } catch (error) {
      console.error('Error loading content:', error)
      setError('Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const loadContentProviders = async () => {
    if (!content) return

    try {
      console.log(`🔍 Loading providers for ${content.content_type} ${content.id} in country ${countryCode}`)

      const updateCheck = await contentUpdateService.checkIfUpdateNeeded(
        content.id,
        content.content_type,
        content
      )

      const { data: providerData, error } = await databaseService.supabase
        .from('content_providers')
        .select(`
          *,
          providers (
            id,
            name,
            logo_path,
            provider_type,
            is_active,
            display_priority
          )
        `)
        .eq('content_id', content.id)
        .eq('content_type', content.content_type)
        .eq('country_code', countryCode)
        .not('providers.name', 'is', null)

      if (error) {
        console.error('Error loading content providers:', error)
        setProviders([])
        return
      }

      if (!providerData || providerData.length === 0 || updateCheck.shouldUpdateProviders) {
        if (updateCheck.shouldUpdateProviders) {
          console.log(`🔄 Provider data is stale (>6h), updating from TMDB...`)
        } else {
          console.log(`⚠️ No providers in DB, fetching from TMDB...`)
        }

        try {
          const tmdbType = content.content_type === 'tv_show' ? 'tv' : 'movie'
          const tmdbProvidersUrl = `https://api.themoviedb.org/3/${tmdbType}/${content.id}/watch/providers?api_key=${import.meta.env.VITE_TMDB_API_KEY}`
          const tmdbProvidersResponse = await fetch(tmdbProvidersUrl)

          if (tmdbProvidersResponse.ok) {
            const tmdbProvidersData = await tmdbProvidersResponse.json()
            const tmdbProviders: any[] = []

            if (tmdbProvidersData.results?.[countryCode]) {
              const countryProviders = tmdbProvidersData.results[countryCode]

              if (countryProviders.flatrate) {
                countryProviders.flatrate.forEach((p: any) => {
                  tmdbProviders.push({
                    id: p.provider_id,
                    provider_id: p.provider_id,
                    name: p.provider_name,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path,
                    provider_logo: p.logo_path,
                    provider_type: 'subscription',
                    monetization_type: 'flatrate',
                    display_priority: p.display_priority || 0,
                    is_active: true
                  })
                })
              }

              if (countryProviders.rent) {
                countryProviders.rent.forEach((p: any) => {
                  tmdbProviders.push({
                    id: p.provider_id,
                    provider_id: p.provider_id,
                    name: p.provider_name,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path,
                    provider_logo: p.logo_path,
                    provider_type: 'rent',
                    monetization_type: 'rent',
                    display_priority: p.display_priority || 100,
                    is_active: true
                  })
                })
              }

              if (countryProviders.buy) {
                countryProviders.buy.forEach((p: any) => {
                  tmdbProviders.push({
                    id: p.provider_id,
                    provider_id: p.provider_id,
                    name: p.provider_name,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path,
                    provider_logo: p.logo_path,
                    provider_type: 'buy',
                    monetization_type: 'buy',
                    display_priority: p.display_priority || 200,
                    is_active: true
                  })
                })
              }
            }

            // Always set providers state (even if empty) to trigger UI update
            setProviders(tmdbProviders)
            setAllProviders(tmdbProviders)
            console.log(`✅ Loaded ${tmdbProviders.length} providers from TMDB for ${countryCode}`)

            contentUpdateService.updateProviderData(
              content.id,
              content.content_type,
              countryCode,
              tmdbProvidersData
            ).catch(err => console.error('Background provider save error:', err))

            contentUpdateService.updateProvidersAndRatings(
              content.id,
              content.content_type,
              updateCheck.shouldUpdateProviders,
              updateCheck.shouldUpdateRatings
            ).catch(err => console.error('Background timestamp update error:', err))

            return
          }
        } catch (tmdbError) {
          console.error('Error fetching providers from TMDB:', tmdbError)
        }

        setProviders([])
        setAllProviders([])
        return
      }

      const formattedProviders = providerData
        .filter(item => {
          const hasProvider = item.providers && item.providers.name && item.providers.name.trim() !== ''
          if (!hasProvider) {
            console.warn(`⚠️ Skipping provider with missing data:`, item)
          }
          return hasProvider
        })
        .map(item => ({
          id: item.providers.id,
          provider_id: item.providers.id,
          name: item.providers.name,
          provider_name: item.providers.name,
          logo_path: item.providers.logo_path,
          provider_logo: item.providers.logo_path,
          provider_type: item.providers.provider_type,
          monetization_type: item.monetization_type,
          link: item.link,
          display_priority: item.providers.display_priority || 0,
          is_active: item.providers.is_active
        }))
        .sort((a, b) => {
          if (a.display_priority !== b.display_priority) {
            return a.display_priority - b.display_priority
          }
          return a.name.localeCompare(b.name)
        })

      setProviders(formattedProviders)
      setAllProviders(formattedProviders)
      console.log(`✅ Using cached providers (${formattedProviders.length})`)

    } catch (error) {
      console.error('Error in loadContentProviders:', error)
      setProviders([])
    }
  }


  const loadUserWatchlistStatus = async () => {
    if (!user || !content) return

    try {
      const watchlist = await databaseService.getUserWatchlist(user.id)
      const item = watchlist.find(w => w.content_id === content.id && w.content_type === contentType)
      setCurrentStatus(item ? item.status : 'none')
    } catch (error) {
      console.error('Error loading watchlist status:', error)
    }
  }

  const loadUserRating = async () => {
    if (!user || !content) return

    try {
      const { data } = await databaseService.supabase
        .from('content_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('content_id', content.id)
        .eq('content_type', contentType)
        .maybeSingle()

      if (data) {
        setUserRating(data.rating)
      }
    } catch (error) {
      // No rating found, which is fine
    }
  }

  const handleWatchlistAction = () => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    setShowWatchlistOptions(!showWatchlistOptions)
  }

  const handleWatchlistStatusChange = async (status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user || !content) return

    setShowWatchlistOptions(false)
    setIsAddingToWatchlist(true)

    try {
      if (status === null) {
        await databaseService.removeFromWatchlist(user.id, content.id, contentType)
        setCurrentStatus('none')
      } else {
        await databaseService.addToWatchlist(user.id, content.id, contentType, status, {
          onConflict: 'user_id,content_id,content_type'
        })
        setCurrentStatus(status)
      }
    } catch (error) {
      console.error('Error updating watchlist:', error)
    } finally {
      setIsAddingToWatchlist(false)
    }
  }

  const handleRate = () => {
    if (!user) {
      openAuthPrompt('rate')
      return
    }
    setShowRatingModal(true)
  }

  const handleRatingSubmit = async (rating: number) => {
    if (!user || !content) return

    try {
      await databaseService.supabase
        .from('content_ratings')
        .upsert({
          user_id: user.id,
          content_id: content.id,
          content_type: contentType,
          rating
        })

      setUserRating(rating)
    } catch (error) {
      console.error('Error saving rating:', error)
    }
  }

  const handleShare = async () => {
   // Define shareUrl before using it - use language-aware path
   const originalTitle = content?.content_type === 'movie'
     ? content?.original_title || content?.title || content?.name || ''
     : content?.original_name || content?.name || content?.title || '';
   const contentSlug = content?.slug || createSEOSlug(content?.id || 0, originalTitle, originalTitle)
   const contentPath = `/${content?.content_type}/${contentSlug}`
   const shareUrl = `${window.location.origin}${buildLanguagePath(contentPath, languageCode)}`
   
    if (!content) return

    const shareData = {
      title: content.title,
      text: `${content.title} - ${content.overview?.substring(0, 100)}...`,
      url: window.location.href
    }

    try {
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href)
        // Show a temporary notification
        const originalText = 'Share'
        const button = document.querySelector('button:has(.lucide-share2)')
        if (button) {
          button.textContent = 'Link Copied!'
          setTimeout(() => {
            button.innerHTML = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>Share'
          }, 2000)
        }
      }
    } catch (error) {
      console.warn('Web Share API failed, falling back to clipboard:', error)
      
      // Fallback to clipboard copy
      try {
        await navigator.clipboard.writeText(shareUrl)
        
        // Show success feedback
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, 2000)
        
        console.log('Share URL copied to clipboard as fallback')
      } catch (clipboardError) {
        console.error('Both share and clipboard failed:', clipboardError)
        // Could show an error message to user here if needed
      }
      // Fallback to clipboard if share fails
      try {
        await navigator.clipboard.writeText(window.location.href)
        alert(languageCode === 'tr' ? 'Link panoya kopyalandı!' : 'Link copied to clipboard!')
      } catch (clipboardError) {
        console.error('Error copying to clipboard:', clipboardError)
      }
    }
  }

  const handleShareListToggle = () => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    setShowShareListModal(true)
  }

  const getWatchlistButtonConfig = () => {
    switch (currentStatus) {
      case 'want_to_watch':
        return {
          text: languageCode === 'tr' ? 'Listede' : 'In List',
          bgColor: 'bg-blue-600 hover:bg-blue-700',
          icon: <Check className="w-5 h-5" />
        }
      case 'watching':
        return {
          text: t.watching,
          bgColor: 'bg-yellow-600 hover:bg-yellow-700',
          icon: <Eye className="w-5 h-5" />
        }
      case 'watched':
        return {
          text: t.watched,
          bgColor: 'bg-green-600 hover:bg-green-700',
          icon: <Check className="w-5 h-5" />
        }
      default:
        return {
          text: t.addToWatchlist,
          bgColor: 'bg-white/10 hover:bg-primary-500',
          icon: <Plus className="w-5 h-5" />
        }
    }
  }

  const updateMetaData = () => {
    if (!content) return
    
    // Update page title
    const contentTitle = content.title || 'Content'
    const releaseYear = getReleaseYear()
    const contentTypeText = contentType === 'movie' 
      ? (languageCode === 'tr' ? 'Film' : 'Movie')
      : (languageCode === 'tr' ? 'Dizi' : 'TV Show')
    
    document.title = `${contentTitle} (${releaseYear}) - ${contentTypeText} | TVSHOWup`
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      // Always start with content info and value proposition
      let description = languageCode === 'tr'
        ? `${contentTitle} (${releaseYear}) ${contentTypeText.toLowerCase()}ini keşfedin.`
        : `Discover ${contentTitle} (${releaseYear}) ${contentTypeText.toLowerCase()} details.`
      
      // Add content overview/tagline if available
      if (content.overview) {
        // Add a brief overview (limit to keep space for value proposition)
        const maxOverviewLength = languageCode === 'tr' ? 60 : 70
        const briefOverview = content.overview.length > maxOverviewLength
          ? content.overview.substring(0, maxOverviewLength).trim() + '...'
          : content.overview
        description += ` ${briefOverview}`
      } else if (content.tagline) {
        // Add tagline if no overview
        const maxTaglineLength = languageCode === 'tr' ? 60 : 70
        const briefTagline = content.tagline.length > maxTaglineLength
          ? content.tagline.substring(0, maxTaglineLength).trim() + '...'
          : content.tagline
        description += ` ${briefTagline}`
      }
      
      // Always add value proposition at the end
      const valueProp = languageCode === 'tr'
        ? ' İzleme listenize ekleyin ve hangi platformda yayında olduğunu görün - TVSHOWup'
        : ' Add to your watchlist & find out where to stream it on TVSHOWup.'
      
      description += valueProp
      
      // Ensure total length doesn't exceed 155 characters for optimal SEO
      if (description.length > 155) {
        // If too long, truncate the content part but keep the value proposition
        const valuePropLength = valueProp.length
        const maxContentLength = 155 - valuePropLength - 3 // -3 for "..."
        
        const baseDescription = languageCode === 'tr'
          ? `${contentTitle} (${releaseYear}) ${contentTypeText.toLowerCase()}ini keşfedin.`
          : `Discover ${contentTitle} (${releaseYear}) ${contentTypeText.toLowerCase()} details.`
        
        if (content.overview) {
          const availableSpace = maxContentLength - baseDescription.length - 1 // -1 for space
          if (availableSpace > 10) {
            const truncatedOverview = content.overview.substring(0, availableSpace).trim() + '...'
            description = `${baseDescription} ${truncatedOverview}${valueProp}`
          } else {
            description = `${baseDescription}${valueProp}`
          }
        } else {
          description = `${baseDescription}${valueProp}`
        }
      }
      
      metaDescription.setAttribute('content', description)
    }
    
    // Update Open Graph meta tags for social sharing
    updateOpenGraphTags()
  }
  
  const updateStructuredData = () => {
    if (!content) return

    const schemas = []

    if (contentType === 'movie') {
      schemas.push(StructuredDataGenerator.generateMovieSchema(content, languageCode))
    } else {
      schemas.push(StructuredDataGenerator.generateTVShowSchema(content, languageCode))
    }

    const contentTypeText = contentType === 'movie'
      ? (languageCode === 'tr' ? 'Film' : 'Movie')
      : (languageCode === 'tr' ? 'Dizi' : 'TV Show')

    schemas.push(StructuredDataGenerator.generateBreadcrumbSchema([
      { name: 'TVSHOWup', url: `${window.location.origin}/${languageCode}` },
      { name: contentTypeText, url: `${window.location.origin}/${languageCode}/search` },
      { name: content.title, url: window.location.href }
    ]))

    schemas.push(StructuredDataGenerator.generateWebSiteSchema())

    StructuredDataGenerator.injectStructuredData(schemas)
  }

  const updateOpenGraphTags = () => {
    if (!content) return

    const contentTitle = content.title || 'Content'
    const releaseYear = getReleaseYear()
    const contentTypeText = contentType === 'movie'
      ? (languageCode === 'tr' ? 'Film' : 'Movie')
      : (languageCode === 'tr' ? 'Dizi' : 'TV Show')

    // Update or create Open Graph title
    let ogTitle = document.querySelector('meta[property="og:title"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    ogTitle.setAttribute('content', `${contentTitle} (${releaseYear}) - ${contentTypeText}`)

    // Update or create Open Graph description
    let ogDescription = document.querySelector('meta[property="og:description"]')
    if (!ogDescription) {
      ogDescription = document.createElement('meta')
      ogDescription.setAttribute('property', 'og:description')
      document.head.appendChild(ogDescription)
    }
    const description = content.overview || content.tagline || `${contentTitle} ${contentTypeText.toLowerCase()} details on TVSHOWup`
    ogDescription.setAttribute('content', description.length > 155 ? description.substring(0, 152) + '...' : description)

    // Update or create Open Graph image
    let ogImage = document.querySelector('meta[property="og:image"]')
    if (!ogImage) {
      ogImage = document.createElement('meta')
      ogImage.setAttribute('property', 'og:image')
      document.head.appendChild(ogImage)
    }
    const imageUrl = content.backdrop_path
      ? tmdbService.getBackdropUrl(content.backdrop_path, 'w1280')
      : content.poster_path
        ? tmdbService.getImageUrl(content.poster_path, 'w500')
        : `${window.location.origin}/tvshowup_logo-01.png`
    ogImage.setAttribute('content', imageUrl)

    // Update or create Open Graph type
    let ogType = document.querySelector('meta[property="og:type"]')
    if (!ogType) {
      ogType = document.createElement('meta')
      ogType.setAttribute('property', 'og:type')
      document.head.appendChild(ogType)
    }
    ogType.setAttribute('content', contentType === 'movie' ? 'video.movie' : 'video.tv_show')

    // Update or create Open Graph URL
    let ogUrl = document.querySelector('meta[property="og:url"]')
    if (!ogUrl) {
      ogUrl = document.createElement('meta')
      ogUrl.setAttribute('property', 'og:url')
      document.head.appendChild(ogUrl)
    }
    ogUrl.setAttribute('content', window.location.href)

    // Add Twitter Card meta tags
    let twitterCard = document.querySelector('meta[name="twitter:card"]')
    if (!twitterCard) {
      twitterCard = document.createElement('meta')
      twitterCard.setAttribute('name', 'twitter:card')
      document.head.appendChild(twitterCard)
    }
    twitterCard.setAttribute('content', 'summary_large_image')

    let twitterTitle = document.querySelector('meta[name="twitter:title"]')
    if (!twitterTitle) {
      twitterTitle = document.createElement('meta')
      twitterTitle.setAttribute('name', 'twitter:title')
      document.head.appendChild(twitterTitle)
    }
    twitterTitle.setAttribute('content', `${contentTitle} (${releaseYear}) - ${contentTypeText}`)

    let twitterDescription = document.querySelector('meta[name="twitter:description"]')
    if (!twitterDescription) {
      twitterDescription = document.createElement('meta')
      twitterDescription.setAttribute('name', 'twitter:description')
      document.head.appendChild(twitterDescription)
    }
    twitterDescription.setAttribute('content', description.length > 155 ? description.substring(0, 152) + '...' : description)

    let twitterImage = document.querySelector('meta[name="twitter:image"]')
    if (!twitterImage) {
      twitterImage = document.createElement('meta')
      twitterImage.setAttribute('name', 'twitter:image')
      document.head.appendChild(twitterImage)
    }
    twitterImage.setAttribute('content', imageUrl)
  }
  
  const resetMetaData = () => {
    // Reset to default title and description when leaving the page
    document.title = 'TVSHOWup - Find Your Next Show'
    
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', 'The World\'s Most Practical and Enjoyable Watchlist is on TVSHOWup. And it\'s free! Discover TV shows and movies on all streaming platforms. Create lists, update your viewing status, and share them with friends.')
    }
  }

  const getReleaseYear = () => {
    if (!content) return 'N/A'
    const date = content.release_date || content.first_air_date
    return date ? new Date(date).getFullYear() : 'N/A'
  }

  const getRuntime = () => {
    if (!content) return null
    if (contentType === 'movie' && content.runtime) {
      const hours = Math.floor(content.runtime / 60)
      const minutes = content.runtime % 60
      return `${hours}h ${minutes}m`
    }
    if (contentType === 'tv_show' && content.episode_run_time) {
      // Check if episode_run_time is a valid array with at least one element
      if (Array.isArray(content.episode_run_time) && content.episode_run_time.length > 0) {
        const avgRuntime = content.episode_run_time[0]
        // Make sure the runtime is a valid number
        if (typeof avgRuntime === 'number' && avgRuntime > 0) {
          return `${avgRuntime}m per episode`
        }
      }
      // Check if episode_run_time is a direct number
      else if (typeof content.episode_run_time === 'number' && content.episode_run_time > 0) {
        return `${content.episode_run_time}m per episode`
      }
      // If no valid episode runtime, don't show anything
      return null
    }
    return null
  }

  const getGenres = () => {
    if (!content?.genres) return []
    try {
      const genres = typeof content.genres === 'string'
        ? JSON.parse(content.genres)
        : content.genres

      // Check if genres have translations
      if (content.genre_translations) {
        try {
          const translations = typeof content.genre_translations === 'string'
            ? JSON.parse(content.genre_translations)
            : content.genre_translations

          // Map genres with translations
          return genres.map((genre: any) => {
            const translatedName = translations[languageCode]?.[genre.id] || translations[languageCode]?.[genre.name]
            return {
              ...genre,
              name: translatedName || genre.name
            }
          })
        } catch (e) {
          console.warn('Failed to parse genre translations:', e)
        }
      }

      return genres
    } catch (e) {
      console.warn('Failed to parse genres:', e)
      return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 animate-pulse">
        <div className="h-96 bg-gray-800"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 bg-gray-800 rounded w-3/4"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              <div className="h-32 bg-gray-800 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="h-96 bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Content Not Found</h1>
          <p className="text-gray-400 mb-8">{error || 'The requested content could not be found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const buttonConfig = getWatchlistButtonConfig()

  // Determine text direction for Arabic
  const isRTL = languageCode === 'ar'
  const directionClass = isRTL ? 'rtl' : 'ltr'

  return (
    <div className={`min-h-screen bg-gray-900 ${directionClass}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <div className="relative h-[50vh] sm:h-[500px] min-h-[400px] bg-gray-800 overflow-hidden">
        {content.backdrop_path && (
          <img
            src={tmdbService.getBackdropUrl(content.backdrop_path, 'w1280')}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Content Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent max-h-[calc(100%-100px)] overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-row gap-3 sm:gap-6">
              {/* Poster */}
              <div className="flex-shrink-0 self-start">
                <img
                  src={content.poster_path 
                    ? tmdbService.getImageUrl(content.poster_path, 'w342')
                    : '/placeholder-poster.jpg'
                  }
                  alt={content.title}
                  className="w-24 h-36 xs:w-32 xs:h-48 sm:w-48 sm:h-auto object-cover rounded-lg shadow-xl"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-poster.jpg'
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl xs:text-2xl sm:text-5xl font-bold text-white mb-2 sm:mb-4 leading-tight">
                  {content.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-1 xs:gap-2 sm:gap-4 text-white/80 mb-3 sm:mb-6 text-sm xs:text-base sm:text-base">
                  <div className="flex items-center">
                    <Star className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-yellow-400 mr-1" />
                    <span className="font-medium">{content.vote_average.toFixed(1)}</span>
                    <span className="text-xs xs:text-sm ml-1 hidden xs:inline">({content.vote_count} votes)</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-1" />
                    <span>{getReleaseYear()}</span>
                  </div>
                  {getRuntime() && (
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-1" />
                      <span>{getRuntime()}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 sm:gap-3">
                  {/* Watchlist Button with Dropdown */}
                  <div className="relative">
                    <button
                      ref={watchlistButtonRef}
                      onClick={handleWatchlistAction}
                      disabled={isAddingToWatchlist}
                      className={`flex items-center space-x-1 xs:space-x-2 text-white px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg font-semibold transition-colors text-sm xs:text-base sm:text-base ${buttonConfig.bgColor}`}
                    >
                      {isAddingToWatchlist ? (
                        <div className="animate-spin rounded-full h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <>
                          {buttonConfig.icon}
                          <span className="hidden xs:inline">{buttonConfig.text}</span>
                        </>
                      )}
                    </button>

                    {/* Watchlist Status Dropdown */}
                    {showWatchlistOptions && (
                      <div 
                        ref={dropdownRef}
                        className="fixed bg-gray-800 rounded-lg shadow-xl p-2 border border-gray-700 w-48 z-50"
                        style={dropdownStyle}
                      >
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleWatchlistStatusChange('want_to_watch')}
                            className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                              currentStatus === 'want_to_watch' 
                                ? 'bg-blue-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            <span>{t.wantToWatch}</span>
                          </button>
                          
                          <button 
                            onClick={() => handleWatchlistStatusChange('watching')}
                            className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                              currentStatus === 'watching' 
                                ? 'bg-yellow-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            <span>{t.watching}</span>
                          </button>
                          
                          <button 
                            onClick={() => handleWatchlistStatusChange('watched')}
                            className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-left text-sm transition-colors ${
                              currentStatus === 'watched' 
                                ? 'bg-green-600 text-white' 
                                : 'hover:bg-gray-700 text-white'
                            }`}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            <span>{t.watched}</span>
                          </button>
                          
                          {currentStatus !== 'none' && (
                            <>
                              <div className="border-t border-gray-700 my-1"></div> 
                              
                              <button
                                onClick={() => handleWatchlistStatusChange(null)}
                                className="flex items-center space-x-2 px-3 py-3 rounded-lg text-left text-sm hover:bg-red-600/20 text-red-300 transition-colors"
                              >
                                <X className="w-4 h-4 mr-2" /> 
                                <span>{t.delete}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleRate}
                    className="flex items-center bg-gray-800 hover:bg-gray-700 text-white px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg transition-colors text-sm xs:text-base sm:text-base"
                  >
                    <Star className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-1 xs:mr-2" />
                    <span className="hidden xs:inline">{userRating > 0 ? `${userRating}/10` : t.rate}</span>
                  </button>

                  <button
                    onClick={handleShareListToggle}
                    className="flex items-center bg-gray-800 hover:bg-gray-700 text-white px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg transition-colors text-sm xs:text-base sm:text-base"
                  >
                    <FolderPlus className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-1 xs:mr-2" />
                    <span className="hidden xs:inline">{languageCode === 'tr' ? 'Listelerime Ekle' : 'Add to Lists'}</span>
                  </button>

                  <button 
                    onClick={handleShare}
                    className="flex items-center bg-gray-800 hover:bg-gray-700 text-white px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg transition-colors text-sm xs:text-base sm:text-base"
                  >
                    <Share2 className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-1 xs:mr-2" />
                    <span className="hidden xs:inline">{languageCode === 'tr' ? 'Paylaş' : 'Share'}</span>
                  </button>
                </div>

                {/* Watch Providers - Moved from sidebar to hero section */}
                <div className="mt-4 xs:mt-6 sm:mt-8 pt-3 xs:pt-4 sm:pt-6 border-t border-white/20">
                  <div className="flex items-center mb-4">
                    <Play className="w-4 h-4 xs:w-5 xs:h-5 text-primary-400 ltr:mr-2 rtl:ml-2" />
                    <h3 className="text-white text-base xs:text-lg sm:text-xl font-medium">
                      {getUITranslation('streamingPlatforms', languageCode)}
                    </h3>
                  </div>

                  {providers.length > 0 ? (
                    <>
                    
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3">
                      {providers.slice(0, showAllProviders ? providers.length : 6).map((provider) => (
                        <div
                          key={provider.id}
                          className="flex items-center bg-black/30 rounded-lg p-2 xs:p-2.5 sm:p-3 hover:bg-black/50 transition-colors ltr:space-x-2 sm:ltr:space-x-3 rtl:space-x-reverse rtl:space-x-2 sm:rtl:space-x-3"
                        >
                          <div className="w-8 h-8 xs:w-10 xs:h-10 sm:w-10 sm:h-10 bg-white rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                            {provider.logo_path || provider.provider_logo ? (
                              <img
                                src={(() => {
                                  const logoPath = provider.logo_path || provider.provider_logo;
                                  if (!logoPath) return '/placeholder-provider.jpg';
                                  if (logoPath.startsWith('http')) return logoPath;
                                  if (logoPath.startsWith('/')) return `https://image.tmdb.org/t/p/w92${logoPath}`;
                                  return `/placeholder-provider.jpg`;
                                })()}
                                alt={provider.name}
                                className="w-6 h-6 xs:w-8 xs:h-8 sm:w-8 sm:h-8 object-contain"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('.provider-fallback')) {
                                    target.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = 'provider-fallback w-full h-full flex items-center justify-center text-gray-700 font-bold text-xs';
                                    
                                    // Special handling for known providers
                                    if (provider.name?.toLowerCase().includes('netflix')) {
                                      fallback.style.backgroundColor = '#E50914';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'N';
                                    } else if (provider.name?.toLowerCase().includes('disney')) {
                                      fallback.style.backgroundColor = '#113CCF';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'D+';
                                    } else if (provider.name?.toLowerCase().includes('amazon') || provider.name?.toLowerCase().includes('prime')) {
                                      fallback.style.backgroundColor = '#00A8E1';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'PV';
                                    } else if (provider.name?.toLowerCase().includes('max') || provider.name?.toLowerCase().includes('hbo')) {
                                      fallback.style.backgroundColor = '#7B2CBF';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'MAX';
                                    } else if (provider.name?.toLowerCase().includes('apple')) {
                                      fallback.style.backgroundColor = '#000000';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'TV+';
                                    } else if (provider.name?.toLowerCase().includes('exxen')) {
                                      fallback.style.backgroundColor = '#FF6B35';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'EX';
                                    } else if (provider.name?.toLowerCase().includes('gain')) {
                                      fallback.style.backgroundColor = '#1DB954';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'GAIN';
                                    } else if (provider.name?.toLowerCase().includes('blutv')) {
                                      fallback.style.backgroundColor = '#0066CC';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'BLU';
                                    } else if (provider.name?.toLowerCase().includes('puhutv')) {
                                      fallback.style.backgroundColor = '#FF4500';
                                      fallback.style.color = 'white';
                                      fallback.textContent = 'PUHU';
                                    } else {
                                      fallback.textContent = provider.name?.charAt(0).toUpperCase() || '?';
                                    }
                                    
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-xs">
                                {provider.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium text-sm xs:text-base truncate">{provider.name}</p>
                            <p className="text-gray-300 text-xs capitalize">
                              {provider.provider_type === 'network' ?
                                getUITranslation('tvNetwork', languageCode) :
                                provider.monetization_type === 'flatrate' ?
                                getUITranslation('streaming', languageCode) :
                                provider.monetization_type === 'buy' ?
                                getUITranslation('buy', languageCode) :
                                provider.monetization_type === 'rent' ?
                                getUITranslation('rent', languageCode) :
                                provider.monetization_type === 'ads' ?
                                getUITranslation('withAds', languageCode) :
                                provider.monetization_type || 'Unknown'
                              }
                            </p>
                          </div>
                        </div>
                      ))}
                      
                    </div>
                    
                    {/* Show More/Less Button */}
                    {providers.length > 6 && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setShowAllProviders(!showAllProviders)}
                          className="bg-black/30 hover:bg-black/50 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center mx-auto"
                        >
                          {showAllProviders ? (
                            <>
                              <span>{t.showLess}</span>
                              <svg className="w-4 h-4 ml-2 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          ) : (
                            <>
                              <span>{t.showMore} ({providers.length - 6} {languageCode === 'tr' ? 'daha' : 'more'})</span>
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                      <p className="text-gray-300 text-sm">
                        {getUITranslation('notAvailableIn', languageCode).replace('{country}', countryCode)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">{t.overview}</h2>
              <p className="text-gray-300 leading-relaxed text-sm xs:text-base">
                {content.overview || t.noOverviewAvailable}
              </p>
            </div>

            {/* Genres */}
            {getGenres().length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">{t.genres}</h2>
                <div className="flex flex-wrap gap-2">
                  {getGenres().map((genre: any) => (
                    <span 
                      key={genre.id} 
                      className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">{t.cast}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {cast.map((person) => (
                    <Link
                      key={person.id}
                      to={buildLanguagePath(`/person/${createPersonSlug(person.id, person.name)}`, languageCode)}
                      className="text-center group cursor-pointer"
                    >
                      <img
                        src={person.profile_path 
                          ? tmdbService.getProfileUrl(person.profile_path, 'w185')
                          : '/placeholder-profile.jpg'
                        }
                        alt={person.name}
                        className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.fallback-avatar')) {
                            const fallback = document.createElement('div');
                            fallback.className = "w-full aspect-[2/3] bg-gray-700 rounded-lg mb-2 flex items-center justify-center fallback-avatar group-hover:scale-105 transition-transform duration-300";
                            fallback.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                      <h3 className="text-white text-sm font-medium group-hover:text-primary-400 transition-colors">{person.name}</h3>
                      <p className="text-gray-400 text-xs">{person.character}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">{t.crew}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {crew.map((person) => (
                    <Link
                      key={`${person.id}-${person.job}`}
                      to={buildLanguagePath(`/person/${createPersonSlug(person.id, person.name)}`, languageCode)}
                      className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
                    >
                      <img
                        src={person.profile_path 
                          ? tmdbService.getProfileUrl(person.profile_path, 'w185')
                          : '/placeholder-profile.jpg'
                        }
                        alt={person.name}
                        className="w-12 h-12 object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.fallback-avatar')) {
                            const fallback = document.createElement('div');
                            fallback.className = "w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center fallback-avatar group-hover:scale-110 transition-transform duration-300";
                            fallback.innerHTML = '<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                      <div>
                        <h3 className="text-white text-sm font-medium group-hover:text-primary-400 transition-colors">{person.name}</h3>
                        <p className="text-gray-400 text-xs">{person.job}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Additional Info */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">{t.details}</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400">{t.releaseDate}:</span>
                  <span className="text-white ml-2">
                    {content.release_date || content.first_air_date || 'Unknown'}
                  </span>
                </div>
                {contentType === 'movie' && content.runtime && (
                  <div>
                    <span className="text-gray-400">{t.runtime}:</span>
                    <span className="text-white ml-2">{getRuntime()}</span>
                  </div>
                )}
                {contentType === 'tv_show' && (
                  <>
                    <div>
                      <span className="text-gray-400">{t.seasons}:</span>
                      <span className="text-white ml-2">{content.number_of_seasons || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{t.episodes}:</span>
                      <span className="text-white ml-2">{content.number_of_episodes || 'Unknown'}</span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-gray-400">{t.originalLanguage}:</span>
                  <span className="text-white ml-2">{content.original_language?.toUpperCase() || 'Unknown'}</span>
                </div>
                {content.status && (
                  <div>
                    <span className="text-gray-400">{t.status}:</span>
                    <span className="text-white ml-2">{content.status}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleRatingSubmit}
        currentRating={userRating}
        contentTitle={content.title}
      />
      
      {/* Share List Modal */}
      <ShareListSelectModal
        isOpen={showShareListModal}
        onClose={() => setShowShareListModal(false)}
        contentId={content.id}
        contentType={content.content_type}
      />
    </div>
  )

  // Background function to save content to database with all translations
  async function saveContentToDatabase(contentId: number, contentType: string) {
    console.log(`📦 Saving content ${contentId} to database in background...`)

    try {
      // Call edge function to save with ALL language translations
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-tmdb-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save-content',
          contentId: contentId,
          contentType: contentType,
          languageCode: 'en', // Save with English as base, edge function will fetch all translations
          countryCode: countryCode,
          tmdbApiKey: import.meta.env.VITE_TMDB_API_KEY
        })
      })

      if (response.ok) {
        console.log(`✅ Content ${contentId} saved to database with all translations`)
      } else {
        console.error(`❌ Failed to save content to database`)
      }
    } catch (error) {
      console.error(`❌ Error saving content to database:`, error)
    }
  }
}

export default ContentDetailPage
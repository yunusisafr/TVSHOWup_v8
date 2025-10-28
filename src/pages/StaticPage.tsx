import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { databaseService, StaticPage as StaticPageType, getLocalizedStaticPageTitle, getLocalizedStaticPageContent, getLocalizedStaticPageMetaDescription } from '../lib/database'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { ChevronLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import ContactForm from '../components/ContactForm'

const StaticPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const [page, setPage] = useState<StaticPageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPage = async () => {
      if (!slug) {
        setError('Page not found')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const pageData = await databaseService.getStaticPage(slug)
        
        if (!pageData) {
          setError('Page not found')
        } else {
          setPage(pageData)
          // Update meta data
          updateMetaData(pageData)
        }
      } catch (error) {
        console.error(`Error loading page ${slug}:`, error)
        setError('Failed to load page')
      } finally {
        setLoading(false)
      }
      
      // Cleanup function to reset meta data when component unmounts
      return () => resetMetaData()
    }

    loadPage()
  }, [slug])

  // Get localized title for the current page
  const getPageTitle = (): string => {
    if (!page) return ''
    
    const localizedTitle = getLocalizedStaticPageTitle(page, languageCode)
    if (localizedTitle !== page.title) {
      return localizedTitle
    }
    
    // Fallback to hardcoded translations for common pages
    if (languageCode === 'tr') {
      // Turkish titles
      switch (page.slug) {
        case 'privacy-policy': return 'Gizlilik Politikası'
        case 'terms-of-service': return 'Kullanım Koşulları'
        case 'cookie-policy': return 'Çerez Politikası'
        case 'contact': return 'İletişim'
        case 'help': return 'Yardım Merkezi'
        case 'about-us': return 'Hakkımızda'
        default: return page.title
      }
    } else {
      // English titles
      switch (page.slug) {
        case 'privacy-policy': return 'Privacy Policy'
        case 'terms-of-service': return 'Terms of Service'
        case 'cookie-policy': return 'Cookie Policy'
        case 'contact': return 'Contact Us'
        case 'help': return 'Help Center'
        case 'about-us': return 'About Us'
        default: return page.title
      }
    }
  }

  // Get localized content for the current page
  const getPageContent = (): string => {
    if (!page) return ''
    return getLocalizedStaticPageContent(page, languageCode)
  }
  const updateMetaData = (pageData: StaticPageType) => {
    // Update page title
    const localizedTitle = getLocalizedStaticPageTitle(pageData, languageCode) || getPageTitle()
    document.title = `${localizedTitle} - TVSHOWup`
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      const description = getLocalizedStaticPageMetaDescription(pageData, languageCode) || 
        (languageCode === 'tr' 
          ? `${localizedTitle} - TVSHOWup'ta detaylı bilgi ve içerik`
          : `${localizedTitle} - Detailed information and content on TVSHOWup`)
      metaDescription.setAttribute('content', description)
    }
    
    // Update Open Graph meta tags
    let ogTitle = document.querySelector('meta[property="og:title"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    ogTitle.setAttribute('content', localizedTitle)
    
    let ogDescription = document.querySelector('meta[property="og:description"]')
    if (!ogDescription) {
      ogDescription = document.createElement('meta')
      ogDescription.setAttribute('property', 'og:description')
      document.head.appendChild(ogDescription)
    }
    const description = pageData.meta_description || `${localizedTitle} - TVSHOWup`
    ogDescription.setAttribute('content', description)
    
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-800 rounded w-full"></div>
              <div className="h-4 bg-gray-800 rounded w-5/6"></div>
              <div className="h-4 bg-gray-800 rounded w-4/6"></div>
              <div className="h-4 bg-gray-800 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            {languageCode === 'tr' ? 'Sayfa Bulunamadı' : 'Page Not Found'}
          </h1>
          <p className="text-gray-400 mb-8">
            {error || (languageCode === 'tr' ? 'İstediğiniz sayfa bulunamadı.' : 'The page you requested could not be found.')}
          </p>
          <button
            onClick={() => navigate(`/${languageCode}`)}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            {languageCode === 'tr' ? 'Ana Sayfaya Dön' : 'Return to Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-white/80 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          {t.cancel}
        </button>
        
        {/* Content */}
        {slug === 'contact' ? (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">{getPageTitle()}</h1>
            <div className="mb-8">
              <article className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown>
                  {getPageContent()}
                </ReactMarkdown>
              </article>
            </div>
            <ContactForm />
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">{getPageTitle()}</h1>
            <article className="prose prose-invert prose-lg max-w-none">
              <ReactMarkdown>
                {getPageContent()}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>
    </div>
  )
}

export default StaticPage
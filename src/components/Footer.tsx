import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { getLogoUrl } from '../lib/assets'
import { databaseService, StaticPage, getLocalizedStaticPageTitle } from '../lib/database'
import AdBanner from './AdBanner'
import LanguageLink from './LanguageLink'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'

const Footer: React.FC = () => {
  const { languageCode, isLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const [staticPages, setStaticPages] = useState<StaticPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStaticPages = async () => {
      try {
        const pages = await databaseService.getAllStaticPages()
        setStaticPages(pages)
      } catch (error) {
        console.error('Error loading static pages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStaticPages()
  }, [])

  if (isLoading) return null

  // Group pages by category based on slug
  // Support pages for the footer bottom section
  const supportPages = staticPages.filter(page =>
    ['help', 'contact'].includes(page.slug)
  )

  // Legal pages for the footer bottom section
  const legalPages = staticPages.filter(page => 
    ['privacy-policy', 'terms-of-service', 'cookie-policy'].includes(page.slug)
  )
  
  // All pages for the bottom section
  const bottomPages = [...supportPages, ...legalPages]

  // Get localized title for a page
  const getPageTitle = (page: StaticPage): string => {
    const localizedTitle = getLocalizedStaticPageTitle(page, languageCode)
    if (localizedTitle !== page.title) {
      return localizedTitle
    }
    
    // Fallback to hardcoded translations for common pages
    switch (page.slug) {
      case 'privacy-policy':
        return languageCode === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'
      case 'terms-of-service':
        return languageCode === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'
      case 'cookie-policy':
        return languageCode === 'tr' ? 'Çerez Politikası' : 'Cookie Policy'
      case 'contact':
        return languageCode === 'tr' ? 'İletişim' : 'Contact Us'
      case 'help':
        return languageCode === 'tr' ? 'Yardım' : 'Help'
      case 'about-us':
        return languageCode === 'tr' ? 'Hakkımızda' : 'About Us'
      default:
        return page.title
    }
  }
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      {/* Footer Ad Banner */}
      <div className="py-4 flex justify-center">
        <AdBanner slotId="div-gpt-ad-footer" className="w-full max-w-5xl mx-auto" />
      </div>
    
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <LanguageLink to="/" className="flex items-center">
              <img
                src={getLogoUrl()}
                alt="TVSHOWup"
                className="h-11"
              />
            </LanguageLink>
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
            {t.footerDescription}
          </p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0 mb-4">
            <p className="text-gray-400 text-xs sm:text-sm">
              © {new Date().getFullYear()} TVSHOWup
            </p>
            <div className="flex items-center flex-wrap justify-center gap-3 sm:gap-4">
              {bottomPages.length > 0 ? (
                bottomPages.map(page => (
                  <LanguageLink
                    key={page.id}
                    to={`/pages/${page.slug}`}
                    className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
                  >
                    {getPageTitle(page)}
                  </LanguageLink>
                ))
              ) : (
                <div className="flex items-center flex-wrap gap-4">
                  <LanguageLink to="/pages/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">
                    {t.privacyPolicy}
                  </LanguageLink>
                  <LanguageLink to="/pages/terms-of-service" className="text-gray-400 hover:text-white transition-colors text-sm">
                    {t.termsOfService}
                  </LanguageLink>
                  <LanguageLink to="/pages/cookie-policy" className="text-gray-400 hover:text-white transition-colors text-sm">
                    {t.cookiePolicy}
                  </LanguageLink>
                  <LanguageLink to="/pages/contact" className="text-gray-400 hover:text-white transition-colors text-sm">
                    {t.contactUs}
                  </LanguageLink>
                  <LanguageLink to="/pages/help" className="text-gray-400 hover:text-white transition-colors text-sm">
                    {t.help}
                  </LanguageLink>
                </div>
              )}
            </div>
          </div>
          
          {/* Legal Disclaimer */}
          <div className="text-gray-500 text-xs text-center mt-4 max-w-3xl mx-auto text-[10px] sm:text-xs">
            {t.legalDisclaimer}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

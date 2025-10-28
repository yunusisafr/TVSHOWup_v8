import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, Info, Check, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import Cookies from 'js-cookie'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { databaseService } from '../lib/database'
import ReactMarkdown from 'react-markdown'


const COOKIE_CONSENT_KEY = 'tvshowup_cookie_consent'
const COOKIE_PREFERENCES_KEY = 'tvshowup_cookie_preferences'
const COOKIE_EXPIRY_DAYS = 365

// Define cookie preference types
interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

// Define view types
type ConsentView = 'main' | 'customize' | 'policy';

const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [currentView, setCurrentView] = useState<ConsentView>('main')
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    essential: true, // Essential cookies are always required
    analytics: true,
    marketing: false
  })
  const [policyContent, setPolicyContent] = useState<string>('')
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)

  // Load saved preferences and check if consent banner should be shown
  useEffect(() => {
    const hasConsent = Cookies.get(COOKIE_CONSENT_KEY)
    const savedPreferences = Cookies.get(COOKIE_PREFERENCES_KEY)
    
    // Update text based on current language
    if (currentView === 'policy' && policyContent === '') {
      loadPolicyContent()
    }
    
    if (savedPreferences) {
      try {
        const parsedPreferences = JSON.parse(savedPreferences)
        setCookiePreferences({
          ...cookiePreferences,
          ...parsedPreferences
        })
      } catch (error) {
        console.error('Error parsing cookie preferences:', error)
      }
    }
    
    // Only show banner if consent cookie doesn't exist or is not 'true'
    if (!hasConsent || hasConsent !== 'true') {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
    
      return () => clearTimeout(timer)
    }
  }, [])

  // Reload policy content when language changes
  useEffect(() => {
    if (currentView === 'policy') {
      loadPolicyContent()
    }
  }, [languageCode])

  // Load cookie policy content
  const loadPolicyContent = async () => {
    try {
      setLoadingPolicy(true)
      // Get the appropriate policy page based on language
      const policySlug = languageCode === 'tr' ? 'cerez-politikasi' : 'cookie-policy'
      
      try {
        const policyPage = await databaseService.getStaticPage(policySlug)
        if (policyPage) {
          setPolicyContent(policyPage.content)
        } else {
          setPolicyContent(languageCode === 'tr' 
            ? '# Çerez Politikası\n\nÇerez politikası içeriği bulunamadı.' 
            : '# Cookie Policy\n\nCookie policy content not found.')
        }
      } catch (fetchError) {
        console.warn('Cookie policy page not found:', fetchError)
        setPolicyContent(languageCode === 'tr' 
          ? '# Çerez Politikası\n\nÇerez politikası içeriği bulunamadı.' 
          : '# Cookie Policy\n\nCookie policy content not found.')
      }
    } catch (error) {
      console.error('Error loading cookie policy:', error)
      setPolicyContent(languageCode === 'tr' 
        ? '# Çerez Politikası\n\nÇerez politikası yüklenirken bir hata oluştu.' 
        : '# Cookie Policy\n\nAn error occurred while loading the cookie policy.')
    } finally {
      setLoadingPolicy(false)
    }
  }

  // Handle accepting all cookies
  const handleAcceptAll = () => {
    const preferences: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true
    }
    
    // Save preferences
    Cookies.set(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences), { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    // Set consent cookie
    Cookies.set(COOKIE_CONSENT_KEY, 'true', { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    setCookiePreferences(preferences)
    setIsVisible(false)
  }

  // Handle rejecting non-essential cookies
  const handleRejectAll = () => {
    const preferences: CookiePreferences = {
      essential: true, // Essential cookies are always accepted
      analytics: false,
      marketing: false
    }
    
    // Save preferences
    Cookies.set(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences), { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    // Set consent cookie
    Cookies.set(COOKIE_CONSENT_KEY, 'true', { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    setCookiePreferences(preferences)
    setIsVisible(false)
  }

  // Handle saving custom preferences
  const handleSavePreferences = () => {
    // Save preferences
    Cookies.set(COOKIE_PREFERENCES_KEY, JSON.stringify(cookiePreferences), { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    // Set consent cookie
    Cookies.set(COOKIE_CONSENT_KEY, 'true', { 
      expires: COOKIE_EXPIRY_DAYS, 
      path: '/',
      sameSite: 'strict'
    })
    
    setIsVisible(false)
  }

  // Handle preference toggle
  const handlePreferenceChange = (key: keyof CookiePreferences) => {
    if (key === 'essential') return; // Essential cookies cannot be toggled
    
    setCookiePreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Handle view changes
  const handleViewChange = (view: ConsentView) => {
    if (view === 'policy' && policyContent === '') {
      loadPolicyContent()
    }
    setCurrentView(view)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-2xl overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center">
            {currentView !== 'main' && (
              <button
                onClick={() => handleViewChange('main')}
                className="mr-2 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-white">
              {currentView === 'main' && (languageCode === 'tr' ? 'Çerez Tercihleri' : 'Cookie Preferences')}
              {currentView === 'customize' && (languageCode === 'tr' ? 'Tercihleri Özelleştir' : 'Customize Preferences')}
              {currentView === 'policy' && (languageCode === 'tr' ? 'Çerez Politikası' : 'Cookie Policy')}
            </h2>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Main View */}
        {currentView === 'main' && (
          <>
            <div className="p-4 sm:p-6">
              <p className="text-gray-300 text-sm sm:text-base mb-4">
                {languageCode === 'tr' 
                  ? 'Bu site, size en iyi deneyimi sunmak için çerezleri kullanır. Çerezler, web sitesinin düzgün çalışması, kullanımı analiz etmemiz ve içeriği kişiselleştirmemiz için gereklidir.'
                  : 'This site uses cookies to provide you with the best experience. Cookies are necessary for the website to function properly, for us to analyze usage, and to personalize content.'}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => handleViewChange('policy')}
                  className="text-primary-400 hover:text-primary-300 text-sm flex items-center"
                >
                  <Info className="w-4 h-4 mr-1" />
                  {languageCode === 'tr' ? 'Çerez Politikamızı Oku' : 'Read Our Cookie Policy'}
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 bg-gray-700/30 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                {languageCode === 'tr' ? 'Sadece Gerekli Çerezler' : 'Essential Cookies Only'}
              </button>
              <button
                onClick={() => handleViewChange('customize')}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center"
              >
                <Settings className="w-4 h-4 mr-2" />
                {languageCode === 'tr' ? 'Tercihleri Özelleştir' : 'Customize Preferences'}
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                {languageCode === 'tr' ? 'Tümünü Kabul Et' : 'Accept All'}
              </button>
            </div>
          </>
        )}
        
        {/* Customize View */}
        {currentView === 'customize' && (
          <>
            <div className="p-4 sm:p-6">
              <p className="text-gray-300 text-sm mb-6">
                {languageCode === 'tr' 
                  ? 'Hangi çerez türlerinin kullanılmasına izin verdiğinizi seçin. Zorunlu çerezler, web sitesinin temel işlevleri için gereklidir ve devre dışı bırakılamaz.'
                  : 'Choose which types of cookies you allow us to use. Essential cookies are necessary for the basic functions of the website and cannot be disabled.'}
              </p>
              
              <div className="space-y-4">
                {/* Essential Cookies */}
                <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div>
                    <h3 className="text-white font-medium">
                      {languageCode === 'tr' ? 'Zorunlu Çerezler' : 'Essential Cookies'}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {languageCode === 'tr' 
                        ? 'Web sitesinin temel işlevleri için gereklidir. Devre dışı bırakılamaz.'
                        : 'Required for the basic functions of the website. Cannot be disabled.'}
                    </p>
                  </div>
                  <div className="bg-primary-500/20 text-primary-400 text-xs px-3 py-1 rounded-full">
                    {languageCode === 'tr' ? 'Gerekli' : 'Required'}
                  </div>
                </div>
                
                {/* Analytics Cookies */}
                <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div>
                    <h3 className="text-white font-medium">
                      {languageCode === 'tr' ? 'Analiz Çerezleri' : 'Analytics Cookies'}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {languageCode === 'tr' 
                        ? 'Web sitesi kullanımını analiz etmemize ve iyileştirmemize yardımcı olur.'
                        : 'Helps us analyze and improve website usage.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('analytics')}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                      cookiePreferences.analytics ? 'bg-primary-500 justify-end' : 'bg-gray-600 justify-start'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full transform transition-transform ${
                      cookiePreferences.analytics ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                    }`}>
                      {cookiePreferences.analytics && <Check className="w-3 h-3 text-primary-500 m-auto" />}
                    </div>
                  </button>
                </div>
                
                {/* Marketing Cookies */}
                <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div>
                    <h3 className="text-white font-medium">
                      {languageCode === 'tr' ? 'Pazarlama Çerezleri' : 'Marketing Cookies'}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {languageCode === 'tr' 
                        ? 'İlgi alanlarınıza göre hedeflenmiş reklamlar göstermek için kullanılır.'
                        : 'Used to show targeted advertisements based on your interests.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('marketing')}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                      cookiePreferences.marketing ? 'bg-primary-500 justify-end' : 'bg-gray-600 justify-start'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full transform transition-transform ${
                      cookiePreferences.marketing ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                    }`}>
                      {cookiePreferences.marketing && <Check className="w-3 h-3 text-primary-500 m-auto" />}
                    </div>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 bg-gray-700/30 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => handleViewChange('main')}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                {languageCode === 'tr' ? 'Geri' : 'Back'}
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                {languageCode === 'tr' ? 'Tercihleri Kaydet' : 'Save Preferences'}
              </button>
            </div>
          </>
        )}
        
        {/* Policy View */}
        {currentView === 'policy' && (
          <div className="p-4 sm:p-6 max-h-[30vh] overflow-y-auto cookie-policy-content">
            {loadingPolicy ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm sm:prose max-w-none text-gray-200">
                <ReactMarkdown>{policyContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CookieConsentBanner
import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Cookies from 'js-cookie'
import { getLanguageFromPath, isSupportedLanguage, buildLanguagePath, detectBrowserLanguage, getCountryForLanguage, DEFAULT_LANGUAGE } from '../lib/utils'
import { useUserPreferences } from '../contexts/UserPreferencesContext'

interface LanguageRouterProps {
  children: React.ReactNode
}

const LanguageRouter: React.FC<LanguageRouterProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { languageCode, setCountryCode } = useUserPreferences()

  useEffect(() => {
    // Skip language routing for static files and special paths
    const staticPaths = ['/sitemap.xml', '/robots.txt', '/ads.txt', '/manifest.json', '/sw.js'];
    const isStaticPath = staticPaths.some(path => location.pathname === path);

    if (isStaticPath) {
      return;
    }

    const currentLang = getLanguageFromPath(location.pathname)

    // Check if URL has multiple language codes (e.g., /bg/bg or /tr/en)
    const segments = location.pathname.split('/').filter(Boolean)
    const langCodesInUrl = segments.filter(seg => isSupportedLanguage(seg))

    if (langCodesInUrl.length > 1) {
      console.error(`❌ Multiple language codes detected: ${location.pathname}`)
      // Keep only the first valid language code
      const targetLang = langCodesInUrl[0]
      const nonLangSegments = segments.filter(seg => !isSupportedLanguage(seg))
      const fixedPath = `/${targetLang}${nonLangSegments.length ? '/' + nonLangSegments.join('/') : ''}`
      console.log(`🔄 Redirecting to fixed path: ${fixedPath}`)
      navigate(fixedPath + location.search + location.hash, { replace: true })
      return
    }

    // If no language in URL, redirect to user's preferred language
    if (!currentLang) {
      // Get language from cookies first (fastest), then context, then browser detection
      const cookieLang = Cookies.get('user_language')
      const detectedLang = cookieLang || languageCode || detectBrowserLanguage()

      console.log(`🌐 No language in URL, redirecting to: ${detectedLang}`)
      const newPath = buildLanguagePath(location.pathname, detectedLang)
      navigate(newPath + location.search + location.hash, { replace: true })
      return
    }

    // If unsupported language, redirect to default
    if (!isSupportedLanguage(currentLang)) {
      console.warn(`⚠️ Unsupported language: ${currentLang}, redirecting to default`)
      const cleanPath = location.pathname.replace(new RegExp(`^/${currentLang}`), '')
      const newPath = buildLanguagePath(cleanPath || '/', DEFAULT_LANGUAGE)
      navigate(newPath + location.search + location.hash, { replace: true })
      return
    }

    // Valid language in URL - sync with context if different
    if (currentLang !== languageCode) {
      console.log(`🔄 URL language (${currentLang}) differs from context (${languageCode}), syncing context`)
      const newCountry = getCountryForLanguage(currentLang)
      setCountryCode(newCountry)
    }
  }, [location.pathname, languageCode, navigate, setCountryCode])

  return <>{children}</>
}

export default LanguageRouter

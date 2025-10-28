import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie'
import { databaseService } from '../lib/database'
import { translations, countryNames } from '../lib/i18n'
import { getLanguageFromPath, switchLanguageInPath, isSupportedLanguage } from '../lib/utils'

// Map from country code to language code
const countryToLanguageMap: Record<string, string> = {
  'US': 'en',
  'GB': 'en',
  'CA': 'en',
  'AU': 'en',
  'NZ': 'en',
  'IE': 'en',
  'ZA': 'en',
  'TR': 'tr',
  'DE': 'de',
  'AT': 'de',
  'CH': 'de',
  'FR': 'fr',
  'BE': 'fr',
  'LU': 'fr',
  'ES': 'es',
  'MX': 'es',
  'AR': 'es',
  'CL': 'es',
  'CO': 'es',
  'PE': 'es',
  'VE': 'es',
  'UY': 'es',
  'EC': 'es',
  'BO': 'es',
  'PY': 'es',
  'IT': 'it',
  'NL': 'nl',
  'PT': 'pt',
  'BR': 'pt',
  'RU': 'ru',
  'PL': 'pl',
  'CZ': 'cs',
  'SK': 'sk',
  'HU': 'hu',
  'RO': 'ro',
  'HR': 'hr',
  'SI': 'sl',
  'BG': 'bg',
  'LT': 'lt',
  'LV': 'lv',
  'EE': 'et',
  'FI': 'fi',
  'SE': 'sv',
  'NO': 'no',
  'DK': 'da',
  'IS': 'is',
  'GR': 'el',
  'MT': 'mt',
  'CY': 'el',
  'UA': 'uk',
  'JP': 'ja',
  'KR': 'ko',
  'CN': 'zh',
  'TW': 'zh',
  'HK': 'zh',
  'MO': 'zh',
  'IN': 'hi',
  'TH': 'th',
  'VN': 'vi',
  'MY': 'ms',
  'SG': 'en',
  'ID': 'id',
  'PH': 'en',
  'IL': 'he',
  'AE': 'ar',
  'SA': 'ar',
  'EG': 'ar',
  'default': 'en'
}

interface UserPreferencesContextType {
  countryCode: string
  languageCode: string
  isLoading: boolean
  setCountryCode: (code: string) => void
  setLanguageCode: (code: string) => void
  getCountryName: (code: string) => string
  getSupportedCountries: () => Record<string, string>
}

export const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext)
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return context
}

const detectUserLocation = async (): Promise<string> => {
  try {
    console.log('🌍 Detecting user location...')

    // Try first service only with shorter timeout
    const service = { url: 'https://ipapi.co/json/', field: 'country_code' }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      const response = await fetch(service.url, {
        signal: controller.signal,
        cache: 'no-cache'
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const countryCode = data[service.field]

        if (countryCode && countryCode.length === 2) {
          const upperCode = countryCode.toUpperCase()
          console.log(`✅ Detected country: ${upperCode}`)
          return upperCode
        }
      }
    } catch (error) {
      console.warn(`❌ Geolocation service failed, using fallback`)
    }

    // Fallback to browser language detection
    const browserLanguage = navigator.language || navigator.languages?.[0] || 'en-US'
    const countryFromLanguage = browserLanguage.split('-')[1]

    if (countryFromLanguage && countryFromLanguage.length === 2) {
      console.log(`✅ Country from browser language: ${countryFromLanguage}`)
      return countryFromLanguage.toUpperCase()
    }

    // Final fallback
    console.log('⚠️ Using default country: US')
    return 'US'

  } catch (error) {
    console.error('❌ Location detection failed:', error)
    return 'US'
  }
}

const detectUserLanguage = (): string => {
  try {
    const browserLanguage = navigator.language || navigator.languages?.[0] || 'en-US'
    const languageCode = browserLanguage.split('-')[0] || 'en'
    console.log(`🗣️ Detected browser language: ${languageCode}`)
    
    // Check if the detected language is supported
    if (Object.values(countryToLanguageMap).includes(languageCode)) {
      return languageCode;
    }
    
    // Default to English if not supported
    return 'en';
  } catch (error) {
    console.error('Error detecting language:', error)
    return 'en'
  }
}

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Initialize with cookies immediately for faster startup
  const initialLanguage = Cookies.get('user_language') || 'en'
  const initialCountry = Cookies.get('user_country') || 'US'

  const [countryCode, setCountryCodeState] = useState<string>(initialCountry)
  const [languageCode, setLanguageCodeState] = useState<string>(initialLanguage)
  const [isLoading, setIsLoading] = useState(false)
  const [urlSyncEnabled, setUrlSyncEnabled] = useState(false)

  useEffect(() => {
    const urlLang = getLanguageFromPath(location.pathname)
    if (urlLang && isSupportedLanguage(urlLang)) {
      if (urlLang !== languageCode) {
        console.log(`🌐 URL language detected: ${urlLang}, syncing context`)
        setLanguageCodeState(urlLang)
      }
      setUrlSyncEnabled(true)
    }
  }, [location.pathname])

  useEffect(() => {
    const initializePreferences = async () => {
      console.log('🚀 Initializing user preferences...')

      try {
        if (user && userProfile) {
          // Use user's saved preferences
          console.log('👤 Using logged-in user preferences')
          const userCountry = userProfile.country_code || 'US'
          const userLanguage = userProfile.language_code || 'en'

          setCountryCodeState(userCountry)
          setLanguageCodeState(userLanguage)

          // Update cookies to match user profile
          Cookies.set('user_country', userCountry, { expires: 365, path: '/' })
          Cookies.set('user_language', userLanguage, { expires: 365, path: '/' })
        } else {
          // For anonymous users, check cookies first
          const savedCountry = Cookies.get('user_country')
          const savedLanguage = Cookies.get('user_language')

          if (savedCountry && savedLanguage) {
            console.log('✅ Using saved cookie preferences')
            setCountryCodeState(savedCountry)
            setLanguageCodeState(savedLanguage)
          } else {
            console.log('🔍 No saved preferences, detecting automatically...')

            // Try browser language first (faster)
            const detectedBrowserLanguage = detectUserLanguage()

            // Try geolocation only if no cookies exist
            const detectedCountry = await detectUserLocation()

            // Prefer country-based language over browser language
            const finalLanguageCode = countryToLanguageMap[detectedCountry] || detectedBrowserLanguage

            console.log(`🌐 Setting language to ${finalLanguageCode}`);
            console.log(`🌍 Setting country to ${detectedCountry}`);

            setCountryCodeState(detectedCountry)
            setLanguageCodeState(finalLanguageCode)

            // Save to cookies for future visits - 1 year expiry, root path
            Cookies.set('user_country', detectedCountry, { expires: 365, path: '/' })
            Cookies.set('user_language', finalLanguageCode, { expires: 365, path: '/' })

            console.log('💾 Saved preferences to cookies')
          }
        }
      } catch (error) {
        console.error('Error initializing preferences:', error);
        // Fallback to defaults or existing cookie values
        const fallbackCountry = Cookies.get('user_country') || 'US'
        const fallbackLanguage = Cookies.get('user_language') || 'en'
        setCountryCodeState(fallbackCountry);
        setLanguageCodeState(fallbackLanguage);
      }

      console.log('✅ User preferences initialized')
    }

    initializePreferences()
  }, [user, userProfile])

  const setCountryCode = (code: string) => {
    console.log(`🌍 Setting country code: ${code}`)

    const newLanguage = countryToLanguageMap[code] || 'en';
    console.log(`🗣️ Automatically updating language to ${newLanguage} based on country ${code}`);

    const isCountryChanged = code !== countryCode;
    const isLanguageChanged = newLanguage !== languageCode;

    setCountryCodeState(code)
    setLanguageCodeState(newLanguage)

    if (isLanguageChanged && urlSyncEnabled) {
      try {
        const currentPath = location.pathname;
        console.log(`🔄 Current path: ${currentPath}, switching to language: ${newLanguage}`);

        const newPath = switchLanguageInPath(currentPath, newLanguage);
        console.log(`✅ New path: ${newPath}`);

        // Validate the new path doesn't have errors
        if (newPath && newPath.startsWith('/')) {
          navigate(newPath + location.search + location.hash, { replace: true });
        } else {
          console.error('Invalid new path generated:', newPath);
          // Fallback to language root
          navigate(`/${newLanguage}`, { replace: true });
        }
      } catch (error) {
        console.error('Error switching language in URL:', error);
        // Fallback to language root
        navigate(`/${newLanguage}`, { replace: true });
      }
    }
    
    if (!user) {
      Cookies.set('user_country', code, { expires: 365, path: '/' })
      Cookies.set('user_language', newLanguage, { expires: 365, path: '/' })
      console.log('💾 Saved country and language to cookies')
    } else {
      // Update user profile if logged in
      try {
        const { supabase } = databaseService;
        supabase
          .from('user_profiles')
          .update({
            country_code: code,
            language_code: newLanguage,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating user profile:', error);
            } else {
              console.log('✅ Updated user profile with new country and language');
            }
          });
      } catch (error) {
        console.error('Failed to update user profile:', error);
      }
    }
    
    setTimeout(() => {
      const event = new CustomEvent('preferencesChanged', {
        detail: {
          countryChanged: isCountryChanged,
          languageChanged: isLanguageChanged,
          newCountry: code,
          newLanguage: newLanguage
        }
      });
      window.dispatchEvent(event);

      console.log(`🔄 Preferences changed event dispatched: country=${isCountryChanged}, language=${isLanguageChanged}`);
    }, 100);
  }

  const setLanguageCode = (code: string) => {
    console.log(`🗣️ Setting language code: ${code}`)

    if (!isSupportedLanguage(code)) {
      console.warn(`⚠️ Unsupported language code: ${code}, falling back to 'en'`)
      code = 'en'
    }

    setLanguageCodeState(code)

    if (urlSyncEnabled) {
      const newPath = switchLanguageInPath(location.pathname, code)
      navigate(newPath + location.search + location.hash, { replace: true })
    }

    const languageToCountryMap: Record<string, string> = {
      'en': 'US',
      'tr': 'TR',
      'de': 'DE',
      'fr': 'FR',
      'es': 'ES',
      'it': 'IT'
    }
    const newCountry = languageToCountryMap[code] || 'US'
    if (newCountry !== countryCode) {
      setCountryCodeState(newCountry)

      if (!user) {
        Cookies.set('user_country', newCountry, { expires: 365, path: '/' })
        Cookies.set('user_language', code, { expires: 365, path: '/' })
      } else {
        try {
          const { supabase } = databaseService;
          supabase
            .from('user_profiles')
            .update({
              country_code: newCountry,
              language_code: code,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error updating user profile:', error);
              }
            });
        } catch (error) {
          console.error('Failed to update user profile:', error);
        }
      }
    }
  }

  // Get country name based on current language
  const getCountryName = (code: string): string => {
    // Always use English country names
    return countryNames['en'][code] || code;
  }
  
  // Get all supported countries with names in current language
  const getSupportedCountries = (): Record<string, string> => {
    const countries: Record<string, string> = {};
    // Always use English country names and sort alphabetically
    const englishCountries = countryNames['en'];
    const sortedEntries = Object.entries(englishCountries).sort(([, nameA], [, nameB]) => 
      nameA.localeCompare(nameB)
    );
    
    sortedEntries.forEach(([code, name]) => {
      countries[code] = name;
    });
    
    return countries;
  }

  const value = {
    countryCode,
    languageCode,
    isLoading,
    setCountryCode,
    setLanguageCode,
    getCountryName,
    getSupportedCountries
  }

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  )
}
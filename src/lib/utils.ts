import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '../config/languages';

// Constants
export const ADMIN_SUBDOMAIN = 'admin';
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage };

// Utility functions for the application

/**
 * Check if the current route is an admin route
 * @returns {boolean} True if the current route is an admin route
 */
export const isAdminRoute = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Check if we're on the admin subdomain or admin path
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  const isAdminSubdomain = hostname.startsWith('admin.') ||
                          hostname === 'admin' ||
                          hostname.includes(`${ADMIN_SUBDOMAIN}.netlify.app`);

  const isAdminPath = pathname.startsWith('/admin');

  return isAdminSubdomain || isAdminPath;
};

/**
 * Get the admin base path based on current location
 * @returns {string} Base path for admin routes
 */
export const getAdminBasePath = (): string => {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname;
  const isAdminSubdomain = hostname.startsWith('admin.') ||
                          hostname === 'admin' ||
                          hostname.includes(`${ADMIN_SUBDOMAIN}.netlify.app`);

  return isAdminSubdomain ? '' : '/admin';
};

/**
 * Build an admin route path
 * @param {string} path - The relative admin path
 * @returns {string} Full admin path
 */
export const buildAdminPath = (path: string): string => {
  const basePath = getAdminBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (basePath === '') {
    return cleanPath;
  }

  return `${basePath}${cleanPath}`;
};

/**
 * Format a date string to a localized format
 * @param {string} dateString - The date string to format
 * @param {string} locale - The locale to use for formatting (default: 'en-US')
 * @returns {string} The formatted date string
 */
export const formatDate = (dateString: string, locale: string = 'en-US'): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * Truncate a string to a specified length
 * @param {string} str - The string to truncate
 * @param {number} length - The maximum length
 * @returns {string} The truncated string
 */
export const truncateString = (str: string, length: number): string => {
  if (!str) return '';
  if (str.length <= length) return str;
  
  return str.substring(0, length) + '...';
};

/**
 * Generate a URL-friendly slug from a title
 * @param {string} title - The title to convert to slug
 * @returns {string} The URL-friendly slug
 */
export const generateSlug = (title: string): string => {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
};

/**
 * Create a unique slug by appending a number if needed
 * @param {string} baseSlug - The base slug to make unique
 * @param {string[]} existingSlugs - Array of existing slugs to check against
 * @returns {string} A unique slug
 */
export const createUniqueSlug = (baseSlug: string, existingSlugs: string[]): string => {
  let uniqueSlug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.includes(uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return uniqueSlug;
};

/**
 * Extract ID from a slug that contains both ID and title (e.g., "123-movie-title")
 * @param {string} slug - The slug containing ID and title
 * @returns {number | null} The extracted ID or null if not found
 */
export const extractIdFromSlug = (slug: string): number | null => {
  if (!slug) return null;
  
  const match = slug.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Create a full slug with ID and title (e.g., "123-movie-title")
 * @param {number} id - The content ID
 * @param {string} title - The content title
 * @returns {string} The full slug with ID and title
 */
export const createFullSlug = (id: number, title: string): string => {
  const titleSlug = generateSlug(title);
  return `${id}-${titleSlug}`;
};

/**
 * Create a full slug with ID and original title for SEO (e.g., "123-friends")
 * Always uses original/English title for consistent URLs
 * @param {number} id - The content ID
 * @param {string} originalTitle - The original title (English or original language)
 * @param {string} fallbackTitle - Fallback title if original is not available
 * @returns {string} The full slug with ID and original title
 */
export const createSEOSlug = (id: number, originalTitle: string, fallbackTitle?: string): string => {
  const title = originalTitle || fallbackTitle || `content-${id}`;
  const titleSlug = generateSlug(title);
  return `${id}-${titleSlug}`;
};
/**
 * Create a person slug with ID and name (e.g., "123-john-doe")
 * @param {number} id - The person ID
 * @param {string} name - The person name
 * @returns {string} The full slug with ID and name
 */
export const createPersonSlug = (id: number, name: string): string => {
  const nameSlug = generateSlug(name);
  return `${id}-${nameSlug}`;
};

/**
 * Check if a language code is supported
 * @param {string} lang - The language code to check
 * @returns {boolean} True if the language is supported
 */
export const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

/**
 * Get the language code from the URL path
 * @param {string} pathname - The current pathname
 * @returns {string | null} The language code or null if not found
 */
export const getLanguageFromPath = (pathname: string): string | null => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isSupportedLanguage(segments[0])) {
    return segments[0];
  }
  return null;
};

/**
 * Build a language-aware URL path
 * @param {string} path - The path without language prefix
 * @param {string} languageCode - The language code to prepend
 * @returns {string} The complete path with language prefix
 */
export const buildLanguagePath = (path: string, languageCode: string): string => {
  // Validate language code
  if (!isSupportedLanguage(languageCode)) {
    console.error(`Invalid language code: ${languageCode}, using default`);
    languageCode = DEFAULT_LANGUAGE;
  }

  // First, completely remove any language prefix from the path
  const pathWithoutLang = removeLanguagePrefix(path);

  // Remove leading slash from the clean path
  const cleanPath = pathWithoutLang === '/' ? '' : pathWithoutLang.replace(/^\//, '');

  // Build new path with language prefix - ensure single language code
  const result = `/${languageCode}${cleanPath ? `/${cleanPath}` : ''}`;

  // Final safety check - ensure no double language codes
  const segments = result.split('/').filter(Boolean);
  const langCodes = segments.filter(seg => isSupportedLanguage(seg));

  if (langCodes.length > 1) {
    console.error(`Multiple language codes detected in result: ${result}`);
    // Strip all language codes and rebuild with just the target one
    const nonLangSegments = segments.filter(seg => !isSupportedLanguage(seg));
    return `/${languageCode}${nonLangSegments.length ? '/' + nonLangSegments.join('/') : ''}`;
  }

  return result;
};

/**
 * Remove language prefix from a path
 * @param {string} path - The path with potential language prefix
 * @returns {string} The path without language prefix
 */
export const removeLanguagePrefix = (path: string): string => {
  if (!path) return '/';

  let cleanPath = path;

  // Keep removing language codes from the beginning until none are left
  // This handles cases like /bg/bg/movies or /tr/en/search
  let hasLanguagePrefix = true;
  let iterations = 0;
  const maxIterations = 10; // Safety limit to prevent infinite loops

  while (hasLanguagePrefix && iterations < maxIterations) {
    const segments = cleanPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      cleanPath = '/';
      break;
    }

    const firstSegment = segments[0];

    if (isSupportedLanguage(firstSegment)) {
      // Remove the first segment (language code)
      segments.shift();
      cleanPath = '/' + segments.join('/');
    } else {
      // No more language codes at the start
      hasLanguagePrefix = false;
    }

    iterations++;
  }

  // Ensure path starts with a single slash and doesn't end with one (unless it's root)
  cleanPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  return cleanPath;
};

/**
 * Detect user's preferred language from browser
 * Checks cookies first for faster detection, then falls back to browser language
 * @returns {string} The detected language code or default
 */
export const detectBrowserLanguage = (): string => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  // First check if we have a saved language preference in cookies
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const langCookie = cookies.find(cookie => cookie.trim().startsWith('user_language='));

    if (langCookie) {
      const savedLang = langCookie.split('=')[1];
      if (savedLang && isSupportedLanguage(savedLang)) {
        console.log(`🍪 Using saved language from cookie: ${savedLang}`);
        return savedLang;
      }
    }
  }

  // Fall back to browser language detection
  const browserLang = (navigator.language || navigator.languages?.[0] || '').split('-')[0];
  const detectedLang = isSupportedLanguage(browserLang) ? browserLang : DEFAULT_LANGUAGE;
  console.log(`🌐 Detected browser language: ${detectedLang}`);
  return detectedLang;
};

/**
 * Switch language in current URL
 * @param {string} currentPath - The current pathname
 * @param {string} newLanguage - The new language code
 * @returns {string} The new path with updated language
 */
export const switchLanguageInPath = (currentPath: string, newLanguage: string): string => {
  // First ensure we have a clean path without any language codes
  const pathWithoutLang = removeLanguagePrefix(currentPath);

  // Then build the new path with the new language
  const newPath = buildLanguagePath(pathWithoutLang, newLanguage);

  // Validate the result doesn't have duplicate language codes
  const segments = newPath.split('/').filter(Boolean);
  const langCount = segments.filter(seg => isSupportedLanguage(seg)).length;

  if (langCount > 1) {
    console.error('Multiple language codes detected in path:', newPath);
    // Fallback: just add the new language to root
    const cleanSegments = segments.filter(seg => !isSupportedLanguage(seg));
    return `/${newLanguage}${cleanSegments.length ? '/' + cleanSegments.join('/') : ''}`;
  }

  return newPath;
};

/**
 * Get language to country code mapping
 * @param {string} languageCode - The language code
 * @returns {string} The country code
 */
export const getCountryForLanguage = (languageCode: string): string => {
  const languageToCountry: Record<string, string> = {
    'en': 'US',
    'tr': 'TR',
    'de': 'DE',
    'fr': 'FR',
    'es': 'ES',
    'it': 'IT',
    'pt': 'PT',
    'ru': 'RU',
    'ja': 'JP',
    'ko': 'KR',
    'zh': 'CN',
    'ar': 'SA',
    'hi': 'IN',
    'nl': 'NL',
    'sv': 'SE',
    'no': 'NO',
    'da': 'DK',
    'fi': 'FI',
    'pl': 'PL',
    'el': 'GR'
  };
  return languageToCountry[languageCode] || 'US';
};

/**
 * Get locale string for language (for date/number formatting)
 * @param {string} languageCode - The language code
 * @returns {string} The locale string
 */
export const getLocaleForLanguage = (languageCode: string): string => {
  const languageToLocale: Record<string, string> = {
    'en': 'en-US',
    'tr': 'tr-TR',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'hi': 'hi-IN',
    'nl': 'nl-NL',
    'sv': 'sv-SE',
    'no': 'no-NO',
    'da': 'da-DK',
    'fi': 'fi-FI',
    'pl': 'pl-PL',
    'el': 'el-GR'
  };
  return languageToLocale[languageCode] || 'en-US';
};

/**
 * Check if a language uses RTL (right-to-left) writing system
 * @param {string} languageCode - The language code
 * @returns {boolean} True if the language uses RTL
 */
export const isRTLLanguage = (languageCode: string): boolean => {
  const rtlLanguages = ['ar'];
  return rtlLanguages.includes(languageCode);
};
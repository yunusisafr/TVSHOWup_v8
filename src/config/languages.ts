export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
  'en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru',
  'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'no',
  'da', 'fi', 'pl', 'el'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface LanguageMetadata {
  code: string;
  name: string;
  nativeName: string;
  tmdbCode: string;
  isRTL: boolean;
  tier: 1 | 2 | 3;
  fallbackLanguage?: string;
}

export const LANGUAGE_METADATA: Record<string, LanguageMetadata> = {
  'en': {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    tmdbCode: 'en-US',
    isRTL: false,
    tier: 1,
  },
  'tr': {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    tmdbCode: 'tr-TR',
    isRTL: false,
    tier: 1,
  },
  'de': {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    tmdbCode: 'de-DE',
    isRTL: false,
    tier: 1,
  },
  'fr': {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    tmdbCode: 'fr-FR',
    isRTL: false,
    tier: 1,
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    tmdbCode: 'es-ES',
    isRTL: false,
    tier: 1,
  },
  'it': {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    tmdbCode: 'it-IT',
    isRTL: false,
    tier: 1,
  },
  'pt': {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    tmdbCode: 'pt-PT',
    isRTL: false,
    tier: 1,
  },
  'ru': {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    tmdbCode: 'ru-RU',
    isRTL: false,
    tier: 1,
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    tmdbCode: 'ja-JP',
    isRTL: false,
    tier: 1,
  },
  'ko': {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    tmdbCode: 'ko-KR',
    isRTL: false,
    tier: 1,
  },
  'zh': {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    tmdbCode: 'zh-CN',
    isRTL: false,
    tier: 1,
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    tmdbCode: 'ar-SA',
    isRTL: true,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'hi': {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    tmdbCode: 'hi-IN',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'nl': {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    tmdbCode: 'nl-NL',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'sv': {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    tmdbCode: 'sv-SE',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'no': {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    tmdbCode: 'no-NO',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'da': {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    tmdbCode: 'da-DK',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'fi': {
    code: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    tmdbCode: 'fi-FI',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'pl': {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    tmdbCode: 'pl-PL',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
  'el': {
    code: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    tmdbCode: 'el-GR',
    isRTL: false,
    tier: 2,
    fallbackLanguage: 'en',
  },
};

export const supportedLanguages: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map(code => [code, LANGUAGE_METADATA[code].nativeName])
);

export const supportedLanguageCodes = SUPPORTED_LANGUAGES;

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export function getLanguageMetadata(lang: string): LanguageMetadata | undefined {
  return LANGUAGE_METADATA[lang];
}

export function getTMDBLanguageCode(lang: string): string {
  return LANGUAGE_METADATA[lang]?.tmdbCode || 'en-US';
}

export function getFallbackLanguage(lang: string): string {
  return LANGUAGE_METADATA[lang]?.fallbackLanguage || DEFAULT_LANGUAGE;
}

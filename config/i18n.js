const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

/**
 * PartsForm International Language Configuration
 * Supports 15 languages for global auto parts marketplace
 * 
 * Languages ordered by market importance for auto parts industry:
 * - English (en) - Global default
 * - German (de) - Major auto manufacturing hub (BMW, Mercedes, VW, Audi)
 * - French (fr) - Major European market
 * - Spanish (es) - Spain & Latin America market
 * - Italian (it) - Major auto market (Ferrari, Fiat, Alfa Romeo)
 * - Portuguese (pt) - Brazil & Portugal markets
 * - Russian (ru) - CIS region market
 * - Ukrainian (ua) - Eastern European market
 * - Polish (pl) - Central European market
 * - Dutch (nl) - Benelux region
 * - Turkish (tr) - Major Middle East market
 * - Chinese (zh) - Asian market
 * - Japanese (ja) - Japanese auto parts (Toyota, Honda, Nissan)
 * - Korean (ko) - Korean auto parts (Hyundai, Kia)
 * - Arabic (ar) - Middle East & North Africa (RTL support)
 */

// Language configuration with metadata
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'ua', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', dir: 'ltr' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', dir: 'ltr' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', dir: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' }
];

// Extract language codes for i18next config
const languageCodes = SUPPORTED_LANGUAGES.map(lang => lang.code);

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Fallback language
    fallbackLng: 'en',
    
    // Supported languages (all 15 languages)
    supportedLngs: languageCodes,
    
    // Preload primary languages for faster performance
    preload: languageCodes,
    
    // Backend configuration
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/translation.json'),
    },
    
    // Language detection
    detection: {
      order: ['cookie', 'querystring', 'header'],
      caches: ['cookie'],
      lookupCookie: 'i18next',
      lookupQuerystring: 'lng',
      cookieOptions: { 
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: false,
        sameSite: 'lax'
      }
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false, // Not needed for server-side
    },
    
    // Return empty string for missing keys
    returnEmptyString: false,
    returnNull: false,
  });

// Export helper functions for language management
module.exports = i18next;

// Export language configuration for use in views
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

// Helper to get language metadata
module.exports.getLanguageInfo = (code) => {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code) || SUPPORTED_LANGUAGES[0];
};

// Helper to check if language is RTL
module.exports.isRTL = (code) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.dir === 'rtl' : false;
};

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Fallback language
    fallbackLng: 'en',
    
    // Supported languages
    supportedLngs: ['en', 'ar', 'ru', 'ua', 'fr', 'es'],
    
    // Preload all languages
    preload: ['en', 'ar', 'ru', 'ua', 'fr', 'es'],
    
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

module.exports = i18next;

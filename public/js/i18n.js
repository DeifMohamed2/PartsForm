// ====================================
// i18n Language Switcher
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  const languageBtn = document.getElementById('language-btn');
  const languageDropdown = document.getElementById('language-dropdown');
  const langOptions = document.querySelectorAll('.lang-option');
  const currentFlag = document.getElementById('current-flag');
  const currentLang = document.getElementById('current-lang');

  // Get current language from cookie or default to 'en'
  const getCurrentLanguage = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'i18next') {
        return value;
      }
    }
    return 'en';
  };

  // Set current language display
  const setCurrentLanguageDisplay = () => {
    const lang = getCurrentLanguage();
    const langOption = document.querySelector(`.lang-option[data-lang="${lang}"]`);
    
    if (langOption) {
      const flag = langOption.dataset.flag;
      const code = lang.toUpperCase();
      
      currentFlag.textContent = flag;
      currentLang.textContent = code;
    }
  };

  // Initialize current language display
  setCurrentLanguageDisplay();

  // Toggle language dropdown
  if (languageBtn) {
    languageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      languageDropdown.classList.toggle('active');
    });
  }

  // Handle language selection
  langOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const selectedLang = option.dataset.lang;
      
      // Set cookie
      document.cookie = `i18next=${selectedLang}; path=/; max-age=31536000; SameSite=Lax`;
      
      // Reload page to apply new language
      window.location.reload();
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.language-selector')) {
      languageDropdown.classList.remove('active');
    }
  });
});

// Helper function to change language programmatically
function changeLanguage(lang) {
  document.cookie = `i18next=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { changeLanguage };
}

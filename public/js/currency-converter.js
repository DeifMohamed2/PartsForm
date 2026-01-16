// ====================================
// CURRENCY CONVERTER - PROFESSIONAL IMPLEMENTATION
// Real-time exchange rates with ExchangeRate-API
// ====================================
(function () {
  'use strict';

  // Configuration
  const CONFIG = {
    API_URL: 'https://api.exchangerate-api.com/v4/latest/',
    UPDATE_INTERVAL: 300000, // 5 minutes
    CACHE_DURATION: 300000, // 5 minutes
    DEFAULT_BASE_CURRENCY: 'USD',
    DEFAULT_TARGET_CURRENCY: 'EUR'
  };

  // Currency data with flags
  const CURRENCIES = {
    USD: { name: 'US Dollar', flag: '🇺🇸', symbol: '$' },
    EUR: { name: 'Euro', flag: '🇪🇺', symbol: '€' },
    GBP: { name: 'British Pound', flag: '🇬🇧', symbol: '£' },
    AED: { name: 'UAE Dirham', flag: '🇦🇪', symbol: 'د.إ' },
    JPY: { name: 'Japanese Yen', flag: '🇯🇵', symbol: '¥' },
    CNY: { name: 'Chinese Yuan', flag: '🇨🇳', symbol: '¥' },
    RUB: { name: 'Russian Ruble', flag: '🇷🇺', symbol: '₽' },
    CAD: { name: 'Canadian Dollar', flag: '🇨🇦', symbol: 'C$' },
    AUD: { name: 'Australian Dollar', flag: '🇦🇺', symbol: 'A$' },
    CHF: { name: 'Swiss Franc', flag: '🇨🇭', symbol: 'Fr' },
    INR: { name: 'Indian Rupee', flag: '🇮🇳', symbol: '₹' },
    KRW: { name: 'South Korean Won', flag: '🇰🇷', symbol: '₩' },
    SGD: { name: 'Singapore Dollar', flag: '🇸🇬', symbol: 'S$' },
    HKD: { name: 'Hong Kong Dollar', flag: '🇭🇰', symbol: 'HK$' },
    NOK: { name: 'Norwegian Krone', flag: '🇳🇴', symbol: 'kr' },
    SEK: { name: 'Swedish Krona', flag: '🇸🇪', symbol: 'kr' },
    DKK: { name: 'Danish Krone', flag: '🇩🇰', symbol: 'kr' },
    PLN: { name: 'Polish Złoty', flag: '🇵🇱', symbol: 'zł' },
    THB: { name: 'Thai Baht', flag: '🇹🇭', symbol: '฿' },
    MYR: { name: 'Malaysian Ringgit', flag: '🇲🇾', symbol: 'RM' },
    MXN: { name: 'Mexican Peso', flag: '🇲🇽', symbol: '$' },
    BRL: { name: 'Brazilian Real', flag: '🇧🇷', symbol: 'R$' },
    ZAR: { name: 'South African Rand', flag: '🇿🇦', symbol: 'R' },
    TRY: { name: 'Turkish Lira', flag: '🇹🇷', symbol: '₺' },
    SAR: { name: 'Saudi Riyal', flag: '🇸🇦', symbol: '﷼' },
    QAR: { name: 'Qatari Riyal', flag: '🇶🇦', symbol: '﷼' },
    KWD: { name: 'Kuwaiti Dinar', flag: '🇰🇼', symbol: 'د.ك' },
    OMR: { name: 'Omani Rial', flag: '🇴🇲', symbol: '﷼' },
    BHD: { name: 'Bahraini Dinar', flag: '🇧🇭', symbol: 'د.ب' },
    EGP: { name: 'Egyptian Pound', flag: '🇪🇬', symbol: '£' },
    PKR: { name: 'Pakistani Rupee', flag: '🇵🇰', symbol: '₨' },
    PHP: { name: 'Philippine Peso', flag: '🇵🇭', symbol: '₱' },
    IDR: { name: 'Indonesian Rupiah', flag: '🇮🇩', symbol: 'Rp' },
    VND: { name: 'Vietnamese Dong', flag: '🇻🇳', symbol: '₫' },
    NZD: { name: 'New Zealand Dollar', flag: '🇳🇿', symbol: 'NZ$' },
    CZK: { name: 'Czech Koruna', flag: '🇨🇿', symbol: 'Kč' },
    HUF: { name: 'Hungarian Forint', flag: '🇭🇺', symbol: 'Ft' },
    RON: { name: 'Romanian Leu', flag: '🇷🇴', symbol: 'lei' },
    BGN: { name: 'Bulgarian Lev', flag: '🇧🇬', symbol: 'лв' },
    HRK: { name: 'Croatian Kuna', flag: '🇭🇷', symbol: 'kn' },
    UAH: { name: 'Ukrainian Hryvnia', flag: '🇺🇦', symbol: '₴' }
  };

  // State
  let state = {
    exchangeRates: null,
    baseCurrency: CONFIG.DEFAULT_BASE_CURRENCY,
    targetCurrency: CONFIG.DEFAULT_TARGET_CURRENCY,
    lastUpdate: null,
    isLoading: false,
    currentSelector: null // 'from' or 'to'
  };

  // DOM Elements
  let elements = {};

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', initCurrencyConverter);

  // ====================================
  // INITIALIZATION
  // ====================================
  function initCurrencyConverter() {
    cacheElements();
    
    if (!elements.converterBtn) {
      console.warn('Currency converter button not found');
      return;
    }

    loadSavedPreferences();
    initEventListeners();
    fetchExchangeRates();
    
    // Auto-update rates
    setInterval(fetchExchangeRates, CONFIG.UPDATE_INTERVAL);
    
    // Initialize Lucide icons after modal is added to DOM
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // CACHE DOM ELEMENTS
  // ====================================
  function cacheElements() {
    elements = {
      // Trigger button
      converterBtn: document.getElementById('currency-converter-btn'),
      currentCurrencyCode: document.getElementById('current-currency-code'),
      
      // Modal
      modal: document.getElementById('currencyConverterModal'),
      backdrop: document.getElementById('currencyConverterBackdrop'),
      closeBtn: document.getElementById('currencyConverterClose'),
      
      // Input fields
      amountInput: document.getElementById('currencyAmount'),
      resultInput: document.getElementById('currencyResult'),
      
      // Currency selectors
      fromCurrencyBtn: document.getElementById('fromCurrencyBtn'),
      fromCurrencyFlag: document.getElementById('fromCurrencyFlag'),
      fromCurrencyCode: document.getElementById('fromCurrencyCode'),
      
      toCurrencyBtn: document.getElementById('toCurrencyBtn'),
      toCurrencyFlag: document.getElementById('toCurrencyFlag'),
      toCurrencyCode: document.getElementById('toCurrencyCode'),
      
      // Swap button
      swapBtn: document.getElementById('currencySwapBtn'),
      
      // Exchange rate info
      rateText: document.getElementById('rateText'),
      rateUpdated: document.getElementById('rateUpdated'),
      
      // Popular currencies
      popularCurrencyBtns: document.querySelectorAll('.popular-currency-btn'),
      
      // All currencies dropdown
      allCurrenciesDropdown: document.getElementById('allCurrenciesDropdown'),
      currencySearchInput: document.getElementById('currencySearchInput'),
      currencyList: document.getElementById('currencyList')
    };
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function initEventListeners() {
    // Open modal
    elements.converterBtn.addEventListener('click', openModal);
    
    // Close modal
    elements.closeBtn.addEventListener('click', closeModal);
    elements.backdrop.addEventListener('click', closeModal);
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.modal.classList.contains('active')) {
        closeModal();
      }
    });
    
    // Amount input
    elements.amountInput.addEventListener('input', debounce(convertCurrency, 300));
    
    // Currency selector buttons
    elements.fromCurrencyBtn.addEventListener('click', () => openCurrencySelector('from'));
    elements.toCurrencyBtn.addEventListener('click', () => openCurrencySelector('to'));
    
    // Swap currencies
    elements.swapBtn.addEventListener('click', swapCurrencies);
    
    // Popular currency buttons
    elements.popularCurrencyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const currency = btn.getAttribute('data-currency');
        selectTargetCurrency(currency);
      });
    });
    
    // Currency search
    if (elements.currencySearchInput) {
      elements.currencySearchInput.addEventListener('input', debounce(filterCurrencies, 200));
    }
  }

  // ====================================
  // MODAL CONTROLS
  // ====================================
  function openModal() {
    elements.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Initialize icons if not already done
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    // Fetch rates if needed
    if (!state.exchangeRates || isRatesCacheExpired()) {
      fetchExchangeRates();
    } else {
      convertCurrency();
    }
  }

  function closeModal() {
    elements.modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Hide currency dropdown if open
    if (elements.allCurrenciesDropdown) {
      elements.allCurrenciesDropdown.style.display = 'none';
    }
  }

  // ====================================
  // EXCHANGE RATE FETCHING
  // ====================================
  async function fetchExchangeRates() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    
    try {
      const response = await fetch(`${CONFIG.API_URL}${state.baseCurrency}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      
      const data = await response.json();
      
      state.exchangeRates = data.rates;
      state.lastUpdate = new Date();
      
      // Cache in localStorage
      localStorage.setItem('exchangeRates', JSON.stringify({
        rates: data.rates,
        timestamp: state.lastUpdate.getTime()
      }));
      
      updateRateDisplay();
      convertCurrency();
      
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      
      // Try to load from cache
      const cached = localStorage.getItem('exchangeRates');
      if (cached) {
        const data = JSON.parse(cached);
        state.exchangeRates = data.rates;
        state.lastUpdate = new Date(data.timestamp);
        updateRateDisplay();
        convertCurrency();
      } else {
        showError('Unable to fetch exchange rates. Please try again later.');
      }
    } finally {
      state.isLoading = false;
    }
  }

  // ====================================
  // CURRENCY CONVERSION
  // ====================================
  function convertCurrency() {
    if (!state.exchangeRates) {
      elements.resultInput.value = '0.00';
      return;
    }
    
    const amount = parseFloat(elements.amountInput.value) || 0;
    
    if (amount === 0) {
      elements.resultInput.value = '0.00';
      updateRateDisplay();
      return;
    }
    
    // Convert from base to target
    let rate;
    if (state.baseCurrency === state.targetCurrency) {
      rate = 1;
    } else if (state.baseCurrency === CONFIG.DEFAULT_BASE_CURRENCY) {
      rate = state.exchangeRates[state.targetCurrency];
    } else {
      // Convert from non-USD base
      const baseToUSD = 1 / state.exchangeRates[state.baseCurrency];
      const usdToTarget = state.exchangeRates[state.targetCurrency];
      rate = baseToUSD * usdToTarget;
    }
    
    const result = amount * rate;
    elements.resultInput.value = formatCurrency(result);
    
    updateRateDisplay(rate);
  }

  // ====================================
  // CURRENCY SELECTION
  // ====================================
  function openCurrencySelector(type) {
    state.currentSelector = type;
    
    // Populate currency list
    populateCurrencyList();
    
    // Show dropdown
    elements.allCurrenciesDropdown.style.display = 'block';
    
    // Focus search input
    if (elements.currencySearchInput) {
      elements.currencySearchInput.value = '';
      elements.currencySearchInput.focus();
    }
  }

  function populateCurrencyList(filterText = '') {
    const list = elements.currencyList;
    list.innerHTML = '';
    
    const currencies = Object.entries(CURRENCIES)
      .filter(([code, data]) => {
        if (!filterText) return true;
        const search = filterText.toLowerCase();
        return (
          code.toLowerCase().includes(search) ||
          data.name.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    currencies.forEach(([code, data]) => {
      const btn = document.createElement('button');
      btn.className = 'currency-list-item';
      btn.setAttribute('data-currency', code);
      btn.innerHTML = `
        <span class="currency-flag">${data.flag}</span>
        <span class="currency-info">
          <span class="currency-name">${code}</span>
          <span class="currency-full">${data.name}</span>
        </span>
      `;
      
      btn.addEventListener('click', () => {
        selectCurrency(code, state.currentSelector);
        elements.allCurrenciesDropdown.style.display = 'none';
      });
      
      list.appendChild(btn);
    });
    
    // Show "no results" if empty
    if (currencies.length === 0) {
      list.innerHTML = '<div class="no-currency-results">No currencies found</div>';
    }
  }

  function filterCurrencies() {
    const filterText = elements.currencySearchInput.value;
    populateCurrencyList(filterText);
  }

  function selectCurrency(currency, type) {
    const currencyData = CURRENCIES[currency];
    
    if (type === 'from') {
      state.baseCurrency = currency;
      elements.fromCurrencyFlag.textContent = currencyData.flag;
      elements.fromCurrencyCode.textContent = currency;
      
      // Update navbar button
      elements.currentCurrencyCode.textContent = currency;
    } else {
      state.targetCurrency = currency;
      elements.toCurrencyFlag.textContent = currencyData.flag;
      elements.toCurrencyCode.textContent = currency;
    }
    
    // Save preference
    savePreferences();
    
    // Fetch new rates if base currency changed
    if (type === 'from') {
      fetchExchangeRates();
    } else {
      convertCurrency();
    }
  }

  function selectTargetCurrency(currency) {
    selectCurrency(currency, 'to');
  }

  function swapCurrencies() {
    // Swap state
    const temp = state.baseCurrency;
    state.baseCurrency = state.targetCurrency;
    state.targetCurrency = temp;
    
    // Update UI
    const tempFlag = elements.fromCurrencyFlag.textContent;
    const tempCode = elements.fromCurrencyCode.textContent;
    
    elements.fromCurrencyFlag.textContent = elements.toCurrencyFlag.textContent;
    elements.fromCurrencyCode.textContent = elements.toCurrencyCode.textContent;
    
    elements.toCurrencyFlag.textContent = tempFlag;
    elements.toCurrencyCode.textContent = tempCode;
    
    // Update navbar button
    elements.currentCurrencyCode.textContent = state.baseCurrency;
    
    // Add animation
    elements.swapBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      elements.swapBtn.style.transform = 'rotate(0deg)';
    }, 300);
    
    // Save preference
    savePreferences();
    
    // Fetch new rates and convert
    fetchExchangeRates();
  }

  // ====================================
  // UI UPDATES
  // ====================================
  function updateRateDisplay(customRate = null) {
    if (!state.exchangeRates) return;
    
    let rate;
    if (customRate !== null) {
      rate = customRate;
    } else if (state.baseCurrency === state.targetCurrency) {
      rate = 1;
    } else if (state.baseCurrency === CONFIG.DEFAULT_BASE_CURRENCY) {
      rate = state.exchangeRates[state.targetCurrency];
    } else {
      const baseToUSD = 1 / state.exchangeRates[state.baseCurrency];
      const usdToTarget = state.exchangeRates[state.targetCurrency];
      rate = baseToUSD * usdToTarget;
    }
    
    elements.rateText.textContent = `1 ${state.baseCurrency} = ${formatCurrency(rate, 4)} ${state.targetCurrency}`;
    
    if (state.lastUpdate) {
      const minutes = Math.floor((new Date() - state.lastUpdate) / 60000);
      if (minutes === 0) {
        elements.rateUpdated.textContent = 'Just updated';
      } else if (minutes === 1) {
        elements.rateUpdated.textContent = 'Updated 1 minute ago';
      } else {
        elements.rateUpdated.textContent = `Updated ${minutes} minutes ago`;
      }
    }
  }

  // ====================================
  // STORAGE
  // ====================================
  function savePreferences() {
    localStorage.setItem('preferredBaseCurrency', state.baseCurrency);
    localStorage.setItem('preferredTargetCurrency', state.targetCurrency);
  }

  function loadSavedPreferences() {
    const savedBase = localStorage.getItem('preferredBaseCurrency');
    const savedTarget = localStorage.getItem('preferredTargetCurrency');
    
    if (savedBase && CURRENCIES[savedBase]) {
      state.baseCurrency = savedBase;
      elements.fromCurrencyFlag.textContent = CURRENCIES[savedBase].flag;
      elements.fromCurrencyCode.textContent = savedBase;
      elements.currentCurrencyCode.textContent = savedBase;
    }
    
    if (savedTarget && CURRENCIES[savedTarget]) {
      state.targetCurrency = savedTarget;
      elements.toCurrencyFlag.textContent = CURRENCIES[savedTarget].flag;
      elements.toCurrencyCode.textContent = savedTarget;
    }
    
    // Try to load cached rates
    const cached = localStorage.getItem('exchangeRates');
    if (cached) {
      const data = JSON.parse(cached);
      if (!isRatesCacheExpired(data.timestamp)) {
        state.exchangeRates = data.rates;
        state.lastUpdate = new Date(data.timestamp);
      }
    }
  }

  function isRatesCacheExpired(timestamp = null) {
    if (!timestamp && !state.lastUpdate) return true;
    const compareTime = timestamp || state.lastUpdate.getTime();
    return (new Date().getTime() - compareTime) > CONFIG.CACHE_DURATION;
  }

  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  function formatCurrency(value, decimals = 2) {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function showError(message) {
    // You can implement a toast notification here
    console.error(message);
    alert(message);
  }

  // ====================================
  // GLOBAL CURRENCY CONVERSION HELPER
  // Expose this function for use in other parts of the application
  // ====================================
  window.convertPrice = function(amount, fromCurrency, toCurrency) {
    if (!state.exchangeRates) return amount;
    
    if (fromCurrency === toCurrency) return amount;
    
    let rate;
    if (fromCurrency === CONFIG.DEFAULT_BASE_CURRENCY) {
      rate = state.exchangeRates[toCurrency];
    } else {
      const fromToUSD = 1 / state.exchangeRates[fromCurrency];
      const usdToTarget = state.exchangeRates[toCurrency];
      rate = fromToUSD * usdToTarget;
    }
    
    return amount * rate;
  };

  window.getCurrentCurrency = function() {
    return state.baseCurrency;
  };

})();

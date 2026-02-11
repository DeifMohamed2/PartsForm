// ====================================
// AI SMART FILTER - PROFESSIONAL AIUX FUNCTIONALITY
// Premium Filter Experience with Gemini AI Integration
// ====================================

(function () {
  'use strict';

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const AIFilterState = {
    isOpen: false,
    activeTab: 'pricing',
    isLoading: false,
    lastSearchResults: [],
    filters: {
      // Pricing
      priceMin: 0,
      priceMax: 100000,
      discount: [],
      paymentTerms: [],

      // Product
      brandType: [],
      brands: ['all'],
      condition: 'all',
      weightMin: 0,
      weightMax: 1000,
      stockStatus: 'all',

      // Supplier
      origins: [],
      supplierRating: 5,
      certifications: [],
      verifiedOnly: true,

      // Logistics
      deliveryTime: 'any',
      shippingTo: '',
      minOrderQty: 1,
      freeShipping: false,
      returnPolicy: [],

      // Automotive
      vehicleMake: '',
      vehicleModel: '',
      yearMin: null,
      yearMax: null,
      partCategories: [],
      engineType: 'all',
    },
    aiQuery: '',
    aiParsedFilters: [],
    aiParsedResponse: null,
    activeFilterCount: 0,
  };

  // ====================================
  // DOM ELEMENTS
  // ====================================
  const elements = {
    modal: null,
    backdrop: null,
    closeBtn: null,
    triggerBtn: null,
    aiInput: null,
    aiSubmitBtn: null,
    aiResponseSection: null,
    aiThinking: null,
    aiResponseTitle: null,
    aiFiltersPreview: null,
    aiFiltersGrid: null,
    filterTabs: null,
    filterPanels: null,
    collapseBtn: null,
    manualFiltersContent: null,
    clearAllBtn: null,
    applyBtn: null,
    activeFilterCount: null,
    resultsPreview: null,
    hintChips: null,
  };

  // ====================================
  // VEHICLE DATA
  // ====================================
  const vehicleModels = {
    toyota: [
      'Camry',
      'Corolla',
      'RAV4',
      'Highlander',
      'Land Cruiser',
      'Prado',
      'Fortuner',
      'Hilux',
      'Yaris',
      'Prius',
    ],
    honda: [
      'Civic',
      'Accord',
      'CR-V',
      'HR-V',
      'Pilot',
      'Odyssey',
      'City',
      'Jazz',
    ],
    nissan: [
      'Altima',
      'Maxima',
      'Sentra',
      'Patrol',
      'X-Trail',
      'Pathfinder',
      'Navara',
      'Sunny',
    ],
    bmw: [
      '3 Series',
      '5 Series',
      '7 Series',
      'X1',
      'X3',
      'X5',
      'X7',
      'M3',
      'M5',
    ],
    mercedes: [
      'A-Class',
      'C-Class',
      'E-Class',
      'S-Class',
      'GLA',
      'GLC',
      'GLE',
      'GLS',
      'G-Class',
    ],
    audi: ['A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS6'],
    volkswagen: [
      'Golf',
      'Passat',
      'Tiguan',
      'Touareg',
      'Polo',
      'Jetta',
      'ID.4',
    ],
    ford: [
      'Mustang',
      'F-150',
      'Explorer',
      'Escape',
      'Bronco',
      'Edge',
      'Expedition',
    ],
    chevrolet: [
      'Camaro',
      'Corvette',
      'Silverado',
      'Tahoe',
      'Suburban',
      'Traverse',
      'Equinox',
    ],
    hyundai: [
      'Elantra',
      'Sonata',
      'Tucson',
      'Santa Fe',
      'Palisade',
      'Kona',
      'Accent',
    ],
    kia: [
      'Forte',
      'K5',
      'Sportage',
      'Sorento',
      'Telluride',
      'Seltos',
      'Carnival',
    ],
    lexus: ['ES', 'IS', 'LS', 'RX', 'NX', 'GX', 'LX', 'LC'],
    porsche: [
      '911',
      'Cayenne',
      'Macan',
      'Panamera',
      'Taycan',
      'Boxster',
      'Cayman',
    ],
    'land-rover': [
      'Range Rover',
      'Range Rover Sport',
      'Discovery',
      'Defender',
      'Velar',
      'Evoque',
    ],
    jeep: [
      'Wrangler',
      'Grand Cherokee',
      'Cherokee',
      'Compass',
      'Renegade',
      'Gladiator',
    ],
  };

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    cacheElements();
    setupEventListeners();
    initializeRangeSliders();
    updateFilterCount();
    console.log('AI Filters initialized');
  }

  function cacheElements() {
    elements.modal = document.getElementById('ai-filter-modal');
    elements.backdrop = document.getElementById('ai-filter-backdrop');
    elements.closeBtn = document.getElementById('ai-filter-close');
    elements.triggerBtn = document.getElementById('ai-filter-trigger');
    elements.aiInput = document.getElementById('ai-filter-input');
    elements.aiSubmitBtn = document.getElementById('ai-submit-btn');
    elements.aiResponseSection = document.getElementById('ai-response-section');
    elements.aiThinking = document.getElementById('ai-thinking');
    elements.aiResponseTitle = document.getElementById('ai-response-title');
    elements.aiFiltersPreview = document.getElementById('ai-filters-preview');
    elements.aiFiltersGrid = document.getElementById('ai-filters-grid');
    elements.collapseBtn = document.getElementById('collapse-manual-filters');
    elements.manualFiltersContent = document.getElementById(
      'manual-filters-content',
    );
    elements.clearAllBtn = document.getElementById('ai-clear-all');
    elements.applyBtn = document.getElementById('ai-apply-filters');
    elements.activeFilterCount = document.getElementById('active-filter-count');
    elements.resultsPreview = document.getElementById('results-preview');
    elements.hintChips = document.querySelectorAll('.ai-hint-chip');
    elements.filterTabs = document.querySelectorAll('.filter-tab');
    elements.filterPanels = document.querySelectorAll('.filter-panel');
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function setupEventListeners() {
    // Modal controls
    elements.triggerBtn?.addEventListener('click', openModal);
    elements.closeBtn?.addEventListener('click', closeModal);
    elements.backdrop?.addEventListener('click', closeModal);

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && AIFilterState.isOpen) {
        closeModal();
      }
    });

    // AI Input
    elements.aiSubmitBtn?.addEventListener('click', handleAISubmit);
    elements.aiInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAISubmit();
      }
    });

    // AI Hint chips
    elements.hintChips?.forEach((chip) => {
      chip.addEventListener('click', () => {
        const hint = chip.dataset.hint;
        if (elements.aiInput) {
          elements.aiInput.value = hint;
          elements.aiInput.focus();
        }
      });
    });

    // Filter tabs
    elements.filterTabs?.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Collapse toggle
    elements.collapseBtn?.addEventListener('click', toggleManualFilters);

    // Clear all
    elements.clearAllBtn?.addEventListener('click', clearAllFilters);

    // Apply filters
    elements.applyBtn?.addEventListener('click', applyFilters);

    // Brand chips
    document.querySelectorAll('.brand-chip').forEach((chip) => {
      chip.addEventListener('click', () => toggleBrandChip(chip));
    });

    // Stock toggles
    document.querySelectorAll('.stock-toggle').forEach((toggle) => {
      toggle.addEventListener('click', () => toggleStockFilter(toggle));
    });

    // Rating buttons
    document.querySelectorAll('.rating-btn').forEach((btn) => {
      btn.addEventListener('click', () => selectRating(btn));
    });

    // Part category buttons
    document.querySelectorAll('.part-category-btn').forEach((btn) => {
      btn.addEventListener('click', () => togglePartCategory(btn));
    });

    // Vehicle make change
    const vehicleMakeSelect = document.getElementById('vehicle-make');
    vehicleMakeSelect?.addEventListener('change', handleVehicleMakeChange);

    // Price range inputs
    const priceMinInput = document.getElementById('price-min-input');
    const priceMaxInput = document.getElementById('price-max-input');
    priceMinInput?.addEventListener('input', updatePriceRange);
    priceMaxInput?.addEventListener('input', updatePriceRange);

    // All filter inputs - update count on change
    document
      .querySelectorAll('#ai-filter-modal input, #ai-filter-modal select')
      .forEach((input) => {
        input.addEventListener('change', updateFilterCount);
      });

    // Brand search
    const brandSearch = document.getElementById('brand-search');
    brandSearch?.addEventListener('input', handleBrandSearch);
  }

  // ====================================
  // MODAL CONTROLS
  // ====================================
  function openModal() {
    // Check if user is logged in
    if (
      typeof window.BuyerAuth !== 'undefined' &&
      !window.BuyerAuth.isLoggedIn()
    ) {
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      }
      return;
    }

    AIFilterState.isOpen = true;
    elements.modal?.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Focus AI input
    setTimeout(() => {
      elements.aiInput?.focus();
    }, 300);

    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function closeModal() {
    AIFilterState.isOpen = false;
    elements.modal?.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ====================================
  // TAB SWITCHING
  // ====================================
  function switchTab(tabId) {
    AIFilterState.activeTab = tabId;

    // Update tab buttons
    elements.filterTabs?.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update panels
    elements.filterPanels?.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    // Reinitialize icons for the new panel
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // AI PROCESSING - GEMINI INTEGRATION
  // ====================================
  let currentAbortController = null;
  let isSearchInProgress = false;
  let lastSearchQuery = '';
  const SEARCH_TIMEOUT = 20000; // 20 second timeout
  const DEBOUNCE_DELAY = 300; // 300ms debounce
  let searchDebounceTimer = null;

  async function handleAISubmit() {
    const query = elements.aiInput?.value.trim();
    if (!query) {
      showAIMessage('Please enter a search query', 'info');
      return;
    }

    // Prevent duplicate requests for same query
    if (
      isSearchInProgress &&
      query.toLowerCase() === lastSearchQuery.toLowerCase()
    ) {
      showAIMessage('Search in progress, please wait...', 'info');
      return;
    }

    // Cancel any pending request
    if (currentAbortController) {
      currentAbortController.abort();
    }

    // Clear any pending debounce
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Create new abort controller for this request
    currentAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
    }, SEARCH_TIMEOUT);

    isSearchInProgress = true;
    lastSearchQuery = query;
    AIFilterState.aiQuery = query;
    AIFilterState.isLoading = true;

    // Disable submit button during search
    if (elements.aiSubmitBtn) {
      elements.aiSubmitBtn.disabled = true;
      elements.aiSubmitBtn.innerHTML =
        '<i data-lucide="loader-2" class="spin"></i>';
    }

    // Show response section with thinking state
    if (elements.aiResponseSection) {
      elements.aiResponseSection.style.display = 'block';
    }
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'flex';
      const thinkingText = elements.aiThinking.querySelector('.thinking-text');
      if (thinkingText) {
        thinkingText.textContent = 'Analyzing your request...';
        // Update thinking text periodically
        const thinkingMessages = [
          'Analyzing your request...',
          'Understanding search criteria...',
          'Finding matching parts...',
          'Filtering results...',
        ];
        let msgIndex = 0;
        const thinkingInterval = setInterval(() => {
          if (!isSearchInProgress) {
            clearInterval(thinkingInterval);
            return;
          }
          msgIndex = (msgIndex + 1) % thinkingMessages.length;
          thinkingText.textContent = thinkingMessages[msgIndex];
        }, 2000);
      }
    }
    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'none';
    }
    if (elements.aiFiltersPreview) {
      elements.aiFiltersPreview.style.display = 'none';
    }

    try {
      // Call the Gemini-powered AI search endpoint with timeout
      const response = await fetch('/buyer/api/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: currentAbortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'AI search failed');
      }

      console.log('AI Search Response:', data);

      // 🧠 Record search for AI learning
      if (window.aiLearning && data.learning?.recordId) {
        window.aiLearning.recordSearch(
          query,
          data.total || 0,
          data.learning.recordId,
        );

        // If there are learning suggestions (for failed searches), show them
        if (data.learning.suggestions && data.learning.suggestions.length > 0) {
          console.log('🧠 AI suggests trying:', data.learning.suggestions);
        }
      }

      // Store the results and parsed data
      AIFilterState.lastSearchResults = data.results || [];
      AIFilterState.aiParsedResponse = data.parsed || {};
      AIFilterState.learningRecordId = data.learning?.recordId;
      AIFilterState.learningSuggestions = data.learning?.suggestions || [];
      AIFilterState.aiInsights = data.aiInsights || [];

      // Store broad search info if available
      AIFilterState.isBroadSearch = data.isBroadSearch || false;
      AIFilterState.broadSearchMessage = data.message || '';
      AIFilterState.availableBrands = data.availableBrands || [];
      AIFilterState.samplePartNumbers = data.samplePartNumbers || [];

      // Convert parsed filters to display format
      const displayFilters = convertParsedToDisplayFilters(data.parsed);

      // Display the results (even if empty, to show filters applied)
      displayAIResults(displayFilters, data.results || [], data.parsed);
    } catch (error) {
      // Check if this was an abort (user cancelled or timeout)
      if (error.name === 'AbortError') {
        console.log('AI Search cancelled or timed out');
        showAIError('timeout');
      } else if (error.message && error.message.includes('429')) {
        console.log('AI service rate limited');
        showAIError('rate-limited');
      } else {
        console.error('AI Search error:', error);
        showAIError('general');
      }

      // Fallback to local parsing and still show results section
      const fallbackFilters = parseAIQuery(query);
      AIFilterState.aiParsedResponse = {
        intent: `Searching for: "${query}"`,
        filters: {},
        suggestions: [
          'Try being more specific',
          'Include brand names or part numbers',
        ],
      };

      // Display with empty results - user can still apply filters
      displayAIResults(fallbackFilters, [], AIFilterState.aiParsedResponse);
    } finally {
      AIFilterState.isLoading = false;
      isSearchInProgress = false;
      currentAbortController = null;

      // Re-enable submit button (icon only for cleaner UI)
      if (elements.aiSubmitBtn) {
        elements.aiSubmitBtn.disabled = false;
        elements.aiSubmitBtn.innerHTML = '<i data-lucide="search"></i>';
      }

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  /**
   * Show AI error message with professional styling
   */
  function showAIError(type) {
    // Hide thinking indicator
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'none';
    }

    const messages = {
      timeout: {
        title: 'Search took too long',
        subtitle: 'Try a more specific query or use filters below.',
        icon: 'clock',
      },
      'rate-limited': {
        title: 'High demand right now',
        subtitle: 'Using quick search mode. Results may be less refined.',
        icon: 'zap',
      },
      general: {
        title: 'Switching to quick search',
        subtitle: "We'll find parts using standard search.",
        icon: 'search',
      },
    };

    const msg = messages[type] || messages['general'];

    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'flex';
      const titleSpan = elements.aiResponseTitle.querySelector('span');
      if (titleSpan) titleSpan.textContent = msg.title;
      const icon = elements.aiResponseTitle.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', msg.icon);
    }
  }

  /**
   * Show AI informational message
   */
  function showAIMessage(message, type = 'info') {
    if (elements.aiResponseSection) {
      elements.aiResponseSection.style.display = 'block';
    }
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'none';
    }
    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'flex';
      const titleSpan = elements.aiResponseTitle.querySelector('span');
      if (titleSpan) titleSpan.textContent = message;
      const icon = elements.aiResponseTitle.querySelector('i');
      if (icon)
        icon.setAttribute(
          'data-lucide',
          type === 'info' ? 'info' : 'alert-circle',
        );
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /**
   * Convert parsed AI response to display filter cards
   * Uses the new flat parsedIntent format from the backend
   * Falls back to parsed.filters for backward compatibility
   */
  function convertParsedToDisplayFilters(parsed) {
    const filters = [];

    if (!parsed) return filters;

    // Use parsedIntent (new flat format) or fall back to filters (old format)
    const pi = parsed.parsedIntent || parsed.understood || {};
    const f = parsed.filters || {};

    // Merge: prefer parsedIntent values over filters
    const merged = {
      vehicleBrand: pi.vehicleBrand || f.vehicleBrand || null,
      brand: pi.partsBrands || f.brand || [],
      exclude: pi.exclusions || f.exclude || null,
      requestedQuantity: pi.requestedQuantity || f.requestedQuantity || null,
      supplierOrigin: pi.supplierOrigin || f.supplierOrigin || null,
      minPrice: pi.minPrice != null ? pi.minPrice : (f.minPrice != null ? f.minPrice : null),
      maxPrice: pi.maxPrice != null ? pi.maxPrice : (f.maxPrice != null ? f.maxPrice : null),
      priceCurrency: pi.priceCurrency || f.priceCurrency || 'USD',
      inStock: pi.requireInStock || f.inStock || false,
      requireHighStock: pi.requireHighStock || false,
      category: (pi.categories && pi.categories[0]) || f.category || null,
      deliveryDays: pi.maxDeliveryDays || f.deliveryDays,
      supplier: f.supplier || null,
      certifiedOnly: pi.certifiedOnly || f.certifiedOnly || false,
      sortBy: pi.sortBy || f.sortBy || null,
    };

    // Use merged values from here
    const fv = merged;

    // ═══════════════════════════════════════════════════════════════
    // VEHICLE BRAND FILTER (compatibility - "Toyota brake pads")
    // ═══════════════════════════════════════════════════════════════
    if (fv.vehicleBrand) {
      filters.push({
        type: 'vehicle',
        icon: 'car',
        label: 'Vehicle',
        value: String(fv.vehicleBrand).toUpperCase(),
        filterKey: 'vehicleBrand',
        filterValue: fv.vehicleBrand,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTS BRAND FILTER (manufacturer like BOSCH, SKF)
    // ═══════════════════════════════════════════════════════════════
    if (fv.brand && fv.brand.length > 0) {
      fv.brand.forEach((brand) => {
        filters.push({
          type: 'brand',
          icon: 'award',
          label: 'Brand',
          value: String(brand).toUpperCase(),
          filterKey: 'brands',
          filterValue: String(brand).toLowerCase(),
        });
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // EXCLUSION FILTERS ("not BOSCH", "exclude Chinese")
    // ═══════════════════════════════════════════════════════════════
    if (fv.exclude) {
      // Excluded brands
      if (fv.exclude.brands && fv.exclude.brands.length > 0) {
        fv.exclude.brands.forEach((brand) => {
          filters.push({
            type: 'exclude',
            icon: 'ban',
            label: 'Exclude Brand',
            value: brand.toUpperCase(),
            filterKey: 'excludeBrands',
            filterValue: brand,
          });
        });
      }

      // Excluded conditions
      if (fv.exclude.conditions && fv.exclude.conditions.length > 0) {
        fv.exclude.conditions.forEach((condition) => {
          filters.push({
            type: 'exclude',
            icon: 'ban',
            label: 'Exclude Condition',
            value: condition.charAt(0).toUpperCase() + condition.slice(1),
            filterKey: 'excludeConditions',
            filterValue: condition,
          });
        });
      }

      // Excluded origins
      if (fv.exclude.origins && fv.exclude.origins.length > 0) {
        const originLabels = { CN: 'Chinese', IN: 'Indian' };
        fv.exclude.origins.forEach((origin) => {
          filters.push({
            type: 'exclude',
            icon: 'ban',
            label: 'Exclude Origin',
            value: originLabels[origin] || origin,
            filterKey: 'excludeOrigins',
            filterValue: origin,
          });
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // QUANTITY FILTER (B2B - "need x10", "qty 50")
    // ═══════════════════════════════════════════════════════════════
    if (fv.requestedQuantity && fv.requestedQuantity > 1) {
      filters.push({
        type: 'quantity',
        icon: 'boxes',
        label: 'Quantity Needed',
        value: `${fv.requestedQuantity} units`,
        filterKey: 'requestedQuantity',
        filterValue: fv.requestedQuantity,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // SUPPLIER ORIGIN FILTER ("German supplier", "Japanese parts")
    // ═══════════════════════════════════════════════════════════════
    if (fv.supplierOrigin) {
      const originLabels = { DE: 'German', JP: 'Japanese', US: 'American' };
      filters.push({
        type: 'origin',
        icon: 'globe',
        label: 'Origin',
        value: originLabels[fv.supplierOrigin] || fv.supplierOrigin,
        filterKey: 'supplierOrigin',
        filterValue: fv.supplierOrigin,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PRICE FILTERS (with smart range support)
    // ═══════════════════════════════════════════════════════════════
    if (fv.minPrice != null && fv.maxPrice != null) {
      // Show as range if both present
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Price Range',
        value: `$${fv.minPrice} - $${fv.maxPrice}`,
        filterKey: 'priceRange',
        filterValue: { min: fv.minPrice, max: fv.maxPrice },
      });
    } else {
      if (fv.minPrice != null) {
        filters.push({
          type: 'price',
          icon: 'dollar-sign',
          label: 'Min Price',
          value: `$${fv.minPrice}`,
          filterKey: 'priceMin',
          filterValue: fv.minPrice,
        });
      }
      if (fv.maxPrice != null) {
        filters.push({
          type: 'price',
          icon: 'dollar-sign',
          label: 'Max Price',
          value: `$${fv.maxPrice}`,
          filterKey: 'priceMax',
          filterValue: fv.maxPrice,
        });
      }
    }

    // Stock filter
    if (fv.inStock || fv.requireHighStock) {
      filters.push({
        type: 'stock',
        icon: 'package',
        label: 'Stock',
        value: fv.requireHighStock ? 'High Stock (≥10)' : 'In Stock Only',
        filterKey: 'stockStatus',
        filterValue: fv.requireHighStock ? 'high-stock' : 'in-stock',
      });
    }

    // Category filter
    if (fv.category) {
      filters.push({
        type: 'category',
        icon: 'component',
        label: 'Category',
        value:
          String(fv.category).charAt(0).toUpperCase() +
          String(fv.category).slice(1),
        filterKey: 'partCategories',
        filterValue: fv.category,
      });
    }

    // Delivery filter
    if (fv.deliveryDays !== undefined) {
      filters.push({
        type: 'delivery',
        icon: 'truck',
        label: 'Delivery',
        value: `Within ${fv.deliveryDays} days`,
        filterKey: 'deliveryTime',
        filterValue:
          fv.deliveryDays <= 3
            ? 'express'
            : fv.deliveryDays <= 7
              ? 'fast'
              : 'standard',
      });
    }

    // Supplier filter
    if (fv.supplier) {
      filters.push({
        type: 'supplier',
        icon: 'building',
        label: 'Supplier',
        value: fv.supplier,
        filterKey: 'supplier',
        filterValue: fv.supplier,
      });
    }

    // Certified supplier filter
    if (fv.certifiedOnly) {
      filters.push({
        type: 'certified',
        icon: 'shield-check',
        label: 'Certification',
        value: 'Certified Only',
        filterKey: 'certifiedOnly',
        filterValue: true,
      });
    }

    // Sort filter
    if (fv.sortBy && fv.sortBy !== 'price') {
      const sortLabels = {
        quantity: 'Highest Stock',
        deliveryDays: 'Fastest Delivery',
        brand: 'Brand Name',
      };
      filters.push({
        type: 'sort',
        icon: 'arrow-up-down',
        label: 'Sort By',
        value: sortLabels[fv.sortBy] || fv.sortBy,
        filterKey: 'sortBy',
        filterValue: fv.sortBy,
      });
    }

    return filters;
  }

  function parseAIQuery(query) {
    const filters = [];
    const queryLower = query.toLowerCase();

    // Price detection - Enhanced patterns
    const priceUnderMatch = queryLower.match(
      /under\s*\$?(\d+)|below\s*\$?(\d+)|less\s+than\s*\$?(\d+)|cheaper\s+than\s*\$?(\d+)|max\s*\$?(\d+)/,
    );
    if (priceUnderMatch) {
      const price =
        priceUnderMatch[1] ||
        priceUnderMatch[2] ||
        priceUnderMatch[3] ||
        priceUnderMatch[4] ||
        priceUnderMatch[5];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Max Price',
        value: `$${price}`,
        filterKey: 'priceMax',
        filterValue: parseInt(price),
      });
    }

    const priceAboveMatch = queryLower.match(
      /over\s*\$?(\d+)|above\s*\$?(\d+)|more\s+than\s*\$?(\d+)|min\s*\$?(\d+)/,
    );
    if (priceAboveMatch) {
      const price =
        priceAboveMatch[1] ||
        priceAboveMatch[2] ||
        priceAboveMatch[3] ||
        priceAboveMatch[4];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Min Price',
        value: `$${price}`,
        filterKey: 'priceMin',
        filterValue: parseInt(price),
      });
    }

    // Price range detection
    const priceRangeMatch = queryLower.match(
      /\$?(\d+)\s*-\s*\$?(\d+)|between\s*\$?(\d+)\s+and\s+\$?(\d+)/,
    );
    if (priceRangeMatch) {
      const min = priceRangeMatch[1] || priceRangeMatch[3];
      const max = priceRangeMatch[2] || priceRangeMatch[4];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Price Range',
        value: `$${min} - $${max}`,
        filterKey: 'priceRange',
        filterValue: { min: parseInt(min), max: parseInt(max) },
      });
    }

    // Brand detection
    const brands = [
      'oem',
      'bosch',
      'skf',
      'gates',
      'parker',
      'continental',
      'denso',
      'valeo',
      'delphi',
      'brembo',
    ];
    brands.forEach((brand) => {
      if (queryLower.includes(brand)) {
        filters.push({
          type: 'brand',
          icon: 'award',
          label: 'Brand',
          value: brand.toUpperCase(),
          filterKey: 'brands',
          filterValue: brand,
        });
      }
    });

    // Stock detection
    if (queryLower.includes('in stock') || queryLower.includes('available')) {
      filters.push({
        type: 'stock',
        icon: 'package',
        label: 'Stock',
        value: 'In Stock',
        filterKey: 'stockStatus',
        filterValue: 'in-stock',
      });
    }

    // Delivery detection
    if (
      queryLower.includes('fast') ||
      queryLower.includes('express') ||
      queryLower.includes('quick')
    ) {
      filters.push({
        type: 'delivery',
        icon: 'zap',
        label: 'Delivery',
        value: 'Express (1-2 days)',
        filterKey: 'deliveryTime',
        filterValue: 'express',
      });
    }

    // Part category detection - Enhanced
    const categories = {
      brake: { value: 'brakes', display: 'Brakes' },
      brakes: { value: 'brakes', display: 'Brakes' },
      'brake pad': { value: 'brakes', display: 'Brake Pads' },
      'brake disc': { value: 'brakes', display: 'Brake Discs' },
      engine: { value: 'engine', display: 'Engine' },
      'engine parts': { value: 'engine', display: 'Engine Parts' },
      suspension: { value: 'suspension', display: 'Suspension' },
      shock: { value: 'suspension', display: 'Shock Absorbers' },
      strut: { value: 'suspension', display: 'Struts' },
      electrical: { value: 'electrical', display: 'Electrical' },
      battery: { value: 'electrical', display: 'Battery' },
      alternator: { value: 'electrical', display: 'Alternator' },
      transmission: { value: 'transmission', display: 'Transmission' },
      gearbox: { value: 'transmission', display: 'Gearbox' },
      cooling: { value: 'cooling', display: 'Cooling System' },
      radiator: { value: 'cooling', display: 'Radiator' },
      steering: { value: 'steering', display: 'Steering' },
      exhaust: { value: 'exhaust', display: 'Exhaust System' },
      filter: { value: 'filters', display: 'Filters' },
      'oil filter': { value: 'filters', display: 'Oil Filter' },
      'air filter': { value: 'filters', display: 'Air Filter' },
      bearing: { value: 'engine', display: 'Bearings' },
      pump: { value: 'engine', display: 'Pump' },
      clutch: { value: 'transmission', display: 'Clutch' },
      tire: { value: 'wheels', display: 'Tires' },
      wheel: { value: 'wheels', display: 'Wheels' },
    };

    // Sort by length to match longer phrases first
    const sortedKeys = Object.keys(categories).sort(
      (a, b) => b.length - a.length,
    );

    sortedKeys.forEach((key) => {
      if (queryLower.includes(key)) {
        const category = categories[key];
        // Only add if not already added
        if (
          !filters.some(
            (f) =>
              f.filterKey === 'partCategories' &&
              f.filterValue === category.value,
          )
        ) {
          filters.push({
            type: 'category',
            icon: 'component',
            label: 'Category',
            value: category.display,
            filterKey: 'partCategories',
            filterValue: category.value,
          });
        }
      }
    });

    // Quality detection
    if (
      queryLower.includes('high quality') ||
      queryLower.includes('premium') ||
      queryLower.includes('best')
    ) {
      filters.push({
        type: 'quality',
        icon: 'star',
        label: 'Rating',
        value: '5 Stars',
        filterKey: 'supplierRating',
        filterValue: 5,
      });
    }

    // Verified supplier detection
    if (queryLower.includes('verified') || queryLower.includes('trusted')) {
      filters.push({
        type: 'verified',
        icon: 'shield-check',
        label: 'Supplier',
        value: 'Verified Only',
        filterKey: 'verifiedOnly',
        filterValue: true,
      });
    }

    return filters;
  }

  function displayAIResults(
    parsedFilters,
    results = [],
    parsedResponse = null,
  ) {
    // Hide thinking, show results
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'none';
    }

    const hasResults = results && results.length > 0;
    const hasFilters = parsedFilters && parsedFilters.length > 0;
    const isBroadSearch = AIFilterState.isBroadSearch;

    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'flex';
      const titleSpan = elements.aiResponseTitle.querySelector('span');
      const icon = elements.aiResponseTitle.querySelector('i');

      if (hasResults) {
        // Professional result messaging
        const resultCount = results.length;
        if (resultCount === 1) {
          titleSpan.textContent = 'Found 1 matching part';
        } else if (resultCount < 10) {
          titleSpan.textContent = `Found ${resultCount} matching parts`;
        } else if (resultCount < 100) {
          titleSpan.textContent = `Found ${resultCount} parts`;
        } else {
          titleSpan.textContent = `${resultCount}+ parts available`;
        }
        icon?.setAttribute('data-lucide', 'check-circle');
      } else if (hasFilters) {
        titleSpan.textContent = `Filters applied - No exact matches found`;
        icon?.setAttribute('data-lucide', 'filter-x');
      } else {
        titleSpan.textContent =
          parsedResponse?.intent || 'Processing your search...';
        icon?.setAttribute('data-lucide', 'search');
      }
    }
    if (elements.aiFiltersPreview) {
      elements.aiFiltersPreview.style.display = 'block';
    }

    // Hide welcome section and features when showing results
    const welcomeSection = document.querySelector('.ai-welcome-section');
    const featuresInfo = document.querySelector('.ai-features-info');
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (featuresInfo) featuresInfo.style.display = 'none';

    // Store parsed filters
    AIFilterState.aiParsedFilters = parsedFilters;

    // Render the redesigned results layout
    if (elements.aiFiltersGrid) {
      // Check if this is a broad search
      const isBroad = AIFilterState.isBroadSearch;
      const availableBrands = AIFilterState.availableBrands || [];
      const broadMessage = AIFilterState.broadSearchMessage || '';

      // Build the new 3-column layout
      let contentHTML = `<div class="ai-results-container">`;

      // LEFT COLUMN - AI Understanding & Filters
      contentHTML += `
        <div class="ai-results-left-col">
          <!-- AI Understanding Section -->
          <div class="ai-section ai-understanding-section">
            <div class="ai-section-header">
              <div class="ai-section-icon understanding-icon">
                <i data-lucide="brain"></i>
              </div>
              <h3 class="ai-section-title">AI Understanding</h3>
            </div>
            <div class="ai-section-content">
              <div class="ai-intent-display">
                <i data-lucide="sparkles"></i>
                <span>${escapeHtml(parsedResponse?.intent || 'Searching for parts matching your query')}</span>
              </div>
              ${
                isBroad
                  ? `
                <div class="ai-broad-search-warning">
                  <i data-lucide="alert-triangle"></i>
                  <div class="broad-warning-content">
                    <span class="broad-warning-title">Broad Search Detected</span>
                    <span class="broad-warning-text">${escapeHtml(broadMessage)}</span>
                  </div>
                </div>
                ${
                  availableBrands.length > 0
                    ? `
                  <div class="ai-brand-suggestions">
                    <span class="brand-suggestions-label">Try filtering by brand:</span>
                    <div class="brand-chips">
                      ${availableBrands
                        .slice(0, 8)
                        .map(
                          (brand) => `
                        <button class="brand-chip" data-brand="${escapeHtml(brand)}">
                          ${escapeHtml(brand)}
                        </button>
                      `,
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
              `
                  : ''
              }
            </div>
          </div>
          
          <!-- Active Filters Section -->
          <div class="ai-section ai-active-filters-section">
            <div class="ai-section-header">
              <div class="ai-section-icon filters-icon">
                <i data-lucide="sliders-horizontal"></i>
              </div>
              <h3 class="ai-section-title">Applied Filters</h3>
              <span class="ai-filter-count">${hasFilters ? parsedFilters.length : 0}</span>
            </div>
            <div class="ai-section-content">
              ${
                hasFilters
                  ? `
                <div class="ai-active-filters-grid">
                  ${parsedFilters
                    .map(
                      (filter, index) => `
                    <div class="ai-active-filter-chip ${filter.type}" data-index="${index}">
                      <i data-lucide="${filter.icon}"></i>
                      <div class="filter-chip-content">
                        <span class="filter-chip-label">${filter.label}</span>
                        <span class="filter-chip-value">${filter.value}</span>
                      </div>
                      <button class="filter-chip-remove" data-index="${index}">
                        <i data-lucide="x"></i>
                      </button>
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : `
                <div class="ai-no-filters">
                  <i data-lucide="filter-x"></i>
                  <span>No specific filters detected</span>
                </div>
              `
              }
            </div>
          </div>
          
          <!-- Suggestions Section -->
          ${
            parsedResponse?.suggestions && parsedResponse.suggestions.length > 0
              ? `
            <div class="ai-section ai-suggestions-section">
              <div class="ai-section-header">
                <div class="ai-section-icon suggestions-icon">
                  <i data-lucide="lightbulb"></i>
                </div>
                <h3 class="ai-section-title">Try Also</h3>
              </div>
              <div class="ai-section-content">
                <div class="ai-suggestion-buttons">
                  ${parsedResponse.suggestions
                    .slice(0, 3)
                    .map(
                      (suggestion) => `
                    <button class="ai-suggestion-btn" data-suggestion="${escapeHtml(suggestion)}">
                      <i data-lucide="search"></i>
                      <span>${escapeHtml(truncateText(suggestion, 40))}</span>
                    </button>
                  `,
                    )
                    .join('')}
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      `;

      // RIGHT COLUMN - Results Preview
      contentHTML += `
        <div class="ai-results-right-col">
          ${
            AIFilterState.aiInsights && AIFilterState.aiInsights.length > 0
              ? `
            <div class="ai-section ai-insights-section">
              <div class="ai-section-header">
                <div class="ai-section-icon insights-icon">
                  <i data-lucide="sparkles"></i>
                </div>
                <h3 class="ai-section-title">AI Recommendation</h3>
              </div>
              <div class="ai-section-content">
                <div class="ai-insights-list">
                  ${AIFilterState.aiInsights
                    .map((insight) => {
                      if (insight.type === 'tie') {
                        return `
                          <div class="ai-insight-card tie-insight">
                            <div class="insight-header">
                              <i data-lucide="equal"></i>
                              <span>${escapeHtml(insight.message)}</span>
                            </div>
                            <div class="insight-comparison">
                              <div class="insight-option">
                                <span class="option-label">${escapeHtml(insight.first.supplier || 'Option 1')}</span>
                                ${insight.first.advantages.map((a) => `<span class="advantage-tag"><i data-lucide="plus"></i>${escapeHtml(a)}</span>`).join('')}
                                ${insight.first.advantages.length === 0 ? '<span class="advantage-tag neutral">similar</span>' : ''}
                              </div>
                              <div class="insight-vs">VS</div>
                              <div class="insight-option">
                                <span class="option-label">${escapeHtml(insight.second.supplier || 'Option 2')}</span>
                                ${insight.second.advantages.map((a) => `<span class="advantage-tag"><i data-lucide="plus"></i>${escapeHtml(a)}</span>`).join('')}
                                ${insight.second.advantages.length === 0 ? '<span class="advantage-tag neutral">similar</span>' : ''}
                              </div>
                            </div>
                          </div>
                        `;
                      } else if (insight.type === 'tradeoff') {
                        return `
                          <div class="ai-insight-card tradeoff-insight">
                            <i data-lucide="scale"></i>
                            <span>${escapeHtml(insight.message)}</span>
                          </div>
                        `;
                      }
                      return '';
                    })
                    .join('')}
                </div>
              </div>
            </div>
          `
              : ''
          }
          <div class="ai-section ai-results-section">
            <div class="ai-section-header">
              <div class="ai-section-icon results-icon">
                <i data-lucide="package-search"></i>
              </div>
              <h3 class="ai-section-title">Search Results</h3>
              <div class="ai-results-badge ${hasResults ? 'has-results' : 'no-results'}">
                <span class="results-number">${hasResults ? results.length : 0}</span>
                <span class="results-label">found</span>
              </div>
            </div>
            <div class="ai-section-content">
              ${
                hasResults
                  ? `
                <div class="ai-results-table-container">
                  <table class="ai-results-table">
                    <thead>
                      <tr>
                        <th class="col-rank">AI</th>
                        <th class="col-brand">Brand</th>
                        <th class="col-part">Part Number</th>
                        <th class="col-desc">Description</th>
                        <th class="col-qty">Qty</th>
                        <th class="col-price">Price</th>
                        <th class="col-delivery">Delivery</th>
                        <th class="col-stock">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${results
                        .slice(0, 15)
                        .map(
                          (product, idx) => `
                        <tr class="result-row ${product._aiBadges && product._aiBadges.includes('best-overall') ? 'best-row' : ''}" style="animation-delay: ${idx * 0.04}s" data-part-id="${product._id || product.id || ''}">
                          <td class="col-rank">
                            ${getAIBadgesHTML(product, idx)}
                          </td>
                          <td class="col-brand">
                            <span class="brand-tag">${escapeHtml(product.brand || 'N/A')}</span>
                          </td>
                          <td class="col-part">
                            <span class="part-number-cell">${escapeHtml(product.partNumber || product.vendorCode || 'N/A')}</span>
                          </td>
                          <td class="col-desc">
                            <span class="description-text" title="${escapeHtml(product.description || '')}">${escapeHtml(truncateText(product.description || 'No description', 25))}</span>
                          </td>
                          <td class="col-qty">
                            <span class="qty-display">${product.quantity || product.stock || 0}</span>
                          </td>
                          <td class="col-price">
                            <span class="price-display">${product.price ? `$${(Number(product.price) / 3.67).toFixed(2)}` : '—'}</span>
                          </td>
                          <td class="col-delivery">
                            <span class="delivery-badge ${getDeliveryClass(product)}">${product.deliveryDays ? `${product.deliveryDays}d` : '—'}</span>
                          </td>
                          <td class="col-stock">
                            <span class="stock-indicator ${getStockStatus(product)}">
                              <span class="stock-dot"></span>
                              <span class="stock-text">${getStockLabel(product)}</span>
                            </span>
                          </td>
                        </tr>
                        ${
                          product._aiBadges && product._aiBadges.length > 0
                            ? `
                        <tr class="ai-reason-row">
                          <td colspan="8">
                            <div class="ai-reason-text">${getAIReasonText(product, results)}</div>
                          </td>
                        </tr>
                        `
                            : ''
                        }
                      `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
                ${
                  results.length > 15
                    ? `
                  <div class="ai-results-more">
                    <i data-lucide="chevrons-down"></i>
                    <span>+${results.length - 15} more results — Click Apply to see all</span>
                  </div>
                `
                    : ''
                }
              `
                  : `
                <div class="ai-no-results">
                  <div class="no-results-visual">
                    <div class="no-results-icon-wrapper">
                      <i data-lucide="search-x"></i>
                    </div>
                    <h4>No Matching Parts</h4>
                    <p class="no-results-message">${AIFilterState.broadSearchMessage || 'No parts match your current search criteria.'}</p>
                  </div>
                  <div class="no-results-tips">
                    <h5><i data-lucide="lightbulb"></i> Search Tips</h5>
                    <ul class="tips-list">
                      <li>Check spelling of part numbers and brand names</li>
                      <li>Try broader terms (e.g., "brake" instead of "brake pad set")</li>
                      <li>Remove some filters to expand results</li>
                      <li>Search by brand name (BOSCH, SKF, DENSO)</li>
                    </ul>
                  </div>
                  <div class="no-results-suggestions">
                    <p class="suggestions-intro">Popular searches:</p>
                    <div class="quick-search-chips">
                      <button class="quick-chip" data-hint="BOSCH brake pads">
                        <i data-lucide="disc"></i> BOSCH Brake Pads
                      </button>
                      <button class="quick-chip" data-hint="SKF wheel bearing">
                        <i data-lucide="circle-dot"></i> SKF Bearings
                      </button>
                      <button class="quick-chip" data-hint="MANN oil filter">
                        <i data-lucide="filter"></i> MANN Filters
                      </button>
                      <button class="quick-chip" data-hint="DENSO spark plug">
                        <i data-lucide="zap"></i> DENSO Spark Plugs
                      </button>
                    </div>
                  </div>
                </div>
              `
              }
            </div>
          </div>
        </div>
      `;

      contentHTML += `</div>`; // Close ai-results-container

      elements.aiFiltersGrid.innerHTML = contentHTML;

      // Add event handlers for filter removal
      elements.aiFiltersGrid
        .querySelectorAll('.filter-chip-remove')
        .forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeAIParsedFilter(index);
          });
        });

      // Add event handlers for suggestion buttons
      elements.aiFiltersGrid
        .querySelectorAll('.ai-suggestion-btn')
        .forEach((btn) => {
          btn.addEventListener('click', () => {
            const suggestion = btn.dataset.suggestion;
            if (elements.aiInput) {
              elements.aiInput.value = suggestion;
              handleAISubmit();
            }
          });
        });

      // Add event handlers for quick search chips
      elements.aiFiltersGrid.querySelectorAll('.quick-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const hint = chip.dataset.hint;
          if (elements.aiInput) {
            elements.aiInput.value = hint;
            handleAISubmit();
          }
        });
      });

      // Add event handlers for brand suggestion chips (broad search)
      elements.aiFiltersGrid.querySelectorAll('.brand-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const brand = chip.dataset.brand;
          const currentQuery = elements.aiInput?.value || '';
          // Append brand to current search
          if (elements.aiInput) {
            elements.aiInput.value = `${currentQuery} ${brand}`.trim();
            handleAISubmit();
          }
        });
      });
    }

    // Apply the parsed filters to the state
    parsedFilters.forEach((filter) => {
      if (
        filter.filterKey === 'brands' ||
        filter.filterKey === 'origins' ||
        filter.filterKey === 'partCategories'
      ) {
        if (
          !AIFilterState.filters[filter.filterKey].includes(filter.filterValue)
        ) {
          if (AIFilterState.filters[filter.filterKey].includes('all')) {
            AIFilterState.filters[filter.filterKey] = [filter.filterValue];
          } else {
            AIFilterState.filters[filter.filterKey].push(filter.filterValue);
          }
        }
      } else if (filter.filterKey) {
        AIFilterState.filters[filter.filterKey] = filter.filterValue;
      }
    });

    updateFilterCount();

    // Update results preview count
    if (elements.resultsPreview) {
      elements.resultsPreview.textContent =
        results.length || AIFilterState.activeFilterCount;
    }

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Utility functions for display
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncateText(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  function getStockStatus(product) {
    if (!product.quantity || product.quantity === 0) return 'out';
    if (product.quantity <= 10) return 'low';
    return 'in';
  }

  function getStockLabel(product) {
    if (!product.quantity || product.quantity === 0) return 'Out of Stock';
    if (product.quantity <= 10) return 'Low Stock';
    return 'In Stock';
  }

  function getDeliveryClass(product) {
    if (!product.deliveryDays) return '';
    if (product.deliveryDays <= 7) return 'delivery-fast';
    if (product.deliveryDays <= 30) return 'delivery-medium';
    return 'delivery-slow';
  }

  function getAIBadgesHTML(product, idx) {
    const badges = product._aiBadges || [];
    if (badges.length === 0) {
      return `<span class="ai-rank-num">#${idx + 1}</span>`;
    }

    const badgeMap = {
      'best-overall': { icon: 'crown', label: 'Best', cls: 'badge-best' },
      'lowest-price': { icon: 'tag', label: 'Cheapest', cls: 'badge-cheap' },
      'fastest-delivery': { icon: 'zap', label: 'Fastest', cls: 'badge-fast' },
      'highest-stock': {
        icon: 'warehouse',
        label: 'Top Stock',
        cls: 'badge-stock',
      },
      'only-option': {
        icon: 'check-circle',
        label: 'Only Option',
        cls: 'badge-only',
      },
    };

    let html = '';
    badges.forEach((b) => {
      const info = badgeMap[b];
      if (info) {
        html += `<span class="ai-badge ${info.cls}" title="${info.label}"><i data-lucide="${info.icon}"></i></span>`;
      }
    });
    return html || `<span class="ai-rank-num">#${idx + 1}</span>`;
  }

  function getAIReasonText(product, allResults) {
    const badges = product._aiBadges || [];
    const reasons = [];

    if (badges.includes('best-overall')) {
      reasons.push('⭐ Best overall value — balanced price, stock & delivery');
    }
    if (badges.includes('lowest-price') && !badges.includes('best-overall')) {
      reasons.push('💰 Lowest price among results');
    }
    if (badges.includes('fastest-delivery')) {
      const days = product.deliveryDays || '?';
      reasons.push(`⚡ Fastest delivery (${days} days)`);
    }
    if (badges.includes('highest-stock')) {
      reasons.push(
        `📦 Highest stock availability (${product.quantity || 0} units)`,
      );
    }
    if (badges.includes('only-option')) {
      reasons.push('✅ Only matching option found');
    }

    return reasons.join(' · ') || '';
  }

  function removeAIParsedFilter(index) {
    AIFilterState.aiParsedFilters.splice(index, 1);
    displayAIResults(
      AIFilterState.aiParsedFilters,
      AIFilterState.lastSearchResults,
      AIFilterState.aiParsedResponse,
    );
  }

  // ====================================
  // MANUAL FILTER CONTROLS
  // ====================================
  function toggleManualFilters() {
    const isCollapsed =
      elements.manualFiltersContent?.classList.toggle('collapsed');
    elements.collapseBtn?.classList.toggle('collapsed', isCollapsed);
  }

  function toggleBrandChip(chip) {
    const brand = chip.dataset.brand;

    if (brand === 'all') {
      // Deselect all others, select 'all'
      document
        .querySelectorAll('.brand-chip')
        .forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      AIFilterState.filters.brands = ['all'];
    } else {
      // Deselect 'all', toggle this brand
      document
        .querySelector('.brand-chip[data-brand="all"]')
        ?.classList.remove('active');
      chip.classList.toggle('active');

      const index = AIFilterState.filters.brands.indexOf(brand);
      if (index > -1) {
        AIFilterState.filters.brands.splice(index, 1);
      } else {
        // Remove 'all' if present
        const allIndex = AIFilterState.filters.brands.indexOf('all');
        if (allIndex > -1) {
          AIFilterState.filters.brands.splice(allIndex, 1);
        }
        AIFilterState.filters.brands.push(brand);
      }

      // If no brands selected, select 'all'
      if (AIFilterState.filters.brands.length === 0) {
        document
          .querySelector('.brand-chip[data-brand="all"]')
          ?.classList.add('active');
        AIFilterState.filters.brands = ['all'];
      }
    }

    updateFilterCount();
  }

  function toggleStockFilter(toggle) {
    document
      .querySelectorAll('.stock-toggle')
      .forEach((t) => t.classList.remove('active'));
    toggle.classList.add('active');
    AIFilterState.filters.stockStatus = toggle.dataset.stock;
    updateFilterCount();
  }

  function selectRating(btn) {
    document
      .querySelectorAll('.rating-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    AIFilterState.filters.supplierRating = parseInt(btn.dataset.rating) || 0;
    updateFilterCount();
  }

  function togglePartCategory(btn) {
    btn.classList.toggle('active');
    const category = btn.dataset.category;

    const index = AIFilterState.filters.partCategories.indexOf(category);
    if (index > -1) {
      AIFilterState.filters.partCategories.splice(index, 1);
    } else {
      AIFilterState.filters.partCategories.push(category);
    }

    updateFilterCount();
  }

  function handleVehicleMakeChange(e) {
    const make = e.target.value;
    const modelSelect = document.getElementById('vehicle-model');

    if (!modelSelect) return;

    if (make && vehicleModels[make]) {
      modelSelect.disabled = false;
      modelSelect.innerHTML =
        '<option value="">Select model...</option>' +
        vehicleModels[make]
          .map(
            (model) =>
              `<option value="${model.toLowerCase()}">${model}</option>`,
          )
          .join('');
    } else {
      modelSelect.disabled = true;
      modelSelect.innerHTML = '<option value="">Select model...</option>';
    }

    AIFilterState.filters.vehicleMake = make;
    updateFilterCount();
  }

  function handleBrandSearch(e) {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.brand-chip').forEach((chip) => {
      const brand = chip.dataset.brand;
      if (brand === 'all' || brand.includes(query)) {
        chip.style.display = '';
      } else {
        chip.style.display = 'none';
      }
    });
  }

  // ====================================
  // RANGE SLIDERS
  // ====================================
  function initializeRangeSliders() {
    const priceMinSlider = document.getElementById('price-range-min');
    const priceMaxSlider = document.getElementById('price-range-max');
    const priceFill = document.getElementById('price-range-fill');

    if (priceMinSlider && priceMaxSlider && priceFill) {
      function updatePriceSlider() {
        const min = parseInt(priceMinSlider.value);
        const max = parseInt(priceMaxSlider.value);
        const total = parseInt(priceMinSlider.max);

        const minPercent = (min / total) * 100;
        const maxPercent = (max / total) * 100;

        priceFill.style.left = minPercent + '%';
        priceFill.style.right = 100 - maxPercent + '%';

        // Update input fields
        const minInput = document.getElementById('price-min-input');
        const maxInput = document.getElementById('price-max-input');
        if (minInput) minInput.value = min;
        if (maxInput) maxInput.value = max;

        // Update state
        AIFilterState.filters.priceMin = min;
        AIFilterState.filters.priceMax = max;
      }

      priceMinSlider.addEventListener('input', () => {
        if (parseInt(priceMinSlider.value) > parseInt(priceMaxSlider.value)) {
          priceMinSlider.value = priceMaxSlider.value;
        }
        updatePriceSlider();
        updateFilterCount();
      });

      priceMaxSlider.addEventListener('input', () => {
        if (parseInt(priceMaxSlider.value) < parseInt(priceMinSlider.value)) {
          priceMaxSlider.value = priceMinSlider.value;
        }
        updatePriceSlider();
        updateFilterCount();
      });

      updatePriceSlider();
    }
  }

  function updatePriceRange() {
    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    const priceMinSlider = document.getElementById('price-range-min');
    const priceMaxSlider = document.getElementById('price-range-max');

    if (minInput && maxInput && priceMinSlider && priceMaxSlider) {
      priceMinSlider.value = minInput.value;
      priceMaxSlider.value = maxInput.value;

      // Trigger slider update
      priceMinSlider.dispatchEvent(new Event('input'));
    }
  }

  // ====================================
  // FILTER COUNT & APPLY
  // ====================================
  function updateFilterCount() {
    let count = 0;

    // Check price range
    if (
      AIFilterState.filters.priceMin > 0 ||
      AIFilterState.filters.priceMax < 100000
    )
      count++;

    // Check brands
    if (
      AIFilterState.filters.brands.length > 0 &&
      !AIFilterState.filters.brands.includes('all')
    )
      count++;

    // Check stock
    if (AIFilterState.filters.stockStatus !== 'all') count++;

    // Check origins
    if (AIFilterState.filters.origins.length > 0) count++;

    // Check delivery
    if (AIFilterState.filters.deliveryTime !== 'any') count++;

    // Check part categories
    if (AIFilterState.filters.partCategories.length > 0) count++;

    // Check vehicle make
    if (AIFilterState.filters.vehicleMake) count++;

    // Check certifications
    const certCheckboxes = document.querySelectorAll(
      'input[name="cert"]:checked',
    );
    if (certCheckboxes.length > 0) count++;

    // Check brand type
    const brandTypeCheckboxes = document.querySelectorAll(
      'input[name="brand-type"]:checked',
    );
    if (brandTypeCheckboxes.length > 0) count++;

    AIFilterState.activeFilterCount = count;

    if (elements.activeFilterCount) {
      elements.activeFilterCount.textContent = count;
    }

    // Update results preview - show count only
    if (elements.resultsPreview) {
      elements.resultsPreview.textContent = count;
    }
  }

  function clearAllFilters() {
    // Reset state
    AIFilterState.filters = {
      priceMin: 0,
      priceMax: 100000,
      discount: [],
      paymentTerms: [],
      brandType: [],
      brands: ['all'],
      condition: 'all',
      weightMin: 0,
      weightMax: 1000,
      stockStatus: 'all',
      origins: [],
      supplierRating: 5,
      certifications: [],
      verifiedOnly: true,
      deliveryTime: 'any',
      shippingTo: '',
      minOrderQty: 1,
      freeShipping: false,
      returnPolicy: [],
      vehicleMake: '',
      vehicleModel: '',
      yearMin: null,
      yearMax: null,
      partCategories: [],
      engineType: 'all',
    };

    AIFilterState.aiParsedFilters = [];
    AIFilterState.aiQuery = '';

    // AI input
    if (elements.aiInput) {
      elements.aiInput.value = '';
    }

    // Hide AI response section and show welcome section again
    if (elements.aiResponseSection) {
      elements.aiResponseSection.style.display = 'none';
    }

    // Show welcome section and features again
    const welcomeSection = document.querySelector('.ai-welcome-section');
    const featuresInfo = document.querySelector('.ai-features-info');
    if (welcomeSection) welcomeSection.style.display = 'block';
    if (featuresInfo) featuresInfo.style.display = 'grid';

    updateFilterCount();

    // Show success feedback
    showFilterToast('Filters reset');
  }

  function applyFilters() {
    // Collect all filter values
    const filters = collectAllFilters();

    console.log('Applying filters:', filters);
    console.log('AI Results count:', AIFilterState.lastSearchResults.length);

    // Close modal first
    closeModal();

    // Show success feedback
    const resultCount = AIFilterState.lastSearchResults.length;
    const message =
      resultCount > 0
        ? `Found ${resultCount} parts matching your search`
        : `${AIFilterState.activeFilterCount} filters applied`;
    showFilterToast(message);

    // If we have AI search results, dispatch the event to display them
    if (AIFilterState.lastSearchResults.length > 0) {
      // Small delay to ensure modal is closed
      setTimeout(() => {
        // Dispatch the AI results event - search.js will handle displaying
        const resultsEvent = new CustomEvent('aiSearchResults', {
          detail: {
            results: AIFilterState.lastSearchResults,
            query: AIFilterState.aiQuery,
            parsed: AIFilterState.aiParsedResponse,
          },
        });
        window.dispatchEvent(resultsEvent);
      }, 50);
    } else if (AIFilterState.aiQuery) {
      // If we have an AI query but no results, put the query in search input and trigger search
      setTimeout(() => {
        const searchInput = document.getElementById('search2-input');
        if (searchInput) {
          searchInput.value = AIFilterState.aiQuery;
          const searchBtn = document.getElementById('search2-btn');
          if (searchBtn) {
            searchBtn.click();
          }
        }
      }, 50);
    }
  }

  function collectAllFilters() {
    const filters = { ...AIFilterState.filters };

    // Collect checkbox values
    filters.discount = Array.from(
      document.querySelectorAll('input[name="discount"]:checked'),
    ).map((cb) => cb.value);
    filters.paymentTerms = Array.from(
      document.querySelectorAll('input[name="payment"]:checked'),
    ).map((cb) => cb.value);
    filters.brandType = Array.from(
      document.querySelectorAll('input[name="brand-type"]:checked'),
    ).map((cb) => cb.value);
    filters.certifications = Array.from(
      document.querySelectorAll('input[name="cert"]:checked'),
    ).map((cb) => cb.value);
    filters.returnPolicy = Array.from(
      document.querySelectorAll('input[name="return"]:checked'),
    ).map((cb) => cb.value);

    // Collect radio values
    filters.condition =
      document.querySelector('input[name="condition"]:checked')?.value || 'all';
    filters.deliveryTime =
      document.querySelector('input[name="delivery"]:checked')?.value || 'any';
    filters.engineType =
      document.querySelector('input[name="engine-type"]:checked')?.value ||
      'all';

    // Collect select values
    filters.shippingTo = document.getElementById('shipping-to')?.value || '';
    filters.vehicleMake = document.getElementById('vehicle-make')?.value || '';
    filters.vehicleModel =
      document.getElementById('vehicle-model')?.value || '';

    // Collect number inputs
    filters.weightMin =
      parseFloat(document.getElementById('weight-min')?.value) || 0;
    filters.weightMax =
      parseFloat(document.getElementById('weight-max')?.value) || 1000;
    filters.yearMin =
      parseInt(document.getElementById('year-min')?.value) || null;
    filters.yearMax =
      parseInt(document.getElementById('year-max')?.value) || null;
    filters.minOrderQty =
      parseInt(document.getElementById('min-order-qty')?.value) || 1;

    // Collect toggles
    filters.verifiedOnly =
      document.getElementById('verified-only')?.checked || false;
    filters.freeShipping =
      document.getElementById('free-shipping')?.checked || false;

    return filters;
  }

  // ====================================
  // TOAST NOTIFICATION
  // ====================================
  function showFilterToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.ai-filter-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'ai-filter-toast';
    toast.innerHTML = `
      <i data-lucide="check-circle"></i>
      <span>${message}</span>
    `;
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 0.9375rem;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 100001;
      animation: toastIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Reinitialize icon
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Auto remove
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Add toast animations to document
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    @keyframes toastOut {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
    }
  `;
  document.head.appendChild(style);

  // ====================================
  // INITIALIZE ON DOM READY
  // ====================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose to global scope for external access
  window.AIFilters = {
    open: openModal,
    close: closeModal,
    getFilters: () => AIFilterState.filters,
    clearAll: clearAllFilters,
    apply: applyFilters,
    clearResults: () => {
      // Clear AI search results to prevent interference with regular search
      AIFilterState.lastSearchResults = [];
      AIFilterState.aiQuery = '';
      AIFilterState.aiParsedFilters = [];
      AIFilterState.aiParsedResponse = null;
    },
  };
})();

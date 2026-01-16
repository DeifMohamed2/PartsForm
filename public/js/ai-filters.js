// ====================================
// AI SMART FILTER - PROFESSIONAL AIUX FUNCTIONALITY
// Premium Filter Experience with AI Integration
// ====================================

(function() {
  'use strict';

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const AIFilterState = {
    isOpen: false,
    activeTab: 'pricing',
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
      engineType: 'all'
    },
    aiQuery: '',
    aiParsedFilters: [],
    activeFilterCount: 0
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
    hintChips: null
  };

  // ====================================
  // VEHICLE DATA
  // ====================================
  const vehicleModels = {
    toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Land Cruiser', 'Prado', 'Fortuner', 'Hilux', 'Yaris', 'Prius'],
    honda: ['Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'City', 'Jazz'],
    nissan: ['Altima', 'Maxima', 'Sentra', 'Patrol', 'X-Trail', 'Pathfinder', 'Navara', 'Sunny'],
    bmw: ['3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'M3', 'M5'],
    mercedes: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'G-Class'],
    audi: ['A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS6'],
    volkswagen: ['Golf', 'Passat', 'Tiguan', 'Touareg', 'Polo', 'Jetta', 'ID.4'],
    ford: ['Mustang', 'F-150', 'Explorer', 'Escape', 'Bronco', 'Edge', 'Expedition'],
    chevrolet: ['Camaro', 'Corvette', 'Silverado', 'Tahoe', 'Suburban', 'Traverse', 'Equinox'],
    hyundai: ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Accent'],
    kia: ['Forte', 'K5', 'Sportage', 'Sorento', 'Telluride', 'Seltos', 'Carnival'],
    lexus: ['ES', 'IS', 'LS', 'RX', 'NX', 'GX', 'LX', 'LC'],
    porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', 'Boxster', 'Cayman'],
    'land-rover': ['Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Velar', 'Evoque'],
    jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator']
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
    elements.manualFiltersContent = document.getElementById('manual-filters-content');
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
    elements.hintChips?.forEach(chip => {
      chip.addEventListener('click', () => {
        const hint = chip.dataset.hint;
        if (elements.aiInput) {
          elements.aiInput.value = hint;
          elements.aiInput.focus();
        }
      });
    });

    // Filter tabs
    elements.filterTabs?.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Collapse toggle
    elements.collapseBtn?.addEventListener('click', toggleManualFilters);

    // Clear all
    elements.clearAllBtn?.addEventListener('click', clearAllFilters);

    // Apply filters
    elements.applyBtn?.addEventListener('click', applyFilters);

    // Brand chips
    document.querySelectorAll('.brand-chip').forEach(chip => {
      chip.addEventListener('click', () => toggleBrandChip(chip));
    });

    // Stock toggles
    document.querySelectorAll('.stock-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => toggleStockFilter(toggle));
    });

    // Rating buttons
    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => selectRating(btn));
    });

    // Part category buttons
    document.querySelectorAll('.part-category-btn').forEach(btn => {
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
    document.querySelectorAll('#ai-filter-modal input, #ai-filter-modal select').forEach(input => {
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
    if (typeof window.BuyerAuth !== 'undefined' && !window.BuyerAuth.isLoggedIn()) {
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
    elements.filterTabs?.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update panels
    elements.filterPanels?.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    // Reinitialize icons for the new panel
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // AI PROCESSING
  // ====================================
  function handleAISubmit() {
    const query = elements.aiInput?.value.trim();
    if (!query) return;

    AIFilterState.aiQuery = query;

    // Show response section with thinking state
    if (elements.aiResponseSection) {
      elements.aiResponseSection.style.display = 'block';
    }
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'flex';
    }
    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'none';
    }
    if (elements.aiFiltersPreview) {
      elements.aiFiltersPreview.style.display = 'none';
    }

    // Simulate AI processing
    setTimeout(() => {
      const parsedFilters = parseAIQuery(query);
      displayAIResults(parsedFilters);
    }, 1500);
  }

  function extractKeywords(query) {
    // Extract meaningful keywords from query
    const queryLower = query.toLowerCase();
    const stopWords = ['find', 'me', 'show', 'get', 'looking', 'for', 'need', 'want', 'the', 'a', 'an', 'some', 'with', 'from', 'under', 'over', 'i', 'am'];
    const words = queryLower.split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.includes(word) && !/^\d+$/.test(word)
    );
    return words.slice(0, 3).join(' ') || 'parts';
  }

  function generateSampleProducts(query) {
    const queryLower = query.toLowerCase();
    const keywords = extractKeywords(query);
    
    // Sample product database
    const productTemplates = [
      {
        partNumber: 'BRK-45890-A',
        description: 'Premium Brake Pad Set - Front',
        brand: 'BOSCH',
        price: '245.00',
        stock: 'in-stock',
        stockText: 'In Stock'
      },
      {
        partNumber: 'ENG-78234-B',
        description: 'High Performance Engine Air Filter',
        brand: 'OEM',
        price: '89.50',
        stock: 'in-stock',
        stockText: 'In Stock'
      },
      {
        partNumber: 'SUS-23456-C',
        description: 'Heavy Duty Suspension Strut Assembly',
        brand: 'SKF',
        price: '425.00',
        stock: 'low-stock',
        stockText: 'Low Stock'
      },
      {
        partNumber: 'TRN-67890-D',
        description: 'Transmission Oil Filter Kit',
        brand: 'GATES',
        price: '67.99',
        stock: 'in-stock',
        stockText: 'In Stock'
      },
      {
        partNumber: 'ELC-90123-E',
        description: 'Premium Spark Plug Set (4 pcs)',
        brand: 'DENSO',
        price: '128.00',
        stock: 'in-stock',
        stockText: 'In Stock'
      }
    ];
    
    // Customize products based on query
    if (queryLower.includes('brake')) {
      productTemplates[0].description = `${keywords.charAt(0).toUpperCase() + keywords.slice(1)} - Premium Brake System`;
      productTemplates[1].description = 'Brake Disc Rotor - Front Pair';
      productTemplates[1].brand = 'BREMBO';
    } else if (queryLower.includes('engine')) {
      productTemplates[0].description = 'Engine Mount Assembly';
      productTemplates[1].description = 'Engine Oil Pump';
    } else if (queryLower.includes('filter')) {
      productTemplates[0].description = 'Oil Filter - High Capacity';
      productTemplates[1].description = 'Cabin Air Filter - Premium';
      productTemplates[2].description = 'Fuel Filter Assembly';
    }
    
    return productTemplates.slice(0, 5);
  }

  function parseAIQuery(query) {
    const filters = [];
    const queryLower = query.toLowerCase();

    // Price detection - Enhanced patterns
    const priceUnderMatch = queryLower.match(/under\s*\$?(\d+)|below\s*\$?(\d+)|less\s+than\s*\$?(\d+)|cheaper\s+than\s*\$?(\d+)|max\s*\$?(\d+)/);
    if (priceUnderMatch) {
      const price = priceUnderMatch[1] || priceUnderMatch[2] || priceUnderMatch[3] || priceUnderMatch[4] || priceUnderMatch[5];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Max Price',
        value: `$${price}`,
        filterKey: 'priceMax',
        filterValue: parseInt(price)
      });
    }

    const priceAboveMatch = queryLower.match(/over\s*\$?(\d+)|above\s*\$?(\d+)|more\s+than\s*\$?(\d+)|min\s*\$?(\d+)/);
    if (priceAboveMatch) {
      const price = priceAboveMatch[1] || priceAboveMatch[2] || priceAboveMatch[3] || priceAboveMatch[4];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Min Price',
        value: `$${price}`,
        filterKey: 'priceMin',
        filterValue: parseInt(price)
      });
    }
    
    // Price range detection
    const priceRangeMatch = queryLower.match(/\$?(\d+)\s*-\s*\$?(\d+)|between\s*\$?(\d+)\s+and\s+\$?(\d+)/);
    if (priceRangeMatch) {
      const min = priceRangeMatch[1] || priceRangeMatch[3];
      const max = priceRangeMatch[2] || priceRangeMatch[4];
      filters.push({
        type: 'price',
        icon: 'dollar-sign',
        label: 'Price Range',
        value: `$${min} - $${max}`,
        filterKey: 'priceRange',
        filterValue: { min: parseInt(min), max: parseInt(max) }
      });
    }

    // Brand detection
    const brands = ['oem', 'bosch', 'skf', 'gates', 'parker', 'continental', 'denso', 'valeo', 'delphi', 'brembo'];
    brands.forEach(brand => {
      if (queryLower.includes(brand)) {
        filters.push({
          type: 'brand',
          icon: 'award',
          label: 'Brand',
          value: brand.toUpperCase(),
          filterKey: 'brands',
          filterValue: brand
        });
      }
    });

    // Origin detection
    const origins = {
      'german': 'Germany',
      'germany': 'Germany',
      'usa': 'USA',
      'american': 'USA',
      'japan': 'Japan',
      'japanese': 'Japan',
      'chinese': 'China',
      'china': 'China'
    };

    Object.keys(origins).forEach(key => {
      if (queryLower.includes(key)) {
        filters.push({
          type: 'origin',
          icon: 'globe',
          label: 'Origin',
          value: origins[key],
          filterKey: 'origins',
          filterValue: key
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
        filterValue: 'in-stock'
      });
    }

    // Delivery detection
    if (queryLower.includes('fast') || queryLower.includes('express') || queryLower.includes('quick')) {
      filters.push({
        type: 'delivery',
        icon: 'zap',
        label: 'Delivery',
        value: 'Express (1-2 days)',
        filterKey: 'deliveryTime',
        filterValue: 'express'
      });
    }

    // Part category detection - Enhanced
    const categories = {
      'brake': { value: 'brakes', display: 'Brakes' },
      'brakes': { value: 'brakes', display: 'Brakes' },
      'brake pad': { value: 'brakes', display: 'Brake Pads' },
      'brake disc': { value: 'brakes', display: 'Brake Discs' },
      'engine': { value: 'engine', display: 'Engine' },
      'engine parts': { value: 'engine', display: 'Engine Parts' },
      'suspension': { value: 'suspension', display: 'Suspension' },
      'shock': { value: 'suspension', display: 'Shock Absorbers' },
      'strut': { value: 'suspension', display: 'Struts' },
      'electrical': { value: 'electrical', display: 'Electrical' },
      'battery': { value: 'electrical', display: 'Battery' },
      'alternator': { value: 'electrical', display: 'Alternator' },
      'transmission': { value: 'transmission', display: 'Transmission' },
      'gearbox': { value: 'transmission', display: 'Gearbox' },
      'cooling': { value: 'cooling', display: 'Cooling System' },
      'radiator': { value: 'cooling', display: 'Radiator' },
      'steering': { value: 'steering', display: 'Steering' },
      'exhaust': { value: 'exhaust', display: 'Exhaust System' },
      'filter': { value: 'filters', display: 'Filters' },
      'oil filter': { value: 'filters', display: 'Oil Filter' },
      'air filter': { value: 'filters', display: 'Air Filter' },
      'bearing': { value: 'engine', display: 'Bearings' },
      'pump': { value: 'engine', display: 'Pump' },
      'clutch': { value: 'transmission', display: 'Clutch' },
      'tire': { value: 'wheels', display: 'Tires' },
      'wheel': { value: 'wheels', display: 'Wheels' }
    };

    // Sort by length to match longer phrases first
    const sortedKeys = Object.keys(categories).sort((a, b) => b.length - a.length);
    
    sortedKeys.forEach(key => {
      if (queryLower.includes(key)) {
        const category = categories[key];
        // Only add if not already added
        if (!filters.some(f => f.filterKey === 'partCategories' && f.filterValue === category.value)) {
          filters.push({
            type: 'category',
            icon: 'component',
            label: 'Category',
            value: category.display,
            filterKey: 'partCategories',
            filterValue: category.value
          });
        }
      }
    });

    // Quality detection
    if (queryLower.includes('high quality') || queryLower.includes('premium') || queryLower.includes('best')) {
      filters.push({
        type: 'quality',
        icon: 'star',
        label: 'Rating',
        value: '5 Stars',
        filterKey: 'supplierRating',
        filterValue: 5
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
        filterValue: true
      });
    }

    return filters;
  }

  function displayAIResults(parsedFilters) {
    // Hide thinking, show results
    if (elements.aiThinking) {
      elements.aiThinking.style.display = 'none';
    }
    if (elements.aiResponseTitle) {
      elements.aiResponseTitle.style.display = 'flex';
      // Update title based on results
      const titleText = parsedFilters.length > 0 
        ? `Found ${parsedFilters.length} filter${parsedFilters.length > 1 ? 's' : ''} from your request!`
        : 'Understanding your request...';
      elements.aiResponseTitle.querySelector('span').textContent = titleText;
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

    // Render enhanced filter cards for light mode
    if (elements.aiFiltersGrid) {
      if (parsedFilters.length === 0) {
        // Generate sample products based on query
        const sampleProducts = generateSampleProducts(AIFilterState.aiQuery);
        
        elements.aiFiltersGrid.innerHTML = `
          <div class="ai-no-filters-message" style="grid-column: 1 / -1;">
            <div class="ai-suggestion-header">
              <div class="suggestion-icon">
                <i data-lucide="lightbulb"></i>
              </div>
              <div class="suggestion-content">
                <h4>I found some relevant products for you!</h4>
                <p>Here are the top matches based on your search. Click "Apply Filters" to see full results.</p>
              </div>
            </div>
            
            <div class="ai-products-preview-table">
              <table class="products-table">
                <thead>
                  <tr>
                    <th>Part Number</th>
                    <th>Description</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  ${sampleProducts.map(product => `
                    <tr>
                      <td><strong>${product.partNumber}</strong></td>
                      <td>${product.description}</td>
                      <td><span class="brand-badge">${product.brand}</span></td>
                      <td><span class="price-tag">$${product.price}</span></td>
                      <td><span class="stock-badge stock-${product.stock}">${product.stockText}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="ai-filter-suggestions">
              <p class="suggestions-title"><i data-lucide="filter"></i> Try these specific filters:</p>
              <div class="suggestion-chips">
                <button class="suggestion-chip" data-hint="Find ${extractKeywords(AIFilterState.aiQuery)} under $500">
                  <i data-lucide="dollar-sign"></i> Set price range
                </button>
                <button class="suggestion-chip" data-hint="${extractKeywords(AIFilterState.aiQuery)} from OEM suppliers in stock">
                  <i data-lucide="package"></i> Filter by availability
                </button>
                <button class="suggestion-chip" data-hint="German ${extractKeywords(AIFilterState.aiQuery)} with express delivery">
                  <i data-lucide="zap"></i> Add delivery options
                </button>
              </div>
            </div>
          </div>
        `;
        
        // Add click handlers for suggestion chips
        elements.aiFiltersGrid.querySelectorAll('.suggestion-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const hint = chip.dataset.hint;
            if (elements.aiInput) {
              elements.aiInput.value = hint;
              elements.aiInput.focus();
              // Auto-submit after a short delay
              setTimeout(() => handleAISubmit(), 300);
            }
          });
        });
      } else {
        elements.aiFiltersGrid.innerHTML = parsedFilters.map((filter, index) => `
          <div class="ai-filter-card" data-index="${index}" style="animation-delay: ${index * 0.08}s">
            <div class="filter-card-icon">
              <i data-lucide="${filter.icon}"></i>
            </div>
            <div class="ai-filter-card-content">
              <span class="ai-filter-card-label">${filter.label}</span>
              <span class="ai-filter-card-value">${filter.value}</span>
            </div>
            <button class="ai-filter-card-remove" data-index="${index}" title="Remove filter">
              <i data-lucide="x"></i>
            </button>
          </div>
        `).join('');

        // Add remove handlers
        elements.aiFiltersGrid.querySelectorAll('.ai-filter-card-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeAIParsedFilter(index);
          });
        });
      }
    }

    // Apply the parsed filters to the state
    parsedFilters.forEach(filter => {
      if (filter.filterKey === 'brands' || filter.filterKey === 'origins' || filter.filterKey === 'partCategories') {
        if (!AIFilterState.filters[filter.filterKey].includes(filter.filterValue)) {
          AIFilterState.filters[filter.filterKey].push(filter.filterValue);
        }
      } else {
        AIFilterState.filters[filter.filterKey] = filter.filterValue;
      }
    });

    updateFilterCount();

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function removeAIParsedFilter(index) {
    AIFilterState.aiParsedFilters.splice(index, 1);
    displayAIResults(AIFilterState.aiParsedFilters);
  }

  // ====================================
  // MANUAL FILTER CONTROLS
  // ====================================
  function toggleManualFilters() {
    const isCollapsed = elements.manualFiltersContent?.classList.toggle('collapsed');
    elements.collapseBtn?.classList.toggle('collapsed', isCollapsed);
  }

  function toggleBrandChip(chip) {
    const brand = chip.dataset.brand;
    
    if (brand === 'all') {
      // Deselect all others, select 'all'
      document.querySelectorAll('.brand-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AIFilterState.filters.brands = ['all'];
    } else {
      // Deselect 'all', toggle this brand
      document.querySelector('.brand-chip[data-brand="all"]')?.classList.remove('active');
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
        document.querySelector('.brand-chip[data-brand="all"]')?.classList.add('active');
        AIFilterState.filters.brands = ['all'];
      }
    }

    updateFilterCount();
  }

  function toggleStockFilter(toggle) {
    document.querySelectorAll('.stock-toggle').forEach(t => t.classList.remove('active'));
    toggle.classList.add('active');
    AIFilterState.filters.stockStatus = toggle.dataset.stock;
    updateFilterCount();
  }

  function selectRating(btn) {
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
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
      modelSelect.innerHTML = '<option value="">Select model...</option>' +
        vehicleModels[make].map(model => `<option value="${model.toLowerCase()}">${model}</option>`).join('');
    } else {
      modelSelect.disabled = true;
      modelSelect.innerHTML = '<option value="">Select model...</option>';
    }

    AIFilterState.filters.vehicleMake = make;
    updateFilterCount();
  }

  function handleBrandSearch(e) {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.brand-chip').forEach(chip => {
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
        priceFill.style.right = (100 - maxPercent) + '%';

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
    if (AIFilterState.filters.priceMin > 0 || AIFilterState.filters.priceMax < 100000) count++;
    
    // Check brands
    if (AIFilterState.filters.brands.length > 0 && !AIFilterState.filters.brands.includes('all')) count++;
    
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
    const certCheckboxes = document.querySelectorAll('input[name="cert"]:checked');
    if (certCheckboxes.length > 0) count++;

    // Check brand type
    const brandTypeCheckboxes = document.querySelectorAll('input[name="brand-type"]:checked');
    if (brandTypeCheckboxes.length > 0) count++;

    // Check country checkboxes
    const countryCheckboxes = document.querySelectorAll('input[name="origin"]:checked');
    if (countryCheckboxes.length > 0) count++;

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
      engineType: 'all'
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

    // Dispatch custom event for search2.js to listen to
    const event = new CustomEvent('aiFiltersApplied', { detail: filters });
    window.dispatchEvent(event);

    // Close modal
    closeModal();

    // Show success feedback
    showFilterToast(`${AIFilterState.activeFilterCount} filters applied`);

    // Trigger search if there's a query
    const searchInput = document.getElementById('search2-input');
    const searchBtn = document.getElementById('search2-btn');
    if (searchInput?.value.trim() && searchBtn) {
      searchBtn.click();
    }
  }

  function collectAllFilters() {
    const filters = { ...AIFilterState.filters };

    // Collect checkbox values
    filters.discount = Array.from(document.querySelectorAll('input[name="discount"]:checked')).map(cb => cb.value);
    filters.paymentTerms = Array.from(document.querySelectorAll('input[name="payment"]:checked')).map(cb => cb.value);
    filters.brandType = Array.from(document.querySelectorAll('input[name="brand-type"]:checked')).map(cb => cb.value);
    filters.certifications = Array.from(document.querySelectorAll('input[name="cert"]:checked')).map(cb => cb.value);
    filters.returnPolicy = Array.from(document.querySelectorAll('input[name="return"]:checked')).map(cb => cb.value);
    filters.origins = Array.from(document.querySelectorAll('input[name="origin"]:checked')).map(cb => cb.value);

    // Collect radio values
    filters.condition = document.querySelector('input[name="condition"]:checked')?.value || 'all';
    filters.deliveryTime = document.querySelector('input[name="delivery"]:checked')?.value || 'any';
    filters.engineType = document.querySelector('input[name="engine-type"]:checked')?.value || 'all';

    // Collect select values
    filters.shippingTo = document.getElementById('shipping-to')?.value || '';
    filters.vehicleMake = document.getElementById('vehicle-make')?.value || '';
    filters.vehicleModel = document.getElementById('vehicle-model')?.value || '';

    // Collect number inputs
    filters.weightMin = parseFloat(document.getElementById('weight-min')?.value) || 0;
    filters.weightMax = parseFloat(document.getElementById('weight-max')?.value) || 1000;
    filters.yearMin = parseInt(document.getElementById('year-min')?.value) || null;
    filters.yearMax = parseInt(document.getElementById('year-max')?.value) || null;
    filters.minOrderQty = parseInt(document.getElementById('min-order-qty')?.value) || 1;

    // Collect toggles
    filters.verifiedOnly = document.getElementById('verified-only')?.checked || false;
    filters.freeShipping = document.getElementById('free-shipping')?.checked || false;

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
    apply: applyFilters
  };

})();

// ====================================
// SEARCH2 PAGE - PROFESSIONAL SEARCH FUNCTIONALITY
// ====================================

(function () {
  'use strict';

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const state = {
    searchQuery: '',
    selectedFilters: {
      brand: 'all',
      stock: 'all',
      origin: 'all',
      minPrice: 0,
      maxPrice: 100000,
    },
    currentResults: [],
    autocompleteIndex: -1,
    autocompleteResults: [],
  };

  // ====================================
  // MOCK PARTS DATABASE - EXPANDED
  // ====================================
  const mockPartsDatabase = [
    {
      code: '8471474',
      description: 'HYDRAULIC PUMP ASSEMBLY - HIGH PRESSURE SYSTEM',
      brand: 'OEM',
      price: 2450,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '15.5kg',
      delivery: '2-3 days',
      qty: 15,
    },
    {
      code: '8471475',
      description: 'HYDRAULIC PUMP ASSEMBLY - STANDARD GRADE',
      brand: 'OEM',
      price: 1850,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '14.2kg',
      delivery: '2-3 days',
      qty: 8,
    },
    {
      code: '8471476',
      description: 'HYDRAULIC CYLINDER ASSEMBLY',
      brand: 'OEM',
      price: 1650,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '12.3kg',
      delivery: '2-3 days',
      qty: 10,
    },
    {
      code: '8472000',
      description: 'HYDRAULIC FILTER ELEMENT',
      brand: 'OEM',
      price: 85,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '0.8kg',
      delivery: '1-2 days',
      qty: 45,
    },
    {
      code: '8500123',
      description: 'ENGINE CONTROL MODULE',
      brand: 'OEM',
      price: 3200,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '2.1kg',
      delivery: '3-4 days',
      qty: 5,
    },
    {
      code: '8600234',
      description: 'TRANSMISSION CONTROL UNIT',
      brand: 'OEM',
      price: 2800,
      stock: 'low-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '1.8kg',
      delivery: '3-4 days',
      qty: 3,
    },
    {
      code: 'STARTVOLT SWP0110',
      description: 'Starter motor assembly',
      brand: 'STARTVOLT',
      price: 890,
      stock: 'in-stock',
      origin: 'China',
      supplier: 'Parts Direct',
      weight: '4.5kg',
      delivery: '1-2 days',
      qty: 25,
    },
    {
      code: 'STARTVOLT SWP0110X',
      description: 'Starter motor assembly - Premium',
      brand: 'STARTVOLT',
      price: 1200,
      stock: 'in-stock',
      origin: 'Japan',
      supplier: 'Premium Parts Co.',
      weight: '4.8kg',
      delivery: '3-4 days',
      qty: 12,
    },
    {
      code: 'BOSCH 0280155832',
      description: 'Fuel injector',
      brand: 'Bosch',
      price: 320,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '0.3kg',
      delivery: '1-2 days',
      qty: 50,
    },
    {
      code: 'BOSCH 0280155833',
      description: 'Fuel injector - High flow',
      brand: 'Bosch',
      price: 425,
      stock: 'low-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '0.35kg',
      delivery: '2-3 days',
      qty: 5,
    },
    {
      code: 'BOSCH 0986435678',
      description: 'Brake pad set - Ceramic',
      brand: 'Bosch',
      price: 245,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '2.5kg',
      delivery: '1-2 days',
      qty: 35,
    },
    {
      code: 'BOSCH 0124515234',
      description: 'Alternator 90A',
      brand: 'Bosch',
      price: 580,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '5.8kg',
      delivery: '2-3 days',
      qty: 18,
    },
    {
      code: 'SKF VKBA3521',
      description: 'CV joint boot kit',
      brand: 'SKF',
      price: 185,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'SKF Distribution',
      weight: '1.2kg',
      delivery: '1-2 days',
      qty: 40,
    },
    {
      code: 'SKF 6205-2RS',
      description: 'Deep groove ball bearing',
      brand: 'SKF',
      price: 45,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'SKF Distribution',
      weight: '0.2kg',
      delivery: '1-2 days',
      qty: 120,
    },
    {
      code: 'SKF 32008X',
      description: 'Tapered roller bearing',
      brand: 'SKF',
      price: 95,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'SKF Distribution',
      weight: '0.8kg',
      delivery: '1-2 days',
      qty: 65,
    },
    {
      code: 'GATES 36588',
      description: 'Serpentine belt',
      brand: 'Gates',
      price: 95,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Gates Direct',
      weight: '0.5kg',
      delivery: '1-2 days',
      qty: 100,
    },
    {
      code: 'GATES K015678',
      description: 'Timing belt kit complete',
      brand: 'Gates',
      price: 285,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Gates Direct',
      weight: '2.8kg',
      delivery: '2-3 days',
      qty: 25,
    },
    {
      code: 'PARKER 4360-4',
      description: 'Hydraulic hose assembly',
      brand: 'Parker',
      price: 145,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Parker Hannifin',
      weight: '2.1kg',
      delivery: '2-3 days',
      qty: 30,
    },
    {
      code: 'PARKER 3339121234',
      description: 'Hydraulic pump cartridge',
      brand: 'Parker',
      price: 1850,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Parker Hannifin',
      weight: '8.5kg',
      delivery: '3-4 days',
      qty: 8,
    },
    {
      code: 'CONTINENTAL CT1010',
      description: 'Timing belt',
      brand: 'Continental',
      price: 125,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Continental Parts',
      weight: '0.8kg',
      delivery: '1-2 days',
      qty: 60,
    },
    {
      code: 'ACDELCO 45942',
      description: 'Ignition coil',
      brand: 'OEM',
      price: 210,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'GM Parts Direct',
      weight: '0.6kg',
      delivery: '2-3 days',
      qty: 35,
    },
    {
      code: '1234567',
      description: 'Brake disc rotor - Front',
      brand: 'Bosch',
      price: 380,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '8.5kg',
      delivery: '1-2 days',
      qty: 22,
    },
    {
      code: '1234568',
      description: 'Brake disc rotor - Rear',
      brand: 'Bosch',
      price: 350,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '7.5kg',
      delivery: '1-2 days',
      qty: 20,
    },
    {
      code: '1111111',
      description: 'Oil filter standard',
      brand: 'OEM',
      price: 25,
      stock: 'in-stock',
      origin: 'China',
      supplier: 'Parts Direct',
      weight: '0.3kg',
      delivery: '1-2 days',
      qty: 200,
    },
    {
      code: '2222222',
      description: 'Cabin air filter',
      brand: 'OEM',
      price: 35,
      stock: 'in-stock',
      origin: 'China',
      supplier: 'Parts Direct',
      weight: '0.2kg',
      delivery: '1-2 days',
      qty: 150,
    },
    {
      code: '3333333',
      description: 'Wiper blade set',
      brand: 'OEM',
      price: 45,
      stock: 'in-stock',
      origin: 'China',
      supplier: 'Parts Direct',
      weight: '0.5kg',
      delivery: '1-2 days',
      qty: 85,
    },
    {
      code: '9876543',
      description: 'Timing belt kit',
      brand: 'SKF',
      price: 295,
      stock: 'low-stock',
      origin: 'USA',
      supplier: 'SKF Distribution',
      weight: '3.2kg',
      delivery: '3-4 days',
      qty: 7,
    },
    {
      code: '9876544',
      description: 'Water pump assembly',
      brand: 'SKF',
      price: 385,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'SKF Distribution',
      weight: '4.2kg',
      delivery: '2-3 days',
      qty: 15,
    },
    {
      code: '4567890',
      description: 'Spark plug set - Iridium',
      brand: 'Bosch',
      price: 165,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '0.4kg',
      delivery: '1-2 days',
      qty: 80,
    },
    {
      code: '3210987',
      description: 'Air filter element',
      brand: 'OEM',
      price: 45,
      stock: 'in-stock',
      origin: 'China',
      supplier: 'Parts Direct',
      weight: '0.3kg',
      delivery: '1-2 days',
      qty: 150,
    },
    {
      code: '8000123',
      description: 'BRAKE CALIPER ASSEMBLY - FRONT LEFT',
      brand: 'OEM',
      price: 520,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'AutoTech GmbH',
      weight: '5.2kg',
      delivery: '2-3 days',
      qty: 18,
    },
    {
      code: '8123456',
      description: 'ALTERNATOR ASSEMBLY - 120 AMP',
      brand: 'Bosch',
      price: 680,
      stock: 'in-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '6.8kg',
      delivery: '1-2 days',
      qty: 14,
    },
    {
      code: '8234567',
      description: 'WATER PUMP ASSEMBLY - ALUMINUM HOUSING',
      brand: 'Gates',
      price: 340,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Gates Direct',
      weight: '3.5kg',
      delivery: '2-3 days',
      qty: 20,
    },
    {
      code: '8345678',
      description: 'FUEL PUMP MODULE - HIGH PRESSURE',
      brand: 'Bosch',
      price: 480,
      stock: 'low-stock',
      origin: 'Germany',
      supplier: 'Bosch Authorized',
      weight: '2.8kg',
      delivery: '3-4 days',
      qty: 6,
    },
    {
      code: '8456789',
      description: 'POWER STEERING PUMP - VARIABLE DISPLACEMENT',
      brand: 'Parker',
      price: 1250,
      stock: 'in-stock',
      origin: 'USA',
      supplier: 'Parker Hannifin',
      weight: '8.2kg',
      delivery: '2-3 days',
      qty: 10,
    },
  ];

  // ====================================
  // DOM ELEMENTS
  // ====================================
  const elements = {
    searchInput: document.getElementById('search2-input'),
    searchBtn: document.getElementById('search2-btn'),
    clearBtn: document.getElementById('search2-clear'),
    resetBtn: document.getElementById('search2-reset-btn'),
    autocompleteContainer: document.getElementById('search2-autocomplete'),
    resultsHeader: document.getElementById('results-header'),
    resultsCount: document.getElementById('results-count'),
    resultsTableContainer: document.getElementById('results-table-container'),
    resultsTableBody: document.getElementById('results-table-body'),
    emptyState: document.getElementById('empty-state'),
    noResultsState: document.getElementById('no-results-state'),
    noResultsQuery: document.getElementById('no-results-query'),
    filtersPanel: document.getElementById('filters-sidebar'),
    filtersPanelClose: document.getElementById('filters-close'),
    filtersBackdrop: document.getElementById('filters-backdrop'),
    advancedFilterTrigger: document.getElementById('advanced-filter-trigger'),
    excelUploadTrigger: document.getElementById('excel-upload-trigger'),
    excelModal: document.getElementById('excel-modal'),
    excelModalClose: document.getElementById('excel-modal-close'),
    excelModalOverlay: document.getElementById('excel-modal-overlay'),
    uploadArea: document.getElementById('upload-area'),
    excelFileInput: document.getElementById('excel-file-input'),
    browseFileBtn: document.getElementById('browse-file-btn'),
    clearAllFilters: document.getElementById('clear-filters'),
    applyFilters: document.getElementById('apply-filters'),
    tryAgainBtn: document.getElementById('try-again-btn'),
  };

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    setupEventListeners();
    initializeFilters();
    checkAuthAndUpdateUI();
    console.log('Search2 page initialized');
  }

  // ====================================
  // AUTHENTICATION CHECK
  // ====================================
  function checkAuthAndUpdateUI() {
    // Check if user is logged in
    const isLoggedIn =
      typeof window.BuyerAuth !== 'undefined' && window.BuyerAuth.isLoggedIn();

    if (!isLoggedIn) {
      // Keep inputs enabled but update placeholder to indicate login needed
      if (elements.searchInput) {
        elements.searchInput.disabled = false;
        elements.searchInput.placeholder =
          'Please sign in to search for parts...';
        elements.searchInput.style.cursor = 'text';
        elements.searchInput.style.opacity = '1';
      }

      // Keep search button enabled
      if (elements.searchBtn) {
        elements.searchBtn.disabled = false;
        elements.searchBtn.style.cursor = 'pointer';
        elements.searchBtn.style.opacity = '1';
      }

      // Keep Excel upload enabled
      if (elements.excelUploadTrigger) {
        elements.excelUploadTrigger.disabled = false;
        elements.excelUploadTrigger.style.cursor = 'pointer';
        elements.excelUploadTrigger.style.opacity = '1';
      }

      // Keep advanced filters enabled
      if (elements.advancedFilterTrigger) {
        elements.advancedFilterTrigger.disabled = false;
        elements.advancedFilterTrigger.style.cursor = 'pointer';
        elements.advancedFilterTrigger.style.opacity = '1';
      }

      // Update empty state message to show login prompt
      if (elements.emptyState) {
        const emptyStateTitle =
          elements.emptyState.querySelector('.empty-state-title');
        const emptyStateDescription = elements.emptyState.querySelector(
          '.empty-state-description'
        );
        if (emptyStateTitle) {
          emptyStateTitle.textContent = 'Sign In Required';
        }
        if (emptyStateDescription) {
          emptyStateDescription.innerHTML =
            'Please <strong>sign in</strong> to search for parts from verified suppliers worldwide.';
        }
      }
    } else {
      // Enable search input
      if (elements.searchInput) {
        elements.searchInput.disabled = false;
        // Restore original placeholder based on page
        const pageTheme = document.querySelector('.search2-page')?.classList;
        if (pageTheme?.contains('automotive-theme')) {
          elements.searchInput.placeholder =
            'Enter part number, vehicle model, or description...';
        } else if (pageTheme?.contains('aviation-theme')) {
          elements.searchInput.placeholder =
            'Enter part number, aircraft model, or description...';
        } else if (pageTheme?.contains('machinery-theme')) {
          elements.searchInput.placeholder =
            'Enter part number, equipment model, or description...';
        } else {
          elements.searchInput.placeholder =
            'Enter part number, brand name, or description...';
        }
        elements.searchInput.style.cursor = 'text';
        elements.searchInput.style.opacity = '1';
      }

      // Enable search button
      if (elements.searchBtn) {
        elements.searchBtn.disabled = false;
        elements.searchBtn.style.cursor = 'pointer';
        elements.searchBtn.style.opacity = '1';
      }

      // Enable Excel upload
      if (elements.excelUploadTrigger) {
        elements.excelUploadTrigger.disabled = false;
        elements.excelUploadTrigger.style.cursor = 'pointer';
        elements.excelUploadTrigger.style.opacity = '1';
      }

      // Enable advanced filters
      if (elements.advancedFilterTrigger) {
        elements.advancedFilterTrigger.disabled = false;
        elements.advancedFilterTrigger.style.cursor = 'pointer';
        elements.advancedFilterTrigger.style.opacity = '1';
      }

      // Restore original empty state message
      if (elements.emptyState) {
        const emptyStateTitle =
          elements.emptyState.querySelector('.empty-state-title');
        const emptyStateDescription = elements.emptyState.querySelector(
          '.empty-state-description'
        );
        if (emptyStateTitle) {
          emptyStateTitle.textContent = 'Start Your Search';
        }
        if (emptyStateDescription) {
          emptyStateDescription.innerHTML =
            'Enter a part number, brand name, or description to find parts from verified suppliers worldwide.';
        }
      }
    }
  }

  // Listen for login events (when user logs in)
  function setupAuthListener() {
    // Listen for custom login event
    window.addEventListener('userLoggedIn', () => {
      checkAuthAndUpdateUI();
    });

    // Also listen for storage changes (when login happens in another tab)
    window.addEventListener('storage', () => {
      checkAuthAndUpdateUI();
    });

    // Check auth status periodically (fallback)
    setInterval(() => {
      checkAuthAndUpdateUI();
    }, 2000);
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function setupEventListeners() {
    // Search input events
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.searchInput?.addEventListener('keydown', handleSearchKeydown);
    // Note: We don't show modal on focus - only when user tries to type or search
    elements.searchBtn?.addEventListener('click', performSearch);
    elements.clearBtn?.addEventListener('click', clearSearch);
    elements.resetBtn?.addEventListener('click', resetSearch);

    // Autocomplete
    document.addEventListener('click', handleOutsideClick);

    // Popular searches
    document.querySelectorAll('.popular-chip').forEach((chip) => {
      chip.addEventListener('click', function () {
        const searchTerm = this.dataset.search;
        elements.searchInput.value = searchTerm;
        performSearch();
      });
    });

    // Sort
    // Remove sort select since we're using table

    // Filters
    elements.advancedFilterTrigger?.addEventListener('click', () => {
      // Check if user is logged in
      if (
        typeof window.BuyerAuth === 'undefined' ||
        !window.BuyerAuth.isLoggedIn()
      ) {
        if (typeof window.showLoginModal === 'function') {
          window.showLoginModal();
        }
        return;
      }
      showFiltersPanel();
    });
    elements.filtersPanelClose?.addEventListener('click', hideFiltersPanel);
    elements.filtersBackdrop?.addEventListener('click', hideFiltersPanel);
    elements.clearAllFilters?.addEventListener('click', clearFilters);
    elements.applyFilters?.addEventListener('click', applyFilters);

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', handleFilterChipClick);
    });

    // Excel modal
    elements.excelUploadTrigger?.addEventListener('click', () => {
      // Check if user is logged in
      if (
        typeof window.BuyerAuth === 'undefined' ||
        !window.BuyerAuth.isLoggedIn()
      ) {
        if (typeof window.showLoginModal === 'function') {
          window.showLoginModal();
        }
        return;
      }
      showExcelModal();
    });
    elements.excelModalClose?.addEventListener('click', hideExcelModal);
    elements.excelModalOverlay?.addEventListener('click', hideExcelModal);
    elements.browseFileBtn?.addEventListener('click', () =>
      elements.excelFileInput?.click()
    );
    elements.uploadArea?.addEventListener('click', () =>
      elements.excelFileInput?.click()
    );

    // Drag and drop
    setupDragAndDrop();

    // Add to Cart button
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', handleAddToCart);
    }
  }

  // ====================================
  // SEARCH FUNCTIONALITY
  // ====================================
  function handleSearchInput(e) {
    const query = e.target.value.trim();

    // Check if user is logged in before showing autocomplete
    if (
      typeof window.BuyerAuth === 'undefined' ||
      !window.BuyerAuth.isLoggedIn()
    ) {
      // If user types and is not logged in, show login modal
      if (query.length > 0) {
        if (typeof window.showLoginModal === 'function') {
          window.showLoginModal();
        }
        // Clear the input after showing modal
        setTimeout(() => {
          elements.searchInput.value = '';
        }, 100);
        return;
      }
      return;
    }

    // Show/hide clear button
    if (query.length > 0) {
      elements.clearBtn.style.display = 'flex';
    } else {
      elements.clearBtn.style.display = 'none';
      hideAutocomplete();
    }

    // Show autocomplete suggestions from first character
    if (query.length >= 1) {
      showAutocomplete(query);
    } else {
      hideAutocomplete();
    }
  }

  function handleSearchKeydown(e) {
    const items =
      elements.autocompleteContainer.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.autocompleteIndex = Math.min(
        state.autocompleteIndex + 1,
        items.length - 1
      );
      updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.autocompleteIndex = Math.max(state.autocompleteIndex - 1, -1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state.autocompleteIndex >= 0 && items[state.autocompleteIndex]) {
        selectAutocompleteItem(state.autocompleteIndex);
      } else {
        performSearch();
      }
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  }

  function performSearch() {
    const query = elements.searchInput.value.trim();

    if (!query) {
      return;
    }

    // Check if user is logged in
    if (
      typeof window.BuyerAuth === 'undefined' ||
      !window.BuyerAuth.isLoggedIn()
    ) {
      // Show login modal
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      } else {
        // Fallback: show alert
        alert('Please sign in to search for parts.');
      }
      return;
    }

    state.searchQuery = query;
    hideAutocomplete();

    // Show loading state
    if (elements.resultsHeader) elements.resultsHeader.style.display = 'flex';
    if (elements.resultsTableContainer)
      elements.resultsTableContainer.style.display = 'block';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.noResultsState) elements.noResultsState.style.display = 'none';
    if (elements.resetBtn) elements.resetBtn.style.display = 'inline-flex';

    // Clear table and show loading
    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML =
        '<tr><td colspan="12" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div> Searching...</td></tr>';
    }

    // Build query parameters
    const params = new URLSearchParams({
      q: query,
      limit: 100,
    });

    // Add filters
    if (state.selectedFilters.brand !== 'all') {
      params.append('brand', state.selectedFilters.brand);
    }
    if (state.selectedFilters.minPrice > 0) {
      params.append('minPrice', state.selectedFilters.minPrice);
    }
    if (state.selectedFilters.maxPrice < 100000) {
      params.append('maxPrice', state.selectedFilters.maxPrice);
    }
    if (state.selectedFilters.stock === 'in-stock') {
      params.append('inStock', 'true');
    }

    // Make API call to search for parts
    fetch(`/buyer/api/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    })
      .then((response) => {
        // Check for authentication errors
        if (response.status === 401) {
          throw new Error('Authentication required. Please login.');
        }
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Search API response:', data);
        
        if (data.success && data.results && data.results.length > 0) {
          // Apply any remaining client-side filters
          const filteredResults = data.results.filter((part) => {
            const matchesOrigin =
              state.selectedFilters.origin === 'all' ||
              (part.origin && part.origin.toLowerCase() ===
                state.selectedFilters.origin.toLowerCase());

            return matchesOrigin;
          });

          state.currentResults = filteredResults;
          displayResults(filteredResults);

          // Show search info
          if (data.searchTime) {
            console.log(`Search completed in ${data.searchTime} (${data.source})`);
          }
        } else {
          // No results found
          console.log('No results found for query:', query);
          state.currentResults = [];
          displayResults([]);
        }
      })
      .catch((error) => {
        console.error('Search error:', error);
        if (error.message.includes('Authentication')) {
          // Show login modal
          if (typeof window.showLoginModal === 'function') {
            window.showLoginModal();
          }
          if (elements.resultsTableBody) {
            elements.resultsTableBody.innerHTML =
              '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #f39c12;">Please login to search for parts.</td></tr>';
          }
        } else {
          if (elements.resultsTableBody) {
            elements.resultsTableBody.innerHTML =
              '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #e74c3c;">Error searching for parts. Please try again.</td></tr>';
          }
        }
      });
  }

  function clearSearch() {
    elements.searchInput.value = '';
    elements.clearBtn.style.display = 'none';
    hideAutocomplete();
    elements.searchInput.focus();
  }

  function resetSearch() {
    // Clear search input
    elements.searchInput.value = '';
    elements.clearBtn.style.display = 'none';
    elements.resetBtn.style.display = 'none';

    // Hide autocomplete
    hideAutocomplete();

    // Hide results
    elements.resultsHeader.style.display = 'none';
    elements.resultsTableContainer.style.display = 'none';
    elements.noResultsState.style.display = 'none';

    // Show empty state
    elements.emptyState.style.display = 'block';

    // Clear state
    state.searchQuery = '';
    state.currentResults = [];

    // Focus input
    elements.searchInput.focus();
  }

  // ====================================
  // AUTOCOMPLETE
  // ====================================
  function showAutocomplete(query) {
    if (query.length < 2) {
      hideAutocomplete();
      return;
    }

    // Fetch autocomplete suggestions from API
    fetch(`/buyer/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=10`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Autocomplete request failed');
        }
        return response.json();
      })
      .then((data) => {
        if (data.success && data.suggestions && data.suggestions.length > 0) {
          state.autocompleteResults = data.suggestions.map((s) => ({
            code: s.partNumber,
            description: s.description || '',
            brand: s.brand || '',
            supplier: s.supplier || '',
          }));
          state.autocompleteIndex = -1;

          // Render suggestions
          elements.autocompleteContainer.innerHTML = state.autocompleteResults
            .map(
              (part, index) => `
                  <div class="autocomplete-item" data-index="${index}">
                      <div class="autocomplete-icon">
                          <i data-lucide="package"></i>
                      </div>
                      <div class="autocomplete-content">
                          <div class="autocomplete-title">${highlightMatch(
                            part.code,
                            query
                          )}</div>
                          <div class="autocomplete-description">${highlightMatch(
                            part.description,
                            query
                          )}</div>
                      </div>
                  </div>
              `
            )
            .join('');

          // Add click handlers
          elements.autocompleteContainer
            .querySelectorAll('.autocomplete-item')
            .forEach((item, index) => {
              item.addEventListener('click', () => selectAutocompleteItem(index));
            });

          elements.autocompleteContainer.classList.add('show');

          // Reinitialize Lucide icons
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        } else {
          hideAutocomplete();
        }
      })
      .catch((error) => {
        console.error('Autocomplete error:', error);
        hideAutocomplete();
      });
  }

  function hideAutocomplete() {
    elements.autocompleteContainer.classList.remove('show');
    state.autocompleteIndex = -1;
  }

  function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
      item.classList.toggle('active', index === state.autocompleteIndex);
      if (index === state.autocompleteIndex) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function selectAutocompleteItem(index) {
    const selected = state.autocompleteResults[index];
    if (selected) {
      elements.searchInput.value = selected.code;
      hideAutocomplete();
      performSearch();
    }
  }

  function highlightMatch(text, query) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function handleOutsideClick(e) {
    if (
      !elements.searchInput?.contains(e.target) &&
      !elements.autocompleteContainer?.contains(e.target)
    ) {
      hideAutocomplete();
    }
  }

  // ====================================
  // RESULTS DISPLAY
  // ====================================
  function displayResults(results) {
    if (results.length === 0) {
      showNoResults();
      return;
    }

    hideEmptyState();
    hideNoResults();

    // Show reset button
    if (elements.resetBtn) {
      elements.resetBtn.style.display = 'flex';
    }

    // Update count
    elements.resultsCount.textContent = results.length;
    elements.resultsHeader.style.display = 'flex';
    elements.resultsGrid ? (elements.resultsGrid.style.display = 'none') : null;

    // Show table container
    const tableContainer = document.getElementById('results-table-container');
    const tableBody = document.getElementById('results-table-body');

    if (tableContainer && tableBody) {
      tableContainer.style.display = 'block';

      // Render table rows - Updated to use Elasticsearch/MongoDB API data format
      tableBody.innerHTML = results
        .map((part) => {
          // Handle both API formats (new Elasticsearch format and legacy)
          const price = part.price || part.unitPrice || 0;
          const code = part.partNumber || part.vendorCode || part.code || 'N/A';
          const quantity = part.quantity || part.stock || part.qty || 0;
          const weight = part.weight
            ? typeof part.weight === 'number'
              ? `${part.weight} kg`
              : part.weight
            : 'N/A';
          const deliveryDays = part.deliveryDays || part.delivery;
          const delivery = deliveryDays
            ? typeof deliveryDays === 'number'
              ? `${deliveryDays} days`
              : deliveryDays
            : 'N/A';

          // Determine stock status based on quantity or stock field
          let stockStatus = part.stock || 'unknown';
          let stockBadge = 'ST1';
          if (typeof stockStatus === 'string') {
            if (stockStatus === 'out-of-stock') stockBadge = 'ST3';
            else if (stockStatus === 'low-stock') stockBadge = 'ST2';
            else stockBadge = 'ST1';
          } else {
            if (quantity <= 5) {
              stockStatus = 'out-stock';
              stockBadge = 'ST3';
            } else if (quantity <= 10) {
              stockStatus = 'low-stock';
              stockBadge = 'ST2';
            }
          }

          // Get part ID for cart functionality
          const partId = part._id || part.id || code;

          return `
                <tr data-part-code="${code}" data-part-id="${partId}" data-part-index="${results.indexOf(
            part
          )}">
                    <td>
                        <input type="checkbox" class="table-checkbox" data-price="${price}" onchange="updateSelectedTotal()">
                    </td>
                    <td><strong>${part.brand || 'N/A'}</strong></td>
                    <td><strong>${code}</strong></td>
                    <td>${part.description || 'N/A'}</td>
                    <td>${part.supplier || part.integrationName || 'N/A'}</td>
                    <td>${part.origin || 'N/A'}</td>
                    <td>${quantity}</td>
                    <td>
                        <span class="stock-badge ${stockBadge.toLowerCase()}">${stockBadge}</span>
                    </td>
                    <td>${weight}</td>
                    <td>${delivery}</td>
                    <td>
                        <div class="order-qty-controls">
                            <button class="qty-btn" onclick="decrementQty(this)">−</button>
                            <input type="number" class="qty-input" value="1" min="1" max="${Math.max(quantity, 999)}" onchange="updateRowTotal(this)" oninput="updateRowTotal(this)">
                            <button class="qty-btn" onclick="incrementQty(this)">+</button>
                        </div>
                    </td>
                    <td>
                        <strong class="row-total">${formatPrice(
                          price
                        )}</strong> ${part.currency || 'USD'}
                    </td>
                    <td>
                        <button class="btn-add-single-to-cart" data-part-index="${results.indexOf(
                          part
                        )}" title="Add to cart">
                            <i data-lucide="shopping-cart"></i>
                            <i data-lucide="plus" class="plus-icon"></i>
                        </button>
                    </td>
                </tr>
            `;
        })
        .join('');

      // Attach event listeners to add-to-cart buttons
      attachSingleAddToCartListeners();
    }

    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function showNoResults() {
    // Show reset button
    if (elements.resetBtn) {
      elements.resetBtn.style.display = 'flex';
    }

    elements.resultsHeader.style.display = 'none';
    const tableContainer = document.getElementById('results-table-container');
    if (tableContainer) tableContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.noResultsState.style.display = 'flex';
    elements.noResultsQuery.textContent = state.searchQuery;
  }

  function hideNoResults() {
    elements.noResultsState.style.display = 'none';
  }

  function showEmptyState() {
    elements.resultsHeader.style.display = 'none';
    const tableContainer = document.getElementById('results-table-container');
    if (tableContainer) tableContainer.style.display = 'none';
    elements.noResultsState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
  }

  function hideEmptyState() {
    elements.emptyState.style.display = 'none';
  }

  // ====================================
  // FILTERS
  // ====================================
  function initializeFilters() {
    // Initialize price inputs
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');

    if (minPriceInput) minPriceInput.value = state.selectedFilters.minPrice;
    if (maxPriceInput) maxPriceInput.value = state.selectedFilters.maxPrice;
  }

  function handleFilterChipClick(e) {
    const chip = e.currentTarget;
    const filterType = chip.dataset.filter;
    const filterValue = chip.dataset.value;

    // Toggle active state
    const group = chip.closest('.filter-group');
    group
      .querySelectorAll('.filter-chip')
      .forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    // Update state
    state.selectedFilters[filterType] = filterValue;
  }

  function clearFilters() {
    state.selectedFilters = {
      brand: 'all',
      stock: 'all',
      origin: 'all',
      minPrice: 0,
      maxPrice: 100000,
    };

    // Reset UI
    document.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.classList.remove('active');
      if (chip.dataset.value === 'all') {
        chip.classList.add('active');
      }
    });

    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    if (minPriceInput) minPriceInput.value = 0;
    if (maxPriceInput) maxPriceInput.value = 100000;
  }

  function applyFilters() {
    // Update price filters
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');

    if (minPriceInput)
      state.selectedFilters.minPrice = parseInt(minPriceInput.value) || 0;
    if (maxPriceInput)
      state.selectedFilters.maxPrice = parseInt(maxPriceInput.value) || 100000;

    // Re-run search if there's a query
    if (state.searchQuery) {
      performSearch();
    }

    // Hide filters panel on mobile
    hideFiltersPanel();
  }

  function showFiltersPanel() {
    elements.filtersPanel?.classList.add('active');
    elements.filtersBackdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function hideFiltersPanel() {
    elements.filtersPanel?.classList.remove('active');
    elements.filtersBackdrop?.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ====================================
  // EXCEL MODAL
  // ====================================
  function showExcelModal() {
    elements.excelModal?.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function hideExcelModal() {
    elements.excelModal?.classList.remove('show');
    document.body.style.overflow = '';
  }

  function setupDragAndDrop() {
    if (!elements.uploadArea) return;

    elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.uploadArea.classList.add('drag-over');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
      elements.uploadArea.classList.remove('drag-over');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.uploadArea.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });

    elements.excelFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileUpload(file);
      }
    });
  }

  function handleFileUpload(file) {
    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!validTypes.includes(fileExtension)) {
      alert('Please upload a valid Excel file (.xlsx, .xls, or .csv)');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    console.log('File uploaded:', file.name);

    // TODO: Implement actual file upload to server
    // For now, just show a message
    alert(`File "${file.name}" ready for upload. Server integration pending.`);
    hideExcelModal();
  }

  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  function formatPrice(price) {
    return price.toFixed(2);
  }

  function formatStock(stock) {
    switch (stock) {
      case 'in-stock':
        return 'In Stock';
      case 'low-stock':
        return 'Low Stock';
      case 'out-of-stock':
        return 'Out of Stock';
      default:
        return stock;
    }
  }

  // ====================================
  // GLOBAL FUNCTIONS (for inline onclick)
  // ====================================
  window.addToCart = function (partCode) {
    console.log('Adding to cart:', partCode);
    alert(`Part ${partCode} added to cart!`);
    // TODO: Implement actual cart functionality
  };

  window.incrementQty = function (btn) {
    const input = btn.previousElementSibling;
    const max = parseInt(input.max) || 999;
    const current = parseInt(input.value) || 1;
    if (current < max) {
      input.value = current + 1;
      updateRowTotal(input);
    }
  };

  window.decrementQty = function (btn) {
    const input = btn.nextElementSibling;
    const min = parseInt(input.min) || 1;
    const current = parseInt(input.value) || 1;
    if (current > min) {
      input.value = current - 1;
      updateRowTotal(input);
    }
  };

  window.updateRowTotal = function (input) {
    const row = input.closest('tr');
    const checkbox = row.querySelector('.table-checkbox');
    const price = parseFloat(checkbox.dataset.price) || 0;
    const qty = parseInt(input.value) || 1;
    const total = price * qty;

    const totalCell = row.querySelector('.row-total');
    if (totalCell) {
      totalCell.textContent = formatPrice(total);
    }

    // Update selected total if checkbox is checked
    if (checkbox && checkbox.checked) {
      updateSelectedTotal();
    }
  };

  window.updateSelectedTotal = function () {
    let total = 0;
    let count = 0;

    document.querySelectorAll('.table-checkbox:checked').forEach((checkbox) => {
      const row = checkbox.closest('tr');
      const qtyInput = row.querySelector('.qty-input');
      const price = parseFloat(checkbox.dataset.price) || 0;
      const qty = parseInt(qtyInput?.value) || 1;

      total += price * qty;
      count++;
    });

    // Update totals
    const selectedTotal = document.getElementById('selected-total');
    const selectedTotalFooter = document.getElementById(
      'selected-total-footer'
    );
    const selectedCount = document.getElementById('selected-count');

    if (selectedTotal) selectedTotal.textContent = formatPrice(total) + ' AED';
    if (selectedTotalFooter)
      selectedTotalFooter.textContent = formatPrice(total) + ' AED';
    if (selectedCount) selectedCount.textContent = count;

    // Update selection badge
    const selectionStatus = document.getElementById('selection-status');
    const selectedBadge = document.getElementById('selected-badge');
    const selectedItemsCount = document.getElementById('selected-items-count');

    if (count > 0) {
      if (selectionStatus) selectionStatus.style.display = 'none';
      if (selectedBadge) selectedBadge.style.display = 'inline-flex';
      if (selectedItemsCount) selectedItemsCount.textContent = count;
    } else {
      if (selectionStatus) selectionStatus.style.display = 'inline';
      if (selectedBadge) selectedBadge.style.display = 'none';
    }

    // Enable/disable add to cart button
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
      addToCartBtn.disabled = count === 0;
    }
  };

  // ====================================
  // ADD TO CART FUNCTIONALITY
  // ====================================
  function attachSingleAddToCartListeners() {
    const addButtons = document.querySelectorAll('.btn-add-single-to-cart');
    addButtons.forEach((button) => {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        const partIndex = parseInt(this.dataset.partIndex);
        handleAddSingleToCart(partIndex);
      });
    });

    // Re-create lucide icons for the new buttons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }
  }

  function handleAddSingleToCart(partIndex) {
    // Check if cart API is available
    if (typeof window.PartsFormCart === 'undefined') {
      console.error('Cart API not loaded');
      showCartAlert('error', 'Error', 'Shopping cart is not available');
      return;
    }

    const partData = state.currentResults[partIndex];
    if (!partData) {
      showCartAlert('error', 'Error', 'Part not found');
      return;
    }

    // Get the row to find the quantity input
    const rows = document.querySelectorAll('tr[data-part-index]');
    let qtyInput = null;
    let addButton = null;
    rows.forEach((row) => {
      if (parseInt(row.dataset.partIndex) === partIndex) {
        qtyInput = row.querySelector('.qty-input');
        addButton = row.querySelector('.btn-add-single-to-cart');
      }
    });

    const quantity = parseInt(qtyInput?.value) || 1;
    const pageCategory = determineCategory();

    // Prepare cart item
    const cartItem = {
      code: partData.vendorCode || partData.code || 'N/A',
      brand: partData.brand || 'N/A',
      description: partData.description || 'N/A',
      terms: partData.terms || 'N/A',
      weight: parseFloat(partData.weight) || 0,
      stock: determineStockStatus(partData.stock || partData.qty || 0),
      aircraftType: partData.aircraftType || 'N/A',
      quantity: quantity,
      price: parseFloat(partData.unitPrice || partData.price) || 0,
      reference: '',
      category: pageCategory,
    };

    // Add visual feedback - success animation
    if (addButton) {
      addButton.classList.add('added');
      setTimeout(() => {
        addButton.classList.remove('added');
      }, 500);
    }

    // Add to cart
    window.PartsFormCart.addToCart(cartItem);

    // Show success message with animation
    showCartAlert(
      'success',
      'Added to Cart',
      `${cartItem.code} (${quantity} pcs) added successfully`
    );

    // Reset quantity to 1
    if (qtyInput) {
      qtyInput.value = 1;
    }
  }

  function handleAddToCart() {
    // Check if cart API is available
    if (typeof window.PartsFormCart === 'undefined') {
      console.error('Cart API not loaded');
      showCartAlert('error', 'Error', 'Shopping cart is not available');
      return;
    }

    // Get all checked items
    const checkedBoxes = document.querySelectorAll('.table-checkbox:checked');

    if (checkedBoxes.length === 0) {
      showCartAlert(
        'info',
        'No Selection',
        'Please select items to add to cart'
      );
      return;
    }

    let addedCount = 0;

    checkedBoxes.forEach((checkbox) => {
      const row = checkbox.closest('tr');
      const partIndex = parseInt(row.dataset.partIndex);
      const qtyInput = row.querySelector('.qty-input');
      const quantity = parseInt(qtyInput?.value) || 1;

      // Find the part data from current results using the unique index
      const partData = state.currentResults[partIndex];

      if (partData) {
        // Determine current page category
        const pageCategory = determineCategory();

        // Prepare cart item
        const cartItem = {
          code: partData.vendorCode || partData.code || 'N/A',
          brand: partData.brand || 'N/A',
          description: partData.description || 'N/A',
          terms: partData.terms || 'N/A',
          weight: parseFloat(partData.weight) || 0,
          stock: determineStockStatus(partData.stock || partData.qty || 0),
          aircraftType: partData.aircraftType || 'N/A',
          quantity: quantity,
          price: parseFloat(partData.unitPrice || partData.price) || 0,
          reference: '',
          category: pageCategory,
        };

        // Add to cart
        window.PartsFormCart.addToCart(cartItem);
        addedCount++;

        // Uncheck the checkbox
        checkbox.checked = false;
      }
    });

    // Update selected total
    if (typeof window.updateSelectedTotal === 'function') {
      window.updateSelectedTotal();
    }

    // Show success message
    if (addedCount > 0) {
      showCartAlert(
        'success',
        'Added to Cart',
        `${addedCount} item(s) added successfully`
      );
    }
  }

  function determineCategory() {
    const path = window.location.pathname;
    if (path.includes('automotive')) return 'automotive';
    if (path.includes('aviation')) return 'aviation';
    if (path.includes('machinery')) return 'machinery';
    return 'general';
  }

  function determineStockStatus(quantity) {
    const qty = parseInt(quantity) || 0;
    if (qty <= 5) return 'ST3';
    if (qty <= 10) return 'ST2';
    return 'ST1';
  }

  function showCartAlert(type, title, message) {
    // Get or create a single persistent alerts container
    let alertsContainer = document.getElementById('search2-alerts-container');
    
    if (!alertsContainer) {
      alertsContainer = document.createElement('div');
      alertsContainer.id = 'search2-alerts-container';
      alertsContainer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 2rem;
        z-index: 9999;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        pointer-events: none;
      `;
      document.body.appendChild(alertsContainer);
    }

    // Create individual alert
    const alert = document.createElement('div');
    alert.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 12px 40px rgba(43, 82, 120, 0.15);
      border-left: 4px solid ${
        type === 'success'
          ? '#16a34a'
          : type === 'error'
          ? '#dc2626'
          : '#3b82f6'
      };
      animation: slideInRight 0.3s ease-out;
      pointer-events: auto;
      margin-bottom: 0;
    `;

    const iconColor =
      type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#3b82f6';
    const iconName =
      type === 'success'
        ? 'check-circle'
        : type === 'error'
        ? 'x-circle'
        : 'info';

    alert.innerHTML = `
      <div style="flex-shrink: 0; width: 24px; height: 24px; color: ${iconColor};">
        <i data-lucide="${iconName}"></i>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: #1a2b3d; margin-bottom: 0.25rem; font-size: 0.9375rem;">
          ${title}
        </div>
        <p style="color: #475569; font-size: 0.875rem; margin: 0;">
          ${message}
        </p>
      </div>
      <button style="flex-shrink: 0; width: 20px; height: 20px; background: transparent; border: none; cursor: pointer; color: #64748b;">
        <i data-lucide="x"></i>
      </button>
    `;

    // Append alert to container
    alertsContainer.appendChild(alert);

    // Re-create icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }

    // Close button handler
    const closeBtn = alert.querySelector('button');
    closeBtn.addEventListener('click', () => {
      alert.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (alert.parentElement) {
          alert.remove();
        }
        // Remove container if empty
        if (alertsContainer && alertsContainer.children.length === 0) {
          alertsContainer.remove();
        }
      }, 300);
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alert.parentElement) {
        alert.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
          if (alert.parentElement) {
            alert.remove();
          }
          // Remove container if empty
          if (alertsContainer && alertsContainer.children.length === 0) {
            alertsContainer.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  // ====================================
  // INITIALIZE ON DOM READY
  // ====================================

  // Handle table scroll indicator for mobile
  function initTableScrollIndicator() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const tableContainer = document.getElementById('results-table-container');

    if (tableWrapper && tableContainer) {
      tableWrapper.addEventListener('scroll', function () {
        if (this.scrollLeft > 50) {
          tableContainer.classList.add('scrolled');
        } else {
          tableContainer.classList.remove('scrolled');
        }
      });

      // Auto-hide indicator after 3 seconds on mobile
      if (window.innerWidth <= 767) {
        setTimeout(() => {
          tableContainer.classList.add('scrolled');
        }, 3000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initTableScrollIndicator();
      setupAuthListener();
    });
  } else {
    init();
    initTableScrollIndicator();
    setupAuthListener();
  }
})();

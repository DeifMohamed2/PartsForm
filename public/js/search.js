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
      stockCode: 'all',
      delivery: 'all',
      minPrice: 0,
      maxPrice: 500000,
      minWeight: 0,
      maxWeight: 100,
      minQuantity: 0,
      minDeliveryDays: 0,
      maxDeliveryDays: 30,
    },
    currentSort: {
      field: 'relevance',
      order: 'desc'
    },
    quickFilters: {
      inStockOnly: false,
      lowStockOnly: false
    },
    currentResults: [],
    filteredResults: [],
    currentPage: 1,
    resultsPerPage: 250,
    selectedItems: new Map(), // Track selections across pages: globalIndex -> {qty}
    recentSearches: JSON.parse(localStorage.getItem('recentSearches') || '[]'),
    autocompleteIndex: -1,
    autocompleteResults: [],
  };

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
    // Quick Sort Bar
    quickSortBar: document.getElementById('quick-sort-bar'),
    // Pagination
    paginationContainer: document.getElementById('results-pagination'),
    // Recent Searches Modal
    recentSearchesModal: document.getElementById('recent-searches-modal'),
    recentSearchesOverlay: document.getElementById('recent-searches-overlay'),
    recentSearchesClose: document.getElementById('recent-searches-close'),
    recentSearchesList: document.getElementById('recent-searches-list'),
    clearSearchHistory: document.getElementById('clear-search-history'),
    recentSearchesTrigger: document.getElementById('recent-searches-trigger'),
  };

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    setupEventListeners();
    initializeFilters();
    initializeQuickSortBar();
    initializeRecentSearches();
    initializeAdvancedFilters();
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
  // AI SEARCH RESULTS HANDLER
  // ====================================
  function setupAISearchListener() {
    // Listen for AI search results from the AI filters modal
    window.addEventListener('aiSearchResults', (event) => {
      const { results, query, parsed } = event.detail;
      console.log('Received AI search results:', { resultsCount: results?.length, query, parsed });
      
      if (results && results.length > 0) {
        // Store the results
        state.currentResults = results;
        state.filteredResults = results;
        state.searchQuery = query || 'AI Search';
        
        // Update UI - displayResults handles showing the table
        displayResults(results);
        
        // Show the quick sort bar
        showQuickSortBar();
        
        // Populate filters from results
        populateFiltersFromResults(results);
        
        // Show reset button
        if (elements.resetBtn) {
          elements.resetBtn.style.display = 'flex';
        }
        
        // Update search input with the query
        if (elements.searchInput && query) {
          elements.searchInput.value = query;
          if (elements.clearBtn) {
            elements.clearBtn.style.display = 'flex';
          }
        }
        
        // Scroll to results after a short delay to ensure DOM is updated
        setTimeout(() => {
          const resultsSection = document.getElementById('results-table-container');
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    });
    
    // Listen for AI filters applied event
    window.addEventListener('aiFiltersApplied', (event) => {
      const { filters, aiResults, aiQuery, aiParsedResponse } = event.detail;
      console.log('AI Filters applied:', { filters, aiResultsCount: aiResults?.length, aiQuery });
      
      // Store AI filters for use in regular search
      if (filters) {
        state.selectedFilters = {
          ...state.selectedFilters,
          brand: filters.brands && !filters.brands.includes('all') ? filters.brands[0] : 'all',
          minPrice: filters.priceMin || 0,
          maxPrice: filters.priceMax || 500000,
          inStockOnly: filters.stockStatus === 'in-stock',
        };
      }
      
      // If we have AI results, display them in the main table
      if (aiResults && aiResults.length > 0) {
        state.currentResults = aiResults;
        state.filteredResults = aiResults;
        state.searchQuery = aiQuery || 'AI Search';
        
        // displayResults handles showing the table
        displayResults(aiResults);
        
        // Show the quick sort bar
        showQuickSortBar();
        
        // Populate filters from results
        populateFiltersFromResults(aiResults);
        
        if (elements.resetBtn) {
          elements.resetBtn.style.display = 'flex';
        }
        
        if (elements.searchInput && aiQuery) {
          elements.searchInput.value = aiQuery;
          if (elements.clearBtn) {
            elements.clearBtn.style.display = 'flex';
          }
        }
        
        // Scroll to results after a short delay to ensure DOM is updated
        setTimeout(() => {
          const resultsSection = document.getElementById('results-table-container');
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    });
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

    // Excel modal - Handled by ai-excel.js
    // Note: The new AI-powered Excel modal is now controlled by ai-excel.js
    // We keep the old event listeners commented out in case we need to fallback
    /*
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
    */

    // Drag and drop - DISABLED: AI Excel handler in ai-excel.js handles this now
    // setupDragAndDrop();

    // Add to Cart button (footer)
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', handleAddToCart);
    }

    // Add to Cart button (header) - for easier access when scrolling
    const addToCartBtnHeader = document.getElementById('add-to-cart-btn-header');
    if (addToCartBtnHeader) {
      addToCartBtnHeader.addEventListener('click', handleAddToCart);
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

    // Reset all filters before performing new search
    // This ensures AI filters or previous search filters don't interfere
    resetFiltersForNewSearch();

    state.searchQuery = query;
    hideAutocomplete();

    // Check if multi-part search (contains comma or semicolon)
    const isMultiSearch = /[,;]/.test(query);
    
    if (isMultiSearch) {
      performMultiSearch(query);
      return;
    }

    // Single part search
    performSingleSearch(query);
  }

  function performSingleSearch(query) {
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
          // Store results (filtering now happens in applyAdvancedFiltersToResults)
          state.currentResults = data.results;
          state.filteredResults = data.results;
          state.currentPage = 1;
          state.selectedItems.clear();
          displayResults(data.results);

          // Populate dynamic filters based on search results
          populateFiltersFromResults(data.results);

          // Save to recent searches
          saveRecentSearch(query);

          // Show quick sort bar
          showQuickSortBar();

          // Show search info
          if (data.searchTime) {
            console.log(`Search completed in ${data.searchTime} (${data.source})`);
          }
        } else {
          // No results found
          console.log('No results found for query:', query);
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
          hideQuickSortBar();
        }
      })
      .catch((error) => {
        console.error('Search error:', error);
        if (error.message && error.message.includes('Authentication')) {
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
          showCartAlert('error', 'Search Error', 'Failed to search for parts. Please try again.');
        }
      });
  }

  /**
   * Perform multi-part search
   * Handles comma or semicolon separated part numbers
   */
  function performMultiSearch(query) {
    // Parse part numbers and strip leading quotes (Excel text-prefix artifacts)
    let partNumbers = query
      .split(/[,;]+/)
      .map(p => p.trim().replace(/^['‘’`"]+/, '').trim())
      .filter(p => p.length > 0);

    if (partNumbers.length === 0) {
      return;
    }

    // Cap at 1000 parts to prevent browser lag from too many results
    const MAX_SEARCH_PARTS = 1000;
    if (partNumbers.length > MAX_SEARCH_PARTS) {
      const originalLength = partNumbers.length;
      partNumbers = partNumbers.slice(0, MAX_SEARCH_PARTS);
      showCartAlert('info', 'Parts Limit', 
        `Searching first ${MAX_SEARCH_PARTS.toLocaleString()} of ${originalLength.toLocaleString()} parts. Upload remaining parts in another batch.`);
    }

    console.log('Multi-part search:', partNumbers.length, 'parts');

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
        `<tr><td colspan="12" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div> Searching for ${partNumbers.length} part numbers...</td></tr>`;
    }

    // Make API call to multi-search endpoint via POST to avoid 431 header-too-large
    fetch('/buyer/api/search/multi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ partNumbers }),
    })
      .then((response) => {
        if (response.status === 401) {
          throw new Error('Authentication required. Please login.');
        }
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Multi-search API response:', data);
        
        if (data.success && data.results && data.results.length > 0) {
          state.currentResults = data.results;
          state.filteredResults = data.results;
          state.currentPage = 1;
          state.selectedItems.clear();
          displayResults(data.results);

          // Populate dynamic filters based on search results
          populateFiltersFromResults(data.results);

          // Show quick sort bar
          showQuickSortBar();

          // Save to recent searches
          saveRecentSearch(query);

          // Check if this is from Excel import (has stored stats)
          const excelStats = window.__excelImportStats;
          const isFromExcel = excelStats && excelStats.source === 'Excel';
          
          // Show analytics banner with stats
          const searchStats = {
            found: data.found || [],
            totalSearched: data.partNumbers?.length || 0,
            duplicates: isFromExcel ? (excelStats.duplicates || []) : (data.duplicates || [])
          };
          
          // Clear Excel stats after use
          if (isFromExcel) {
            window.__excelImportStats = null;
          }
          
          const source = isFromExcel ? 'Excel' : 'Search';
          
          if (data.notFound && data.notFound.length > 0) {
            showNotFoundBanner(data.notFound, source, searchStats);
          } else if (data.found && data.found.length > 0) {
            // Show success banner even when all found
            showNotFoundBanner([], source, searchStats);
          } else {
            hideNotFoundBanner();
          }
          showCartAlert('success', 'Search Complete', 
            `Found ${data.results.length} results for ${data.partNumbers?.length || 0} part numbers`);
        } else {
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
          hideQuickSortBar();
          
          if (data.notFound && data.notFound.length > 0) {
            const searchStats = {
              found: [],
              totalSearched: data.partNumbers?.length || data.notFound.length,
              duplicates: []
            };
            showNotFoundBanner(data.notFound, 'Search', searchStats);
          }
          showCartAlert('warning', 'No Results', 'No parts found for the searched part numbers');
        }
      })
      .catch((error) => {
        console.error('Multi-search error:', error);
        if (elements.resultsTableBody) {
          elements.resultsTableBody.innerHTML =
            '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #e74c3c;">Error searching for parts. Please try again.</td></tr>';
        }
      });
  }

  /**
   * Search from Excel upload
   * Accepts array of part numbers
   */
  function searchFromExcel(partNumbers) {
    if (!partNumbers || partNumbers.length === 0) {
      showCartAlert('error', 'Error', 'No valid part numbers found in Excel file');
      return;
    }

    // Strip leading quotes from part numbers (Excel text-prefix artifacts)
    partNumbers = partNumbers.map(p => p.replace(/^['''\u2018\u2019`"]+/, '').trim()).filter(Boolean);

    // Check if user is logged in
    if (typeof window.BuyerAuth === 'undefined' || !window.BuyerAuth.isLoggedIn()) {
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      }
      return;
    }

    console.log('Searching parts from Excel:', partNumbers);

    // Set the search input to show what we're searching
    elements.searchInput.value = partNumbers.slice(0, 5).join(', ') + 
      (partNumbers.length > 5 ? ` ... +${partNumbers.length - 5} more` : '');

    // Show loading state
    if (elements.resultsHeader) elements.resultsHeader.style.display = 'flex';
    if (elements.resultsTableContainer)
      elements.resultsTableContainer.style.display = 'block';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.noResultsState) elements.noResultsState.style.display = 'none';
    if (elements.resetBtn) elements.resetBtn.style.display = 'inline-flex';

    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML =
        `<tr><td colspan="12" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div> Searching for ${partNumbers.length} parts from Excel...</td></tr>`;
    }

    // Make API call with POST for larger data
    fetch('/buyer/api/search/multi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ partNumbers: partNumbers }),
    })
      .then((response) => {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Excel search API response:', data);
        
        if (data.success && data.results && data.results.length > 0) {
          state.currentResults = data.results;
          state.filteredResults = data.results;
          displayResults(data.results);

          // Populate dynamic filters based on search results
          populateFiltersFromResults(data.results);

          // Show quick sort bar
          showQuickSortBar();

          // Save each part number to recent searches
          saveRecentSearchFromExcel(partNumbers);

          // Show analytics banner with stats
          const excelStats = {
            found: data.found || [],
            totalSearched: partNumbers.length,
            duplicates: data.duplicates || []
          };
          
          if (data.notFound && data.notFound.length > 0) {
            showNotFoundBanner(data.notFound, 'Excel', excelStats);
          } else if (data.found && data.found.length > 0) {
            showNotFoundBanner([], 'Excel', excelStats);
          } else {
            hideNotFoundBanner();
          }

          // Show summary
          const searchTime = data.searchTime ? ` in ${data.searchTime}ms` : '';
          showCartAlert('success', 'Excel Search Complete', 
            `Found ${data.results.length} results for ${data.found.length} parts${searchTime}`);
        } else {
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
          hideNotFoundBanner();
          hideQuickSortBar();
          
          if (data.notFound && data.notFound.length > 0) {
            const excelStats = {
              found: [],
              totalSearched: partNumbers.length,
              duplicates: []
            };
            showNotFoundBanner(data.notFound, 'Excel', excelStats);
          }
          showCartAlert('warning', 'No Results', 'No parts found for the uploaded Excel file');
        }
      })
      .catch((error) => {
        console.error('Excel search error:', error);
        showCartAlert('error', 'Search Error', 'Failed to search parts from Excel');
        if (elements.resultsTableBody) {
          elements.resultsTableBody.innerHTML =
            '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #e74c3c;">Error searching for parts. Please try again.</td></tr>';
        }
      });
  }

  function clearSearch() {
    elements.searchInput.value = '';
    elements.clearBtn.style.display = 'none';
    hideAutocomplete();
    elements.searchInput.focus();
  }

  /**
   * Reset filters silently for a new search
   * This is called before each search to ensure clean state
   */
  function resetFiltersForNewSearch() {
    // Reset selected filters to defaults
    state.selectedFilters = {
      brand: 'all',
      stockCode: 'all',
      delivery: 'all',
      minPrice: 0,
      maxPrice: 500000,
      minWeight: 0,
      maxWeight: 100,
      minQuantity: 0,
      minDeliveryDays: 0,
      maxDeliveryDays: 30,
    };

    // Reset quick filters
    state.quickFilters = {
      inStockOnly: false,
      lowStockOnly: false
    };

    // Reset current sort
    state.currentSort = {
      field: 'relevance',
      order: 'desc'
    };

    // Clear previous results
    state.currentResults = [];
    state.filteredResults = [];

    // Notify AI filters to clear their state (if exposed)
    if (window.AIFilters && typeof window.AIFilters.clearResults === 'function') {
      window.AIFilters.clearResults();
    }

    // Reset quick sort buttons UI silently
    document.querySelectorAll('.quick-sort-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.sort === 'relevance') {
        btn.classList.add('active');
      }
    });

    // Reset quick filter buttons UI silently
    document.querySelectorAll('.quick-filter-btn, .filter-quick-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  function resetSearch() {
    // Clear search input
    elements.searchInput.value = '';
    elements.clearBtn.style.display = 'none';
    elements.resetBtn.style.display = 'none';

    // Hide autocomplete
    hideAutocomplete();

    // Hide not-found banner
    hideNotFoundBanner();

    // Hide quick sort bar
    hideQuickSortBar();

    // Hide results
    elements.resultsHeader.style.display = 'none';
    elements.resultsTableContainer.style.display = 'none';
    elements.noResultsState.style.display = 'none';

    // Hide advanced filter trigger when resetting
    if (elements.advancedFilterTrigger) {
      elements.advancedFilterTrigger.style.display = 'none';
    }

    // Show empty state
    elements.emptyState.style.display = 'block';

    // Clear state
    state.searchQuery = '';
    state.currentResults = [];
    state.filteredResults = [];

    // Reset filters
    handleClearAdvancedFilters();

    // Focus input
    elements.searchInput.focus();
  }

  // ====================================
  // AUTOCOMPLETE - Part Number Only
  // ====================================
  function showAutocomplete(query) {
    if (query.length < 1) {
      hideAutocomplete();
      return;
    }

    // Fetch autocomplete suggestions from API - Part Number Only
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
            partNumber: s.partNumber,
            code: s.partNumber,
            brand: s.brand || '',
            count: s.count || 1,
          }));
          state.autocompleteIndex = -1;

          // Render suggestions - Show part number prominently with supplier count
          elements.autocompleteContainer.innerHTML = state.autocompleteResults
            .map(
              (part, index) => `
                  <div class="autocomplete-item" data-index="${index}">
                      <div class="autocomplete-icon">
                          <i data-lucide="package"></i>
                      </div>
                      <div class="autocomplete-content">
                          <div class="autocomplete-title">${highlightMatch(
                            part.partNumber,
                            query
                          )}</div>
                          <div class="autocomplete-description">${part.brand || ''} ${part.count ? `• ${part.count} supplier${part.count > 1 ? 's' : ''}` : ''}</div>
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
        // Autocomplete failures are silent by design - non-critical background feature
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
      // Use partNumber from API response
      elements.searchInput.value = selected.partNumber || selected.code;
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
      renderPagination(0, 0);
      return;
    }

    // Calculate pagination
    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / state.resultsPerPage);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;
    const startIndex = (state.currentPage - 1) * state.resultsPerPage;
    const endIndex = Math.min(startIndex + state.resultsPerPage, totalResults);
    const pageResults = results.slice(startIndex, endIndex);

    hideEmptyState();
    hideNoResults();

    // Show reset button
    if (elements.resetBtn) {
      elements.resetBtn.style.display = 'flex';
    }

    // Show advanced filter trigger when results are displayed
    if (elements.advancedFilterTrigger) {
      elements.advancedFilterTrigger.style.display = 'flex';
    }

    // Update count — show total and page range
    elements.resultsCount.textContent = totalResults;
    // Update page info text
    const pageInfoEl = document.getElementById('results-page-info');
    if (pageInfoEl) {
      pageInfoEl.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalResults}`;
      pageInfoEl.style.display = totalResults > state.resultsPerPage ? 'inline' : 'none';
    }
    elements.resultsHeader.style.display = 'flex';
    elements.resultsGrid ? (elements.resultsGrid.style.display = 'none') : null;

    // Show table container
    const tableContainer = document.getElementById('results-table-container');
    const tableBody = document.getElementById('results-table-body');

    if (tableContainer && tableBody) {
      tableContainer.style.display = 'block';

      // Get user's preferred currency for price conversion
      const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';

      // Render table rows — only the current page slice, with global index
      tableBody.innerHTML = pageResults
        .map((part, localIdx) => {
          const globalIndex = startIndex + localIdx;
          // Handle both API formats (new Elasticsearch format and legacy)
          const price = part.price || part.unitPrice || 0;
          const partCurrency = part.currency || 'USD';
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

          // Get stock code (e.g., AD2, ST1, etc.)
          const stockCode = part.stockCode || 'N/A';
          
          // Get volume
          const volume = part.volume
            ? typeof part.volume === 'number'
              ? part.volume > 0 ? `${part.volume} m³` : 'N/A'
              : part.volume
            : 'N/A';
          
          // Get minOrderQty - default to 1 if not specified
          const minOrderQty = part.minOrderQty || 1;

          // Get part ID for cart functionality
          const partId = part._id || part.id || code;

          // Convert price to user's preferred currency
          const totalPrice = price * minOrderQty;
          const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
          const convertedPrice = window.convertToPreferredCurrency 
            ? window.convertToPreferredCurrency(totalPrice, partCurrency)
            : totalPrice;
          // If showing original, use the part's currency, otherwise use preferred currency
          const displayCurrency = isOriginal ? partCurrency : preferredCurrency;

          // Check if this item was previously selected
          const isSelected = state.selectedItems.has(globalIndex);
          const savedQty = isSelected ? state.selectedItems.get(globalIndex).qty : minOrderQty;

          return `
                <tr data-part-code="${code}" data-part-id="${partId}" data-part-index="${globalIndex}" data-min-order-qty="${minOrderQty}" data-stock-code="${stockCode}" data-original-price="${price}" data-original-currency="${partCurrency}">
                    <td>
                        <input type="checkbox" class="table-checkbox" data-price="${price}" data-currency="${partCurrency}" ${isSelected ? 'checked' : ''} onchange="handleRowSelectionChange(this, ${globalIndex})">
                    </td>
                    <td><strong>${part.brand || 'N/A'}</strong></td>
                    <td><strong>${code}</strong></td>
                    <td>${part.description || 'N/A'}</td>
                    <td>${quantity}</td>
                    <td>
                        <span class="stock-code-badge">${stockCode}</span>
                    </td>
                    <td>${volume}</td>
                    <td>${weight}</td>
                    <td>${delivery}</td>
                    <td>
                        <div class="order-qty-controls">
                            <button class="qty-btn" onclick="decrementQty(this)">−</button>
                            <input type="number" class="qty-input" value="${minOrderQty}" min="${minOrderQty}" max="${Math.max(quantity, 999)}" onchange="updateRowTotal(this)" oninput="updateRowTotal(this)">
                            <button class="qty-btn" onclick="incrementQty(this)">+</button>
                        </div>
                    </td>
                    <td>
                        <strong class="row-total" data-original-price="${price}" data-original-currency="${partCurrency}">${formatPrice(
                          convertedPrice
                        )}</strong> ${displayCurrency}
                    </td>
                    <td>
                        <button class="btn-add-single-to-cart" data-part-index="${globalIndex}" title="Add to cart">
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

      // Render pagination controls
      renderPagination(totalResults, totalPages);

      // Scroll table to top on page change
      tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Update selected total from state (cross-page selections)
    updateSelectedTotalFromState();
  }

  // ====================================
  // PAGINATION
  // ====================================
  function renderPagination(totalResults, totalPages) {
    const container = elements.paginationContainer || document.getElementById('results-pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    const page = state.currentPage;

    // Build page buttons — show max 7 buttons with ellipsis
    let pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    const perPage = state.resultsPerPage;
    const startItem = (page - 1) * perPage + 1;
    const endItem = Math.min(page * perPage, totalResults);

    container.innerHTML = `
      <div class="pagination-info">
        Showing <strong>${startItem}–${endItem}</strong> of <strong>${totalResults}</strong> parts
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn pagination-prev" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
          <i data-lucide="chevron-left"></i>
        </button>
        ${pages.map(p => {
          if (p === '...') return `<span class="pagination-ellipsis">…</span>`;
          return `<button class="pagination-btn pagination-num ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }).join('')}
        <button class="pagination-btn pagination-next" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      <div class="pagination-per-page">
        <label>Per page:</label>
        <select id="results-per-page-select">
          <option value="100" ${perPage === 100 ? 'selected' : ''}>100</option>
          <option value="250" ${perPage === 250 ? 'selected' : ''}>250</option>
          <option value="500" ${perPage === 500 ? 'selected' : ''}>500</option>
        </select>
      </div>
    `;

    // Attach pagination event listeners
    container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.dataset.page);
        if (targetPage >= 1 && targetPage <= totalPages) {
          goToPage(targetPage);
        }
      });
    });

    // Per-page select
    const perPageSelect = container.querySelector('#results-per-page-select');
    if (perPageSelect) {
      perPageSelect.addEventListener('change', (e) => {
        state.resultsPerPage = parseInt(e.target.value);
        state.currentPage = 1;
        const activeResults = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
        displayResults(activeResults);
      });
    }

    // Re-init lucide icons for chevrons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function goToPage(page) {
    state.currentPage = page;
    const activeResults = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    displayResults(activeResults);
  }

  // ====================================
  // CROSS-PAGE SELECTION TRACKING
  // ====================================
  window.handleRowSelectionChange = function(checkbox, globalIndex) {
    if (checkbox.checked) {
      const row = checkbox.closest('tr');
      const qtyInput = row ? row.querySelector('.qty-input') : null;
      const qty = parseInt(qtyInput?.value) || 1;
      state.selectedItems.set(globalIndex, { qty });
    } else {
      state.selectedItems.delete(globalIndex);
    }
    updateSelectedTotalFromState();
  };

  function updateSelectedTotalFromState() {
    // Calculate totals from state.selectedItems (works across pages)
    const activeResults = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    let total = 0;
    let count = state.selectedItems.size;
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
    let currenciesUsed = new Set();

    state.selectedItems.forEach(({ qty }, globalIndex) => {
      const part = activeResults[globalIndex];
      if (!part) return;
      const price = parseFloat(part.price || part.unitPrice) || 0;
      const partCurrency = part.currency || 'USD';

      // Check if this row is visible on current page, use its live qty
      const visibleRow = document.querySelector(`tr[data-part-index="${globalIndex}"]`);
      const liveQty = visibleRow ? (parseInt(visibleRow.querySelector('.qty-input')?.value) || qty) : qty;

      const itemTotal = price * liveQty;
      const convertedTotal = window.convertToPreferredCurrency
        ? window.convertToPreferredCurrency(itemTotal, partCurrency)
        : itemTotal;
      total += convertedTotal;
      if (isOriginal) currenciesUsed.add(partCurrency);
    });

    // Determine currency display
    let totalCurrencyDisplay = preferredCurrency;
    if (isOriginal) {
      if (currenciesUsed.size === 1) totalCurrencyDisplay = Array.from(currenciesUsed)[0];
      else if (currenciesUsed.size > 1) totalCurrencyDisplay = 'Mixed';
    }

    // Update all UI elements
    const selectedTotal = document.getElementById('selected-total');
    const selectedTotalFooter = document.getElementById('selected-total-footer');
    const selectedCount = document.getElementById('selected-count');
    const selectedCountHeader = document.getElementById('selected-count-header');
    const selectionStatus = document.getElementById('selection-status');
    const selectedBadge = document.getElementById('selected-badge');
    const selectedItemsCount = document.getElementById('selected-items-count');

    if (selectedTotal) selectedTotal.textContent = formatPrice(total) + ' ' + totalCurrencyDisplay;
    if (selectedTotalFooter) selectedTotalFooter.textContent = formatPrice(total) + ' ' + totalCurrencyDisplay;
    if (selectedCount) selectedCount.textContent = count;
    if (selectedCountHeader) selectedCountHeader.textContent = count;

    if (count > 0) {
      if (selectionStatus) selectionStatus.style.display = 'none';
      if (selectedBadge) selectedBadge.style.display = 'inline-flex';
      if (selectedItemsCount) selectedItemsCount.textContent = count;
    } else {
      if (selectionStatus) selectionStatus.style.display = 'inline';
      if (selectedBadge) selectedBadge.style.display = 'none';
    }

    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const addToCartBtnHeader = document.getElementById('add-to-cart-btn-header');
    if (addToCartBtn) addToCartBtn.disabled = count === 0;
    if (addToCartBtnHeader) addToCartBtnHeader.disabled = count === 0;
  }

  function showNoResults() {
    // Show reset button
    if (elements.resetBtn) {
      elements.resetBtn.style.display = 'flex';
    }

    // Show advanced filter trigger even on no results (user is searching)
    if (elements.advancedFilterTrigger) {
      elements.advancedFilterTrigger.style.display = 'flex';
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
    
    // Initialize price filter currency label based on user's preferred currency
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
    updatePriceFilterCurrency(preferredCurrency, isOriginal);
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
    handleClearAdvancedFilters();
  }

  function applyFilters() {
    handleApplyAdvancedFilters();
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
  // QUICK SORT BAR
  // ====================================
  function initializeQuickSortBar() {
    // Sort buttons
    document.querySelectorAll('.quick-sort-btn').forEach(btn => {
      btn.addEventListener('click', handleQuickSortClick);
    });

    // Quick filter buttons
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.addEventListener('click', handleQuickFilterClick);
    });
  }

  function handleQuickSortClick(e) {
    const btn = e.currentTarget;
    const sortField = btn.dataset.sort;
    const sortOrder = btn.dataset.order;

    // Update active state
    document.querySelectorAll('.quick-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update state
    state.currentSort = { field: sortField, order: sortOrder };

    // Apply sort to filtered results
    applySortAndFilter();
  }

  function handleQuickFilterClick(e) {
    const btn = e.currentTarget;
    const filterType = btn.dataset.filter;

    // Toggle active state
    btn.classList.toggle('active');

    // Update state
    if (filterType === 'in-stock') {
      state.quickFilters.inStockOnly = btn.classList.contains('active');
    } else if (filterType === 'low-stock') {
      state.quickFilters.lowStockOnly = btn.classList.contains('active');
    }

    // Apply filter
    applySortAndFilter();
  }

  function applySortAndFilter() {
    let results = [...state.currentResults];

    // Reset to page 1 on sort/filter
    state.currentPage = 1;

    // Apply quick filters
    if (state.quickFilters.inStockOnly) {
      results = results.filter(part => {
        const stock = (part.stock || '').toLowerCase();
        const qty = parseFloat(part.quantity) || 0;
        return stock === 'in-stock' || qty > 0;
      });
    }

    if (state.quickFilters.lowStockOnly) {
      results = results.filter(part => {
        const stock = (part.stock || '').toLowerCase();
        return stock === 'low-stock';
      });
    }

    // Apply sorting
    if (state.currentSort.field !== 'relevance') {
      results = sortResults(results, state.currentSort.field, state.currentSort.order);
    }

    // Store filtered results
    state.filteredResults = results;

    // Update display
    displayResults(results);
  }

  function sortResults(results, field, order) {
    return [...results].sort((a, b) => {
      let aVal, bVal;

      switch(field) {
        case 'price':
          aVal = parseFloat(a.price) || 0;
          bVal = parseFloat(b.price) || 0;
          break;
        case 'deliveryDays':
          aVal = parseInt(a.deliveryDays) || parseInt(a.terms) || 999;
          bVal = parseInt(b.deliveryDays) || parseInt(b.terms) || 999;
          break;
        case 'quantity':
          aVal = parseFloat(a.quantity) || parseFloat(a.qty) || 0;
          bVal = parseFloat(b.quantity) || parseFloat(b.qty) || 0;
          break;
        default:
          return 0;
      }

      if (order === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }

  function showQuickSortBar() {
    if (elements.quickSortBar) {
      elements.quickSortBar.style.display = 'flex';
      // Re-initialize lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nameAttr: 'data-lucide' });
      }
    }
  }

  function hideQuickSortBar() {
    if (elements.quickSortBar) {
      elements.quickSortBar.style.display = 'none';
    }
  }

  // ====================================
  // RECENT SEARCHES
  // ====================================
  const MAX_RECENT_SEARCHES = 10;

  function initializeRecentSearches() {
    // Load from localStorage
    state.recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

    // Setup event listeners
    if (elements.recentSearchesTrigger) {
      elements.recentSearchesTrigger.addEventListener('click', showRecentSearchesModal);
    }
    if (elements.recentSearchesClose) {
      elements.recentSearchesClose.addEventListener('click', hideRecentSearchesModal);
    }
    if (elements.recentSearchesOverlay) {
      elements.recentSearchesOverlay.addEventListener('click', hideRecentSearchesModal);
    }
    if (elements.clearSearchHistory) {
      elements.clearSearchHistory.addEventListener('click', clearRecentSearches);
    }
  }

  function saveRecentSearch(query) {
    if (!query || query.trim() === '') return;

    const trimmedQuery = query.trim();

    // Remove if already exists
    state.recentSearches = state.recentSearches.filter(
      item => item.query.toLowerCase() !== trimmedQuery.toLowerCase()
    );

    // Add to beginning
    state.recentSearches.unshift({
      query: trimmedQuery,
      timestamp: Date.now(),
      resultCount: state.currentResults.length,
      type: 'single'
    });

    // Limit to max
    if (state.recentSearches.length > MAX_RECENT_SEARCHES) {
      state.recentSearches = state.recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }

    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
  }

  function saveRecentSearchFromExcel(partNumbers) {
    if (!partNumbers || partNumbers.length === 0) return;

    // Create a combined query string
    const combinedQuery = partNumbers.join(', ');

    // Remove if similar Excel search already exists
    state.recentSearches = state.recentSearches.filter(
      item => !(item.type === 'excel' && item.partNumbers && 
                item.partNumbers.join(',') === partNumbers.join(','))
    );

    // Add to beginning as Excel type with all part numbers
    state.recentSearches.unshift({
      query: combinedQuery,
      partNumbers: partNumbers,
      timestamp: Date.now(),
      resultCount: state.currentResults.length,
      type: 'excel'
    });

    // Limit to max
    if (state.recentSearches.length > MAX_RECENT_SEARCHES) {
      state.recentSearches = state.recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }

    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
  }

  function renderRecentSearches() {
    if (!elements.recentSearchesList) return;

    if (state.recentSearches.length === 0) {
      elements.recentSearchesList.innerHTML = `
        <div class="recent-search-empty">
          <i data-lucide="search"></i>
          <p>No recent searches yet</p>
        </div>
      `;
      if (elements.clearSearchHistory) {
        elements.clearSearchHistory.style.display = 'none';
      }
    } else {
      const searchesHTML = state.recentSearches.map((item, index) => {
        if (item.type === 'excel' && item.partNumbers && item.partNumbers.length > 0) {
          // Excel search with multiple part numbers
          const partNumbersHTML = item.partNumbers.map(pn => `
            <div class="recent-part-number" data-part="${escapeHtml(pn)}">
              <i data-lucide="package"></i>
              <span>${escapeHtml(pn)}</span>
              <button class="recent-part-search-btn" data-part="${escapeHtml(pn)}" title="Search this part">
                <i data-lucide="search"></i>
              </button>
            </div>
          `).join('');

          return `
            <div class="recent-search-item recent-search-excel" data-index="${index}">
              <div class="recent-search-excel-header">
                <div class="recent-search-item-content">
                  <i data-lucide="file-spreadsheet"></i>
                  <span class="recent-search-item-text">Excel Upload (${item.partNumbers.length} parts)</span>
                </div>
                <div class="recent-search-excel-actions">
                  <span class="recent-search-item-time">${formatTimeAgo(item.timestamp)}</span>
                  <button class="recent-search-all-btn" data-query="${escapeHtml(item.query)}" title="Search all parts">
                    <i data-lucide="search"></i>
                    Search All
                  </button>
                </div>
              </div>
              <div class="recent-search-parts-list">
                ${partNumbersHTML}
              </div>
            </div>
          `;
        } else {
          // Regular single search
          return `
            <div class="recent-search-item" data-index="${index}" data-query="${escapeHtml(item.query)}">
              <div class="recent-search-item-content">
                <i data-lucide="clock"></i>
                <span class="recent-search-item-text">${escapeHtml(item.query)}</span>
              </div>
              <span class="recent-search-item-time">${formatTimeAgo(item.timestamp)}</span>
            </div>
          `;
        }
      }).join('');

      elements.recentSearchesList.innerHTML = searchesHTML;

      // Add click handlers for regular searches
      elements.recentSearchesList.querySelectorAll('.recent-search-item:not(.recent-search-excel)').forEach(item => {
        item.addEventListener('click', () => {
          const query = item.dataset.query;
          if (elements.searchInput) {
            elements.searchInput.value = query;
          }
          hideRecentSearchesModal();
          performSearch();
        });
      });

      // Add click handlers for "Search All" button on Excel searches
      elements.recentSearchesList.querySelectorAll('.recent-search-all-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const query = btn.dataset.query;
          if (elements.searchInput) {
            elements.searchInput.value = query;
          }
          hideRecentSearchesModal();
          performSearch();
        });
      });

      // Add click handlers for individual part number search buttons
      elements.recentSearchesList.querySelectorAll('.recent-part-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partNumber = btn.dataset.part;
          if (elements.searchInput) {
            elements.searchInput.value = partNumber;
          }
          hideRecentSearchesModal();
          performSearch();
        });
      });

      // Add click handlers for clicking on part number row
      elements.recentSearchesList.querySelectorAll('.recent-part-number').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.recent-part-search-btn')) return;
          const partNumber = row.dataset.part;
          if (elements.searchInput) {
            elements.searchInput.value = partNumber;
          }
          hideRecentSearchesModal();
          performSearch();
        });
      });

      if (elements.clearSearchHistory) {
        elements.clearSearchHistory.style.display = 'flex';
      }
    }

    // Re-initialize lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }
  }

  function showRecentSearchesModal() {
    renderRecentSearches();
    if (elements.recentSearchesModal) {
      elements.recentSearchesModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  function hideRecentSearchesModal() {
    if (elements.recentSearchesModal) {
      elements.recentSearchesModal.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  function clearRecentSearches() {
    state.recentSearches = [];
    localStorage.removeItem('recentSearches');
    renderRecentSearches();
    showCartAlert('success', 'Cleared', 'Search history has been cleared');
  }

  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ====================================
  // ENHANCED ADVANCED FILTERS WITH SLIDERS
  // ====================================
  
  // Store original filter bounds from search results
  const filterBounds = {
    price: { min: 0, max: 500000 },
    weight: { min: 0, max: 100 },
    quantity: { min: 0, max: 1000 },
    delivery: { min: 0, max: 30 }
  };

  function initializeAdvancedFilters() {
    // Initialize all range sliders
    initializePriceSlider();
    initializeWeightSlider();
    initializeQuantitySlider();
    initializeDeliverySlider();
    
    // Initialize quick delivery buttons
    initializeQuickDeliveryButtons();
    
    // Initialize search clear buttons
    initializeSearchClearButtons();

    // Price range inputs
    const minPriceInput = document.getElementById('min-price-input');
    const maxPriceInput = document.getElementById('max-price-input');

    if (minPriceInput) {
      minPriceInput.addEventListener('input', () => {
        state.selectedFilters.minPrice = parseInt(minPriceInput.value) || 0;
        updatePriceSliderFromInputs();
        updateFilterPreviewCount();
      });
    }

    if (maxPriceInput) {
      maxPriceInput.addEventListener('input', () => {
        state.selectedFilters.maxPrice = parseInt(maxPriceInput.value) || 500000;
        updatePriceSliderFromInputs();
        updateFilterPreviewCount();
      });
    }

    // Weight range inputs
    const minWeightInput = document.getElementById('min-weight-input');
    const maxWeightInput = document.getElementById('max-weight-input');

    if (minWeightInput) {
      minWeightInput.addEventListener('input', () => {
        state.selectedFilters.minWeight = parseFloat(minWeightInput.value) || 0;
        updateWeightSliderFromInputs();
        updateFilterPreviewCount();
      });
    }
    if (maxWeightInput) {
      maxWeightInput.addEventListener('input', () => {
        state.selectedFilters.maxWeight = parseFloat(maxWeightInput.value) || 100;
        updateWeightSliderFromInputs();
        updateFilterPreviewCount();
      });
    }

    // Min quantity input
    const minQtyInput = document.getElementById('min-quantity-input');
    if (minQtyInput) {
      minQtyInput.addEventListener('input', () => {
        state.selectedFilters.minQuantity = parseInt(minQtyInput.value) || 0;
        updateQuantitySliderFromInputs();
        updateFilterPreviewCount();
      });
    }

    // Filter checkboxes
    document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        handleFilterCheckboxChange(e);
        updateFilterPreviewCount();
      });
    });

    // Brand search
    const brandSearch = document.getElementById('brand-filter-search');
    if (brandSearch) {
      brandSearch.addEventListener('input', handleBrandSearch);
    }

    // Apply filters button
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', handleApplyAdvancedFilters);
    }

    // Clear filters button
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClearAdvancedFilters);
    }
  }

  // ====================================
  // RANGE SLIDER IMPLEMENTATIONS
  // ====================================
  
  function initializePriceSlider() {
    const sliderMin = document.getElementById('price-slider-min');
    const sliderMax = document.getElementById('price-slider-max');
    const sliderRange = document.getElementById('price-slider-range');
    const minDisplay = document.getElementById('price-range-min-display');
    const maxDisplay = document.getElementById('price-range-max-display');
    const minInput = document.getElementById('min-price-input');
    const maxInput = document.getElementById('max-price-input');

    if (!sliderMin || !sliderMax) return;

    function updateSlider() {
      const minVal = parseInt(sliderMin.value);
      const maxVal = parseInt(sliderMax.value);
      const range = parseInt(sliderMax.max) - parseInt(sliderMin.min);
      
      // Prevent overlap
      if (minVal >= maxVal) {
        sliderMin.value = maxVal - 1;
        return;
      }

      // Update range highlight
      const minPercent = ((minVal - parseInt(sliderMin.min)) / range) * 100;
      const maxPercent = ((maxVal - parseInt(sliderMin.min)) / range) * 100;
      
      if (sliderRange) {
        sliderRange.style.left = minPercent + '%';
        sliderRange.style.width = (maxPercent - minPercent) + '%';
      }

      // Get preferred currency for display conversion
      const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
      const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
      
      // Convert display values to preferred currency (internal values stay as-is for filtering)
      let displayMin = minVal;
      let displayMax = maxVal;
      
      if (window.convertToPreferredCurrency && !isOriginal && preferredCurrency !== 'USD') {
        displayMin = Math.round(window.convertToPreferredCurrency(minVal, 'USD'));
        displayMax = Math.round(window.convertToPreferredCurrency(maxVal, 'USD'));
      }

      // Update displays with converted values
      if (minDisplay) minDisplay.textContent = formatNumber(displayMin);
      if (maxDisplay) maxDisplay.textContent = formatNumber(displayMax);

      // Update inputs with converted values for user clarity
      if (minInput) minInput.value = displayMin;
      if (maxInput) maxInput.value = displayMax;

      // Update state with original USD values for consistent filtering
      state.selectedFilters.minPrice = minVal;
      state.selectedFilters.maxPrice = maxVal;
      
      updateFilterPreviewCount();
    }

    sliderMin.addEventListener('input', updateSlider);
    sliderMax.addEventListener('input', updateSlider);

    // Initialize
    updateSlider();
  }

  function updatePriceSliderFromInputs() {
    const sliderMin = document.getElementById('price-slider-min');
    const sliderMax = document.getElementById('price-slider-max');
    const minInput = document.getElementById('min-price-input');
    const maxInput = document.getElementById('max-price-input');

    if (sliderMin && minInput) sliderMin.value = minInput.value;
    if (sliderMax && maxInput) sliderMax.value = maxInput.value;

    updateSliderRangeVisual('price');
  }

  function initializeWeightSlider() {
    const sliderMin = document.getElementById('weight-slider-min');
    const sliderMax = document.getElementById('weight-slider-max');
    const sliderRange = document.getElementById('weight-slider-range');
    const minDisplay = document.getElementById('weight-range-min-display');
    const maxDisplay = document.getElementById('weight-range-max-display');
    const minInput = document.getElementById('min-weight-input');
    const maxInput = document.getElementById('max-weight-input');

    if (!sliderMin || !sliderMax) return;

    function updateSlider() {
      const minVal = parseFloat(sliderMin.value);
      const maxVal = parseFloat(sliderMax.value);
      const range = parseFloat(sliderMax.max) - parseFloat(sliderMin.min);
      
      if (minVal >= maxVal) {
        sliderMin.value = maxVal - 0.1;
        return;
      }

      const minPercent = ((minVal - parseFloat(sliderMin.min)) / range) * 100;
      const maxPercent = ((maxVal - parseFloat(sliderMin.min)) / range) * 100;
      
      if (sliderRange) {
        sliderRange.style.left = minPercent + '%';
        sliderRange.style.width = (maxPercent - minPercent) + '%';
      }

      if (minDisplay) minDisplay.textContent = minVal.toFixed(1);
      if (maxDisplay) maxDisplay.textContent = maxVal.toFixed(1);

      if (minInput) minInput.value = minVal;
      if (maxInput) maxInput.value = maxVal;

      state.selectedFilters.minWeight = minVal;
      state.selectedFilters.maxWeight = maxVal;
      
      updateFilterPreviewCount();
    }

    sliderMin.addEventListener('input', updateSlider);
    sliderMax.addEventListener('input', updateSlider);
    updateSlider();
  }

  function updateWeightSliderFromInputs() {
    const sliderMin = document.getElementById('weight-slider-min');
    const sliderMax = document.getElementById('weight-slider-max');
    const minInput = document.getElementById('min-weight-input');
    const maxInput = document.getElementById('max-weight-input');

    if (sliderMin && minInput) sliderMin.value = minInput.value;
    if (sliderMax && maxInput) sliderMax.value = maxInput.value;

    updateSliderRangeVisual('weight');
  }

  function initializeQuantitySlider() {
    const sliderMin = document.getElementById('qty-slider-min');
    const sliderMax = document.getElementById('qty-slider-max');
    const sliderRange = document.getElementById('qty-slider-range');
    const minDisplay = document.getElementById('qty-range-min-display');
    const maxDisplay = document.getElementById('qty-range-max-display');
    const minInput = document.getElementById('min-quantity-input');

    if (!sliderMin || !sliderMax) return;

    function updateSlider() {
      const minVal = parseInt(sliderMin.value);
      const maxVal = parseInt(sliderMax.value);
      const range = parseInt(sliderMax.max) - parseInt(sliderMin.min);
      
      if (minVal >= maxVal) {
        sliderMin.value = maxVal - 1;
        return;
      }

      const minPercent = ((minVal - parseInt(sliderMin.min)) / range) * 100;
      const maxPercent = ((maxVal - parseInt(sliderMin.min)) / range) * 100;
      
      if (sliderRange) {
        sliderRange.style.left = minPercent + '%';
        sliderRange.style.width = (maxPercent - minPercent) + '%';
      }

      if (minDisplay) minDisplay.textContent = formatNumber(minVal);
      if (maxDisplay) maxDisplay.textContent = maxVal >= 1000 ? '1000+' : formatNumber(maxVal);

      if (minInput) minInput.value = minVal;

      state.selectedFilters.minQuantity = minVal;
      
      updateFilterPreviewCount();
    }

    sliderMin.addEventListener('input', updateSlider);
    sliderMax.addEventListener('input', updateSlider);
    updateSlider();
  }

  function updateQuantitySliderFromInputs() {
    const sliderMin = document.getElementById('qty-slider-min');
    const minInput = document.getElementById('min-quantity-input');

    if (sliderMin && minInput) sliderMin.value = minInput.value;

    updateSliderRangeVisual('qty');
  }

  function initializeDeliverySlider() {
    const sliderMin = document.getElementById('delivery-slider-min');
    const sliderMax = document.getElementById('delivery-slider-max');
    const sliderRange = document.getElementById('delivery-slider-range');
    const minDisplay = document.getElementById('delivery-range-min-display');
    const maxDisplay = document.getElementById('delivery-range-max-display');

    if (!sliderMin || !sliderMax) return;

    function updateSlider() {
      const minVal = parseInt(sliderMin.value);
      const maxVal = parseInt(sliderMax.value);
      const range = parseInt(sliderMax.max) - parseInt(sliderMin.min);
      
      if (minVal >= maxVal) {
        sliderMin.value = maxVal - 1;
        return;
      }

      const minPercent = ((minVal - parseInt(sliderMin.min)) / range) * 100;
      const maxPercent = ((maxVal - parseInt(sliderMin.min)) / range) * 100;
      
      if (sliderRange) {
        sliderRange.style.left = minPercent + '%';
        sliderRange.style.width = (maxPercent - minPercent) + '%';
      }

      if (minDisplay) minDisplay.textContent = minVal;
      if (maxDisplay) maxDisplay.textContent = maxVal >= 30 ? '30+' : maxVal;

      // Update delivery filter based on slider values
      if (maxVal <= 2) {
        state.selectedFilters.delivery = '1-2';
      } else if (maxVal <= 5) {
        state.selectedFilters.delivery = '3-5';
      } else if (maxVal <= 14) {
        state.selectedFilters.delivery = '7-14';
      } else {
        state.selectedFilters.delivery = 'all';
      }
      
      // Store actual values for filtering
      state.selectedFilters.minDeliveryDays = minVal;
      state.selectedFilters.maxDeliveryDays = maxVal;
      
      // Clear quick button active states
      document.querySelectorAll('.filter-quick-btn').forEach(btn => btn.classList.remove('active'));
      
      updateFilterPreviewCount();
    }

    sliderMin.addEventListener('input', updateSlider);
    sliderMax.addEventListener('input', updateSlider);
    updateSlider();
  }

  function initializeQuickDeliveryButtons() {
    document.querySelectorAll('.filter-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const minDays = parseInt(btn.dataset.min) || 0;
        const maxDays = parseInt(btn.dataset.max) || 30;
        
        const sliderMin = document.getElementById('delivery-slider-min');
        const sliderMax = document.getElementById('delivery-slider-max');
        
        if (sliderMin) sliderMin.value = minDays;
        if (sliderMax) sliderMax.value = maxDays;
        
        // Trigger slider update
        sliderMin?.dispatchEvent(new Event('input'));
        
        // Toggle active state
        document.querySelectorAll('.filter-quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function initializeSearchClearButtons() {
    const brandClear = document.getElementById('brand-search-clear');
    const brandSearch = document.getElementById('brand-filter-search');

    if (brandClear && brandSearch) {
      brandSearch.addEventListener('input', () => {
        brandClear.style.display = brandSearch.value ? 'flex' : 'none';
      });
      brandClear.addEventListener('click', () => {
        brandSearch.value = '';
        brandClear.style.display = 'none';
        handleBrandSearch({ target: brandSearch });
      });
    }
  }

  function updateSliderRangeVisual(type) {
    const sliderMin = document.getElementById(`${type}-slider-min`);
    const sliderMax = document.getElementById(`${type}-slider-max`);
    const sliderRange = document.getElementById(`${type}-slider-range`);

    if (!sliderMin || !sliderMax || !sliderRange) return;

    const minVal = parseFloat(sliderMin.value);
    const maxVal = parseFloat(sliderMax.value);
    const range = parseFloat(sliderMax.max) - parseFloat(sliderMin.min);

    const minPercent = ((minVal - parseFloat(sliderMin.min)) / range) * 100;
    const maxPercent = ((maxVal - parseFloat(sliderMin.min)) / range) * 100;

    sliderRange.style.left = minPercent + '%';
    sliderRange.style.width = (maxPercent - minPercent) + '%';
  }

  function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  // ====================================
  // DYNAMIC FILTER POPULATION FROM SEARCH RESULTS
  // ====================================
  
  function populateFiltersFromResults(results) {
    if (!results || results.length === 0) return;

    // Reset filter state to defaults for new search results
    state.selectedFilters = {
      brand: 'all',
      stockCode: 'all',
      delivery: 'all',
      minPrice: 0,
      maxPrice: 500000,
      minWeight: 0,
      maxWeight: 100,
      minQuantity: 0,
      minDeliveryDays: 0,
      maxDeliveryDays: 30,
    };

    // Reset checkbox UI
    document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      if (checkbox.dataset.value === 'All') {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
      }
    });

    // Reset quick filter/delivery buttons
    document.querySelectorAll('.filter-quick-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Show filter stats banner
    const statsBanner = document.getElementById('filter-stats-banner');
    const statsCount = document.getElementById('filter-stats-count');
    if (statsBanner) statsBanner.style.display = 'flex';
    if (statsCount) statsCount.textContent = results.length;

    // Calculate bounds from results
    calculateFilterBounds(results);

    // Update slider ranges
    updateSliderBounds();

    // Populate dynamic filter options
    populateBrandOptions(results);
    populateStockCodeOptions(results);

    // Generate price distribution
    generatePriceDistribution(results);

    // Update preview count
    updateFilterPreviewCount();
  }

  function calculateFilterBounds(results) {
    // Get preferred currency settings
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
    
    // Price bounds - convert to preferred currency for accurate min/max
    const prices = results.map(r => {
      const price = parseFloat(r.price) || 0;
      const partCurrency = r.currency || 'USD';
      
      // Convert to preferred currency for comparison (unless showing original)
      if (window.convertToPreferredCurrency && !isOriginal) {
        return window.convertToPreferredCurrency(price, partCurrency);
      }
      return price;
    }).filter(p => p > 0);
    
    if (prices.length > 0) {
      filterBounds.price.min = Math.floor(Math.min(...prices));
      filterBounds.price.max = Math.ceil(Math.max(...prices));
    }

    // Weight bounds
    const weights = results.map(r => parseFloat(r.weight) || 0).filter(w => w > 0);
    if (weights.length > 0) {
      filterBounds.weight.min = Math.floor(Math.min(...weights) * 10) / 10;
      filterBounds.weight.max = Math.ceil(Math.max(...weights) * 10) / 10;
    }

    // Quantity bounds
    const quantities = results.map(r => parseInt(r.quantity) || 0);
    if (quantities.length > 0) {
      filterBounds.quantity.min = 0;
      filterBounds.quantity.max = Math.max(...quantities);
    }

    // Delivery bounds
    const deliveries = results.map(r => parseInt(r.deliveryDays) || 0).filter(d => d > 0);
    if (deliveries.length > 0) {
      filterBounds.delivery.min = 0;
      filterBounds.delivery.max = Math.max(...deliveries, 30);
    }
  }

  function updateSliderBounds() {
    // Get preferred currency settings
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
    
    // Update price currency label
    const priceCurrencyLabel = document.getElementById('price-currency');
    if (priceCurrencyLabel) {
      if (isOriginal) {
        priceCurrencyLabel.textContent = 'Mixed';
        priceCurrencyLabel.title = 'Prices shown in original currencies';
      } else {
        priceCurrencyLabel.textContent = preferredCurrency;
        priceCurrencyLabel.title = `Prices converted to ${preferredCurrency}`;
      }
    }
    
    // Update price slider
    const priceSliderMin = document.getElementById('price-slider-min');
    const priceSliderMax = document.getElementById('price-slider-max');
    if (priceSliderMin && priceSliderMax) {
      priceSliderMin.min = filterBounds.price.min;
      priceSliderMin.max = filterBounds.price.max;
      priceSliderMax.min = filterBounds.price.min;
      priceSliderMax.max = filterBounds.price.max;
      priceSliderMin.value = filterBounds.price.min;
      priceSliderMax.value = filterBounds.price.max;
      
      // Update inputs
      const minInput = document.getElementById('min-price-input');
      const maxInput = document.getElementById('max-price-input');
      if (minInput) minInput.value = filterBounds.price.min;
      if (maxInput) maxInput.value = filterBounds.price.max;
      
      // Update displays
      const minDisplay = document.getElementById('price-range-min-display');
      const maxDisplay = document.getElementById('price-range-max-display');
      if (minDisplay) minDisplay.textContent = formatNumber(filterBounds.price.min);
      if (maxDisplay) maxDisplay.textContent = formatNumber(filterBounds.price.max);
      
      // Update state
      state.selectedFilters.minPrice = filterBounds.price.min;
      state.selectedFilters.maxPrice = filterBounds.price.max;
      
      updateSliderRangeVisual('price');
    }

    // Update weight slider
    const weightSliderMin = document.getElementById('weight-slider-min');
    const weightSliderMax = document.getElementById('weight-slider-max');
    if (weightSliderMin && weightSliderMax) {
      const maxWeight = Math.max(filterBounds.weight.max, 1);
      weightSliderMin.min = 0;
      weightSliderMin.max = maxWeight;
      weightSliderMax.min = 0;
      weightSliderMax.max = maxWeight;
      weightSliderMin.value = 0;
      weightSliderMax.value = maxWeight;
      
      const minInput = document.getElementById('min-weight-input');
      const maxInput = document.getElementById('max-weight-input');
      if (minInput) minInput.value = 0;
      if (maxInput) maxInput.value = maxWeight;
      
      const minDisplay = document.getElementById('weight-range-min-display');
      const maxDisplay = document.getElementById('weight-range-max-display');
      if (minDisplay) minDisplay.textContent = '0';
      if (maxDisplay) maxDisplay.textContent = maxWeight.toFixed(1);
      
      state.selectedFilters.minWeight = 0;
      state.selectedFilters.maxWeight = maxWeight;
      
      updateSliderRangeVisual('weight');
    }

    // Update quantity slider
    const qtySliderMin = document.getElementById('qty-slider-min');
    const qtySliderMax = document.getElementById('qty-slider-max');
    if (qtySliderMin && qtySliderMax) {
      const maxQty = Math.max(filterBounds.quantity.max, 1);
      qtySliderMin.min = 0;
      qtySliderMin.max = maxQty;
      qtySliderMax.min = 0;
      qtySliderMax.max = maxQty;
      qtySliderMin.value = 0;
      qtySliderMax.value = maxQty;
      
      const minInput = document.getElementById('min-quantity-input');
      if (minInput) minInput.value = 0;
      
      const minDisplay = document.getElementById('qty-range-min-display');
      const maxDisplay = document.getElementById('qty-range-max-display');
      if (minDisplay) minDisplay.textContent = '0';
      if (maxDisplay) maxDisplay.textContent = maxQty >= 1000 ? '1000+' : formatNumber(maxQty);
      
      state.selectedFilters.minQuantity = 0;
      
      updateSliderRangeVisual('qty');
    }
  }

  function populateBrandOptions(results) {
    const container = document.getElementById('brand-filter-tags');
    if (!container) return;

    // Count brands
    const brandCounts = {};
    results.forEach(r => {
      const brand = r.brand || 'Unknown';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    // Sort by count
    const sortedBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1]);

    // Update total count badge
    const totalBadge = document.getElementById('brand-total-count');
    if (totalBadge) totalBadge.textContent = sortedBrands.length;

    // Keep "All Brands" option, remove others
    const allOption = container.querySelector('input[data-value="All"]')?.closest('.filter-checkbox');
    container.innerHTML = '';
    if (allOption) container.appendChild(allOption);

    // Add dynamic brand options
    sortedBrands.forEach(([brand, count]) => {
      if (brand === 'Unknown' || brand === '') return;
      
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `
        <input type="checkbox" name="brand" value="${brand}" data-filter="brand" data-value="${brand}">
        <span class="filter-checkbox-box"></span>
        <span class="filter-checkbox-label">${brand}</span>
        <span class="filter-item-count">${count}</span>
      `;
      container.appendChild(label);
    });

    // Re-attach event listeners
    container.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        handleFilterCheckboxChange(e);
        updateFilterPreviewCount();
      });
    });

    // Reinitialize icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function populateStockCodeOptions(results) {
    const container = document.getElementById('stockcode-filter-tags');
    if (!container) return;

    // Count stock codes
    const stockCodeCounts = {};
    results.forEach(r => {
      const stockCode = r.stockCode || 'N/A';
      stockCodeCounts[stockCode] = (stockCodeCounts[stockCode] || 0) + 1;
    });

    // Sort by count (highest first)
    const sortedStockCodes = Object.entries(stockCodeCounts)
      .sort((a, b) => b[1] - a[1]);

    // Update total count badge
    const totalBadge = document.getElementById('stockcode-total-count');
    if (totalBadge) totalBadge.textContent = sortedStockCodes.length;

    // Keep "All Stock Codes" option
    const allOption = container.querySelector('input[data-value="All"]')?.closest('.filter-checkbox');
    container.innerHTML = '';
    if (allOption) container.appendChild(allOption);

    // Add dynamic stock code options
    sortedStockCodes.forEach(([stockCode, count]) => {
      if (stockCode === 'N/A' || stockCode === '') return;
      
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `
        <input type="checkbox" name="stockCode" value="${stockCode}" data-filter="stockCode" data-value="${stockCode}">
        <span class="filter-checkbox-box"></span>
        <span class="filter-checkbox-label">
          <span class="stock-code-badge-sm">${stockCode}</span>
        </span>
        <span class="filter-item-count">${count}</span>
      `;
      container.appendChild(label);
    });

    // Re-attach event listeners
    container.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        handleFilterCheckboxChange(e);
        updateFilterPreviewCount();
      });
    });

    // Reinitialize icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function generatePriceDistribution(results) {
    const container = document.querySelector('#price-distribution .distribution-bars');
    if (!container) return;

    const prices = results.map(r => parseFloat(r.price) || 0).filter(p => p > 0);
    if (prices.length === 0) {
      container.innerHTML = '';
      return;
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const bucketCount = 20;
    const buckets = new Array(bucketCount).fill(0);

    prices.forEach(price => {
      const bucketIndex = Math.min(
        Math.floor(((price - minPrice) / range) * bucketCount),
        bucketCount - 1
      );
      buckets[bucketIndex]++;
    });

    const maxBucketCount = Math.max(...buckets, 1);

    container.innerHTML = buckets.map((count, i) => {
      const height = (count / maxBucketCount) * 100;
      return `<div class="distribution-bar" style="height: ${Math.max(height, 10)}%;" title="${count} parts"></div>`;
    }).join('');
  }

  function updateFilterPreviewCount() {
    const previewCountEl = document.getElementById('filter-preview-count');
    if (!previewCountEl || state.currentResults.length === 0) return;

    // Calculate how many parts would match current filters
    let count = 0;
    state.currentResults.forEach(part => {
      if (partMatchesFilters(part)) count++;
    });

    previewCountEl.textContent = count;
  }

  function partMatchesFilters(part) {
    const price = parseFloat(part.price) || 0;
    const weight = parseFloat(part.weight) || 0;
    const qty = parseInt(part.quantity) || 0;
    const days = parseInt(part.deliveryDays) || parseInt(part.terms) || 999;

    // Price filter - only check if bounds have changed from defaults
    const priceBoundsChanged = state.selectedFilters.minPrice > filterBounds.price.min || 
                               state.selectedFilters.maxPrice < filterBounds.price.max;
    if (priceBoundsChanged) {
      if (price < state.selectedFilters.minPrice || price > state.selectedFilters.maxPrice) {
        return false;
      }
    }

    // Weight filter - only check if bounds have changed
    const weightBoundsChanged = state.selectedFilters.minWeight > 0 || 
                                state.selectedFilters.maxWeight < filterBounds.weight.max;
    if (weightBoundsChanged) {
      if (weight < state.selectedFilters.minWeight || weight > state.selectedFilters.maxWeight) {
        return false;
      }
    }

    // Quantity filter
    if (state.selectedFilters.minQuantity > 0) {
      if (qty < state.selectedFilters.minQuantity) {
        return false;
      }
    }

    // Delivery filter - use slider values
    if (state.selectedFilters.minDeliveryDays !== undefined && state.selectedFilters.maxDeliveryDays !== undefined) {
      const minDays = state.selectedFilters.minDeliveryDays;
      const maxDays = state.selectedFilters.maxDeliveryDays;
      if (minDays > 0 || maxDays < 30) {
        if (days < minDays || days > maxDays) {
          return false;
        }
      }
    }

    // Brand filter
    if (state.selectedFilters.brand !== 'all') {
      const brands = Array.isArray(state.selectedFilters.brand)
        ? state.selectedFilters.brand
        : [state.selectedFilters.brand];
      const partBrand = (part.brand || '').toLowerCase();
      if (!brands.some(b => partBrand.includes(b.toLowerCase()))) {
        return false;
      }
    }

    // Stock Code filter
    if (state.selectedFilters.stockCode && state.selectedFilters.stockCode !== 'all') {
      const stockCodes = Array.isArray(state.selectedFilters.stockCode)
        ? state.selectedFilters.stockCode
        : [state.selectedFilters.stockCode];
      const partStockCode = part.stockCode || 'N/A';
      if (!stockCodes.includes(partStockCode)) {
        return false;
      }
    }

    return true;
  }

  function handleFilterCheckboxChange(e) {
    const checkbox = e.target;
    const filterType = checkbox.dataset.filter;
    const filterValue = checkbox.dataset.value;
    const group = checkbox.closest('.filter-options');

    if (!group) return;

    // Handle "All" checkbox
    if (filterValue === 'All') {
      if (checkbox.checked) {
        // Uncheck all other checkboxes in this group
        group.querySelectorAll('.filter-checkbox input').forEach(cb => {
          if (cb !== checkbox) cb.checked = false;
        });
        // Reset state for this filter
        state.selectedFilters[filterType] = 'all';
      } else {
        // Don't allow unchecking All if nothing else is selected
        checkbox.checked = true;
      }
    } else {
      // Uncheck "All" when selecting specific items
      const allCheckbox = group.querySelector('.filter-checkbox input[data-value="All"]');
      if (allCheckbox) allCheckbox.checked = false;

      // Get all checked values
      const checkedValues = Array.from(group.querySelectorAll('.filter-checkbox input:checked'))
        .filter(cb => cb.dataset.value !== 'All')
        .map(cb => cb.dataset.value);

      if (checkedValues.length === 0) {
        // If nothing selected, select All
        if (allCheckbox) allCheckbox.checked = true;
        state.selectedFilters[filterType] = 'all';
      } else {
        state.selectedFilters[filterType] = checkedValues;
      }
    }

    updateActiveFiltersBar();
    updateFilterPreviewCount();
  }

  // Legacy function for tag-based filters (kept for backwards compatibility)
  function handleFilterTagClick(e) {
    const tag = e.currentTarget;
    const filterType = tag.dataset.filter;
    const filterValue = tag.dataset.value;

    // Get parent group
    const group = tag.closest('.filter-tags');
    if (!group) return;

    // For 'All' selection, deselect others
    if (filterValue === 'All') {
      group.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      
      // Update state
      if (filterType === 'brand') state.selectedFilters.brand = 'all';
      else if (filterType === 'stockCode') state.selectedFilters.stockCode = 'all';
      else if (filterType === 'delivery') state.selectedFilters.delivery = 'all';
    } else {
      // Deselect 'All' and toggle this one
      group.querySelector('.filter-tag[data-value="All"]')?.classList.remove('active');
      tag.classList.toggle('active');

      // Update state based on active selections
      const activeValues = Array.from(group.querySelectorAll('.filter-tag.active'))
        .filter(t => t.dataset.value !== 'All')
        .map(t => t.dataset.value);

      if (activeValues.length === 0) {
        // If nothing selected, select All
        group.querySelector('.filter-tag[data-value="All"]')?.classList.add('active');
        if (filterType === 'brand') state.selectedFilters.brand = 'all';
        else if (filterType === 'stockCode') state.selectedFilters.stockCode = 'all';
        else if (filterType === 'delivery') state.selectedFilters.delivery = 'all';
      } else {
        // Store active values
        if (filterType === 'brand') state.selectedFilters.brand = activeValues;
        else if (filterType === 'stockCode') state.selectedFilters.stockCode = activeValues;
        else if (filterType === 'delivery') state.selectedFilters.delivery = activeValues;
      }
    }

    updateActiveFiltersBar();
  }

  function handleBrandSearch(e) {
    const query = e.target.value.toLowerCase();
    const brandContainer = document.getElementById('brand-filter-tags');
    if (!brandContainer) return;

    brandContainer.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      const label = checkbox.querySelector('.filter-checkbox-label');
      const brandName = label ? label.textContent.toLowerCase() : '';
      const value = checkbox.querySelector('input').dataset.value;
      
      if (brandName.includes(query) || value === 'All') {
        checkbox.style.display = '';
      } else {
        checkbox.style.display = 'none';
      }
    });
  }

  function handleApplyAdvancedFilters() {
    // Reset to page 1 on filter change
    state.currentPage = 1;
    // Apply filters to current results
    applyAdvancedFiltersToResults();
    hideFiltersPanel();
  }

  function applyAdvancedFiltersToResults() {
    if (state.currentResults.length === 0) return;

    let results = [...state.currentResults];

    // Price filter - use dynamic bounds
    const priceBoundsChanged = state.selectedFilters.minPrice > filterBounds.price.min || 
                               state.selectedFilters.maxPrice < filterBounds.price.max;
    if (priceBoundsChanged) {
      results = results.filter(part => {
        const price = parseFloat(part.price) || 0;
        return price >= state.selectedFilters.minPrice && price <= state.selectedFilters.maxPrice;
      });
    }

    // Weight filter - use dynamic bounds
    const weightBoundsChanged = state.selectedFilters.minWeight > 0 || 
                                state.selectedFilters.maxWeight < filterBounds.weight.max;
    if (weightBoundsChanged) {
      results = results.filter(part => {
        const weight = parseFloat(part.weight) || 0;
        return weight >= state.selectedFilters.minWeight && weight <= state.selectedFilters.maxWeight;
      });
    }

    // Minimum quantity filter
    if (state.selectedFilters.minQuantity > 0) {
      results = results.filter(part => {
        const qty = parseFloat(part.quantity) || 0;
        return qty >= state.selectedFilters.minQuantity;
      });
    }

    // Brand filter
    if (state.selectedFilters.brand !== 'all') {
      const brands = Array.isArray(state.selectedFilters.brand) 
        ? state.selectedFilters.brand 
        : [state.selectedFilters.brand];
      results = results.filter(part => {
        const partBrand = (part.brand || '').toLowerCase();
        return brands.some(b => partBrand.toLowerCase().includes(b.toLowerCase()));
      });
    }

    // Stock Code filter
    if (state.selectedFilters.stockCode && state.selectedFilters.stockCode !== 'all') {
      const stockCodes = Array.isArray(state.selectedFilters.stockCode) 
        ? state.selectedFilters.stockCode 
        : [state.selectedFilters.stockCode];
      results = results.filter(part => {
        const partStockCode = part.stockCode || 'N/A';
        return stockCodes.includes(partStockCode);
      });
    }

    // Delivery filter - use slider values if set
    if (state.selectedFilters.minDeliveryDays !== undefined && state.selectedFilters.maxDeliveryDays !== undefined) {
      const minDays = state.selectedFilters.minDeliveryDays;
      const maxDays = state.selectedFilters.maxDeliveryDays;
      if (minDays > 0 || maxDays < 30) {
        results = results.filter(part => {
          const days = parseInt(part.deliveryDays) || parseInt(part.terms) || 999;
          return days >= minDays && days <= maxDays;
        });
      }
    } else if (state.selectedFilters.delivery !== 'all') {
      // Fallback to checkbox-based delivery filter
      const deliveryRanges = Array.isArray(state.selectedFilters.delivery)
        ? state.selectedFilters.delivery
        : [state.selectedFilters.delivery];
      results = results.filter(part => {
        const days = parseInt(part.deliveryDays) || parseInt(part.terms) || 999;
        return deliveryRanges.some(range => {
          if (range === '1-2') return days <= 2;
          if (range === '3-5') return days >= 3 && days <= 5;
          if (range === '7-14') return days >= 7 && days <= 14;
          if (range === '14+') return days > 14;
          return true;
        });
      });
    }

    // Apply current sort
    if (state.currentSort.field !== 'relevance') {
      results = sortResults(results, state.currentSort.field, state.currentSort.order);
    }

    state.filteredResults = results;
    displayResults(results);

    // Update results count
    if (elements.resultsCount) {
      elements.resultsCount.textContent = results.length;
    }

    showCartAlert('success', 'Filters Applied', `Showing ${results.length} of ${state.currentResults.length} parts`);
  }

  function handleClearAdvancedFilters() {
    // Reset page on filter clear
    state.currentPage = 1;
    // Reset state to use current filter bounds
    state.selectedFilters = {
      brand: 'all',
      stockCode: 'all',
      delivery: 'all',
      minPrice: filterBounds.price.min,
      maxPrice: filterBounds.price.max,
      minWeight: 0,
      maxWeight: filterBounds.weight.max,
      minQuantity: 0,
      minDeliveryDays: 0,
      maxDeliveryDays: 30,
    };

    // Reset quick filters
    state.quickFilters = {
      inStockOnly: false,
      lowStockOnly: false
    };

    // Reset sort
    state.currentSort = { field: 'relevance', order: 'desc' };

    // Reset checkbox UI
    document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      if (checkbox.dataset.value === 'All') {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
      }
    });

    // Reset sort buttons
    document.querySelectorAll('.quick-sort-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.sort === 'relevance') {
        btn.classList.add('active');
      }
    });

    // Reset quick filter/delivery buttons
    document.querySelectorAll('.quick-filter-btn, .filter-quick-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Reset price inputs and slider
    const minPriceInput = document.getElementById('min-price-input');
    const maxPriceInput = document.getElementById('max-price-input');
    const priceSliderMin = document.getElementById('price-slider-min');
    const priceSliderMax = document.getElementById('price-slider-max');
    
    if (minPriceInput) minPriceInput.value = filterBounds.price.min;
    if (maxPriceInput) maxPriceInput.value = filterBounds.price.max;
    if (priceSliderMin) priceSliderMin.value = filterBounds.price.min;
    if (priceSliderMax) priceSliderMax.value = filterBounds.price.max;
    
    const minPriceDisplay = document.getElementById('price-range-min-display');
    const maxPriceDisplay = document.getElementById('price-range-max-display');
    if (minPriceDisplay) minPriceDisplay.textContent = formatNumber(filterBounds.price.min);
    if (maxPriceDisplay) maxPriceDisplay.textContent = formatNumber(filterBounds.price.max);
    updateSliderRangeVisual('price');

    // Reset weight inputs and slider
    const minWeightInput = document.getElementById('min-weight-input');
    const maxWeightInput = document.getElementById('max-weight-input');
    const weightSliderMin = document.getElementById('weight-slider-min');
    const weightSliderMax = document.getElementById('weight-slider-max');
    
    if (minWeightInput) minWeightInput.value = 0;
    if (maxWeightInput) maxWeightInput.value = filterBounds.weight.max;
    if (weightSliderMin) weightSliderMin.value = 0;
    if (weightSliderMax) weightSliderMax.value = filterBounds.weight.max;
    
    const minWeightDisplay = document.getElementById('weight-range-min-display');
    const maxWeightDisplay = document.getElementById('weight-range-max-display');
    if (minWeightDisplay) minWeightDisplay.textContent = '0';
    if (maxWeightDisplay) maxWeightDisplay.textContent = filterBounds.weight.max.toFixed(1);
    updateSliderRangeVisual('weight');

    // Reset quantity inputs and slider
    const minQtyInput = document.getElementById('min-quantity-input');
    const qtySliderMin = document.getElementById('qty-slider-min');
    const qtySliderMax = document.getElementById('qty-slider-max');
    
    if (minQtyInput) minQtyInput.value = 0;
    if (qtySliderMin) qtySliderMin.value = 0;
    if (qtySliderMax) qtySliderMax.value = filterBounds.quantity.max;
    
    const minQtyDisplay = document.getElementById('qty-range-min-display');
    const maxQtyDisplay = document.getElementById('qty-range-max-display');
    if (minQtyDisplay) minQtyDisplay.textContent = '0';
    if (maxQtyDisplay) maxQtyDisplay.textContent = filterBounds.quantity.max >= 1000 ? '1000+' : formatNumber(filterBounds.quantity.max);
    updateSliderRangeVisual('qty');

    // Reset delivery slider
    const deliverySliderMin = document.getElementById('delivery-slider-min');
    const deliverySliderMax = document.getElementById('delivery-slider-max');
    
    if (deliverySliderMin) deliverySliderMin.value = 0;
    if (deliverySliderMax) deliverySliderMax.value = 30;
    
    const minDeliveryDisplay = document.getElementById('delivery-range-min-display');
    const maxDeliveryDisplay = document.getElementById('delivery-range-max-display');
    if (minDeliveryDisplay) minDeliveryDisplay.textContent = '0';
    if (maxDeliveryDisplay) maxDeliveryDisplay.textContent = '30+';
    updateSliderRangeVisual('delivery');

    // Hide active filters bar
    const activeFiltersBar = document.getElementById('active-filters-bar');
    if (activeFiltersBar) activeFiltersBar.style.display = 'none';

    // Show all results
    if (state.currentResults.length > 0) {
      state.filteredResults = [...state.currentResults];
      displayResults(state.currentResults);
      updateFilterPreviewCount();
    }

    showCartAlert('success', 'Filters Cleared', 'All filters have been reset');
  }

  function updateActiveFiltersBar() {
    const activeFiltersBar = document.getElementById('active-filters-bar');
    const activeFiltersList = document.getElementById('active-filters-list');
    if (!activeFiltersBar || !activeFiltersList) return;

    const activeChips = [];

    // Check each filter
    if (state.selectedFilters.brand !== 'all') {
      const values = Array.isArray(state.selectedFilters.brand)
        ? state.selectedFilters.brand
        : [state.selectedFilters.brand];
      values.forEach(v => activeChips.push({ type: 'brand', value: v, label: `Brand: ${v}` }));
    }

    if (state.selectedFilters.stockCode && state.selectedFilters.stockCode !== 'all') {
      const values = Array.isArray(state.selectedFilters.stockCode)
        ? state.selectedFilters.stockCode
        : [state.selectedFilters.stockCode];
      values.forEach(v => activeChips.push({ type: 'stockCode', value: v, label: `Stock Code: ${v}` }));
    }

    if (state.selectedFilters.delivery !== 'all') {
      const values = Array.isArray(state.selectedFilters.delivery)
        ? state.selectedFilters.delivery
        : [state.selectedFilters.delivery];
      values.forEach(v => activeChips.push({ type: 'delivery', value: v, label: `${v} days` }));
    }

    if (state.selectedFilters.minPrice > 0) {
      activeChips.push({ type: 'minPrice', value: state.selectedFilters.minPrice, label: `Min: ${state.selectedFilters.minPrice} AED` });
    }

    if (state.selectedFilters.maxPrice < 500000) {
      activeChips.push({ type: 'maxPrice', value: state.selectedFilters.maxPrice, label: `Max: ${state.selectedFilters.maxPrice} AED` });
    }

    if (state.selectedFilters.minWeight > 0) {
      activeChips.push({ type: 'minWeight', value: state.selectedFilters.minWeight, label: `Min Weight: ${state.selectedFilters.minWeight} kg` });
    }

    if (state.selectedFilters.maxWeight < 10000) {
      activeChips.push({ type: 'maxWeight', value: state.selectedFilters.maxWeight, label: `Max Weight: ${state.selectedFilters.maxWeight} kg` });
    }

    if (state.selectedFilters.minQuantity > 0) {
      activeChips.push({ type: 'minQuantity', value: state.selectedFilters.minQuantity, label: `Min Qty: ${state.selectedFilters.minQuantity}` });
    }

    if (activeChips.length > 0) {
      activeFiltersBar.style.display = 'flex';
      activeFiltersList.innerHTML = activeChips.map(chip => `
        <span class="active-filter-chip" data-type="${chip.type}" data-value="${chip.value}">
          ${chip.label}
          <button onclick="removeActiveFilter('${chip.type}', '${chip.value}')">
            <i data-lucide="x"></i>
          </button>
        </span>
      `).join('');

      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nameAttr: 'data-lucide' });
      }
    } else {
      activeFiltersBar.style.display = 'none';
    }
  }

  // Remove a single active filter chip
  function removeActiveFilter(type, value) {
    if (type === 'minPrice') {
      state.selectedFilters.minPrice = 0;
      const input = document.getElementById('min-price-input');
      if (input) input.value = 0;
    } else if (type === 'maxPrice') {
      state.selectedFilters.maxPrice = 500000;
      const input = document.getElementById('max-price-input');
      if (input) input.value = 500000;
    } else if (type === 'minWeight') {
      state.selectedFilters.minWeight = 0;
      const input = document.getElementById('min-weight-input');
      if (input) input.value = 0;
    } else if (type === 'maxWeight') {
      state.selectedFilters.maxWeight = 10000;
      const input = document.getElementById('max-weight-input');
      if (input) input.value = 10000;
    } else if (type === 'minQuantity') {
      state.selectedFilters.minQuantity = 0;
      const input = document.getElementById('min-quantity-input');
      if (input) input.value = 0;
    } else {
      // Multi-value filters (brand, supplier, stock, delivery)
      if (Array.isArray(state.selectedFilters[type])) {
        state.selectedFilters[type] = state.selectedFilters[type].filter(v => v !== value);
        if (state.selectedFilters[type].length === 0) {
          state.selectedFilters[type] = 'all';
        }
      } else {
        state.selectedFilters[type] = 'all';
      }
      
      // Uncheck the corresponding checkbox
      const checkbox = document.querySelector(`.filter-checkbox input[data-filter="${type}"][data-value="${value}"]`);
      if (checkbox) checkbox.checked = false;
    }

    applyAdvancedFiltersToResults();
    updateActiveFiltersBar();
  }

  // Make removeActiveFilter globally accessible
  window.removeActiveFilter = removeActiveFilter;

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

  // DISABLED: AI Excel handler in ai-excel.js handles all file uploads now
  /*
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
      showCartAlert('error', 'Invalid File', 'Please upload a valid Excel file (.xlsx, .xls, or .csv)');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showCartAlert('error', 'File Too Large', 'File size must be less than 10MB');
      return;
    }

    console.log('Processing file:', file.name);
    showCartAlert('info', 'Processing', `Reading ${file.name}...`);

    // Use FileReader to read the file
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = e.target.result;
        let partNumbers = [];

        if (fileExtension === '.csv') {
          // Parse CSV
          partNumbers = parseCSV(data);
        } else {
          // Parse Excel using SheetJS
          if (typeof XLSX === 'undefined') {
            // Load SheetJS dynamically if not available
            loadSheetJS().then(() => {
              const workbook = XLSX.read(data, { type: 'array' });
              partNumbers = parseExcelWorkbook(workbook);
              processExtractedPartNumbers(partNumbers, file.name);
            }).catch(err => {
              console.error('Failed to load SheetJS:', err);
              showCartAlert('error', 'Error', 'Failed to load Excel parser. Please try CSV format.');
            });
            return;
          } else {
            const workbook = XLSX.read(data, { type: 'array' });
            partNumbers = parseExcelWorkbook(workbook);
          }
        }

        processExtractedPartNumbers(partNumbers, file.name);
      } catch (error) {
        console.error('Error parsing file:', error);
        showCartAlert('error', 'Parse Error', 'Failed to parse file. Please check the format.');
      }
    };

    reader.onerror = function() {
      showCartAlert('error', 'Read Error', 'Failed to read file.');
    };

    if (fileExtension === '.csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }
  */

  /**
   * Load SheetJS library dynamically
   */
  function loadSheetJS() {
    return new Promise((resolve, reject) => {
      if (typeof XLSX !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Parse Excel workbook and extract part numbers
   */
  function parseExcelWorkbook(workbook) {
    const partNumbers = [];
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find the column with part numbers
    // Look for headers like "Part Number", "PartNumber", "Part", "Code", "Vendor Code"
    let partNumberColIndex = 0;
    const headerRow = jsonData[0] || [];
    
    for (let i = 0; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').toLowerCase().trim();
      if (header.includes('part') || header.includes('code') || header.includes('vendor') || header.includes('number')) {
        partNumberColIndex = i;
        break;
      }
    }

    console.log('Using column index for part numbers:', partNumberColIndex, '- Header:', headerRow[partNumberColIndex]);

    // Extract part numbers from the identified column (skip header row)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row[partNumberColIndex]) {
        const partNumber = String(row[partNumberColIndex]).trim();
        if (partNumber && partNumber.length > 0 && !partNumber.toLowerCase().includes('part')) {
          partNumbers.push(partNumber);
        }
      }
    }

    return partNumbers;
  }

  /**
   * Parse CSV data and extract part numbers
   */
  function parseCSV(csvText) {
    const partNumbers = [];
    const lines = csvText.split(/\r?\n/);
    
    if (lines.length === 0) return partNumbers;

    // Find delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';

    // Parse header to find part number column
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
    let partNumberColIndex = 0;
    
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes('part') || headers[i].includes('code') || headers[i].includes('vendor') || headers[i].includes('number')) {
        partNumberColIndex = i;
        break;
      }
    }

    // Extract part numbers (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(delimiter);
      if (columns[partNumberColIndex]) {
        const partNumber = columns[partNumberColIndex].trim().replace(/^["']|["']$/g, '');
        if (partNumber && partNumber.length > 0) {
          partNumbers.push(partNumber);
        }
      }
    }

    return partNumbers;
  }

  /**
   * Process extracted part numbers and perform search
   */
  function processExtractedPartNumbers(partNumbers, fileName) {
    // Remove duplicates
    const uniquePartNumbers = [...new Set(partNumbers)];
    
    console.log(`Extracted ${uniquePartNumbers.length} unique part numbers from ${fileName}`);
    
    if (uniquePartNumbers.length === 0) {
      showCartAlert('warning', 'No Parts Found', 'No valid part numbers found in the file. Please check the format.');
      return;
    }

    // Limit to 50 parts
    if (uniquePartNumbers.length > 50) {
      showCartAlert('warning', 'Too Many Parts', `Found ${uniquePartNumbers.length} parts. Processing first 50.`);
    }

    const partsToSearch = uniquePartNumbers.slice(0, 50);
    
    showCartAlert('success', 'File Processed', `Found ${partsToSearch.length} part numbers. Searching...`);
    
    // Hide modal
    hideExcelModal();
    
    // Perform search
    searchFromExcel(partsToSearch);
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
    const row = btn.closest('tr');
    // Get minOrderQty from row data or input min attribute
    const minOrderQty = parseInt(row?.dataset?.minOrderQty) || parseInt(input.min) || 1;
    const current = parseInt(input.value) || minOrderQty;
    if (current > minOrderQty) {
      input.value = current - 1;
      updateRowTotal(input);
    }
  };

  window.updateRowTotal = function (input) {
    const row = input.closest('tr');
    const checkbox = row.querySelector('.table-checkbox');
    const rowTotal = row.querySelector('.row-total');
    const price = parseFloat(checkbox.dataset.price) || 0;
    const partCurrency = checkbox.dataset.currency || 'USD';
    const qty = parseInt(input.value) || 1;
    const total = price * qty;

    // Convert to preferred currency
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const convertedTotal = window.convertToPreferredCurrency 
      ? window.convertToPreferredCurrency(total, partCurrency)
      : total;

    const totalCell = row.querySelector('.row-total');
    if (totalCell) {
      totalCell.textContent = formatPrice(convertedTotal);
      // Update the currency display next to the price
      const priceCell = totalCell.parentElement;
      if (priceCell) {
        const currencySpan = priceCell.querySelector('.currency-code') || priceCell.lastChild;
        if (currencySpan && currencySpan.nodeType === Node.TEXT_NODE) {
          currencySpan.textContent = ' ' + preferredCurrency;
        }
      }
    }

    // Update selected total if checkbox is checked — also sync qty in selectedItems state
    if (checkbox && checkbox.checked) {
      const globalIndex = parseInt(row.dataset.partIndex);
      if (!isNaN(globalIndex)) {
        state.selectedItems.set(globalIndex, { qty });
      }
      updateSelectedTotalFromState();
    }
  };

  window.updateSelectedTotal = function () {
    // Delegate to cross-page state-based calculation
    updateSelectedTotalFromState();
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

    // Prepare cart item - map all fields from Part model/Elasticsearch
    // Get stock quantity (numeric) for status determination
    const stockQty = parseInt(partData.quantity) || parseInt(partData.qty) || parseInt(partData.stock) || 0;
    const cartItem = {
      code: partData.partNumber || partData.vendorCode || partData.code || 'N/A',
      brand: partData.brand || 'N/A',
      description: partData.description || 'N/A',
      supplier: partData.supplier || partData.integrationName || 'N/A',
      terms: partData.deliveryDays ? `${partData.deliveryDays} days` : (partData.terms || 'N/A'),
      weight: parseFloat(partData.weight) || 0,
      stock: determineStockStatus(stockQty),
      aircraftType: partData.aircraftType || partData.category || 'N/A',
      quantity: quantity,
      price: parseFloat(partData.unitPrice || partData.price) || 0,
      currency: partData.currency || 'AED',
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

    // Use state.selectedItems for cross-page selections
    if (state.selectedItems.size === 0) {
      showCartAlert(
        'info',
        'No Selection',
        'Please select items to add to cart'
      );
      return;
    }

    const activeResults = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    let addedCount = 0;

    state.selectedItems.forEach(({ qty }, globalIndex) => {
      const partData = activeResults[globalIndex];
      const quantity = qty || 1;

      if (partData) {
        // Determine current page category
        const pageCategory = determineCategory();

        // Prepare cart item - map all fields from Part model/Elasticsearch
        // Get stock quantity (numeric) for status determination
        const stockQty = parseInt(partData.quantity) || parseInt(partData.qty) || parseInt(partData.stock) || 0;
        const cartItem = {
          code: partData.partNumber || partData.vendorCode || partData.code || 'N/A',
          brand: partData.brand || 'N/A',
          description: partData.description || 'N/A',
          supplier: partData.supplier || partData.integrationName || 'N/A',
          terms: partData.deliveryDays ? `${partData.deliveryDays} days` : (partData.terms || 'N/A'),
          weight: parseFloat(partData.weight) || 0,
          stock: determineStockStatus(stockQty),
          aircraftType: partData.aircraftType || partData.category || 'N/A',
          quantity: quantity,
          price: parseFloat(partData.unitPrice || partData.price) || 0,
          currency: partData.currency || 'AED',
          reference: '',
          category: pageCategory,
        };

        // Add to cart
        window.PartsFormCart.addToCart(cartItem);
        addedCount++;
      }
    });

    // Clear all selections
    state.selectedItems.clear();
    // Uncheck visible checkboxes
    document.querySelectorAll('.table-checkbox:checked').forEach(cb => cb.checked = false);

    // Update selected total
    updateSelectedTotalFromState();

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

  function determineStockStatus(stockOrQty) {
    // Handle string stock status from Part model
    if (typeof stockOrQty === 'string') {
      const stock = stockOrQty.toLowerCase();
      if (stock === 'out-of-stock' || stock === 'out-stock') return 'ST3';
      if (stock === 'low-stock') return 'ST2';
      if (stock === 'in-stock') return 'ST1';
      // If it's a numeric string, parse it
      const qty = parseInt(stockOrQty);
      if (!isNaN(qty)) {
        if (qty <= 5) return 'ST3';
        if (qty <= 10) return 'ST2';
        return 'ST1';
      }
      return 'ST3'; // Default to out of stock for unknown strings
    }
    // Handle numeric quantity
    const qty = parseInt(stockOrQty) || 0;
    if (qty <= 5) return 'ST3';
    if (qty <= 10) return 'ST2';
    return 'ST1';
  }

  /**
   * Show a persistent banner with search analytics from Excel/multi-search
   */
  function showNotFoundBanner(notFoundParts, source = 'Excel', stats = {}) {
    // Remove existing banner if any
    hideNotFoundBanner();
    
    // Calculate analytics
    const found = stats.found || [];
    const duplicates = stats.duplicates || [];
    const totalSearched = stats.totalSearched || (found.length + (notFoundParts?.length || 0));
    const foundCount = found.length;
    const notFoundCount = notFoundParts?.length || 0;
    const duplicateCount = duplicates.length;
    
    // Calculate success rate
    const successRate = totalSearched > 0 ? Math.round((foundCount / totalSearched) * 100) : 0;
    const failRate = 100 - successRate;
    
    // If nothing to show, don't show banner
    if (notFoundCount === 0 && duplicateCount === 0) return;

    const banner = document.createElement('div');
    banner.id = 'not-found-banner';
    banner.className = 'search-analytics-banner';
    
    // Limit display to first 8 parts
    const displayParts = notFoundParts?.slice(0, 8) || [];
    const remainingCount = (notFoundParts?.length || 0) - displayParts.length;
    
    // Build duplicates info
    let duplicatesHtml = '';
    if (duplicateCount > 0) {
      const dupDisplay = duplicates.slice(0, 5);
      const dupRemaining = duplicates.length - dupDisplay.length;
      duplicatesHtml = `
        <div class="analytics-duplicates">
          <i data-lucide="copy"></i>
          <span><strong>${duplicateCount}</strong> duplicate${duplicateCount > 1 ? 's' : ''} merged</span>
          <span class="duplicate-parts">${dupDisplay.map(d => d.partNumber || d).join(', ')}${dupRemaining > 0 ? ` +${dupRemaining} more` : ''}</span>
        </div>
      `;
    }
    
    // Build not found info
    let notFoundHtml = '';
    if (notFoundCount > 0) {
      notFoundHtml = `
        <div class="analytics-not-found">
          <i data-lucide="alert-circle"></i>
          <span><strong>${notFoundCount}</strong> part${notFoundCount > 1 ? 's' : ''} not found</span>
          <span class="not-found-parts">${displayParts.join(', ')}${remainingCount > 0 ? ` +${remainingCount} more` : ''}</span>
        </div>
      `;
    }
    
    banner.innerHTML = `
      <div class="analytics-banner-content">
        <div class="analytics-row">
          <div class="analytics-left">
            <span class="analytics-label">${source} Import</span>
            <span class="analytics-sep">•</span>
            <span class="stat-inline found"><i data-lucide="check"></i> ${foundCount} found</span>
            <span class="analytics-sep">•</span>
            <span class="stat-inline not-found"><i data-lucide="x"></i> ${notFoundCount} not found</span>
            ${duplicateCount > 0 ? `<span class="analytics-sep">•</span><span class="stat-inline duplicates"><i data-lucide="copy"></i> ${duplicateCount} duplicates</span>` : ''}
          </div>
          <div class="analytics-right">
            <span class="success-rate ${successRate >= 80 ? 'good' : successRate >= 50 ? 'warning' : 'low'}">${successRate}% success</span>
            <button class="analytics-close" onclick="window.hideNotFoundBanner()">
              <i data-lucide="x"></i>
            </button>
          </div>
        </div>
        ${notFoundCount > 0 ? `<div class="analytics-parts"><span class="parts-label">Not found:</span> <span class="parts-list">${displayParts.join(', ')}${remainingCount > 0 ? ` +${remainingCount} more` : ''}</span></div>` : ''}
      </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('analytics-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'analytics-banner-styles';
      style.textContent = `
        .search-analytics-banner {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 20px;
        }
        .analytics-banner-content {
          max-width: 1400px;
          margin: 0 auto;
        }
        .analytics-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .analytics-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .analytics-label {
          font-weight: 600;
          color: #1e293b;
          font-size: 13px;
        }
        .analytics-sep {
          color: #cbd5e1;
          font-size: 10px;
        }
        .stat-inline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        .stat-inline svg { width: 14px; height: 14px; }
        .stat-inline.found { background: #dcfce7; color: #16a34a; }
        .stat-inline.not-found { background: #fee2e2; color: #dc2626; }
        .stat-inline.duplicates { background: #e0e7ff; color: #4f46e5; }
        .analytics-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .success-rate {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
        }
        .success-rate.good { background: #dcfce7; color: #16a34a; }
        .success-rate.warning { background: #fef3c7; color: #d97706; }
        .success-rate.low { background: #fee2e2; color: #dc2626; }
        .analytics-close {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .analytics-close:hover { background: rgba(0,0,0,0.08); }
        .analytics-close svg { width: 16px; height: 16px; color: #94a3b8; }
        .analytics-parts {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #64748b;
        }
        .parts-label { color: #94a3b8; }
        .parts-list {
          font-family: 'SF Mono', Monaco, monospace;
          color: #475569;
        }
        @media (max-width: 640px) {
          .analytics-row { flex-direction: column; align-items: flex-start; gap: 8px; }
          .analytics-right { width: 100%; justify-content: space-between; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert banner before results table
    const resultsContainer = elements.resultsTableContainer;
    if (resultsContainer) {
      resultsContainer.parentNode.insertBefore(banner, resultsContainer);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    
    // Initialize lucide icons in the banner
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Hide the not-found banner
   */
  function hideNotFoundBanner() {
    const banner = document.getElementById('not-found-banner');
    if (banner) {
      banner.remove();
    }
  }

  // Expose hideNotFoundBanner globally for the close button
  window.hideNotFoundBanner = hideNotFoundBanner;

  // Expose showCartAlert globally so other scripts (ai-excel.js etc.) can show notifications
  window.showCartAlert = showCartAlert;

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

  // Listen for preferred currency changes to refresh prices
  function setupCurrencyChangeListener() {
    window.addEventListener('preferredCurrencyChanged', (event) => {
      // Refresh all displayed prices when currency changes
      refreshAllPrices();
    });
  }

  function refreshAllPrices() {
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const isOriginal = window.isShowingOriginalPrice ? window.isShowingOriginalPrice() : false;
    
    // Update all row totals
    document.querySelectorAll('.table-checkbox').forEach((checkbox) => {
      const row = checkbox.closest('tr');
      if (!row) return;
      
      const qtyInput = row.querySelector('.qty-input');
      const rowTotal = row.querySelector('.row-total');
      const price = parseFloat(checkbox.dataset.price) || 0;
      const partCurrency = checkbox.dataset.currency || 'USD';
      const qty = parseInt(qtyInput?.value) || 1;
      
      const total = price * qty;
      const convertedTotal = window.convertToPreferredCurrency 
        ? window.convertToPreferredCurrency(total, partCurrency)
        : total;
      
      // Determine which currency to display
      const displayCurrency = isOriginal ? partCurrency : preferredCurrency;
      
      if (rowTotal) {
        rowTotal.textContent = formatPrice(convertedTotal);
        // Update currency code in the cell
        const priceCell = rowTotal.parentElement;
        if (priceCell) {
          // Update the last text node (currency code)
          const nodes = priceCell.childNodes;
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeType === Node.TEXT_NODE && nodes[i].textContent.trim()) {
              nodes[i].textContent = ' ' + displayCurrency;
              break;
            }
          }
        }
      }
    });
    
    // Update selected total
    if (typeof window.updateSelectedTotal === 'function') {
      window.updateSelectedTotal();
    }
    
    // Recalculate filter bounds based on current results with new currency
    if (state.currentResults && state.currentResults.length > 0) {
      calculateFilterBounds(state.currentResults);
      updateSliderBounds();
    }
  }
  
  // Update the price range filter to show dynamic currency
  function updatePriceFilterCurrency(preferredCurrency, isOriginal) {
    const priceCurrencyLabel = document.getElementById('price-currency');
    
    if (priceCurrencyLabel) {
      if (isOriginal) {
        // When showing original prices, show "Mixed" since parts can have different currencies
        priceCurrencyLabel.textContent = 'Mixed';
        priceCurrencyLabel.title = 'Prices shown in original currencies';
      } else {
        priceCurrencyLabel.textContent = preferredCurrency;
        priceCurrencyLabel.title = `Prices converted to ${preferredCurrency}`;
      }
    }
    
    // Update the min/max display values with currency conversion if needed
    updatePriceSliderWithCurrency(preferredCurrency, isOriginal);
  }
  
  // Update price slider values based on preferred currency
  function updatePriceSliderWithCurrency(preferredCurrency, isOriginal) {
    const minDisplay = document.getElementById('price-range-min-display');
    const maxDisplay = document.getElementById('price-range-max-display');
    const sliderMin = document.getElementById('price-slider-min');
    const sliderMax = document.getElementById('price-slider-max');
    const minInput = document.getElementById('min-price-input');
    const maxInput = document.getElementById('max-price-input');
    
    if (!sliderMin || !sliderMax) return;
    
    // Get current USD base values from slider (these are the actual filter values)
    const baseMinPrice = parseInt(sliderMin.value) || 0;
    const baseMaxPrice = parseInt(sliderMax.value) || 500000;
    
    // Convert to preferred currency for display
    let displayMin = baseMinPrice;
    let displayMax = baseMaxPrice;
    
    if (window.convertToPreferredCurrency && !isOriginal && preferredCurrency !== 'USD') {
      displayMin = Math.round(window.convertToPreferredCurrency(baseMinPrice, 'USD'));
      displayMax = Math.round(window.convertToPreferredCurrency(baseMaxPrice, 'USD'));
    }
    
    // Update display values
    if (minDisplay) minDisplay.textContent = formatNumber(displayMin);
    if (maxDisplay) maxDisplay.textContent = formatNumber(displayMax);
    
    // Update input fields with converted values
    if (minInput) minInput.value = displayMin;
    if (maxInput) maxInput.value = displayMax;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initTableScrollIndicator();
      setupAuthListener();
      setupCurrencyChangeListener();
      setupAISearchListener();
    });
  } else {
    init();
    initTableScrollIndicator();
    setupAuthListener();
    setupCurrencyChangeListener();
    setupAISearchListener();
  }
})();

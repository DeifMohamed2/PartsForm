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
    console.log('Search2 page initialized');
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function setupEventListeners() {
    // Search input events
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.searchInput?.addEventListener('keydown', handleSearchKeydown);
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
    elements.advancedFilterTrigger?.addEventListener('click', showFiltersPanel);
    elements.filtersPanelClose?.addEventListener('click', hideFiltersPanel);
    elements.filtersBackdrop?.addEventListener('click', hideFiltersPanel);
    elements.clearAllFilters?.addEventListener('click', clearFilters);
    elements.applyFilters?.addEventListener('click', applyFilters);

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', handleFilterChipClick);
    });

    // Excel modal
    elements.excelUploadTrigger?.addEventListener('click', showExcelModal);
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
  }

  // ====================================
  // SEARCH FUNCTIONALITY
  // ====================================
  function handleSearchInput(e) {
    const query = e.target.value.trim();

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
        '<tr><td colspan="12" style="text-align: center; padding: 40px;">Searching...</td></tr>';
    }

    // Make API call to search for parts
    fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partNumber: query }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.results && data.results.length > 0) {
          // Apply client-side filters to API results
          const filteredResults = data.results.filter((part) => {
            const matchesBrand =
              state.selectedFilters.brand === 'all' ||
              part.brand.toLowerCase() ===
                state.selectedFilters.brand.toLowerCase();

            const matchesStock =
              state.selectedFilters.stock === 'all' ||
              (part.stock > 10 && state.selectedFilters.stock === 'in-stock') ||
              (part.stock <= 10 &&
                part.stock > 5 &&
                state.selectedFilters.stock === 'low-stock') ||
              (part.stock <= 5 && state.selectedFilters.stock === 'out-stock');

            const matchesOrigin =
              state.selectedFilters.origin === 'all' ||
              part.origin.toLowerCase() ===
                state.selectedFilters.origin.toLowerCase();

            const matchesPrice =
              part.unitPrice >= state.selectedFilters.minPrice &&
              part.unitPrice <= state.selectedFilters.maxPrice;

            return (
              matchesBrand && matchesStock && matchesOrigin && matchesPrice
            );
          });

          state.currentResults = filteredResults;
          displayResults(filteredResults);
        } else {
          // No results found
          state.currentResults = [];
          displayResults([]);
        }
      })
      .catch((error) => {
        console.error('Search error:', error);
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
    const queryLower = query.toLowerCase();

    // Filter suggestions (match anywhere for better results)
    const suggestions = mockPartsDatabase
      .filter(
        (part) =>
          part.code.toLowerCase().includes(queryLower) ||
          part.description.toLowerCase().includes(queryLower) ||
          part.brand.toLowerCase().includes(queryLower)
      )
      .slice(0, 10);

    if (suggestions.length === 0) {
      hideAutocomplete();
      return;
    }

    state.autocompleteResults = suggestions;
    state.autocompleteIndex = -1;

    // Render suggestions
    elements.autocompleteContainer.innerHTML = suggestions
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

      // Render table rows - Updated to use API data format
      tableBody.innerHTML = results
        .map((part) => {
          const price = part.unitPrice || part.price || 0;
          const code = part.vendorCode || part.code || 'N/A';
          const quantity = part.stock || part.qty || 0;
          const weight = part.weight
            ? typeof part.weight === 'number'
              ? `${part.weight} kg`
              : part.weight
            : 'N/A';
          const delivery = part.delivery
            ? typeof part.delivery === 'number'
              ? `${part.delivery} days`
              : part.delivery
            : 'N/A';

          // Determine stock status
          let stockStatus = 'in-stock';
          let stockBadge = 'ST1';
          if (quantity <= 5) {
            stockStatus = 'out-stock';
            stockBadge = 'ST3';
          } else if (quantity <= 10) {
            stockStatus = 'low-stock';
            stockBadge = 'ST2';
          }

          return `
                <tr data-part-code="${code}">
                    <td>
                        <input type="checkbox" class="table-checkbox" data-price="${price}" onchange="updateSelectedTotal()">
                    </td>
                    <td><strong>${part.brand || 'N/A'}</strong></td>
                    <td><strong>${code}</strong></td>
                    <td>${part.description || 'N/A'}</td>
                    <td>${part.supplier || 'N/A'}</td>
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
                            <input type="number" class="qty-input" value="1" min="1" max="${quantity}" onchange="updateRowTotal(this)">
                            <button class="qty-btn" onclick="incrementQty(this)">+</button>
                        </div>
                    </td>
                    <td>
                        <strong class="row-total">${formatPrice(
                          price
                        )}</strong> AED
                    </td>
                </tr>
            `;
        })
        .join('');
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
    if (checkbox.checked) {
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
    });
  } else {
    init();
    initTableScrollIndicator();
  }
})();

// ====================================
// SEARCH V2 PAGE - NEW DESIGN SEARCH FUNCTIONALITY
// Mirrors search.js with V2 specific selectors
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
    selectedItems: new Map(),
    recentSearches: JSON.parse(localStorage.getItem('recentSearches') || '[]'),
    autocompleteIndex: -1,
    autocompleteResults: [],
    autocompleteAbort: null,
  };

  // ====================================
  // DOM ELEMENTS
  // ====================================
  const elements = {
    searchInput: document.getElementById('search2-input'),
    searchBtn: document.getElementById('search2-btn'),
    autocompleteContainer: document.getElementById('search2-autocomplete'),
    resultsTableContainer: document.getElementById('results-table-container'),
    resultsTableBody: document.getElementById('results-table-body'),
    paginationContainer: document.getElementById('results-pagination'),
    pageContainer: document.querySelector('.searchv2-page'),
    noResultsState: document.getElementById('no-results-state'),
    noResultsQuery: document.getElementById('no-results-query'),
    footerResultsCount: document.getElementById('footer-results-count'),
    selectedTotalValue: document.getElementById('selected-total-value'),
    addToCartBtn: document.getElementById('add-to-cart-btn'),
    excelUploadTrigger: document.getElementById('excel-upload-trigger'),
    aiFilterTrigger: document.getElementById('ai-filter-trigger'),
  };

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    setupEventListeners();
    setupAuthListener();
    setupAISearchListener();
    checkAuthAndUpdateUI();
    setScrollLock(true);
    console.log('Search V2 page initialized');
  }

  function setScrollLock(locked) {
    if (elements.pageContainer) {
      elements.pageContainer.classList.toggle('no-results-yet', locked);
    }
  }

  // ====================================
  // AUTHENTICATION CHECK
  // ====================================
  function checkAuthAndUpdateUI() {
    const isLoggedIn = typeof window.BuyerAuth !== 'undefined' && window.BuyerAuth.isLoggedIn();

    if (!isLoggedIn) {
      if (elements.searchInput) {
        elements.searchInput.placeholder = 'Please sign in to search for parts...';
      }
    } else {
      if (elements.searchInput) {
        elements.searchInput.placeholder = window.__translations?.search?.placeholder || 
          'Enter part number, vehicle model, or description...';
      }
    }
  }

  function setupAuthListener() {
    window.addEventListener('userLoggedIn', () => checkAuthAndUpdateUI());
    window.addEventListener('storage', () => checkAuthAndUpdateUI());
    setInterval(() => checkAuthAndUpdateUI(), 2000);
  }

  // ====================================
  // AI SEARCH LISTENER
  // ====================================
  function setupAISearchListener() {
    window.addEventListener('aiSearchResults', (event) => {
      const { results, query, parsed } = event.detail;
      if (results && results.length > 0) {
        state.currentResults = results;
        state.filteredResults = results;
        state.searchQuery = query || 'AI Search';
        displayResults(results);
        if (elements.searchInput && query) {
          elements.searchInput.value = query;
        }
      }
    });

    window.addEventListener('aiFiltersApplied', (event) => {
      const { filters, aiResults, aiQuery } = event.detail;
      if (aiResults && aiResults.length > 0) {
        state.currentResults = aiResults;
        state.filteredResults = aiResults;
        state.searchQuery = aiQuery || 'AI Search';
        displayResults(aiResults);
        if (elements.searchInput && aiQuery) {
          elements.searchInput.value = aiQuery;
        }
      }
    });
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function setupEventListeners() {
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.searchInput?.addEventListener('keydown', handleSearchKeydown);
    elements.searchBtn?.addEventListener('click', performSearch);
    
    document.addEventListener('click', handleOutsideClick);

    if (elements.addToCartBtn) {
      elements.addToCartBtn.addEventListener('click', handleAddToCart);
    }

    // Sortable headers
    document.querySelectorAll('.results-table-v2 thead th.sortable').forEach(th => {
      th.addEventListener('click', () => handleSort(th.dataset.sort));
    });
  }

  // ====================================
  // SEARCH FUNCTIONALITY
  // ====================================
  function handleSearchInput(e) {
    const query = e.target.value.trim();

    if (typeof window.BuyerAuth === 'undefined' || !window.BuyerAuth.isLoggedIn()) {
      if (query.length > 0) {
        if (typeof window.showLoginModal === 'function') {
          window.showLoginModal();
        }
        setTimeout(() => { elements.searchInput.value = ''; }, 100);
        return;
      }
      return;
    }

    if (query.length >= 1) {
      showAutocomplete(query);
    } else {
      hideAutocomplete();
    }
  }

  function handleSearchKeydown(e) {
    const items = elements.autocompleteContainer?.querySelectorAll('.autocomplete-item') || [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.autocompleteIndex = Math.min(state.autocompleteIndex + 1, items.length - 1);
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
    const query = elements.searchInput?.value.trim();
    if (!query) return;

    if (typeof window.BuyerAuth === 'undefined' || !window.BuyerAuth.isLoggedIn()) {
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      }
      return;
    }

    state.searchQuery = query;
    hideAutocomplete();

    const isMultiSearch = /[,;]/.test(query);
    if (isMultiSearch) {
      performMultiSearch(query);
    } else {
      performSingleSearch(query);
    }
  }

  function performSingleSearch(query) {
    showLoading();

    const params = new URLSearchParams({ q: query, limit: 100 });

    if (state.selectedFilters.brand !== 'all') {
      params.append('brand', state.selectedFilters.brand);
    }

    fetch(`/buyer/api/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    })
      .then(response => {
        if (response.status === 401) throw new Error('Authentication required');
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data.success && data.results && data.results.length > 0) {
          state.currentResults = data.results;
          state.filteredResults = data.results;
          state.currentPage = 1;
          state.selectedItems.clear();
          displayResults(data.results);
          saveRecentSearch(query);
        } else {
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
        }
      })
      .catch(error => {
        console.error('Search error:', error);
        showError('Error searching for parts. Please try again.');
      });
  }

  function performMultiSearch(query) {
    let partNumbers = query
      .split(/[,;]+/)
      .map(p => p.trim().replace(/^['''`"]+/, '').trim())
      .filter(p => p.length > 0);

    if (partNumbers.length === 0) return;

    const MAX_SEARCH_PARTS = 1000;
    if (partNumbers.length > MAX_SEARCH_PARTS) {
      partNumbers = partNumbers.slice(0, MAX_SEARCH_PARTS);
    }

    showLoading(`Searching for ${partNumbers.length} part numbers...`);

    fetch('/buyer/api/search/multi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ partNumbers }),
    })
      .then(response => {
        if (response.status === 401) throw new Error('Authentication required');
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data.success && data.results && data.results.length > 0) {
          state.currentResults = data.results;
          state.filteredResults = data.results;
          state.currentPage = 1;
          state.selectedItems.clear();
          displayResults(data.results);
          saveRecentSearch(query);
        } else {
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
        }
      })
      .catch(error => {
        console.error('Multi-search error:', error);
        showError('Error searching for parts. Please try again.');
      });
  }

  // Expose for Excel import
  window.searchFromExcel = function(partNumbers) {
    if (!partNumbers || partNumbers.length === 0) return;

    partNumbers = partNumbers.map(p => p.replace(/^['''\u2018\u2019`"]+/, '').trim()).filter(Boolean);

    if (typeof window.BuyerAuth === 'undefined' || !window.BuyerAuth.isLoggedIn()) {
      if (typeof window.showLoginModal === 'function') window.showLoginModal();
      return;
    }

    elements.searchInput.value = partNumbers.slice(0, 5).join(', ') + 
      (partNumbers.length > 5 ? ` ... +${partNumbers.length - 5} more` : '');

    showLoading(`Searching for ${partNumbers.length} parts from Excel...`);

    fetch('/buyer/api/search/multi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ partNumbers }),
    })
      .then(response => {
        if (response.status === 401) throw new Error('Authentication required');
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data.success && data.results && data.results.length > 0) {
          state.currentResults = data.results;
          state.filteredResults = data.results;
          displayResults(data.results);
        } else {
          state.currentResults = [];
          state.filteredResults = [];
          displayResults([]);
        }
      })
      .catch(error => {
        console.error('Excel search error:', error);
        showError('Failed to search parts from Excel');
      });
  };

  // ====================================
  // AUTOCOMPLETE
  // ====================================
  function showAutocomplete(query) {
    // Abort any in-flight autocomplete request
    if (state.autocompleteAbort) {
      state.autocompleteAbort.abort();
    }
    state.autocompleteAbort = new AbortController();

    fetch(`/buyer/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=10`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      signal: state.autocompleteAbort.signal,
    })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.suggestions && data.suggestions.length > 0) {
          state.autocompleteResults = data.suggestions.map(s => ({
            partNumber: s.partNumber,
            brand: s.brand || '',
            count: s.count || 1,
          }));
          state.autocompleteIndex = -1;

          elements.autocompleteContainer.innerHTML = state.autocompleteResults
            .map((part, index) => `
              <div class="autocomplete-item" data-index="${index}">
                <i data-lucide="package"></i>
                <div class="autocomplete-content">
                  <div class="autocomplete-title">${highlightMatch(part.partNumber, query)}</div>
                  <div class="autocomplete-desc">${part.brand} ${part.count ? `• ${part.count} supplier${part.count > 1 ? 's' : ''}` : ''}</div>
                </div>
              </div>
            `).join('');

          elements.autocompleteContainer.querySelectorAll('.autocomplete-item')
            .forEach((item, index) => {
              item.addEventListener('click', () => selectAutocompleteItem(index));
            });

          elements.autocompleteContainer.classList.add('active');
          if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
          hideAutocomplete();
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        hideAutocomplete();
      });
  }

  function hideAutocomplete() {
    if (elements.autocompleteContainer) {
      elements.autocompleteContainer.classList.remove('active');
    }
    state.autocompleteIndex = -1;
  }

  function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
      item.classList.toggle('active', index === state.autocompleteIndex);
    });
  }

  function selectAutocompleteItem(index) {
    const selected = state.autocompleteResults[index];
    if (selected) {
      elements.searchInput.value = selected.partNumber;
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
    if (!elements.searchInput?.contains(e.target) && 
        !elements.autocompleteContainer?.contains(e.target)) {
      hideAutocomplete();
    }
  }

  // ====================================
  // DISPLAY RESULTS
  // ====================================
  function displayResults(results) {
    if (results.length === 0) {
      setScrollLock(true);
      showNoResults();
      return;
    }
    setScrollLock(false);
    hideNoResults();

    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / state.resultsPerPage);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;
    
    const startIndex = (state.currentPage - 1) * state.resultsPerPage;
    const endIndex = Math.min(startIndex + state.resultsPerPage, totalResults);
    const pageResults = results.slice(startIndex, endIndex);

    // Update footer count
    if (elements.footerResultsCount) {
      elements.footerResultsCount.textContent = totalResults;
    }

    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';

    // Render table rows
    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML = pageResults.map((part, localIdx) => {
        const globalIndex = startIndex + localIdx;
        const price = part.price || part.unitPrice || 0;
        const partCurrency = part.currency || 'USD';
        const code = part.partNumber || part.vendorCode || part.code || 'N/A';
        const quantity = part.quantity || part.stock || part.qty || 0;
        const weight = part.weight ? (typeof part.weight === 'number' ? `${part.weight} kg` : part.weight) : 'N/A';
        const delivery = part.deliveryTime || (part.deliveryDays != null ? String(part.deliveryDays) : '') || 'N/A';
        const stockCode = part.stockCode || 'N/A';
        const volume = part.volume ? (typeof part.volume === 'number' && part.volume > 0 ? `${part.volume} m³` : part.volume) : 'N/A';
        const minOrderQty = part.minOrderQty || 1;
        const partId = part._id || part.id || code;

        const totalPrice = price * minOrderQty;
        const convertedPrice = window.convertToPreferredCurrency 
          ? window.convertToPreferredCurrency(totalPrice, partCurrency)
          : totalPrice;

        const isSelected = state.selectedItems.has(globalIndex);

        return `
          <tr data-part-code="${code}" data-part-id="${partId}" data-part-index="${globalIndex}" data-min-order-qty="${minOrderQty}" data-original-price="${price}" data-original-currency="${partCurrency}">
            <td class="col-select">
              <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''} onchange="handleRowSelection(this, ${globalIndex})">
            </td>
            <td class="col-brand"><span class="brand-name">${part.brand || 'N/A'}</span></td>
            <td class="col-vendor"><span class="vendor-code">${code}</span></td>
            <td class="col-description">${part.description || 'N/A'}</td>
            <td class="col-qty">${quantity}</td>
            <td class="col-stock"><span class="stock-badge">${stockCode}</span></td>
            <td class="col-volume">${volume}</td>
            <td class="col-weight">${weight}</td>
            <td class="col-delivery">${delivery}</td>
            <td class="col-orderqty">
              <div class="qty-controls">
                <button class="qty-btn" onclick="decrementQtyV2(this)">−</button>
                <input type="number" class="qty-input" value="${minOrderQty}" min="${minOrderQty}" max="${Math.max(quantity, 999)}" onchange="updateRowTotalV2(this)">
                <button class="qty-btn" onclick="incrementQtyV2(this)">+</button>
              </div>
            </td>
            <td class="col-total"><span class="total-price">${formatPrice(convertedPrice)} ${preferredCurrency}</span></td>
            <td class="col-action">
              <button class="btn-row-cart" data-part-index="${globalIndex}" onclick="addSingleToCartV2(${globalIndex})">
                <i data-lucide="shopping-cart"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render pagination
    renderPagination(totalResults, totalPages);

    // Update selected total
    updateSelectedTotal();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function showLoading(message = 'Searching...') {
    setScrollLock(false);
    hideNoResults();
    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; padding: 60px;">
            <div class="loading-spinner"></div>
            <p style="margin-top: 16px; color: var(--v2-text-light);">${message}</p>
          </td>
        </tr>
      `;
    }
  }

  function showError(message) {
    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; padding: 60px; color: #e74c3c;">
            ${message}
          </td>
        </tr>
      `;
    }
  }

  function showNoResults() {
    hidePlaceholder();
    if (elements.noResultsState) {
      elements.noResultsState.classList.remove('hidden');
    }
    if (elements.noResultsQuery) {
      elements.noResultsQuery.textContent = state.searchQuery;
    }
    if (elements.footerResultsCount) {
      elements.footerResultsCount.textContent = '0';
    }
    if (elements.resultsTableBody) {
      elements.resultsTableBody.innerHTML = '';
    }
  }

  function hideNoResults() {
    if (elements.noResultsState) {
      elements.noResultsState.classList.add('hidden');
    }
  }


  // ====================================
  // PAGINATION
  // ====================================
  function renderPagination(totalResults, totalPages) {
    if (!elements.paginationContainer) return;

    if (totalPages <= 1) {
      elements.paginationContainer.classList.add('hidden');
      return;
    }

    elements.paginationContainer.classList.remove('hidden');
    const page = state.currentPage;

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

    elements.paginationContainer.innerHTML = `
      <button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="goToPageV2(${page - 1})">
        <i data-lucide="chevron-left"></i>
      </button>
      ${pages.map(p => {
        if (p === '...') return `<span class="pagination-ellipsis">…</span>`;
        return `<button class="pagination-btn ${p === page ? 'active' : ''}" onclick="goToPageV2(${p})">${p}</button>`;
      }).join('')}
      <button class="pagination-btn" ${page >= totalPages ? 'disabled' : ''} onclick="goToPageV2(${page + 1})">
        <i data-lucide="chevron-right"></i>
      </button>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.goToPageV2 = function(page) {
    state.currentPage = page;
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    displayResults(results);
  };

  // ====================================
  // SORTING
  // ====================================
  function handleSort(field) {
    if (state.currentSort.field === field) {
      state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.currentSort.field = field;
      state.currentSort.order = 'asc';
    }

    const results = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    
    results.sort((a, b) => {
      let valA, valB;
      
      switch (field) {
        case 'brand':
          valA = (a.brand || '').toLowerCase();
          valB = (b.brand || '').toLowerCase();
          break;
        case 'vendorCode':
          valA = (a.partNumber || a.vendorCode || '').toLowerCase();
          valB = (b.partNumber || b.vendorCode || '').toLowerCase();
          break;
        case 'description':
          valA = (a.description || '').toLowerCase();
          valB = (b.description || '').toLowerCase();
          break;
        case 'quantity':
          valA = a.quantity || a.stock || 0;
          valB = b.quantity || b.stock || 0;
          break;
        case 'price':
          valA = a.price || a.unitPrice || 0;
          valB = b.price || b.unitPrice || 0;
          break;
        case 'weight':
          valA = typeof a.weight === 'number' ? a.weight : 0;
          valB = typeof b.weight === 'number' ? b.weight : 0;
          break;
        case 'deliveryDays':
          valA = a.deliveryDays || 999;
          valB = b.deliveryDays || 999;
          break;
        default:
          return 0;
      }

      if (valA < valB) return state.currentSort.order === 'asc' ? -1 : 1;
      if (valA > valB) return state.currentSort.order === 'asc' ? 1 : -1;
      return 0;
    });

    state.currentPage = 1;
    displayResults(results);

    // Update header sort indicators
    document.querySelectorAll('.results-table-v2 thead th.sortable').forEach(th => {
      th.classList.remove('sorted', 'asc', 'desc');
      if (th.dataset.sort === field) {
        th.classList.add('sorted', state.currentSort.order);
      }
    });
  }

  // ====================================
  // QUANTITY CONTROLS
  // ====================================
  window.incrementQtyV2 = function(btn) {
    const input = btn.parentElement.querySelector('.qty-input');
    const max = parseInt(input.max) || 999;
    const current = parseInt(input.value) || 1;
    if (current < max) {
      input.value = current + 1;
      updateRowTotalV2(input);
    }
  };

  window.decrementQtyV2 = function(btn) {
    const input = btn.parentElement.querySelector('.qty-input');
    const min = parseInt(input.min) || 1;
    const current = parseInt(input.value) || 1;
    if (current > min) {
      input.value = current - 1;
      updateRowTotalV2(input);
    }
  };

  window.updateRowTotalV2 = function(input) {
    const row = input.closest('tr');
    if (!row) return;

    const price = parseFloat(row.dataset.originalPrice) || 0;
    const currency = row.dataset.originalCurrency || 'USD';
    const qty = parseInt(input.value) || 1;
    const total = price * qty;

    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';
    const convertedTotal = window.convertToPreferredCurrency 
      ? window.convertToPreferredCurrency(total, currency)
      : total;

    const totalCell = row.querySelector('.total-price');
    if (totalCell) {
      totalCell.textContent = `${formatPrice(convertedTotal)} ${preferredCurrency}`;
    }

    // Update state if selected
    const globalIndex = parseInt(row.dataset.partIndex);
    if (state.selectedItems.has(globalIndex)) {
      state.selectedItems.set(globalIndex, { qty });
      updateSelectedTotal();
    }
  };

  // ====================================
  // SELECTION HANDLING
  // ====================================
  window.handleRowSelection = function(checkbox, globalIndex) {
    if (checkbox.checked) {
      const row = checkbox.closest('tr');
      const qtyInput = row?.querySelector('.qty-input');
      const qty = parseInt(qtyInput?.value) || 1;
      state.selectedItems.set(globalIndex, { qty });
    } else {
      state.selectedItems.delete(globalIndex);
    }
    updateSelectedTotal();
  };

  function updateSelectedTotal() {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    let total = 0;
    let count = state.selectedItems.size;
    const preferredCurrency = window.getPreferredCurrency ? window.getPreferredCurrency() : 'USD';

    state.selectedItems.forEach(({ qty }, globalIndex) => {
      const part = results[globalIndex];
      if (!part) return;
      const price = parseFloat(part.price || part.unitPrice) || 0;
      const partCurrency = part.currency || 'USD';

      const visibleRow = document.querySelector(`tr[data-part-index="${globalIndex}"]`);
      const liveQty = visibleRow ? (parseInt(visibleRow.querySelector('.qty-input')?.value) || qty) : qty;

      const itemTotal = price * liveQty;
      const convertedTotal = window.convertToPreferredCurrency
        ? window.convertToPreferredCurrency(itemTotal, partCurrency)
        : itemTotal;
      total += convertedTotal;
    });

    if (elements.selectedTotalValue) {
      elements.selectedTotalValue.textContent = `${formatPrice(total)} ${preferredCurrency}`;
    }

    if (elements.addToCartBtn) {
      elements.addToCartBtn.disabled = count === 0;
    }
  }

  // ====================================
  // ADD TO CART
  // ====================================
  window.addSingleToCartV2 = function(globalIndex) {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    const part = results[globalIndex];
    if (!part) return;

    const row = document.querySelector(`tr[data-part-index="${globalIndex}"]`);
    const qty = row ? parseInt(row.querySelector('.qty-input')?.value) || 1 : 1;

    const cartItem = {
      id: part._id || part.id || part.partNumber,
      partNumber: part.partNumber || part.vendorCode || part.code,
      brand: part.brand,
      description: part.description,
      price: part.price || part.unitPrice,
      currency: part.currency || 'USD',
      quantity: qty,
      stockCode: part.stockCode,
      deliveryDays: part.deliveryDays,
      supplierId: part.supplierId,
    };

    if (typeof window.Cart !== 'undefined' && window.Cart.addItem) {
      window.Cart.addItem(cartItem);
      showCartAlert('success', 'Added to Cart', `${cartItem.partNumber} added to cart`);
    }
  };

  function handleAddToCart() {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.currentResults;
    const items = [];

    state.selectedItems.forEach(({ qty }, globalIndex) => {
      const part = results[globalIndex];
      if (!part) return;

      const visibleRow = document.querySelector(`tr[data-part-index="${globalIndex}"]`);
      const liveQty = visibleRow ? (parseInt(visibleRow.querySelector('.qty-input')?.value) || qty) : qty;

      items.push({
        id: part._id || part.id || part.partNumber,
        partNumber: part.partNumber || part.vendorCode || part.code,
        brand: part.brand,
        description: part.description,
        price: part.price || part.unitPrice,
        currency: part.currency || 'USD',
        quantity: liveQty,
        stockCode: part.stockCode,
        deliveryDays: part.deliveryDays,
        supplierId: part.supplierId,
      });
    });

    if (items.length === 0) {
      showCartAlert('warning', 'No Items Selected', 'Please select items to add to cart');
      return;
    }

    if (typeof window.Cart !== 'undefined' && window.Cart.addItems) {
      window.Cart.addItems(items);
      showCartAlert('success', 'Added to Cart', `${items.length} items added to cart`);
      
      // Clear selections
      state.selectedItems.clear();
      document.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
      updateSelectedTotal();
    }
  }

  // ====================================
  // UTILITIES
  // ====================================
  function formatPrice(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function saveRecentSearch(query) {
    if (!query) return;
    state.recentSearches = state.recentSearches.filter(s => s !== query);
    state.recentSearches.unshift(query);
    state.recentSearches = state.recentSearches.slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
  }

  function showCartAlert(type, title, message) {
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert(type, title, message);
    } else {
      console.log(`[${type}] ${title}: ${message}`);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

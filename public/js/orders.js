// ====================================
// ORDERS PAGE FUNCTIONALITY
// Filtering, Sorting, and Pagination
// Loads orders from Backend API (not localStorage)
// ====================================

(function () {
  'use strict';

  // Currency configuration
  let currentCurrency = 'AED';
  let exchangeRate = 1;

  // Store orders data
  let originalOrders = [];
  let filteredOrders = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentSort = { column: null, direction: 'asc' };
  let isLoading = false;
  let stats = { pending: 0, processing: 0, completed: 0 };

  // Status order for sorting (pending first)
  const statusOrder = {
    pending: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
    completed: 4,
    cancelled: 5
  };

  // Currency helpers
  function initializeCurrency() {
    if (typeof window.getPreferredCurrency === 'function') {
      const preferred = window.getPreferredCurrency();
      if (preferred && preferred !== 'ORIGINAL') {
        currentCurrency = preferred;
        updateExchangeRate();
      }
    } else if (window.__USER_DATA__ && window.__USER_DATA__.preferredCurrency) {
      const preferred = window.__USER_DATA__.preferredCurrency;
      if (preferred && preferred !== 'ORIGINAL') {
        currentCurrency = preferred;
        updateExchangeRate();
      }
    }
    
    window.addEventListener('preferredCurrencyChanged', function(e) {
      if (e.detail && e.detail.currency) {
        currentCurrency = e.detail.currency === 'ORIGINAL' ? 'AED' : e.detail.currency;
        updateExchangeRate();
        renderOrders();
      }
    });
  }
  
  function updateExchangeRate() {
    if (currentCurrency === 'AED') {
      exchangeRate = 1;
      return;
    }
    if (typeof window.convertPrice === 'function') {
      const converted = window.convertPrice(1, 'AED', currentCurrency);
      if (converted && converted > 0) {
        exchangeRate = converted;
      }
    }
  }
  
  function formatAmount(amount) {
    const converted = parseFloat(amount || 0) * exchangeRate;
    return `${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currentCurrency}`;
  }

  // Initialize
  function init() {
    initializeCurrency();
    loadOrders();
    initFilters();
    initSorting();
    initPagination();
  }

  // ====================================
  // LOAD ORDERS FROM BACKEND API
  // ====================================
  async function loadOrders() {
    if (isLoading) return;
    isLoading = true;

    // Show loading state
    showLoading();

    try {
      // Build query params from filters
      const filterStatus = document.getElementById('filter-status')?.value || '';
      const filterDateFrom = document.getElementById('filter-date-from')?.value || '';
      const filterDateTo = document.getElementById('filter-date-to')?.value || '';
      const filterSearch = document.getElementById('filter-search')?.value || '';

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterDateFrom) params.append('dateFrom', filterDateFrom);
      if (filterDateTo) params.append('dateTo', filterDateTo);
      if (filterSearch) params.append('search', filterSearch);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await fetch(`/buyer/api/orders?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();

      if (data.success) {
        originalOrders = data.orders || [];
        filteredOrders = [...originalOrders];
        stats = data.stats || { pending: 0, processing: 0, completed: 0 };
        
        // Update pagination info from server
        if (data.pagination) {
          updatePaginationFromServer(data.pagination);
        }
      } else {
        throw new Error(data.message || 'Failed to load orders');
      }

    } catch (error) {
      console.error('Error loading orders:', error);
      originalOrders = [];
      filteredOrders = [];
      showError('Failed to load orders. Please try again.');
    } finally {
      isLoading = false;
      renderOrders();
      updateStats();
    }
  }

  // ====================================
  // SHOW LOADING STATE
  // ====================================
  function showLoading() {
    const tbody = document.getElementById('orders-tbody');
    const tableContainer = document.getElementById('orders-table-container');
    const emptyState = document.getElementById('orders-empty');

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
              <i data-lucide="loader" class="animate-spin" style="width: 2rem; height: 2rem; color: var(--color-accent);"></i>
              <span style="color: var(--color-text-secondary);">Loading orders...</span>
            </div>
          </td>
        </tr>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  // ====================================
  // SHOW ERROR MESSAGE
  // ====================================
  function showError(message) {
    const tbody = document.getElementById('orders-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: #ef4444;">
              <i data-lucide="alert-circle" style="width: 2rem; height: 2rem;"></i>
              <span>${message}</span>
              <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: var(--color-accent); color: white; border: none; border-radius: 6px; cursor: pointer;">
                Retry
              </button>
            </div>
          </td>
        </tr>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  // ====================================
  // RENDER ORDERS
  // ====================================
  function renderOrders() {
    const tbody = document.getElementById('orders-tbody');
    const tableContainer = document.getElementById('orders-table-container');
    const emptyState = document.getElementById('orders-empty');
    const pagination = document.getElementById('orders-pagination');

    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    if (filteredOrders.length === 0) {
      // Show empty state
      if (tableContainer) tableContainer.style.display = 'none';
      if (pagination) pagination.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    // Show table, hide empty state
    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (pagination) pagination.style.display = 'flex';

    // Render orders (already paginated from server)
    filteredOrders.forEach(order => {
      const row = createOrderRow(order);
      tbody.appendChild(row);
    });

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    updatePagination();
  }

  // ====================================
  // CREATE ORDER ROW
  // ====================================
  function createOrderRow(order) {
    const row = document.createElement('tr');
    row.dataset.orderId = order.orderNumber;
    row.dataset.status = order.status;
    row.dataset.date = order.date || order.createdAt;
    row.dataset.amount = order.amount || order.total || 0;

    const orderDate = new Date(order.date || order.createdAt);
    const dateStr = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = orderDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const statusIcon = getStatusIcon(order.status);
    const amount = order.amount || order.total || 0;
    // Each item is individual - count is simply the items array length
    const itemsCount = order.totalItems || (order.items ? order.items.length : 0);
    const itemsPreview = order.itemsPreview || (order.items ? order.items.slice(0, 3).map(item => item.partNumber || item.code || 'Part') : []);

    // Link to order details
    const orderLink = `/buyer/orders/${encodeURIComponent(order.orderNumber)}`;

    row.innerHTML = `
      <td data-label="Order Number">
        <a href="${orderLink}" class="order-number-link" data-order="${order.orderNumber}">
          <span class="order-number">${order.orderNumber}</span>
        </a>
      </td>
      <td data-label="Date">
        <span class="order-date">
          ${dateStr}
          <span class="order-date-time">${timeStr}</span>
        </span>
      </td>
      <td data-label="Status">
        <span class="status-badge ${order.status}">
          <i data-lucide="${statusIcon}"></i>
          <span>${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
        </span>
      </td>
      <td data-label="Items">
        <div class="order-items">
          <span class="order-items-count">${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}</span>
          ${itemsPreview.length > 0 ? `<span class="order-items-preview">${itemsPreview.join(', ')}</span>` : ''}
        </div>
      </td>
      <td data-label="Amount">
        <span class="order-amount">${formatAmount(amount)}</span>
      </td>
      <td data-label="Actions">
        <div class="order-actions">
          <a href="${orderLink}" class="btn-action view" data-order="${order.orderNumber}">
            <i data-lucide="eye"></i>
            <span>View</span>
          </a>
          ${order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'delivered' ? `
            ${order.status === 'shipped' || order.status === 'processing' ? `
              <button class="btn-action track" data-order="${order.orderNumber}" onclick="trackOrder('${order.orderNumber}')">
                <i data-lucide="map-pin"></i>
                <span>Track</span>
              </button>
            ` : ''}
            ${order.status === 'pending' ? `
              <button class="btn-action cancel" data-order="${order.orderNumber}" onclick="cancelOrder('${order.orderNumber}')">
                <i data-lucide="x"></i>
                <span>Cancel</span>
              </button>
            ` : ''}
          ` : ''}
        </div>
      </td>
    `;

    return row;
  }

  function getStatusIcon(status) {
    const icons = {
      pending: 'clock',
      processing: 'loader',
      shipped: 'truck',
      delivered: 'check-circle',
      completed: 'check-circle',
      cancelled: 'x-circle'
    };
    return icons[status] || 'package';
  }

  // ====================================
  // FILTERING
  // ====================================
  function initFilters() {
    const btnApply = document.getElementById('btn-apply-filters');
    const btnReset = document.getElementById('btn-reset-filters');
    const filterSearch = document.getElementById('filter-search');

    if (btnApply) {
      btnApply.addEventListener('click', applyFilters);
    }

    if (btnReset) {
      btnReset.addEventListener('click', resetFilters);
    }

    if (filterSearch) {
      filterSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    }
  }

  function applyFilters() {
    currentPage = 1;
    loadOrders(); // Reload from server with filters
  }

  function resetFilters() {
    const filterStatus = document.getElementById('filter-status');
    const filterDateFrom = document.getElementById('filter-date-from');
    const filterDateTo = document.getElementById('filter-date-to');
    const filterSearch = document.getElementById('filter-search');

    if (filterStatus) filterStatus.value = '';
    if (filterDateFrom) filterDateFrom.value = '';
    if (filterDateTo) filterDateTo.value = '';
    if (filterSearch) filterSearch.value = '';

    currentPage = 1;
    loadOrders(); // Reload from server without filters
  }

  // ====================================
  // SORTING
  // ====================================
  function initSorting() {
    const sortableHeaders = document.querySelectorAll('.orders-table th.sortable');
    
    sortableHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.sort;
        let direction = 'asc';
        
        if (currentSort.column === column) {
          direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        }
        
        sortOrders(column, direction, true);
      });
    });
  }

  function sortOrders(column, direction, updateUI = true) {
    currentSort = { column, direction };

    if (updateUI) {
      document.querySelectorAll('.orders-table th.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === column) {
          header.classList.add(`sort-${direction}`);
        }
      });
    }

    // Sort locally (already paginated data from server)
    filteredOrders.sort((a, b) => {
      let aVal, bVal;

      switch (column) {
        case 'orderNumber':
          aVal = a.orderNumber;
          bVal = b.orderNumber;
          break;
        case 'date':
          aVal = new Date(a.date || a.createdAt);
          bVal = new Date(b.date || b.createdAt);
          break;
        case 'amount':
          aVal = a.amount || a.total || 0;
          bVal = b.amount || b.total || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    renderOrders();
  }

  // ====================================
  // PAGINATION
  // ====================================
  let totalItems = 0;
  let totalPages = 0;

  function initPagination() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadOrders();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadOrders();
        }
      });
    }
  }

  function updatePaginationFromServer(pagination) {
    totalItems = pagination.total || 0;
    totalPages = pagination.totalPages || 0;
    currentPage = pagination.page || 1;
  }

  function updatePagination() {
    const startIndex = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    const paginationFrom = document.getElementById('pagination-from');
    const paginationTo = document.getElementById('pagination-to');
    const paginationTotal = document.getElementById('pagination-total');

    if (paginationFrom) paginationFrom.textContent = startIndex;
    if (paginationTo) paginationTo.textContent = endIndex;
    if (paginationTotal) paginationTotal.textContent = totalItems;

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (btnPrev) {
      btnPrev.disabled = currentPage === 1;
    }

    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages || totalPages === 0;
    }
  }

  // ====================================
  // STATS UPDATE
  // ====================================
  function updateStats() {
    const statPending = document.getElementById('stat-pending');
    const statProcessing = document.getElementById('stat-processing');
    const statCompleted = document.getElementById('stat-completed');

    if (statPending) statPending.textContent = stats.pending || 0;
    if (statProcessing) statProcessing.textContent = stats.processing || 0;
    if (statCompleted) statCompleted.textContent = stats.completed || 0;
  }

  // ====================================
  // CANCEL ORDER - BACKEND API
  // ====================================
  window.cancelOrder = async function(orderNumber) {
    if (!confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`/buyer/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelled by customer' })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to cancel order');
      }

      alert(`Order ${orderNumber} has been cancelled.`);
      loadOrders(); // Reload orders from server

    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(error.message || 'Error cancelling order. Please try again.');
    }
  };

  // ====================================
  // TRACK ORDER
  // ====================================
  window.trackOrder = function(orderNumber) {
    // Navigate to order details for tracking
    window.location.href = `/buyer/orders/${encodeURIComponent(orderNumber)}`;
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

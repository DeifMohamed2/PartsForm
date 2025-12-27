// ====================================
// ORDERS PAGE FUNCTIONALITY
// Filtering, Sorting, and Pagination
// Loads orders from localStorage
// ====================================

(function () {
  'use strict';

  const ORDERS_STORAGE_KEY = 'partsform_orders';

  // Store orders data
  let originalOrders = [];
  let filteredOrders = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentSort = { column: null, direction: 'asc' };

  // Status order for sorting (pending first)
  const statusOrder = {
    pending: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
    completed: 4,
    cancelled: 5
  };

  // Initialize
  function init() {
    loadOrders();
    initFilters();
    initSorting();
    initPagination();
  }

  // ====================================
  // LOAD ORDERS FROM LOCALSTORAGE
  // ====================================
  function loadOrders() {
    try {
      const ordersData = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (ordersData) {
        originalOrders = JSON.parse(ordersData);
        
        // Sort orders: pending first, then by date (newest first)
        originalOrders.sort((a, b) => {
          const aStatus = statusOrder[a.status] ?? 999;
          const bStatus = statusOrder[b.status] ?? 999;
          if (aStatus !== bStatus) {
            return aStatus - bStatus;
          }
          return new Date(b.date) - new Date(a.date);
        });
        
        filteredOrders = [...originalOrders];
      } else {
        originalOrders = [];
        filteredOrders = [];
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      originalOrders = [];
      filteredOrders = [];
    }

    renderOrders();
    updateStats();
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

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const ordersToShow = filteredOrders.slice(startIndex, endIndex);

    // Render orders
    ordersToShow.forEach(order => {
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
    row.dataset.date = order.date;
    row.dataset.amount = order.amount || order.total || 0;

    const orderDate = new Date(order.date);
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
    const itemsCount = order.itemsCount || (order.items ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0) : 0);
    const itemsPreview = order.itemsPreview || (order.items ? order.items.slice(0, 3).map(item => item.description || item.partNumber || item.code || 'Part') : []);

    // Check if this is an AOG/Aviation order
    const isAOGOrder = order.type === 'AOG' || order.type === 'Aviation' || 
                       order.orderNumber.startsWith('AOG-') ||
                       (order.category && (order.category.toLowerCase() === 'aog' || order.category.toLowerCase() === 'aviation'));
    
    // Determine the correct link based on order type
    const orderLink = isAOGOrder 
      ? `/buyer/aog/command-center/${encodeURIComponent(order.orderNumber)}`
      : `/buyer/orders/${encodeURIComponent(order.orderNumber)}`;

    row.innerHTML = `
      <td data-label="Order Number">
        <a href="${orderLink}" class="order-number-link" data-order="${order.orderNumber}">
          <span class="order-number">${order.orderNumber}</span>
          ${isAOGOrder ? '<span class="aog-badge">AOG</span>' : ''}
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
        <span class="order-amount">
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span class="order-amount-currency">د.إ</span>
        </span>
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
            ${!isAOGOrder ? `
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
    const filterStatus = document.getElementById('filter-status')?.value;
    const filterDateFrom = document.getElementById('filter-date-from')?.value;
    const filterDateTo = document.getElementById('filter-date-to')?.value;
    const filterSearch = document.getElementById('filter-search')?.value.toLowerCase().trim();

    filteredOrders = originalOrders.filter(order => {
      // Status filter
      if (filterStatus && order.status !== filterStatus) {
        return false;
      }

      // Date range filter
      if (filterDateFrom || filterDateTo) {
        const orderDate = new Date(order.date);
        if (filterDateFrom && orderDate < new Date(filterDateFrom + 'T00:00:00')) {
          return false;
        }
        if (filterDateTo && orderDate > new Date(filterDateTo + 'T23:59:59')) {
          return false;
        }
      }

      // Search filter
      if (filterSearch) {
        const orderNumber = order.orderNumber.toLowerCase();
        const searchText = `${orderNumber} ${order.itemsPreview ? order.itemsPreview.join(' ') : ''} ${order.items ? order.items.map(i => (i.description || i.partNumber || i.code || '')).join(' ') : ''}`.toLowerCase();
        if (!searchText.includes(filterSearch)) {
          return false;
        }
      }

      return true;
    });

    currentPage = 1;
    
    // Apply sorting
    if (currentSort.column) {
      sortOrders(currentSort.column, currentSort.direction, false);
    } else {
      renderOrders();
    }

    updateStats();
  }

  function resetFilters() {
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-search').value = '';

    filteredOrders = [...originalOrders];
    currentPage = 1;
    
    if (currentSort.column) {
      sortOrders(currentSort.column, currentSort.direction, false);
    } else {
      renderOrders();
    }

    updateStats();
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

    filteredOrders.sort((a, b) => {
      let aVal, bVal;

      switch (column) {
        case 'orderNumber':
          aVal = a.orderNumber;
          bVal = b.orderNumber;
          break;
        case 'date':
          aVal = new Date(a.date);
          bVal = new Date(b.date);
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
  function initPagination() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderOrders();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderOrders();
        }
      });
    }
  }

  function updatePagination() {
    const totalItems = filteredOrders.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    const paginationFrom = document.getElementById('pagination-from');
    const paginationTo = document.getElementById('pagination-to');
    const paginationTotal = document.getElementById('pagination-total');

    if (paginationFrom) paginationFrom.textContent = totalItems > 0 ? startIndex : 0;
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
    const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
    const processingCount = filteredOrders.filter(o => o.status === 'processing').length;
    const completedCount = filteredOrders.filter(o => 
      o.status === 'completed' || o.status === 'delivered'
    ).length;

    const statPending = document.getElementById('stat-pending');
    const statProcessing = document.getElementById('stat-processing');
    const statCompleted = document.getElementById('stat-completed');

    if (statPending) statPending.textContent = pendingCount;
    if (statProcessing) statProcessing.textContent = processingCount;
    if (statCompleted) statCompleted.textContent = completedCount;
  }

  // ====================================
  // CANCEL ORDER
  // ====================================
  window.cancelOrder = function(orderNumber) {
    if (confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      try {
        const orders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
        const orderIndex = orders.findIndex(o => o.orderNumber === orderNumber);
        
        if (orderIndex !== -1 && orders[orderIndex].status === 'pending') {
          orders[orderIndex].status = 'cancelled';
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
          loadOrders();
          alert(`Order ${orderNumber} has been cancelled.`);
        } else {
          alert('Only pending orders can be cancelled.');
        }
      } catch (error) {
        console.error('Error cancelling order:', error);
        alert('Error cancelling order. Please try again.');
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

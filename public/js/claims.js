// Claims Page JavaScript - Buyer Side
// Handles claim list display, filtering, and statistics

let allClaims = [];
let currentClaims = [];
let filters = {
  status: '',
  search: ''
};
let pagination = {
  page: 1,
  limit: 20,
  total: 0
};
let stats = {
  open: 0,
  'in-progress': 0,
  resolved: 0
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializeClaims();
  setupEventListeners();
});

async function initializeClaims() {
  await loadClaims();
}

async function loadClaims() {
  try {
    // Show loading state
    const claimsTbody = document.getElementById('claims-tbody');
    const tableContainer = document.getElementById('claims-table-container');
    const claimsEmpty = document.getElementById('claims-empty');
    if (claimsTbody && tableContainer) {
      tableContainer.classList.remove('hidden');
      if (claimsEmpty) claimsEmpty.style.display = 'none';
      claimsTbody.innerHTML = '<tr><td colspan="8" class="loading-cell"><div class="loading-state"><i data-lucide="loader-2" class="spin"></i><span>Loading claims...</span></div></td></tr>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Build query params
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    params.append('page', pagination.page);
    params.append('limit', pagination.limit);

    const response = await fetch('/buyer/api/claims?' + params.toString());

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();

    if (data.success) {
      allClaims = data.claims || [];
      currentClaims = allClaims;
      if (data.pagination) {
        pagination = { ...pagination, ...data.pagination };
      }
      if (data.stats) {
        stats = {
          open: Number(data.stats.open) || 0,
          'in-progress': Number(data.stats['in-progress']) || 0,
          resolved: Number(data.stats.resolved) || 0
        };
      }
    } else {
      allClaims = [];
      currentClaims = [];
    }
  } catch (error) {
    console.error('Error loading claims:', error);
    allClaims = [];
    currentClaims = [];
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Loading Error', 'Failed to load claim support. Please refresh the page.');
    }
  } finally {
    updateStatistics();
    renderClaims();
  }
}

function setupEventListeners() {
  // Filter buttons
  const applyBtn = document.getElementById('btn-apply-filters');
  const resetBtn = document.getElementById('btn-reset-filters');
  const searchInput = document.getElementById('filter-search');
  
  if (applyBtn) {
    applyBtn.addEventListener('click', applyFilters);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // Enter key on search
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }
}

function updateStatistics() {
  const statOpen = document.getElementById('stat-open');
  const statInProgress = document.getElementById('stat-in-progress');
  const statResolved = document.getElementById('stat-resolved');

  if (statOpen) statOpen.textContent = stats.open || 0;
  if (statInProgress) statInProgress.textContent = stats['in-progress'] || 0;
  if (statResolved) statResolved.textContent = stats.resolved || 0;
}

function applyFilters() {
  const statusSelect = document.getElementById('filter-status');
  const searchInput = document.getElementById('filter-search');
  
  filters.status = statusSelect ? (statusSelect.value || '').trim() : '';
  filters.search = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
  pagination.page = 1;

  loadClaims();
}

function resetFilters() {
  const statusSelect = document.getElementById('filter-status');
  const searchInput = document.getElementById('filter-search');
  
  if (statusSelect) statusSelect.value = '';
  if (searchInput) searchInput.value = '';
  
  filters = {
    status: '',
    search: ''
  };
  pagination.page = 1;

  loadClaims();
}

function renderClaims() {
  const claimsTbody = document.getElementById('claims-tbody');
  const claimsEmpty = document.getElementById('claims-empty');
  const tableContainer = document.getElementById('claims-table-container');

  if (!claimsTbody || !tableContainer) return;

  if (currentClaims.length === 0) {
    tableContainer.classList.add('hidden');
    if (claimsEmpty) claimsEmpty.style.display = 'block';
    return;
  }

  tableContainer.classList.remove('hidden');
  if (claimsEmpty) claimsEmpty.style.display = 'none';

  claimsTbody.innerHTML = currentClaims.map(function(claim) {
    return createClaimRow(claim);
  }).join('');

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Add click handlers (row click + prevent on action link)
  claimsTbody.querySelectorAll('tr.claim-row').forEach(function(row) {
    row.addEventListener('click', function(e) {
      if (e.target.closest('a, button')) return;
      const claimId = row.dataset.claimId;
      if (claimId) window.location.href = '/buyer/claim-support/' + claimId;
    });
  });
}

function createClaimRow(claim) {
  const updatedDate = formatRelativeTime(claim.updatedAt);
  const categoryIcon = getCategoryIcon(claim.category);
  const hasUnread = claim.unreadCount > 0;

  return '<tr class="claim-row' + (hasUnread ? ' has-unread' : '') + '" data-claim-id="' + claim.id + '" data-status="' + claim.status + '">' +
    '<td class="claim-id-cell">' + escapeHtml(claim.id) + '</td>' +
    '<td class="claim-subject-cell">' + escapeHtml(claim.subject) + '</td>' +
    '<td class="claim-order-cell"><span>' + escapeHtml(claim.orderNumber || '—') + '</span></td>' +
    '<td class="claim-category-cell"><i data-lucide="' + categoryIcon + '"></i><span>' + escapeHtml(claim.category) + '</span></td>' +
    '<td><span class="claim-status-badge ' + claim.status + '">' + formatStatus(claim.status) + (hasUnread ? ' (' + claim.unreadCount + ')' : '') + '</span></td>' +
    '<td>' + claim.messageCount + '</td>' +
    '<td>' + updatedDate + '</td>' +
    '<td><a href="/buyer/claim-support/' + claim.id + '" class="btn-view-claim"><i data-lucide="arrow-right"></i><span>View</span></a></td>' +
  '</tr>';
}

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.split('-').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function getCategoryIcon(category) {
  const icons = {
    'Shipping Issue': 'truck',
    'Order Issue': 'alert-triangle',
    'Product Inquiry': 'help-circle',
    'Payment': 'credit-card',
    'Documentation': 'file-text',
    'Technical Issue': 'tool',
    'Return Request': 'rotate-ccw',
    'General': 'message-square'
  };
  return icons[category] || 'message-square';
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min' + (diffMins > 1 ? 's' : '') + ' ago';
  if (diffHours < 24) return diffHours + ' hour' + (diffHours > 1 ? 's' : '') + ' ago';
  if (diffDays < 7) return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
  
  return formatDate(dateString);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
    const claimsList = document.getElementById('claims-list');
    if (claimsList) {
      claimsList.innerHTML = '<div class="loading-state"><i data-lucide="loader-2" class="spin"></i><span>Loading claims...</span></div>';
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
  const claimsList = document.getElementById('claims-list');
  const claimsEmpty = document.getElementById('claims-empty');

  if (!claimsList) return;

  if (currentClaims.length === 0) {
    claimsList.style.display = 'none';
    if (claimsEmpty) claimsEmpty.style.display = 'block';
    return;
  }

  claimsList.style.display = 'grid';
  if (claimsEmpty) claimsEmpty.style.display = 'none';

  claimsList.innerHTML = currentClaims.map(function(claim) {
    return createClaimCard(claim);
  }).join('');

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Add click handlers
  const cards = document.querySelectorAll('.claim-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      const claimId = card.dataset.claimId;
      window.location.href = '/buyer/claim-support/' + claimId;
    });
  });
}

function createClaimCard(claim) {
  const createdDate = formatDate(claim.createdAt);
  const updatedDate = formatRelativeTime(claim.updatedAt);
  const categoryIcon = getCategoryIcon(claim.category);
  const hasUnread = claim.unreadCount > 0;

  return '<div class="claim-card' + (hasUnread ? ' has-unread' : '') + '" data-claim-id="' + claim.id + '">' +
    '<div class="claim-card-header">' +
      '<div class="claim-card-left">' +
        '<div class="claim-id">' + escapeHtml(claim.id) + '</div>' +
        '<h3 class="claim-subject">' + escapeHtml(claim.subject) + '</h3>' +
        '<div class="claim-order">' +
          '<i data-lucide="package"></i>' +
          '<span>' + escapeHtml(claim.orderNumber || 'No Order') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="claim-card-right">' +
        '<span class="claim-status-badge ' + claim.status + '">' + formatStatus(claim.status) + '</span>' +
        (hasUnread ? '<span class="unread-badge">' + claim.unreadCount + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="claim-card-body">' +
      '<div class="claim-category">' +
        '<i data-lucide="' + categoryIcon + '"></i>' +
        '<span>' + escapeHtml(claim.category) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="claim-card-footer">' +
      '<div class="claim-meta">' +
        '<div class="claim-meta-item">' +
          '<i data-lucide="calendar"></i>' +
          '<span>' + createdDate + '</span>' +
        '</div>' +
        '<div class="claim-meta-item">' +
          '<i data-lucide="clock"></i>' +
          '<span>Updated ' + updatedDate + '</span>' +
        '</div>' +
        '<div class="claim-meta-item">' +
          '<i data-lucide="message-circle"></i>' +
          '<span>' + claim.messageCount + ' ' + (claim.messageCount === 1 ? 'message' : 'messages') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="claim-action">' +
        '<span>View Details</span>' +
        '<i data-lucide="arrow-right"></i>' +
      '</div>' +
    '</div>' +
  '</div>';
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

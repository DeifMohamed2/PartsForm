// Tickets Page JavaScript - Buyer Side
// Handles ticket list display, filtering, and statistics

let allTickets = [];
let currentTickets = [];
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
  initializeTickets();
  setupEventListeners();
});

async function initializeTickets() {
  await loadTickets();
}

async function loadTickets() {
  try {
    // Show loading state
    const ticketsList = document.getElementById('tickets-list');
    if (ticketsList) {
      ticketsList.innerHTML = '<div class="loading-state"><i data-lucide="loader-2" class="spin"></i><span>Loading tickets...</span></div>';
    }
    
    // Build query params
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    params.append('page', pagination.page);
    params.append('limit', pagination.limit);
    
    const response = await fetch('/buyer/api/tickets?' + params.toString());
    const data = await response.json();
    
    if (data.success) {
      allTickets = data.tickets || [];
      currentTickets = allTickets;
      pagination = data.pagination || pagination;
      stats = data.stats || stats;
      
      updateStatistics();
      renderTickets();
    } else {
      allTickets = [];
      currentTickets = [];
      renderTickets();
    }
  } catch (error) {
    console.error('Error loading tickets:', error);
    allTickets = [];
    currentTickets = [];
    renderTickets();
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
  
  filters.status = statusSelect ? statusSelect.value : '';
  filters.search = searchInput ? searchInput.value.toLowerCase() : '';
  pagination.page = 1; // Reset to first page

  loadTickets();
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

  loadTickets();
}

function renderTickets() {
  const ticketsList = document.getElementById('tickets-list');
  const ticketsEmpty = document.getElementById('tickets-empty');

  if (!ticketsList) return;

  if (currentTickets.length === 0) {
    ticketsList.style.display = 'none';
    if (ticketsEmpty) ticketsEmpty.style.display = 'block';
    return;
  }

  ticketsList.style.display = 'grid';
  if (ticketsEmpty) ticketsEmpty.style.display = 'none';

  ticketsList.innerHTML = currentTickets.map(function(ticket) {
    return createTicketCard(ticket);
  }).join('');

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Add click handlers
  const cards = document.querySelectorAll('.ticket-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      const ticketId = card.dataset.ticketId;
      window.location.href = '/buyer/tickets/' + ticketId;
    });
  });
}

function createTicketCard(ticket) {
  const createdDate = formatDate(ticket.createdAt);
  const updatedDate = formatRelativeTime(ticket.updatedAt);
  const categoryIcon = getCategoryIcon(ticket.category);
  const hasUnread = ticket.unreadCount > 0;

  return '<div class="ticket-card' + (hasUnread ? ' has-unread' : '') + '" data-ticket-id="' + ticket.id + '">' +
    '<div class="ticket-card-header">' +
      '<div class="ticket-card-left">' +
        '<div class="ticket-id">' + escapeHtml(ticket.id) + '</div>' +
        '<h3 class="ticket-subject">' + escapeHtml(ticket.subject) + '</h3>' +
        '<div class="ticket-order">' +
          '<i data-lucide="package"></i>' +
          '<span>' + escapeHtml(ticket.orderNumber || 'No Order') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ticket-card-right">' +
        '<span class="ticket-status-badge ' + ticket.status + '">' + formatStatus(ticket.status) + '</span>' +
        (hasUnread ? '<span class="unread-badge">' + ticket.unreadCount + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="ticket-card-body">' +
      '<div class="ticket-category">' +
        '<i data-lucide="' + categoryIcon + '"></i>' +
        '<span>' + escapeHtml(ticket.category) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="ticket-card-footer">' +
      '<div class="ticket-meta">' +
        '<div class="ticket-meta-item">' +
          '<i data-lucide="calendar"></i>' +
          '<span>' + createdDate + '</span>' +
        '</div>' +
        '<div class="ticket-meta-item">' +
          '<i data-lucide="clock"></i>' +
          '<span>Updated ' + updatedDate + '</span>' +
        '</div>' +
        '<div class="ticket-meta-item">' +
          '<i data-lucide="message-circle"></i>' +
          '<span>' + ticket.messageCount + ' ' + (ticket.messageCount === 1 ? 'message' : 'messages') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ticket-action">' +
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

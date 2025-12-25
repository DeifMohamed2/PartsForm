// Tickets Page JavaScript
// Handles ticket list display, filtering, and statistics

// Mock tickets data (in production, this would come from an API)
const mockTickets = [
  {
    id: 'TKT-001',
    orderNumber: 'ORD-2025-001',
    subject: 'Delayed Shipment - Hydraulic Pump',
    category: 'Shipping Issue',
    priority: 'high',
    status: 'open',
    createdAt: '2025-12-20T10:30:00Z',
    updatedAt: '2025-12-23T14:20:00Z',
    messageCount: 4
  },
  {
    id: 'TKT-002',
    orderNumber: 'ORD-2025-015',
    subject: 'Wrong Part Received',
    category: 'Order Issue',
    priority: 'urgent',
    status: 'in-progress',
    createdAt: '2025-12-22T09:15:00Z',
    updatedAt: '2025-12-23T16:45:00Z',
    messageCount: 3
  },
  {
    id: 'TKT-003',
    orderNumber: 'ORD-2025-008',
    subject: 'Request for Technical Specifications',
    category: 'Product Inquiry',
    priority: 'medium',
    status: 'resolved',
    createdAt: '2025-12-18T13:20:00Z',
    updatedAt: '2025-12-19T11:30:00Z',
    messageCount: 3
  },
  {
    id: 'TKT-004',
    orderNumber: 'ORD-2025-022',
    subject: 'Payment Processing Issue',
    category: 'Payment',
    priority: 'high',
    status: 'open',
    createdAt: '2025-12-23T08:00:00Z',
    updatedAt: '2025-12-23T08:00:00Z',
    messageCount: 1
  },
  {
    id: 'TKT-005',
    orderNumber: 'ORD-2025-019',
    subject: 'Request for Invoice Copy',
    category: 'Documentation',
    priority: 'low',
    status: 'resolved',
    createdAt: '2025-12-21T15:45:00Z',
    updatedAt: '2025-12-21T16:30:00Z',
    messageCount: 2
  }
];

let currentTickets = [...mockTickets];
let filters = {
  status: '',
  search: ''
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeTickets();
  setupEventListeners();
});

function initializeTickets() {
  updateStatistics();
  renderTickets();
}

function setupEventListeners() {
  // Filter buttons
  document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);

  // Enter key on search
  document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });
}

function updateStatistics() {
  const stats = {
    open: mockTickets.filter(t => t.status === 'open').length,
    'in-progress': mockTickets.filter(t => t.status === 'in-progress').length,
    resolved: mockTickets.filter(t => t.status === 'resolved').length
  };

  document.getElementById('stat-open').textContent = stats.open;
  document.getElementById('stat-in-progress').textContent = stats['in-progress'];
  document.getElementById('stat-resolved').textContent = stats.resolved;
}

function applyFilters() {
  filters.status = document.getElementById('filter-status')?.value || '';
  filters.search = document.getElementById('filter-search')?.value.toLowerCase() || '';

  currentTickets = mockTickets.filter(ticket => {
    const matchesStatus = !filters.status || ticket.status === filters.status;
    const matchesSearch = !filters.search || 
      ticket.subject.toLowerCase().includes(filters.search) ||
      ticket.id.toLowerCase().includes(filters.search) ||
      ticket.orderNumber.toLowerCase().includes(filters.search) ||
      ticket.category.toLowerCase().includes(filters.search);

    return matchesStatus && matchesSearch;
  });

  renderTickets();
}

function resetFilters() {
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-search').value = '';
  
  filters = {
    status: '',
    search: ''
  };

  currentTickets = [...mockTickets];
  renderTickets();
}

function renderTickets() {
  const ticketsList = document.getElementById('tickets-list');
  const ticketsEmpty = document.getElementById('tickets-empty');

  if (currentTickets.length === 0) {
    ticketsList.style.display = 'none';
    ticketsEmpty.style.display = 'block';
    return;
  }

  ticketsList.style.display = 'grid';
  ticketsEmpty.style.display = 'none';

  ticketsList.innerHTML = currentTickets.map(ticket => createTicketCard(ticket)).join('');

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Add click handlers
  document.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => {
      const ticketId = card.dataset.ticketId;
      window.location.href = `/buyer/tickets/${ticketId}`;
    });
  });
}

function createTicketCard(ticket) {
  const createdDate = formatDate(ticket.createdAt);
  const updatedDate = formatRelativeTime(ticket.updatedAt);
  const categoryIcon = getCategoryIcon(ticket.category);

  return `
    <div class="ticket-card" data-ticket-id="${ticket.id}">
      <div class="ticket-card-header">
        <div class="ticket-card-left">
          <div class="ticket-id">${ticket.id}</div>
          <h3 class="ticket-subject">${ticket.subject}</h3>
          <div class="ticket-order">
            <i data-lucide="package"></i>
            <span>${ticket.orderNumber}</span>
          </div>
        </div>
        <div class="ticket-card-right">
          <span class="ticket-status-badge ${ticket.status}">${formatStatus(ticket.status)}</span>
        </div>
      </div>
      <div class="ticket-card-body">
        <div class="ticket-category">
          <i data-lucide="${categoryIcon}"></i>
          <span>${ticket.category}</span>
        </div>
      </div>
      <div class="ticket-card-footer">
        <div class="ticket-meta">
          <div class="ticket-meta-item">
            <i data-lucide="calendar"></i>
            <span>${createdDate}</span>
          </div>
          <div class="ticket-meta-item">
            <i data-lucide="clock"></i>
            <span>Updated ${updatedDate}</span>
          </div>
          <div class="ticket-meta-item">
            <i data-lucide="message-circle"></i>
            <span>${ticket.messageCount} ${ticket.messageCount === 1 ? 'message' : 'messages'}</span>
          </div>
        </div>
        <div class="ticket-action">
          <span>View Details</span>
          <i data-lucide="arrow-right"></i>
        </div>
      </div>
    </div>
  `;
}

function formatStatus(status) {
  return status.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getCategoryIcon(category) {
  const icons = {
    'Shipping Issue': 'truck',
    'Order Issue': 'alert-triangle',
    'Product Inquiry': 'help-circle',
    'Payment': 'credit-card',
    'Documentation': 'file-text',
    'Technical Issue': 'tool',
    'General': 'message-square'
  };
  return icons[category] || 'message-square';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(dateString);
}

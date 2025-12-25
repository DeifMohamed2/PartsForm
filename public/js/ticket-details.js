// Ticket Details Page JavaScript
// Handles chat interface and ticket information display

// Get ticket ID from URL
const urlPath = window.location.pathname;
const ticketId = urlPath.split('/').pop();

// Mock ticket data (in production, this would come from an API)
const mockTicketData = {
  'TKT-001': {
    id: 'TKT-001',
    orderNumber: 'ORD-2025-001',
    subject: 'Delayed Shipment - Hydraulic Pump',
    category: 'Shipping Issue',
    priority: 'high',
    status: 'open',
    createdAt: '2025-12-20T10:30:00Z',
    updatedAt: '2025-12-23T14:20:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'John Smith',
        message: 'My order ORD-2025-001 was supposed to arrive yesterday but I haven\'t received any tracking updates. Can you please check the status?',
        timestamp: '2025-12-20T10:30:00Z',
        attachments: []
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'Thank you for contacting us. I\'m looking into your order now. Let me check with our shipping department.',
        timestamp: '2025-12-20T11:15:00Z',
        attachments: []
      },
      {
        id: 3,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'I\'ve confirmed that your order is currently in transit. There was a slight delay at customs, but it should arrive within 2 business days. Here\'s your tracking number: TRK123456789',
        timestamp: '2025-12-20T14:30:00Z',
        attachments: []
      },
      {
        id: 4,
        sender: 'buyer',
        senderName: 'John Smith',
        message: 'Thank you for the update! I appreciate your help.',
        timestamp: '2025-12-23T14:20:00Z',
        attachments: []
      }
    ]
  },
  'TKT-002': {
    id: 'TKT-002',
    orderNumber: 'ORD-2025-015',
    subject: 'Wrong Part Received',
    category: 'Order Issue',
    priority: 'urgent',
    status: 'in-progress',
    createdAt: '2025-12-22T09:15:00Z',
    updatedAt: '2025-12-23T16:45:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Michael Chen',
        message: 'I received my order today, but the part number doesn\'t match what I ordered. I ordered part #8471474 but received #8471475.',
        timestamp: '2025-12-22T09:15:00Z',
        attachments: ['photo1.jpg', 'photo2.jpg']
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'David Martinez',
        message: 'I sincerely apologize for this error. We\'ll arrange for a replacement to be shipped immediately and provide a return label for the incorrect part.',
        timestamp: '2025-12-22T10:30:00Z',
        attachments: []
      },
      {
        id: 3,
        sender: 'support',
        senderName: 'David Martinez',
        message: 'Your replacement has been shipped with expedited delivery. Tracking number: EXP987654321. You should receive it tomorrow.',
        timestamp: '2025-12-23T16:45:00Z',
        attachments: ['return_label.pdf']
      }
    ]
  },
  'TKT-003': {
    id: 'TKT-003',
    orderNumber: 'ORD-2025-008',
    subject: 'Request for Technical Specifications',
    category: 'Product Inquiry',
    priority: 'medium',
    status: 'resolved',
    createdAt: '2025-12-18T13:20:00Z',
    updatedAt: '2025-12-19T11:30:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Emma Wilson',
        message: 'Could you please provide the detailed technical specifications for the turbine blade set I ordered? I need the exact material composition and tolerances.',
        timestamp: '2025-12-18T13:20:00Z',
        attachments: []
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'Absolutely! I\'ve attached the complete technical specification sheet for your turbine blade set. It includes material composition, tolerances, and certification documents.',
        timestamp: '2025-12-19T09:00:00Z',
        attachments: ['tech_specs.pdf', 'certification.pdf']
      },
      {
        id: 3,
        sender: 'buyer',
        senderName: 'Emma Wilson',
        message: 'Perfect! This is exactly what I needed. Thank you so much for the quick response.',
        timestamp: '2025-12-19T11:30:00Z',
        attachments: []
      }
    ]
  }
};

let currentTicket = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadTicketData();
  setupEventListeners();
});

function loadTicketData() {
  currentTicket = mockTicketData[ticketId];
  
  if (!currentTicket) {
    alert('Ticket not found!');
    window.location.href = '/buyer/tickets';
    return;
  }

  updateTicketHeader();
  updateTicketInfo();
  renderMessages();
  scrollToBottom();
}

function setupEventListeners() {
  // Chat form submission
  document.getElementById('chat-form')?.addEventListener('submit', handleMessageSubmit);

  // Attach button
  document.getElementById('btn-attach')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  // Auto-resize textarea
  const messageInput = document.getElementById('message-input');
  messageInput?.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  });
}

function updateTicketHeader() {
  document.getElementById('ticket-id-header').textContent = currentTicket.id;
  document.getElementById('ticket-subject-header').textContent = currentTicket.subject;
  document.getElementById('ticket-order-header').textContent = currentTicket.orderNumber;
  document.getElementById('ticket-created-header').textContent = formatDate(currentTicket.createdAt);
  
  const statusBadge = document.getElementById('status-badge-header');
  statusBadge.textContent = formatStatus(currentTicket.status);
  statusBadge.className = `status-badge-header ${currentTicket.status}`;
}

function updateTicketInfo() {
  // Category
  const categoryIcon = getCategoryIcon(currentTicket.category);
  document.getElementById('ticket-category').innerHTML = `
    <i data-lucide="${categoryIcon}"></i>
    <span>${currentTicket.category}</span>
  `;

  // Status badge
  const statusBadgeSmall = document.getElementById('status-badge-small');
  statusBadgeSmall.textContent = formatStatus(currentTicket.status);
  statusBadgeSmall.className = `status-badge-small ${currentTicket.status}`;

  // Last updated
  document.getElementById('ticket-updated').textContent = formatRelativeTime(currentTicket.updatedAt);

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function renderMessages() {
  const chatMessages = document.getElementById('chat-messages');
  
  chatMessages.innerHTML = currentTicket.messages.map(message => createMessageElement(message)).join('');

  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function createMessageElement(message) {
  const initials = message.senderName.split(' ').map(n => n[0]).join('');
  const time = formatTime(message.timestamp);
  
  let attachmentsHtml = '';
  if (message.attachments && message.attachments.length > 0) {
    attachmentsHtml = `
      <div class="message-attachments">
        ${message.attachments.map(file => `
          <a href="#" class="attachment-item">
            <i data-lucide="file"></i>
            <span>${file}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="message ${message.sender}">
      <div class="message-avatar">${initials}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">${message.senderName}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-bubble">
          ${message.message}
          ${attachmentsHtml}
        </div>
      </div>
    </div>
  `;
}

function handleMessageSubmit(e) {
  e.preventDefault();
  
  const messageInput = document.getElementById('message-input');
  const messageText = messageInput.value.trim();
  
  if (!messageText) return;

  // Create new message
  const newMessage = {
    id: currentTicket.messages.length + 1,
    sender: 'buyer',
    senderName: 'You',
    message: messageText,
    timestamp: new Date().toISOString(),
    attachments: []
  };

  // Add to messages
  currentTicket.messages.push(newMessage);

  // Re-render messages
  renderMessages();

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Scroll to bottom
  scrollToBottom();

  // Simulate support response after 2 seconds
  setTimeout(() => {
    const supportMessage = {
      id: currentTicket.messages.length + 1,
      sender: 'support',
      senderName: 'Support Team',
      message: 'Thank you for your message. We\'re looking into this and will get back to you shortly.',
      timestamp: new Date().toISOString(),
      attachments: []
    };
    
    currentTicket.messages.push(supportMessage);
    renderMessages();
    scrollToBottom();
  }, 2000);
}

function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
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

function formatTime(dateString) {
  const date = new Date(dateString);
  const options = { hour: '2-digit', minute: '2-digit' };
  return date.toLocaleTimeString('en-US', options);
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

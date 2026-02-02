// Ticket Details Page JavaScript - Buyer Side
// Real-time chat using Socket.io

// Get ticket ID from URL
const urlPath = window.location.pathname;
const ticketId = urlPath.split('/').pop();

let currentTicket = null;
let socket = null;
let isTyping = false;
let typingTimeout = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadTicketData();
  setupEventListeners();
  initializeSocket();
});

/**
 * Initialize Socket.io connection
 */
function initializeSocket() {
  // Get auth token from cookie
  const token = getCookie('token');
  
  // Connect to Socket.io
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    // Join the ticket room
    socket.emit('join-ticket', ticketId);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  // Listen for new messages
  socket.on('message-received', (data) => {
    if (data.ticketId === ticketId && data.sender !== 'buyer') {
      addMessageToUI(data);
      scrollToBottom();
      markMessagesAsRead();
    }
  });

  // Listen for typing indicators
  socket.on('user-typing', (data) => {
    if (data.userType === 'admin') {
      showTypingIndicator(data.isTyping);
    }
  });

  // Listen for status changes
  socket.on('ticket-status-changed', (data) => {
    if (data.ticketId === ticketId) {
      updateStatusUI(data.status);
    }
  });

  // Listen for read receipts
  socket.on('messages-marked-read', (data) => {
    if (data.ticketId === ticketId && data.readBy === 'admin') {
      updateReadReceipts();
    }
  });
}

/**
 * Load ticket data from API
 */
async function loadTicketData() {
  try {
    const response = await fetch('/buyer/api/tickets/' + ticketId);
    const data = await response.json();
    
    if (!data.success || !data.ticket) {
      showError('Ticket not found');
      setTimeout(() => {
        window.location.href = '/buyer/tickets';
      }, 2000);
      return;
    }

    currentTicket = data.ticket;
    updateTicketHeader();
    updateTicketInfo();
    renderMessages();
      scrollToBottom();
      // Disable chat UI if ticket is resolved/closed
      setChatEnabled(!['resolved', 'closed'].includes(currentTicket.status));
  } catch (error) {
    console.error('Error loading ticket:', error);
    showError('Failed to load ticket');
  }
/**
 * Enable or disable the chat input UI for buyer
 */
function setChatEnabled(enabled) {
  const chatForm = document.getElementById('chat-form');
  const messageInput = document.getElementById('message-input');
  const fileInput = document.getElementById('file-input');
  const attachBtn = document.getElementById('btn-attach');
  const sendBtn = document.querySelector('.btn-send');
  const chatInputContainer = document.querySelector('.chat-input-container');

  if (!chatInputContainer) return;

  // Remove existing notice
  const existingNotice = chatInputContainer.querySelector('.ticket-closed-notice');
  if (existingNotice) existingNotice.remove();

  if (!enabled) {
    if (chatForm) chatForm.classList.add('disabled');
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder = 'This ticket is resolved — you cannot send messages.';
    }
    if (fileInput) fileInput.disabled = true;
    if (attachBtn) attachBtn.disabled = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add('disabled');
    }

    const notice = document.createElement('div');
    notice.className = 'ticket-closed-notice';
    notice.style.padding = '0.75rem 1rem';
    notice.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
    notice.style.border = '1px solid #bfdbfe';
    notice.style.borderRadius = '8px';
    notice.style.color = '#1e3a8a';
    notice.style.fontWeight = '600';
    notice.style.marginBottom = '0.75rem';
    notice.textContent = 'This ticket has been resolved/closed. You cannot send new messages.';
    chatInputContainer.insertBefore(notice, chatInputContainer.firstChild);
  } else {
    if (chatForm) chatForm.classList.remove('disabled');
    if (messageInput) {
      messageInput.disabled = false;
      messageInput.placeholder = 'Type your message...';
    }
    if (fileInput) fileInput.disabled = false;
    if (attachBtn) attachBtn.disabled = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('disabled');
    }
  }
}
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Chat form submission
  const chatForm = document.getElementById('chat-form');
  chatForm?.addEventListener('submit', handleMessageSubmit);

  // Attach button
  const attachBtn = document.getElementById('btn-attach');
  attachBtn?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  // File input change
  const fileInput = document.getElementById('file-input');
  fileInput?.addEventListener('change', handleFileSelect);

  // Auto-resize textarea
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
      handleTyping();
    });

    // Enter to send (Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  }
}

/**
 * Handle typing indicator
 */
function handleTyping() {
  if (!socket) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { ticketId, isTyping: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('typing', { ticketId, isTyping: false });
  }, 2000);
}

/**
 * Update ticket header
 */
function updateTicketHeader() {
  document.getElementById('ticket-id-header').textContent = currentTicket.id;
  document.getElementById('ticket-subject-header').textContent = currentTicket.subject;
  document.getElementById('ticket-order-header').textContent = currentTicket.orderNumber || 'N/A';
  document.getElementById('ticket-created-header').textContent = formatDate(currentTicket.createdAt);
  
  const statusBadge = document.getElementById('status-badge-header');
  statusBadge.textContent = formatStatus(currentTicket.status);
  statusBadge.className = 'status-badge-header ' + currentTicket.status;
}

/**
 * Update ticket info panel
 */
function updateTicketInfo() {
  const categoryIcon = getCategoryIcon(currentTicket.category);
  document.getElementById('ticket-category').innerHTML = 
    '<i data-lucide="' + categoryIcon + '"></i><span>' + currentTicket.category + '</span>';

  const statusBadgeSmall = document.getElementById('status-badge-small');
  statusBadgeSmall.textContent = formatStatus(currentTicket.status);
  statusBadgeSmall.className = 'status-badge-small ' + currentTicket.status;

  document.getElementById('ticket-updated').textContent = formatRelativeTime(currentTicket.updatedAt || currentTicket.lastMessageAt);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Render all messages
 */
function renderMessages() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages || !currentTicket.messages) return;

  chatMessages.innerHTML = currentTicket.messages.map(msg => createMessageHTML(msg)).join('');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Create message HTML
 */
function createMessageHTML(message) {
  const isCustomer = message.sender === 'buyer';
  const initials = getInitials(message.senderName);
  const time = formatMessageTime(message.timestamp || message.createdAt);
  
  let attachmentsHtml = '';
  if (message.attachments && message.attachments.length > 0) {
    attachmentsHtml = '<div class="message-attachments">' +
      message.attachments.map(file => createAttachmentHTML(file)).join('') +
      '</div>';
  }

  return '<div class="message ' + (isCustomer ? 'customer' : 'admin') + '">' +
    '<div class="message-avatar">' + initials + '</div>' +
    '<div class="message-content">' +
      '<div class="message-header">' +
        '<span class="message-sender">' + escapeHtml(message.senderName) + '</span>' +
        '<span class="message-time">' + time + '</span>' +
      '</div>' +
      '<div class="message-bubble">' +
        '<div class="message-text">' + escapeHtml(message.content) + '</div>' +
        attachmentsHtml +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Create attachment HTML - All attachments shown as downloadable files
 */
function createAttachmentHTML(file) {
  const isImage = file.mimetype && file.mimetype.startsWith('image/');
  const iconName = isImage ? 'image' : (file.mimetype && file.mimetype.includes('pdf') ? 'file-text' : 'file');
  
  return '<a href="' + file.path + '" download="' + escapeHtml(file.originalName) + '" class="attachment-item attachment-file">' +
    '<div class="attachment-icon"><i data-lucide="' + iconName + '"></i></div>' +
    '<div class="attachment-info">' +
      '<span class="attachment-name">' + escapeHtml(file.originalName) + '</span>' +
      '<span class="attachment-meta">' + formatFileSize(file.size) + (isImage ? ' • Image' : '') + '</span>' +
    '</div>' +
    '<div class="attachment-download"><i data-lucide="download"></i></div>' +
  '</a>';
}

/**
 * Add new message to UI
 */
function addMessageToUI(message) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  // Remove typing indicator if present
  const typingIndicator = chatMessages.querySelector('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }

  const messageHtml = createMessageHTML(message);
  chatMessages.insertAdjacentHTML('beforeend', messageHtml);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Handle message submission
 */
async function handleMessageSubmit(e) {
  e.preventDefault();
  
  const messageInput = document.getElementById('message-input');
  const fileInput = document.getElementById('file-input');
  const messageText = messageInput.value.trim();
  const files = fileInput?.files || [];
  
  if (!messageText && files.length === 0) return;

  // Disable send button with appropriate state
  const sendBtn = document.querySelector('.btn-send');
  const hasFiles = files.length > 0;
  sendBtn.disabled = true;
  sendBtn.classList.add('sending');
  
  if (hasFiles) {
    sendBtn.innerHTML = '<div class="upload-progress"><i data-lucide="upload-cloud"></i></div><span>Uploading...</span>';
    showUploadProgress();
  } else {
    sendBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Sending...</span>';
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  try {
    const formData = new FormData();
    formData.append('message', messageText);
    
    // Add files
    for (let i = 0; i < files.length; i++) {
      formData.append('attachments', files[i]);
    }

    const response = await fetch('/buyer/api/tickets/' + ticketId + '/messages', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Clear inputs
      messageInput.value = '';
      messageInput.style.height = 'auto';
      if (fileInput) {
        fileInput.value = '';
        clearFilePreview();
      }

      // Add message to UI immediately
      addMessageToUI({
        ...data.message,
        sender: 'buyer',
        senderName: 'You'
      });
      scrollToBottom();

      // Stop typing indicator
      if (socket) {
        socket.emit('typing', { ticketId, isTyping: false });
      }
    } else {
      showError(data.error || 'Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message');
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove('sending');
    sendBtn.innerHTML = '<i data-lucide="send"></i><span>Send</span>';
    hideUploadProgress();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

/**
 * Show upload progress indicator
 */
function showUploadProgress() {
  const previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.classList.add('uploading');
    const items = previewContainer.querySelectorAll('.file-preview-item');
    items.forEach(item => {
      const status = item.querySelector('.file-status');
      if (status) {
        status.innerHTML = '<div class="upload-spinner"></div>';
      }
    });
  }
}

/**
 * Hide upload progress indicator
 */
function hideUploadProgress() {
  const previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.classList.remove('uploading');
  }
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
  const files = e.target.files;
  if (!files.length) return;
  showFilePreview(files);
}

/**
 * Show file preview
 */
function showFilePreview(files) {
  let previewContainer = document.querySelector('.file-preview-container');
  
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container';
    const chatInputContainer = document.querySelector('.chat-input-container');
    chatInputContainer.insertBefore(previewContainer, chatInputContainer.firstChild);
  }

  let html = '<div class="file-preview-header">' +
    '<span class="file-preview-title"><i data-lucide="paperclip"></i> ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' ready to send</span>' +
    '<button type="button" class="file-preview-clear" onclick="clearAllFiles()"><i data-lucide="x"></i> Clear all</button>' +
  '</div><div class="file-preview-list">';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isImage = file.type.startsWith('image/');
    const icon = isImage ? 'image' : (file.type.includes('pdf') ? 'file-text' : 'file');
    
    // Create thumbnail for images
    let thumbnailHtml = '';
    if (isImage) {
      thumbnailHtml = '<div class="file-thumbnail" data-file-index="' + i + '"></div>';
    } else {
      thumbnailHtml = '<div class="file-icon-preview"><i data-lucide="' + icon + '"></i></div>';
    }
    
    html += '<div class="file-preview-item" data-index="' + i + '">' +
      thumbnailHtml +
      '<div class="file-preview-info">' +
        '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
        '<span class="file-size">' + formatFileSize(file.size) + '</span>' +
      '</div>' +
      '<div class="file-status"><i data-lucide="check-circle"></i></div>' +
    '</div>';
  }
  html += '</div>';
  previewContainer.innerHTML = html;

  // Generate image thumbnails
  for (let j = 0; j < files.length; j++) {
    if (files[j].type.startsWith('image/')) {
      generateThumbnail(files[j], j);
    }
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Generate image thumbnail
 */
function generateThumbnail(file, index) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const thumbnail = document.querySelector('.file-thumbnail[data-file-index="' + index + '"]');
    if (thumbnail) {
      thumbnail.style.backgroundImage = 'url(' + e.target.result + ')';
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Clear all files
 */
function clearAllFiles() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.value = '';
  }
  clearFilePreview();
}

/**
 * Clear file preview
 */
function clearFilePreview() {
  const previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.remove();
  }
}

/**
 * Show typing indicator
 */
function showTypingIndicator(show) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  let typingIndicator = chatMessages.querySelector('.typing-indicator');
  
  if (show) {
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.className = 'message admin typing-indicator';
      typingIndicator.innerHTML = '<div class="message-avatar">S</div>' +
        '<div class="message-content">' +
          '<div class="message-bubble">' +
            '<div class="typing-dots"><span></span><span></span><span></span></div>' +
          '</div>' +
        '</div>';
      chatMessages.appendChild(typingIndicator);
      scrollToBottom();
    }
  } else if (typingIndicator) {
    typingIndicator.remove();
  }
}

/**
 * Update status UI
 */
function updateStatusUI(status) {
  const statusBadgeHeader = document.getElementById('status-badge-header');
  const statusBadgeSmall = document.getElementById('status-badge-small');
  const formattedStatus = formatStatus(status);

  if (statusBadgeHeader) {
    statusBadgeHeader.textContent = formattedStatus;
    statusBadgeHeader.className = 'status-badge-header ' + status;
  }

  if (statusBadgeSmall) {
    statusBadgeSmall.textContent = formattedStatus;
    statusBadgeSmall.className = 'status-badge-small ' + status;
  }

  showNotification('Ticket status changed to ' + formattedStatus);
  // Enable/disable chat depending on new status
  setChatEnabled(!['resolved', 'closed'].includes(status));
}

/**
 * Update read receipts
 */
function updateReadReceipts() {
  const messages = document.querySelectorAll('.message.customer');
  messages.forEach(msg => {
    if (!msg.querySelector('.read-indicator')) {
      const content = msg.querySelector('.message-content');
      if (content) {
        const indicator = document.createElement('span');
        indicator.className = 'read-indicator';
        indicator.innerHTML = '<i data-lucide="check-check"></i>';
        content.appendChild(indicator);
      }
    }
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead() {
  try {
    await fetch('/buyer/api/tickets/' + ticketId + '/read', {
      method: 'PUT'
    });
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

/**
 * Scroll to bottom of chat
 */
function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
  }
}

/**
 * Show error message
 */
function showError(message) {
  showNotification(message, 'error');
}

/**
 * Show notification
 */
function showNotification(message, type) {
  type = type || 'info';
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const notification = document.createElement('div');
  notification.className = 'notification notification-' + type;
  notification.innerHTML = '<span>' + escapeHtml(message) + '</span>' +
    '<button onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>';
  container.appendChild(notification);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Utility functions
function getCookie(name) {
  var value = '; ' + document.cookie;
  var parts = value.split('; ' + name + '=');
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
}

function formatStatus(status) {
  return status.split('-').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function getCategoryIcon(category) {
  var icons = {
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
  var date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatMessageTime(dateString) {
  if (!dateString) return '';
  var date = new Date(dateString);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';
  var date = new Date(dateString);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + ' minutes ago';
  if (diffHours < 24) return diffHours + ' hours ago';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return diffDays + ' days ago';
  
  return formatDate(dateString);
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
  if (socket) {
    socket.emit('leave-ticket', ticketId);
    socket.disconnect();
  }
});

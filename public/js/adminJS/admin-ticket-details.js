// Admin Ticket Details Page JavaScript
// Real-time chat using Socket.io

var ticketId = null;  // Ticket number like TKT-202602-0001
var ticketOid = null; // MongoDB ObjectId for socket operations
var moduleParam = '';
var socket = null;
var isTyping = false;
var typingTimeout = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Get ticket ID from the page (set in EJS)
  ticketId = window.adminTicketId || document.querySelector('[data-ticket-id]')?.dataset.ticketId;
  ticketOid = window.adminTicketOid || document.querySelector('[data-ticket-oid]')?.dataset.ticketOid || ticketId;
  moduleParam = window.adminModuleParam || '';
  
  initializeSocket();
  setupEventListeners();
  scrollToBottom();
  markAsRead();
});

/**
 * Initialize Socket.io connection
 */
function initializeSocket() {
  var token = getCookie('adminToken') || getCookie('token');
  
  socket = io({
    auth: { token: token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', function() {
    console.log('Admin socket connected');
    socket.emit('join-ticket', ticketId);
  });

  socket.on('disconnect', function() {
    console.log('Admin socket disconnected');
  });

  // Listen for new messages from buyer
  socket.on('message-received', function(data) {
    if (data.ticketId === ticketId && data.sender !== 'admin') {
      addMessageToChat(data.message || data);
      scrollToBottom();
      markAsRead();
    }
  });

  // Listen for typing indicators
  socket.on('user-typing', function(data) {
    if (data.userType === 'buyer') {
      showTypingIndicator(data.isTyping);
    }
  });

  // Listen for read receipts
  socket.on('messages-marked-read', function(data) {
    if (data.ticketId === ticketId && data.readBy === 'buyer') {
      updateReadReceipts();
    }
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  var textarea = document.getElementById('messageInput');
  var form = document.getElementById('chatForm');
  var fileInput = document.getElementById('fileInput');
  var attachBtn = document.querySelector('.btn-attach');

  // Auto-resize textarea
  if (textarea) {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      handleTyping();
    });

    // Enter to send (Shift+Enter for new line)
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
    });
  }

  // Attach button
  if (attachBtn) {
    attachBtn.addEventListener('click', function() {
      fileInput.click();
    });
  }

  // File input change
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }
}

/**
 * Handle typing indicator
 */
function handleTyping() {
  if (!socket) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { ticketId: ticketId, isTyping: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(function() {
    isTyping = false;
    socket.emit('typing', { ticketId: ticketId, isTyping: false });
  }, 2000);
}

/**
 * Scroll to bottom of chat
 */
function scrollToBottom() {
  var chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    setTimeout(function() {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
  }
}

/**
 * Send message
 */
function sendMessage(e) {
  e.preventDefault();
  var input = document.getElementById('messageInput');
  var fileInput = document.getElementById('fileInput');
  var message = input.value.trim();
  var files = fileInput ? fileInput.files : [];
  
  if (!message && files.length === 0) return;

  // Disable send button with appropriate state
  var sendBtn = document.querySelector('.btn-send');
  var hasFiles = files.length > 0;
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

  // Prepare form data
  var formData = new FormData();
  formData.append('message', message);
  
  for (var i = 0; i < files.length; i++) {
    formData.append('attachments', files[i]);
  }

  // Clear input immediately for responsiveness
  var originalMessage = message;
  input.value = '';
  input.style.height = 'auto';
  if (fileInput) {
    fileInput.value = '';
    clearFilePreview();
  }

  // Stop typing
  if (socket) {
    socket.emit('typing', { ticketId: ticketId, isTyping: false });
  }

  // Send to server and wait for response before adding to UI
  fetch('/admin/tickets/' + ticketId + '/reply', {
    method: 'POST',
    body: formData
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    if (!data.success) {
      showNotification('Failed to send message: ' + (data.error || 'Unknown error'), 'error');
    } else {
      hideUploadProgress();
      // Add message to UI with actual attachments from server response
      addMessageToChat({
        sender: 'admin',
        senderName: 'Admin',
        content: data.message?.content || originalMessage,
        attachments: data.message?.attachments || [],
        timestamp: data.message?.timestamp || new Date().toISOString()
      });
      scrollToBottom();
    }
  })
  .catch(function(err) {
    console.error('Error sending message:', err);
    showNotification('Failed to send message', 'error');
  })
  .finally(function() {
    sendBtn.disabled = false;
    sendBtn.classList.remove('sending');
    sendBtn.innerHTML = '<i data-lucide="send"></i><span>Send</span>';
    hideUploadProgress();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });
}

/**
 * Show upload progress indicator
 */
function showUploadProgress() {
  var previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.classList.add('uploading');
    var items = previewContainer.querySelectorAll('.file-preview-item');
    items.forEach(function(item) {
      var status = item.querySelector('.file-status');
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
  var previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.classList.remove('uploading');
  }
}

/**
 * Add message to chat UI
 */
function addMessageToChat(msg) {
  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // Remove typing indicator if present
  var typingIndicator = chatMessages.querySelector('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }

  var isAdmin = msg.sender === 'admin';
  var initials = isAdmin ? 'A' : getInitials(msg.senderName || 'C');
  var time = msg.timestamp ? formatMessageTime(msg.timestamp) : 'Just now';

  var attachmentsHtml = '';
  if (msg.attachments && msg.attachments.length > 0) {
    attachmentsHtml = '<div class="message-attachments">' +
      msg.attachments.map(function(file) {
        return createAttachmentHTML(file);
      }).join('') +
    '</div>';
  }

  var messageHtml = '<div class="message ' + (isAdmin ? 'admin' : 'customer') + '">' +
    '<div class="message-avatar">' + initials + '</div>' +
    '<div class="message-bubble">' +
      '<div class="message-text">' + escapeHtml(msg.content || msg.text || '') + '</div>' +
      attachmentsHtml +
      '<div class="message-time">' + (isAdmin ? 'Admin' : (msg.senderName || 'Customer')) + ' • ' + time + '</div>' +
    '</div>' +
  '</div>';
  
  chatMessages.insertAdjacentHTML('beforeend', messageHtml);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Create attachment HTML - All attachments shown as downloadable files
 */
function createAttachmentHTML(file) {
  var isImage = file.mimetype && file.mimetype.startsWith('image/');
  var iconName = isImage ? 'image' : (file.mimetype && file.mimetype.includes('pdf') ? 'file-text' : 'file');
  
  return '<a href="' + file.path + '" download="' + escapeHtml(file.originalName) + '" class="attachment-link attachment-file">' +
    '<div class="attachment-icon"><i data-lucide="' + iconName + '"></i></div>' +
    '<div class="attachment-info">' +
      '<span class="attachment-name">' + escapeHtml(file.originalName) + '</span>' +
      '<span class="attachment-meta">' + formatFileSize(file.size) + (isImage ? ' • Image' : '') + '</span>' +
    '</div>' +
    '<div class="attachment-download"><i data-lucide="download"></i></div>' +
  '</a>';
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
  var files = e.target.files;
  if (!files.length) return;
  showFilePreview(files);
}

/**
 * Show file preview
 */
function showFilePreview(files) {
  var chatInputContainer = document.querySelector('.chat-input-container');
  var previewContainer = document.querySelector('.file-preview-container');
  
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container';
    chatInputContainer.insertBefore(previewContainer, chatInputContainer.firstChild);
  }

  var html = '<div class="file-preview-header">' +
    '<span class="file-preview-title"><i data-lucide="paperclip"></i> ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' ready to send</span>' +
    '<button type="button" class="file-preview-clear" onclick="clearAllFiles()"><i data-lucide="x"></i> Clear all</button>' +
  '</div><div class="file-preview-list">';
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var isImage = file.type.startsWith('image/');
    var icon = isImage ? 'image' : (file.type.includes('pdf') ? 'file-text' : 'file');
    
    // Create thumbnail for images
    var thumbnailHtml = '';
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
  for (var j = 0; j < files.length; j++) {
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
  var reader = new FileReader();
  reader.onload = function(e) {
    var thumbnail = document.querySelector('.file-thumbnail[data-file-index="' + index + '"]');
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
  var fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.value = '';
  }
  clearFilePreview();
}

/**
 * Clear file preview
 */
function clearFilePreview() {
  var previewContainer = document.querySelector('.file-preview-container');
  if (previewContainer) {
    previewContainer.remove();
  }
}

/**
 * Show typing indicator
 */
function showTypingIndicator(show) {
  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  var typingIndicator = chatMessages.querySelector('.typing-indicator');
  
  if (show) {
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.className = 'message customer typing-indicator';
      typingIndicator.innerHTML = '<div class="message-avatar">C</div>' +
        '<div class="message-bubble">' +
          '<div class="typing-dots"><span></span><span></span><span></span></div>' +
        '</div>';
      chatMessages.appendChild(typingIndicator);
      scrollToBottom();
    }
  } else if (typingIndicator) {
    typingIndicator.remove();
  }
}

/**
 * Update read receipts
 */
function updateReadReceipts() {
  var messages = document.querySelectorAll('.message.admin');
  messages.forEach(function(msg) {
    if (!msg.querySelector('.read-indicator')) {
      var bubble = msg.querySelector('.message-bubble');
      if (bubble) {
        var indicator = document.createElement('span');
        indicator.className = 'read-indicator';
        indicator.innerHTML = '<i data-lucide="check-check"></i> Read';
        bubble.appendChild(indicator);
      }
    }
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Mark ticket as read
 */
function markAsRead() {
  fetch('/admin/api/tickets/' + ticketId + '/read', {
    method: 'PUT'
  }).catch(function(err) {
    console.error('Error marking as read:', err);
  });
}

/**
 * Insert quick reply
 */
function insertQuickReply(text) {
  var input = document.getElementById('messageInput');
  input.value = text;
  input.focus();
  input.dispatchEvent(new Event('input'));
}

/**
 * Update ticket status
 */
function updateStatus() {
  var select = document.getElementById('statusSelect');
  var newStatus = select.value;
  
  fetch('/admin/tickets/' + ticketId + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    if (data.success) {
      // Update UI
      var badge = document.querySelector('.chat-header .ticket-status-badge');
      if (badge) {
        badge.className = 'ticket-status-badge ' + newStatus;
        var iconMap = {
          'open': 'inbox',
          'in-progress': 'loader',
          'resolved': 'check-circle',
          'closed': 'x-circle'
        };
        var label = newStatus.split('-').map(function(w) { 
          return w.charAt(0).toUpperCase() + w.slice(1); 
        }).join(' ');
        badge.innerHTML = '<i data-lucide="' + iconMap[newStatus] + '"></i> ' + label;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
      showNotification('Status updated to ' + newStatus);
    } else {
      showNotification('Failed to update status', 'error');
    }
  })
  .catch(function(err) {
    console.error('Error updating status:', err);
    showNotification('Failed to update status', 'error');
  });
}

/**
 * Mark ticket as resolved
 */
function markResolved() {
  document.getElementById('statusSelect').value = 'resolved';
  updateStatus();
}

/**
 * Close ticket
 */
function closeTicket() {
  if (confirm('Are you sure you want to close this ticket?')) {
    document.getElementById('statusSelect').value = 'closed';
    updateStatus();
    setTimeout(function() {
      window.location.href = '/admin/tickets' + moduleParam;
    }, 1000);
  }
}

/**
 * Show notification
 */
function showNotification(message, type) {
  type = type || 'success';
  
  var container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;';
    document.body.appendChild(container);
  }

  var notification = document.createElement('div');
  notification.className = 'notification notification-' + type;
  notification.style.cssText = 'background:' + (type === 'error' ? '#ef4444' : '#10b981') + 
    ';color:white;padding:12px 20px;border-radius:8px;margin-bottom:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
  notification.textContent = message;
  container.appendChild(notification);

  setTimeout(function() {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(function() {
      notification.remove();
    }, 300);
  }, 3000);
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

function formatMessageTime(dateString) {
  if (!dateString) return '';
  var date = new Date(dateString);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

/**
 * Enhanced Notification System
 * Modern toast notifications with smooth animations
 */

class NotificationManager {
  constructor() {
    this.notifications = new Set();
    this.initializeStyles();
  }

  /**
   * Show a notification toast
   * @param {string} message - The notification message
   * @param {string} type - 'success', 'error', 'info', 'warning'
   * @param {object} options - Additional options { duration, position, action }
   */
  show(message, type = 'info', options = {}) {
    const {
      duration = 4000,
      position = 'top-right',
      action = null
    } = options;

    const isSuccess = type === 'success';
    const isError = type === 'error';
    const isWarning = type === 'warning';
    const isInfo = type === 'info';

    // Get icon based on type
    const iconMap = {
      success: 'check',
      error: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info'
    };

    // Get title based on type
    const titleMap = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Information'
    };

    // Determine colors
    let bgGradient, shadowColor;
    if (isSuccess) {
      bgGradient = 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)';
      shadowColor = 'rgba(16, 185, 129, 0.5)';
    } else if (isError) {
      bgGradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)';
      shadowColor = 'rgba(239, 68, 68, 0.5)';
    } else if (isWarning) {
      bgGradient = 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%)';
      shadowColor = 'rgba(245, 158, 11, 0.5)';
    } else {
      bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)';
      shadowColor = 'rgba(59, 130, 246, 0.5)';
    }

    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.innerHTML = `
      <div class="notification-icon-wrapper">
        <i data-lucide="${iconMap[type]}"></i>
      </div>
      <div class="notification-content">
        <span class="notification-title">${titleMap[type]}</span>
        <span class="notification-message">${this.escapeHtml(message)}</span>
      </div>
      ${action ? `<button class="notification-action">${action.text}</button>` : ''}
      <button class="notification-close" aria-label="Close">
        <i data-lucide="x"></i>
      </button>
      <div class="notification-progress"></div>
    `;

    notification.style.cssText = `
      position: fixed;
      ${this.getPositionStyles(position)}
      min-width: 320px;
      max-width: 420px;
      padding: 16px 20px;
      border-radius: 16px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      z-index: 10000;
      font-weight: 500;
      animation: notificationSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      background: ${bgGradient};
      color: #ffffff;
      border: none;
      box-shadow: 0 20px 40px -12px ${shadowColor}, 
                  0 8px 16px -8px rgba(0, 0, 0, 0.2),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(12px);
      overflow: hidden;
      box-sizing: border-box;
    `;

    // Close button handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.remove(notification));

    // Action button handler
    if (action && action.callback) {
      const actionBtn = notification.querySelector('.notification-action');
      actionBtn.addEventListener('click', () => {
        action.callback();
        this.remove(notification);
      });
    }

    document.body.appendChild(notification);
    this.notifications.add(notification);

    // Initialize lucide icons if available
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.remove(notification), duration);
    }

    return notification;
  }

  /**
   * Remove a notification
   */
  remove(notification) {
    if (!notification || !notification.parentElement) return;

    notification.style.animation = 'notificationSlideOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
      this.notifications.delete(notification);
    }, 400);
  }

  /**
   * Remove all notifications
   */
  removeAll() {
    this.notifications.forEach(notif => this.remove(notif));
  }

  /**
   * Get position styles
   */
  getPositionStyles(position) {
    const positions = {
      'top-right': 'top: 24px; right: 24px;',
      'top-left': 'top: 24px; left: 24px;',
      'bottom-right': 'bottom: 24px; right: 24px;',
      'bottom-left': 'bottom: 24px; left: 24px;',
      'top-center': 'top: 24px; left: 50%; transform: translateX(-50%);',
      'bottom-center': 'bottom: 24px; left: 50%; transform: translateX(-50%);'
    };
    return positions[position] || positions['top-right'];
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Initialize global styles
   */
  initializeStyles() {
    const styleId = 'notification-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes notificationSlideIn {
        0% {
          transform: translateX(120%);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes notificationSlideOut {
        0% {
          transform: translateX(0);
          opacity: 1;
        }
        100% {
          transform: translateX(120%);
          opacity: 0;
        }
      }

      @keyframes progressShrink {
        from {
          width: 100%;
        }
        to {
          width: 0%;
        }
      }

      .notification-toast {
        position: relative;
      }

      .notification-icon-wrapper {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }

      .notification-icon-wrapper i {
        width: 20px;
        height: 20px;
        stroke-width: 2.5;
      }

      .notification-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding-top: 2px;
      }

      .notification-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        opacity: 0.9;
      }

      .notification-message {
        font-size: 14px;
        font-weight: 500;
        opacity: 0.95;
        line-height: 1.4;
        word-break: break-word;
      }

      .notification-action {
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
        white-space: nowrap;
      }

      .notification-action:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      .notification-action:active {
        transform: scale(0.95);
      }

      .notification-close {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.15);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        flex-shrink: 0;
        color: inherit;
        padding: 0;
      }

      .notification-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }

      .notification-close:active {
        transform: scale(0.95);
      }

      .notification-close i {
        width: 14px;
        height: 14px;
        stroke-width: 2.5;
      }

      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        width: 100%;
        background: rgba(255, 255, 255, 0.4);
        animation: progressShrink 4s linear forwards;
        border-radius: 0 0 16px 16px;
      }

      /* Responsive design */
      @media (max-width: 480px) {
        .notification-toast {
          min-width: 280px !important;
          max-width: calc(100vw - 32px) !important;
        }

        .notification-title {
          font-size: 13px;
        }

        .notification-message {
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Create global notification manager instance
window.notificationManager = new NotificationManager();

// Legacy function support for backward compatibility
function showNotification(message, type) {
  window.notificationManager.show(message, type);
}

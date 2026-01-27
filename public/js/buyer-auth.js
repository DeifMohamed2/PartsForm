// ====================================
// BUYER AUTHENTICATION - JWT Cookie Based
// ====================================

(function () {
  'use strict';

  // ====================================
  // AUTHENTICATION STATE
  // ====================================
  const Auth = {
    // User data from server (populated by navbar template)
    _user: null,

    // Set user from server-side data
    setUser(userData) {
      this._user = userData;
    },

    // Check if user is logged in (based on server-side user data)
    isLoggedIn() {
      return this._user !== null && this._user !== undefined;
    },

    // Get current user
    getCurrentUser() {
      return this._user;
    },

    // Login via API
    async login(email, password) {
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include', // Important for cookies
        });

        const data = await response.json();

        if (data.success) {
          this._user = data.data?.user || null;
          return { 
            success: true, 
            user: this._user,
            redirectUrl: data.data?.redirectUrl || '/buyer'
          };
        } else {
          return { 
            success: false, 
            message: data.message || 'Login failed' 
          };
        }
      } catch (error) {
        console.error('Login error:', error);
        return { 
          success: false, 
          message: 'An error occurred. Please try again.' 
        };
      }
    },

    // Logout via API
    async logout() {
      try {
        const response = await fetch('/logout', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include',
        });

        const data = await response.json();
        
        // Clear local user state
        this._user = null;

        // Update UI
        const userDropdown = document.getElementById('userProfileDropdown');
        const signInBtn = document.getElementById('sign-in-btn');

        // Fade out user dropdown
        if (userDropdown) {
          userDropdown.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          userDropdown.style.opacity = '0';
          userDropdown.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            userDropdown.style.display = 'none';
            userDropdown.style.opacity = '';
            userDropdown.style.transform = '';
          }, 300);
        }

        // Fade in sign in button
        if (signInBtn) {
          signInBtn.style.display = 'flex';
          signInBtn.style.opacity = '0';
          signInBtn.style.transition = 'opacity 0.3s ease';
          setTimeout(() => {
            signInBtn.style.opacity = '1';
          }, 50);
          setTimeout(() => {
            signInBtn.style.opacity = '';
            signInBtn.style.transition = '';
          }, 350);
        }

        // Close dropdown menu if open
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        if (userDropdownMenu) {
          userDropdownMenu.classList.remove('show');
        }

        // Dispatch logout event
        window.dispatchEvent(new CustomEvent('userLoggedOut'));

        // Show notification
        showNotification('Logged out successfully', 'success');

        // Redirect to home
        setTimeout(() => {
          window.location.href = data.redirectUrl || '/';
        }, 500);

        return { success: true };
      } catch (error) {
        console.error('Logout error:', error);
        // Force redirect anyway
        window.location.href = '/';
        return { success: false, message: 'Error during logout' };
      }
    },

    // Show login modal
    showLoginModal() {
      LoginModal.show();
    }
  };

  // ====================================
  // LOGIN MODAL CONTROLLER
  // ====================================
  const LoginModal = {
    modal: null,
    form: null,
    submitBtn: null,

    init() {
      this.modal = document.getElementById('sign-in-modal') || document.getElementById('login-modal');
      this.form = document.getElementById('sign-in-form') || document.getElementById('login-form');
      this.submitBtn = document.getElementById('modal-submit-btn') || document.getElementById('login-submit-btn');

      if (this.form) {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
      }
    },

    show() {
      if (this.modal) {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    },

    hide() {
      if (this.modal) {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.clearErrors();
      }
    },

    clearErrors() {
      const errorEl = document.getElementById('modal-error');
      const successEl = document.getElementById('modal-success');
      if (errorEl) errorEl.style.display = 'none';
      if (successEl) successEl.style.display = 'none';
    },

    showError(message) {
      const errorEl = document.getElementById('modal-error');
      const errorMsgEl = document.getElementById('modal-error-message');
      const successEl = document.getElementById('modal-success');
      
      if (successEl) successEl.style.display = 'none';
      if (errorEl && errorMsgEl) {
        errorMsgEl.textContent = message;
        errorEl.style.display = 'flex';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    },

    showSuccess(message) {
      const errorEl = document.getElementById('modal-error');
      const successEl = document.getElementById('modal-success');
      const successMsgEl = document.getElementById('modal-success-message');
      
      if (errorEl) errorEl.style.display = 'none';
      if (successEl && successMsgEl) {
        successMsgEl.textContent = message;
        successEl.style.display = 'flex';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    },

    setLoading(loading) {
      if (!this.submitBtn) return;
      
      const btnText = this.submitBtn.querySelector('.btn-text');
      const btnIcon = this.submitBtn.querySelector('.btn-icon');
      const btnLoader = this.submitBtn.querySelector('.btn-loader');

      if (loading) {
        this.submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'flex';
      } else {
        this.submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnIcon) btnIcon.style.display = 'inline';
        if (btnLoader) btnLoader.style.display = 'none';
      }
    },

    async handleSubmit(e) {
      e.preventDefault();
      this.clearErrors();

      const emailInput = document.getElementById('modal-email');
      const passwordInput = document.getElementById('modal-password');

      if (!emailInput || !passwordInput) return;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        this.showError('Please enter both email and password');
        return;
      }

      this.setLoading(true);

      const result = await Auth.login(email, password);

      if (result.success) {
        this.showSuccess('Login successful! Redirecting...');

        // Update UI before redirect
        const userDropdown = document.getElementById('userProfileDropdown');
        const signInBtn = document.getElementById('sign-in-btn');

        if (signInBtn) {
          signInBtn.style.display = 'none';
        }

        // Dispatch login event
        window.dispatchEvent(new CustomEvent('userLoggedIn', { 
          detail: { user: result.user } 
        }));

        // Redirect after brief delay
        setTimeout(() => {
          window.location.href = result.redirectUrl || '/buyer';
        }, 1000);
      } else {
        this.showError(result.message || 'Login failed');
        this.setLoading(false);
      }
    }
  };

  // ====================================
  // USER INTERFACE UPDATES
  // ====================================
  function updateUserInterface(user) {
    if (!user) return;

    // Update user name in navbar
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = user.fullName || user.firstName || 'User';
    }

    // Update user avatar with initials
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
      const fullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      const initials = fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

      // Check if user has a custom avatar
      if (user.avatar) {
        userAvatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" class="avatar-image" />`;
      } else {
        userAvatar.innerHTML = `<span class="avatar-initials">${initials}</span>`;
      }
    }
  }

  // ====================================
  // NOTIFICATION SYSTEM
  // ====================================
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.auth-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = `auth-notification auth-notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ====================================
  // LOGOUT HANDLER
  // ====================================
  function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      // Clone to remove existing listeners
      const newLogoutBtn = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

      newLogoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Close dropdown menu
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        if (userDropdownMenu) {
          userDropdownMenu.classList.remove('show');
        }

        // Perform logout
        await Auth.logout();
      });
    }
  }

  // ====================================
  // USER PROFILE DROPDOWN
  // ====================================
  let dropdownClickHandler = null;
  let outsideClickHandler = null;

  function initUserDropdown() {
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const userProfileDropdown = document.getElementById('userProfileDropdown');

    if (userProfileBtn && userDropdownMenu && userProfileDropdown) {
      // Remove existing listeners if any
      if (dropdownClickHandler) {
        userProfileBtn.removeEventListener('click', dropdownClickHandler);
      }
      if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
      }

      // Create new click handler
      dropdownClickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const isOpen = userDropdownMenu.classList.contains('show');
        if (isOpen) {
          userDropdownMenu.classList.remove('show');
        } else {
          userDropdownMenu.classList.add('show');
        }
      };

      // Create outside click handler
      outsideClickHandler = (e) => {
        if (userProfileDropdown && !userProfileDropdown.contains(e.target)) {
          userDropdownMenu.classList.remove('show');
        }
      };

      // Attach event listeners
      userProfileBtn.addEventListener('click', dropdownClickHandler, true);
      document.addEventListener('click', outsideClickHandler, true);
    }
  }

  // ====================================
  // SIGN IN BUTTON HANDLER
  // ====================================
  function initSignInButton() {
    const signInBtns = document.querySelectorAll('#sign-in-btn, .btn-sign-in');
    signInBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        LoginModal.show();
      });
    });
  }

  // ====================================
  // HANDLE 401 RESPONSES GLOBALLY
  // ====================================
  function setupGlobalFetchInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      // Clone response to read it
      const clonedResponse = response.clone();
      
      if (response.status === 401) {
        try {
          const data = await clonedResponse.json();
          if (data.clearSession) {
            // Clear any local state
            Auth._user = null;
            
            // Show login if on protected page
            if (window.location.pathname.startsWith('/buyer') || 
                window.location.pathname.startsWith('/admin')) {
              showNotification(data.message || 'Session expired. Please login again.', 'error');
              setTimeout(() => {
                window.location.href = data.redirectUrl || '/?login=true';
              }, 1500);
            }
          }
        } catch (e) {
          // Not JSON response, ignore
        }
      }
      
      return response;
    };
  }

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    // Get user data from window if set by server
    if (window.__USER_DATA__) {
      Auth.setUser(window.__USER_DATA__);
    }

    // Initialize login modal
    LoginModal.init();

    // Check if user is logged in (from server-side rendered data)
    const userDropdown = document.getElementById('userProfileDropdown');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const signInBtn = document.getElementById('sign-in-btn');
    
    // Check if user is logged in by presence of user profile button
    // (it only exists when user is logged in due to EJS conditionals)
    if (userProfileBtn && userDropdown) {
      // User is logged in - initialize dropdown and logout
      initUserDropdown();
      initLogout();
      
      // Update UI with user data if available
      if (Auth.isLoggedIn()) {
        updateUserInterface(Auth.getCurrentUser());
      }
    }

    // Initialize sign in buttons
    initSignInButton();

    // Setup global fetch interceptor for 401 handling
    setupGlobalFetchInterceptor();

    // Check URL for login parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
      // Remove the parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Show login modal
      setTimeout(() => {
        LoginModal.show();
      }, 500);
    }

    // Expose Auth to window for global access
    window.BuyerAuth = Auth;
    window.showLoginModal = () => LoginModal.show();
    window.showNotification = showNotification;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ====================================
// NOTIFICATION STYLES (inject if not present)
// ====================================
(function() {
  if (document.getElementById('auth-notification-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'auth-notification-styles';
  style.textContent = `
    .auth-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100001;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      padding: 16px 20px;
      transform: translateX(120%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 400px;
    }
    
    .auth-notification.show {
      transform: translateX(0);
    }
    
    .auth-notification .notification-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .auth-notification .notification-content i {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    
    .auth-notification-success {
      border-left: 4px solid #10b981;
    }
    
    .auth-notification-success i {
      color: #10b981;
    }
    
    .auth-notification-error {
      border-left: 4px solid #ef4444;
    }
    
    .auth-notification-error i {
      color: #ef4444;
    }
    
    .auth-notification-info {
      border-left: 4px solid #3b82f6;
    }
    
    .auth-notification-info i {
      color: #3b82f6;
    }

    .avatar-initials {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font-size: 12px;
      font-weight: 600;
      color: #2B5278;
      background: linear-gradient(135deg, rgba(43, 82, 120, 0.1), rgba(59, 130, 246, 0.1));
      border-radius: inherit;
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
  `;
  document.head.appendChild(style);
})();

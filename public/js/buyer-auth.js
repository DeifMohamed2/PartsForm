// ====================================
// BUYER AUTHENTICATION - MOCK SESSION MANAGEMENT
// ====================================

(function () {
  'use strict';

  // ====================================
  // AUTHENTICATION STATE
  // ====================================
  const Auth = {
    // Buyer accounts (synced with landing page)
    BUYER_ACCOUNTS: [
      { email: 'buyer@partsform.com', password: 'buyer123', name: 'Demo Buyer', fullName: 'Demo Buyer' },
      { email: 'john.smith@automax.com', password: 'buyer123', name: 'John Smith', fullName: 'John Smith' },
      { email: 'maria@premiumauto.com', password: 'buyer123', name: 'Maria Garcia', fullName: 'Maria Garcia' },
      { email: 'sarah@partsworld.com', password: 'buyer123', name: 'Sarah Johnson', fullName: 'Sarah Johnson' },
      { email: 'robert@euroauto.eu', password: 'buyer123', name: 'Robert Chen', fullName: 'Robert Chen' }
    ],

    // Check if user is logged in (check both session types for compatibility)
    isLoggedIn() {
      // Check new unified session first
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const userRole = localStorage.getItem('userRole');
      
      if (isLoggedIn === 'true' && userRole === 'buyer') {
        return true;
      }
      
      // Fallback to old buyerSession for backwards compatibility
      const session = localStorage.getItem('buyerSession');
      if (!session) return false;
      
      try {
        const sessionData = JSON.parse(session);
        // Check if session is expired (24 hours)
        if (Date.now() > sessionData.expiresAt) {
          this.logout();
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    },

    // Get current user
    getCurrentUser() {
      // Check new unified session first
      const userName = localStorage.getItem('userName');
      const userEmail = localStorage.getItem('userEmail');
      const userRole = localStorage.getItem('userRole');
      
      if (userName && userEmail && userRole === 'buyer') {
        return {
          email: userEmail,
          name: userName,
          fullName: userName
        };
      }
      
      // Fallback to old buyerSession
      const session = localStorage.getItem('buyerSession');
      if (!session) return null;
      
      try {
        const sessionData = JSON.parse(session);
        return sessionData.user;
      } catch (e) {
        return null;
      }
    },

    // Login
    login(email, password) {
      // Find matching buyer account
      const buyer = this.BUYER_ACCOUNTS.find(b => b.email === email && b.password === password);
      
      if (buyer) {
        const user = {
          email: buyer.email,
          name: buyer.name,
          fullName: buyer.fullName
        };

        // Store in unified session format (compatible with landing page)
        localStorage.setItem('userRole', 'buyer');
        localStorage.setItem('userName', buyer.fullName);
        localStorage.setItem('userEmail', buyer.email);
        localStorage.setItem('isLoggedIn', 'true');

        // Also keep old format for backwards compatibility
        const sessionData = {
          user: user,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        localStorage.setItem('buyerSession', JSON.stringify(sessionData));
        
        return { success: true, user: user };
      }
      return { success: false, message: 'Invalid email or password' };
    },

    // Logout
    logout() {
      // Clear all session data
      localStorage.removeItem('buyerSession');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('isLoggedIn');
      
      // Smooth logout with transitions
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
      
      // Reset user interface
      const userNameEl = document.getElementById('userName');
      if (userNameEl) {
        userNameEl.textContent = 'User';
      }
      
      const userAvatar = document.querySelector('.user-avatar');
      if (userAvatar) {
        userAvatar.innerHTML = '<i data-lucide="user"></i>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
      
      // Close dropdown menu if open
      const userDropdownMenu = document.getElementById('userDropdownMenu');
      if (userDropdownMenu) {
        userDropdownMenu.classList.remove('show');
      }
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
      
      // Show subtle notification
      showNotification('Logged out successfully', 'success');
      
      // Only redirect if on a page that requires authentication
      // Don't redirect from orders, cart, checkout, etc. - let user stay
      const currentPath = window.location.pathname;
      const protectedPages = ['/buyer/profile', '/buyer/settings'];
      if (protectedPages.some(page => currentPath.includes(page))) {
        setTimeout(() => {
          window.location.href = '/buyer';
        }, 500);
      }
    },

    // Require login (returns promise that resolves when logged in)
    requireLogin() {
      return new Promise((resolve, reject) => {
        if (this.isLoggedIn()) {
          resolve(this.getCurrentUser());
        } else {
          // Show login modal
          this.showLoginModal();
          // Wait for login
          const checkLogin = setInterval(() => {
            if (this.isLoggedIn()) {
              clearInterval(checkLogin);
              resolve(this.getCurrentUser());
            }
          }, 100);
        }
      });
    }
  };

  // ====================================
  // LOGIN MODAL MANAGEMENT
  // ====================================
  const LoginModal = {
    modal: null,
    backdrop: null,
    form: null,
    closeBtn: null,

    init() {
      this.modal = document.getElementById('sign-in-modal');
      if (!this.modal) return;

      this.backdrop = this.modal.querySelector('#modal-backdrop');
      this.form = this.modal.querySelector('#sign-in-form');
      this.closeBtn = this.modal.querySelector('#modal-close');

      // Close handlers
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.hide());
      }
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.hide());
      }

      // Form submission
      if (this.form) {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isVisible()) {
          this.hide();
        }
      });
    },

    show() {
      if (!this.modal) return;
      
      // Smooth fade in
      this.modal.style.opacity = '0';
      this.modal.style.transition = 'opacity 0.2s ease';
      this.modal.classList.add('show', 'active');
      document.body.style.overflow = 'hidden';
      
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.modal.style.opacity = '1';
        }, 10);
      });

      // Focus on email input
      const emailInput = this.modal.querySelector('#login-email') || 
                        this.modal.querySelector('input[type="email"]');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 150);
      }
      
      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    },

    hide() {
      if (!this.modal) return;
      
      // Smooth fade out
      this.modal.style.transition = 'opacity 0.2s ease';
      this.modal.style.opacity = '0';
      
      setTimeout(() => {
        this.modal.classList.remove('show', 'active');
        this.modal.style.opacity = '';
        this.modal.style.transition = '';
        document.body.style.overflow = '';
        
        // Reset form
        if (this.form) {
          this.form.reset();
        }
      }, 200);
    },

    isVisible() {
      return this.modal && (this.modal.classList.contains('show') || this.modal.classList.contains('active'));
    },

    async handleSubmit(e) {
      e.preventDefault();
      
      // Try to find email and password inputs (support both landing and buyer pages)
      const emailInput = this.modal.querySelector('#login-email') || 
                        this.modal.querySelector('input[type="email"]');
      const passwordInput = this.modal.querySelector('#login-password') || 
                           this.modal.querySelector('input[type="password"]');
      const submitBtn = this.form.querySelector('button[type="submit"]');
      
      if (!emailInput || !passwordInput) return;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Disable submit button
      if (submitBtn) {
        submitBtn.disabled = true;
        const btnSpan = submitBtn.querySelector('span');
        if (btnSpan) {
          btnSpan.textContent = 'Signing In...';
        } else {
          submitBtn.innerHTML = '<span>Signing In...</span>';
        }
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = Auth.login(email, password);

      if (result.success) {
        // Success - smooth login transition
        const userDropdown = document.getElementById('userProfileDropdown');
        const signInBtn = document.getElementById('sign-in-btn');
        
        // Hide modal first with fade out
        this.modal.style.transition = 'opacity 0.2s ease';
        this.modal.style.opacity = '0';
        setTimeout(() => {
          this.hide();
          this.modal.style.opacity = '';
          this.modal.style.transition = '';
        }, 200);
        
        // Fade out sign in button
        if (signInBtn) {
          signInBtn.style.transition = 'opacity 0.2s ease';
          signInBtn.style.opacity = '0';
          setTimeout(() => {
            signInBtn.style.display = 'none';
            signInBtn.style.opacity = '';
            signInBtn.style.transition = '';
          }, 200);
        }
        
        // Update user interface
        updateUserInterface(result.user);
        
        // Fade in user dropdown
        if (userDropdown) {
          userDropdown.style.display = 'block';
          userDropdown.style.opacity = '0';
          userDropdown.style.transform = 'translateY(-10px)';
          userDropdown.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          setTimeout(() => {
            userDropdown.style.opacity = '1';
            userDropdown.style.transform = 'translateY(0)';
          }, 250);
          setTimeout(() => {
            userDropdown.style.opacity = '';
            userDropdown.style.transform = '';
            userDropdown.style.transition = '';
          }, 550);
        }
        
        // Re-initialize user dropdown after login (important!)
        setTimeout(() => {
          initUserDropdown();
          initLogout();
          // Re-initialize icons after DOM update
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        }, 300);
        
        // Dispatch custom event for login (so search can re-enable)
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { user: result.user } }));
        
        // Show subtle success notification
        setTimeout(() => {
          showNotification('Welcome back!', 'success');
        }, 400);
      } else {
        // Error
        showNotification(result.message || 'Invalid credentials', 'error');
        
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          const btnSpan = submitBtn.querySelector('span');
          if (btnSpan) {
            btnSpan.textContent = 'Sign In';
          } else {
            submitBtn.innerHTML = '<span>Sign In</span><i data-lucide="arrow-right"></i>';
          }
          lucide.createIcons();
        }
      }
    }
  };

  // ====================================
  // USER INTERFACE UPDATES
  // ====================================
  function updateUserInterface(user) {
    // Update user name in navbar
    const userNameEl = document.getElementById('userName');
    if (userNameEl && user) {
      userNameEl.textContent = user.fullName || user.name || 'User';
    }

    // Update user avatar
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar && user) {
      const initials = (user.fullName || user.name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      
      userAvatar.innerHTML = `<span class="avatar-initials">${initials}</span>`;
    }

    // Show user dropdown
    const userDropdown = document.getElementById('userProfileDropdown');
    if (userDropdown) {
      userDropdown.style.display = 'block';
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
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);
    lucide.createIcons();

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
  // SEARCH PROTECTION (REMOVED - Allow search without login)
  // ====================================
  function protectSearch() {
    // Search is now allowed without login
    // This function is kept for future use if needed
  }

  // ====================================
  // LOGOUT HANDLER
  // ====================================
  function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      // Remove existing listeners to prevent duplicates
      const newLogoutBtn = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
      
      newLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close dropdown menu smoothly
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        if (userDropdownMenu) {
          userDropdownMenu.classList.remove('show');
        }
        
        // Smooth logout without confirmation
        Auth.logout();
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
        if (userProfileDropdown && 
            !userProfileDropdown.contains(e.target)) {
          userDropdownMenu.classList.remove('show');
        }
      };

      // Attach event listeners with capture to ensure it fires
      userProfileBtn.addEventListener('click', dropdownClickHandler, true);
      document.addEventListener('click', outsideClickHandler, true);
      
      console.log('User dropdown initialized'); // Debug
    } else {
      console.log('User dropdown elements not found:', {
        btn: !!userProfileBtn,
        menu: !!userDropdownMenu,
        container: !!userProfileDropdown
      }); // Debug
    }
  }

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    // Initialize login modal
    LoginModal.init();

    // Check if user is logged in
    if (Auth.isLoggedIn()) {
      const user = Auth.getCurrentUser();
      updateUserInterface(user);
      // Show user dropdown, hide sign in button (smoothly on load)
      const userDropdown = document.getElementById('userProfileDropdown');
      const signInBtn = document.getElementById('sign-in-btn');
      if (userDropdown) {
        userDropdown.style.display = 'block';
        userDropdown.style.opacity = '0';
        userDropdown.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
          setTimeout(() => {
            userDropdown.style.opacity = '1';
            setTimeout(() => {
              userDropdown.style.opacity = '';
              userDropdown.style.transition = '';
            }, 300);
          }, 50);
        });
      }
      if (signInBtn) {
        signInBtn.style.display = 'none';
      }
      
      // Initialize user dropdown after showing it
      setTimeout(() => {
        initUserDropdown();
        initLogout();
      }, 100);
    } else {
      // Hide user dropdown if not logged in, show sign in button
      const userDropdown = document.getElementById('userProfileDropdown');
      const signInBtn = document.getElementById('sign-in-btn');
      if (userDropdown) {
        userDropdown.style.display = 'none';
      }
      if (signInBtn) {
        signInBtn.style.display = 'flex';
        signInBtn.style.opacity = '0';
        signInBtn.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
          setTimeout(() => {
            signInBtn.style.opacity = '1';
            setTimeout(() => {
              signInBtn.style.opacity = '';
              signInBtn.style.transition = '';
            }, 300);
          }, 50);
        });
      }
    }

    // Initialize sign in button
    initSignInButton();

    // Protect search functionality (now allows search without login)
    protectSearch();

    // Initialize logout (only if logged in)
    if (Auth.isLoggedIn()) {
      initLogout();
    }

    // Initialize user dropdown (only if logged in)
    if (Auth.isLoggedIn()) {
      // Already initialized above with setTimeout
    }

    // Expose Auth to window for global access
    window.BuyerAuth = Auth;
    window.showLoginModal = () => LoginModal.show();
  }

  // ====================================
  // SIGN IN BUTTON HANDLER
  // ====================================
  function initSignInButton() {
    const signInBtn = document.getElementById('sign-in-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        LoginModal.show();
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


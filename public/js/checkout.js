// ====================================
// CHECKOUT PAGE - PROFESSIONAL
// PARTSFORM Buyer Portal
// Simple and reliable checkout with loaders
// ====================================

(function() {
  'use strict';

  // ====================================
  // CONFIGURATION
  // ====================================
  const CONFIG = {
    CURRENCY: 'د.إ',
    AUTO_REDIRECT_DELAY: 4000,
    SKELETON_MIN_DISPLAY: 400,
  };

  // Payment method configurations
  const PAYMENT_FEES = {
    card: { type: 'percentage', value: 2.9, fixed: 1.5, name: 'Credit/Debit Card' },
    'bank-dubai': { type: 'fixed', value: 0, name: 'Bank Transfer (UAE)' },
    'bank-international': { type: 'fixed', value: 35, name: 'International Bank Transfer' },
    paypal: { type: 'percentage', value: 3.9, fixed: 1.5, name: 'PayPal' },
    cod: { type: 'fixed', value: 15, name: 'Cash on Delivery' },
  };

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const State = {
    currentStep: 1,
    isInitialized: false,
    isSubmitting: false,
    
    addresses: [],
    cartItems: [],
    orderTotal: 0,
    
    selectedAddress: null,
    selectedPaymentType: 'full',
    selectedPaymentMethod: 'card',
    
    isLoadingAddresses: true,
    isLoadingCart: true,
    
    errors: {
      addresses: null,
      cart: null,
      order: null,
    },
  };

  // ====================================
  // DOM CACHE
  // ====================================
  let DOM = {};

  function cacheDOMElements() {
    DOM = {
      checkoutPage: document.querySelector('.checkout-page'),
      
      step1: document.getElementById('step-1'),
      step2: document.getElementById('step-2'),
      step3: document.getElementById('step-3'),
      step4: document.getElementById('step-4'),
      stepIndicators: document.querySelectorAll('.step-item'),
      
      shippingAddresses: document.getElementById('shipping-addresses'),
      noAddresses: document.getElementById('no-addresses'),
      addAddressSection: document.getElementById('add-address-section'),
      addressSkeleton: document.getElementById('address-skeleton'),
      
      summaryItems: document.getElementById('summary-items'),
      summarySkeleton: document.getElementById('summary-skeleton'),
      summaryContent: document.getElementById('summary-content'),
      summarySubtotal: document.getElementById('summary-subtotal'),
      summaryItemsCount: document.getElementById('summary-items-count'),
      summaryWeight: document.getElementById('summary-weight'),
      summaryFeeRow: document.getElementById('summary-fee-row'),
      summaryFee: document.getElementById('summary-fee'),
      summaryTotal: document.getElementById('summary-total'),
      
      btnToStep2: document.getElementById('btn-to-step-2'),
      btnToStep1Back: document.getElementById('btn-to-step-1-back'),
      btnToStep3: document.getElementById('btn-to-step-3'),
      btnToStep2Back: document.getElementById('btn-to-step-2-back'),
      btnToStep4: document.getElementById('btn-to-step-4'),
      btnToStep3Back: document.getElementById('btn-to-step-3-back'),
      btnComplete: document.getElementById('btn-complete-payment'),
      btnChangeAddress: document.getElementById('btn-change-address'),
      
      paymentTypeCards: document.querySelectorAll('.payment-type-card'),
      paymentMethodCards: document.querySelectorAll('.payment-method-card'),
      fullAmountEl: document.getElementById('full-amount'),
      partialNowEl: document.getElementById('partial-now'),
      partialLaterEl: document.getElementById('partial-later'),
      partialAmountEl: document.getElementById('partial-amount'),
      
      confirmType: document.getElementById('confirm-type'),
      confirmMethod: document.getElementById('confirm-method'),
      confirmFee: document.getElementById('confirm-fee'),
      confirmTotal: document.getElementById('confirm-total'),
      shippingAddressSummary: document.getElementById('shipping-address-summary'),
      termsCheckbox: document.getElementById('terms-checkbox'),
      
      successModal: document.getElementById('success-modal'),
      orderNumber: document.getElementById('order-number'),
      paymentMethodText: document.getElementById('payment-method-text'),
      amountPaid: document.getElementById('amount-paid'),
    };
  }

  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  const Utils = {
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    formatCurrency(amount) {
      return `${parseFloat(amount || 0).toFixed(2)} ${CONFIG.CURRENCY}`;
    },

    scrollToElement(el) {
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };

  // ====================================
  // LOADER MANAGEMENT
  // ====================================
  const Loader = {
    showAddressSkeleton() {
      if (DOM.addressSkeleton) DOM.addressSkeleton.style.display = 'block';
      if (DOM.shippingAddresses) DOM.shippingAddresses.style.display = 'none';
      if (DOM.noAddresses) DOM.noAddresses.style.display = 'none';
      if (DOM.addAddressSection) DOM.addAddressSection.style.display = 'none';
    },

    hideAddressSkeleton() {
      if (DOM.addressSkeleton) DOM.addressSkeleton.style.display = 'none';
    },

    showSummarySkeleton() {
      if (DOM.summarySkeleton) DOM.summarySkeleton.style.display = 'block';
      if (DOM.summaryContent) DOM.summaryContent.style.display = 'none';
    },

    hideSummarySkeleton() {
      if (DOM.summarySkeleton) DOM.summarySkeleton.style.display = 'none';
      if (DOM.summaryContent) DOM.summaryContent.style.display = 'block';
    },

    setButtonLoading(button, loading) {
      if (!button) return;
      
      if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `
          <span class="btn-loader">
            <svg class="spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </span>
          <span>Processing...</span>
        `;
      } else {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.innerHTML = button.dataset.originalText;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    },
  };

  // ====================================
  // ERROR HANDLING
  // ====================================
  const ErrorHandler = {
    showError(message, duration = 8000) {
      const existing = document.querySelector('.checkout-toast-error');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'checkout-toast-error';
      toast.innerHTML = `
        <div class="toast-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="toast-message">${Utils.escapeHtml(message)}</div>
        <button class="toast-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      document.body.appendChild(toast);
      
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });

      toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      });

      if (duration > 0) {
        setTimeout(() => {
          if (toast.parentElement) {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
          }
        }, duration);
      }
    },
  };

  // ====================================
  // DATA LOADING
  // ====================================
  const DataLoader = {
    async loadAddresses() {
      State.isLoadingAddresses = true;
      Loader.showAddressSkeleton();
      
      const startTime = Date.now();
      
      try {
        // Simple fetch without timeout
        const response = await fetch('/buyer/api/addresses', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        const elapsed = Date.now() - startTime;
        if (elapsed < CONFIG.SKELETON_MIN_DISPLAY) {
          await new Promise(r => setTimeout(r, CONFIG.SKELETON_MIN_DISPLAY - elapsed));
        }
        
        if (data.success && Array.isArray(data.addresses)) {
          State.addresses = data.addresses;
          State.errors.addresses = null;
          
          if (State.addresses.length > 0) {
            Renderer.renderAddresses();
            
            const defaultAddr = State.addresses.find(a => a.isDefault) || State.addresses[0];
            if (defaultAddr) {
              Actions.selectAddress(defaultAddr._id);
            }
          } else {
            Renderer.showNoAddresses();
          }
        } else {
          Renderer.showNoAddresses();
        }
      } catch (error) {
        console.error('[Checkout] Address loading failed:', error);
        State.errors.addresses = error.message;
        Renderer.showNoAddresses('Failed to load addresses. Please refresh the page.');
      } finally {
        State.isLoadingAddresses = false;
        Loader.hideAddressSkeleton();
      }
    },

    async loadCart() {
      State.isLoadingCart = true;
      Loader.showSummarySkeleton();
      
      const startTime = Date.now();
      
      try {
        const cartData = localStorage.getItem('partsform_shopping_cart');
        
        if (!cartData) {
          State.cartItems = [];
          State.orderTotal = 0;
          Renderer.renderEmptyCart();
          return;
        }
        
        const parsed = JSON.parse(cartData);
        const localItems = parsed.items || [];
        
        if (localItems.length === 0) {
          State.cartItems = [];
          State.orderTotal = 0;
          Renderer.renderEmptyCart();
          return;
        }
        
        State.cartItems = localItems;
        State.orderTotal = localItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        
        // Non-blocking price validation (fire and forget)
        this.validateCartPrices(localItems).catch(() => {});
        
        const elapsed = Date.now() - startTime;
        if (elapsed < CONFIG.SKELETON_MIN_DISPLAY) {
          await new Promise(r => setTimeout(r, CONFIG.SKELETON_MIN_DISPLAY - elapsed));
        }
        
        Renderer.renderOrderSummary();
        Renderer.updatePaymentAmounts();
        
      } catch (error) {
        console.error('[Checkout] Cart loading failed:', error);
        State.errors.cart = error.message;
        ErrorHandler.showError('Failed to load cart data. Please try again.');
      } finally {
        State.isLoadingCart = false;
        Loader.hideSummarySkeleton();
      }
    },

    async validateCartPrices(items) {
      try {
        // Simple fetch for price validation - non-critical
        const response = await fetch('/buyer/api/cart/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({ items }),
        });
        
        if (!response.ok) return;
        
        const result = await response.json();
        
        if (result.success && result.validatedItems) {
          State.cartItems = State.cartItems.map(item => {
            const validated = result.validatedItems.find(vi => vi.id === item.id);
            return validated?.validated ? { ...item, price: validated.price, validated: true } : item;
          });
          
          State.orderTotal = State.cartItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
          
          const cartData = JSON.parse(localStorage.getItem('partsform_shopping_cart') || '{}');
          cartData.items = State.cartItems;
          localStorage.setItem('partsform_shopping_cart', JSON.stringify(cartData));
          
          Renderer.renderOrderSummary();
          Renderer.updatePaymentAmounts();
        }
      } catch (error) {
        // Silent fail - using local prices
      }
    },
  };

  // ====================================
  // RENDERER
  // ====================================
  const Renderer = {
    renderAddresses() {
      if (!DOM.shippingAddresses) return;
      
      DOM.shippingAddresses.style.display = 'grid';
      if (DOM.addAddressSection) DOM.addAddressSection.style.display = 'block';
      if (DOM.noAddresses) DOM.noAddresses.style.display = 'none';
      
      DOM.shippingAddresses.innerHTML = State.addresses.map(addr => `
        <div class="shipping-address-card ${addr.isDefault ? 'default' : ''} ${State.selectedAddress?._id === addr._id ? 'selected' : ''}" 
             data-address-id="${addr._id}" role="button" tabindex="0">
          <div class="address-radio">
            <input type="radio" name="shipping-address" id="addr-${addr._id}" 
                   value="${addr._id}" ${State.selectedAddress?._id === addr._id ? 'checked' : ''}>
            <label for="addr-${addr._id}">
              <span class="radio-check"></span>
            </label>
          </div>
          <div class="address-content">
            <div class="address-header">
              <span class="address-label">${Utils.escapeHtml(addr.label)}</span>
              ${addr.isDefault ? '<span class="address-default-badge"><i data-lucide="star"></i> Default</span>' : ''}
            </div>
            <div class="address-details">
              <div class="address-row">
                <i data-lucide="user"></i>
                <strong>${Utils.escapeHtml(addr.fullName)}</strong>
              </div>
              <div class="address-row">
                <i data-lucide="phone"></i>
                <span>${Utils.escapeHtml(addr.phone)}</span>
              </div>
              <div class="address-row">
                <i data-lucide="map-pin"></i>
                <span>${Utils.escapeHtml(addr.street)}, ${Utils.escapeHtml(addr.city)}, ${Utils.escapeHtml(addr.state)}, ${Utils.escapeHtml(addr.country)}${addr.postalCode ? ' ' + Utils.escapeHtml(addr.postalCode) : ''}</span>
              </div>
              ${addr.notes ? `
              <div class="address-row notes">
                <i data-lucide="info"></i>
                <span>${Utils.escapeHtml(addr.notes)}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');

      if (typeof lucide !== 'undefined') lucide.createIcons();
      
      DOM.shippingAddresses.querySelectorAll('.shipping-address-card').forEach(card => {
        card.addEventListener('click', () => Actions.selectAddress(card.dataset.addressId));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            Actions.selectAddress(card.dataset.addressId);
          }
        });
      });
    },

    showNoAddresses(message = null) {
      Loader.hideAddressSkeleton();
      if (DOM.shippingAddresses) DOM.shippingAddresses.style.display = 'none';
      if (DOM.addAddressSection) DOM.addAddressSection.style.display = 'none';
      
      if (DOM.noAddresses) {
        DOM.noAddresses.style.display = 'flex';
        if (message) {
          const textEl = DOM.noAddresses.querySelector('.no-addresses-text');
          if (textEl) textEl.textContent = message;
        }
      }
    },

    renderOrderSummary() {
      if (!DOM.summaryItems) return;
      
      if (State.cartItems.length === 0) {
        this.renderEmptyCart();
        return;
      }
      
      DOM.summaryItems.innerHTML = State.cartItems.map(item => `
        <div class="summary-item">
          <div class="summary-item-info">
            <div class="summary-item-title">${Utils.escapeHtml(item.code || item.partNumber || 'N/A')}</div>
            <div class="summary-item-desc">${Utils.escapeHtml(item.description || 'Industrial Part')}</div>
            <div class="summary-item-brand">
              <i data-lucide="tag"></i>
              <span>${Utils.escapeHtml(item.brand || 'N/A')}</span>
            </div>
          </div>
          <div class="summary-item-price">${Utils.formatCurrency(item.price)}</div>
        </div>
      `).join('');

      const totalItems = State.cartItems.length;
      const totalWeight = State.cartItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);

      if (DOM.summarySubtotal) DOM.summarySubtotal.textContent = Utils.formatCurrency(State.orderTotal);
      if (DOM.summaryItemsCount) DOM.summaryItemsCount.textContent = `${totalItems} PCS`;
      if (DOM.summaryWeight) DOM.summaryWeight.textContent = `${totalWeight.toFixed(3)} kg`;
      
      this.updateTotalWithFees();
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    renderEmptyCart() {
      Loader.hideSummarySkeleton();
      if (DOM.summaryItems) {
        DOM.summaryItems.innerHTML = `
          <div class="empty-cart-message">
            <i data-lucide="shopping-cart"></i>
            <p>Your cart is empty</p>
            <a href="/buyer/search-automotive" class="btn-continue-shopping-small">Browse Parts</a>
          </div>
        `;
      }
      
      if (DOM.summarySubtotal) DOM.summarySubtotal.textContent = Utils.formatCurrency(0);
      if (DOM.summaryItemsCount) DOM.summaryItemsCount.textContent = '0 PCS';
      if (DOM.summaryWeight) DOM.summaryWeight.textContent = '0.000 kg';
      if (DOM.summaryTotal) DOM.summaryTotal.textContent = Utils.formatCurrency(0);
      
      if (DOM.btnToStep2) DOM.btnToStep2.disabled = true;
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    updatePaymentAmounts() {
      const fullAmount = State.orderTotal;
      const partialNow = State.orderTotal * 0.2;
      const partialLater = State.orderTotal * 0.8;

      if (DOM.fullAmountEl) DOM.fullAmountEl.textContent = Utils.formatCurrency(fullAmount);
      if (DOM.partialNowEl) DOM.partialNowEl.textContent = Utils.formatCurrency(partialNow);
      if (DOM.partialLaterEl) DOM.partialLaterEl.textContent = Utils.formatCurrency(partialLater);
      if (DOM.partialAmountEl) DOM.partialAmountEl.textContent = Utils.formatCurrency(partialNow);
      
      this.updateTotalWithFees();
    },

    updateTotalWithFees() {
      const baseAmount = State.selectedPaymentType === 'full' ? State.orderTotal : State.orderTotal * 0.2;
      const feeConfig = PAYMENT_FEES[State.selectedPaymentMethod];
      
      let fee = 0;
      if (feeConfig) {
        fee = feeConfig.type === 'percentage' 
          ? (baseAmount * feeConfig.value / 100) + (feeConfig.fixed || 0)
          : feeConfig.value;
      }
      
      const total = baseAmount + fee;

      if (fee > 0) {
        if (DOM.summaryFeeRow) DOM.summaryFeeRow.style.display = 'flex';
        if (DOM.summaryFee) DOM.summaryFee.textContent = Utils.formatCurrency(fee);
      } else {
        if (DOM.summaryFeeRow) DOM.summaryFeeRow.style.display = 'none';
      }

      if (DOM.summaryTotal) DOM.summaryTotal.textContent = Utils.formatCurrency(total);
      if (DOM.confirmFee) DOM.confirmFee.textContent = Utils.formatCurrency(fee);
      if (DOM.confirmTotal) DOM.confirmTotal.textContent = Utils.formatCurrency(total);
    },

    updateConfirmation() {
      if (DOM.confirmType) {
        DOM.confirmType.textContent = State.selectedPaymentType === 'full' 
          ? 'Full Payment' 
          : 'Minimum Payment (20%)';
      }
      
      if (DOM.confirmMethod) {
        DOM.confirmMethod.textContent = PAYMENT_FEES[State.selectedPaymentMethod]?.name || State.selectedPaymentMethod;
      }
      
      this.updateShippingAddressSummary();
      this.updateTotalWithFees();
    },

    updateShippingAddressSummary() {
      if (!DOM.shippingAddressSummary || !State.selectedAddress) return;

      const addr = State.selectedAddress;
      DOM.shippingAddressSummary.innerHTML = `
        <div class="summary-address-name">
          <strong>${Utils.escapeHtml(addr.fullName)}</strong>
          <span class="summary-address-label">${Utils.escapeHtml(addr.label)}</span>
        </div>
        <div class="summary-address-line">${Utils.escapeHtml(addr.phone)}</div>
        <div class="summary-address-line">${Utils.escapeHtml(addr.street)}</div>
        <div class="summary-address-line">${Utils.escapeHtml(addr.city)}, ${Utils.escapeHtml(addr.state)} ${addr.postalCode || ''}</div>
        <div class="summary-address-line">${Utils.escapeHtml(addr.country)}</div>
      `;
    },

    showSuccessModal(orderNum, method, amount) {
      if (DOM.orderNumber) DOM.orderNumber.textContent = orderNum;
      if (DOM.paymentMethodText) DOM.paymentMethodText.textContent = method;
      if (DOM.amountPaid) DOM.amountPaid.textContent = Utils.formatCurrency(amount);

      if (DOM.successModal) {
        DOM.successModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();

      setTimeout(() => {
        window.location.href = '/buyer/orders';
      }, CONFIG.AUTO_REDIRECT_DELAY);
    },
  };

  // ====================================
  // ACTIONS
  // ====================================
  const Actions = {
    selectAddress(addressId) {
      State.selectedAddress = State.addresses.find(a => a._id === addressId);
      
      document.querySelectorAll('.shipping-address-card').forEach(card => {
        const isSelected = card.dataset.addressId === addressId;
        card.classList.toggle('selected', isSelected);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isSelected;
      });

      if (DOM.btnToStep2) {
        DOM.btnToStep2.disabled = !State.selectedAddress || State.cartItems.length === 0;
      }
      
      Renderer.updateShippingAddressSummary();
    },

    goToStep(step) {
      if (step === 2 && !State.selectedAddress) {
        ErrorHandler.showError('Please select a shipping address');
        return;
      }
      
      if (step === 2 && State.cartItems.length === 0) {
        ErrorHandler.showError('Your cart is empty');
        return;
      }

      [DOM.step1, DOM.step2, DOM.step3, DOM.step4].forEach(stepEl => {
        if (stepEl) stepEl.style.display = 'none';
      });

      DOM.stepIndicators.forEach((indicator, index) => {
        indicator.classList.remove('active', 'completed');
        if (index < step - 1) {
          indicator.classList.add('completed');
        } else if (index === step - 1) {
          indicator.classList.add('active');
        }
      });

      const targetStep = document.getElementById(`step-${step}`);
      if (targetStep) {
        targetStep.style.display = 'block';
        Utils.scrollToElement(targetStep);
      }

      State.currentStep = step;

      if (step === 4) {
        Renderer.updateConfirmation();
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    selectPaymentType(type) {
      State.selectedPaymentType = type;
      
      DOM.paymentTypeCards.forEach(card => {
        const isSelected = card.dataset.type === type;
        card.classList.toggle('selected', isSelected);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isSelected;
      });
      
      Renderer.updateTotalWithFees();
    },

    selectPaymentMethod(method) {
      State.selectedPaymentMethod = method;
      
      DOM.paymentMethodCards.forEach(card => {
        const isSelected = card.dataset.method === method;
        card.classList.toggle('selected', isSelected);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isSelected;
      });
      
      Renderer.updateTotalWithFees();
    },

    async completePayment() {
      if (State.isSubmitting) return;
      
      if (!State.selectedAddress) {
        ErrorHandler.showError('Please select a shipping address');
        return;
      }
      
      if (State.cartItems.length === 0) {
        ErrorHandler.showError('Your cart is empty');
        return;
      }
      
      if (DOM.termsCheckbox && !DOM.termsCheckbox.checked) {
        ErrorHandler.showError('Please accept the terms and conditions');
        return;
      }

      State.isSubmitting = true;
      Loader.setButtonLoading(DOM.btnComplete, true);

      const baseAmount = State.selectedPaymentType === 'full' ? State.orderTotal : State.orderTotal * 0.2;
      const feeConfig = PAYMENT_FEES[State.selectedPaymentMethod];
      const fee = feeConfig?.type === 'percentage' 
        ? (baseAmount * feeConfig.value / 100) + (feeConfig.fixed || 0)
        : feeConfig?.value || 0;
      const total = baseAmount + fee;

      try {
        const orderData = {
          items: State.cartItems,
          paymentType: State.selectedPaymentType,
          paymentMethod: State.selectedPaymentMethod,
          fee: fee,
          notes: '',
          shippingAddress: {
            addressId: State.selectedAddress._id,
            label: State.selectedAddress.label,
            fullName: State.selectedAddress.fullName,
            phone: State.selectedAddress.phone,
            street: State.selectedAddress.street,
            city: State.selectedAddress.city,
            state: State.selectedAddress.state,
            country: State.selectedAddress.country,
            postalCode: State.selectedAddress.postalCode || '',
            notes: State.selectedAddress.notes || '',
          },
        };

        // Simple fetch without timeout - let it complete naturally
        const response = await fetch('/buyer/api/orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify(orderData),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to create order');
        }

        // Clear cart
        localStorage.removeItem('partsform_shopping_cart');
        
        // Update cart badge
        if (window.PartsFormCart?.updateBadge) {
          window.PartsFormCart.updateBadge();
        }

        // Show success
        Renderer.showSuccessModal(
          result.order.orderNumber,
          PAYMENT_FEES[State.selectedPaymentMethod]?.name || State.selectedPaymentMethod,
          result.order.total || total
        );

      } catch (error) {
        console.error('[Checkout] Order creation failed:', error);
        ErrorHandler.showError(error.message || 'Failed to create order. Please try again.');
        
        State.isSubmitting = false;
        Loader.setButtonLoading(DOM.btnComplete, false);
      }
    },
  };

  // ====================================
  // EVENT BINDINGS
  // ====================================
  function attachEventListeners() {
    DOM.btnToStep2?.addEventListener('click', () => Actions.goToStep(2));
    DOM.btnToStep1Back?.addEventListener('click', () => Actions.goToStep(1));
    DOM.btnToStep3?.addEventListener('click', () => Actions.goToStep(3));
    DOM.btnToStep2Back?.addEventListener('click', () => Actions.goToStep(2));
    DOM.btnToStep4?.addEventListener('click', () => Actions.goToStep(4));
    DOM.btnToStep3Back?.addEventListener('click', () => Actions.goToStep(3));
    DOM.btnChangeAddress?.addEventListener('click', () => Actions.goToStep(1));

    DOM.paymentTypeCards.forEach(card => {
      card.addEventListener('click', () => Actions.selectPaymentType(card.dataset.type));
    });

    DOM.paymentMethodCards.forEach(card => {
      card.addEventListener('click', () => Actions.selectPaymentMethod(card.dataset.method));
    });

    DOM.termsCheckbox?.addEventListener('change', (e) => {
      if (DOM.btnComplete) DOM.btnComplete.disabled = !e.target.checked;
    });

    DOM.btnComplete?.addEventListener('click', () => Actions.completePayment());

    // Initialize default selections
    const firstTypeCard = DOM.paymentTypeCards[0];
    if (firstTypeCard) {
      firstTypeCard.classList.add('selected');
      const radio = firstTypeCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }

    const firstMethodCard = DOM.paymentMethodCards[0];
    if (firstMethodCard) {
      firstMethodCard.classList.add('selected');
      const radio = firstMethodCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
  }

  // ====================================
  // INITIALIZATION
  // ====================================
  async function initialize() {
    if (State.isInitialized) return;
    
    cacheDOMElements();
    attachEventListeners();
    
    // Load data in parallel
    await Promise.all([
      DataLoader.loadAddresses(),
      DataLoader.loadCart(),
    ]);
    
    Renderer.updatePaymentAmounts();
    
    State.isInitialized = true;
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Expose for debugging
  window.Checkout = { State, Actions, Renderer, DataLoader };

})();

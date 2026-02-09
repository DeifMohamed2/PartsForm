// ====================================
// CHECKOUT PAGE - PROFESSIONAL FUNCTIONALITY
// PARTSFORM Buyer Portal
// Orders are created via backend API - no localStorage for orders
// ====================================

(function () {
  'use strict';

  // Wait for DOM to be ready
  function initializeCheckout() {
    // ====================================
    // DOM ELEMENTS
    // ====================================
    const DOM = {
      // Steps
      steps: document.querySelectorAll('.step-item'),
      step1: document.getElementById('step-1'),
      step2: document.getElementById('step-2'),
      step3: document.getElementById('step-3'),
      step4: document.getElementById('step-4'),

      // Shipping Address Elements
      addressesLoading: document.getElementById('addresses-loading'),
      shippingAddresses: document.getElementById('shipping-addresses'),
      noAddresses: document.getElementById('no-addresses'),
      addAddressSection: document.getElementById('add-address-section'),
      shippingAddressSummary: document.getElementById('shipping-address-summary'),
      btnChangeAddress: document.getElementById('btn-change-address'),

      // Buttons
      btnToStep2: document.getElementById('btn-to-step-2'),
      btnToStep1Back: document.getElementById('btn-to-step-1-back'),
      btnToStep3: document.getElementById('btn-to-step-3'),
      btnToStep2Back: document.getElementById('btn-to-step-2-back'),
      btnToStep4: document.getElementById('btn-to-step-4'),
      btnToStep3Back: document.getElementById('btn-to-step-3-back'),
      btnComplete: document.getElementById('btn-complete-payment'),

      // Payment Type
      paymentTypeCards: document.querySelectorAll('.payment-type-card'),
      paymentTypeRadios: document.querySelectorAll(
        'input[name="payment-type"]'
      ),
      fullAmountEl: document.getElementById('full-amount'),
      partialNowEl: document.getElementById('partial-now'),
      partialLaterEl: document.getElementById('partial-later'),
      partialAmountEl: document.getElementById('partial-amount'),

      // Payment Method
      paymentMethodCards: document.querySelectorAll('.payment-method-card'),
      paymentMethodRadios: document.querySelectorAll(
        'input[name="payment-method"]'
      ),

      // Confirmation
      confirmType: document.getElementById('confirm-type'),
      confirmMethod: document.getElementById('confirm-method'),
      confirmFee: document.getElementById('confirm-fee'),
      confirmTotal: document.getElementById('confirm-total'),
      termsCheckbox: document.getElementById('terms-checkbox'),

      // Summary
      summaryItems: document.getElementById('summary-items'),
      summarySubtotal: document.getElementById('summary-subtotal'),
      summaryItemsCount: document.getElementById('summary-items-count'),
      summaryWeight: document.getElementById('summary-weight'),
      summaryFeeRow: document.getElementById('summary-fee-row'),
      summaryFee: document.getElementById('summary-fee'),
      summaryTotal: document.getElementById('summary-total'),

      // Success Modal
      successModal: document.getElementById('success-modal'),
      orderNumber: document.getElementById('order-number'),
      paymentMethodText: document.getElementById('payment-method-text'),
      amountPaid: document.getElementById('amount-paid'),
      
      // Error display
      errorContainer: document.getElementById('checkout-error'),
    };

    // ====================================
    // STATE
    // ====================================
    let currentStep = 1;
    let cartItems = [];
    let orderTotal = 0;
    let selectedPaymentType = 'full';
    let selectedPaymentMethod = 'card';
    let isSubmitting = false;
    
    // Shipping Address State
    let addresses = [];
    let selectedAddress = null;

    // Payment method fees
    const paymentFees = {
      card: { type: 'percentage', value: 2.9, fixed: 1.5 },
      'bank-dubai': { type: 'fixed', value: 0 },
      'bank-international': { type: 'fixed', value: 35 },
      paypal: { type: 'percentage', value: 3.9, fixed: 1.5 },
      cod: { type: 'fixed', value: 15 },
    };

    const paymentMethodNames = {
      card: 'Credit/Debit Card',
      'bank-dubai': 'Bank Transfer (UAE)',
      'bank-international': 'International Bank Transfer',
      paypal: 'PayPal',
      cod: 'Cash on Delivery',
    };

    // ====================================
    // INITIALIZE
    // ====================================
    function init() {
      loadCartData();
      loadShippingAddresses();
      renderOrderSummary();
      updatePaymentAmounts();
      attachEventListeners();
    }

    // ====================================
    // LOAD SHIPPING ADDRESSES
    // ====================================
    async function loadShippingAddresses() {
      try {
        // Show loading state
        if (DOM.addressesLoading) DOM.addressesLoading.style.display = 'flex';
        if (DOM.shippingAddresses) DOM.shippingAddresses.style.display = 'none';
        if (DOM.noAddresses) DOM.noAddresses.style.display = 'none';
        if (DOM.addAddressSection) DOM.addAddressSection.style.display = 'none';

        const response = await fetch('/buyer/api/addresses');
        const data = await response.json();

        if (DOM.addressesLoading) DOM.addressesLoading.style.display = 'none';

        if (data.success && data.addresses && data.addresses.length > 0) {
          addresses = data.addresses;
          renderShippingAddresses();
          
          // Auto-select default address
          const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
          if (defaultAddress) {
            selectAddress(defaultAddress._id);
          }
        } else {
          // No addresses
          if (DOM.noAddresses) DOM.noAddresses.style.display = 'flex';
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
        if (DOM.addressesLoading) DOM.addressesLoading.style.display = 'none';
        if (DOM.noAddresses) {
          DOM.noAddresses.style.display = 'flex';
          const textEl = DOM.noAddresses.querySelector('.no-addresses-text');
          if (textEl) textEl.textContent = 'Failed to load addresses. Please try again.';
        }
        showError('Failed to load shipping addresses. Please refresh the page.');
      }
    }

    // ====================================
    // RENDER SHIPPING ADDRESSES
    // ====================================
    function renderShippingAddresses() {
      if (!DOM.shippingAddresses) return;

      DOM.shippingAddresses.style.display = 'grid';
      if (DOM.addAddressSection) DOM.addAddressSection.style.display = 'block';

      DOM.shippingAddresses.innerHTML = addresses.map(address => `
        <div class="shipping-address-card ${address.isDefault ? 'default' : ''}" 
             data-address-id="${address._id}">
          <div class="address-radio">
            <input type="radio" name="shipping-address" id="addr-${address._id}" 
                   value="${address._id}" ${address.isDefault ? 'checked' : ''}>
            <label for="addr-${address._id}"></label>
          </div>
          <div class="address-content">
            <div class="address-header">
              <span class="address-label">${escapeHtml(address.label)}</span>
              ${address.isDefault ? '<span class="address-default-badge"><i data-lucide="star"></i> Default</span>' : ''}
            </div>
            <div class="address-details">
              <div class="address-name">
                <i data-lucide="user"></i>
                <strong>${escapeHtml(address.fullName)}</strong>
              </div>
              <div class="address-phone">
                <i data-lucide="phone"></i>
                ${escapeHtml(address.phone)}
              </div>
              <div class="address-location">
                <i data-lucide="map-pin"></i>
                ${escapeHtml(address.street)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)}, ${escapeHtml(address.country)}${address.postalCode ? ' ' + escapeHtml(address.postalCode) : ''}
              </div>
              ${address.notes ? `
              <div class="address-notes">
                <i data-lucide="info"></i>
                ${escapeHtml(address.notes)}
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Add click handlers
      document.querySelectorAll('.shipping-address-card').forEach(card => {
        card.addEventListener('click', () => {
          const addressId = card.dataset.addressId;
          selectAddress(addressId);
        });
      });
    }

    // ====================================
    // SELECT ADDRESS
    // ====================================
    function selectAddress(addressId) {
      selectedAddress = addresses.find(a => a._id === addressId);
      
      // Update UI
      document.querySelectorAll('.shipping-address-card').forEach(card => {
        card.classList.remove('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });

      const selectedCard = document.querySelector(`[data-address-id="${addressId}"]`);
      if (selectedCard) {
        selectedCard.classList.add('selected');
        const radio = selectedCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }

      // Enable/disable continue button
      if (DOM.btnToStep2) {
        DOM.btnToStep2.disabled = !selectedAddress;
      }

      // Update confirmation summary
      updateShippingAddressSummary();
    }

    // ====================================
    // UPDATE SHIPPING ADDRESS SUMMARY
    // ====================================
    function updateShippingAddressSummary() {
      if (!DOM.shippingAddressSummary || !selectedAddress) return;

      DOM.shippingAddressSummary.innerHTML = `
        <div class="summary-address-name">
          <strong>${escapeHtml(selectedAddress.fullName)}</strong>
          <span class="summary-address-label">${escapeHtml(selectedAddress.label)}</span>
        </div>
        <div class="summary-address-line">${escapeHtml(selectedAddress.phone)}</div>
        <div class="summary-address-line">${escapeHtml(selectedAddress.street)}</div>
        <div class="summary-address-line">${escapeHtml(selectedAddress.city)}, ${escapeHtml(selectedAddress.state)} ${selectedAddress.postalCode || ''}</div>
        <div class="summary-address-line">${escapeHtml(selectedAddress.country)}</div>
      `;
    }

    // ====================================
    // ESCAPE HTML
    // ====================================
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ====================================
    // LOAD CART DATA
    // ====================================
    function loadCartData() {
      try {
        // Load cart from localStorage
        const cartData = localStorage.getItem('partsform_shopping_cart');
        if (cartData) {
          const parsed = JSON.parse(cartData);
          cartItems = parsed.items || [];

          // Calculate total - each item is individual (no quantity grouping)
          orderTotal = cartItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            return sum + price;
          }, 0);
        }

        // Redirect if no items
        if (cartItems.length === 0) {
          window.location.href = '/buyer/cart';
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        showError('Failed to load cart data. Redirecting...');
        setTimeout(() => { window.location.href = '/buyer/cart'; }, 2000);
      }
    }

    // ====================================
    // RENDER ORDER SUMMARY
    // ====================================
    function renderOrderSummary() {
      // Render items - each item is individual (no quantity grouping)
      DOM.summaryItems.innerHTML = cartItems
        .map(
          (item) => `
        <div class="summary-item">
          <div class="summary-item-info">
            <div class="summary-item-title">${item.code || item.partNumber || 'N/A'}</div>
            <div class="summary-item-desc">${
              item.description || 'Industrial Part'
            }</div>
            <div class="summary-item-brand">
              <i data-lucide="tag"></i>
              <span>${item.brand || 'N/A'}</span>
            </div>
          </div>
          <div class="summary-item-price">${parseFloat(item.price).toFixed(2)} د.إ</div>
        </div>
      `
        )
        .join('');

      // Update totals - each item counts as 1 (no quantity field)
      const totalItems = cartItems.length;
      const totalWeight = cartItems.reduce(
        (sum, item) => sum + (parseFloat(item.weight) || 0),
        0
      );

      DOM.summarySubtotal.textContent = `${orderTotal.toFixed(2)} د.إ`;
      DOM.summaryItemsCount.textContent = `${totalItems} PCS`;
      DOM.summaryWeight.textContent = `${totalWeight.toFixed(3)} kg`;
      DOM.summaryTotal.textContent = `${orderTotal.toFixed(2)} د.إ`;

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    // ====================================
    // UPDATE PAYMENT AMOUNTS
    // ====================================
    function updatePaymentAmounts() {
      const fullAmount = orderTotal;
      const partialNow = orderTotal * 0.2;
      const partialLater = orderTotal * 0.8;

      DOM.fullAmountEl.textContent = `${fullAmount.toFixed(2)} د.إ`;
      DOM.partialNowEl.textContent = `${partialNow.toFixed(2)} د.إ`;
      DOM.partialLaterEl.textContent = `${partialLater.toFixed(2)} د.إ`;
      DOM.partialAmountEl.textContent = `${partialNow.toFixed(2)} د.إ`;

      updateTotalWithFees();
    }

    // ====================================
    // CALCULATE FEES
    // ====================================
    function calculateFee(method, amount) {
      const feeConfig = paymentFees[method];
      if (!feeConfig) return 0;

      if (feeConfig.type === 'percentage') {
        return (amount * feeConfig.value) / 100 + (feeConfig.fixed || 0);
      } else {
        return feeConfig.value;
      }
    }

    // ====================================
    // UPDATE TOTAL WITH FEES
    // ====================================
    function updateTotalWithFees() {
      const baseAmount =
        selectedPaymentType === 'full' ? orderTotal : orderTotal * 0.2;
      const fee = calculateFee(selectedPaymentMethod, baseAmount);
      const total = baseAmount + fee;

      // Update summary
      if (fee > 0) {
        DOM.summaryFeeRow.style.display = 'flex';
        DOM.summaryFee.textContent = `${fee.toFixed(2)} د.إ`;
      } else {
        DOM.summaryFeeRow.style.display = 'none';
      }

      DOM.summaryTotal.textContent = `${total.toFixed(2)} د.إ`;

      // Update confirmation
      DOM.confirmFee.textContent = `${fee.toFixed(2)} د.إ`;
      DOM.confirmTotal.textContent = `${total.toFixed(2)} د.إ`;
    }

    // ====================================
    // NAVIGATION
    // ====================================
    function goToStep(step) {
      // Hide all steps
      DOM.step1.style.display = 'none';
      DOM.step2.style.display = 'none';
      DOM.step3.style.display = 'none';
      if (DOM.step4) DOM.step4.style.display = 'none';

      // Update step indicators
      DOM.steps.forEach((stepEl, index) => {
        stepEl.classList.remove('active', 'completed');
        if (index < step - 1) {
          stepEl.classList.add('completed');
        } else if (index === step - 1) {
          stepEl.classList.add('active');
        }
      });

      // Show current step
      currentStep = step;
      switch (step) {
        case 1:
          DOM.step1.style.display = 'block';
          break;
        case 2:
          DOM.step2.style.display = 'block';
          break;
        case 3:
          DOM.step3.style.display = 'block';
          updateConfirmation();
          break;
        case 4:
          if (DOM.step4) DOM.step4.style.display = 'block';
          updateConfirmation();
          updateShippingAddressSummary();
          break;
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    // ====================================
    // UPDATE CONFIRMATION
    // ====================================
    function updateConfirmation() {
      DOM.confirmType.textContent =
        selectedPaymentType === 'full'
          ? 'Full Payment'
          : 'Minimum Payment (20%)';
      DOM.confirmMethod.textContent =
        paymentMethodNames[selectedPaymentMethod] || selectedPaymentMethod;
      updateTotalWithFees();
    }

    // ====================================
    // COMPLETE PAYMENT - BACKEND API
    // ====================================
    async function completePayment() {
      // Prevent double submission
      if (isSubmitting) return;
      isSubmitting = true;
      
      // Disable button and show loading state
      if (DOM.btnComplete) {
        DOM.btnComplete.disabled = true;
        DOM.btnComplete.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Processing...';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }

      const baseAmount =
        selectedPaymentType === 'full' ? orderTotal : orderTotal * 0.2;
      const fee = calculateFee(selectedPaymentMethod, baseAmount);
      const total = baseAmount + fee;

      try {
        // Validate shipping address
        if (!selectedAddress) {
          throw new Error('Please select a shipping address');
        }

        // Prepare order data for backend
        const orderData = {
          items: cartItems,
          paymentType: selectedPaymentType,
          paymentMethod: selectedPaymentMethod,
          fee: fee,
          notes: '',
          shippingAddress: {
            addressId: selectedAddress._id,
            label: selectedAddress.label,
            fullName: selectedAddress.fullName,
            phone: selectedAddress.phone,
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            country: selectedAddress.country,
            postalCode: selectedAddress.postalCode || '',
            notes: selectedAddress.notes || ''
          }
        };

        // Call backend API to create order
        const response = await fetch('/buyer/api/orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to create order');
        }

        // Order created successfully - get order number from backend
        const orderNum = result.order.orderNumber;

        // Clear cart from localStorage after successful order
        localStorage.removeItem('partsform_shopping_cart');

        // Update cart badge
        if (window.PartsFormCart && window.PartsFormCart.updateBadge) {
          window.PartsFormCart.updateBadge();
        }

        // Show success modal with real order number
        showSuccessModal(
          orderNum,
          paymentMethodNames[selectedPaymentMethod],
          result.order.total || total
        );

      } catch (error) {
        console.error('Error creating order:', error);
        
        // Re-enable button
        isSubmitting = false;
        if (DOM.btnComplete) {
          DOM.btnComplete.disabled = false;
          DOM.btnComplete.innerHTML = '<i data-lucide="check-circle"></i> Complete Payment';
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        }
        
        // Show error message
        showError(error.message || 'An error occurred while processing your order. Please try again.');
      }
    }

    // ====================================
    // SHOW ERROR MESSAGE
    // ====================================
    function showError(message) {
      // Create or update error container
      let errorEl = document.getElementById('checkout-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'checkout-error';
        errorEl.className = 'checkout-error-message';
        errorEl.style.cssText = `
          background: #fee2e2;
          border: 1px solid #ef4444;
          color: #dc2626;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `;
        const step3 = document.getElementById('step-3');
        if (step3) {
          step3.insertBefore(errorEl, step3.firstChild);
        }
      }
      
      errorEl.innerHTML = `
        <i data-lucide="alert-circle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; cursor: pointer;">
          <i data-lucide="x"></i>
        </button>
      `;
      errorEl.style.display = 'flex';
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    // ====================================
    // SHOW SUCCESS MODAL
    // ====================================
    function showSuccessModal(orderNum, method, amount) {
      DOM.orderNumber.textContent = orderNum;
      DOM.paymentMethodText.textContent = method;
      DOM.amountPaid.textContent = `${amount.toFixed(2)} د.إ`;

      DOM.successModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Redirect to orders page after 3 seconds
      setTimeout(() => {
        window.location.href = '/buyer/orders';
      }, 3000);
    }

    // ====================================
    // EVENT LISTENERS
    // ====================================
    function attachEventListeners() {
      // Navigation buttons - Step 1 (Shipping) to Step 2 (Payment Type)
      if (DOM.btnToStep2) {
        DOM.btnToStep2.addEventListener('click', () => {
          if (selectedAddress) {
            goToStep(2);
          }
        });
      }
      
      // Step 2 back to Step 1
      if (DOM.btnToStep1Back) {
        DOM.btnToStep1Back.addEventListener('click', () => goToStep(1));
      }
      
      // Step 2 (Payment Type) to Step 3 (Payment Method)
      if (DOM.btnToStep3) {
        DOM.btnToStep3.addEventListener('click', () => goToStep(3));
      }
      
      // Step 3 back to Step 2
      if (DOM.btnToStep2Back) {
        DOM.btnToStep2Back.addEventListener('click', () => goToStep(2));
      }
      
      // Step 3 (Payment Method) to Step 4 (Confirmation)
      if (DOM.btnToStep4) {
        DOM.btnToStep4.addEventListener('click', () => goToStep(4));
      }
      
      // Step 4 back to Step 3
      if (DOM.btnToStep3Back) {
        DOM.btnToStep3Back.addEventListener('click', () => goToStep(3));
      }

      // Change address button in confirmation
      if (DOM.btnChangeAddress) {
        DOM.btnChangeAddress.addEventListener('click', () => goToStep(1));
      }

      // Payment type selection
      DOM.paymentTypeCards.forEach((card) => {
        card.addEventListener('click', () => {
          const radio = card.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            selectedPaymentType = radio.value;

            DOM.paymentTypeCards.forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');

            updateTotalWithFees();
          }
        });
      });

      DOM.paymentTypeRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
          selectedPaymentType = e.target.value;
          updateTotalWithFees();
        });
      });

      // Payment method selection
      DOM.paymentMethodCards.forEach((card) => {
        card.addEventListener('click', () => {
          const radio = card.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            selectedPaymentMethod = radio.value;

            DOM.paymentMethodCards.forEach((c) =>
              c.classList.remove('selected')
            );
            card.classList.add('selected');

            updateTotalWithFees();
          }
        });
      });

      DOM.paymentMethodRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
          selectedPaymentMethod = e.target.value;
          updateTotalWithFees();
        });
      });

      // Terms checkbox
      if (DOM.termsCheckbox) {
        DOM.termsCheckbox.addEventListener('change', (e) => {
          DOM.btnComplete.disabled = !e.target.checked;
        });
      }

      // Complete payment
      if (DOM.btnComplete) {
        DOM.btnComplete.addEventListener('click', () => {
          if (DOM.termsCheckbox.checked) {
            completePayment();
          }
        });
      }

      // Initialize first selection
      const firstTypeCard = DOM.paymentTypeCards[0];
      if (firstTypeCard) {
        firstTypeCard.classList.add('selected');
      }

      const firstMethodCard = DOM.paymentMethodCards[0];
      if (firstMethodCard) {
        firstMethodCard.classList.add('selected');
      }
    }

    // ====================================
    // START
    // ====================================
    init();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCheckout);
  } else {
    initializeCheckout();
  }
})();

// ====================================
// CHECKOUT PAGE - SIMPLIFIED & RELIABLE
// PARTSFORM Buyer Portal
// No validation API calls - direct order creation
// ====================================

(function() {
  'use strict';

  // Currency configuration - dynamic based on user preference
  let currentCurrency = 'AED';
  let exchangeRate = 1; // Rate from AED to current currency
  
  const CONFIG = {
    CART_KEY: 'partsform_shopping_cart',
    REDIRECT_DELAY: 3000
  };

  const PAYMENT_FEES = {
    card: { type: 'percentage', value: 2.9, fixed: 1.5, name: 'Credit/Debit Card' },
    'bank-dubai': { type: 'fixed', value: 0, name: 'Bank Transfer (UAE)' },
    'bank-international': { type: 'fixed', value: 35, name: 'International Bank Transfer' },
    paypal: { type: 'percentage', value: 3.9, fixed: 1.5, name: 'PayPal' },
    cod: { type: 'fixed', value: 15, name: 'Cash on Delivery' }
  };

  // State
  let addresses = [];
  let cartItems = [];
  let orderTotal = 0;
  let selectedAddress = null;
  let selectedPaymentType = 'full';
  let selectedPaymentMethod = 'card';
  let isSubmitting = false;

  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    const convertedAmount = parseFloat(amount || 0) * exchangeRate;
    return `${convertedAmount.toFixed(2)} ${currentCurrency}`;
  }
  
  // Initialize currency from user preferences
  function initializeCurrency() {
    // Get user's preferred currency
    if (typeof window.getPreferredCurrency === 'function') {
      const preferred = window.getPreferredCurrency();
      if (preferred && preferred !== 'ORIGINAL') {
        currentCurrency = preferred;
        updateExchangeRate();
      }
    } else if (window.__USER_DATA__ && window.__USER_DATA__.preferredCurrency) {
      const preferred = window.__USER_DATA__.preferredCurrency;
      if (preferred && preferred !== 'ORIGINAL') {
        currentCurrency = preferred;
        updateExchangeRate();
      }
    }
    
    // Listen for currency changes
    window.addEventListener('preferredCurrencyChanged', function(e) {
      if (e.detail && e.detail.currency) {
        currentCurrency = e.detail.currency === 'ORIGINAL' ? 'AED' : e.detail.currency;
        updateExchangeRate();
        renderOrderSummary();
        updatePaymentAmounts();
        updateFeeAndTotal();
      }
    });
  }
  
  // Update exchange rate from base currency (AED) to current currency
  function updateExchangeRate() {
    if (currentCurrency === 'AED') {
      exchangeRate = 1;
      return;
    }
    
    if (typeof window.convertPrice === 'function') {
      // Get rate by converting 1 AED
      const converted = window.convertPrice(1, 'AED', currentCurrency);
      if (converted && converted > 0) {
        exchangeRate = converted;
      }
    }
  }

  function showToast(message, type = 'error') {
    const existing = document.querySelector('.checkout-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `checkout-toast checkout-toast-${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button onclick="this.parentElement.remove()">&times;</button>
    `;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      padding: 16px 20px; border-radius: 8px; display: flex; align-items: center; gap: 12px;
      background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#fef3c7'};
      color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#ca8a04'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500;
    `;
    toast.querySelector('button').style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;color:inherit;';
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  // ====================================
  // DATA LOADING
  // ====================================
  function loadCartFromStorage() {
    try {
      const data = localStorage.getItem(CONFIG.CART_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (e) {
      console.error('Error loading cart:', e);
      return [];
    }
  }

  async function loadAddresses() {
    const skeleton = document.getElementById('address-skeleton');
    const container = document.getElementById('shipping-addresses');
    const noAddresses = document.getElementById('no-addresses');
    const addSection = document.getElementById('add-address-section');

    try {
      const response = await fetch('/buyer/api/addresses', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to load addresses');
      
      const data = await response.json();
      addresses = data.success && Array.isArray(data.addresses) ? data.addresses : [];

      if (skeleton) skeleton.style.display = 'none';

      if (addresses.length === 0) {
        if (noAddresses) noAddresses.style.display = 'flex';
        if (container) container.style.display = 'none';
        if (addSection) addSection.style.display = 'none';
        return;
      }

      renderAddresses();
      
      // Auto-select default or first address
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddr) selectAddress(defaultAddr._id);

    } catch (error) {
      console.error('Error loading addresses:', error);
      if (skeleton) skeleton.style.display = 'none';
      if (noAddresses) {
        noAddresses.style.display = 'flex';
        const textEl = noAddresses.querySelector('.no-addresses-text');
        if (textEl) textEl.textContent = 'Failed to load addresses. Please refresh.';
      }
    }
  }

  // ====================================
  // RENDERING
  // ====================================
  function renderAddresses() {
    const container = document.getElementById('shipping-addresses');
    const addSection = document.getElementById('add-address-section');
    
    if (!container) return;
    
    container.style.display = 'grid';
    if (addSection) addSection.style.display = 'block';

    container.innerHTML = addresses.map(addr => `
      <div class="shipping-address-card ${addr.isDefault ? 'default' : ''}" 
           data-id="${addr._id}" onclick="window.CheckoutPage.selectAddress('${addr._id}')">
        <div class="address-radio">
          <input type="radio" name="shipping-address" id="addr-${addr._id}" value="${addr._id}">
          <label for="addr-${addr._id}"><span class="radio-check"></span></label>
        </div>
        <div class="address-content">
          <div class="address-header">
            <span class="address-label">${escapeHtml(addr.label)}</span>
            ${addr.isDefault ? '<span class="address-default-badge"><i data-lucide="star"></i> Default</span>' : ''}
          </div>
          <div class="address-details">
            <div class="address-row"><i data-lucide="user"></i><strong>${escapeHtml(addr.fullName)}</strong></div>
            <div class="address-row"><i data-lucide="phone"></i><span>${escapeHtml(addr.phone)}</span></div>
            <div class="address-row"><i data-lucide="map-pin"></i><span>${escapeHtml(addr.street)}, ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)}, ${escapeHtml(addr.country)}${addr.postalCode ? ' ' + escapeHtml(addr.postalCode) : ''}</span></div>
          </div>
        </div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderOrderSummary() {
    const itemsContainer = document.getElementById('summary-items');
    const skeleton = document.getElementById('summary-skeleton');
    const content = document.getElementById('summary-content');

    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'block';

    if (!itemsContainer) return;

    if (cartItems.length === 0) {
      itemsContainer.innerHTML = `
        <div class="empty-cart-message" style="text-align:center;padding:20px;">
          <p>Your cart is empty</p>
          <a href="/buyer/search-automotive" class="btn-continue-shopping-small">Browse Parts</a>
        </div>
      `;
      const btnNext = document.getElementById('btn-to-step-2');
      if (btnNext) btnNext.disabled = true;
      return;
    }

    itemsContainer.innerHTML = cartItems.map(item => `
      <div class="summary-item">
        <div class="summary-item-info">
          <div class="summary-item-title">${escapeHtml(item.code || item.partNumber || 'N/A')}</div>
          <div class="summary-item-desc">${escapeHtml(item.description || 'Industrial Part')}</div>
          <div class="summary-item-brand"><i data-lucide="tag"></i><span>${escapeHtml(item.brand || 'N/A')}</span></div>
        </div>
        <div class="summary-item-price">${formatCurrency(item.price)}</div>
      </div>
    `).join('');

    // Update totals
    const totalWeight = cartItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
    
    const subtotalEl = document.getElementById('summary-subtotal');
    const itemsCountEl = document.getElementById('summary-items-count');
    const weightEl = document.getElementById('summary-weight');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(orderTotal);
    if (itemsCountEl) itemsCountEl.textContent = `${cartItems.length} PCS`;
    if (weightEl) weightEl.textContent = `${totalWeight.toFixed(3)} kg`;

    updateFeeAndTotal();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function updateFeeAndTotal() {
    const baseAmount = selectedPaymentType === 'full' ? orderTotal : orderTotal * 0.2;
    const feeConfig = PAYMENT_FEES[selectedPaymentMethod];
    
    let fee = 0;
    if (feeConfig) {
      fee = feeConfig.type === 'percentage' 
        ? (baseAmount * feeConfig.value / 100) + (feeConfig.fixed || 0)
        : feeConfig.value;
    }
    
    const total = baseAmount + fee;

    // Summary panel
    const feeRow = document.getElementById('summary-fee-row');
    const feeEl = document.getElementById('summary-fee');
    const totalEl = document.getElementById('summary-total');

    if (fee > 0) {
      if (feeRow) feeRow.style.display = 'flex';
      if (feeEl) feeEl.textContent = formatCurrency(fee);
    } else {
      if (feeRow) feeRow.style.display = 'none';
    }
    if (totalEl) totalEl.textContent = formatCurrency(total);

    // Confirmation panel
    const confirmFee = document.getElementById('confirm-fee');
    const confirmTotal = document.getElementById('confirm-total');
    if (confirmFee) confirmFee.textContent = formatCurrency(fee);
    if (confirmTotal) confirmTotal.textContent = formatCurrency(total);
  }

  function updatePaymentAmounts() {
    const fullEl = document.getElementById('full-amount');
    const partialNowEl = document.getElementById('partial-now');
    const partialLaterEl = document.getElementById('partial-later');
    const partialAmountEl = document.getElementById('partial-amount');

    if (fullEl) fullEl.textContent = formatCurrency(orderTotal);
    if (partialNowEl) partialNowEl.textContent = formatCurrency(orderTotal * 0.2);
    if (partialLaterEl) partialLaterEl.textContent = formatCurrency(orderTotal * 0.8);
    if (partialAmountEl) partialAmountEl.textContent = formatCurrency(orderTotal * 0.2);
  }

  function updateConfirmation() {
    const confirmType = document.getElementById('confirm-type');
    const confirmMethod = document.getElementById('confirm-method');
    const addressSummary = document.getElementById('shipping-address-summary');

    if (confirmType) {
      confirmType.textContent = selectedPaymentType === 'full' ? 'Full Payment' : 'Minimum Payment (20%)';
    }
    if (confirmMethod) {
      confirmMethod.textContent = PAYMENT_FEES[selectedPaymentMethod]?.name || selectedPaymentMethod;
    }

    if (addressSummary && selectedAddress) {
      addressSummary.innerHTML = `
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

    updateFeeAndTotal();
  }

  // ====================================
  // ACTIONS
  // ====================================
  function selectAddress(addressId) {
    selectedAddress = addresses.find(a => a._id === addressId);
    
    document.querySelectorAll('.shipping-address-card').forEach(card => {
      const isSelected = card.dataset.id === addressId;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    const btnNext = document.getElementById('btn-to-step-2');
    if (btnNext) btnNext.disabled = !selectedAddress || cartItems.length === 0;
  }

  function goToStep(step) {
    if (step === 2 && (!selectedAddress || cartItems.length === 0)) {
      showToast('Please select a shipping address and ensure cart is not empty');
      return;
    }

    // Hide all steps
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      if (stepEl) stepEl.style.display = 'none';
    }

    // Update step indicators
    document.querySelectorAll('.step-item').forEach((indicator, index) => {
      indicator.classList.remove('active', 'completed');
      if (index < step - 1) indicator.classList.add('completed');
      else if (index === step - 1) indicator.classList.add('active');
    });

    // Show target step
    const targetStep = document.getElementById(`step-${step}`);
    if (targetStep) {
      targetStep.style.display = 'block';
      targetStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (step === 4) updateConfirmation();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function selectPaymentType(type) {
    selectedPaymentType = type;
    
    document.querySelectorAll('.payment-type-card').forEach(card => {
      const isSelected = card.dataset.type === type;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    updateFeeAndTotal();
  }

  function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-method-card').forEach(card => {
      const isSelected = card.dataset.method === method;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    updateFeeAndTotal();
  }

  async function completePayment() {
    if (isSubmitting) return;
    
    if (!selectedAddress) {
      showToast('Please select a shipping address');
      return;
    }
    
    if (cartItems.length === 0) {
      showToast('Your cart is empty');
      return;
    }

    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox && !termsCheckbox.checked) {
      showToast('Please accept the terms and conditions');
      return;
    }

    isSubmitting = true;
    const btnComplete = document.getElementById('btn-complete-payment');
    
    if (btnComplete) {
      btnComplete.disabled = true;
      btnComplete.innerHTML = `
        <svg class="spinner" style="width:20px;height:20px;animation:spin 1s linear infinite;" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <span>Processing...</span>
      `;
    }

    // Calculate fee
    const baseAmount = selectedPaymentType === 'full' ? orderTotal : orderTotal * 0.2;
    const feeConfig = PAYMENT_FEES[selectedPaymentMethod];
    const fee = feeConfig?.type === 'percentage' 
      ? (baseAmount * feeConfig.value / 100) + (feeConfig.fixed || 0)
      : feeConfig?.value || 0;

    try {
      const orderData = {
        items: cartItems.map(item => ({
          _id: item._id || null,
          code: item.code || item.partNumber,
          partNumber: item.code || item.partNumber,
          brand: item.brand,
          description: item.description,
          supplier: item.supplier,
          price: item.price,
          weight: item.weight,
          stock: item.stock,
          currency: item.currency || 'AED'
        })),
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

      console.log('[Checkout] Creating order with', cartItems.length, 'items');

      const response = await fetch('/buyer/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(orderData)
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Checkout] Non-JSON response:', text.substring(0, 200));
        throw new Error('Server error. Please try again later.');
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create order');
      }

      // Success! Clear cart
      localStorage.removeItem(CONFIG.CART_KEY);
      
      // Update cart badge
      if (window.PartsFormCart?.updateBadge) {
        window.PartsFormCart.updateBadge();
      }

      // Show success modal
      showSuccessModal(
        result.order.orderNumber,
        PAYMENT_FEES[selectedPaymentMethod]?.name || selectedPaymentMethod,
        result.order.total || (baseAmount + fee)
      );

    } catch (error) {
      console.error('[Checkout] Order creation failed:', error);
      showToast(error.message || 'Failed to create order. Please try again.');
      
      isSubmitting = false;
      if (btnComplete) {
        btnComplete.disabled = false;
        btnComplete.innerHTML = `<i data-lucide="lock"></i><span>Complete Payment</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }

  function showSuccessModal(orderNum, method, amount) {
    const modal = document.getElementById('success-modal');
    const orderNumberEl = document.getElementById('order-number');
    const methodEl = document.getElementById('payment-method-text');
    const amountEl = document.getElementById('amount-paid');

    if (orderNumberEl) orderNumberEl.textContent = orderNum;
    if (methodEl) methodEl.textContent = method;
    if (amountEl) amountEl.textContent = formatCurrency(amount);

    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
      window.location.href = '/buyer/orders';
    }, CONFIG.REDIRECT_DELAY);
  }

  // ====================================
  // EVENT BINDING
  // ====================================
  function bindEvents() {
    // Step navigation
    document.getElementById('btn-to-step-2')?.addEventListener('click', () => goToStep(2));
    document.getElementById('btn-to-step-1-back')?.addEventListener('click', () => goToStep(1));
    document.getElementById('btn-to-step-3')?.addEventListener('click', () => goToStep(3));
    document.getElementById('btn-to-step-2-back')?.addEventListener('click', () => goToStep(2));
    document.getElementById('btn-to-step-4')?.addEventListener('click', () => goToStep(4));
    document.getElementById('btn-to-step-3-back')?.addEventListener('click', () => goToStep(3));
    document.getElementById('btn-change-address')?.addEventListener('click', () => goToStep(1));

    // Payment type selection
    document.querySelectorAll('.payment-type-card').forEach(card => {
      card.addEventListener('click', () => selectPaymentType(card.dataset.type));
    });

    // Payment method selection
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.addEventListener('click', () => selectPaymentMethod(card.dataset.method));
    });

    // Terms checkbox
    const termsCheckbox = document.getElementById('terms-checkbox');
    const btnComplete = document.getElementById('btn-complete-payment');
    if (termsCheckbox && btnComplete) {
      termsCheckbox.addEventListener('change', (e) => {
        btnComplete.disabled = !e.target.checked;
      });
    }

    // Complete payment button
    btnComplete?.addEventListener('click', completePayment);

    // Initialize default selections
    const firstTypeCard = document.querySelector('.payment-type-card');
    if (firstTypeCard) {
      firstTypeCard.classList.add('selected');
      const radio = firstTypeCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }

    const firstMethodCard = document.querySelector('.payment-method-card');
    if (firstMethodCard) {
      firstMethodCard.classList.add('selected');
      const radio = firstMethodCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
  }

  // ====================================
  // INITIALIZATION
  // ====================================
  async function init() {
    console.log('[Checkout] Initializing...');
    
    // Initialize currency first
    initializeCurrency();
    
    // Load cart from localStorage (no API call)
    cartItems = loadCartFromStorage();
    orderTotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    
    console.log('[Checkout] Loaded', cartItems.length, 'items from cart, total:', orderTotal);

    // Render order summary immediately
    renderOrderSummary();
    updatePaymentAmounts();

    // Bind events
    bindEvents();

    // Load addresses from API
    await loadAddresses();

    console.log('[Checkout] Ready');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Add spinner animation style
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);

  // Expose for external use
  window.CheckoutPage = {
    selectAddress,
    goToStep,
    selectPaymentType,
    selectPaymentMethod,
    completePayment
  };

})();

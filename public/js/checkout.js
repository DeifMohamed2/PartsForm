// ====================================
// CHECKOUT PAGE - PROFESSIONAL FUNCTIONALITY
// PARTSFORM Buyer Portal
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

      // Buttons
      btnToStep2: document.getElementById('btn-to-step-2'),
      btnToStep1: document.getElementById('btn-to-step-1'),
      btnToStep3: document.getElementById('btn-to-step-3'),
      btnToStep2Back: document.getElementById('btn-to-step-2-back'),
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
    };

    // ====================================
    // STATE
    // ====================================
    let currentStep = 1;
    let cartItems = [];
    let orderTotal = 0;
    let selectedPaymentType = 'full';
    let selectedPaymentMethod = 'card';
    let isAOGCase = false;
    let aogCaseId = null;

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
      renderOrderSummary();
      updatePaymentAmounts();
      attachEventListeners();
      
      // Show AOG badge if this is an AOG case
      if (isAOGCase) {
        const aogBadge = document.getElementById('aog-badge');
        const secureBadge = document.getElementById('secure-badge');
        const subtitle = document.getElementById('checkout-subtitle');
        
        if (aogBadge) aogBadge.style.display = 'flex';
        if (secureBadge) secureBadge.style.display = 'none';
        if (subtitle) subtitle.textContent = 'Priority AOG case - Complete payment to activate sourcing';
      }
    }

    // ====================================
    // LOAD CART DATA
    // ====================================
    function loadCartData() {
      try {
        // Check if this is an AOG case
        isAOGCase = sessionStorage.getItem('is-aog-case') === 'true';

        if (isAOGCase) {
          // Load AOG parts from sessionStorage
          const aogPartsData = sessionStorage.getItem('aog-parts');
          if (aogPartsData) {
            const aogParts = JSON.parse(aogPartsData);
            
            // Convert AOG parts to cart format
            cartItems = aogParts.map(part => ({
              partNumber: part.vendorCode,
              description: part.description,
              quantity: part.quantity,
              price: part.total / part.quantity,
              weight: parseFloat(part.weight) || 0,
              supplier: part.supplier,
              brand: part.brand,
              origin: part.origin,
              delivery: part.delivery,
            }));

            // Get total from sessionStorage
            orderTotal = parseFloat(sessionStorage.getItem('aog-total')) || 0;
          }
        } else {
          // Load regular cart
          const cartData = localStorage.getItem('partsform_shopping_cart');
          if (cartData) {
            const parsed = JSON.parse(cartData);
            cartItems = parsed.items || [];

            // Calculate total
            orderTotal = cartItems.reduce((sum, item) => {
              const qty = parseInt(item.quantity) || 0;
              const price = parseFloat(item.price) || 0;
              return sum + qty * price;
            }, 0);
          }
        }

        // Redirect if no items
        if (cartItems.length === 0) {
          window.location.href = isAOGCase ? '/buyer/search-aviation' : '/buyer/cart';
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        window.location.href = '/buyer/cart';
      }
    }

    // ====================================
    // RENDER ORDER SUMMARY
    // ====================================
    function renderOrderSummary() {
      // Render items
      DOM.summaryItems.innerHTML = cartItems
        .map(
          (item) => `
        <div class="summary-item">
          <div class="summary-item-info">
            <div class="summary-item-title">${item.partNumber || 'N/A'}</div>
            <div class="summary-item-desc">${
              item.description || 'Industrial Part'
            }</div>
            <div class="summary-item-qty">
              <i data-lucide="package"></i>
              <span>Qty: ${item.quantity}</span>
            </div>
          </div>
          <div class="summary-item-price">${(
            parseFloat(item.price) * parseInt(item.quantity)
          ).toFixed(2)} د.إ</div>
        </div>
      `
        )
        .join('');

      // Update totals
      const totalItems = cartItems.reduce(
        (sum, item) => sum + parseInt(item.quantity),
        0
      );
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
          updateConfirmation();
          break;
        case 3:
          DOM.step3.style.display = 'block';
          updateConfirmation();
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
    // COMPLETE PAYMENT
    // ====================================
    function completePayment() {
      const baseAmount =
        selectedPaymentType === 'full' ? orderTotal : orderTotal * 0.2;
      const fee = calculateFee(selectedPaymentMethod, baseAmount);
      const total = baseAmount + fee;

      // Generate order/case number
      const orderNum = isAOGCase ? 'AOG-' + Date.now() : 'ORD-' + Date.now().toString().slice(-6);

      // Save order to localStorage
      try {
        const orders = JSON.parse(
          localStorage.getItem('partsform_orders') || '[]'
        );
        
        // Prepare items preview (first 3 item names)
        const itemsPreview = cartItems
          .slice(0, 3)
          .map(item => item.description || item.partNumber || item.code || 'Part');
        
        // Calculate total items count
        const itemsCount = cartItems.reduce(
          (sum, item) => sum + (parseInt(item.quantity) || 1),
          0
        );
        
        const order = {
          orderNumber: orderNum,
          date: new Date().toISOString(),
          items: cartItems,
          itemsCount: itemsCount,
          itemsPreview: itemsPreview,
          paymentType: selectedPaymentType,
          paymentMethod: selectedPaymentMethod,
          subtotal: orderTotal,
          fee: fee,
          amount: total,
          total: total,
          status: 'pending',
          paymentStatus: selectedPaymentType === 'full' ? 'paid' : 'partial',
          amountPaid: total,
          amountDue: selectedPaymentType === 'full' ? 0 : orderTotal * 0.8,
          isAOG: isAOGCase,
        };

        orders.unshift(order);
        localStorage.setItem('partsform_orders', JSON.stringify(orders));

        // If AOG case, create the case data
        if (isAOGCase) {
          aogCaseId = orderNum;
          
          // Load case info from sessionStorage
          const caseInfoData = sessionStorage.getItem('aog-case-info');
          const caseInfo = caseInfoData ? JSON.parse(caseInfoData) : {};
          
          const caseData = {
            caseId: orderNum,
            caseType: caseInfo.caseType || 'aog',
            aircraftType: caseInfo.aircraftType || 'N/A',
            tailNumber: caseInfo.tailNumber || 'N/A',
            station: caseInfo.station || 'N/A',
            requiredBy: caseInfo.requiredBy || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            notes: caseInfo.notes || '',
            parts: cartItems,
            createdAt: new Date().toISOString(),
            paymentCompleted: true,
            orderNumber: orderNum,
            status: 'sourcing',
          };
          localStorage.setItem(`aog-case-${orderNum}`, JSON.stringify(caseData));
          
          // Clear AOG session data
          sessionStorage.removeItem('aog-parts');
          sessionStorage.removeItem('is-aog-case');
          sessionStorage.removeItem('aog-total');
          sessionStorage.removeItem('aog-case-info');
          sessionStorage.removeItem('aog-selected-parts');
          sessionStorage.removeItem('aog-parts-total');
        } else {
          // Clear regular cart
          localStorage.removeItem('partsform_shopping_cart');
        }

        // Update cart badge
        if (window.PartsFormCart && window.PartsFormCart.updateBadge) {
          window.PartsFormCart.updateBadge();
        }

        // Show success modal
        showSuccessModal(
          orderNum,
          paymentMethodNames[selectedPaymentMethod],
          total
        );
      } catch (error) {
        console.error('Error saving order:', error);
        alert(
          'An error occurred while processing your order. Please try again.'
        );
      }
    }

    // ====================================
    // SHOW SUCCESS MODAL
    // ====================================
    function showSuccessModal(orderNum, method, amount) {
      DOM.orderNumber.textContent = orderNum;
      DOM.paymentMethodText.textContent = method;
      DOM.amountPaid.textContent = `${amount.toFixed(2)} د.إ`;

      // Update title and message for AOG cases
      const successTitle = document.getElementById('success-title');
      const successMessage = document.getElementById('success-message');
      
      if (isAOGCase) {
        if (successTitle) successTitle.textContent = 'AOG Case Activated!';
        if (successMessage) successMessage.textContent = 'Payment confirmed. Redirecting to Command Center...';
      }

      DOM.successModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Reinitialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Redirect after 3 seconds
      setTimeout(() => {
        if (isAOGCase && aogCaseId) {
          // Redirect to AOG Command Center
          window.location.href = `/buyer/aog/command-center/${aogCaseId}`;
        } else {
          // Redirect to orders page
          window.location.href = '/buyer/orders';
        }
      }, 3000);
    }

    // ====================================
    // EVENT LISTENERS
    // ====================================
    function attachEventListeners() {
      // Navigation buttons
      if (DOM.btnToStep2) {
        DOM.btnToStep2.addEventListener('click', () => goToStep(2));
      }
      if (DOM.btnToStep1) {
        DOM.btnToStep1.addEventListener('click', () => goToStep(1));
      }
      if (DOM.btnToStep3) {
        DOM.btnToStep3.addEventListener('click', () => goToStep(3));
      }
      if (DOM.btnToStep2Back) {
        DOM.btnToStep2Back.addEventListener('click', () => goToStep(2));
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

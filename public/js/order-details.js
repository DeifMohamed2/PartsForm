// ====================================
// ORDER DETAILS PAGE FUNCTIONALITY
// Loads and displays order details from Backend API
// ====================================

(function () {
  'use strict';

  // Currency configuration
  let currentCurrency = 'AED';
  let exchangeRate = 1;

  let currentOrder = null;
  let isLoading = false;

  // Currency helpers
  function initializeCurrency() {
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
    
    window.addEventListener('preferredCurrencyChanged', function(e) {
      if (e.detail && e.detail.currency) {
        currentCurrency = e.detail.currency === 'ORIGINAL' ? 'AED' : e.detail.currency;
        updateExchangeRate();
        if (currentOrder) {
          renderOrderDetails(currentOrder);
        }
      }
    });
  }
  
  function updateExchangeRate() {
    if (currentCurrency === 'AED') {
      exchangeRate = 1;
      return;
    }
    if (typeof window.convertPrice === 'function') {
      const converted = window.convertPrice(1, 'AED', currentCurrency);
      if (converted && converted > 0) {
        exchangeRate = converted;
      }
    }
  }
  
  function formatAmount(amount) {
    const converted = parseFloat(amount || 0) * exchangeRate;
    return `${converted.toFixed(2)} ${currentCurrency}`;
  }

  // Initialize
  function init() {
    initializeCurrency();
    const orderNumber = getOrderNumberFromURL();
    if (orderNumber) {
      loadOrderDetails(orderNumber);
    } else {
      showError('Order number not found in URL');
    }

    initEventListeners();
  }

  // ====================================
  // GET ORDER NUMBER FROM URL
  // ====================================
  function getOrderNumberFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/buyer\/orders\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // ====================================
  // LOAD ORDER DETAILS FROM BACKEND
  // ====================================
  async function loadOrderDetails(orderNumber) {
    if (isLoading) return;
    isLoading = true;

    // Show loading state
    const loadingEl = document.getElementById('order-loading');
    const contentEl = document.getElementById('order-content');
    const errorEl = document.getElementById('order-error');

    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    try {
      const response = await fetch(`/buyer/api/orders/${encodeURIComponent(orderNumber)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order not found');
        }
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();

      if (data.success && data.order) {
        currentOrder = data.order;
        renderOrderDetails(currentOrder);
      } else {
        throw new Error(data.message || 'Failed to load order details');
      }

    } catch (error) {
      console.error('Error loading order:', error);
      showError(error.message || 'Failed to load order details');
    } finally {
      isLoading = false;
    }
  }

  // ====================================
  // RENDER ORDER DETAILS
  // ====================================
  function renderOrderDetails(order) {
    // Hide loading, show content
    const loadingEl = document.getElementById('order-loading');
    const contentEl = document.getElementById('order-content');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    // Update title and status
    const titleEl = document.getElementById('order-details-title');
    if (titleEl) titleEl.textContent = `Order ${order.orderNumber}`;
    
    updateStatusBadge(order.status);

    // Render items
    renderOrderItems(order.items || []);

    // Render payment info
    renderPaymentInfo(order);

    // Render summary
    renderOrderSummary(order);

    // Render timeline
    renderOrderTimeline(order);

    // Render shipping info
    renderShippingInfo(order);

    // Show/hide action buttons based on status
    updateActionButtons(order);

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // UPDATE STATUS BADGE
  // ====================================
  function updateStatusBadge(status) {
    const badge = document.getElementById('order-status-badge');
    if (!badge) return;
    
    badge.className = `order-details-status-badge ${status}`;

    const icon = getStatusIcon(status);
    badge.innerHTML = `<i data-lucide="${icon}"></i><span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
  }

  function getStatusIcon(status) {
    const icons = {
      pending: 'clock',
      processing: 'loader',
      shipped: 'truck',
      delivered: 'check-circle',
      completed: 'check-circle',
      cancelled: 'x-circle'
    };
    return icons[status] || 'package';
  }

  // ====================================
  // RENDER ORDER ITEMS
  // ====================================
  function renderOrderItems(items) {
    const tbody = document.getElementById('order-items-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    // Each item is individual - no quantity grouping
    items.forEach(item => {
      const price = parseFloat(item.price) || 0;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="order-item-part">${item.partNumber || 'N/A'}</div>
          <div class="order-item-desc">${item.description || ''}</div>
          ${item.brand && item.brand !== 'N/A' ? `<div class="order-item-brand">Brand: ${item.brand}</div>` : ''}
          ${item.supplier ? `<div class="order-item-supplier">Supplier: ${item.supplier}</div>` : ''}
        </td>
        <td style="text-align: center;" class="order-item-weight">${(parseFloat(item.weight) || 0).toFixed(3)} kg</td>
        <td style="text-align: center;" class="order-item-stock">${item.stock || 'N/A'}</td>
        <td style="text-align: right;" class="order-item-price">${formatAmount(price)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // ====================================
  // RENDER PAYMENT INFO
  // ====================================
  function renderPaymentInfo(order) {
    const grid = document.getElementById('payment-info-grid');
    if (!grid) return;
    
    const payment = order.payment || {};
    
    const paymentTypeNames = {
      full: 'Full Payment',
      partial: 'Partial Payment (20%)'
    };

    const paymentMethodNames = {
      card: 'Credit/Debit Card',
      'bank-dubai': 'Bank Transfer (UAE)',
      'bank-international': 'International Bank Transfer',
      paypal: 'PayPal',
      cod: 'Cash on Delivery'
    };

    const paymentStatusDisplay = {
      pending: 'Pending',
      paid: 'Paid',
      partial: 'Partial Payment',
      failed: 'Failed',
      refunded: 'Refunded'
    };

    grid.innerHTML = `
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Type</div>
        <div class="payment-info-value">${paymentTypeNames[payment.type] || payment.type || 'N/A'}</div>
      </div>
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Method</div>
        <div class="payment-info-value">${paymentMethodNames[payment.method] || payment.method || 'N/A'}</div>
      </div>
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Status</div>
        <div class="payment-info-value">${paymentStatusDisplay[payment.status] || payment.status || 'N/A'}</div>
      </div>
      ${payment.amountDue > 0 ? `
      <div class="payment-info-item">
        <div class="payment-info-label">Amount Due</div>
        <div class="payment-info-value">${formatAmount(payment.amountDue)}</div>
      </div>
      ` : ''}
      ${payment.amountPaid > 0 ? `
      <div class="payment-info-item">
        <div class="payment-info-label">Amount Paid</div>
        <div class="payment-info-value">${formatAmount(payment.amountPaid)}</div>
      </div>
      ` : ''}
    `;
  }

  // ====================================
  // RENDER SHIPPING INFO
  // ====================================
  function renderShippingInfo(order) {
    const container = document.getElementById('shipping-info-grid');
    if (!container) return;
    
    const shipping = order.shipping || {};

    container.innerHTML = `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Name</div>
        <div class="shipping-info-value">${shipping.firstName || ''} ${shipping.lastName || ''}</div>
      </div>
      ${shipping.companyName ? `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Company</div>
        <div class="shipping-info-value">${shipping.companyName}</div>
      </div>
      ` : ''}
      ${shipping.address ? `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Address</div>
        <div class="shipping-info-value">${shipping.address}</div>
      </div>
      ` : ''}
      <div class="shipping-info-item">
        <div class="shipping-info-label">City / Country</div>
        <div class="shipping-info-value">${shipping.city || ''}, ${shipping.country || ''}</div>
      </div>
      ${shipping.phone ? `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Phone</div>
        <div class="shipping-info-value">${shipping.phone}</div>
      </div>
      ` : ''}
      ${shipping.email ? `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Email</div>
        <div class="shipping-info-value">${shipping.email}</div>
      </div>
      ` : ''}
      ${shipping.trackingNumber ? `
      <div class="shipping-info-item">
        <div class="shipping-info-label">Tracking Number</div>
        <div class="shipping-info-value">${shipping.trackingNumber}</div>
      </div>
      ` : ''}
    `;
  }

  // ====================================
  // RENDER ORDER SUMMARY
  // ====================================
  function renderOrderSummary(order) {
    const summary = document.getElementById('order-summary-content');
    if (!summary) return;
    
    const pricing = order.pricing || {};
    const subtotal = pricing.subtotal || 0;
    const fee = pricing.processingFee || 0;
    const shipping = pricing.shipping || 0;
    const tax = pricing.tax || 0;
    const discount = pricing.discount || 0;
    const total = pricing.total || subtotal + fee;
    const itemsCount = order.totalItems || 0;
    const totalWeight = order.totalWeight || 0;

    summary.innerHTML = `
      <div class="order-summary-row">
        <span class="order-summary-label">Items</span>
        <span class="order-summary-value">${itemsCount} pcs</span>
      </div>
      ${totalWeight > 0 ? `
      <div class="order-summary-row">
        <span class="order-summary-label">Total Weight</span>
        <span class="order-summary-value">${totalWeight.toFixed(3)} kg</span>
      </div>
      ` : ''}
      <div class="order-summary-row">
        <span class="order-summary-label">Subtotal</span>
        <span class="order-summary-value">${formatAmount(subtotal)}</span>
      </div>
      ${fee > 0 ? `
      <div class="order-summary-row">
        <span class="order-summary-label">Processing Fee</span>
        <span class="order-summary-value">${formatAmount(fee)}</span>
      </div>
      ` : ''}
      ${shipping > 0 ? `
      <div class="order-summary-row">
        <span class="order-summary-label">Shipping</span>
        <span class="order-summary-value">${formatAmount(shipping)}</span>
      </div>
      ` : ''}
      ${tax > 0 ? `
      <div class="order-summary-row">
        <span class="order-summary-label">Tax</span>
        <span class="order-summary-value">${formatAmount(tax)}</span>
      </div>
      ` : ''}
      ${discount > 0 ? `
      <div class="order-summary-row discount">
        <span class="order-summary-label">Discount</span>
        <span class="order-summary-value">-${formatAmount(discount)}</span>
      </div>
      ` : ''}
      <div class="order-summary-row total">
        <span class="order-summary-label">Total</span>
        <span class="order-summary-value">${formatAmount(total)}</span>
      </div>
      <div class="order-summary-row">
        <span class="order-summary-label">Order Date</span>
        <span class="order-summary-value">${formatDate(order.createdAt)}</span>
      </div>
    `;
  }

  // ====================================
  // RENDER ORDER TIMELINE
  // ====================================
  function renderOrderTimeline(order) {
    const timeline = document.getElementById('order-timeline');
    if (!timeline) return;
    
    // If order has timeline data from backend, use it
    if (order.timeline && order.timeline.length > 0) {
      let html = '';
      order.timeline.forEach((event, index) => {
        const isLatest = index === order.timeline.length - 1;
        html += `
          <div class="timeline-item ${isLatest ? 'active' : 'completed'}">
            <div class="timeline-item-title">${event.status.charAt(0).toUpperCase() + event.status.slice(1)}</div>
            <div class="timeline-item-date">${formatDate(event.timestamp)}</div>
            <div class="timeline-item-desc">${event.message}</div>
          </div>
        `;
      });
      timeline.innerHTML = html;
      return;
    }

    // Fallback: generate timeline based on current status
    const orderDate = new Date(order.createdAt);
    const statusOrder = ['pending', 'processing', 'shipped', 'delivered', 'completed'];
    const currentStatusIndex = statusOrder.indexOf(order.status);

    const timelineSteps = [
      { status: 'pending', title: 'Order Placed', desc: 'Your order has been received' },
      { status: 'processing', title: 'Processing', desc: 'We are preparing your order' },
      { status: 'shipped', title: 'Shipped', desc: 'Your order is on the way' },
      { status: 'delivered', title: 'Delivered', desc: 'Your order has been delivered' },
      { status: 'completed', title: 'Completed', desc: 'Order completed successfully' }
    ];

    let html = '';
    timelineSteps.forEach((step, index) => {
      if (order.status === 'cancelled' && step.status !== 'pending') {
        return;
      }

      const isCompleted = index < currentStatusIndex || (order.status === 'completed' && index <= currentStatusIndex);
      const isActive = index === currentStatusIndex;
      const isCancelled = order.status === 'cancelled' && step.status === 'pending';

      let className = 'timeline-item';
      if (isCompleted) className += ' completed';
      if (isActive && !isCancelled) className += ' active';

      const date = index === 0 ? formatDate(orderDate) : (isCompleted ? formatDate(orderDate) : 'Pending');

      html += `
        <div class="${className}">
          <div class="timeline-item-title">${step.title}</div>
          <div class="timeline-item-date">${date}</div>
          <div class="timeline-item-desc">${step.desc}</div>
        </div>
      `;
    });

    if (order.status === 'cancelled') {
      const cancellation = order.cancellation || {};
      html += `
        <div class="timeline-item cancelled">
          <div class="timeline-item-title" style="color: #dc2626;">Order Cancelled</div>
          <div class="timeline-item-date">${formatDate(cancellation.cancelledAt || orderDate)}</div>
          <div class="timeline-item-desc">${cancellation.reason || 'This order has been cancelled'}</div>
        </div>
      `;
    }

    timeline.innerHTML = html;
  }

  // ====================================
  // UPDATE ACTION BUTTONS
  // ====================================
  function updateActionButtons(order) {
    const headerActions = document.getElementById('order-header-actions');
    if (!headerActions) return;
    
    // Show download invoice for completed/delivered orders
    const downloadBtn = document.getElementById('btn-download-invoice');
    if (downloadBtn) {
      if (order.status === 'completed' || order.status === 'delivered') {
        downloadBtn.style.display = 'inline-flex';
      } else {
        downloadBtn.style.display = 'none';
      }
    }

    // Remove any existing cancel button
    const existingCancelBtn = document.getElementById('btn-cancel-order');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }

    // Add cancel button for pending orders
    if (order.status === 'pending') {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'btn-cancel-order';
      cancelBtn.className = 'order-details-action-btn danger';
      cancelBtn.innerHTML = '<i data-lucide="x"></i><span>Cancel Order</span>';
      cancelBtn.addEventListener('click', () => cancelOrder(order.orderNumber));
      headerActions.appendChild(cancelBtn);
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function initEventListeners() {
    // Print button
    const printBtn = document.getElementById('btn-print-order');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Download invoice button
    const downloadBtn = document.getElementById('btn-download-invoice');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (currentOrder) {
          downloadInvoice(currentOrder);
        }
      });
    }
  }

  // ====================================
  // CANCEL ORDER - BACKEND API
  // ====================================
  window.cancelOrder = async function(orderNumber) {
    if (!confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`/buyer/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelled by customer' })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to cancel order');
      }

      alert(`Order ${orderNumber} has been cancelled.`);
      // Reload to show updated status
      window.location.reload();

    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(error.message || 'Error cancelling order. Please try again.');
    }
  };

  // ====================================
  // DOWNLOAD INVOICE
  // ====================================
  function downloadInvoice(order) {
    // Create a simple text invoice
    const invoiceText = generateInvoiceText(order);
    const blob = new Blob([invoiceText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${order.orderNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function generateInvoiceText(order) {
    const pricing = order.pricing || {};
    
    let text = `INVOICE - ${order.orderNumber}\n`;
    text += `Date: ${formatDate(order.createdAt)}\n`;
    text += `Status: ${order.status.toUpperCase()}\n\n`;
    
    // Shipping info
    if (order.shipping) {
      text += `SHIPPING TO:\n`;
      text += `${order.shipping.firstName || ''} ${order.shipping.lastName || ''}\n`;
      if (order.shipping.companyName) text += `${order.shipping.companyName}\n`;
      if (order.shipping.address) text += `${order.shipping.address}\n`;
      text += `${order.shipping.city || ''}, ${order.shipping.country || ''}\n`;
      if (order.shipping.phone) text += `Phone: ${order.shipping.phone}\n`;
      text += `\n`;
    }
    
    text += `ITEMS:\n`;
    text += `${'='.repeat(60)}\n`;
    
    (order.items || []).forEach(item => {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      text += `${item.description || item.partNumber || 'N/A'}\n`;
      text += `  Part Number: ${item.partNumber || 'N/A'}\n`;
      text += `  Brand: ${item.brand || 'N/A'}\n`;
      text += `  Quantity: ${qty} x ${formatAmount(price)} = ${formatAmount(qty * price)}\n\n`;
    });
    
    text += `${'='.repeat(60)}\n`;
    text += `Subtotal: ${formatAmount(pricing.subtotal || 0)}\n`;
    if (pricing.processingFee > 0) {
      text += `Processing Fee: ${formatAmount(pricing.processingFee)}\n`;
    }
    if (pricing.shipping > 0) {
      text += `Shipping: ${formatAmount(pricing.shipping)}\n`;
    }
    if (pricing.tax > 0) {
      text += `Tax: ${formatAmount(pricing.tax)}\n`;
    }
    if (pricing.discount > 0) {
      text += `Discount: -${formatAmount(pricing.discount)}\n`;
    }
    text += `TOTAL: ${formatAmount(pricing.total || 0)}\n\n`;
    
    // Payment info
    if (order.payment) {
      text += `PAYMENT:\n`;
      text += `Status: ${order.payment.status || 'N/A'}\n`;
      text += `Method: ${order.payment.method || 'N/A'}\n`;
      if (order.payment.amountPaid > 0) {
        text += `Amount Paid: ${formatAmount(order.payment.amountPaid)}\n`;
      }
      if (order.payment.amountDue > 0) {
        text += `Amount Due: ${formatAmount(order.payment.amountDue)}\n`;
      }
    }
    
    return text;
  }

  // ====================================
  // SHOW ERROR
  // ====================================
  function showError(message) {
    const loadingEl = document.getElementById('order-loading');
    const contentEl = document.getElementById('order-content');
    const errorEl = document.getElementById('order-error');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const errorMessage = errorEl.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = message || 'Failed to load order details';
      }
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // FORMAT DATE
  // ====================================
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();






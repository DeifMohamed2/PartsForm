// ====================================
// ORDER DETAILS PAGE FUNCTIONALITY
// Loads and displays order details from localStorage
// ====================================

(function () {
  'use strict';

  const ORDERS_STORAGE_KEY = 'partsform_orders';
  let currentOrder = null;

  // Initialize
  function init() {
    const orderNumber = getOrderNumberFromURL();
    if (orderNumber) {
      loadOrderDetails(orderNumber);
    } else {
      showError();
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
  // LOAD ORDER DETAILS
  // ====================================
  function loadOrderDetails(orderNumber) {
    try {
      const ordersData = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (!ordersData) {
        showError();
        return;
      }

      const orders = JSON.parse(ordersData);
      currentOrder = orders.find(order => order.orderNumber === orderNumber);

      if (currentOrder) {
        renderOrderDetails(currentOrder);
      } else {
        showError();
      }
    } catch (error) {
      console.error('Error loading order:', error);
      showError();
    }
  }

  // ====================================
  // RENDER ORDER DETAILS
  // ====================================
  function renderOrderDetails(order) {
    // Hide loading, show content
    document.getElementById('order-loading').style.display = 'none';
    document.getElementById('order-content').style.display = 'block';

    // Update title and status
    document.getElementById('order-details-title').textContent = `Order ${order.orderNumber}`;
    updateStatusBadge(order.status);

    // Render items
    renderOrderItems(order.items || []);

    // Render payment info
    renderPaymentInfo(order);

    // Render summary
    renderOrderSummary(order);

    // Render timeline
    renderOrderTimeline(order);

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
    tbody.innerHTML = '';

    items.forEach(item => {
      const quantity = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const total = quantity * price;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="order-item-part">${item.description || item.partNumber || item.code || 'N/A'}</div>
          <div class="order-item-code">${item.code || item.partNumber || 'N/A'}</div>
          ${item.brand ? `<div class="order-item-desc">Brand: ${item.brand}</div>` : ''}
        </td>
        <td style="text-align: center;" class="order-item-qty">${quantity}</td>
        <td style="text-align: right;" class="order-item-price">${price.toFixed(2)} د.إ</td>
        <td style="text-align: right;" class="order-item-total">${total.toFixed(2)} د.إ</td>
      `;
      tbody.appendChild(row);
    });
  }

  // ====================================
  // RENDER PAYMENT INFO
  // ====================================
  function renderPaymentInfo(order) {
    const grid = document.getElementById('payment-info-grid');
    
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

    grid.innerHTML = `
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Type</div>
        <div class="payment-info-value">${paymentTypeNames[order.paymentType] || order.paymentType}</div>
      </div>
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Method</div>
        <div class="payment-info-value">${paymentMethodNames[order.paymentMethod] || order.paymentMethod}</div>
      </div>
      <div class="payment-info-item">
        <div class="payment-info-label">Payment Status</div>
        <div class="payment-info-value">${order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'partial' ? 'Partial Payment' : 'Pending'}</div>
      </div>
      ${order.amountDue > 0 ? `
      <div class="payment-info-item">
        <div class="payment-info-label">Amount Due</div>
        <div class="payment-info-value">${order.amountDue.toFixed(2)} د.إ</div>
      </div>
      ` : ''}
    `;
  }

  // ====================================
  // RENDER ORDER SUMMARY
  // ====================================
  function renderOrderSummary(order) {
    const summary = document.getElementById('order-summary-content');
    
    const subtotal = order.subtotal || order.amount || 0;
    const fee = order.fee || 0;
    const total = order.amount || order.total || subtotal + fee;
    const itemsCount = order.itemsCount || (order.items ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0) : 0);

    summary.innerHTML = `
      <div class="order-summary-row">
        <span class="order-summary-label">Items</span>
        <span class="order-summary-value">${itemsCount} pcs</span>
      </div>
      <div class="order-summary-row">
        <span class="order-summary-label">Subtotal</span>
        <span class="order-summary-value">${subtotal.toFixed(2)} د.إ</span>
      </div>
      ${fee > 0 ? `
      <div class="order-summary-row">
        <span class="order-summary-label">Processing Fee</span>
        <span class="order-summary-value">${fee.toFixed(2)} د.إ</span>
      </div>
      ` : ''}
      <div class="order-summary-row total">
        <span class="order-summary-label">Total</span>
        <span class="order-summary-value">${total.toFixed(2)} د.إ</span>
      </div>
      <div class="order-summary-row">
        <span class="order-summary-label">Order Date</span>
        <span class="order-summary-value">${formatDate(order.date)}</span>
      </div>
    `;
  }

  // ====================================
  // RENDER ORDER TIMELINE
  // ====================================
  function renderOrderTimeline(order) {
    const timeline = document.getElementById('order-timeline');
    const orderDate = new Date(order.date);
    
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
      html += `
        <div class="timeline-item">
          <div class="timeline-item-title" style="color: #dc2626;">Order Cancelled</div>
          <div class="timeline-item-date">${formatDate(orderDate)}</div>
          <div class="timeline-item-desc">This order has been cancelled</div>
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
    
    // Show download invoice for completed/delivered orders
    const downloadBtn = document.getElementById('btn-download-invoice');
    if (order.status === 'completed' || order.status === 'delivered') {
      downloadBtn.style.display = 'inline-flex';
    } else {
      downloadBtn.style.display = 'none';
    }

    // Add cancel button for pending orders
    if (order.status === 'pending' && !headerActions.querySelector('#btn-cancel-order')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'btn-cancel-order';
      cancelBtn.className = 'order-details-action-btn danger';
      cancelBtn.innerHTML = '<i data-lucide="x"></i><span>Cancel Order</span>';
      cancelBtn.addEventListener('click', () => cancelOrder(order.orderNumber));
      headerActions.appendChild(cancelBtn);
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
  // CANCEL ORDER
  // ====================================
  window.cancelOrder = function(orderNumber) {
    if (confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      try {
        const orders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
        const orderIndex = orders.findIndex(o => o.orderNumber === orderNumber);
        
        if (orderIndex !== -1 && orders[orderIndex].status === 'pending') {
          orders[orderIndex].status = 'cancelled';
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
          
          // Reload the page to show updated status
          window.location.reload();
        } else {
          alert('Only pending orders can be cancelled.');
        }
      } catch (error) {
        console.error('Error cancelling order:', error);
        alert('Error cancelling order. Please try again.');
      }
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
    let text = `INVOICE - ${order.orderNumber}\n`;
    text += `Date: ${formatDate(order.date)}\n`;
    text += `Status: ${order.status.toUpperCase()}\n\n`;
    text += `ITEMS:\n`;
    text += `${'='.repeat(60)}\n`;
    
    order.items.forEach(item => {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      text += `${item.description || item.partNumber || 'N/A'}\n`;
      text += `  Code: ${item.code || item.partNumber || 'N/A'}\n`;
      text += `  Quantity: ${qty} x ${price.toFixed(2)} = ${(qty * price).toFixed(2)} د.إ\n\n`;
    });
    
    text += `${'='.repeat(60)}\n`;
    text += `Subtotal: ${(order.subtotal || 0).toFixed(2)} د.إ\n`;
    if (order.fee > 0) {
      text += `Fee: ${order.fee.toFixed(2)} د.إ\n`;
    }
    text += `TOTAL: ${(order.amount || order.total || 0).toFixed(2)} د.إ\n`;
    
    return text;
  }

  // ====================================
  // SHOW ERROR
  // ====================================
  function showError() {
    document.getElementById('order-loading').style.display = 'none';
    document.getElementById('order-content').style.display = 'none';
    document.getElementById('order-error').style.display = 'block';
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // FORMAT DATE
  // ====================================
  function formatDate(dateString) {
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


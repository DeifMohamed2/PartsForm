// ====================================
// SHOPPING CART - PROFESSIONAL CART MANAGEMENT
// PARTSFORM Buyer Portal
// ====================================

(function () {
  'use strict';

  // ====================================
  // CART STATE MANAGEMENT
  // ====================================
  const CART_STORAGE_KEY = 'partsform_shopping_cart';
  const CART_EXPIRY_DAYS = 30;

  let cartState = {
    items: [],
    selectedItems: new Set(),
    createdAt: null,
    expiresAt: null,
  };

  // ====================================
  // DOM ELEMENTS
  // ====================================
  const DOM = {
    emptyCartState: document.getElementById('empty-cart-state'),
    cartItemsContainer: document.getElementById('cart-items-container'),
    cartTableBody: document.getElementById('cart-table-body'),
    headerCheckbox: document.getElementById('header-checkbox'),
    selectAllBtn: document.getElementById('select-all-btn'),
    removeSelectedBtn: document.getElementById('remove-selected-btn'),
    downloadExcelBtn: document.getElementById('download-excel-btn'),
    clearCartBtn: document.getElementById('clear-cart-btn'),
    checkoutBtn: document.getElementById('checkout-btn'),
    totalItemsCount: document.getElementById('total-items-count'),
    totalAmount: document.getElementById('total-amount'),
    totalAmountText: document.getElementById('total-amount-text'),
    totalWeight: document.getElementById('total-weight'),
    totalWeightText: document.getElementById('total-weight-text'),
    totalItems: document.getElementById('total-items'),
    cartExpiryText: document.getElementById('cart-expiry-text'),
    cartAlerts: document.getElementById('cart-alerts'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmBackdrop: document.getElementById('confirm-backdrop'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmOk: document.getElementById('confirm-ok'),
    confirmCancel: document.getElementById('confirm-cancel'),
  };

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    loadCartFromStorage();
    renderCart();
    updateCartBadge();
    startExpiryTimer();
    attachEventListeners();
  }

  // ====================================
  // LOCAL STORAGE MANAGEMENT
  // ====================================
  function loadCartFromStorage() {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);

        // Check if cart has expired
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          clearCart(false);
          showAlert(
            'info',
            'Cart Expired',
            'Your cart items have been cleared after 30 days.',
          );
          return;
        }

        cartState = {
          items: parsed.items || [],
          selectedItems: new Set(parsed.selectedItems || []),
          createdAt: parsed.createdAt || new Date().toISOString(),
          expiresAt: parsed.expiresAt || calculateExpiryDate(),
        };
      } else {
        // Initialize new cart
        cartState.createdAt = new Date().toISOString();
        cartState.expiresAt = calculateExpiryDate();
        saveCartToStorage();
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
      showAlert('error', 'Error', 'Failed to load cart data');
    }
  }

  function saveCartToStorage() {
    try {
      const cartData = {
        items: cartState.items,
        selectedItems: Array.from(cartState.selectedItems),
        createdAt: cartState.createdAt,
        expiresAt: cartState.expiresAt,
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));

      // Update navbar badge
      updateCartBadge();
    } catch (error) {
      console.error('Error saving cart to storage:', error);
      showAlert('error', 'Error', 'Failed to save cart data');
    }
  }

  function calculateExpiryDate() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + CART_EXPIRY_DAYS);
    return expiryDate.toISOString();
  }

  // ====================================
  // CART OPERATIONS
  // ====================================
  function addToCart(item) {
    // Each part is added as a separate item - NO grouping by code/brand
    // If adding multiple quantities, add them as individual items
    const quantity = item.quantity || 1;

    // 🧠 Record for AI learning
    if (window.aiLearning) {
      window.aiLearning.recordAddedToCart(
        item._id || item.code || item.partNumber,
      );
    }

    for (let i = 0; i < quantity; i++) {
      // Add as new individual item - store all fields from search results
      const cartItem = {
        id: generateItemId(),
        code: item.code || item.partNumber || 'N/A',
        brand: item.brand || 'N/A',
        description: item.description || '',
        supplier: item.supplier || '',
        terms: item.terms || 'N/A',
        weight: parseFloat(item.weight) || 0,
        stock: item.stock || 'N/A',
        aircraftType: item.aircraftType || 'N/A',
        price: parseFloat(item.price) || 0,
        currency: item.currency || 'AED',
        reference: item.reference || '',
        dateCreated: new Date().toISOString(),
        category: item.category || 'general',
        addPacking: false,
      };

      cartState.items.push(cartItem);
    }

    if (quantity > 1) {
      showAlert(
        'success',
        'Added to Cart',
        `${quantity} x ${item.code || item.partNumber} added successfully`,
      );
    } else {
      showAlert(
        'success',
        'Added to Cart',
        `${item.code || item.partNumber} added successfully`,
      );
    }

    saveCartToStorage();
    renderCart();
  }

  function removeFromCart(itemId, skipConfirm = false) {
    if (!skipConfirm) {
      showConfirmDialog(
        'Remove Item',
        'Are you sure you want to remove this item from your cart?',
        () => {
          performRemove(itemId);
        },
      );
    } else {
      performRemove(itemId);
    }
  }

  function performRemove(itemId) {
    const index = cartState.items.findIndex((i) => i.id === itemId);
    if (index !== -1) {
      const removedItem = cartState.items[index];
      cartState.items.splice(index, 1);
      cartState.selectedItems.delete(itemId);
      saveCartToStorage();
      renderCart();
      showAlert('info', 'Removed', `${removedItem.code} removed from cart`);
    }
  }

  function removeSelectedItems() {
    if (cartState.selectedItems.size === 0) {
      showAlert('info', 'No Selection', 'Please select items to remove');
      return;
    }

    showConfirmDialog(
      'Remove Selected Items',
      `Are you sure you want to remove ${cartState.selectedItems.size} selected item(s)?`,
      () => {
        cartState.selectedItems.forEach((itemId) => performRemove(itemId));
        cartState.selectedItems.clear();
        updateSelectAllState();
      },
    );
  }

  function clearCart(confirm = true) {
    if (confirm) {
      showConfirmDialog(
        'Clear Cart',
        'Are you sure you want to empty your entire cart? This action cannot be undone.',
        () => {
          performClearCart();
        },
      );
    } else {
      performClearCart();
    }
  }

  function performClearCart() {
    cartState.items = [];
    cartState.selectedItems.clear();
    saveCartToStorage();
    renderCart();
    showAlert(
      'info',
      'Cart Cleared',
      'All items have been removed from your cart',
    );
  }

  // Note: updateItemQuantity is deprecated - each item is now individual
  // Keeping function for backward compatibility but it's no longer used
  function updateItemQuantity(itemId, newQuantity) {
    // Each item is individual - no quantity to update
    console.warn('updateItemQuantity is deprecated - items are now individual');
  }

  function updateItemPacking(itemId, addPacking) {
    const item = cartState.items.find((i) => i.id === itemId);
    if (item) {
      item.addPacking = addPacking;
      saveCartToStorage();
      renderCart();
    }
  }

  function updateItemReference(itemId, reference) {
    const item = cartState.items.find((i) => i.id === itemId);
    if (item) {
      item.reference = reference;
      saveCartToStorage();
    }
  }

  function toggleItemSelection(itemId) {
    if (cartState.selectedItems.has(itemId)) {
      cartState.selectedItems.delete(itemId);
    } else {
      cartState.selectedItems.add(itemId);
    }
    updateSelectAllState();
    updateSelectedItemsUI();
  }

  function toggleSelectAll() {
    if (cartState.selectedItems.size === cartState.items.length) {
      cartState.selectedItems.clear();
    } else {
      cartState.items.forEach((item) => cartState.selectedItems.add(item.id));
    }

    // Update all checkboxes in the table
    const allCheckboxes = document.querySelectorAll('.item-checkbox');
    allCheckboxes.forEach((checkbox) => {
      const itemId = checkbox.dataset.itemId;
      checkbox.checked = cartState.selectedItems.has(itemId);
    });

    updateSelectAllState();
    updateSelectedItemsUI();
  }

  // ====================================
  // RENDERING
  // ====================================
  function renderCart() {
    // Only render if we're on the cart page
    if (!DOM.emptyCartState || !DOM.cartItemsContainer) {
      return;
    }

    if (cartState.items.length === 0) {
      showEmptyState();
    } else {
      showCartItems();
    }
    updateCartSummary();
  }

  function showEmptyState() {
    if (DOM.emptyCartState && DOM.cartItemsContainer) {
      DOM.emptyCartState.style.display = 'block';
      DOM.cartItemsContainer.style.display = 'none';
    }
  }

  function showCartItems() {
    if (!DOM.emptyCartState || !DOM.cartItemsContainer || !DOM.cartTableBody) {
      return;
    }

    DOM.emptyCartState.style.display = 'none';
    DOM.cartItemsContainer.style.display = 'block';

    DOM.cartTableBody.innerHTML = '';

    cartState.items.forEach((item) => {
      const row = createCartItemRow(item);
      DOM.cartTableBody.appendChild(row);
    });

    updateSelectAllState();
  }

  function createCartItemRow(item) {
    const tr = document.createElement('tr');
    tr.dataset.itemId = item.id;

    if (cartState.selectedItems.has(item.id)) {
      tr.classList.add('selected');
    }

    // Each item is individual - no quantity grouping
    const amount = item.price;
    const itemWeight = item.weight;

    tr.innerHTML = `
      <td class="th-checkbox">
        <input type="checkbox" class="cart-checkbox item-checkbox" 
               data-item-id="${item.id}" 
               ${cartState.selectedItems.has(item.id) ? 'checked' : ''}>
      </td>
      <td class="th-brand">
        <span class="brand-badge">${escapeHtml(item.brand)}</span>
      </td>
      <td class="th-part-number">
        <span class="part-number">${escapeHtml(item.code)}</span>
      </td>
      <td class="th-description">
        <span class="part-description">${escapeHtml(item.description)}</span>
      </td>
      <td class="th-supplier">
        <span class="supplier-name">${escapeHtml(item.supplier || 'N/A')}</span>
      </td>
      <td class="th-terms">${escapeHtml(item.terms)}</td>
      <td class="th-weight">${itemWeight.toFixed(3)} kg</td>
      <td class="th-stock">
        <span class="stock-badge ${getStockClass(item.stock)}">
          <i data-lucide="${getStockIcon(item.stock)}"></i>
          ${escapeHtml(item.stock)}
        </span>
      </td>
      <td class="th-aircraft">${escapeHtml(item.aircraftType)}</td>
      <td class="th-qty">
        <span class="qty-display">1</span>
      </td>
      <td class="th-packing">
        <div class="packing-checkbox-group">
          <input type="checkbox" class="packing-checkbox" 
                 id="packing-${item.id}" 
                 data-item-id="${item.id}"
                 ${item.addPacking ? 'checked' : ''}>
          <label for="packing-${item.id}" class="packing-label">Add</label>
        </div>
      </td>
      <td class="th-price">
        <span class="price-display">
          ${item.price.toFixed(2)}
          <span class="price-currency">د.إ</span>
        </span>
      </td>
      <td class="th-amount">
        <span class="amount-display">${amount.toFixed(2)} د.إ</span>
      </td>
      <td class="th-reference">
        <input type="text" class="reference-input" 
               placeholder="Add reference" 
               value="${escapeHtml(item.reference)}"
               data-item-id="${item.id}">
      </td>
      <td class="th-date">
        <span class="date-display">${formatDate(item.dateCreated)}</span>
      </td>
      <td class="th-actions">
        <button class="btn-remove-item" data-item-id="${
          item.id
        }" title="Remove item">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;

    // Attach event listeners
    attachItemEventListeners(tr, item.id);

    return tr;
  }

  function attachItemEventListeners(row, itemId) {
    // Checkbox
    const checkbox = row.querySelector('.item-checkbox');
    checkbox.addEventListener('change', () => toggleItemSelection(itemId));

    // No quantity buttons - each item is individual

    // Packing checkbox
    const packingCheckbox = row.querySelector('.packing-checkbox');
    packingCheckbox.addEventListener('change', (e) => {
      updateItemPacking(itemId, e.target.checked);
    });

    // Reference input
    const referenceInput = row.querySelector('.reference-input');
    referenceInput.addEventListener('blur', (e) => {
      updateItemReference(itemId, e.target.value);
    });

    // Remove button
    const removeBtn = row.querySelector('.btn-remove-item');
    removeBtn.addEventListener('click', () => removeFromCart(itemId));

    // Re-create lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }
  }

  function updateCartSummary() {
    // Only update if we're on the cart page
    if (!DOM.totalItemsCount || !DOM.totalItems) {
      return;
    }

    const totals = calculateTotals();

    if (DOM.totalItemsCount)
      DOM.totalItemsCount.textContent = totals.totalItems;
    if (DOM.totalItems) DOM.totalItems.textContent = totals.totalItems;
    if (DOM.totalAmount)
      DOM.totalAmount.textContent = totals.totalAmount.toFixed(2);
    if (DOM.totalAmountText)
      DOM.totalAmountText.textContent = totals.totalAmount.toFixed(2);
    if (DOM.totalWeight)
      DOM.totalWeight.textContent = totals.totalWeight.toFixed(3);
    if (DOM.totalWeightText)
      DOM.totalWeightText.textContent = totals.totalWeight.toFixed(3);

    // Enable/disable checkout button
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.disabled = cartState.items.length === 0;
    }
  }

  function updateSelectAllState() {
    const hasItems = cartState.items.length > 0;
    const allSelected =
      hasItems && cartState.selectedItems.size === cartState.items.length;

    if (DOM.headerCheckbox) {
      DOM.headerCheckbox.checked = allSelected;
      DOM.headerCheckbox.indeterminate =
        cartState.selectedItems.size > 0 && !allSelected;
    }

    // Update button text
    if (DOM.selectAllBtn) {
      DOM.selectAllBtn.innerHTML = `
        <i data-lucide="${allSelected ? 'square' : 'check-square'}"></i>
        <span>${allSelected ? 'Deselect All' : 'Select All'}</span>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nameAttr: 'data-lucide' });
      }
    }
  }

  function updateSelectedItemsUI() {
    // Update table row styling and checkboxes
    cartState.items.forEach((item) => {
      const row = document.querySelector(`tr[data-item-id="${item.id}"]`);
      if (row) {
        const checkbox = row.querySelector('.item-checkbox');
        if (cartState.selectedItems.has(item.id)) {
          row.classList.add('selected');
          if (checkbox) checkbox.checked = true;
        } else {
          row.classList.remove('selected');
          if (checkbox) checkbox.checked = false;
        }
      }
    });

    // Enable/disable remove selected button
    if (DOM.removeSelectedBtn) {
      DOM.removeSelectedBtn.disabled = cartState.selectedItems.size === 0;
    }
  }

  function calculateTotals() {
    // Each item is individual - count each item as 1
    const totalItems = cartState.items.length;
    const totalAmount = cartState.items.reduce(
      (sum, item) => sum + (parseFloat(item.price) || 0),
      0,
    );
    const totalWeight = cartState.items.reduce(
      (sum, item) => sum + (parseFloat(item.weight) || 0),
      0,
    );

    return { totalItems, totalAmount, totalWeight };
  }

  // ====================================
  // CART BADGE UPDATE (NAVBAR)
  // ====================================
  function updateCartBadge() {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
      const itemCount = cartState.items.length;
      if (itemCount > 0) {
        cartBadge.textContent = itemCount;
        cartBadge.style.display = 'flex';
      } else {
        cartBadge.style.display = 'none';
      }
    }
  }

  // ====================================
  // EXPIRY TIMER
  // ====================================
  function startExpiryTimer() {
    updateExpiryDisplay();
    setInterval(updateExpiryDisplay, 60000); // Update every minute
  }

  function updateExpiryDisplay() {
    if (!cartState.expiresAt || !DOM.cartExpiryText) return;

    const now = new Date();
    const expiryDate = new Date(cartState.expiresAt);
    const diffMs = expiryDate - now;

    if (diffMs <= 0) {
      clearCart(false);
      showAlert(
        'info',
        'Cart Expired',
        'Your cart items have been cleared after 30 days.',
      );
      return;
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    DOM.cartExpiryText.textContent = `Time remaining: ${days}d ${hours}h ${minutes}m`;
  }

  // ====================================
  // EXCEL DOWNLOAD
  // ====================================
  function downloadExcel() {
    if (cartState.items.length === 0) {
      showAlert('info', 'Empty Cart', 'No items to download');
      return;
    }

    try {
      // Create CSV content
      const headers = [
        'Brand',
        'Part Number',
        'Description',
        'Terms',
        'Weight (kg)',
        'Stock',
        'A/C Type',
        'Quantity',
        'Add Packing',
        'Price (AED)',
        'Amount (AED)',
        'Reference',
        'Date Created',
      ];

      const rows = cartState.items.map((item) => [
        item.brand,
        item.code,
        item.description,
        item.terms,
        (item.weight * item.quantity).toFixed(3),
        item.stock,
        item.aircraftType,
        item.quantity,
        item.addPacking ? 'Yes' : 'No',
        item.price.toFixed(2),
        (item.price * item.quantity).toFixed(2),
        item.reference,
        formatDate(item.dateCreated),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `partsform_cart_${new Date().toISOString().split('T')[0]}.csv`,
      );
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert('success', 'Downloaded', 'Cart exported to Excel successfully');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showAlert('error', 'Error', 'Failed to download Excel file');
    }
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function attachEventListeners() {
    // Header checkbox
    if (DOM.headerCheckbox) {
      DOM.headerCheckbox.addEventListener('change', toggleSelectAll);
    }

    // Action buttons
    if (DOM.selectAllBtn) {
      DOM.selectAllBtn.addEventListener('click', toggleSelectAll);
    }

    if (DOM.removeSelectedBtn) {
      DOM.removeSelectedBtn.addEventListener('click', removeSelectedItems);
    }

    if (DOM.downloadExcelBtn) {
      DOM.downloadExcelBtn.addEventListener('click', downloadExcel);
    }

    if (DOM.clearCartBtn) {
      DOM.clearCartBtn.addEventListener('click', () => clearCart(true));
    }

    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.addEventListener('click', handleCheckout);
    }

    // Confirm modal
    if (DOM.confirmCancel) {
      DOM.confirmCancel.addEventListener('click', hideConfirmDialog);
    }

    if (DOM.confirmBackdrop) {
      DOM.confirmBackdrop.addEventListener('click', hideConfirmDialog);
    }
  }

  // ====================================
  // CHECKOUT
  // ====================================
  function handleCheckout() {
    if (cartState.items.length === 0) {
      showAlert('info', 'Empty Cart', 'Your cart is empty');
      return;
    }

    showAlert('success', 'Processing', 'Redirecting to checkout...');

    // Redirect to checkout page
    setTimeout(() => {
      window.location.href = '/buyer/checkout';
    }, 1500);
  }

  // ====================================
  // ALERTS
  // ====================================
  function showAlert(type, title, message) {
    // Check if cart alerts container exists, if not create one temporarily
    let alertsContainer = DOM.cartAlerts;
    let isTemporary = false;

    if (!alertsContainer || !document.body.contains(alertsContainer)) {
      // Create temporary alerts container for non-cart pages
      alertsContainer = document.createElement('div');
      alertsContainer.className = 'cart-alerts';
      alertsContainer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 2rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 400px;
      `;
      document.body.appendChild(alertsContainer);
      isTemporary = true;
    }

    const alert = document.createElement('div');
    alert.className = `cart-alert ${type}`;
    alert.innerHTML = `
      <i data-lucide="${getAlertIcon(type)}" class="cart-alert-icon"></i>
      <div class="cart-alert-content">
        <div class="cart-alert-title">${escapeHtml(title)}</div>
        <p class="cart-alert-message">${escapeHtml(message)}</p>
      </div>
      <button class="cart-alert-close">
        <i data-lucide="x"></i>
      </button>
    `;

    alertsContainer.appendChild(alert);

    // Re-create icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }

    // Close button
    const closeBtn = alert.querySelector('.cart-alert-close');
    closeBtn.addEventListener('click', () => {
      alert.remove();
      if (isTemporary && alertsContainer.children.length === 0) {
        alertsContainer.remove();
      }
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alert.parentElement) {
        alert.remove();
        if (
          isTemporary &&
          alertsContainer.parentElement &&
          alertsContainer.children.length === 0
        ) {
          alertsContainer.remove();
        }
      }
    }, 5000);
  }

  // ====================================
  // CONFIRMATION DIALOG
  // ====================================
  let confirmCallback = null;

  function showConfirmDialog(title, message, onConfirm) {
    confirmCallback = onConfirm;
    DOM.confirmTitle.textContent = title;
    DOM.confirmMessage.textContent = message;
    DOM.confirmModal.style.display = 'flex';

    // Re-create icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }

    // Attach one-time confirm handler
    const handleConfirm = () => {
      if (confirmCallback) {
        confirmCallback();
      }
      hideConfirmDialog();
      DOM.confirmOk.removeEventListener('click', handleConfirm);
    };

    DOM.confirmOk.addEventListener('click', handleConfirm);
  }

  function hideConfirmDialog() {
    DOM.confirmModal.style.display = 'none';
    confirmCallback = null;
  }

  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  function generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function getStockClass(stock) {
    const stockLower = stock.toLowerCase();
    if (stockLower.includes('st1') || stockLower.includes('in-stock')) {
      return 'in-stock';
    } else if (stockLower.includes('st2') || stockLower.includes('low')) {
      return 'low-stock';
    } else {
      return 'out-of-stock';
    }
  }

  function getStockIcon(stock) {
    const stockClass = getStockClass(stock);
    if (stockClass === 'in-stock') return 'check-circle';
    if (stockClass === 'low-stock') return 'alert-circle';
    return 'x-circle';
  }

  function getAlertIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'x-circle',
      info: 'info',
    };
    return icons[type] || 'info';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).substr(2);
    return `${day}.${month}.${year}`;
  }

  // ====================================
  // PUBLIC API (FOR OTHER PAGES)
  // ====================================
  window.PartsFormCart = {
    addToCart: addToCart,
    getCartCount: () => cartState.items.length,
    getCartItems: () => [...cartState.items],
    updateBadge: updateCartBadge,
  };

  // ====================================
  // START APPLICATION
  // ====================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

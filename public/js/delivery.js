// ====================================
// DELIVERY PAGE - ADDRESS MANAGEMENT
// PARTSFORM Buyer Portal
// Real API Integration
// ====================================

// Global state
let addresses = [];
let editingAddressId = null;
let isLoading = false;

// ====================================
// INITIALIZATION
// ====================================
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  loadAddresses();
});

// ====================================
// EVENT LISTENERS
// ====================================
function initializeEventListeners() {
  // Add address button
  const btnAddAddress = document.getElementById('btn-add-address');
  if (btnAddAddress) {
    btnAddAddress.addEventListener('click', () => openAddressModal());
  }

  // Modal close buttons
  const modalClose = document.getElementById('modal-close');
  const btnCancel = document.getElementById('btn-cancel');
  
  if (modalClose) {
    modalClose.addEventListener('click', closeAddressModal);
  }
  
  if (btnCancel) {
    btnCancel.addEventListener('click', closeAddressModal);
  }

  // Close modal on backdrop click
  const backdrop = document.querySelector('.address-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeAddressModal);
  }

  // Form submission
  const addressForm = document.getElementById('address-form');
  if (addressForm) {
    addressForm.addEventListener('submit', handleFormSubmit);
  }

  // Track order button
  const btnTrack = document.getElementById('btn-track');
  if (btnTrack) {
    btnTrack.addEventListener('click', handleTrackOrder);
  }

  // Track on Enter key
  const trackingInput = document.getElementById('tracking-input');
  if (trackingInput) {
    trackingInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleTrackOrder();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddressModal();
      closeConfirmModal();
    }
  });
}

// ====================================
// API FUNCTIONS
// ====================================
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function loadAddresses() {
  const grid = document.getElementById('addresses-grid');
  const emptyState = document.getElementById('addresses-empty');
  
  if (!grid) return;

  try {
    showLoadingState(grid);
    
    const response = await apiRequest('/buyer/api/addresses');
    
    if (response.success) {
      addresses = response.addresses || [];
      renderAddresses();
    } else {
      throw new Error(response.message || 'Failed to load addresses');
    }
  } catch (error) {
    console.error('Error loading addresses:', error);
    showErrorState(grid, 'Failed to load addresses. Please try again.');
    addresses = [];
  }
}

async function saveAddress(addressData) {
  if (editingAddressId) {
    // Update existing address
    return await apiRequest(`/buyer/api/addresses/${editingAddressId}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    });
  } else {
    // Create new address
    return await apiRequest('/buyer/api/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  }
}

async function deleteAddressAPI(addressId) {
  return await apiRequest(`/buyer/api/addresses/${addressId}`, {
    method: 'DELETE',
  });
}

async function setDefaultAddressAPI(addressId) {
  return await apiRequest(`/buyer/api/addresses/${addressId}/default`, {
    method: 'PUT',
  });
}

// ====================================
// UI STATES
// ====================================
function showLoadingState(container) {
  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <p class="loading-text">Loading addresses...</p>
    </div>
  `;
  container.style.display = 'block';
}

function showErrorState(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">
        <i data-lucide="alert-circle"></i>
      </div>
      <h3 class="error-title">Something went wrong</h3>
      <p class="error-text">${message}</p>
      <button class="btn-retry" onclick="loadAddresses()">
        <i data-lucide="refresh-cw"></i>
        <span>Try Again</span>
      </button>
    </div>
  `;
  lucide.createIcons();
}

function setButtonLoading(button, loading, originalText = 'Save Address') {
  if (loading) {
    button.disabled = true;
    button.innerHTML = `
      <span class="btn-spinner"></span>
      <span>Saving...</span>
    `;
  } else {
    button.disabled = false;
    button.innerHTML = `
      <i data-lucide="check"></i>
      <span>${originalText}</span>
    `;
    lucide.createIcons();
  }
}

// ====================================
// NOTIFICATION SYSTEM
// ====================================
function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.delivery-notification');
  existing.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `delivery-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i data-lucide="x"></i>
    </button>
  `;

  document.body.appendChild(notification);
  lucide.createIcons();

  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('hiding');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ====================================
// ADDRESS RENDERING
// ====================================
function renderAddresses() {
  const grid = document.getElementById('addresses-grid');
  const emptyState = document.getElementById('addresses-empty');

  if (!grid || !emptyState) return;

  if (addresses.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    lucide.createIcons();
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = addresses.map(address => createAddressCard(address)).join('');
  
  // Reinitialize Lucide icons
  lucide.createIcons();

  // Add event listeners to action buttons
  addresses.forEach(address => {
    const editBtn = document.getElementById(`edit-${address._id}`);
    const deleteBtn = document.getElementById(`delete-${address._id}`);
    const defaultBtn = document.getElementById(`default-${address._id}`);

    if (editBtn) {
      editBtn.addEventListener('click', () => editAddress(address._id));
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => confirmDeleteAddress(address._id));
    }

    if (defaultBtn && !address.isDefault) {
      defaultBtn.addEventListener('click', () => setDefaultAddress(address._id));
    }
  });
}

function createAddressCard(address) {
  const isDefault = address.isDefault;
  const addressId = address._id;
  
  return `
    <div class="address-card ${isDefault ? 'default' : ''}" data-address-id="${addressId}">
      <div class="address-card-header">
        <div class="address-card-label">
          <i data-lucide="${isDefault ? 'star' : 'map-pin'}"></i>
          <span>${escapeHtml(address.label)}</span>
        </div>
        ${isDefault ? '<div class="default-badge"><i data-lucide="check-circle"></i><span>Default</span></div>' : ''}
      </div>
      
      <div class="address-card-body">
        <div class="address-info">
          <div class="address-info-item">
            <i data-lucide="user"></i>
            <span><strong>${escapeHtml(address.fullName)}</strong></span>
          </div>
          <div class="address-info-item">
            <i data-lucide="phone"></i>
            <span>${escapeHtml(address.phone)}</span>
          </div>
          <div class="address-info-item">
            <i data-lucide="map-pin"></i>
            <span>${escapeHtml(address.street)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)}, ${escapeHtml(address.country)}${address.postalCode ? ' ' + escapeHtml(address.postalCode) : ''}</span>
          </div>
          ${address.notes ? `
          <div class="address-info-item notes">
            <i data-lucide="file-text"></i>
            <span>${escapeHtml(address.notes)}</span>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="address-card-footer">
        <button class="btn-address-action edit" id="edit-${addressId}" title="Edit address">
          <i data-lucide="edit-2"></i>
          <span>Edit</span>
        </button>
        ${!isDefault ? `
        <button class="btn-address-action set-default" id="default-${addressId}" title="Set as default">
          <i data-lucide="star"></i>
          <span>Set Default</span>
        </button>
        ` : ''}
        <button class="btn-address-action delete" id="delete-${addressId}" title="Delete address">
          <i data-lucide="trash-2"></i>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
}

// ====================================
// ADDRESS MODAL
// ====================================
function openAddressModal(address = null) {
  const modal = document.getElementById('address-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('address-form');

  if (!modal || !modalTitle || !form) return;

  editingAddressId = address ? address._id : null;

  // Update modal title
  modalTitle.textContent = address ? 'Edit Address' : 'Add New Address';

  // Reset or populate form
  if (address) {
    document.getElementById('address-id').value = address._id;
    document.getElementById('address-name').value = address.label || '';
    document.getElementById('address-fullname').value = address.fullName || '';
    document.getElementById('address-phone').value = address.phone || '';
    document.getElementById('address-street').value = address.street || '';
    document.getElementById('address-city').value = address.city || '';
    document.getElementById('address-state').value = address.state || '';
    document.getElementById('address-country').value = address.country || '';
    document.getElementById('address-postal').value = address.postalCode || '';
    document.getElementById('address-notes').value = address.notes || '';
    document.getElementById('address-default').checked = address.isDefault || false;
  } else {
    form.reset();
    document.getElementById('address-id').value = '';
    // If no addresses exist, auto-check default
    if (addresses.length === 0) {
      document.getElementById('address-default').checked = true;
    }
  }

  // Show modal
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  
  // Focus first input
  setTimeout(() => {
    document.getElementById('address-name').focus();
    lucide.createIcons();
  }, 100);
}

function closeAddressModal() {
  const modal = document.getElementById('address-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
  editingAddressId = null;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (isLoading) return;

  const saveBtn = e.target.querySelector('.btn-save');
  
  const formData = {
    label: document.getElementById('address-name').value.trim(),
    fullName: document.getElementById('address-fullname').value.trim(),
    phone: document.getElementById('address-phone').value.trim(),
    street: document.getElementById('address-street').value.trim(),
    city: document.getElementById('address-city').value.trim(),
    state: document.getElementById('address-state').value.trim(),
    country: document.getElementById('address-country').value.trim(),
    postalCode: document.getElementById('address-postal').value.trim(),
    notes: document.getElementById('address-notes').value.trim(),
    isDefault: document.getElementById('address-default').checked,
  };

  // Validate required fields
  if (!formData.label || !formData.fullName || !formData.phone || 
      !formData.street || !formData.city || !formData.state || !formData.country) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  try {
    isLoading = true;
    setButtonLoading(saveBtn, true);

    const response = await saveAddress(formData);

    if (response.success) {
      showNotification(
        editingAddressId ? 'Address updated successfully' : 'Address added successfully',
        'success'
      );
      closeAddressModal();
      await loadAddresses(); // Reload addresses from server
    } else {
      throw new Error(response.message || 'Failed to save address');
    }
  } catch (error) {
    console.error('Error saving address:', error);
    showNotification(error.message || 'Failed to save address. Please try again.', 'error');
  } finally {
    isLoading = false;
    setButtonLoading(saveBtn, false);
  }
}

function editAddress(id) {
  const address = addresses.find(a => a._id === id);
  if (address) {
    openAddressModal(address);
  }
}

// ====================================
// DELETE ADDRESS
// ====================================
function confirmDeleteAddress(id) {
  const address = addresses.find(a => a._id === id);
  
  if (!address) return;

  const title = address.isDefault ? 'Delete Default Address?' : 'Delete Address?';
  const message = address.isDefault
    ? `Are you sure you want to delete your default address "${address.label}"? If you have other addresses, one will be set as default automatically.`
    : `Are you sure you want to delete the address "${address.label}"? This action cannot be undone.`;

  showConfirmModal(title, message, () => deleteAddress(id));
}

async function deleteAddress(id) {
  try {
    const response = await deleteAddressAPI(id);

    if (response.success) {
      showNotification('Address deleted successfully', 'success');
      await loadAddresses(); // Reload addresses from server
    } else {
      throw new Error(response.message || 'Failed to delete address');
    }
  } catch (error) {
    console.error('Error deleting address:', error);
    showNotification(error.message || 'Failed to delete address. Please try again.', 'error');
  }
}

// ====================================
// SET DEFAULT ADDRESS
// ====================================
async function setDefaultAddress(id) {
  try {
    const card = document.querySelector(`[data-address-id="${id}"]`);
    if (card) {
      card.classList.add('updating');
    }

    const response = await setDefaultAddressAPI(id);

    if (response.success) {
      showNotification('Default address updated', 'success');
      await loadAddresses(); // Reload addresses from server
    } else {
      throw new Error(response.message || 'Failed to set default address');
    }
  } catch (error) {
    console.error('Error setting default address:', error);
    showNotification(error.message || 'Failed to set default address. Please try again.', 'error');
    
    const card = document.querySelector(`[data-address-id="${id}"]`);
    if (card) {
      card.classList.remove('updating');
    }
  }
}

// ====================================
// CONFIRMATION MODAL
// ====================================
let confirmCallback = null;

function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  const btnDelete = document.getElementById('btn-confirm-delete');
  const backdrop = document.querySelector('.confirm-modal-backdrop');

  if (!modal || !titleEl || !messageEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmCallback = onConfirm;

  modal.classList.add('active');
  document.body.classList.add('modal-open');

  // Remove old listeners and add new ones
  const newBtnCancel = btnCancel.cloneNode(true);
  const newBtnDelete = btnDelete.cloneNode(true);
  const newBackdrop = backdrop.cloneNode(true);
  
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
  backdrop.parentNode.replaceChild(newBackdrop, backdrop);

  newBtnCancel.addEventListener('click', closeConfirmModal);
  newBtnDelete.addEventListener('click', handleConfirmDelete);
  newBackdrop.addEventListener('click', closeConfirmModal);

  setTimeout(() => lucide.createIcons(), 100);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
  confirmCallback = null;
}

async function handleConfirmDelete() {
  if (confirmCallback) {
    await confirmCallback();
  }
  closeConfirmModal();
}

// ====================================
// ORDER TRACKING
// ====================================
function handleTrackOrder() {
  const trackingInput = document.getElementById('tracking-input');
  
  if (!trackingInput) return;

  const orderNumber = trackingInput.value.trim();

  if (!orderNumber) {
    showNotification('Please enter an order number to track.', 'error');
    trackingInput.focus();
    return;
  }

  // Redirect to order details page
  window.location.href = `/buyer/orders/${encodeURIComponent(orderNumber)}`;
}

// ====================================
// UTILITY FUNCTIONS
// ====================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

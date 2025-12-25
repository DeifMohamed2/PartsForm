// ====================================
// DELIVERY PAGE - ADDRESS MANAGEMENT
// PARTSFORM Buyer Portal
// ====================================

// Storage key for addresses
const ADDRESSES_STORAGE_KEY = 'partsform_delivery_addresses';

// Global state
let addresses = [];
let editingAddressId = null;

// ====================================
// INITIALIZATION
// ====================================
document.addEventListener('DOMContentLoaded', () => {
  loadAddresses();
  renderAddresses();
  initializeEventListeners();
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
  const modal = document.getElementById('address-modal');
  const backdrop = document.querySelector('.address-modal-backdrop');
  
  if (modal && backdrop) {
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
}

// ====================================
// ADDRESS MANAGEMENT
// ====================================
function loadAddresses() {
  try {
    const stored = localStorage.getItem(ADDRESSES_STORAGE_KEY);
    addresses = stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading addresses:', error);
    addresses = [];
  }
}

function saveAddresses() {
  try {
    localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(addresses));
  } catch (error) {
    console.error('Error saving addresses:', error);
  }
}

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
    const editBtn = document.getElementById(`edit-${address.id}`);
    const deleteBtn = document.getElementById(`delete-${address.id}`);
    const defaultBtn = document.getElementById(`default-${address.id}`);

    if (editBtn) {
      editBtn.addEventListener('click', () => editAddress(address.id));
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteAddress(address.id));
    }

    if (defaultBtn && !address.isDefault) {
      defaultBtn.addEventListener('click', () => setDefaultAddress(address.id));
    }
  });
}

function createAddressCard(address) {
  const isDefault = address.isDefault;
  
  return `
    <div class="address-card ${isDefault ? 'default' : ''}">
      <div class="address-card-header">
        <div class="address-card-label">
          <i data-lucide="${isDefault ? 'star' : 'map-pin'}"></i>
          <span>${address.name}</span>
        </div>
        ${isDefault ? '<div class="default-badge"><i data-lucide="check-circle"></i><span>Default</span></div>' : ''}
      </div>
      
      <div class="address-card-body">
        <div class="address-info">
          <div class="address-info-item">
            <i data-lucide="user"></i>
            <span><strong>${address.fullName}</strong></span>
          </div>
          <div class="address-info-item">
            <i data-lucide="phone"></i>
            <span>${address.phone}</span>
          </div>
          <div class="address-info-item">
            <i data-lucide="map-pin"></i>
            <span>${address.street}, ${address.city}, ${address.state}, ${address.country}${address.postalCode ? ' ' + address.postalCode : ''}</span>
          </div>
          ${address.notes ? `
          <div class="address-info-item">
            <i data-lucide="file-text"></i>
            <span>${address.notes}</span>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="address-card-footer">
        <button class="btn-address-action edit" id="edit-${address.id}">
          <i data-lucide="edit-2"></i>
          <span>Edit</span>
        </button>
        ${!isDefault ? `
        <button class="btn-address-action set-default" id="default-${address.id}">
          <i data-lucide="star"></i>
          <span>Set Default</span>
        </button>
        ` : ''}
        <button class="btn-address-action delete" id="delete-${address.id}">
          <i data-lucide="trash-2"></i>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
}

function openAddressModal(address = null) {
  const modal = document.getElementById('address-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('address-form');

  if (!modal || !modalTitle || !form) return;

  editingAddressId = address ? address.id : null;

  // Update modal title
  modalTitle.textContent = address ? 'Edit Address' : 'Add New Address';

  // Reset or populate form
  if (address) {
    document.getElementById('address-id').value = address.id;
    document.getElementById('address-name').value = address.name;
    document.getElementById('address-fullname').value = address.fullName;
    document.getElementById('address-phone').value = address.phone;
    document.getElementById('address-street').value = address.street;
    document.getElementById('address-city').value = address.city;
    document.getElementById('address-state').value = address.state;
    document.getElementById('address-country').value = address.country;
    document.getElementById('address-postal').value = address.postalCode || '';
    document.getElementById('address-notes').value = address.notes || '';
    document.getElementById('address-default').checked = address.isDefault;
  } else {
    form.reset();
    document.getElementById('address-id').value = '';
  }

  // Show modal
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  
  // Reinitialize icons
  setTimeout(() => lucide.createIcons(), 100);
}

function closeAddressModal() {
  const modal = document.getElementById('address-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
  editingAddressId = null;
}

function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    id: editingAddressId || Date.now().toString(),
    name: document.getElementById('address-name').value.trim(),
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

  if (editingAddressId) {
    // Update existing address
    const index = addresses.findIndex(a => a.id === editingAddressId);
    if (index !== -1) {
      // If setting as default, remove default from others
      if (formData.isDefault) {
        addresses.forEach(a => a.isDefault = false);
      }
      addresses[index] = formData;
    }
  } else {
    // Add new address
    // If this is the first address or marked as default, make it default
    if (addresses.length === 0 || formData.isDefault) {
      addresses.forEach(a => a.isDefault = false);
      formData.isDefault = true;
    }
    addresses.push(formData);
  }

  saveAddresses();
  renderAddresses();
  closeAddressModal();
}

function editAddress(id) {
  const address = addresses.find(a => a.id === id);
  if (address) {
    openAddressModal(address);
  }
}

function deleteAddress(id) {
  const address = addresses.find(a => a.id === id);
  
  if (!address) return;

  const title = address.isDefault ? 'Delete Default Address?' : 'Delete Address?';
  const message = address.isDefault
    ? `Are you sure you want to delete your default address "${address.name}"?\n\nIf you have other addresses, one will be set as default automatically.`
    : `Are you sure you want to delete the address "${address.name}"? This action cannot be undone.`;

  showConfirmModal(title, message, () => {
    const wasDefault = address.isDefault;
    addresses = addresses.filter(a => a.id !== id);

    // If we deleted the default address and there are others, set the first one as default
    if (wasDefault && addresses.length > 0) {
      addresses[0].isDefault = true;
    }

    saveAddresses();
    renderAddresses();
  });
}

function setDefaultAddress(id) {
  addresses.forEach(a => {
    a.isDefault = a.id === id;
  });

  saveAddresses();
  renderAddresses();
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

  // Event listeners
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    confirmCallback = null;
    setTimeout(() => lucide.createIcons(), 100);
  };

  const handleConfirm = () => {
    if (confirmCallback) {
      confirmCallback();
    }
    closeModal();
  };

  // Remove old listeners and add new ones
  const newBtnCancel = btnCancel.cloneNode(true);
  const newBtnDelete = btnDelete.cloneNode(true);
  const newBackdrop = backdrop.cloneNode(true);
  
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
  backdrop.parentNode.replaceChild(newBackdrop, backdrop);

  newBtnCancel.addEventListener('click', closeModal);
  newBtnDelete.addEventListener('click', handleConfirm);
  newBackdrop.addEventListener('click', closeModal);

  setTimeout(() => lucide.createIcons(), 100);
}

// ====================================
// ORDER TRACKING
// ====================================
function handleTrackOrder() {
  const trackingInput = document.getElementById('tracking-input');
  
  if (!trackingInput) return;

  const orderNumber = trackingInput.value.trim();

  if (!orderNumber) {
    alert('Please enter an order number to track.');
    trackingInput.focus();
    return;
  }

  // Redirect to order details page
  window.location.href = `/buyer/orders/${encodeURIComponent(orderNumber)}`;
}

// ====================================
// UTILITY FUNCTIONS
// ====================================
function generateAddressId() {
  return `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

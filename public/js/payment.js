// ====================================
// PAYMENT PAGE - ACCOUNT & TRANSACTIONS
// PARTSFORM Buyer Portal
// ====================================

// Storage keys
const PAYMENT_METHODS_KEY = 'partsform_payment_methods';
const TRANSACTIONS_KEY = 'partsform_transactions';
const BALANCE_KEY = 'partsform_account_balance';

// Global state
let paymentMethods = [];
let transactions = [];
let accountBalance = {
  available: 0,
  pending: 0,
  totalSpent: 0
};
let editingMethodId = null;
let currentFilter = 'all';

// ====================================
// INITIALIZATION
// ====================================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderPaymentMethods();
  renderTransactions();
  updateBalanceDisplay();
  initializeEventListeners();
});

// ====================================
// EVENT LISTENERS
// ====================================
function initializeEventListeners() {
  // Add funds button
  const btnAddFunds = document.getElementById('btn-add-funds');
  if (btnAddFunds) {
    btnAddFunds.addEventListener('click', () => openFundsModal());
  }

  // Add payment method button
  const btnAddMethod = document.getElementById('btn-add-method');
  if (btnAddMethod) {
    btnAddMethod.addEventListener('click', () => openMethodModal());
  }

  // Funds modal
  const fundsModalClose = document.getElementById('funds-modal-close');
  const fundsBtnCancel = document.getElementById('funds-btn-cancel');
  const fundsBackdrop = document.querySelector('#funds-modal .payment-modal-backdrop');
  
  if (fundsModalClose) fundsModalClose.addEventListener('click', closeFundsModal);
  if (fundsBtnCancel) fundsBtnCancel.addEventListener('click', closeFundsModal);
  if (fundsBackdrop) fundsBackdrop.addEventListener('click', closeFundsModal);

  // Method modal
  const methodModalClose = document.getElementById('method-modal-close');
  const methodBtnCancel = document.getElementById('method-btn-cancel');
  const methodBackdrop = document.querySelector('#method-modal .payment-modal-backdrop');
  
  if (methodModalClose) methodModalClose.addEventListener('click', closeMethodModal);
  if (methodBtnCancel) methodBtnCancel.addEventListener('click', closeMethodModal);
  if (methodBackdrop) methodBackdrop.addEventListener('click', closeMethodModal);

  // Forms
  const addFundsForm = document.getElementById('add-funds-form');
  if (addFundsForm) {
    addFundsForm.addEventListener('submit', handleAddFunds);
  }

  const paymentMethodForm = document.getElementById('payment-method-form');
  if (paymentMethodForm) {
    paymentMethodForm.addEventListener('submit', handleSavePaymentMethod);
  }

  // Quick amount buttons
  const quickAmountBtns = document.querySelectorAll('.quick-amount-btn');
  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amount = e.currentTarget.dataset.amount;
      document.getElementById('funds-amount').value = amount;
      quickAmountBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });
  });

  // Transaction filters
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentFilter = e.currentTarget.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderTransactions();
    });
  });

  // Card number formatting
  const cardNumberInput = document.getElementById('card-number');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '');
      let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
      e.target.value = formattedValue;
    });
  }

  // Expiry date formatting
  const cardExpiryInput = document.getElementById('card-expiry');
  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      e.target.value = value;
    });
  }
}

// ====================================
// DATA MANAGEMENT
// ====================================
function loadData() {
  try {
    const storedMethods = localStorage.getItem(PAYMENT_METHODS_KEY);
    const storedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
    const storedBalance = localStorage.getItem(BALANCE_KEY);

    paymentMethods = storedMethods ? JSON.parse(storedMethods) : [];
    transactions = storedTransactions ? JSON.parse(storedTransactions) : generateSampleTransactions();
    accountBalance = storedBalance ? JSON.parse(storedBalance) : { available: 0, pending: 0, totalSpent: 0 };
  } catch (error) {
    console.error('Error loading data:', error);
    paymentMethods = [];
    transactions = generateSampleTransactions();
    accountBalance = { available: 0, pending: 0, totalSpent: 0 };
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Payment Error', 'Failed to load payment data. Please refresh the page.');
    }
  }
}

function savePaymentMethods() {
  try {
    localStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(paymentMethods));
  } catch (error) {
    console.error('Error saving payment methods:', error);
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Save Error', 'Failed to save payment methods.');
    }
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving transactions:', error);
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Save Error', 'Failed to save transaction data.');
    }
  }
}

function saveBalance() {
  try {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(accountBalance));
  } catch (error) {
    console.error('Error saving balance:', error);
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Save Error', 'Failed to save balance data.');
    }
  }
}

// ====================================
// BALANCE DISPLAY
// ====================================
function updateBalanceDisplay() {
  const balanceCards = document.querySelectorAll('.balance-amount');
  if (balanceCards.length >= 3) {
    balanceCards[0].textContent = `$${accountBalance.available.toFixed(2)}`;
    balanceCards[1].textContent = `$${accountBalance.pending.toFixed(2)}`;
    balanceCards[2].textContent = `$${accountBalance.totalSpent.toFixed(2)}`;
  }
}

// ====================================
// PAYMENT METHODS
// ====================================
function renderPaymentMethods() {
  const grid = document.getElementById('payment-methods-grid');
  const emptyState = document.getElementById('payment-methods-empty');

  if (!grid || !emptyState) return;

  if (paymentMethods.length === 0) {
    grid.style.display = 'none';
    emptyState.classList.add('show');
    lucide.createIcons();
    return;
  }

  grid.style.display = 'grid';
  emptyState.classList.remove('show');

  grid.innerHTML = paymentMethods.map(method => createPaymentMethodCard(method)).join('');
  
  lucide.createIcons();

  // Add event listeners
  paymentMethods.forEach(method => {
    const editBtn = document.getElementById(`edit-method-${method.id}`);
    const deleteBtn = document.getElementById(`delete-method-${method.id}`);
    const defaultBtn = document.getElementById(`default-method-${method.id}`);

    if (editBtn) editBtn.addEventListener('click', () => editPaymentMethod(method.id));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deletePaymentMethod(method.id));
    if (defaultBtn && !method.isDefault) {
      defaultBtn.addEventListener('click', () => setDefaultPaymentMethod(method.id));
    }
  });
}

function createPaymentMethodCard(method) {
  const isDefault = method.isDefault;
  const cardType = getCardType(method.cardNumber);
  
  return `
    <div class="payment-method-card ${isDefault ? 'default' : ''}">
      <div class="method-card-header">
        <div class="method-card-type">
          <div class="method-type-icon">
            <i data-lucide="credit-card"></i>
          </div>
          <span class="method-type-name">${cardType}</span>
        </div>
        ${isDefault ? '<div class="default-badge"><i data-lucide="check-circle"></i><span>Default</span></div>' : ''}
      </div>
      
      <div class="method-card-body">
        <div class="method-card-number">•••• •••• •••• ${method.cardNumber.slice(-4)}</div>
        <div class="method-card-expiry">Expires ${method.expiry}</div>
      </div>
      
      <div class="method-card-footer">
        <button class="btn-method-action edit" id="edit-method-${method.id}">
          <i data-lucide="edit-2"></i>
          <span>Edit</span>
        </button>
        ${!isDefault ? `
        <button class="btn-method-action set-default" id="default-method-${method.id}">
          <i data-lucide="star"></i>
          <span>Set Default</span>
        </button>
        ` : ''}
        <button class="btn-method-action delete" id="delete-method-${method.id}">
          <i data-lucide="trash-2"></i>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
}

function getCardType(cardNumber) {
  const firstDigit = cardNumber.charAt(0);
  if (firstDigit === '4') return 'Visa';
  if (firstDigit === '5') return 'Mastercard';
  if (firstDigit === '3') return 'Amex';
  return 'Card';
}

function openMethodModal(method = null) {
  const modal = document.getElementById('method-modal');
  const modalTitle = document.getElementById('method-modal-title');
  const form = document.getElementById('payment-method-form');

  if (!modal || !modalTitle || !form) return;

  editingMethodId = method ? method.id : null;

  modalTitle.textContent = method ? 'Edit Payment Method' : 'Add Payment Method';

  if (method) {
    document.getElementById('method-id').value = method.id;
    document.getElementById('card-name').value = method.cardName;
    document.getElementById('card-number').value = method.cardNumber;
    document.getElementById('card-expiry').value = method.expiry;
    document.getElementById('card-cvv').value = '';
    document.getElementById('method-default').checked = method.isDefault;
  } else {
    form.reset();
    document.getElementById('method-id').value = '';
  }

  modal.classList.add('active');
  document.body.classList.add('modal-open');
  
  setTimeout(() => lucide.createIcons(), 100);
}

function closeMethodModal() {
  const modal = document.getElementById('method-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
  editingMethodId = null;
}

function handleSavePaymentMethod(e) {
  e.preventDefault();

  const formData = {
    id: editingMethodId || Date.now().toString(),
    cardName: document.getElementById('card-name').value.trim(),
    cardNumber: document.getElementById('card-number').value.replace(/\s/g, ''),
    expiry: document.getElementById('card-expiry').value.trim(),
    isDefault: document.getElementById('method-default').checked,
  };

  if (editingMethodId) {
    const index = paymentMethods.findIndex(m => m.id === editingMethodId);
    if (index !== -1) {
      if (formData.isDefault) {
        paymentMethods.forEach(m => m.isDefault = false);
      }
      paymentMethods[index] = formData;
    }
  } else {
    if (paymentMethods.length === 0 || formData.isDefault) {
      paymentMethods.forEach(m => m.isDefault = false);
      formData.isDefault = true;
    }
    paymentMethods.push(formData);
  }

  savePaymentMethods();
  renderPaymentMethods();
  closeMethodModal();
}

function editPaymentMethod(id) {
  const method = paymentMethods.find(m => m.id === id);
  if (method) {
    openMethodModal(method);
  }
}

function deletePaymentMethod(id) {
  const method = paymentMethods.find(m => m.id === id);
  if (!method) return;

  if (confirm(`Are you sure you want to delete this payment method ending in ${method.cardNumber.slice(-4)}?`)) {
    const wasDefault = method.isDefault;
    paymentMethods = paymentMethods.filter(m => m.id !== id);

    if (wasDefault && paymentMethods.length > 0) {
      paymentMethods[0].isDefault = true;
    }

    savePaymentMethods();
    renderPaymentMethods();
  }
}

function setDefaultPaymentMethod(id) {
  paymentMethods.forEach(m => {
    m.isDefault = m.id === id;
  });

  savePaymentMethods();
  renderPaymentMethods();
}

// ====================================
// ADD FUNDS
// ====================================
function openFundsModal() {
  const modal = document.getElementById('funds-modal');
  const form = document.getElementById('add-funds-form');

  if (!modal || !form) return;

  form.reset();
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  
  setTimeout(() => lucide.createIcons(), 100);
}

function closeFundsModal() {
  const modal = document.getElementById('funds-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

function handleAddFunds(e) {
  e.preventDefault();

  const amount = parseFloat(document.getElementById('funds-amount').value);
  const paymentMethod = document.getElementById('payment-method').value;

  if (amount < 10) {
    alert('Minimum amount is $10.00');
    return;
  }

  // Add transaction
  const transaction = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    description: 'Account Top-up',
    type: 'credit',
    amount: amount,
    status: 'completed'
  };

  transactions.unshift(transaction);
  accountBalance.available += amount;

  saveTransactions();
  saveBalance();
  updateBalanceDisplay();
  renderTransactions();
  closeFundsModal();

  alert(`Successfully added $${amount.toFixed(2)} to your account!`);
}

// ====================================
// TRANSACTIONS
// ====================================
function renderTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('transactions-empty');
  const tableWrapper = document.querySelector('.transactions-table-wrapper');

  if (!tbody || !emptyState || !tableWrapper) return;

  let filteredTransactions = transactions;
  
  if (currentFilter !== 'all') {
    filteredTransactions = transactions.filter(t => t.status === currentFilter);
  }

  if (filteredTransactions.length === 0) {
    tableWrapper.style.display = 'none';
    emptyState.classList.add('show');
    lucide.createIcons();
    return;
  }

  tableWrapper.style.display = 'block';
  emptyState.classList.remove('show');

  tbody.innerHTML = filteredTransactions.map(transaction => createTransactionRow(transaction)).join('');
  
  lucide.createIcons();
}

function createTransactionRow(transaction) {
  const date = new Date(transaction.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const amountClass = transaction.type === 'credit' ? 'positive' : 'negative';
  const amountSign = transaction.type === 'credit' ? '+' : '-';

  return `
    <tr>
      <td class="transaction-date">${formattedDate}</td>
      <td class="transaction-description">${transaction.description}</td>
      <td>
        <span class="transaction-type ${transaction.type}">
          ${transaction.type === 'credit' ? 'Credit' : 'Debit'}
        </span>
      </td>
      <td class="transaction-amount ${amountClass}">
        ${amountSign}$${transaction.amount.toFixed(2)}
      </td>
      <td>
        <span class="transaction-status ${transaction.status}">
          <i data-lucide="${getStatusIcon(transaction.status)}"></i>
          <span>${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}</span>
        </span>
      </td>
      <td>
        <button class="btn-view-transaction" onclick="viewTransaction('${transaction.id}')">
          <i data-lucide="eye"></i>
          <span>View</span>
        </button>
      </td>
    </tr>
  `;
}

function getStatusIcon(status) {
  switch (status) {
    case 'completed': return 'check-circle';
    case 'pending': return 'clock';
    case 'refunded': return 'rotate-ccw';
    default: return 'circle';
  }
}

function viewTransaction(id) {
  const transaction = transactions.find(t => t.id === id);
  if (transaction) {
    alert(`Transaction Details:\n\nID: ${transaction.id}\nDate: ${new Date(transaction.date).toLocaleString()}\nDescription: ${transaction.description}\nType: ${transaction.type}\nAmount: $${transaction.amount.toFixed(2)}\nStatus: ${transaction.status}`);
  }
}

// ====================================
// SAMPLE DATA
// ====================================
function generateSampleTransactions() {
  const now = new Date();
  return [
    {
      id: '1',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Aircraft Part Purchase - PN-12345',
      type: 'debit',
      amount: 1250.00,
      status: 'completed'
    },
    {
      id: '2',
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Account Top-up',
      type: 'credit',
      amount: 2000.00,
      status: 'completed'
    },
    {
      id: '3',
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Machinery Component - MC-789',
      type: 'debit',
      amount: 850.50,
      status: 'completed'
    },
    {
      id: '4',
      date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Pending Order - ORD-456',
      type: 'debit',
      amount: 450.00,
      status: 'pending'
    }
  ];
}

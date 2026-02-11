// ====================================
// CONTACTS PAGE - SIMPLIFIED
// ====================================

const CONTACTS_STORAGE_KEY = 'partsform_contact_messages';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeForm();
});

function initializeForm() {
  const form = document.getElementById('contact-form');
  const messageTextarea = document.getElementById('contact-message');
  const btnSendAnother = document.getElementById('btn-send-another');

  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  if (messageTextarea) {
    messageTextarea.addEventListener('input', updateCharCount);
    updateCharCount(); // Initialize count
  }

  if (btnSendAnother) {
    btnSendAnother.addEventListener('click', resetForm);
  }
}

// Handle form submission
function handleSubmit(e) {
  e.preventDefault();

  const formData = {
    id: Date.now().toString(),
    name: document.getElementById('contact-name').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    phone: document.getElementById('contact-phone').value.trim(),
    subject: document.getElementById('contact-subject').value,
    message: document.getElementById('contact-message').value.trim(),
    timestamp: new Date().toISOString(),
  };

  // Validate
  if (formData.message.length > 1000) {
    alert('Message is too long. Please keep it under 1000 characters.');
    return;
  }

  if (!isValidEmail(formData.email)) {
    alert('Please enter a valid email address.');
    return;
  }

  // Save to localStorage
  saveMessage(formData);

  // Show success
  showSuccess();

  console.log('Contact form submitted:', formData);
}

// Save message
function saveMessage(message) {
  try {
    const messages = getMessages();
    messages.push(message);
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving message:', error);
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Save Error', 'Failed to save your message. Please try again.');
    }
  }
}

// Get messages
function getMessages() {
  try {
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading messages:', error);
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert('error', 'Load Error', 'Failed to load saved messages.');
    }
    return [];
  }
}

// Show success message
function showSuccess() {
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');

  if (form && success) {
    form.style.display = 'none';
    success.style.display = 'block';
    
    setTimeout(() => lucide.createIcons(), 100);
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Reset form
function resetForm() {
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');

  if (form && success) {
    form.reset();
    form.style.display = 'flex';
    success.style.display = 'none';
    
    updateCharCount();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Update character count
function updateCharCount() {
  const textarea = document.getElementById('contact-message');
  const counter = document.getElementById('char-count');
  const counterDiv = counter?.parentElement;

  if (!textarea || !counter || !counterDiv) return;

  const length = textarea.value.length;
  const max = 1000;

  counter.textContent = length;

  counterDiv.classList.remove('warning', 'error');
  
  if (length > max) {
    counterDiv.classList.add('error');
  } else if (length > max * 0.9) {
    counterDiv.classList.add('warning');
  }
}

// Validate email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

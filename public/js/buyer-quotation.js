// ====================================
// BUYER QUOTATION INVOICE GENERATOR
// PARTSFORM Buyer Portal
// ====================================

(function () {
  'use strict';

  // Quotation state
  let quotationState = {
    logo: null,
    logoUrl: null,
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    customerName: '',
    customerEmail: '',
    markup: 0,
    currency: 'AED',
    validity: 7,
    quotationNumber: '',
    notes: '',
    items: [],
  };

  // Local storage key for saved company info
  const COMPANY_INFO_KEY = 'partsform_buyer_company_info';

  // Currency symbols
  const currencySymbols = {
    AED: 'د.إ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    SAR: '﷼',
  };

  // DOM Elements
  let DOM = {};

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    // Only initialize on cart page with quotation modal
    if (!document.getElementById('quotation-modal')) {
      return;
    }

    cacheDOMElements();
    loadSavedCompanyInfo();
    generateQuotationNumber();
    attachEventListeners();
  }

  function cacheDOMElements() {
    DOM = {
      // Main quotation modal
      quotationModal: document.getElementById('quotation-modal'),
      quotationBackdrop: document.getElementById('quotation-backdrop'),
      quotationCloseBtn: document.getElementById('quotation-close-btn'),
      quotationCancelBtn: document.getElementById('quotation-cancel-btn'),
      createQuotationBtn: document.getElementById('create-quotation-btn'),
      
      // Logo upload
      logoUploadArea: document.getElementById('logo-upload-area'),
      logoInput: document.getElementById('quotation-logo-input'),
      logoPreview: document.getElementById('logo-preview'),
      logoPreviewImg: document.getElementById('logo-preview-img'),
      logoPlaceholder: document.getElementById('logo-placeholder'),
      removeLogoBtn: document.getElementById('remove-logo-btn'),
      
      // Company fields
      companyName: document.getElementById('quote-company-name'),
      companyEmail: document.getElementById('quote-company-email'),
      companyPhone: document.getElementById('quote-company-phone'),
      companyAddress: document.getElementById('quote-company-address'),
      
      // Customer fields
      customerName: document.getElementById('quote-customer-name'),
      customerEmail: document.getElementById('quote-customer-email'),
      
      // Pricing fields
      markup: document.getElementById('quote-markup'),
      currency: document.getElementById('quote-currency'),
      validity: document.getElementById('quote-validity'),
      quotationNumber: document.getElementById('quote-number'),
      notes: document.getElementById('quote-notes'),
      
      // Preview elements
      itemsCount: document.getElementById('quote-items-count'),
      itemsPreview: document.getElementById('quote-items-preview'),
      subtotal: document.getElementById('quote-subtotal'),
      markupPercentDisplay: document.getElementById('markup-percent-display'),
      markupAmount: document.getElementById('quote-markup-amount'),
      grandTotal: document.getElementById('quote-grand-total'),
      
      // Action buttons
      previewQuotationBtn: document.getElementById('preview-quotation-btn'),
      downloadQuotationBtn: document.getElementById('download-quotation-btn'),
      
      // Preview modal
      previewModal: document.getElementById('quotation-preview-modal'),
      previewBackdrop: document.getElementById('preview-backdrop'),
      previewCloseBtn: document.getElementById('preview-close-btn'),
      previewBackBtn: document.getElementById('preview-back-btn'),
      previewDownloadBtn: document.getElementById('preview-download-btn'),
      previewFrame: document.getElementById('quotation-preview-frame'),
    };
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function attachEventListeners() {
    // Open modal
    if (DOM.createQuotationBtn) {
      DOM.createQuotationBtn.addEventListener('click', openQuotationModal);
    }

    // Close modal
    if (DOM.quotationCloseBtn) {
      DOM.quotationCloseBtn.addEventListener('click', closeQuotationModal);
    }
    if (DOM.quotationCancelBtn) {
      DOM.quotationCancelBtn.addEventListener('click', closeQuotationModal);
    }
    if (DOM.quotationBackdrop) {
      DOM.quotationBackdrop.addEventListener('click', closeQuotationModal);
    }

    // Logo upload
    if (DOM.logoUploadArea) {
      DOM.logoUploadArea.addEventListener('click', () => DOM.logoInput.click());
    }
    if (DOM.logoInput) {
      DOM.logoInput.addEventListener('change', handleLogoUpload);
    }
    if (DOM.removeLogoBtn) {
      DOM.removeLogoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeLogo();
      });
    }

    // Form field changes
    if (DOM.markup) {
      DOM.markup.addEventListener('input', updateQuotationPreview);
    }
    if (DOM.currency) {
      DOM.currency.addEventListener('change', updateQuotationPreview);
    }

    // Company info fields - auto save
    const companyFields = [DOM.companyName, DOM.companyEmail, DOM.companyPhone, DOM.companyAddress];
    companyFields.forEach(field => {
      if (field) {
        field.addEventListener('blur', saveCompanyInfo);
      }
    });

    // Preview button
    if (DOM.previewQuotationBtn) {
      DOM.previewQuotationBtn.addEventListener('click', showQuotationPreview);
    }

    // Download button
    if (DOM.downloadQuotationBtn) {
      DOM.downloadQuotationBtn.addEventListener('click', downloadQuotationPDF);
    }

    // Preview modal close
    if (DOM.previewCloseBtn) {
      DOM.previewCloseBtn.addEventListener('click', closePreviewModal);
    }
    if (DOM.previewBackBtn) {
      DOM.previewBackBtn.addEventListener('click', closePreviewModal);
    }
    if (DOM.previewBackdrop) {
      DOM.previewBackdrop.addEventListener('click', closePreviewModal);
    }
    if (DOM.previewDownloadBtn) {
      DOM.previewDownloadBtn.addEventListener('click', downloadQuotationPDF);
    }
  }

  // ====================================
  // MODAL MANAGEMENT
  // ====================================
  function openQuotationModal() {
    const cartItems = window.PartsFormCart ? window.PartsFormCart.getCartItems() : [];
    
    if (cartItems.length === 0) {
      showAlert('info', 'Empty Cart', 'Add items to your cart before creating a quotation');
      return;
    }

    quotationState.items = cartItems;
    generateQuotationNumber();
    updateQuotationPreview();
    
    DOM.quotationModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Recreate icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function closeQuotationModal() {
    DOM.quotationModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function closePreviewModal() {
    DOM.previewModal.style.display = 'none';
    DOM.previewFrame.src = 'about:blank';
  }

  // ====================================
  // LOGO HANDLING
  // ====================================
  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showAlert('error', 'Invalid File', 'Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showAlert('error', 'File Too Large', 'Logo must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      quotationState.logo = file;
      quotationState.logoUrl = event.target.result;
      
      DOM.logoPreviewImg.src = event.target.result;
      DOM.logoPreview.style.display = 'block';
      DOM.logoPlaceholder.style.display = 'none';
      
      // Save to local storage
      saveCompanyInfo();
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    quotationState.logo = null;
    quotationState.logoUrl = null;
    
    DOM.logoPreviewImg.src = '';
    DOM.logoPreview.style.display = 'none';
    DOM.logoPlaceholder.style.display = 'flex';
    DOM.logoInput.value = '';
    
    // Save to local storage
    saveCompanyInfo();
  }

  // ====================================
  // LOCAL STORAGE - COMPANY INFO
  // ====================================
  function loadSavedCompanyInfo() {
    try {
      const saved = localStorage.getItem(COMPANY_INFO_KEY);
      if (saved) {
        const info = JSON.parse(saved);
        
        if (info.companyName && DOM.companyName) {
          DOM.companyName.value = info.companyName;
          quotationState.companyName = info.companyName;
        }
        if (info.companyEmail && DOM.companyEmail) {
          DOM.companyEmail.value = info.companyEmail;
          quotationState.companyEmail = info.companyEmail;
        }
        if (info.companyPhone && DOM.companyPhone) {
          DOM.companyPhone.value = info.companyPhone;
          quotationState.companyPhone = info.companyPhone;
        }
        if (info.companyAddress && DOM.companyAddress) {
          DOM.companyAddress.value = info.companyAddress;
          quotationState.companyAddress = info.companyAddress;
        }
        if (info.logoUrl && DOM.logoPreviewImg) {
          quotationState.logoUrl = info.logoUrl;
          DOM.logoPreviewImg.src = info.logoUrl;
          DOM.logoPreview.style.display = 'block';
          DOM.logoPlaceholder.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error loading saved company info:', error);
    }
  }

  function saveCompanyInfo() {
    try {
      const info = {
        companyName: DOM.companyName?.value || '',
        companyEmail: DOM.companyEmail?.value || '',
        companyPhone: DOM.companyPhone?.value || '',
        companyAddress: DOM.companyAddress?.value || '',
        logoUrl: quotationState.logoUrl,
      };
      localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(info));
      
      // Update state
      quotationState.companyName = info.companyName;
      quotationState.companyEmail = info.companyEmail;
      quotationState.companyPhone = info.companyPhone;
      quotationState.companyAddress = info.companyAddress;
    } catch (error) {
      console.error('Error saving company info:', error);
    }
  }

  // ====================================
  // QUOTATION GENERATION
  // ====================================
  function generateQuotationNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const number = `QT-${year}${month}${day}-${random}`;
    
    quotationState.quotationNumber = number;
    if (DOM.quotationNumber) {
      DOM.quotationNumber.value = number;
    }
  }

  function updateQuotationPreview() {
    const items = quotationState.items;
    const markup = parseFloat(DOM.markup?.value) || 0;
    const currency = DOM.currency?.value || 'AED';
    
    quotationState.markup = markup;
    quotationState.currency = currency;

    // Update markup display
    if (DOM.markupPercentDisplay) {
      DOM.markupPercentDisplay.textContent = markup;
    }

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.price) || 0;
    });

    const markupAmount = subtotal * (markup / 100);
    const grandTotal = subtotal + markupAmount;

    // Update display
    if (DOM.itemsCount) {
      DOM.itemsCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    }

    if (DOM.subtotal) {
      DOM.subtotal.textContent = `${subtotal.toFixed(2)} ${currency}`;
    }

    if (DOM.markupAmount) {
      DOM.markupAmount.textContent = `+${markupAmount.toFixed(2)} ${currency}`;
    }

    if (DOM.grandTotal) {
      DOM.grandTotal.textContent = `${grandTotal.toFixed(2)} ${currency}`;
    }

    // Render items preview
    renderItemsPreview(items, markup, currency);
  }

  function renderItemsPreview(items, markup, currency) {
    if (!DOM.itemsPreview) return;

    const markupMultiplier = 1 + (markup / 100);

    let html = `
      <table class="quote-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Part Number</th>
            <th>Brand</th>
            <th>Description</th>
            <th>QTY</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach((item, index) => {
      const unitPrice = (parseFloat(item.price) || 0) * markupMultiplier;
      const total = unitPrice; // Each item is qty = 1

      html += `
        <tr>
          <td>${index + 1}</td>
          <td><span class="part-num">${escapeHtml(item.code)}</span></td>
          <td><span class="brand-badge-mini">${escapeHtml(item.brand)}</span></td>
          <td>${escapeHtml(item.description || '-')}</td>
          <td>1</td>
          <td>${unitPrice.toFixed(2)} ${currency}</td>
          <td><strong>${total.toFixed(2)} ${currency}</strong></td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    DOM.itemsPreview.innerHTML = html;
  }

  // ====================================
  // QUOTATION PREVIEW
  // ====================================
  function showQuotationPreview() {
    collectFormData();
    const htmlContent = generateQuotationHTML();
    
    DOM.previewFrame.srcdoc = htmlContent;
    DOM.previewModal.style.display = 'flex';
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // PDF DOWNLOAD
  // ====================================
  async function downloadQuotationPDF() {
    collectFormData();
    
    // Show loading state
    const downloadBtn = DOM.downloadQuotationBtn;
    const previewDownloadBtn = DOM.previewDownloadBtn;
    
    if (downloadBtn) {
      downloadBtn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>Generating...</span>';
      downloadBtn.disabled = true;
    }
    if (previewDownloadBtn) {
      previewDownloadBtn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>Generating...</span>';
      previewDownloadBtn.disabled = true;
    }

    try {
      // Prepare data for backend
      const requestData = {
        logoBase64: quotationState.logoUrl,
        companyName: quotationState.companyName,
        companyEmail: quotationState.companyEmail,
        companyPhone: quotationState.companyPhone,
        companyAddress: quotationState.companyAddress,
        customerName: quotationState.customerName,
        customerEmail: quotationState.customerEmail,
        markup: quotationState.markup,
        currency: quotationState.currency,
        validity: quotationState.validity,
        quotationNumber: quotationState.quotationNumber,
        notes: quotationState.notes,
        items: quotationState.items,
      };

      // Call backend API
      const response = await fetch('/buyer/api/quotation/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get PDF blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation_${quotationState.quotationNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showAlert('success', 'PDF Downloaded', 'Quotation PDF generated successfully');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      showAlert('error', 'Error', 'Failed to generate PDF. Please try again.');
    } finally {
      // Reset button state
      if (downloadBtn) {
        downloadBtn.innerHTML = '<i data-lucide="download"></i><span>Download PDF</span>';
        downloadBtn.disabled = false;
      }
      if (previewDownloadBtn) {
        previewDownloadBtn.innerHTML = '<i data-lucide="download"></i><span>Download PDF</span>';
        previewDownloadBtn.disabled = false;
      }
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  // Quick download (from cart actions bar - uses PartsForm branding)
  async function quickDownloadQuotation() {
    const cartItems = window.PartsFormCart ? window.PartsFormCart.getCartItems() : [];
    
    if (cartItems.length === 0) {
      showAlert('info', 'Empty Cart', 'Add items to your cart before downloading a quotation');
      return;
    }

    generateQuotationNumber();

    const quickBtn = document.getElementById('download-quotation-quick-btn');
    if (quickBtn) {
      quickBtn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>Generating...</span>';
      quickBtn.disabled = true;
    }

    try {
      // Prepare data for backend (uses PartsForm branding by default)
      const requestData = {
        customerName: 'Valued Customer',
        customerEmail: '',
        markup: 0,
        currency: 'AED',
        validity: 7,
        quotationNumber: quotationState.quotationNumber,
        notes: '',
        items: cartItems,
      };

      // Call backend API
      const response = await fetch('/buyer/api/quotation/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get PDF blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation_${quotationState.quotationNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showAlert('success', 'PDF Downloaded', 'Quotation PDF generated successfully');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      showAlert('error', 'Error', 'Failed to generate PDF. Please try again.');
    } finally {
      if (quickBtn) {
        quickBtn.innerHTML = '<i data-lucide="download"></i><span>Download Quotation</span>';
        quickBtn.disabled = false;
      }
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  // Expose quick download function
  window.quickDownloadQuotation = quickDownloadQuotation;

  function collectFormData() {
    quotationState.companyName = DOM.companyName?.value || '';
    quotationState.companyEmail = DOM.companyEmail?.value || '';
    quotationState.companyPhone = DOM.companyPhone?.value || '';
    quotationState.companyAddress = DOM.companyAddress?.value || '';
    quotationState.customerName = DOM.customerName?.value || '';
    quotationState.customerEmail = DOM.customerEmail?.value || '';
    quotationState.markup = parseFloat(DOM.markup?.value) || 0;
    quotationState.currency = DOM.currency?.value || 'AED';
    quotationState.validity = parseInt(DOM.validity?.value) || 7;
    quotationState.notes = DOM.notes?.value || '';
  }

  // ====================================
  // QUOTATION HTML GENERATION
  // ====================================
  function generateQuotationHTML() {
    const {
      logoUrl,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      customerName,
      customerEmail,
      markup,
      currency,
      validity,
      quotationNumber,
      notes,
      items,
    } = quotationState;

    const currencySymbol = currencySymbols[currency] || currency;
    const markupMultiplier = 1 + (markup / 100);
    const today = new Date();
    const validUntil = new Date(today.getTime() + validity * 24 * 60 * 60 * 1000);

    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatCurrency = (amount) => {
      return `${currencySymbol} ${amount.toFixed(2)}`;
    };

    // Calculate totals
    let subtotal = 0;
    const itemsWithMarkup = items.map((item, index) => {
      const originalPrice = parseFloat(item.price) || 0;
      const markedUpPrice = originalPrice * markupMultiplier;
      subtotal += markedUpPrice;
      return {
        ...item,
        displayPrice: markedUpPrice,
        index: index + 1,
      };
    });

    const grandTotal = subtotal;

    // Generate items HTML
    const itemsHTML = itemsWithMarkup.map(item => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 13px;">${item.index}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${escapeHtml(item.code)}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(item.brand)}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 13px; max-width: 200px;">${escapeHtml(item.description || '-')}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #1f2937;">1</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; font-size: 13px;">${formatCurrency(item.displayPrice)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #1f2937;">${formatCurrency(item.displayPrice)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation ${quotationNumber}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      @page { margin: 0.5in; size: A4; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.5; 
      color: #1f2937;
      background: #ffffff;
    }
    .quotation-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e3a5f;
    }
    .company-info {
      flex: 1;
    }
    .company-logo {
      max-width: 180px;
      max-height: 80px;
      margin-bottom: 12px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .company-details {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.7;
    }
    .quotation-badge {
      text-align: right;
    }
    .quotation-title {
      font-size: 32px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 12px;
      letter-spacing: -1px;
    }
    .quotation-meta {
      font-size: 13px;
      color: #6b7280;
    }
    .quotation-meta strong {
      color: #1f2937;
      display: block;
      font-size: 15px;
    }
    .info-section {
      display: flex;
      gap: 40px;
      margin-bottom: 30px;
    }
    .info-box {
      flex: 1;
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .info-box-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .info-box-content {
      font-size: 14px;
      color: #1f2937;
    }
    .info-box-content strong {
      display: block;
      font-size: 16px;
      margin-bottom: 4px;
    }
    .items-section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .items-count {
      background: #e8f0f8;
      color: #1e3a5f;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .items-table thead tr {
      background: linear-gradient(135deg, #1e3a5f 0%, #152a45 100%);
    }
    .items-table th {
      padding: 12px 8px;
      text-align: left;
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table th:nth-child(5),
    .items-table th:nth-child(6),
    .items-table th:nth-child(7) {
      text-align: right;
    }
    .items-table th:nth-child(1),
    .items-table th:nth-child(5) {
      text-align: center;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    .totals-section {
      margin-left: auto;
      width: 300px;
      margin-bottom: 30px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .total-row.grand-total {
      border-bottom: none;
      border-top: 2px solid #1e3a5f;
      padding-top: 15px;
      margin-top: 5px;
    }
    .total-row.grand-total span:first-child {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }
    .total-row.grand-total span:last-child {
      font-size: 20px;
      font-weight: 700;
      color: #1e3a5f;
    }
    .notes-section {
      background: #e8f4f8;
      border: 1px solid #1e3a5f;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .notes-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 8px;
    }
    .notes-content {
      font-size: 13px;
      color: #374151;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer strong {
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="quotation-container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" class="company-logo">` : ''}
        ${companyName ? `<div class="company-name">${escapeHtml(companyName)}</div>` : ''}
        <div class="company-details">
          ${companyAddress ? `${escapeHtml(companyAddress)}<br>` : ''}
          ${companyEmail ? `${escapeHtml(companyEmail)}` : ''}
          ${companyPhone ? ` • ${escapeHtml(companyPhone)}` : ''}
        </div>
      </div>
      <div class="quotation-badge">
        <div class="quotation-title">QUOTATION</div>
        <div class="quotation-meta">
          <strong>${quotationNumber}</strong>
          Date: ${formatDate(today)}<br>
          Valid Until: <span style="color: #dc2626; font-weight: 600;">${formatDate(validUntil)}</span>
        </div>
      </div>
    </div>

    <!-- Customer & Quotation Info -->
    <div class="info-section">
      <div class="info-box">
        <div class="info-box-title">Quotation For</div>
        <div class="info-box-content">
          ${customerName ? `<strong>${escapeHtml(customerName)}</strong>` : '<strong>Valued Customer</strong>'}
          ${customerEmail ? escapeHtml(customerEmail) : ''}
        </div>
      </div>
      <div class="info-box">
        <div class="info-box-title">Quotation Details</div>
        <div class="info-box-content">
          <strong>Reference: ${quotationNumber}</strong>
          Total Items: ${items.length} • Currency: ${currency}
        </div>
      </div>
    </div>

    <!-- Items -->
    <div class="items-section">
      <div class="section-title">
        Quoted Items
        <span class="items-count">${items.length} items</span>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="width: 120px;">Part Number</th>
            <th style="width: 100px;">Brand</th>
            <th>Description</th>
            <th style="width: 50px; text-align: center;">Qty</th>
            <th style="width: 100px; text-align: right;">Unit Price</th>
            <th style="width: 100px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Grand Total:</span>
        <span>${formatCurrency(grandTotal)}</span>
      </div>
    </div>

    ${notes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="notes-title">Additional Notes</div>
      <div class="notes-content">${escapeHtml(notes)}</div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      ${companyName ? `<strong>${escapeHtml(companyName)}</strong> • ` : ''}
      Quotation generated on ${formatDate(today)}
    </div>
  </div>
</body>
</html>
    `;
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

  function showAlert(type, title, message) {
    // Try to use the cart's alert system if available
    if (window.PartsFormCart && window.PartsFormCart.showAlert) {
      window.PartsFormCart.showAlert(type, title, message);
      return;
    }

    // Fallback alert system
    const icons = {
      success: 'check-circle',
      error: 'x-circle',
      info: 'info',
    };

    let alertsContainer = document.querySelector('.cart-alerts');
    if (!alertsContainer) {
      alertsContainer = document.createElement('div');
      alertsContainer.className = 'cart-alerts';
      alertsContainer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 2rem;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 400px;
      `;
      document.body.appendChild(alertsContainer);
    }

    const alert = document.createElement('div');
    alert.className = `cart-alert ${type}`;
    alert.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="cart-alert-icon"></i>
      <div class="cart-alert-content">
        <div class="cart-alert-title">${escapeHtml(title)}</div>
        <p class="cart-alert-message">${escapeHtml(message)}</p>
      </div>
      <button class="cart-alert-close">
        <i data-lucide="x"></i>
      </button>
    `;

    alertsContainer.appendChild(alert);

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    const closeBtn = alert.querySelector('.cart-alert-close');
    closeBtn.addEventListener('click', () => alert.remove());

    setTimeout(() => {
      if (alert.parentElement) {
        alert.remove();
      }
    }, 5000);
  }

  // ====================================
  // INITIALIZE
  // ====================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ====================================
// AOG CASE CREATE - JAVASCRIPT
// PARTSFORM Aviation Emergency Response
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const caseTypeRadios = document.querySelectorAll('input[name="caseType"]');
  const urgencyIndicator = document.getElementById('urgency-indicator');
  const btnSubmit = document.getElementById('btn-submit');
  const btnCancel = document.getElementById('btn-cancel');
  const partsListContainer = document.getElementById('selected-parts-list');
  const totalPartsCount = document.getElementById('total-parts-count');
  const totalPartsAmount = document.getElementById('total-parts-amount');

  let selectedParts = [];
  let partsTotal = 0;

  // ====================================
  // LOAD SELECTED PARTS FROM SESSION
  // ====================================
  function loadSelectedParts() {
    const partsData = sessionStorage.getItem('aog-selected-parts');
    const totalData = sessionStorage.getItem('aog-parts-total');

    if (!partsData) {
      // No parts selected, redirect back to search
      alert('No parts selected. Please select parts from aviation search first.');
      window.location.href = '/buyer/search-aviation';
      return;
    }

    selectedParts = JSON.parse(partsData);
    partsTotal = parseFloat(totalData) || 0;

    // Render parts list
    renderPartsList();
  }

  function renderPartsList() {
    if (selectedParts.length === 0) {
      partsListContainer.innerHTML = `
        <div class="empty-parts-message">
          <i data-lucide="package-x"></i>
          <p>No parts selected</p>
        </div>
      `;
      return;
    }

    partsListContainer.innerHTML = selectedParts
      .map(
        (part) => `
      <div class="part-item">
        <div class="part-icon">
          <i data-lucide="package"></i>
        </div>
        <div class="part-details">
          <div class="part-name">${part.description || 'Aviation Part'}</div>
          <div class="part-number">P/N: ${part.vendorCode}</div>
          <div class="part-meta">
            <span><i data-lucide="building"></i> ${part.supplier}</span>
            <span><i data-lucide="map-pin"></i> ${part.origin}</span>
          </div>
        </div>
        <div class="part-quantity">
          <span>Qty: ${part.quantity}</span>
        </div>
        <div class="part-price">
          ${part.total.toFixed(2)} AED
        </div>
      </div>
    `
      )
      .join('');

    // Update summary
    totalPartsCount.textContent = selectedParts.length;
    totalPartsAmount.textContent = `${partsTotal.toFixed(2)} AED`;

    // Recreate icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // CASE TYPE SELECTION
  // ====================================

  caseTypeRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      updateUrgencyIndicator(selectedType);
    });
  });

  function updateUrgencyIndicator(type) {
    // Remove all type classes
    urgencyIndicator.classList.remove('critical', 'routine', 'scheduled');

    // Update based on selected type
    const urgencyIcon = urgencyIndicator.querySelector('i');
    const urgencyTitle = urgencyIndicator.querySelector('.urgency-title');
    const urgencyDesc = urgencyIndicator.querySelector('.urgency-desc');

    switch (type) {
      case 'aog':
        urgencyIndicator.classList.add('critical');
        urgencyIcon.setAttribute('data-lucide', 'zap');
        urgencyTitle.textContent = 'Priority Sourcing Active';
        urgencyDesc.textContent =
          'SLA timers and escalation protocols will be activated';
        break;
      case 'routine':
        urgencyIndicator.classList.add('routine');
        urgencyIcon.setAttribute('data-lucide', 'clock');
        urgencyTitle.textContent = 'Standard Processing';
        urgencyDesc.textContent =
          'Normal procurement timeline with standard delivery';
        break;
      case 'scheduled':
        urgencyIndicator.classList.add('scheduled');
        urgencyIcon.setAttribute('data-lucide', 'calendar');
        urgencyTitle.textContent = 'Planned Maintenance';
        urgencyDesc.textContent =
          'Scheduled delivery aligned with maintenance window';
        break;
    }

    // Recreate icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ====================================
  // FORM VALIDATION & SUBMISSION
  // ====================================

  btnSubmit.addEventListener('click', (e) => {
    e.preventDefault();

    // Get form values
    const caseType = document.querySelector(
      'input[name="caseType"]:checked'
    ).value;
    const aircraftType = document.getElementById('aircraft-type').value;
    const tailNumber = document.getElementById('tail-number').value;
    const station = document.getElementById('station').value;
    const requiredBy = document.getElementById('required-by').value;
    const notes = document.getElementById('notes').value;

    // Basic validation
    if (!aircraftType || !tailNumber || !station || !requiredBy) {
      alert('Please fill in all required fields');
      return;
    }

    if (selectedParts.length === 0) {
      alert('No parts selected for this case');
      return;
    }

    // Store case information in sessionStorage for checkout
    const caseInfo = {
      caseType,
      aircraftType,
      tailNumber,
      station,
      requiredBy,
      notes,
    };

    sessionStorage.setItem('aog-case-info', JSON.stringify(caseInfo));
    sessionStorage.setItem('aog-parts', JSON.stringify(selectedParts));
    sessionStorage.setItem('aog-total', partsTotal.toFixed(2));
    sessionStorage.setItem('is-aog-case', 'true');

    // Show success message
    btnSubmit.innerHTML = `
      <i data-lucide="check-circle"></i>
      <span>Proceeding to Checkout...</span>
    `;
    btnSubmit.style.background =
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Redirect to checkout
    setTimeout(() => {
      window.location.href = '/buyer/checkout';
    }, 800);
  });

  // Cancel button
  btnCancel.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel? All data will be lost.')) {
      // Clear session data
      sessionStorage.removeItem('aog-selected-parts');
      sessionStorage.removeItem('aog-parts-total');
      window.location.href = '/buyer/search-aviation';
    }
  });

  // ====================================
  // SET DEFAULT REQUIRED-BY TIME
  // ====================================

  const requiredByInput = document.getElementById('required-by');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  requiredByInput.value = tomorrow.toISOString().slice(0, 16);

  // ====================================
  // INITIALIZE
  // ====================================
  loadSelectedParts();
});

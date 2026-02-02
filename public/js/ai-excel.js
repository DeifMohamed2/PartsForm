// ====================================
// AI EXCEL IMPORT - INTELLIGENT SPREADSHEET PROCESSING
// Premium Excel Import with Gemini AI Integration
// ====================================

(function() {
  'use strict';

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const AIExcelState = {
    currentStep: 'upload', // upload, analyzing, results, search-results
    fileName: '',
    fileData: null,
    analyzedParts: [],
    selectedParts: [],
    searchResults: [],
    recommendations: [],
    dataQuality: null,
    suggestions: [],
    isLoading: false,
    // Analytics
    duplicates: [],
    notFoundParts: [],
    totalOriginalParts: 0,
  };

  // ====================================
  // DOM ELEMENTS
  // ====================================
  let elements = {};

  // ====================================
  // INITIALIZATION
  // ====================================
  function init() {
    cacheElements();
    setupEventListeners();
    console.log('AI Excel Import initialized');
  }

  function cacheElements() {
    elements = {
      modal: document.getElementById('excel-modal'),
      modalOverlay: document.getElementById('excel-modal-overlay'),
      modalClose: document.getElementById('excel-modal-close'),
      triggerBtn: document.getElementById('excel-upload-trigger'),
      uploadArea: document.getElementById('upload-area'),
      fileInput: document.getElementById('excel-file-input'),
      browseBtn: document.getElementById('browse-file-btn'),
      // Steps
      stepUpload: document.getElementById('excel-step-upload'),
      stepAnalyzing: document.getElementById('excel-step-analyzing'),
      stepResults: document.getElementById('excel-step-results'),
      stepSearchResults: document.getElementById('excel-step-search-results'),
      // Analyzing step
      analyzingFileName: document.getElementById('analyzing-file-name'),
      stepReading: document.getElementById('ai-step-reading'),
      stepDetecting: document.getElementById('ai-step-detecting'),
      stepExtracting: document.getElementById('ai-step-extracting'),
      stepValidating: document.getElementById('ai-step-validating'),
      // Results step
      summaryTitle: document.getElementById('ai-summary-title'),
      summaryText: document.getElementById('ai-summary-text'),
      qualityFill: document.getElementById('quality-fill'),
      qualityText: document.getElementById('quality-text'),
      qualityIssues: document.getElementById('quality-issues'),
      qualityIssuesText: document.getElementById('quality-issues-text'),
      selectAllParts: document.getElementById('select-all-parts'),
      partsCount: document.getElementById('parts-count'),
      partsList: document.getElementById('ai-parts-list'),
      suggestions: document.getElementById('ai-suggestions'),
      suggestionsList: document.getElementById('suggestions-list'),
      // Search results step
      searchSummary: document.getElementById('search-summary'),
      recommendationsList: document.getElementById('ai-recommendations-list'),
      backToPartsBtn: document.getElementById('back-to-parts-btn'),
      // Footer
      resetBtn: document.getElementById('excel-reset-btn'),
      cancelBtn: document.getElementById('excel-cancel-btn'),
      searchBtn: document.getElementById('excel-search-btn'),
      searchCount: document.getElementById('excel-search-count'),
      addCartBtn: document.getElementById('excel-add-cart-btn'),
      cartCount: document.getElementById('excel-cart-count'),
    };
  }

  // ====================================
  // EVENT LISTENERS
  // ====================================
  function setupEventListeners() {
    // Modal controls
    elements.triggerBtn?.addEventListener('click', openModal);
    elements.modalClose?.addEventListener('click', closeModal);
    elements.modalOverlay?.addEventListener('click', closeModal);
    elements.cancelBtn?.addEventListener('click', closeModal);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.modal?.classList.contains('show')) {
        closeModal();
      }
    });

    // File upload
    elements.uploadArea?.addEventListener('click', () => elements.fileInput?.click());
    elements.browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.fileInput?.click();
    });
    elements.fileInput?.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.uploadArea?.addEventListener('dragover', handleDragOver);
    elements.uploadArea?.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea?.addEventListener('drop', handleDrop);

    // Select all parts
    elements.selectAllParts?.addEventListener('change', handleSelectAll);

    // Filter buttons
    document.querySelectorAll('#excel-step-results .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => handleFilterChange(btn));
    });

    // Footer buttons
    elements.resetBtn?.addEventListener('click', resetToUpload);
    elements.searchBtn?.addEventListener('click', handleSearchParts);
    elements.addCartBtn?.addEventListener('click', handleAddToCart);
    elements.backToPartsBtn?.addEventListener('click', backToPartsList);
  }

  // ====================================
  // MODAL CONTROLS
  // ====================================
  function openModal() {
    // Check if user is logged in
    if (typeof window.BuyerAuth !== 'undefined' && !window.BuyerAuth.isLoggedIn()) {
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      }
      return;
    }

    elements.modal?.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Reset to upload step
    resetToUpload();

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function closeModal() {
    elements.modal?.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ====================================
  // FILE HANDLING
  // ====================================
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea?.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea?.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea?.classList.remove('drag-over');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  function handleFileSelect(e) {
    const files = e.target?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  async function processFile(file) {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/csv',
    ];

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt) && !validTypes.includes(file.type)) {
      showNotification('error', 'Invalid File', 'Please upload an Excel or CSV file');
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showNotification('error', 'File Too Large', 'Maximum file size is 10MB');
      return;
    }

    AIExcelState.fileName = file.name;
    AIExcelState.fileData = file;

    // Show analyzing step
    showStep('analyzing');
    updateAnalyzingFileName(file.name);
    await runAnalyzingAnimation();

    try {
      // Parse the file
      const rawData = await parseExcelFile(file);
      
      if (!rawData || rawData.length === 0) {
        throw new Error('No data found in file');
      }

      // Send to AI for analysis
      await analyzeWithAI(rawData, file.name);

    } catch (error) {
      console.error('File processing error:', error);
      showNotification('error', 'Processing Error', error.message || 'Failed to process file');
      resetToUpload();
    }
  }

  async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      // Check if XLSX library is available
      if (typeof XLSX === 'undefined') {
        // Load XLSX library dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => parseWithXLSX(file, resolve, reject);
        script.onerror = () => reject(new Error('Failed to load Excel parser'));
        document.head.appendChild(script);
      } else {
        parseWithXLSX(file, resolve, reject);
      }
    });
  }

  function parseWithXLSX(file, resolve, reject) {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        resolve(rawData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  }

  // ====================================
  // AI ANALYSIS
  // ====================================
  async function analyzeWithAI(rawData, filename) {
    try {
      // First, show all the analyzing animation steps
      await showAnalyzingStep('reading');
      await delay(600);
      
      await showAnalyzingStep('detecting');
      await delay(800);
      
      await showAnalyzingStep('extracting');
      
      // Now call the AI analysis endpoint while showing extracting
      const response = await fetch('/buyer/api/excel/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: rawData,
          filename: filename,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'AI analysis failed');
      }

      // Complete extracting and show validating
      await completeAnalyzingStep('extracting');
      await delay(300);
      
      await showAnalyzingStep('validating');
      await delay(500);
      await completeAnalyzingStep('validating');
      await delay(300);

      console.log('AI Excel Analysis Result:', result);

      // Detect and handle duplicates
      const { uniqueParts, duplicates, totalOriginal } = detectDuplicates(result.parts || []);
      
      // Store results
      AIExcelState.analyzedParts = uniqueParts;
      AIExcelState.selectedParts = uniqueParts.filter(p => p.selected);
      AIExcelState.dataQuality = result.dataQuality;
      AIExcelState.suggestions = result.suggestions || [];
      AIExcelState.duplicates = duplicates;
      AIExcelState.totalOriginalParts = totalOriginal;

      // Update result with deduplicated parts
      result.parts = uniqueParts;
      result.totalPartsFound = uniqueParts.length;

      // Add duplicate info to suggestions if any
      if (duplicates.length > 0) {
        const duplicateSuggestion = `${duplicates.length} duplicate part${duplicates.length > 1 ? 's' : ''} detected and merged (quantities combined)`;
        result.suggestions = [duplicateSuggestion, ...(result.suggestions || [])];
        AIExcelState.suggestions = result.suggestions;
      }

      // Show results
      displayResults(result);

    } catch (error) {
      console.error('AI Analysis error:', error);
      showNotification('error', 'Analysis Failed', error.message);
      resetToUpload();
    }
  }

  function detectDuplicates(parts) {
    const partMap = new Map();
    const duplicates = [];
    const totalOriginal = parts.length;

    parts.forEach(part => {
      const key = part.partNumber.toUpperCase().trim();
      
      if (partMap.has(key)) {
        const existing = partMap.get(key);
        existing.quantity = (existing.quantity || 1) + (part.quantity || 1);
        existing.duplicateCount = (existing.duplicateCount || 1) + 1;
      } else {
        partMap.set(key, { ...part, duplicateCount: 1 });
      }
    });

    const uniqueParts = [];
    partMap.forEach((part, key) => {
      if (part.duplicateCount > 1) {
        duplicates.push({
          partNumber: part.partNumber,
          count: part.duplicateCount,
          totalQuantity: part.quantity,
        });
      }
      // Remove the helper property
      delete part.duplicateCount;
      uniqueParts.push(part);
    });

    return { uniqueParts, duplicates, totalOriginal };
  }

  // ====================================
  // ANALYZING ANIMATION
  // ====================================
  function updateAnalyzingFileName(filename) {
    if (elements.analyzingFileName) {
      elements.analyzingFileName.textContent = filename;
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runAnalyzingAnimation() {
    // Reset all steps
    const steps = ['reading', 'detecting', 'extracting', 'validating'];
    steps.forEach(step => {
      const el = document.getElementById(`ai-step-${step}`);
      if (el) {
        el.classList.remove('active', 'completed');
        const status = el.querySelector('.ai-step-status');
        if (status) status.innerHTML = '';
      }
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async function showAnalyzingStep(stepName) {
    const step = document.getElementById(`ai-step-${stepName}`);
    if (step) {
      step.classList.add('active');
      step.classList.remove('completed');
      const status = step.querySelector('.ai-step-status');
      if (status) status.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
    }
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async function completeAnalyzingStep(stepName) {
    const step = document.getElementById(`ai-step-${stepName}`);
    if (step) {
      step.classList.remove('active');
      step.classList.add('completed');
      const status = step.querySelector('.ai-step-status');
      if (status) status.innerHTML = '<i data-lucide="check"></i>';
    }
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async function animateStep(stepName, delayMs) {
    return new Promise(resolve => {
      setTimeout(() => {
        const currentStep = document.getElementById(`ai-step-${stepName}`);
        if (currentStep) {
          currentStep.classList.remove('active');
          currentStep.classList.add('completed');
          const status = currentStep.querySelector('.ai-step-status');
          if (status) status.innerHTML = '<i data-lucide="check"></i>';
        }

        // Activate next step
        const steps = ['reading', 'detecting', 'extracting', 'validating'];
        const currentIndex = steps.indexOf(stepName);
        if (currentIndex < steps.length - 1) {
          const nextStep = document.getElementById(`ai-step-${steps[currentIndex + 1]}`);
          if (nextStep) {
            nextStep.classList.add('active');
            const status = nextStep.querySelector('.ai-step-status');
            if (status) status.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
          }
        }

        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }

        resolve();
      }, delayMs);
    });
  }

  // ====================================
  // DISPLAY RESULTS
  // ====================================
  function displayResults(result) {
    showStep('results');

    // Update summary
    if (elements.summaryTitle) {
      elements.summaryTitle.textContent = result.aiPowered ? 'AI Analysis Complete!' : 'Analysis Complete';
    }
    if (elements.summaryText) {
      elements.summaryText.textContent = result.summary || `Found ${result.totalPartsFound} parts`;
    }

    // Update data quality
    updateDataQuality(result.dataQuality);

    // Render parts list
    renderPartsList(result.parts || []);

    // Show suggestions
    if (result.suggestions && result.suggestions.length > 0) {
      showSuggestions(result.suggestions);
    }

    // Update footer buttons
    updateFooterButtons();

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function updateDataQuality(quality) {
    if (!quality) return;

    const qualityMap = {
      'good': { width: '90%', color: 'good', label: 'Excellent' },
      'fair': { width: '60%', color: 'fair', label: 'Fair' },
      'poor': { width: '30%', color: 'poor', label: 'Poor' },
      'unknown': { width: '50%', color: 'fair', label: 'Unknown' },
    };

    const setting = qualityMap[quality.formatting] || qualityMap['unknown'];

    if (elements.qualityFill) {
      elements.qualityFill.style.width = setting.width;
      elements.qualityFill.className = `quality-fill ${setting.color}`;
    }

    if (elements.qualityText) {
      elements.qualityText.textContent = setting.label;
      elements.qualityText.className = `quality-text ${setting.color}`;
    }

    // Show issues if any
    if (quality.issues && quality.issues.length > 0) {
      if (elements.qualityIssues) {
        elements.qualityIssues.style.display = 'flex';
      }
      if (elements.qualityIssuesText) {
        elements.qualityIssuesText.textContent = quality.issues[0];
      }
    } else {
      if (elements.qualityIssues) {
        elements.qualityIssues.style.display = 'none';
      }
    }
  }

  function renderPartsList(parts) {
    if (!elements.partsList) return;

    if (parts.length === 0) {
      elements.partsList.innerHTML = `
        <div class="empty-parts-message">
          <i data-lucide="package-x"></i>
          <p>No parts found in the file</p>
        </div>
      `;
      return;
    }

    const html = parts.map((part, index) => `
      <div class="ai-part-item ${part.selected ? 'selected' : ''}" data-index="${index}" data-confidence="${part.confidence}">
        <label class="part-checkbox">
          <input type="checkbox" ${part.selected ? 'checked' : ''} data-index="${index}">
          <span class="checkbox-custom"></span>
        </label>
        <div class="part-info">
          <span class="part-number">${escapeHtml(part.partNumber)}</span>
          <div class="part-details">
            ${part.brand ? `<span class="part-brand">${escapeHtml(part.brand)}</span>` : ''}
            ${part.description ? `<span class="part-description">${escapeHtml(part.description.substring(0, 50))}</span>` : ''}
          </div>
        </div>
        <div class="part-quantity">
          <label>Qty:</label>
          <input type="number" value="${part.quantity || 1}" min="1" max="9999" data-index="${index}">
        </div>
        <span class="confidence-badge ${part.confidence}">${part.confidence}</span>
        <div class="part-actions">
          <button class="part-remove-btn" data-index="${index}" title="Remove">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
    `).join('');

    elements.partsList.innerHTML = html;

    // Add event listeners
    elements.partsList.querySelectorAll('.part-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', handlePartSelection);
    });

    elements.partsList.querySelectorAll('.part-quantity input').forEach(input => {
      input.addEventListener('change', handleQuantityChange);
    });

    elements.partsList.querySelectorAll('.part-remove-btn').forEach(btn => {
      btn.addEventListener('click', handleRemovePart);
    });

    updatePartsCount();
  }

  function showSuggestions(suggestions) {
    if (!elements.suggestions || !elements.suggestionsList) return;

    if (suggestions.length === 0) {
      elements.suggestions.style.display = 'none';
      return;
    }

    elements.suggestions.style.display = 'block';
    elements.suggestionsList.innerHTML = suggestions.map(s => 
      `<li>${escapeHtml(s)}</li>`
    ).join('');
  }

  // ====================================
  // PARTS SELECTION
  // ====================================
  function handleSelectAll(e) {
    const isChecked = e.target.checked;
    
    AIExcelState.analyzedParts.forEach((part, index) => {
      part.selected = isChecked;
    });

    // Update checkboxes
    elements.partsList?.querySelectorAll('.part-checkbox input').forEach(checkbox => {
      checkbox.checked = isChecked;
      const item = checkbox.closest('.ai-part-item');
      if (item) {
        item.classList.toggle('selected', isChecked);
      }
    });

    updateSelectedParts();
    updatePartsCount();
    updateFooterButtons();
  }

  function handlePartSelection(e) {
    const index = parseInt(e.target.dataset.index, 10);
    const isChecked = e.target.checked;

    if (AIExcelState.analyzedParts[index]) {
      AIExcelState.analyzedParts[index].selected = isChecked;
    }

    const item = e.target.closest('.ai-part-item');
    if (item) {
      item.classList.toggle('selected', isChecked);
    }

    updateSelectedParts();
    updatePartsCount();
    updateFooterButtons();
    updateSelectAllCheckbox();
  }

  function handleQuantityChange(e) {
    const index = parseInt(e.target.dataset.index, 10);
    const quantity = parseInt(e.target.value, 10) || 1;

    if (AIExcelState.analyzedParts[index]) {
      AIExcelState.analyzedParts[index].quantity = Math.max(1, Math.min(9999, quantity));
    }

    e.target.value = AIExcelState.analyzedParts[index]?.quantity || 1;
  }

  function handleRemovePart(e) {
    const index = parseInt(e.target.closest('.part-remove-btn').dataset.index, 10);
    
    AIExcelState.analyzedParts.splice(index, 1);
    renderPartsList(AIExcelState.analyzedParts);
    updateSelectedParts();
    updateFooterButtons();

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function handleFilterChange(btn) {
    // Update active button
    document.querySelectorAll('#excel-step-results .filter-btn').forEach(b => {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    
    // Filter parts
    elements.partsList?.querySelectorAll('.ai-part-item').forEach(item => {
      const confidence = item.dataset.confidence;
      
      if (filter === 'all') {
        item.style.display = 'flex';
      } else {
        item.style.display = confidence === filter ? 'flex' : 'none';
      }
    });
  }

  function updateSelectedParts() {
    AIExcelState.selectedParts = AIExcelState.analyzedParts.filter(p => p.selected);
  }

  function updatePartsCount() {
    const total = AIExcelState.analyzedParts.length;
    const selected = AIExcelState.analyzedParts.filter(p => p.selected).length;
    
    if (elements.partsCount) {
      elements.partsCount.textContent = `${selected} of ${total} parts selected`;
    }
  }

  function updateSelectAllCheckbox() {
    if (!elements.selectAllParts) return;

    const total = AIExcelState.analyzedParts.length;
    const selected = AIExcelState.analyzedParts.filter(p => p.selected).length;

    elements.selectAllParts.checked = selected === total && total > 0;
    elements.selectAllParts.indeterminate = selected > 0 && selected < total;
  }

  // ====================================
  // SEARCH PARTS
  // ====================================
  async function handleSearchParts() {
    const selectedParts = AIExcelState.analyzedParts.filter(p => p.selected);
    
    if (selectedParts.length === 0) {
      showNotification('warning', 'No Parts Selected', 'Please select at least one part to search');
      return;
    }

    // Get selected part numbers as comma-separated string
    const partNumbers = selectedParts.map(p => p.partNumber).join(', ');
    
    // Store Excel import stats globally for the search banner to use
    window.__excelImportStats = {
      duplicates: AIExcelState.duplicates || [],
      totalOriginalParts: AIExcelState.totalOriginalParts || selectedParts.length,
      source: 'Excel'
    };
    
    // Close the modal
    closeModal();
    
    // Put part numbers in the main search input and trigger search
    const searchInput = document.getElementById('search2-input');
    const searchBtn = document.getElementById('search2-btn');
    
    if (searchInput) {
      searchInput.value = partNumbers;
      
      // Trigger the search button click to perform normal search
      if (searchBtn) {
        searchBtn.click();
      }
    }
    
    // Show notification
    showNotification('success', 'Searching Parts', `Searching for ${selectedParts.length} parts from Excel`);
  }

  // ====================================
  // DISPLAY SEARCH RESULTS
  // ====================================
  function displaySearchResults(result) {
    showStep('search-results');

    // Calculate and display analytics
    displayAnalytics(result);

    // Update summary
    if (elements.searchSummary) {
      const found = result.stats?.found || 0;
      const notFound = result.stats?.notFound || 0;
      elements.searchSummary.textContent = `Found options for ${found} parts • ${notFound} not found`;
    }

    // Render recommendations
    renderRecommendations(result.recommendations || []);

    // Update footer
    updateCartButton();

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function displayAnalytics(result) {
    const stats = result.stats || {};
    const recommendations = result.recommendations || [];
    
    // Get not found parts
    const notFoundParts = recommendations
      .filter(r => !r.found)
      .map(r => r.partNumber);
    AIExcelState.notFoundParts = notFoundParts;

    // Calculate totals (excluding duplicates from success rate)
    const totalSearched = stats.total || recommendations.length;
    const foundCount = stats.found || recommendations.filter(r => r.found).length;
    const notFoundCount = stats.notFound || notFoundParts.length;
    const duplicateCount = AIExcelState.duplicates.length;
    
    // Success rate is based on unique parts only
    const uniqueParts = totalSearched;
    const successRate = uniqueParts > 0 ? Math.round((foundCount / uniqueParts) * 100) : 0;
    const notFoundRate = uniqueParts > 0 ? Math.round((notFoundCount / uniqueParts) * 100) : 0;

    // Update filename
    const filenameEl = document.getElementById('analytics-filename');
    if (filenameEl) {
      filenameEl.textContent = AIExcelState.fileName || 'Uploaded file';
    }

    // Update stats
    const statTotal = document.getElementById('stat-total');
    const statFound = document.getElementById('stat-found');
    const statNotFound = document.getElementById('stat-not-found');
    const statDuplicates = document.getElementById('stat-duplicates');
    const statPercentFound = document.getElementById('stat-percent-found');
    const statPercentNotFound = document.getElementById('stat-percent-not-found');
    const statDuplicatesCard = document.getElementById('stat-duplicates-card');

    if (statTotal) statTotal.textContent = AIExcelState.totalOriginalParts || totalSearched;
    if (statFound) statFound.textContent = foundCount;
    if (statNotFound) statNotFound.textContent = notFoundCount;
    if (statPercentFound) statPercentFound.textContent = `${successRate}%`;
    if (statPercentNotFound) statPercentNotFound.textContent = `${notFoundRate}%`;

    // Show duplicates if any
    if (duplicateCount > 0 && statDuplicatesCard) {
      statDuplicatesCard.style.display = 'flex';
      if (statDuplicates) statDuplicates.textContent = duplicateCount;
    }

    // Update success rate bar
    const successRateValue = document.getElementById('success-rate-value');
    const successRateFill = document.getElementById('success-rate-fill');
    
    if (successRateValue) {
      successRateValue.textContent = `${successRate}%`;
      successRateValue.style.color = successRate >= 70 ? '#22c55e' : successRate >= 40 ? '#f59e0b' : '#ef4444';
    }
    if (successRateFill) {
      successRateFill.style.width = `${successRate}%`;
      successRateFill.style.background = successRate >= 70 
        ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' 
        : successRate >= 40 
          ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    }

    // Display not found parts
    displayNotFoundParts(notFoundParts);

    // Display duplicates
    displayDuplicates(AIExcelState.duplicates);
  }

  function displayNotFoundParts(parts) {
    const section = document.getElementById('not-found-section');
    const list = document.getElementById('not-found-list');
    const toggle = document.getElementById('not-found-toggle');

    if (!section || !list) return;

    if (parts.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = `
      <div class="not-found-parts">
        ${parts.map(p => `<span class="not-found-part">${escapeHtml(p)}</span>`).join('')}
      </div>
    `;

    // Add toggle listener
    if (toggle) {
      toggle.onclick = () => {
        toggle.classList.toggle('expanded');
        list.classList.toggle('show');
      };
    }
  }

  function displayDuplicates(duplicates) {
    const section = document.getElementById('duplicates-section');
    const list = document.getElementById('duplicates-list');
    const toggle = document.getElementById('duplicates-toggle');

    if (!section || !list) return;

    if (!duplicates || duplicates.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = duplicates.map(d => `
      <div class="duplicate-item">
        <span class="duplicate-part">${escapeHtml(d.partNumber)}</span>
        <span class="duplicate-count">×${d.count}</span>
        <span class="duplicate-info">Merged into 1 entry (qty: ${d.totalQuantity})</span>
      </div>
    `).join('');

    // Add toggle listener
    if (toggle) {
      toggle.onclick = () => {
        toggle.classList.toggle('expanded');
        list.classList.toggle('show');
      };
    }
  }

  function renderRecommendations(recommendations) {
    if (!elements.recommendationsList) return;

    if (recommendations.length === 0) {
      elements.recommendationsList.innerHTML = `
        <div class="empty-results-message">
          <i data-lucide="search-x"></i>
          <p>No parts found in database</p>
        </div>
      `;
      return;
    }

    const html = recommendations.map((rec, index) => {
      if (!rec.found) {
        return `
          <div class="recommendation-card not-found">
            <div class="recommendation-header">
              <div class="recommendation-part-info">
                <span class="recommendation-part-number">${escapeHtml(rec.partNumber)}</span>
                <span class="recommendation-qty">× ${rec.requestedQuantity}</span>
              </div>
              <div class="recommendation-status not-found">
                <i data-lucide="x-circle"></i>
                <span>Not Found</span>
              </div>
            </div>
          </div>
        `;
      }

      const recommended = rec.recommendation;
      const alternatives = rec.alternatives || [];

      return `
        <div class="recommendation-card" data-part="${escapeHtml(rec.partNumber)}">
          <div class="recommendation-header">
            <div class="recommendation-part-info">
              <span class="recommendation-part-number">${escapeHtml(rec.partNumber)}</span>
              <span class="recommendation-qty">× ${rec.requestedQuantity}</span>
            </div>
            <div class="recommendation-status found">
              <i data-lucide="check-circle"></i>
              <span>${rec.totalOptions} options found</span>
            </div>
          </div>
          <div class="recommendation-body">
            ${recommended ? `
              <div class="recommended-option">
                <label class="option-checkbox">
                  <input type="checkbox" checked data-part="${escapeHtml(rec.partNumber)}" data-id="${recommended._id || ''}">
                  <span class="checkbox-custom"></span>
                </label>
                <div class="option-info">
                  <div class="option-supplier">${escapeHtml(recommended.supplier || 'Unknown Supplier')}</div>
                  <div class="option-details">
                    ${recommended.brand ? `<span>${escapeHtml(recommended.brand)}</span>` : ''}
                    <span>${recommended.quantity || 0} in stock</span>
                    ${recommended.deliveryDays ? `<span>${recommended.deliveryDays} days delivery</span>` : ''}
                  </div>
                  ${recommended.reason ? `<div class="option-reason">${escapeHtml(recommended.reason)}</div>` : ''}
                </div>
                <div class="option-price">$${(recommended.price || 0).toFixed(2)}</div>
              </div>
            ` : ''}
            
            ${alternatives.length > 0 ? `
              <button class="alternatives-toggle" data-part="${escapeHtml(rec.partNumber)}">
                <span>View ${alternatives.length} alternative${alternatives.length > 1 ? 's' : ''}</span>
                <i data-lucide="chevron-down"></i>
              </button>
              <div class="alternatives-list" id="alternatives-${index}">
                ${alternatives.map(alt => `
                  <div class="alternative-option">
                    <label class="option-checkbox">
                      <input type="checkbox" data-part="${escapeHtml(rec.partNumber)}" data-id="${alt._id || ''}">
                      <span class="checkbox-custom"></span>
                    </label>
                    <div class="option-info">
                      <div class="option-supplier">${escapeHtml(alt.supplier || 'Unknown Supplier')}</div>
                      <div class="option-details">
                        ${alt.brand ? `<span>${escapeHtml(alt.brand)}</span>` : ''}
                        <span>${alt.quantity || 0} in stock</span>
                      </div>
                    </div>
                    <div class="option-price">$${(alt.price || 0).toFixed(2)}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    elements.recommendationsList.innerHTML = html;

    // Add event listeners
    elements.recommendationsList.querySelectorAll('.alternatives-toggle').forEach(btn => {
      btn.addEventListener('click', toggleAlternatives);
    });

    elements.recommendationsList.querySelectorAll('.option-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', handleOptionSelection);
    });

    updateCartButton();
  }

  function toggleAlternatives(e) {
    const btn = e.currentTarget;
    const card = btn.closest('.recommendation-card');
    const list = card?.querySelector('.alternatives-list');
    
    if (list) {
      list.classList.toggle('show');
      btn.classList.toggle('expanded');
    }
  }

  function handleOptionSelection(e) {
    updateCartButton();
  }

  // ====================================
  // ADD TO CART
  // ====================================
  async function handleAddToCart() {
    // Get all selected options
    const selectedOptions = [];
    
    elements.recommendationsList?.querySelectorAll('.option-checkbox input:checked').forEach(checkbox => {
      const partNumber = checkbox.dataset.part;
      const id = checkbox.dataset.id;
      
      if (id) {
        // Find the part details from recommendations
        const rec = AIExcelState.recommendations.find(r => r.partNumber === partNumber);
        if (rec) {
          let partData = null;
          
          if (rec.recommendation?._id === id) {
            partData = rec.recommendation;
          } else {
            partData = rec.alternatives?.find(a => a._id === id);
          }
          
          if (partData) {
            selectedOptions.push({
              ...partData,
              quantity: rec.requestedQuantity,
            });
          }
        }
      }
    });

    if (selectedOptions.length === 0) {
      showNotification('warning', 'No Parts Selected', 'Please select at least one part option');
      return;
    }

    // Add to cart
    let addedCount = 0;
    for (const part of selectedOptions) {
      try {
        // Use global addToCart if available
        if (typeof window.addToCart === 'function') {
          window.addToCart(part);
          addedCount++;
        } else {
          // Fallback: Add to localStorage cart
          const cart = JSON.parse(localStorage.getItem('partsCart') || '[]');
          cart.push({
            _id: part._id,
            partNumber: part.partNumber,
            brand: part.brand,
            supplier: part.supplier,
            price: part.price,
            quantity: part.quantity || 1,
            weight: part.weight,
            deliveryDays: part.deliveryDays,
          });
          localStorage.setItem('partsCart', JSON.stringify(cart));
          addedCount++;
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    }

    if (addedCount > 0) {
      showNotification('success', 'Added to Cart', `${addedCount} items added to your cart`);
      
      // Update cart badge
      if (typeof window.updateCartBadge === 'function') {
        window.updateCartBadge();
      }

      // Close modal
      setTimeout(() => {
        closeModal();
      }, 1000);
    }
  }

  function updateCartButton() {
    const selectedCount = elements.recommendationsList?.querySelectorAll('.option-checkbox input:checked').length || 0;
    
    if (elements.addCartBtn) {
      elements.addCartBtn.style.display = selectedCount > 0 ? 'flex' : 'none';
    }
    
    if (elements.cartCount) {
      elements.cartCount.textContent = selectedCount;
    }
  }

  // ====================================
  // NAVIGATION
  // ====================================
  function showStep(step) {
    AIExcelState.currentStep = step;

    // Hide all steps
    [elements.stepUpload, elements.stepAnalyzing, elements.stepResults, elements.stepSearchResults].forEach(el => {
      if (el) el.style.display = 'none';
    });

    // Show current step
    switch (step) {
      case 'upload':
        if (elements.stepUpload) elements.stepUpload.style.display = 'block';
        if (elements.resetBtn) elements.resetBtn.style.display = 'none';
        if (elements.searchBtn) elements.searchBtn.style.display = 'none';
        if (elements.addCartBtn) elements.addCartBtn.style.display = 'none';
        break;
      case 'analyzing':
        if (elements.stepAnalyzing) elements.stepAnalyzing.style.display = 'block';
        if (elements.resetBtn) elements.resetBtn.style.display = 'none';
        if (elements.searchBtn) elements.searchBtn.style.display = 'none';
        if (elements.addCartBtn) elements.addCartBtn.style.display = 'none';
        if (elements.cancelBtn) elements.cancelBtn.style.display = 'none';
        break;
      case 'results':
        if (elements.stepResults) elements.stepResults.style.display = 'block';
        if (elements.resetBtn) elements.resetBtn.style.display = 'flex';
        if (elements.searchBtn) elements.searchBtn.style.display = 'flex';
        if (elements.addCartBtn) elements.addCartBtn.style.display = 'none';
        if (elements.cancelBtn) elements.cancelBtn.style.display = 'block';
        break;
      case 'search-results':
        if (elements.stepSearchResults) elements.stepSearchResults.style.display = 'block';
        if (elements.resetBtn) elements.resetBtn.style.display = 'flex';
        if (elements.searchBtn) elements.searchBtn.style.display = 'none';
        if (elements.addCartBtn) elements.addCartBtn.style.display = 'flex';
        if (elements.cancelBtn) elements.cancelBtn.style.display = 'block';
        break;
    }
  }

  function resetToUpload() {
    AIExcelState.currentStep = 'upload';
    AIExcelState.fileName = '';
    AIExcelState.fileData = null;
    AIExcelState.analyzedParts = [];
    AIExcelState.selectedParts = [];
    AIExcelState.searchResults = [];
    AIExcelState.recommendations = [];
    AIExcelState.dataQuality = null;
    AIExcelState.suggestions = [];

    // Reset file input
    if (elements.fileInput) {
      elements.fileInput.value = '';
    }

    showStep('upload');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function backToPartsList() {
    showStep('results');
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function updateFooterButtons() {
    const selectedCount = AIExcelState.analyzedParts.filter(p => p.selected).length;
    
    if (elements.searchBtn) {
      elements.searchBtn.disabled = selectedCount === 0;
    }
    
    if (elements.searchCount) {
      elements.searchCount.textContent = selectedCount;
    }
  }

  // ====================================
  // UTILITIES
  // ====================================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showNotification(type, title, message) {
    // Use global notification if available
    if (typeof window.showCartAlert === 'function') {
      window.showCartAlert(type, title, message);
    } else {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }

  // ====================================
  // GLOBAL EXPORTS
  // ====================================
  window.AIExcel = {
    init,
    openModal,
    closeModal,
    resetToUpload,
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

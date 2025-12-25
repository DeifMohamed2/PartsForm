// ====================================
// AOG QUOTE COMPARISON - JAVASCRIPT
// PARTSFORM Aviation Emergency Response
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // ====================================
  // QUOTE SELECTION
  // ====================================

  const selectButtons = document.querySelectorAll('.btn-select-quote');

  selectButtons.forEach((btn) => {
    btn.addEventListener('click', function () {
      const row = this.closest('tr');
      const supplierName = row.querySelector('.supplier-name').textContent;
      const deliveryTime = row.querySelector('.delivery-time').textContent;
      const price = row.querySelector('.price-amount').textContent;

      // Show confirmation
      const confirmed = confirm(
        `Confirm selection?\n\nSupplier: ${supplierName}\nDelivery: ${deliveryTime}\nPrice: ${price}\n\nThis will proceed to shipment tracking.`
      );

      if (confirmed) {
        // Update button state
        this.innerHTML = `
          <i data-lucide="check-circle"></i>
          <span>Selected!</span>
        `;
        this.style.background =
          'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
        this.disabled = true;
        lucide.createIcons();

        // Disable other buttons
        selectButtons.forEach((otherBtn) => {
          if (otherBtn !== this) {
            otherBtn.disabled = true;
            otherBtn.style.opacity = '0.5';
          }
        });

        // Store selection
        const caseId = window.location.pathname.split('/').pop();
        const selection = {
          supplier: supplierName,
          deliveryTime: deliveryTime,
          price: price,
          selectedAt: new Date().toISOString(),
        };
        localStorage.setItem(
          `aog-quote-selection-${caseId}`,
          JSON.stringify(selection)
        );

        // Redirect to tracking page after delay
        setTimeout(() => {
          window.location.href = `/buyer/aog/case-tracking/${caseId}`;
        }, 1500);
      }
    });
  });

  // ====================================
  // TABLE SORTING (Optional Enhancement)
  // ====================================

  const tableHeaders = document.querySelectorAll('.comparison-table thead th');

  tableHeaders.forEach((header, index) => {
    // Skip action column
    if (index === tableHeaders.length - 1) return;

    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      sortTable(index);
    });
  });

  function sortTable(columnIndex) {
    const table = document.querySelector('.comparison-table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Determine sort direction
    const currentSort = table.dataset.sortColumn;
    const currentDirection = table.dataset.sortDirection || 'asc';
    const newDirection =
      currentSort === String(columnIndex) && currentDirection === 'asc'
        ? 'desc'
        : 'asc';

    // Sort rows
    rows.sort((a, b) => {
      const aValue = a.cells[columnIndex].textContent.trim();
      const bValue = b.cells[columnIndex].textContent.trim();

      // Try to parse as number
      const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
      const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return newDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      return newDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    // Re-append rows
    rows.forEach((row) => tbody.appendChild(row));

    // Update sort state
    table.dataset.sortColumn = columnIndex;
    table.dataset.sortDirection = newDirection;
  }

  // ====================================
  // ROW HOVER EFFECTS
  // ====================================

  const tableRows = document.querySelectorAll('.comparison-table tbody tr');

  tableRows.forEach((row) => {
    row.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.01)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });

    row.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = 'none';
    });
  });

  // ====================================
  // DECISION CARDS ANIMATION
  // ====================================

  const decisionCards = document.querySelectorAll('.decision-card');

  decisionCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';

    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 150);
  });

  // ====================================
  // LOAD CASE DATA
  // ====================================

  const caseId = window.location.pathname.split('/').pop();
  const caseData = localStorage.getItem(`aog-case-${caseId}`);

  if (caseData) {
    try {
      const data = JSON.parse(caseData);

      // Update subtitle with case info
      const subtitle = document.querySelector('.quote-subtitle');
      if (subtitle && data.aircraftType && data.parts) {
        subtitle.textContent = `Case ${caseId} • ${data.aircraftType} • ${data.parts.length} Parts Required`;
      }
    } catch (error) {
      console.error('Error loading case data:', error);
    }
  }

  // ====================================
  // HIGHLIGHT RECOMMENDED OPTION
  // ====================================

  const recommendedRow = document.querySelector('.comparison-table tbody tr.recommended');

  if (recommendedRow) {
    // Add a badge to the recommended row
    const firstCell = recommendedRow.querySelector('td');
    if (firstCell) {
      const badge = document.createElement('div');
      badge.className = 'recommended-badge';
      badge.innerHTML = `
        <i data-lucide="star"></i>
        <span>Recommended</span>
      `;
      badge.style.position = 'absolute';
      badge.style.top = '-12px';
      badge.style.left = '50%';
      badge.style.transform = 'translateX(-50%)';

      firstCell.style.position = 'relative';
      firstCell.appendChild(badge);
      lucide.createIcons();
    }
  }

  // ====================================
  // PRICE COMPARISON TOOLTIP (Optional)
  // ====================================

  const priceCells = document.querySelectorAll('.price-cell');

  priceCells.forEach((cell) => {
    const amount = cell.querySelector('.price-amount').textContent;
    const breakdown = cell.querySelector('.price-breakdown').textContent;

    cell.title = `${amount}\n${breakdown}`;
  });

  // ====================================
  // RESPONSIVE TABLE SCROLL INDICATOR
  // ====================================

  const tableWrapper = document.querySelector('.comparison-wrapper');

  function checkTableScroll() {
    if (tableWrapper.scrollWidth > tableWrapper.clientWidth) {
      tableWrapper.style.borderRight = '4px solid rgba(14, 165, 233, 0.3)';
    } else {
      tableWrapper.style.borderRight = 'none';
    }
  }

  checkTableScroll();
  window.addEventListener('resize', checkTableScroll);

  tableWrapper.addEventListener('scroll', function () {
    if (this.scrollLeft + this.clientWidth >= this.scrollWidth - 10) {
      this.style.borderRight = 'none';
    } else {
      this.style.borderRight = '4px solid rgba(14, 165, 233, 0.3)';
    }
  });
});

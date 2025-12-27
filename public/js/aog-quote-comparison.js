// ====================================
// AOG QUOTE COMPARISON - JAVASCRIPT
// PARTSFORM Aviation Emergency Response
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // ====================================
  // LOAD CASE DATA FROM LOCALSTORAGE
  // ====================================

  const caseId = window.location.pathname.split('/').pop();
  const caseData = localStorage.getItem(`aog-case-${caseId}`);

  if (caseData) {
    try {
      const data = JSON.parse(caseData);
      console.log('Loaded case data:', data);

      // Update hero meta with real data
      const metaItems = document.querySelectorAll('.quote-hero-meta .meta-item');
      if (metaItems.length >= 3 && data.aircraftType) {
        metaItems[1].querySelector('span').textContent = data.aircraftType;
      }
      if (metaItems.length >= 3 && data.parts) {
        metaItems[2].querySelector('span').textContent = `${data.parts.length} Parts Required`;
      }

      // Update part numbers in cards if available
      if (data.parts && data.parts.length > 0) {
        const partNumberElements = document.querySelectorAll('.info-value');
        partNumberElements.forEach((el, index) => {
          if (el.textContent.includes('P/N:') && data.parts[index]) {
            el.textContent = `P/N: ${data.parts[index].partNumber || '7825934'}`;
          }
        });
      }
    } catch (error) {
      console.error('Error loading case data:', error);
    }
  }

  // ====================================
  // QUOTE SELECTION
  // ====================================

  const selectButtons = document.querySelectorAll('.btn-select');

  selectButtons.forEach((btn) => {
    btn.addEventListener('click', function () {
      const card = this.closest('.quote-card');
      const supplierName = card.querySelector('.supplier-name').textContent;
      const deliveryTime = card.querySelector('.delivery-time-large').textContent;
      const priceTotal = card.querySelector('.price-total').textContent;

      // Show confirmation
      const confirmed = confirm(
        `Confirm selection?\n\nSupplier: ${supplierName}\nDelivery: ${deliveryTime}\n${priceTotal}\n\nThis will proceed to shipment tracking.`
      );

      if (confirmed) {
        // Update button state
        this.innerHTML = `
          <i data-lucide="check-circle"></i>
          <span>Selected!</span>
        `;
        this.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
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
        const selection = {
          supplier: supplierName,
          deliveryTime: deliveryTime,
          price: priceTotal,
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
  // CARD ANIMATIONS
  // ====================================

  const quoteCards = document.querySelectorAll('.quote-card');

  quoteCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';

    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 150);
  });

  // ====================================
  // SUMMARY CARDS ANIMATION
  // ====================================

  const summaryCards = document.querySelectorAll('.summary-card');

  summaryCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';

    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 600 + index * 100);
  });

  // ====================================
  // RECOMMENDATION POINTS ANIMATION
  // ====================================

  const points = document.querySelectorAll('.point');

  points.forEach((point, index) => {
    point.style.opacity = '0';
    point.style.transform = 'translateX(-20px)';

    setTimeout(() => {
      point.style.transition = 'all 0.4s ease';
      point.style.opacity = '1';
      point.style.transform = 'translateX(0)';
    }, 1000 + index * 100);
  });
});

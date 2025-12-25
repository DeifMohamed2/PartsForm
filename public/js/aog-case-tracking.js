// ====================================
// AOG CASE TRACKING - JAVASCRIPT
// PARTSFORM Aviation Emergency Response
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // ====================================
  // TIMELINE ANIMATION
  // ====================================

  const timelineItems = document.querySelectorAll('.timeline-item');

  // Animate timeline items on load
  timelineItems.forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-20px)';

    setTimeout(() => {
      item.style.transition = 'all 0.4s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateX(0)';
    }, index * 150);
  });

  // ====================================
  // SIMULATED STATUS UPDATES
  // ====================================

  function simulateStatusUpdate() {
    // In a real application, this would poll the server or use WebSockets
    // For demo, we'll just update the "Updated" time

    const activeItem = document.querySelector('.timeline-item.active');
    if (activeItem) {
      const updatedField = activeItem.querySelector(
        '.timeline-detail-value:last-child'
      );
      if (updatedField) {
        const minutes = Math.floor(Math.random() * 60);
        updatedField.textContent = `${minutes} minutes ago`;
      }
    }
  }

  // Update every 2 minutes
  setInterval(simulateStatusUpdate, 120000);

  // ====================================
  // ETA COUNTDOWN (Optional)
  // ====================================

  const etaValue = document.querySelector('.eta-value');

  function updateETA() {
    // In a real app, this would calculate based on actual delivery time
    const now = new Date();
    const deliveryDate = new Date(now);
    deliveryDate.setDate(deliveryDate.getDate() + 10); // 10 days from now

    const daysUntil = Math.ceil((deliveryDate - now) / (1000 * 60 * 60 * 24));

    if (etaValue) {
      if (daysUntil === 0) {
        etaValue.textContent = 'Today';
      } else if (daysUntil === 1) {
        etaValue.textContent = 'Tomorrow';
      } else {
        etaValue.textContent = `${daysUntil} Days`;
      }
    }
  }

  updateETA();

  // ====================================
  // CONTACT BUTTON
  // ====================================

  const contactBtn = document.querySelector('.btn-contact');

  if (contactBtn) {
    contactBtn.addEventListener('click', () => {
      // In a real app, this would open a contact modal or initiate a call
      alert(
        'Contact Support\n\nPhone: +1 (800) 555-0123\nEmail: aog@partsform.com\n\nOur team is available 24/7 to assist you.'
      );
    });
  }

  // ====================================
  // SHIPMENT CARDS ANIMATION
  // ====================================

  const shipmentCards = document.querySelectorAll('.shipment-card');

  shipmentCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';

    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 600 + index * 150);
  });

  // ====================================
  // LOAD CASE DATA
  // ====================================

  const caseId = window.location.pathname.split('/').pop();
  const caseData = localStorage.getItem(`aog-case-${caseId}`);
  const quoteSelection = localStorage.getItem(`aog-quote-selection-${caseId}`);

  if (caseData) {
    try {
      const data = JSON.parse(caseData);

      // Update destination
      const destinationValue = document.querySelector(
        '.tracking-info-item:last-child .tracking-info-value'
      );
      if (destinationValue && data.station) {
        destinationValue.textContent = data.station;
      }
    } catch (error) {
      console.error('Error loading case data:', error);
    }
  }

  if (quoteSelection) {
    try {
      const selection = JSON.parse(quoteSelection);

      // Update supplier info in timeline
      const supplierValue = document.querySelector(
        '.timeline-detail-value:first-child'
      );
      if (supplierValue && selection.supplier) {
        supplierValue.textContent = selection.supplier;
      }
    } catch (error) {
      console.error('Error loading quote selection:', error);
    }
  }

  // ====================================
  // PROGRESS INDICATOR
  // ====================================

  function updateProgressIndicator() {
    const completedItems = document.querySelectorAll('.timeline-item.completed');
    const totalItems = timelineItems.length;
    const progress = (completedItems.length / totalItems) * 100;

    // Update status banner based on progress
    const statusBanner = document.querySelector('.status-banner');
    const statusTitle = document.querySelector('.status-banner-title');
    const statusDesc = document.querySelector('.status-banner-desc');

    if (progress === 100) {
      statusBanner.style.background =
        'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
      statusTitle.textContent = 'Delivered';
      statusDesc.textContent = 'Your shipment has been successfully delivered';
    } else if (progress >= 60) {
      statusBanner.style.background =
        'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
      statusTitle.textContent = 'In Transit';
      statusDesc.textContent = 'Your shipment is on the way and on schedule';
    } else if (progress >= 40) {
      statusBanner.style.background =
        'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
      statusTitle.textContent = 'Preparing Shipment';
      statusDesc.textContent = 'Your order is being prepared for shipping';
    } else {
      statusBanner.style.background =
        'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)';
      statusTitle.textContent = 'Order Confirmed';
      statusDesc.textContent = 'Your order has been confirmed and is being processed';
    }
  }

  updateProgressIndicator();

  // ====================================
  // ALERT NOTIFICATIONS
  // ====================================

  function showAlert(type, title, description) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `tracking-alert ${type}`;
    alertDiv.innerHTML = `
      <div class="alert-icon">
        <i data-lucide="${
          type === 'success'
            ? 'check-circle'
            : type === 'error'
            ? 'alert-circle'
            : 'alert-triangle'
        }"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">${title}</div>
        <div class="alert-desc">${description}</div>
      </div>
    `;

    const container = document.querySelector('.tracking-container');
    const statusBanner = document.querySelector('.status-banner');

    container.insertBefore(alertDiv, statusBanner.nextSibling);
    lucide.createIcons();

    // Animate in
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      alertDiv.style.transition = 'all 0.3s ease';
      alertDiv.style.opacity = '1';
      alertDiv.style.transform = 'translateY(0)';
    }, 100);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      alertDiv.style.opacity = '0';
      setTimeout(() => alertDiv.remove(), 300);
    }, 10000);
  }

  // Example: Show alert for delays (commented out for demo)
  // setTimeout(() => {
  //   showAlert('warning', 'Minor Delay', 'Shipment delayed by 2 hours due to weather conditions. New ETA updated.');
  // }, 5000);

  // ====================================
  // COPY TRACKING NUMBER
  // ====================================

  const trackingNumber = document.querySelector(
    '.tracking-info-item:nth-child(2) .tracking-info-value'
  );

  if (trackingNumber) {
    trackingNumber.style.cursor = 'pointer';
    trackingNumber.title = 'Click to copy tracking number';

    trackingNumber.addEventListener('click', function () {
      const text = this.textContent;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const originalText = this.textContent;
          this.textContent = 'Copied!';
          this.style.color = '#10b981';

          setTimeout(() => {
            this.textContent = originalText;
            this.style.color = '';
          }, 2000);
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
        });
    });
  }

  // ====================================
  // REFRESH DATA BUTTON (Optional)
  // ====================================

  function addRefreshButton() {
    const trackingHeader = document.querySelector('.tracking-header-top');

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'back-link';
    refreshBtn.innerHTML = `
      <i data-lucide="refresh-cw"></i>
      <span>Refresh</span>
    `;
    refreshBtn.style.marginLeft = 'auto';

    refreshBtn.addEventListener('click', function () {
      const icon = this.querySelector('i');
      icon.style.animation = 'spin 1s linear';

      setTimeout(() => {
        icon.style.animation = '';
        simulateStatusUpdate();
        showAlert(
          'success',
          'Updated',
          'Tracking information has been refreshed'
        );
      }, 1000);
    });

    // Add CSS for spin animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    trackingHeader.appendChild(refreshBtn);
    lucide.createIcons();
  }

  // Uncomment to add refresh button
  // addRefreshButton();
});

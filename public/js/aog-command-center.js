// ====================================
// AOG COMMAND CENTER - JAVASCRIPT
// PARTSFORM Aviation Emergency Response
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // ====================================
  // SLA COUNTDOWN TIMER
  // ====================================

  const hoursElement = document.getElementById('hours');
  const minutesElement = document.getElementById('minutes');
  const secondsElement = document.getElementById('seconds');
  const progressBar = document.getElementById('sla-progress');

  // Set target time (24 hours from now for demo)
  const targetTime = new Date();
  targetTime.setHours(targetTime.getHours() + 22);
  targetTime.setMinutes(targetTime.getMinutes() + 45);
  targetTime.setSeconds(targetTime.getSeconds() + 30);

  function updateCountdown() {
    const now = new Date();
    const difference = targetTime - now;

    if (difference <= 0) {
      hoursElement.textContent = '00';
      minutesElement.textContent = '00';
      secondsElement.textContent = '00';
      progressBar.style.width = '0%';
      progressBar.classList.add('critical');
      return;
    }

    // Calculate time units
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    // Update display with leading zeros
    hoursElement.textContent = String(hours).padStart(2, '0');
    minutesElement.textContent = String(minutes).padStart(2, '0');
    secondsElement.textContent = String(seconds).padStart(2, '0');

    // Update progress bar
    const totalTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const elapsed = totalTime - difference;
    const progress = (elapsed / totalTime) * 100;
    progressBar.style.width = `${100 - progress}%`;

    // Update progress bar color based on time remaining
    if (progress > 75) {
      progressBar.classList.add('critical');
      progressBar.classList.remove('warning');
    } else if (progress > 50) {
      progressBar.classList.add('warning');
      progressBar.classList.remove('critical');
    } else {
      progressBar.classList.remove('warning', 'critical');
    }
  }

  // Update countdown every second
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ====================================
  // SIMULATED REAL-TIME UPDATES
  // ====================================

  const updatesList = document.querySelector('.updates-list');
  const updateMessages = [
    {
      icon: 'check-circle',
      text: '<strong>Quote received</strong> from Aviation Parts Worldwide - ETA 12 days',
      delay: 30000, // 30 seconds
    },
    {
      icon: 'truck',
      text: '<strong>Shipment prepared</strong> - Ready for pickup',
      delay: 60000, // 60 seconds
    },
    {
      icon: 'check-circle',
      text: '<strong>Quality check</strong> completed - All parts certified',
      delay: 90000, // 90 seconds
    },
  ];

  // Simulate new updates (for demo purposes)
  let updateIndex = 0;
  function addSimulatedUpdate() {
    if (updateIndex < updateMessages.length) {
      const update = updateMessages[updateIndex];

      const updateItem = document.createElement('div');
      updateItem.className = 'update-item';
      updateItem.style.opacity = '0';
      updateItem.style.transform = 'translateY(-10px)';
      updateItem.innerHTML = `
        <div class="update-icon">
          <i data-lucide="${update.icon}"></i>
        </div>
        <div class="update-content">
          <div class="update-text">${update.text}</div>
          <div class="update-time">
            <i data-lucide="clock"></i>
            <span>Just now</span>
          </div>
        </div>
      `;

      updatesList.insertBefore(updateItem, updatesList.firstChild);
      lucide.createIcons();

      // Animate in
      setTimeout(() => {
        updateItem.style.transition = 'all 0.3s ease';
        updateItem.style.opacity = '1';
        updateItem.style.transform = 'translateY(0)';
      }, 100);

      updateIndex++;

      // Schedule next update
      if (updateIndex < updateMessages.length) {
        setTimeout(addSimulatedUpdate, updateMessages[updateIndex].delay);
      }
    }
  }

  // Start simulated updates after 30 seconds
  // setTimeout(addSimulatedUpdate, 30000);

  // ====================================
  // PHASE TIMELINE ANIMATION
  // ====================================

  const phaseItems = document.querySelectorAll('.phase-item');

  // Animate phases on load
  phaseItems.forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-20px)';

    setTimeout(() => {
      item.style.transition = 'all 0.4s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateX(0)';
    }, index * 100);
  });

  // ====================================
  // QUICK ACTIONS HOVER EFFECTS
  // ====================================

  const actionButtons = document.querySelectorAll('.action-btn');

  actionButtons.forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      const arrow = btn.querySelector('.action-btn-arrow');
      arrow.style.transform = 'translateX(4px)';
    });

    btn.addEventListener('mouseleave', () => {
      const arrow = btn.querySelector('.action-btn-arrow');
      arrow.style.transform = 'translateX(0)';
    });
  });

  // ====================================
  // LOAD CASE DATA FROM LOCALSTORAGE
  // ====================================

  const caseId = window.location.pathname.split('/').pop();
  const caseData = localStorage.getItem(`aog-case-${caseId}`);

  if (caseData) {
    try {
      const data = JSON.parse(caseData);

      // Update case details in the UI
      const caseSubtitle = document.querySelector('.case-subtitle');
      if (caseSubtitle && data.aircraftType && data.tailNumber && data.station) {
        caseSubtitle.textContent = `${data.aircraftType} • Tail ${data.tailNumber} • ${data.station}`;
      }

      // Update parts count
      const partsInfo = document.querySelector('.info-item:nth-child(2) .info-value');
      if (partsInfo && data.parts) {
        partsInfo.textContent = `${data.parts.length} ${
          data.parts.length === 1 ? 'Item' : 'Items'
        }`;
      }

      // Update required by time
      const requiredByInfo = document.querySelector('.info-item:nth-child(3) .info-value');
      if (requiredByInfo && data.requiredBy) {
        const date = new Date(data.requiredBy);
        requiredByInfo.textContent = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Update case type badge
      const statusBadge = document.querySelector('.case-status-badge');
      if (statusBadge && data.caseType) {
        statusBadge.className = `case-status-badge ${data.caseType}`;
        switch (data.caseType) {
          case 'aog':
            statusBadge.textContent = 'AOG - CRITICAL';
            break;
          case 'routine':
            statusBadge.textContent = 'ROUTINE';
            break;
          case 'scheduled':
            statusBadge.textContent = 'SCHEDULED';
            break;
        }
      }
    } catch (error) {
      console.error('Error loading case data:', error);
    }
  }

  // ====================================
  // NOTIFICATION SOUND (Optional)
  // ====================================

  function playNotificationSound() {
    // In a real app, you would play a subtle notification sound
    // when new updates arrive
    console.log('New update received');
  }

  // ====================================
  // AUTO-REFRESH UPDATES (Simulated)
  // ====================================

  // In a real application, this would poll the server for updates
  // or use WebSockets for real-time communication
  function checkForUpdates() {
    // Simulated update check
    console.log('Checking for updates...');
  }

  // Check for updates every 30 seconds
  setInterval(checkForUpdates, 30000);
});

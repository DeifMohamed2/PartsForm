// Settings Page JavaScript
// Handles settings page interactions and functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize settings page
    initSettingsPage();
});

/**
 * Initialize settings page functionality
 */
function initSettingsPage() {
    // Settings navigation
    const navItems = document.querySelectorAll('.settings-nav-item');
    const panels = document.querySelectorAll('.settings-panel');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');

            // Hide all panels
            panels.forEach(panel => panel.classList.remove('active'));
            // Show selected panel
            const targetPanel = document.getElementById(`${section}-panel`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Save settings button
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            saveSettings();
        });
    }

    // Reset settings button
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            resetSettings();
        });
    }

    // Load saved settings from localStorage
    loadSettings();
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
    const settings = {
        language: document.getElementById('languageSelect')?.value || 'en',
        timezone: document.getElementById('timezoneSelect')?.value || 'UTC',
        dateFormat: document.getElementById('dateFormatSelect')?.value || 'MM/DD/YYYY',
        emailNotifications: document.getElementById('emailNotifications')?.checked || false,
        orderUpdates: document.getElementById('orderUpdates')?.checked || false,
        promotionalEmails: document.getElementById('promotionalEmails')?.checked || false,
        smsNotifications: document.getElementById('smsNotifications')?.checked || false,
        profileVisibility: document.getElementById('profileVisibility')?.value || 'public',
        dataCollection: document.getElementById('dataCollection')?.checked || false,
        cookies: document.getElementById('cookies')?.checked || false,
        theme: document.getElementById('themeSelect')?.value || 'light',
        itemsPerPage: document.getElementById('itemsPerPage')?.value || '20',
    };

    localStorage.setItem('userSettings', JSON.stringify(settings));
    
    // Show success message
    showNotification('Settings saved successfully!', 'success');
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
    const savedSettings = localStorage.getItem('userSettings');
    if (!savedSettings) return;

    try {
        const settings = JSON.parse(savedSettings);

        // Apply settings to form elements
        if (settings.language && document.getElementById('languageSelect')) {
            document.getElementById('languageSelect').value = settings.language;
        }
        if (settings.timezone && document.getElementById('timezoneSelect')) {
            document.getElementById('timezoneSelect').value = settings.timezone;
        }
        if (settings.dateFormat && document.getElementById('dateFormatSelect')) {
            document.getElementById('dateFormatSelect').value = settings.dateFormat;
        }
        if (document.getElementById('emailNotifications')) {
            document.getElementById('emailNotifications').checked = settings.emailNotifications || false;
        }
        if (document.getElementById('orderUpdates')) {
            document.getElementById('orderUpdates').checked = settings.orderUpdates || false;
        }
        if (document.getElementById('promotionalEmails')) {
            document.getElementById('promotionalEmails').checked = settings.promotionalEmails || false;
        }
        if (document.getElementById('smsNotifications')) {
            document.getElementById('smsNotifications').checked = settings.smsNotifications || false;
        }
        if (settings.profileVisibility && document.getElementById('profileVisibility')) {
            document.getElementById('profileVisibility').value = settings.profileVisibility;
        }
        if (document.getElementById('dataCollection')) {
            document.getElementById('dataCollection').checked = settings.dataCollection || false;
        }
        if (document.getElementById('cookies')) {
            document.getElementById('cookies').checked = settings.cookies || false;
        }
        if (settings.theme && document.getElementById('themeSelect')) {
            document.getElementById('themeSelect').value = settings.theme;
        }
        if (settings.itemsPerPage && document.getElementById('itemsPerPage')) {
            document.getElementById('itemsPerPage').value = settings.itemsPerPage;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Reset settings to default values
 */
function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
        localStorage.removeItem('userSettings');
        
        // Reset form elements to default values
        if (document.getElementById('languageSelect')) {
            document.getElementById('languageSelect').value = 'en';
        }
        if (document.getElementById('timezoneSelect')) {
            document.getElementById('timezoneSelect').value = 'UTC';
        }
        if (document.getElementById('dateFormatSelect')) {
            document.getElementById('dateFormatSelect').value = 'MM/DD/YYYY';
        }
        if (document.getElementById('emailNotifications')) {
            document.getElementById('emailNotifications').checked = true;
        }
        if (document.getElementById('orderUpdates')) {
            document.getElementById('orderUpdates').checked = true;
        }
        if (document.getElementById('promotionalEmails')) {
            document.getElementById('promotionalEmails').checked = false;
        }
        if (document.getElementById('smsNotifications')) {
            document.getElementById('smsNotifications').checked = false;
        }
        if (document.getElementById('profileVisibility')) {
            document.getElementById('profileVisibility').value = 'public';
        }
        if (document.getElementById('dataCollection')) {
            document.getElementById('dataCollection').checked = true;
        }
        if (document.getElementById('cookies')) {
            document.getElementById('cookies').checked = true;
        }
        if (document.getElementById('themeSelect')) {
            document.getElementById('themeSelect').value = 'light';
        }
        if (document.getElementById('itemsPerPage')) {
            document.getElementById('itemsPerPage').value = '20';
        }

        showNotification('Settings reset to default values!', 'success');
    }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `cart-alert ${type}`;
    notification.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'info'}" class="cart-alert-icon"></i>
        <div class="cart-alert-content">
            <div class="cart-alert-title">${type === 'success' ? 'Success' : 'Info'}</div>
            <p class="cart-alert-message">${message}</p>
        </div>
        <button class="cart-alert-close">
            <i data-lucide="x"></i>
        </button>
    `;

    // Get or create alerts container
    let alertsContainer = document.querySelector('.cart-alerts');
    if (!alertsContainer) {
        alertsContainer = document.createElement('div');
        alertsContainer.className = 'cart-alerts';
        document.body.appendChild(alertsContainer);
    }

    alertsContainer.appendChild(notification);
    lucide.createIcons();

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);

    // Close button functionality
    const closeBtn = notification.querySelector('.cart-alert-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}



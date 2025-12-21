// ====================================
// CART BADGE UPDATER - GLOBAL CART BADGE MANAGEMENT
// Updates the shopping cart icon badge across all pages
// ====================================

(function () {
  'use strict';

  // Update cart badge display
  function updateCartBadge() {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
      try {
        const savedCart = localStorage.getItem('partsform_shopping_cart');
        if (savedCart) {
          const cartData = JSON.parse(savedCart);
          const itemCount = cartData.items?.length || 0;
          if (itemCount > 0) {
            cartBadge.textContent = itemCount;
            cartBadge.style.display = 'flex';
          } else {
            cartBadge.style.display = 'none';
          }
        } else {
          cartBadge.style.display = 'none';
        }
      } catch (error) {
        console.error('Error updating cart badge:', error);
        cartBadge.style.display = 'none';
      }
    }
  }

  // Initialize on page load
  function init() {
    updateCartBadge();

    // Listen for storage changes (updates from other tabs/pages)
    window.addEventListener('storage', (e) => {
      if (e.key === 'partsform_shopping_cart') {
        updateCartBadge();
      }
    });

    // Listen for custom cart update events
    window.addEventListener('cartUpdated', updateCartBadge);

    // Refresh periodically (every 2 seconds) to catch any missed updates
    setInterval(updateCartBadge, 2000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

const express = require('express');
const router = express.Router();
const {
  getBuyerMain,
  getAutomotiveSearchPage,
  getAviationSearchPage,
  getHeavyMachinerySearchPage,
  getAffiliatePage,
  getOrdersPage,
  getPaymentPage,
  getDeliveryPage,
  getContactsPage,
  getCartPage,
  getCheckoutPage,
  getOrderDetailsPage,
} = require('../controllers/buyerController');

// Buyer main page
router.get('/', getBuyerMain);

// Buyer portal pages
router.get('/cart', getCartPage);
router.get('/checkout', getCheckoutPage);
router.get('/orders', getOrdersPage);
router.get('/orders/:orderNumber', getOrderDetailsPage);
router.get('/affiliate', getAffiliatePage);
router.get('/payment', getPaymentPage);
router.get('/delivery', getDeliveryPage);
router.get('/contacts', getContactsPage);

// Industry-specific themed search pages
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search/aviation', getAviationSearchPage);
router.get('/search/machinery', getHeavyMachinerySearchPage);

// Alternative routes for search pages (used by quick search)
router.get('/search-automotive', getAutomotiveSearchPage);
router.get('/search-aviation', getAviationSearchPage);
router.get('/search-machinery', getHeavyMachinerySearchPage);

module.exports = router;

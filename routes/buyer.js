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
  getProfilePage,
  getSettingsPage,
  getAOGCaseCreatePage,
  getAOGCommandCenterPage,
  getAOGQuoteComparisonPage,
  getAOGCaseTrackingPage,
  getTicketsPage,
  getCreateTicketPage,
  getTicketDetailsPage,
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
router.get('/profile', getProfilePage);
router.get('/settings', getSettingsPage);

// Industry-specific themed search pages
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search/aviation', getAviationSearchPage);
router.get('/search/machinery', getHeavyMachinerySearchPage);

// Alternative routes for search pages (used by quick search)
router.get('/search-automotive', getAutomotiveSearchPage);
router.get('/search-aviation', getAviationSearchPage);
router.get('/search-machinery', getHeavyMachinerySearchPage);

// Support Tickets routes
router.get('/tickets', getTicketsPage);
router.get('/tickets/create', getCreateTicketPage);
router.get('/tickets/:ticketId', getTicketDetailsPage);

// AOG Case Management routes
router.get('/aog/case-create', getAOGCaseCreatePage);
router.get('/aog/command-center/:caseId', getAOGCommandCenterPage);
router.get('/aog/quote-comparison/:caseId', getAOGQuoteComparisonPage);
router.get('/aog/case-tracking/:caseId', getAOGCaseTrackingPage);

module.exports = router;

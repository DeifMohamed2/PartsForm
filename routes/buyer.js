const express = require('express');
const router = express.Router();
const {
  getBuyerMain,
  getAutomotiveSearchPage,
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

// Parts search - Automotive only
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search-automotive', getAutomotiveSearchPage);
router.get('/search', getAutomotiveSearchPage); // Default search goes to automotive

// Support Tickets routes
router.get('/tickets', getTicketsPage);
router.get('/tickets/create', getCreateTicketPage);
router.get('/tickets/:ticketId', getTicketDetailsPage);

module.exports = router;


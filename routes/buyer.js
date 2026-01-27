const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
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
  uploadAvatar,
  updateProfile,
} = require('../controllers/buyerController');
const {
  searchParts,
  autocomplete,
  getFilterOptions,
  getPartById,
  getPartsByNumber,
  getSearchStats,
} = require('../controllers/searchController');
const { handleProfileImageUpload } = require('../utils/fileUploader');

// Apply authentication middleware to all buyer routes
router.use(requireAuth);

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

// Profile API routes
router.post('/profile/avatar', handleProfileImageUpload, uploadAvatar);
router.put('/profile', updateProfile);

// Parts search - Automotive only
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search-automotive', getAutomotiveSearchPage);
router.get('/search', getAutomotiveSearchPage); // Default search goes to automotive

// Search API endpoints
router.get('/api/search', searchParts);
router.get('/api/search/autocomplete', autocomplete);
router.get('/api/search/filters', getFilterOptions);
router.get('/api/search/stats', getSearchStats);
router.get('/api/parts/:id', getPartById);
router.get('/api/parts/by-number/:partNumber', getPartsByNumber);

// Support Tickets routes
router.get('/tickets', getTicketsPage);
router.get('/tickets/create', getCreateTicketPage);
router.get('/tickets/:ticketId', getTicketDetailsPage);

module.exports = router;


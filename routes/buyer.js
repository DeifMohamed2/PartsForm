const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
  changePassword,
  validateCheckout,
  createOrder,
  getOrders,
  getOrderDetails,
  cancelOrder,
  processPayment,
  // Address Management
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  // Tickets API
  getTicketsApi,
  getTicketDetailsApi,
  createTicket,
  sendTicketMessage,
  markTicketAsRead,
  // Currency Preference API
  getPreferredCurrency,
  updatePreferredCurrency,
} = require('../controllers/buyerController');
const {
  searchParts,
  autocomplete,
  getFilterOptions,
  getPartById,
  getPartsByNumber,
  getSearchStats,
  searchMultipleParts,
  aiSearch,
  aiSuggestions,
  aiAnalyze,
} = require('../controllers/searchController');
const { handleProfileImageUpload } = require('../utils/fileUploader');

// Configure multer for ticket file uploads
const ticketUploadDir = path.join(__dirname, '../public/uploads/tickets');
if (!fs.existsSync(ticketUploadDir)) {
  fs.mkdirSync(ticketUploadDir, { recursive: true });
}

const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ticketUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ticket-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const ticketUpload = multer({
  storage: ticketStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images, PDFs, and documents are accepted.'), false);
    }
  }
});

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
router.put('/profile/password', changePassword);

// Parts search - Automotive only
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search-automotive', getAutomotiveSearchPage);
router.get('/search', getAutomotiveSearchPage); // Default search goes to automotive

// Search API endpoints
router.get('/api/search', searchParts);
router.post('/api/search/multi', searchMultipleParts);
router.get('/api/search/multi', searchMultipleParts);
router.get('/api/search/autocomplete', autocomplete);
router.get('/api/search/filters', getFilterOptions);
router.get('/api/search/stats', getSearchStats);
router.get('/api/parts/:id', getPartById);
router.get('/api/parts/by-number/:partNumber', getPartsByNumber);

// AI Search API endpoints
router.post('/api/ai-search', aiSearch);
router.get('/api/ai-suggestions', aiSuggestions);
router.post('/api/ai-analyze', aiAnalyze);

// Order API endpoints (cart is managed in localStorage on client-side)
router.post('/api/checkout/validate', validateCheckout);
router.post('/api/orders/create', createOrder);
router.get('/api/orders', getOrders);
router.get('/api/orders/:orderNumber', getOrderDetails);
router.put('/api/orders/:orderNumber/cancel', cancelOrder);
router.post('/api/orders/:orderNumber/payment', processPayment);

// Support Tickets routes
router.get('/tickets', getTicketsPage);
router.get('/tickets/create', getCreateTicketPage);
router.get('/tickets/:ticketId', getTicketDetailsPage);

// Tickets API
router.get('/api/tickets', getTicketsApi);
router.post('/api/tickets', ticketUpload.array('attachments', 5), createTicket);
router.get('/api/tickets/:ticketId', getTicketDetailsApi);
router.post('/api/tickets/:ticketId/messages', ticketUpload.array('attachments', 5), sendTicketMessage);
router.put('/api/tickets/:ticketId/read', markTicketAsRead);

// Address Management API
router.get('/api/addresses', getAddresses);
router.post('/api/addresses', addAddress);
router.put('/api/addresses/:addressId', updateAddress);
router.delete('/api/addresses/:addressId', deleteAddress);
router.put('/api/addresses/:addressId/default', setDefaultAddress);

// Currency Preference API
router.get('/api/settings/currency', getPreferredCurrency);
router.put('/api/settings/currency', updatePreferredCurrency);

module.exports = router;


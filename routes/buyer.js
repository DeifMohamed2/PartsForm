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
  validateCartItems,
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
  aiExcelAnalyze,
  aiExcelSearch,
  // AI Learning
  recordSearchEngagement,
  recordSearchRefinement,
  recordSearchFeedback,
  getLearningStats,
  // New V2 Pipeline
  aiSearchV2,
  getPipelineMetrics,
  aiSearchHybrid,
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ticket-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const ticketUpload = multer({
  storage: ticketStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'image/heic',
      'image/heif',
      // PDF
      'application/pdf',
      // Documents
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // CSV and Excel
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Other common formats
      'application/zip',
      'application/x-zip-compressed',
      'application/rtf',
      'text/rtf',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'File type not allowed. Allowed: images, PDF, CSV, Excel, Word documents.',
        ),
        false,
      );
    }
  },
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

// AI Search V2 (New Pipeline Architecture)
router.post('/api/ai-search/v2', aiSearchV2);
router.get('/api/ai-search/metrics', getPipelineMetrics);
// Hybrid endpoint - auto-selects V1 or V2 based on feature flags
router.post('/api/ai-search/hybrid', aiSearchHybrid);

// AI Learning API endpoints - Help AI get smarter over time
router.post('/api/ai-learn/engagement', recordSearchEngagement);
router.post('/api/ai-learn/refinement', recordSearchRefinement);
router.post('/api/ai-learn/feedback', recordSearchFeedback);
router.get('/api/ai-learn/stats', getLearningStats);

// AI Excel Analysis API endpoints
router.post('/api/excel/analyze', aiExcelAnalyze);
router.post('/api/excel/search', aiExcelSearch);

// Order API endpoints (cart is managed in localStorage on client-side)
router.post('/api/cart/validate', validateCartItems);
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
router.post(
  '/api/tickets/:ticketId/messages',
  ticketUpload.array('attachments', 5),
  sendTicketMessage,
);
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

// Quotation PDF Generation API
const pdfGenerator = require('../services/pdfGeneratorService');

router.post('/api/quotation/generate-pdf', async (req, res) => {
  try {
    const quotationData = req.body;
    
    if (!quotationData.items || quotationData.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No items provided for quotation' 
      });
    }

    const pdfBuffer = await pdfGenerator.generateQuotationPDF(quotationData);
    
    const filename = `Quotation_${quotationData.quotationNumber || 'QUOTE'}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate PDF' 
    });
  }
});

module.exports = router;

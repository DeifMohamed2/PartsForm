const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdminAuth, requireAdminRole } = require('../middleware/auth');
const {
  getAdminDashboard,
  getOrdersManagement,
  getOrderDetails,
  getOrderCreate,
  getOrderEdit,
  deleteOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  getOrderStats,
  getTicketsManagement,
  getTicketDetails,
  postTicketReply,
  updateTicketStatus,
  getTicketsApi,
  markTicketAsReadAdmin,
  getUsersManagement,
  getUserDetails,
  getUserCreate,
  getUserEdit,
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  createUser,
  updateUser,
  approveUser,
  rejectUser,
  suspendUser,
  getPaymentsManagement,
  getPaymentDetails,
  getPaymentCreate,
  getIntegrationsManagement,
  getIntegrationCreate,
  getIntegrationEdit,
  getPartsAnalytics,
  // Integration API functions
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  syncIntegration,
  getSyncStatus,
  getSyncProgress,
  getSyncDetails,
  getIntegrations,
  getIntegration,
  // File upload
  uploadPartsFromFile,
  // Sidebar counts
  getSidebarCounts,
  // Administrators management
  getAdminsManagement,
  createAdmin,
  updateAdmin,
  updateAdminStatus,
  deleteAdmin,
} = require('../controllers/adminController');

// Import email inquiry controller
const {
  getEmailInquiries,
  getEmailInquiryDetails,
  getInquiryStats,
  triggerEmailCheck,
  retryInquiry,
  resendQuotation,
  regenerateQuotation,
  updateInquiryStatus,
  addNote,
  markAsRead,
  deleteInquiry,
  testEmailConfig,
  toggleScheduler,
  getInquiriesApi,
} = require('../controllers/emailInquiryController');

// Import search controller for parts search API
const { searchParts, autocomplete } = require('../controllers/searchController');

// Configure multer for file uploads (memory storage for parts)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream' // For some Excel files
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  }
});

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
    cb(null, 'ticket-admin-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const ticketUpload = multer({
  storage: ticketStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml', 'image/heic', 'image/heif',
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
      'text/rtf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed: images, PDF, CSV, Excel, Word documents.'), false);
    }
  }
});

// Apply admin auth middleware to all routes
router.use(requireAdminAuth);

// Admin dashboard
router.get('/', getAdminDashboard);

// Sidebar counts API (for real-time updates)
router.get('/api/sidebar-counts', getSidebarCounts);

// Orders management - Pages
router.get('/orders', getOrdersManagement);
router.get('/orders/create', getOrderCreate);
router.get('/orders/:id', getOrderDetails);
router.get('/orders/:id/edit', getOrderEdit);

// Orders management - API endpoints
router.get('/api/orders/stats', getOrderStats);
router.post('/api/orders', createOrder);
router.post('/api/orders/upload-parts', upload.single('file'), uploadPartsFromFile);
router.put('/api/orders/:id', updateOrder);
router.put('/api/orders/:id/status', updateOrderStatus);
router.delete('/api/orders/:id', deleteOrder);

// Parts search API for order creation
router.get('/api/search', searchParts);
router.get('/api/search/autocomplete', autocomplete);

// Legacy delete route for compatibility
router.delete('/orders/:id', deleteOrder);

// Tickets management
router.get('/tickets', getTicketsManagement);
router.get('/tickets/:id', getTicketDetails);
router.post('/tickets/:id/reply', ticketUpload.array('attachments', 5), postTicketReply);
router.put('/tickets/:id/status', updateTicketStatus);

// Tickets API endpoints
router.get('/api/tickets', getTicketsApi);
router.put('/api/tickets/:id/read', markTicketAsReadAdmin);

// Users management - Pages
router.get('/users', getUsersManagement);
router.get('/users/create', getUserCreate);
router.get('/users/:id', getUserDetails);
router.get('/users/:id/edit', getUserEdit);

// Users management - API endpoints (bulk routes must come BEFORE :id routes)
router.put('/api/users/bulk', bulkUpdateUsers);
router.post('/api/users', createUser);
router.put('/api/users/:id', updateUser);
router.put('/api/users/:id/status', updateUserStatus);
router.put('/api/users/:id/approve', approveUser);
router.put('/api/users/:id/reject', rejectUser);
router.put('/api/users/:id/suspend', suspendUser);
router.delete('/api/users/:id', deleteUser);

// Legacy routes for compatibility (bulk routes must come BEFORE :id routes)
router.put('/users/bulk', bulkUpdateUsers);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// Payments management
router.get('/payments/create', getPaymentCreate);
router.get('/payments/:id', getPaymentDetails);
router.get('/payments', getPaymentsManagement);

// Integrations management - Pages
router.get('/integrations', getIntegrationsManagement);
router.get('/integrations/create', getIntegrationCreate);
router.get('/integrations/:id/edit', getIntegrationEdit);

// Integrations API endpoints
router.get('/api/integrations', getIntegrations);
router.get('/api/integrations/:id', getIntegration);
router.post('/api/integrations', createIntegration);
router.put('/api/integrations/:id', updateIntegration);
router.delete('/api/integrations/:id', deleteIntegration);
router.post('/api/integrations/test', testIntegrationConnection);
router.post('/api/integrations/:id/sync', syncIntegration);
router.get('/api/integrations/:id/status', getSyncStatus);
router.get('/api/integrations/:id/progress', getSyncProgress);
router.get('/api/integrations/:id/sync-details', getSyncDetails);

// Administrators management
router.get('/admins', getAdminsManagement);
router.post('/api/admins', createAdmin);
router.put('/api/admins/:id', updateAdmin);
router.put('/api/admins/:id/status', updateAdminStatus);
router.delete('/api/admins/:id', deleteAdmin);

// Parts Analytics
router.get('/parts-analytics', getPartsAnalytics);

// ==========================================
// Email Inquiries Management
// ==========================================
// Pages
router.get('/email-inquiries', getEmailInquiries);
router.get('/email-inquiries/:id', getEmailInquiryDetails);

// API endpoints
router.get('/api/email-inquiries', getInquiriesApi);
router.get('/api/email-inquiries/stats', getInquiryStats);
router.post('/api/email-inquiries/check-now', triggerEmailCheck);
router.post('/api/email-inquiries/test-config', testEmailConfig);
router.post('/api/email-inquiries/scheduler/toggle', toggleScheduler);
router.post('/api/email-inquiries/:id/retry', retryInquiry);
router.post('/api/email-inquiries/:id/resend-quotation', resendQuotation);
router.post('/api/email-inquiries/:id/regenerate-quotation', regenerateQuotation);
router.post('/api/email-inquiries/:id/notes', addNote);
router.patch('/api/email-inquiries/:id/status', updateInquiryStatus);
router.patch('/api/email-inquiries/:id/read', markAsRead);
router.delete('/api/email-inquiries/:id', deleteInquiry);

module.exports = router;




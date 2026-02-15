const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { 
  requireAdminAuth, 
  requireAdminRole, 
  requirePermission, 
  requireAllPermissions,
  PERMISSIONS 
} = require('../middleware/auth');
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
  bulkApproveUsers,
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
  // Sync History API functions
  getSyncHistory,
  getAllSyncHistory,
  deleteSyncHistory,
  cleanupSyncHistory,
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
  // System Settings
  getSystemSettings,
  updateSystemSettings,
  getAdminSettings,
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
const {
  searchParts,
  autocomplete,
} = require('../controllers/searchController');

// Import referral controller for referral management
const {
  getReferralDashboard,
  getReferralPartners,
  getReferralPartnerCreate,
  getReferralPartnerDetails,
  getReferralPartnerEdit,
  getPartnersApi,
  createPartner,
  updatePartner,
  updatePartnerStatus,
  deletePartner,
  regenerateReferralCode,
  getCommissions,
  getCommissionsApi,
  reviewCommission,
  bulkReviewCommissions,
  getCommissionStats,
  getPayouts,
  getPayoutsApi,
  createPayout,
  processPayout,
  getPartnersReadyForPayout,
  // Code Management with validity periods
  getCodeCreatePage,
  getCodeEditPage,
  getPartnerCodesApi,
  createReferralCode,
  updateReferralCode,
  deleteReferralCode,
  getExpiringCodesApi,
  updateExpiredCodesApi,
  generateCodeApi,
  // Partner Applications
  getPartnerApplications,
  getApplicationsApi,
  getApplicationDetails,
  approveApplication,
  rejectApplication,
  getPendingApplicationsCount,
} = require('../controllers/referralController');

// Configure multer for file uploads (memory storage for parts)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // For some Excel files
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(csv|xlsx|xls)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ticket-admin-' + uniqueSuffix + path.extname(file.originalname));
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

// Apply admin auth middleware to all routes
router.use(requireAdminAuth);

// Admin dashboard
router.get('/', getAdminDashboard);

// Sidebar counts API (for real-time updates)
router.get('/api/sidebar-counts', getSidebarCounts);

// Orders management - Pages (read permission by default via auth)
router.get('/orders', getOrdersManagement);
router.get('/orders/create', requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS), getOrderCreate);
router.get('/orders/:id', getOrderDetails);
router.get('/orders/:id/edit', requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS), getOrderEdit);

// Orders management - API endpoints
router.get('/api/orders/stats', getOrderStats);
router.post('/api/orders', requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS), createOrder);
router.post(
  '/api/orders/upload-parts',
  requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS),
  upload.single('file'),
  uploadPartsFromFile,
);
router.put('/api/orders/:id', requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS), updateOrder);
router.put('/api/orders/:id/status', requirePermission(PERMISSIONS.WRITE, PERMISSIONS.MANAGE_ORDERS), updateOrderStatus);
router.delete('/api/orders/:id', requirePermission(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_ORDERS), deleteOrder);

// Parts search API for order creation
router.get('/api/search', searchParts);
router.get('/api/search/autocomplete', autocomplete);

// Legacy delete route for compatibility
router.delete('/orders/:id', requirePermission(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_ORDERS), deleteOrder);

// Tickets management (read by default, write for replies)
router.get('/tickets', getTicketsManagement);
router.get('/tickets/:id', getTicketDetails);
router.post(
  '/tickets/:id/reply',
  requirePermission(PERMISSIONS.WRITE),
  ticketUpload.array('attachments', 5),
  postTicketReply,
);
router.put('/tickets/:id/status', requirePermission(PERMISSIONS.WRITE), updateTicketStatus);

// Tickets API endpoints
router.get('/api/tickets', getTicketsApi);
router.put('/api/tickets/:id/read', markTicketAsReadAdmin);

// Users management - Pages
router.get('/users', getUsersManagement);
router.get('/users/create', requirePermission(PERMISSIONS.MANAGE_USERS), getUserCreate);
router.get('/users/:id', getUserDetails);
router.get('/users/:id/edit', requirePermission(PERMISSIONS.MANAGE_USERS), getUserEdit);

// Users management - API endpoints (bulk routes must come BEFORE :id routes)
router.put('/api/users/bulk', requirePermission(PERMISSIONS.MANAGE_USERS), bulkUpdateUsers);
router.put('/api/users/bulk-approve', requirePermission(PERMISSIONS.MANAGE_USERS), bulkApproveUsers);
router.post('/api/users', requirePermission(PERMISSIONS.MANAGE_USERS), createUser);
router.put('/api/users/:id', requirePermission(PERMISSIONS.MANAGE_USERS), updateUser);
router.put('/api/users/:id/status', requirePermission(PERMISSIONS.MANAGE_USERS), updateUserStatus);
router.put('/api/users/:id/approve', requirePermission(PERMISSIONS.MANAGE_USERS), approveUser);
router.put('/api/users/:id/reject', requirePermission(PERMISSIONS.MANAGE_USERS), rejectUser);
router.put('/api/users/:id/suspend', requirePermission(PERMISSIONS.MANAGE_USERS), suspendUser);
router.delete('/api/users/:id', requireAllPermissions(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_USERS), deleteUser);

// Legacy routes for compatibility (bulk routes must come BEFORE :id routes)
router.put('/users/bulk', requirePermission(PERMISSIONS.MANAGE_USERS), bulkUpdateUsers);
router.put('/users/:id/status', requirePermission(PERMISSIONS.MANAGE_USERS), updateUserStatus);
router.delete('/users/:id', requireAllPermissions(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_USERS), deleteUser);

// Payments management
router.get('/payments/create', requirePermission(PERMISSIONS.WRITE), getPaymentCreate);
router.get('/payments/:id', getPaymentDetails);
router.get('/payments', getPaymentsManagement);

// Integrations management - Pages
router.get('/integrations', getIntegrationsManagement);
router.get('/integrations/create', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), getIntegrationCreate);
router.get('/integrations/:id/edit', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), getIntegrationEdit);

// Integrations API endpoints
router.get('/api/integrations', getIntegrations);
router.get('/api/integrations/:id', getIntegration);
router.post('/api/integrations', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), createIntegration);
router.put('/api/integrations/:id', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), updateIntegration);
router.delete('/api/integrations/:id', requireAllPermissions(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_INTEGRATIONS), deleteIntegration);
router.post('/api/integrations/test', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), testIntegrationConnection);
router.post('/api/integrations/:id/sync', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), syncIntegration);
router.get('/api/integrations/:id/status', getSyncStatus);
router.get('/api/integrations/:id/progress', getSyncProgress);
router.get('/api/integrations/:id/sync-details', getSyncDetails);
router.get('/api/integrations/:id/sync-history', getSyncHistory);

// Sync History API endpoints (system-wide)
router.get('/api/sync-history', getAllSyncHistory);
router.delete('/api/sync-history/:id', requirePermission(PERMISSIONS.DELETE), deleteSyncHistory);
router.post('/api/sync-history/:integrationId/cleanup', requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS), cleanupSyncHistory);

// Administrators management - Require manage_admins permission
router.get('/admins', requirePermission(PERMISSIONS.MANAGE_ADMINS), getAdminsManagement);
router.post('/api/admins', requirePermission(PERMISSIONS.MANAGE_ADMINS), createAdmin);
router.put('/api/admins/:id', requirePermission(PERMISSIONS.MANAGE_ADMINS), updateAdmin);
router.put('/api/admins/:id/status', requirePermission(PERMISSIONS.MANAGE_ADMINS), updateAdminStatus);
router.delete('/api/admins/:id', requireAllPermissions(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_ADMINS), deleteAdmin);

// Parts Analytics
router.get('/parts-analytics', getPartsAnalytics);

// Admin Settings - Require manage_settings permission for updates
router.get('/settings', getAdminSettings);

// System Settings API
router.get('/api/settings', getSystemSettings);
router.put('/api/settings', requirePermission(PERMISSIONS.MANAGE_SETTINGS), updateSystemSettings);

// ==========================================
// Email Inquiries Management
// ==========================================
// Pages
router.get('/email-inquiries', getEmailInquiries);
router.get('/email-inquiries/:id', getEmailInquiryDetails);

// API endpoints
router.get('/api/email-inquiries', getInquiriesApi);
router.get('/api/email-inquiries/stats', getInquiryStats);
router.post('/api/email-inquiries/check-now', requirePermission(PERMISSIONS.WRITE), triggerEmailCheck);
router.post('/api/email-inquiries/test-config', requirePermission(PERMISSIONS.MANAGE_SETTINGS), testEmailConfig);
router.post('/api/email-inquiries/scheduler/toggle', requirePermission(PERMISSIONS.MANAGE_SETTINGS), toggleScheduler);
router.post('/api/email-inquiries/:id/retry', requirePermission(PERMISSIONS.WRITE), retryInquiry);
router.post('/api/email-inquiries/:id/resend-quotation', requirePermission(PERMISSIONS.WRITE), resendQuotation);
router.post(
  '/api/email-inquiries/:id/regenerate-quotation',
  requirePermission(PERMISSIONS.WRITE),
  regenerateQuotation,
);
router.post('/api/email-inquiries/:id/notes', requirePermission(PERMISSIONS.WRITE), addNote);
router.patch('/api/email-inquiries/:id/status', requirePermission(PERMISSIONS.WRITE), updateInquiryStatus);
router.patch('/api/email-inquiries/:id/read', markAsRead);
router.delete('/api/email-inquiries/:id', requirePermission(PERMISSIONS.DELETE), deleteInquiry);

// ==========================================
// Referral Partners Management
// ==========================================
// Dashboard
router.get('/referrals', getReferralDashboard);

// Partner Pages
router.get('/referrals/partners', getReferralPartners);
router.get('/referrals/partners/create', requirePermission(PERMISSIONS.MANAGE_USERS), getReferralPartnerCreate);
router.get('/referrals/partners/:id', getReferralPartnerDetails);
router.get('/referrals/partners/:id/edit', requirePermission(PERMISSIONS.MANAGE_USERS), getReferralPartnerEdit);

// Commissions Page
router.get('/referrals/commissions', getCommissions);

// Payouts Page
router.get('/referrals/payouts', getPayouts);

// Partner Applications Page
router.get('/referrals/applications', getPartnerApplications);

// Partner API endpoints
router.get('/api/referrals/partners', getPartnersApi);
router.post('/api/referrals/partners', requirePermission(PERMISSIONS.MANAGE_USERS), createPartner);
router.put('/api/referrals/partners/:id', requirePermission(PERMISSIONS.MANAGE_USERS), updatePartner);
router.put('/api/referrals/partners/:id/status', requirePermission(PERMISSIONS.MANAGE_USERS), updatePartnerStatus);
router.post('/api/referrals/partners/:id/regenerate-code', requirePermission(PERMISSIONS.MANAGE_USERS), regenerateReferralCode);
router.delete('/api/referrals/partners/:id', requireAllPermissions(PERMISSIONS.DELETE, PERMISSIONS.MANAGE_USERS), deletePartner);

// Referral Code Management Pages (multiple codes per partner with validity periods)
router.get('/referrals/partners/:partnerId/codes/create', requirePermission(PERMISSIONS.MANAGE_USERS), getCodeCreatePage);
router.get('/referrals/codes/:codeId/edit', requirePermission(PERMISSIONS.MANAGE_USERS), getCodeEditPage);

// Referral Code API endpoints
router.get('/api/referrals/partners/:partnerId/codes', getPartnerCodesApi);
router.post('/api/referrals/partners/:partnerId/codes', requirePermission(PERMISSIONS.MANAGE_USERS), createReferralCode);
router.put('/api/referrals/codes/:codeId', requirePermission(PERMISSIONS.MANAGE_USERS), updateReferralCode);
router.delete('/api/referrals/codes/:codeId', requirePermission(PERMISSIONS.MANAGE_USERS), deleteReferralCode);
router.get('/api/referrals/codes/expiring', getExpiringCodesApi);
router.post('/api/referrals/codes/update-expired', requirePermission(PERMISSIONS.WRITE), updateExpiredCodesApi);
router.get('/api/referrals/codes/generate', generateCodeApi);

// Commission API endpoints
router.get('/api/referrals/commissions', getCommissionsApi);
router.get('/api/referrals/commissions/stats', getCommissionStats);
router.put('/api/referrals/commissions/:id/review', requirePermission(PERMISSIONS.WRITE), reviewCommission);
router.post('/api/referrals/commissions/bulk-review', requirePermission(PERMISSIONS.WRITE), bulkReviewCommissions);

// Payout API endpoints
router.get('/api/referrals/payouts', getPayoutsApi);
router.get('/api/referrals/payouts/ready', getPartnersReadyForPayout);
router.post('/api/referrals/payouts', requirePermission(PERMISSIONS.WRITE), createPayout);
router.put('/api/referrals/payouts/:id/process', requirePermission(PERMISSIONS.WRITE), processPayout);

// Partner Applications API endpoints
router.get('/api/referrals/applications', getApplicationsApi);
router.get('/api/referrals/applications/count', getPendingApplicationsCount);
router.get('/api/referrals/applications/:id', getApplicationDetails);
router.post('/api/referrals/applications/:id/approve', requirePermission(PERMISSIONS.MANAGE_USERS), approveApplication);
router.post('/api/referrals/applications/:id/reject', requirePermission(PERMISSIONS.MANAGE_USERS), rejectApplication);

module.exports = router;

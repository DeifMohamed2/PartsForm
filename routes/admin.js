const express = require('express');
const router = express.Router();
const { requireAdminAuth, requireAdminRole } = require('../middleware/auth');
const {
  getAdminDashboard,
  getOrdersManagement,
  getOrderDetails,
  getOrderCreate,
  getOrderEdit,
  deleteOrder,
  getTicketsManagement,
  getTicketDetails,
  postTicketReply,
  updateTicketStatus,
  getUsersManagement,
  getUserDetails,
  getUserCreate,
  getUserEdit,
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  getPaymentsManagement,
  getPaymentDetails,
  getPaymentCreate,
  getAdminSettings,
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
} = require('../controllers/adminController');

// Apply admin auth middleware to all routes
router.use(requireAdminAuth);

// Admin dashboard
router.get('/', getAdminDashboard);

// Orders management
router.get('/orders', getOrdersManagement);
router.get('/orders/create', getOrderCreate);
router.get('/orders/:id', getOrderDetails);
router.get('/orders/:id/edit', getOrderEdit);
router.delete('/orders/:id', deleteOrder);

// Tickets management
router.get('/tickets', getTicketsManagement);
router.get('/tickets/:id', getTicketDetails);
router.post('/tickets/:id/reply', postTicketReply);
router.put('/tickets/:id/status', updateTicketStatus);

// Users management
router.get('/users', getUsersManagement);
router.get('/users/create', getUserCreate);
router.get('/users/:id', getUserDetails);
router.get('/users/:id/edit', getUserEdit);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/bulk', bulkUpdateUsers);
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

// Other admin pages
router.get('/settings', getAdminSettings);

// Parts Analytics
router.get('/parts-analytics', getPartsAnalytics);

module.exports = router;




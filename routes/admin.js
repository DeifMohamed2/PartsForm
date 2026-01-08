const express = require('express');
const router = express.Router();
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
  getIntegrationCreate
} = require('../controllers/adminController');

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

// Other admin pages
router.get('/integrations/create', getIntegrationCreate);
router.get('/integrations', getIntegrationsManagement);
router.get('/settings', getAdminSettings);

module.exports = router;




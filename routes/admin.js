const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getOrdersManagement,
  getTicketsManagement,
  getUsersManagement,
  getPaymentsManagement,
  getAOGManagement,
  getAdminSettings
} = require('../controllers/adminController');

// Admin dashboard
router.get('/', getAdminDashboard);

// Admin management pages
router.get('/orders', getOrdersManagement);
router.get('/tickets', getTicketsManagement);
router.get('/users', getUsersManagement);
router.get('/payments', getPaymentsManagement);
router.get('/aog', getAOGManagement);
router.get('/settings', getAdminSettings);

module.exports = router;

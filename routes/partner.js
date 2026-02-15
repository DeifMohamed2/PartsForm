/**
 * Partner Portal Routes
 * Routes for referral partner authentication and dashboard
 */

const express = require('express');
const router = express.Router();
const { requireReferralPartnerAuth } = require('../middleware/auth');
const {
  getLoginPage,
  login,
  logout,
  getDashboard,
  getCommissions,
  getPayouts,
  getProfile,
  updateProfile,
  changePassword,
  getStats
} = require('../controllers/partnerController');

// ====================================
// PUBLIC ROUTES (No auth required)
// ====================================

// Login page
router.get('/login', getLoginPage);
router.post('/login', login);

// ====================================
// PROTECTED ROUTES (Auth required)
// ====================================

// Logout
router.get('/logout', logout);
router.post('/logout', logout);

// Dashboard
router.get('/', requireReferralPartnerAuth, (req, res) => res.redirect('/partner/dashboard'));
router.get('/dashboard', requireReferralPartnerAuth, getDashboard);

// Commissions
router.get('/commissions', requireReferralPartnerAuth, getCommissions);

// Payouts
router.get('/payouts', requireReferralPartnerAuth, getPayouts);

// Profile
router.get('/profile', requireReferralPartnerAuth, getProfile);

// ====================================
// API ROUTES
// ====================================

// Profile API
router.put('/api/profile', requireReferralPartnerAuth, updateProfile);
router.put('/api/password', requireReferralPartnerAuth, changePassword);

// Stats API
router.get('/api/stats', requireReferralPartnerAuth, getStats);

module.exports = router;

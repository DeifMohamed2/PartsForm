const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getCurrentUser,
  getRegisterPage,
  validateReferralCodeForRegistration,
  unifiedLogin,
} = require('../controllers/authController');
const {
  getForgotPasswordPage,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  resendVerificationCode,
} = require('../controllers/passwordResetController');
const { redirectIfAuthenticated, requireAuth } = require('../middleware/auth');

// Page routes (redirect if already logged in)
router.get('/register', redirectIfAuthenticated, getRegisterPage);

// Forgot Password Pages
router.get('/forgot-password', redirectIfAuthenticated, getForgotPasswordPage);
router.get('/forgot-password/partner', (req, res) => res.render('Landing/forgot-password-partner'));
router.get('/forgot-password/supplier', (req, res) => res.render('Landing/forgot-password-supplier'));

// API routes
router.post('/register', register);
router.post('/login', login);

// Unified login — handles admin, buyer, partner, and supplier from one endpoint
router.post('/api/unified-login', unifiedLogin);
router.get('/logout', logout);
router.post('/logout', logout);

// Referral code validation for registration (public - before user is authenticated)
router.post('/api/referral/validate-registration', validateReferralCodeForRegistration);

// Password Reset API routes
router.post('/forgot-password', requestPasswordReset);
router.post('/forgot-password/verify', verifyResetCode);
router.post('/forgot-password/reset', resetPassword);
router.post('/forgot-password/resend', resendVerificationCode);

// Get current user (protected)
router.get('/api/me', requireAuth, getCurrentUser);

module.exports = router;

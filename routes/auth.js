const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getCurrentUser,
  getRegisterPage,
} = require('../controllers/authController');
const { redirectIfAuthenticated, requireAuth } = require('../middleware/auth');

// Page routes (redirect if already logged in)
router.get('/register', redirectIfAuthenticated, getRegisterPage);

// API routes
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.post('/logout', logout);

// Get current user (protected)
router.get('/api/me', requireAuth, getCurrentUser);

module.exports = router;

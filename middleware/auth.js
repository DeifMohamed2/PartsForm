const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');

// JWT Secret - Should match authController
const JWT_SECRET = process.env.JWT_SECRET || 'partsform-secret-key-change-in-production';

/**
 * Middleware to protect routes - requires authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      // Check if it's an API request
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please login.',
          redirectUrl: '/',
        });
      }
      // Redirect to home page (where login modal is)
      return res.redirect('/?login=true');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find buyer
    const buyer = await Buyer.findById(decoded.id);

    if (!buyer) {
      // Clear invalid cookie
      res.cookie('token', '', { expires: new Date(0), httpOnly: true });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please login again.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/?login=true');
    }

    // Check if account is active
    if (!buyer.isActive) {
      res.cookie('token', '', { expires: new Date(0), httpOnly: true });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }
      return res.redirect('/?login=true');
    }

    // Attach user to request
    req.user = buyer;
    res.locals.user = buyer; // Make user available in views

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    // Clear cookie on token error
    res.cookie('token', '', { expires: new Date(0), httpOnly: true });

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/?login=true');
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error. Please try again.',
      });
    }
    return res.redirect('/?login=true');
  }
};

/**
 * Middleware to check if user is already logged in
 * Redirects to buyer dashboard if already authenticated
 */
const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id);

    if (buyer && buyer.isActive) {
      // User is already logged in, redirect to buyer dashboard
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Already authenticated',
          redirectUrl: '/buyer',
        });
      }
      return res.redirect('/buyer');
    }

    next();
  } catch (error) {
    // Token is invalid, clear it and continue
    res.cookie('token', '', { expires: new Date(0), httpOnly: true });
    next();
  }
};

/**
 * Middleware to optionally attach user to request
 * Does not require authentication, but attaches user if available
 */
const attachUser = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      req.user = null;
      res.locals.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id);

    if (buyer && buyer.isActive) {
      req.user = buyer;
      res.locals.user = buyer;
    } else {
      req.user = null;
      res.locals.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    res.locals.user = null;
    next();
  }
};

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
  attachUser,
};

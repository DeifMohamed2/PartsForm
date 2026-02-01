const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');
const Admin = require('../models/Admin');

// JWT Secret - Should match authController
const JWT_SECRET = process.env.JWT_SECRET || 'partsform-secret-key-change-in-production';

/**
 * Middleware to protect buyer routes - requires buyer authentication
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

    // Check if this is a buyer token
    if (decoded.role && decoded.role !== 'buyer') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Buyer account required.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/');
    }

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
          message: 'Your account has been deactivated. Please contact support for assistance.',
        });
      }
      return res.redirect('/?login=true');
    }

    // Attach user to request
    req.user = buyer;
    req.userRole = 'buyer';
    res.locals.user = buyer; // Make user available in views
    res.locals.userRole = 'buyer';

    next();
  } catch (error) {
    // Log error only in development or for unexpected errors
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('Auth middleware error:', error);
    }

    // Clear invalid cookie
    res.cookie('token', '', { 
      expires: new Date(0), 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Determine appropriate message based on error type
    let message = 'Session expired. Please login again.';
    if (error.name === 'JsonWebTokenError') {
      message = 'Invalid session. Please login again.';
    } else if (error.name === 'TokenExpiredError') {
      message = 'Your session has expired. Please login again.';
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: message,
        redirectUrl: '/',
        clearSession: true, // Signal client to clear any local state
      });
    }
    return res.redirect('/?login=true');
  }
};

/**
 * Middleware to protect admin routes - requires admin authentication
 */
const requireAdminAuth = async (req, res, next) => {
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
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please login.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/?login=true');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if this is an admin token
    if (!decoded.role || decoded.role !== 'admin') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/');
    }

    // Find admin
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      res.cookie('token', '', { expires: new Date(0), httpOnly: true });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found. Please login again.',
          redirectUrl: '/',
        });
      }
      return res.redirect('/?login=true');
    }

    // Check if account is active
    if (!admin.isActive) {
      res.cookie('token', '', { expires: new Date(0), httpOnly: true });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Your admin account has been deactivated.',
        });
      }
      return res.redirect('/?login=true');
    }

    // Attach admin to request
    req.user = admin;
    req.userRole = 'admin';
    req.adminRole = admin.role; // super_admin, admin, moderator
    res.locals.user = admin;
    res.locals.userRole = 'admin';
    res.locals.adminRole = admin.role;

    next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('Admin auth middleware error:', error);
    }

    res.cookie('token', '', { 
      expires: new Date(0), 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    let message = 'Session expired. Please login again.';
    if (error.name === 'JsonWebTokenError') {
      message = 'Invalid session. Please login again.';
    } else if (error.name === 'TokenExpiredError') {
      message = 'Your session has expired. Please login again.';
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: message,
        redirectUrl: '/',
        clearSession: true,
      });
    }
    return res.redirect('/?login=true');
  }
};

/**
 * Middleware to require specific admin role
 */
const requireAdminRole = (...roles) => {
  return (req, res, next) => {
    if (!req.adminRole) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
      }
      return res.redirect('/');
    }

    // super_admin has access to everything
    if (req.adminRole === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.adminRole)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient privileges.',
        });
      }
      return res.redirect('/admin');
    }

    next();
  };
};

/**
 * Middleware to check if user is already logged in
 * Redirects to appropriate dashboard if already authenticated
 */
const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if admin or buyer based on role in token
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(200).json({
            success: true,
            message: 'Already authenticated',
            redirectUrl: '/admin',
          });
        }
        return res.redirect('/admin');
      }
    } else {
      const buyer = await Buyer.findById(decoded.id);
      if (buyer && buyer.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(200).json({
            success: true,
            message: 'Already authenticated',
            redirectUrl: '/buyer',
          });
        }
        return res.redirect('/buyer');
      }
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
      res.locals.userRole = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check role from token
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.isActive) {
        req.user = admin;
        req.userRole = 'admin';
        res.locals.user = admin;
        res.locals.userRole = 'admin';
      } else {
        req.user = null;
        res.locals.user = null;
        res.locals.userRole = null;
      }
    } else {
      const buyer = await Buyer.findById(decoded.id);
      if (buyer && buyer.isActive) {
        req.user = buyer;
        req.userRole = 'buyer';
        res.locals.user = buyer;
        res.locals.userRole = 'buyer';
      } else {
        req.user = null;
        res.locals.user = null;
        res.locals.userRole = null;
      }
    }

    next();
  } catch (error) {
    req.user = null;
    res.locals.user = null;
    res.locals.userRole = null;
    next();
  }
};

module.exports = {
  requireAuth,
  requireAdminAuth,
  requireAdminRole,
  redirectIfAuthenticated,
  attachUser,
};

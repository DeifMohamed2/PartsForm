const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');
const Admin = require('../models/Admin');

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'partsform-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token with role
 */
const generateToken = (userId, role = 'buyer') => {
  return jwt.sign({ id: userId, role: role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Set token cookie
 */
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res.cookie('token', token, cookieOptions);
};

/**
 * Handle validation errors from Mongoose
 * Returns both field errors object and a formatted message
 */
const handleValidationError = (error) => {
  const errors = {};
  const errorMessages = [];

  if (error.name === 'ValidationError') {
    Object.keys(error.errors).forEach((key) => {
      const message = error.errors[key].message;
      errors[key] = message;
      errorMessages.push(message);
    });
  }

  return {
    errors,
    message: errorMessages.length > 0 
      ? `Validation failed: ${errorMessages.join(', ')}` 
      : 'Validation failed'
  };
};

/**
 * Register new buyer
 * POST /register
 */
const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      country,
      city,
      shippingAddress,
      password,
      confirmPassword,
      agreeTerms,
      newsletter,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone number',
      companyName: 'Company name',
      country: 'Country',
      city: 'City',
      shippingAddress: 'Shipping address',
      password: 'Password',
    };

    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (!req.body[field] || req.body[field].trim() === '') {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        errors: { fields: missingFields },
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        errors: { confirmPassword: 'Passwords do not match' },
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
        errors: { password: 'Password must be at least 8 characters long' },
      });
    }

    // Validate terms agreement
    if (!agreeTerms) {
      return res.status(400).json({
        success: false,
        message: 'You must agree to the Terms of Service and Privacy Policy',
        errors: { agreeTerms: 'You must agree to the terms' },
      });
    }

    // Check if email already exists
    const existingBuyer = await Buyer.findOne({ email: email.toLowerCase() });
    if (existingBuyer) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        errors: { email: 'Email is already registered' },
      });
    }

    // Create new buyer
    const buyer = new Buyer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      companyName: companyName.trim(),
      country: country.trim(),
      city: city.trim(),
      shippingAddress: shippingAddress.trim(),
      password,
      newsletter: newsletter === 'on' || newsletter === true,
      termsAcceptedAt: new Date(),
      isActive: true, // Account is active by default
    });

    await buyer.save();

    // Generate JWT token
    const token = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set JWT in HTTP-only cookie
    res.cookie('buyerToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        user: {
          id: buyer._id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          companyName: buyer.companyName,
        },
        redirectUrl: '/buyer/dashboard',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationResult = handleValidationError(error);
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        errors: validationResult.errors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        errors: { email: 'Email is already registered' },
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.',
    });
  }
};

/**
 * Login user (admin or buyer)
 * POST /login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        errors: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
        },
      });
    }

    const normalizedEmail = email.toLowerCase();

    // First, check if it's an admin account
    const admin = await Admin.findByEmailWithPassword(normalizedEmail);

    if (admin) {
      // Handle admin login
      return handleAdminLogin(admin, password, res);
    }

    // If not admin, try buyer login
    const buyer = await Buyer.findByEmailWithPassword(normalizedEmail);

    if (!buyer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errors: { credentials: 'Invalid credentials' },
      });
    }

    // Handle buyer login
    return handleBuyerLogin(buyer, password, res);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login. Please try again.',
    });
  }
};

/**
 * Handle admin login logic
 */
const handleAdminLogin = async (admin, password, res) => {
  // Check if account is locked
  if (admin.isLocked()) {
    const lockTimeRemaining = Math.ceil((admin.lockUntil - Date.now()) / (60 * 1000));
    return res.status(423).json({
      success: false,
      message: `Account is temporarily locked. Please try again in ${lockTimeRemaining} minutes.`,
      errors: { account: 'Account is locked' },
    });
  }

  // Check if account is active
  if (!admin.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.',
      errors: { account: 'Account is deactivated' },
    });
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    await admin.incrementLoginAttempts();
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      errors: { credentials: 'Invalid credentials' },
    });
  }

  // Reset login attempts on successful login
  await admin.resetLoginAttempts();

  // Generate token with admin role
  const token = generateToken(admin._id, 'admin');

  // Set cookie
  setTokenCookie(res, token);

  // Return success response
  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
      },
      role: 'admin',
      redirectUrl: '/admin',
    },
  });
};

/**
 * Handle buyer login logic
 */
const handleBuyerLogin = async (buyer, password, res) => {
  // Check if account is locked
  if (buyer.isLocked()) {
    const lockTimeRemaining = Math.ceil((buyer.lockUntil - Date.now()) / (60 * 1000));
    return res.status(423).json({
      success: false,
      message: `Account is temporarily locked. Please try again in ${lockTimeRemaining} minutes.`,
      errors: { account: 'Account is locked' },
    });
  }

  // Check if account is active
  if (!buyer.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support for assistance.',
      errors: { account: 'Account is inactive' },
    });
  }

  // Verify password
  const isPasswordValid = await buyer.comparePassword(password);

  if (!isPasswordValid) {
    await buyer.incrementLoginAttempts();
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      errors: { credentials: 'Invalid credentials' },
    });
  }

  // Reset login attempts on successful login
  await buyer.resetLoginAttempts();

  // Generate token with buyer role
  const token = generateToken(buyer._id, 'buyer');

  // Set cookie
  setTokenCookie(res, token);

  // Return success response
  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: buyer._id,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        companyName: buyer.companyName,
      },
      role: 'buyer',
      redirectUrl: '/buyer',
    },
  });
};

/**
 * Logout buyer
 * POST /logout or GET /logout
 */
const logout = (req, res) => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
  });

  // Check if it's an API request or page request
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      redirectUrl: '/',
    });
  }

  res.redirect('/');
};

/**
 * Get current user (for API)
 * GET /api/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: buyer,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again.',
    });
  }
};

/**
 * Get register page
 */
const getRegisterPage = (req, res) => {
  res.render('Landing/register', {
    title: 'Create Account | PARTSFORM',
    pageClass: 'page-register',
  });
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  getRegisterPage,
  generateToken,
  JWT_SECRET,
};

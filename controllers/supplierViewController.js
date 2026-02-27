/**
 * Supplier View Controller
 * Handles rendering of supplier portal views
 */

const Supplier = require('../models/Supplier');
const Part = require('../models/Part');
const jwt = require('jsonwebtoken');

// Helper to verify supplier from cookie/session
const getSupplierFromRequest = async (req) => {
  try {
    // Try to get token from cookie or authorization header
    let token = req.cookies?.supplierToken;
    
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const supplier = await Supplier.findById(decoded.supplierId || decoded.id);
    
    return supplier;
  } catch (err) {
    return null;
  }
};

// Helper to get parts count for sidebar
const getPartsCount = async (supplierId) => {
  try {
    return await Part.countDocuments({
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    });
  } catch (err) {
    return 0;
  }
};

// Middleware to check supplier auth for views
exports.requireAuth = async (req, res, next) => {
  const supplier = await getSupplierFromRequest(req);
  
  if (!supplier) {
    return res.redirect('/supplier/login');
  }
  
  req.supplier = supplier;
  next();
};

// Dashboard
exports.dashboard = async (req, res) => {
  try {
    const partsCount = await getPartsCount(req.supplier._id);
    
    res.render('supplier/dashboard', {
      title: 'Dashboard | Supplier Portal',
      supplier: req.supplier,
      partsCount
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('supplier/dashboard', {
      title: 'Dashboard | Supplier Portal',
      supplier: req.supplier,
      partsCount: 0
    });
  }
};

// Login page
exports.login = (req, res) => {
  res.render('supplier/login', {
    title: 'Login | Supplier Portal'
  });
};

// Parts list
exports.parts = async (req, res) => {
  try {
    const partsCount = await getPartsCount(req.supplier._id);
    
    res.render('supplier/parts', {
      title: 'My Parts | Supplier Portal',
      supplier: req.supplier,
      partsCount
    });
  } catch (err) {
    console.error('Parts view error:', err);
    res.render('supplier/parts', {
      title: 'My Parts | Supplier Portal',
      supplier: req.supplier,
      partsCount: 0
    });
  }
};

// Import page
exports.import = async (req, res) => {
  try {
    const partsCount = await getPartsCount(req.supplier._id);
    
    res.render('supplier/import', {
      title: 'Upload Parts | Supplier Portal',
      supplier: req.supplier,
      partsCount
    });
  } catch (err) {
    console.error('Import view error:', err);
    res.render('supplier/import', {
      title: 'Upload Parts | Supplier Portal',
      supplier: req.supplier,
      partsCount: 0
    });
  }
};

// Files list
exports.files = async (req, res) => {
  try {
    const partsCount = await getPartsCount(req.supplier._id);
    
    res.render('supplier/files', {
      title: 'Import Files | Supplier Portal',
      supplier: req.supplier,
      partsCount
    });
  } catch (err) {
    console.error('Files view error:', err);
    res.redirect('/supplier');
  }
};

// Settings
exports.settings = async (req, res) => {
  try {
    const partsCount = await getPartsCount(req.supplier._id);
    
    res.render('supplier/settings', {
      title: 'Settings | Supplier Portal',
      supplier: req.supplier,
      partsCount
    });
  } catch (err) {
    console.error('Settings view error:', err);
    res.redirect('/supplier');
  }
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie('supplierToken');
  res.redirect('/supplier/login');
};

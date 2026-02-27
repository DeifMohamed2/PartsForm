/**
 * Supplier View Controller
 * Handles rendering of supplier portal views
 */

const Supplier = require('../models/Supplier');
const DataTable = require('../models/DataTable');
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
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/dashboard', {
      title: 'Dashboard | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('supplier/dashboard', {
      title: 'Dashboard | Supplier Portal',
      supplier: req.supplier,
      tableCount: 0
    });
  }
};

// Login page
exports.login = (req, res) => {
  res.render('supplier/login', {
    title: 'Login | Supplier Portal'
  });
};

// Tables list
exports.tables = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/tables', {
      title: 'My Tables | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Tables view error:', err);
    res.render('supplier/tables', {
      title: 'My Tables | Supplier Portal',
      supplier: req.supplier,
      tableCount: 0
    });
  }
};

// Spreadsheet view (table editor)
exports.spreadsheet = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const table = await DataTable.findOne({
      _id: tableId,
      supplier: req.supplier.getEffectiveSupplierId()
    });
    
    if (!table) {
      return res.redirect('/supplier/tables');
    }
    
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/spreadsheet', {
      title: `${table.name} | Supplier Portal`,
      supplier: req.supplier,
      tableCount,
      tableId
    });
  } catch (err) {
    console.error('Spreadsheet view error:', err);
    res.redirect('/supplier/tables');
  }
};

// Import page
exports.import = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/import', {
      title: 'Import Data | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Import view error:', err);
    res.render('supplier/import', {
      title: 'Import Data | Supplier Portal',
      supplier: req.supplier,
      tableCount: 0
    });
  }
};

// SFTP settings
exports.sftp = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/sftp', {
      title: 'SFTP Settings | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('SFTP view error:', err);
    res.render('supplier/sftp', {
      title: 'SFTP Settings | Supplier Portal',
      supplier: req.supplier,
      tableCount: 0
    });
  }
};

// Exports history
exports.exports = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/exports', {
      title: 'Exports | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Exports view error:', err);
    res.redirect('/supplier');
  }
};

// API settings
exports.api = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/api', {
      title: 'API Access | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('API view error:', err);
    res.redirect('/supplier');
  }
};

// Team management
exports.team = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/team', {
      title: 'Team Members | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Team view error:', err);
    res.redirect('/supplier');
  }
};

// Audit logs
exports.audit = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/audit', {
      title: 'Audit Logs | Supplier Portal',
      supplier: req.supplier,
      tableCount
    });
  } catch (err) {
    console.error('Audit view error:', err);
    res.redirect('/supplier');
  }
};

// Settings
exports.settings = async (req, res) => {
  try {
    const tableCount = await DataTable.countDocuments({ 
      supplier: req.supplier.getEffectiveSupplierId() 
    });
    
    res.render('supplier/settings', {
      title: 'Settings | Supplier Portal',
      supplier: req.supplier,
      tableCount
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

/**
 * Supplier Routes
 * API endpoints for supplier parts management portal
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireSupplierAuth, requireSupplierPermission } = require('../middleware/auth');
const supplierPartsController = require('../controllers/supplierPartsController');
const supplierAuthController = require('../controllers/supplierAuthController');

// Configure multer for file uploads (50MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // For unknown file types
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: CSV, XLSX, XLS'));
    }
  },
});

// ==================== AUTH ROUTES (Public) ====================
// NOTE: Self-registration disabled - suppliers are created by admin only
router.post('/auth/login', supplierAuthController.login);
router.post('/auth/forgot-password', supplierAuthController.forgotPassword);
router.post('/auth/reset-password', supplierAuthController.resetPassword);
router.post('/auth/verify-email/:token', supplierAuthController.verifyEmail);
// First login password change (uses temp token from login)
router.post('/auth/change-password', requireSupplierAuth, supplierAuthController.firstLoginChangePassword);

// ==================== AUTH ROUTES (Protected) ====================
router.post('/auth/logout', requireSupplierAuth, supplierAuthController.logout);
router.get('/auth/me', requireSupplierAuth, supplierAuthController.getProfile);
router.get('/profile', requireSupplierAuth, supplierAuthController.getProfile);
router.put('/auth/profile', requireSupplierAuth, supplierAuthController.updateProfile);
router.put('/auth/password', requireSupplierAuth, supplierAuthController.changePassword);

// ==================== DASHBOARD ====================
router.get('/dashboard', requireSupplierAuth, supplierPartsController.getDashboard);

// ==================== PARTS ROUTES ====================
router.get('/parts', requireSupplierAuth, supplierPartsController.getParts);
router.get('/parts/export', requireSupplierAuth, requireSupplierPermission('export_data'), supplierPartsController.exportParts);
router.post('/parts/import', requireSupplierAuth, requireSupplierPermission('import_data'), upload.single('file'), supplierPartsController.importParts);
router.post('/parts/preview', requireSupplierAuth, upload.single('file'), supplierPartsController.previewImport);

// Bulk operations
router.put('/parts/bulk', requireSupplierAuth, requireSupplierPermission('write_data'), supplierPartsController.bulkUpdateParts);
router.delete('/parts/bulk', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierPartsController.bulkDeleteParts);
router.delete('/parts/delete-all', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierPartsController.deleteAllParts);

// Single part operations
router.get('/parts/:partId', requireSupplierAuth, supplierPartsController.getPart);
router.put('/parts/:partId', requireSupplierAuth, requireSupplierPermission('write_data'), supplierPartsController.updatePart);
router.delete('/parts/:partId', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierPartsController.deletePart);

// ==================== FILES ROUTES ====================
router.get('/files', requireSupplierAuth, supplierPartsController.getFiles);
router.delete('/files/:fileName', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierPartsController.deleteFile);

// ==================== DATA MANAGEMENT ROUTES ====================
router.get('/brands', requireSupplierAuth, supplierPartsController.getBrands);
router.get('/import-summary', requireSupplierAuth, supplierPartsController.getImportSummary);
router.delete('/parts/criteria', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierPartsController.deletePartsByCriteria);

// ==================== TEAM MANAGEMENT ROUTES ====================
router.get('/team', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.getTeamMembers);
router.post('/team', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.inviteTeamMember);
router.put('/team/:memberId', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.updateTeamMember);
router.delete('/team/:memberId', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.removeTeamMember);

module.exports = router;

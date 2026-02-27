/**
 * Supplier Routes
 * API endpoints for supplier data management portal
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireSupplierAuth, requireSupplierPermission } = require('../middleware/auth');
const supplierDataController = require('../controllers/supplierDataController');
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
router.get('/profile', requireSupplierAuth, supplierAuthController.getProfile); // Alias
router.put('/auth/profile', requireSupplierAuth, supplierAuthController.updateProfile);
router.put('/auth/password', requireSupplierAuth, supplierAuthController.changePassword);
router.post('/auth/api-key', requireSupplierAuth, requireSupplierPermission('manage_sftp'), supplierAuthController.generateApiKey);
router.delete('/auth/api-key', requireSupplierAuth, requireSupplierPermission('manage_sftp'), supplierAuthController.revokeApiKey);

// ==================== DASHBOARD ====================
router.get('/dashboard', requireSupplierAuth, supplierAuthController.getDashboard);

// ==================== TABLE ROUTES ====================
router.get('/tables', requireSupplierAuth, supplierDataController.getTables);
router.post('/tables', requireSupplierAuth, requireSupplierPermission('manage_tables'), supplierDataController.createTable);
router.get('/tables/:tableId', requireSupplierAuth, supplierDataController.getTable);
router.put('/tables/:tableId', requireSupplierAuth, requireSupplierPermission('manage_tables'), supplierDataController.updateTable);
router.put('/tables/:tableId/columns', requireSupplierAuth, requireSupplierPermission('manage_tables'), supplierDataController.updateTableColumns);
router.post('/tables/:tableId/archive', requireSupplierAuth, requireSupplierPermission('manage_tables'), supplierDataController.archiveTable);
router.delete('/tables/:tableId', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierDataController.deleteTable);

// ==================== RECORD ROUTES ====================
router.get('/tables/:tableId/records', requireSupplierAuth, supplierDataController.getRecords);
router.post('/tables/:tableId/records', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.createRecord);
router.get('/tables/:tableId/records/:recordId', requireSupplierAuth, supplierDataController.getRecord);
router.put('/tables/:tableId/records/:recordId', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.updateRecord);
router.delete('/tables/:tableId/records/:recordId', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierDataController.deleteRecord);

// Bulk operations
router.post('/tables/:tableId/records/bulk', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.bulkCreateRecords);
router.put('/tables/:tableId/records/bulk', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.bulkUpdateRecords);
router.delete('/tables/:tableId/records/bulk', requireSupplierAuth, requireSupplierPermission('delete_data'), supplierDataController.bulkDeleteRecords);

// Version history
router.get('/tables/:tableId/records/:recordId/history', requireSupplierAuth, supplierDataController.getRecordHistory);
router.post('/tables/:tableId/records/:recordId/restore', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.restoreRecord);
router.post('/tables/:tableId/records/:recordId/restore-version', requireSupplierAuth, requireSupplierPermission('write_data'), supplierDataController.restoreRecordVersion);

// ==================== IMPORT/EXPORT ROUTES ====================
router.post('/tables/:tableId/import/preview', requireSupplierAuth, requireSupplierPermission('import_data'), upload.single('file'), supplierDataController.previewImport);
router.post('/tables/:tableId/import', requireSupplierAuth, requireSupplierPermission('import_data'), upload.single('file'), supplierDataController.importData);
router.get('/tables/:tableId/export', requireSupplierAuth, requireSupplierPermission('export_data'), supplierDataController.exportData);
router.post('/tables/:tableId/export', requireSupplierAuth, requireSupplierPermission('export_data'), supplierDataController.exportData);
router.get('/exports/:exportId/download', requireSupplierAuth, supplierDataController.downloadExport);

// ==================== SFTP ROUTES ====================
router.post('/sftp/test', requireSupplierAuth, requireSupplierPermission('manage_sftp'), supplierDataController.testSFTPConnection);
router.put('/sftp/config', requireSupplierAuth, requireSupplierPermission('manage_sftp'), supplierDataController.updateSFTPConfig);
router.post('/tables/:tableId/sftp/export', requireSupplierAuth, requireSupplierPermission('export_data'), supplierDataController.exportToSFTP);
router.post('/sftp/trigger-export', requireSupplierAuth, requireSupplierPermission('export_data'), supplierDataController.triggerScheduledExport);

// ==================== AUDIT & HISTORY ROUTES ====================
router.get('/audit-logs', requireSupplierAuth, requireSupplierPermission('view_audit_logs'), supplierDataController.getAuditLogs);
router.get('/audit', requireSupplierAuth, supplierDataController.getAuditLogs); // Alias without permission for basic logs
router.get('/exports', requireSupplierAuth, supplierDataController.getExportHistory);

// ==================== TEAM MANAGEMENT ROUTES ====================
router.get('/team', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.getTeamMembers);
router.post('/team', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.inviteTeamMember);
router.put('/team/:memberId', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.updateTeamMember);
router.delete('/team/:memberId', requireSupplierAuth, requireSupplierPermission('manage_users'), supplierAuthController.removeTeamMember);

module.exports = router;

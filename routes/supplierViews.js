/**
 * Supplier View Routes
 * Page/view routes for supplier data management portal
 */
const express = require('express');
const router = express.Router();
const supplierViewController = require('../controllers/supplierViewController');

// Public routes
router.get('/login', supplierViewController.login);
router.get('/logout', supplierViewController.logout);

// Protected routes (require authentication)
router.get('/', supplierViewController.requireAuth, supplierViewController.dashboard);
router.get('/tables', supplierViewController.requireAuth, supplierViewController.tables);
router.get('/tables/:tableId', supplierViewController.requireAuth, supplierViewController.spreadsheet);
router.get('/tables/:tableId/settings', supplierViewController.requireAuth, supplierViewController.spreadsheet);
router.get('/import', supplierViewController.requireAuth, supplierViewController.import);
router.get('/exports', supplierViewController.requireAuth, supplierViewController.exports);
router.get('/team', supplierViewController.requireAuth, supplierViewController.team);
router.get('/audit', supplierViewController.requireAuth, supplierViewController.audit);
router.get('/settings', supplierViewController.requireAuth, supplierViewController.settings);

module.exports = router;

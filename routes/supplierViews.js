/**
 * Supplier View Routes
 * Page/view routes for supplier parts management portal
 */
const express = require('express');
const router = express.Router();
const supplierViewController = require('../controllers/supplierViewController');

// Public routes
router.get('/login', supplierViewController.login);
router.get('/logout', supplierViewController.logout);

// Protected routes (require authentication)
router.get('/', supplierViewController.requireAuth, supplierViewController.dashboard);
router.get('/parts', supplierViewController.requireAuth, supplierViewController.parts);
router.get('/import', supplierViewController.requireAuth, supplierViewController.import);
router.get('/files', supplierViewController.requireAuth, supplierViewController.files);
router.get('/settings', supplierViewController.requireAuth, supplierViewController.settings);

module.exports = router;

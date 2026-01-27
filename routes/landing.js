const express = require('express');
const router = express.Router();
const {
  getLandingPage,
  getSearchPage,
  getSearch2Page,
  searchParts,
  getSectors,
  downloadSampleExcel,
} = require('../controllers/landingController');
const { attachUser } = require('../middleware/auth');

// Apply attachUser middleware to make user available in all landing pages
router.use(attachUser);

// Landing page routes
router.get('/', getLandingPage);

// Note: Registration routes are now handled by /routes/auth.js

// Other search routes
router.get('/search/:industry', getSearchPage);
router.get('/search2', getSearch2Page);

// API routes
router.post('/api/search', searchParts);
router.get('/api/sectors', getSectors);
router.get('/api/download-sample-excel', downloadSampleExcel);

module.exports = router;

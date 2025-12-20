const express = require('express');
const router = express.Router();
const {
  getLandingPage,
  getSearchPage,
  getSearch2Page,
  getAutomotiveSearchPage,
  getAviationSearchPage,
  getHeavyMachinerySearchPage,
  searchParts,
  getSectors,
  downloadSampleExcel,
} = require('../controllers/landingController');

// Landing page routes
router.get('/', getLandingPage);

// Industry-specific themed search pages (must come before dynamic route)
router.get('/search/automotive', getAutomotiveSearchPage);
router.get('/search/aviation', getAviationSearchPage);
router.get('/search/heavy-machinery', getHeavyMachinerySearchPage);

// Other search routes
router.get('/search/:industry', getSearchPage);
router.get('/search2', getSearch2Page);

// API routes
router.post('/api/search', searchParts);
router.get('/api/sectors', getSectors);
router.get('/api/download-sample-excel', downloadSampleExcel);

module.exports = router;

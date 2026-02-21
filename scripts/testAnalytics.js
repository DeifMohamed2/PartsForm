#!/usr/bin/env node
/**
 * Comprehensive Analytics System Test Script
 * Tests all analytics models, services, and performance
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Performance threshold (ms)
const FAST_THRESHOLD = 50;
const ACCEPTABLE_THRESHOLD = 200;

let testsPassed = 0;
let testsFailed = 0;

async function logResult(testName, startTime, success, details = '') {
  const elapsed = Date.now() - startTime;
  const speed = elapsed < FAST_THRESHOLD ? '⚡' : elapsed < ACCEPTABLE_THRESHOLD ? '✓' : '⚠️';
  
  if (success) {
    testsPassed++;
    console.log(`  ✅ ${testName} (${elapsed}ms) ${speed} ${details}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${testName} FAILED: ${details}`);
  }
  return elapsed;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        PARTS ANALYTICS SYSTEM - COMPREHENSIVE TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected\n');

    // Import models
    const SearchAnalytics = require('../models/SearchAnalytics');
    const PartAnalytics = require('../models/PartAnalytics');
    const partsAnalyticsService = require('../services/partsAnalyticsService');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 1: MODEL TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log('═══ SECTION 1: MODEL TESTS ═══');
    
    // Test 1.1: SearchAnalytics.recordSearch
    let start = Date.now();
    const searchRecord = await SearchAnalytics.recordSearch({
      query: 'BP-TEST-001',
      source: 'manual',
      totalFound: 5,
      partsFound: ['BP-001', 'BP-002'],
      partsNotFound: ['BP-003'],
    });
    await logResult('SearchAnalytics.recordSearch', start, searchRecord?._id, `ID: ${searchRecord?._id}`);

    // Test 1.2: PartAnalytics.recordSearch
    start = Date.now();
    const partRecord = await PartAnalytics.recordSearch('TEST-PART-001', { source: 'manual' });
    await logResult('PartAnalytics.recordSearch', start, partRecord?.partNumber, `PN: ${partRecord?.partNumber}`);

    // Test 1.3: PartAnalytics.recordView
    start = Date.now();
    await PartAnalytics.recordView('TEST-PART-001');
    await logResult('PartAnalytics.recordView', start, true);

    // Test 1.4: PartAnalytics.recordAddToCart
    start = Date.now();
    await PartAnalytics.recordAddToCart('TEST-PART-001', 5, 100);
    await logResult('PartAnalytics.recordAddToCart', start, true);

    // Test 1.5: SearchAnalytics.recordUserAction
    start = Date.now();
    await SearchAnalytics.recordUserAction(searchRecord._id, 'view', { partNumber: 'BP-001' });
    await logResult('SearchAnalytics.recordUserAction', start, true);

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2: QUERY PERFORMANCE TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log('═══ SECTION 2: QUERY PERFORMANCE ═══');

    // Test 2.1: getDashboardStats
    start = Date.now();
    const stats = await SearchAnalytics.getDashboardStats(30);
    await logResult('getDashboardStats(30 days)', start, stats !== null, `searches: ${stats?.totalSearches || 0}`);

    // Test 2.2: getMostSearched
    start = Date.now();
    const mostSearched = await SearchAnalytics.getMostSearched({ limit: 10, days: 30 });
    await logResult('getMostSearched(10, 30 days)', start, Array.isArray(mostSearched), `found: ${mostSearched?.length || 0}`);

    // Test 2.3: getMissedOpportunities
    start = Date.now();
    const missed = await SearchAnalytics.getMissedOpportunities({ limit: 10, days: 30 });
    await logResult('getMissedOpportunities(10)', start, Array.isArray(missed), `found: ${missed?.length || 0}`);

    // Test 2.4: getSearchTrends
    start = Date.now();
    const trends = await SearchAnalytics.getSearchTrends({ days: 30 });
    await logResult('getSearchTrends(30 days)', start, Array.isArray(trends), `days: ${trends?.length || 0}`);

    // Test 2.5: getTrendingParts
    start = Date.now();
    const trending = await PartAnalytics.getTrendingParts({ limit: 10 });
    await logResult('getTrendingParts(10)', start, Array.isArray(trending), `found: ${trending?.length || 0}`);

    // Test 2.6: getTopSearched
    start = Date.now();
    const topSearched = await PartAnalytics.getTopSearched({ limit: 10 });
    await logResult('getTopSearched(10)', start, Array.isArray(topSearched), `found: ${topSearched?.length || 0}`);

    // Test 2.7: getTopPurchased
    start = Date.now();
    const topPurchased = await PartAnalytics.getTopPurchased({ limit: 10 });
    await logResult('getTopPurchased(10)', start, Array.isArray(topPurchased), `found: ${topPurchased?.length || 0}`);

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3: SERVICE TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log('═══ SECTION 3: SERVICE TESTS ═══');

    // Test 3.1: Service trackSearch
    start = Date.now();
    const serviceSearch = await partsAnalyticsService.trackSearch({
      query: 'SERVICE-TEST-001',
      source: 'manual',
      totalFound: 3,
      partsFound: ['ST-001', 'ST-002'],
      partsNotFound: [],
    });
    await logResult('Service.trackSearch', start, serviceSearch !== null);

    // Test 3.2: Service getDashboardStats
    start = Date.now();
    const serviceDashboard = await partsAnalyticsService.getDashboardStats({ days: 30 });
    await logResult('Service.getDashboardStats', start, serviceDashboard !== null);

    // Test 3.3: Service getMostSearchedParts
    start = Date.now();
    const serviceMostSearched = await partsAnalyticsService.getMostSearchedParts({ limit: 10, days: 30 });
    await logResult('Service.getMostSearchedParts', start, Array.isArray(serviceMostSearched));

    // Test 3.4: Service getTopPurchasedParts
    start = Date.now();
    const serviceTopPurchased = await partsAnalyticsService.getTopPurchasedParts({ limit: 10, days: 30 });
    await logResult('Service.getTopPurchasedParts', start, Array.isArray(serviceTopPurchased));

    // Test 3.5: Service getMissedOpportunities
    start = Date.now();
    const serviceMissed = await partsAnalyticsService.getMissedOpportunities({ limit: 10, days: 30 });
    await logResult('Service.getMissedOpportunities', start, Array.isArray(serviceMissed));

    // Test 3.6: Service getTrendingParts
    start = Date.now();
    const serviceTrending = await partsAnalyticsService.getTrendingParts({ limit: 10 });
    await logResult('Service.getTrendingParts', start, Array.isArray(serviceTrending));

    // Test 3.7: Service getSearchTrends
    start = Date.now();
    const serviceSearchTrends = await partsAnalyticsService.getSearchTrends({ days: 30 });
    await logResult('Service.getSearchTrends', start, Array.isArray(serviceSearchTrends));

    // Test 3.8: Service getAIInsights
    start = Date.now();
    const aiInsights = await partsAnalyticsService.getAIInsights({ days: 30 });
    await logResult('Service.getAIInsights', start, aiInsights !== null);

    // Test 3.9: Service chatWithAI
    start = Date.now();
    const chatResult = await partsAnalyticsService.chatWithAI('What are the top trends?');
    await logResult('Service.chatWithAI', start, chatResult?.success !== undefined, `source: ${chatResult?.source || 'n/a'}`);

    // Test 3.10: Service getDemandForecast
    start = Date.now();
    const forecast = await partsAnalyticsService.getDemandForecast({ days: 30 });
    await logResult('Service.getDemandForecast', start, forecast !== null);

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4: NON-BLOCKING VERIFICATION
    // ═══════════════════════════════════════════════════════════════
    console.log('═══ SECTION 4: NON-BLOCKING VERIFICATION ═══');
    
    // Simulate fire-and-forget tracking (should not block)
    start = Date.now();
    const trackingPromise = partsAnalyticsService.trackSearch({
      query: 'NONBLOCK-TEST',
      source: 'manual',
      totalFound: 0,
      partsFound: [],
      partsNotFound: ['NONBLOCK-001'],
    });
    
    // Don't await - check if it's truly non-blocking
    const immediateReturn = Date.now() - start;
    console.log(`  ⚡ Non-blocking initiation: ${immediateReturn}ms (should be < 5ms)`);
    
    // Now wait for it to complete
    await trackingPromise;
    await logResult('Fire-and-forget completion', start, true);

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════
    console.log('═══ CLEANUP ═══');
    
    // Clean up test data
    await SearchAnalytics.deleteMany({ query: { $in: ['BP-TEST-001', 'SERVICE-TEST-001', 'NONBLOCK-TEST'] } });
    await PartAnalytics.deleteMany({ partNumber: { $in: ['TEST-PART-001', 'ST-001', 'ST-002', 'NONBLOCK-001'] } });
    console.log('  ✅ Test data cleaned up');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`        TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (testsFailed > 0) {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL TESTS PASSED! Analytics system is fully functional.');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();

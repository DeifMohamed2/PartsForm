/**
 * Parts Analytics Controller
 * API endpoints for parts analytics dashboard
 */

const partsAnalyticsService = require('../services/partsAnalyticsService');

/**
 * Get dashboard statistics
 * GET /admin/api/analytics/dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await partsAnalyticsService.getDashboardStats({ days: parseInt(days) });
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message,
    });
  }
};

/**
 * Get most searched parts
 * GET /admin/api/analytics/most-searched
 */
const getMostSearched = async (req, res) => {
  try {
    const { limit = 20, days = 30 } = req.query;
    const parts = await partsAnalyticsService.getMostSearchedParts({
      limit: parseInt(limit),
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: parts,
    });
  } catch (error) {
    console.error('Error fetching most searched parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch most searched parts',
      message: error.message,
    });
  }
};

/**
 * Get top purchased parts
 * GET /admin/api/analytics/top-purchased
 */
const getTopPurchased = async (req, res) => {
  try {
    const { limit = 20, days = 30 } = req.query;
    const parts = await partsAnalyticsService.getTopPurchasedParts({
      limit: parseInt(limit),
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: parts,
    });
  } catch (error) {
    console.error('Error fetching top purchased parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top purchased parts',
      message: error.message,
    });
  }
};

/**
 * Get missed opportunities
 * GET /admin/api/analytics/missed-opportunities
 */
const getMissedOpportunities = async (req, res) => {
  try {
    const { limit = 20, days = 30 } = req.query;
    const opportunities = await partsAnalyticsService.getMissedOpportunities({
      limit: parseInt(limit),
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    console.error('Error fetching missed opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch missed opportunities',
      message: error.message,
    });
  }
};

/**
 * Get trending parts
 * GET /admin/api/analytics/trending
 */
const getTrending = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const trending = await partsAnalyticsService.getTrendingParts({
      limit: parseInt(limit),
    });
    
    res.json({
      success: true,
      data: trending,
    });
  } catch (error) {
    console.error('Error fetching trending parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending parts',
      message: error.message,
    });
  }
};

/**
 * Get search trends over time
 * GET /admin/api/analytics/search-trends
 */
const getSearchTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await partsAnalyticsService.getSearchTrends({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error fetching search trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch search trends',
      message: error.message,
    });
  }
};

/**
 * Get Excel analytics
 * GET /admin/api/analytics/excel
 */
const getExcelAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await partsAnalyticsService.getExcelAnalytics({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching excel analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch excel analytics',
      message: error.message,
    });
  }
};

/**
 * Get category analytics
 * GET /admin/api/analytics/categories
 */
const getCategoryAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const categories = await partsAnalyticsService.getCategoryAnalytics({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category analytics',
      message: error.message,
    });
  }
};

/**
 * Get purchase frequency data
 * GET /admin/api/analytics/purchase-frequency
 */
const getPurchaseFrequency = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const frequency = await partsAnalyticsService.getPurchaseFrequency({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: frequency,
    });
  } catch (error) {
    console.error('Error fetching purchase frequency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase frequency',
      message: error.message,
    });
  }
};

/**
 * Get AI insights
 * GET /admin/api/analytics/ai-insights
 */
const getAIInsights = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const insights = await partsAnalyticsService.getAIInsights({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights',
      message: error.message,
    });
  }
};

/**
 * AI Chat endpoint
 * POST /admin/api/analytics/ai-chat
 */
const aiChat = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }
    
    const response = await partsAnalyticsService.chatWithAI(message);
    
    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({
      success: false,
      error: 'AI chat failed',
      message: error.message,
    });
  }
};

/**
 * Get demand forecast
 * GET /admin/api/analytics/demand-forecast
 */
const getDemandForecast = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const forecast = await partsAnalyticsService.getDemandForecast({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Error fetching demand forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate demand forecast',
      message: error.message,
    });
  }
};

/**
 * Sync analytics with historical orders
 * POST /admin/api/analytics/sync-historical
 */
const syncHistorical = async (req, res) => {
  try {
    const { days = 365 } = req.body;
    const result = await partsAnalyticsService.syncWithHistoricalOrders({
      days: parseInt(days),
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error syncing historical data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync historical data',
      message: error.message,
    });
  }
};

/**
 * Run maintenance tasks
 * POST /admin/api/analytics/run-maintenance
 */
const runMaintenance = async (req, res) => {
  try {
    const { type = 'daily' } = req.body;
    
    let result;
    if (type === 'weekly') {
      result = await partsAnalyticsService.runWeeklyCleanup();
    } else {
      result = await partsAnalyticsService.runDailyMaintenance();
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error running maintenance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run maintenance',
      message: error.message,
    });
  }
};

/**
 * Track search from API
 * POST /admin/api/analytics/track-search
 */
const trackSearch = async (req, res) => {
  try {
    const {
      query,
      source,
      totalFound,
      partsFound,
      partsNotFound,
      searchTime,
      sessionId,
      buyerId,
    } = req.body;
    
    const result = await partsAnalyticsService.trackSearch({
      query,
      source,
      totalFound,
      partsFound,
      partsNotFound,
      searchTime,
      sessionId,
      buyerId,
    });
    
    res.json({
      success: true,
      data: { searchId: result?._id },
    });
  } catch (error) {
    console.error('Error tracking search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track search',
      message: error.message,
    });
  }
};

/**
 * Get comprehensive analytics data for the page
 * GET /admin/api/analytics/comprehensive
 */
const getComprehensiveAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysInt = parseInt(days);
    
    // Fetch all data in parallel
    const [
      dashboardStats,
      mostSearched,
      topPurchased,
      missedOpportunities,
      trending,
      searchTrends,
      categoryAnalytics,
      purchaseFrequency,
      excelAnalytics,
    ] = await Promise.all([
      partsAnalyticsService.getDashboardStats({ days: daysInt }),
      partsAnalyticsService.getMostSearchedParts({ limit: 10, days: daysInt }),
      partsAnalyticsService.getTopPurchasedParts({ limit: 10, days: daysInt }),
      partsAnalyticsService.getMissedOpportunities({ limit: 10, days: daysInt }),
      partsAnalyticsService.getTrendingParts({ limit: 10 }),
      partsAnalyticsService.getSearchTrends({ days: daysInt }),
      partsAnalyticsService.getCategoryAnalytics({ days: daysInt }),
      partsAnalyticsService.getPurchaseFrequency({ days: 90 }),
      partsAnalyticsService.getExcelAnalytics({ days: daysInt }),
    ]);
    
    res.json({
      success: true,
      data: {
        dashboard: dashboardStats,
        mostSearched,
        topPurchased,
        missedOpportunities,
        trending,
        searchTrends,
        categories: categoryAnalytics,
        purchaseFrequency,
        excelAnalytics,
      },
    });
  } catch (error) {
    console.error('Error fetching comprehensive analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comprehensive analytics',
      message: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getMostSearched,
  getTopPurchased,
  getMissedOpportunities,
  getTrending,
  getSearchTrends,
  getExcelAnalytics,
  getCategoryAnalytics,
  getPurchaseFrequency,
  getAIInsights,
  aiChat,
  getDemandForecast,
  syncHistorical,
  runMaintenance,
  trackSearch,
  getComprehensiveAnalytics,
};

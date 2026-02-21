/**
 * Parts Analytics Service
 * Comprehensive analytics tracking and AI-powered insights for parts
 */

const SearchAnalytics = require('../models/SearchAnalytics');
const PartAnalytics = require('../models/PartAnalytics');
const Order = require('../models/Order');
const Part = require('../models/Part');

// Try to import Gemini service for AI features
let geminiService = null;
try {
  geminiService = require('./geminiService');
} catch (err) {
  console.warn('⚠️ Gemini service not available for analytics AI features');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEARCH TRACKING
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Track a search event
 */
async function trackSearch(data) {
  try {
    const {
      query,
      source = 'manual',
      totalFound = 0,
      partsFound = [],
      partsNotFound = [],
      searchTime,
      dataSource = 'mongodb',
      sessionId,
      buyerId,
      metadata = {},
      excelImport,
    } = data;

    // Record in SearchAnalytics
    const searchRecord = await SearchAnalytics.recordSearch({
      query,
      source,
      totalFound,
      partsFound,
      partsNotFound,
      searchTime,
      dataSource,
      sessionId,
      buyerId,
      metadata,
      excelImport,
    });

    // Update PartAnalytics for found parts
    const partUpdatePromises = partsFound.map(partNumber =>
      PartAnalytics.recordSearch(partNumber, { source })
    );

    // Also track not-found parts (for demand analysis)
    const notFoundPromises = partsNotFound.map(partNumber =>
      PartAnalytics.recordSearch(partNumber, { 
        source, 
        category: 'not_in_inventory' 
      })
    );

    await Promise.all([...partUpdatePromises, ...notFoundPromises]);

    return searchRecord;
  } catch (error) {
    console.error('Error tracking search:', error);
    return null;
  }
}

/**
 * Track Excel import search
 */
async function trackExcelSearch(data) {
  const {
    filename,
    sheetName,
    partsFound = [],
    partsNotFound = [],
    searchTime,
    sessionId,
    buyerId,
  } = data;

  return trackSearch({
    query: `Excel: ${filename}`,
    source: 'excel',
    totalFound: partsFound.length,
    partsFound,
    partsNotFound,
    searchTime,
    sessionId,
    buyerId,
    excelImport: {
      filename,
      sheetName,
      totalParts: partsFound.length + partsNotFound.length,
      importedAt: new Date(),
    },
  });
}

/**
 * Track part view (when user clicks on a part)
 */
async function trackPartView(partNumber, searchId = null) {
  try {
    await PartAnalytics.recordView(partNumber);
    
    if (searchId) {
      await SearchAnalytics.recordUserAction(searchId, 'click', { partNumber });
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking part view:', error);
    return false;
  }
}

/**
 * Track add to cart
 */
async function trackAddToCart(partNumber, searchId = null, sessionId = null) {
  try {
    await PartAnalytics.recordAddToCart(partNumber);
    
    if (searchId) {
      await SearchAnalytics.recordUserAction(searchId, 'cart', { partNumber });
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking add to cart:', error);
    return false;
  }
}

/**
 * Track purchase from order
 */
async function trackPurchase(order) {
  try {
    if (!order || !order.items) return false;

    const promises = order.items.map(item => {
      const revenue = (item.price || 0);
      return PartAnalytics.recordPurchase(
        item.partNumber,
        1, // Each item is individual in this system
        revenue,
        {
          description: item.description,
          brand: item.brand,
          category: item.category,
          supplier: item.supplier,
        }
      );
    });

    await Promise.all(promises);
    
    return true;
  } catch (error) {
    console.error('Error tracking purchase:', error);
    return false;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ANALYTICS DATA RETRIEVAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Get comprehensive dashboard stats
 */
async function getDashboardStats(options = {}) {
  try {
    const { days = 30 } = options;
    
    const [searchStats, partStats, orderStats] = await Promise.all([
      SearchAnalytics.getDashboardStats({ days }),
      PartAnalytics.getDashboardSummary({ days }),
      getOrderStats(days),
    ]);

    return {
      totalSearches: searchStats.totalSearches,
      searchesChange: searchStats.searchesChange,
      partsViewed: searchStats.partsViewed,
      purchases: orderStats.totalOrders,
      purchasesChange: orderStats.ordersChange,
      searchedNotBought: partStats.searches?.searchedNotBought || 0,
      missedOpportunities: searchStats.missedOpportunities,
      missedChange: searchStats.missedChange,
      trendingParts: partStats.trendingCount,
      conversionRate: searchStats.conversionRate,
      excelSearches: searchStats.excelSearches,
      revenue: orderStats.totalRevenue,
      revenueChange: orderStats.revenueChange,
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return getDefaultDashboardStats();
  }
}

/**
 * Get order statistics
 */
async function getOrderStats(days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - days);

    const [current, previous] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.total' },
            totalItems: { $sum: '$totalItems' },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: previousStart, $lt: startDate }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.total' },
          },
        },
      ]),
    ]);

    const curr = current[0] || { totalOrders: 0, totalRevenue: 0, totalItems: 0 };
    const prev = previous[0] || { totalOrders: 1, totalRevenue: 0 };

    const calcChange = (c, p) => {
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100 * 10) / 10;
    };

    return {
      totalOrders: curr.totalOrders,
      ordersChange: calcChange(curr.totalOrders, prev.totalOrders),
      totalRevenue: curr.totalRevenue,
      revenueChange: calcChange(curr.totalRevenue, prev.totalRevenue),
      totalItems: curr.totalItems,
    };
  } catch (error) {
    console.error('Error getting order stats:', error);
    return { totalOrders: 0, ordersChange: 0, totalRevenue: 0, revenueChange: 0, totalItems: 0 };
  }
}

/**
 * Get most searched parts with conversion data
 */
async function getMostSearchedParts(options = {}) {
  try {
    const { limit = 20, days = 30 } = options;
    
    // Get from PartAnalytics
    const parts = await PartAnalytics.getTopSearched({ limit, days });
    
    if (parts.length === 0) return [];
    
    // Enrich with inventory data - use simple case-insensitive match
    const partNumbers = parts.map(p => p.partNumber.toUpperCase());
    
    // Use $in with uppercase for faster lookup (indexed)
    const inventoryData = await Part.find({ 
      partNumber: { $in: partNumbers } 
    }).select('partNumber description brand category quantity price').lean();
    
    const inventoryMap = {};
    inventoryData.forEach(p => {
      inventoryMap[p.partNumber.toUpperCase()] = p;
    });
    
    return parts.map(p => {
      const inv = inventoryMap[p.partNumber] || {};
      const searches = days <= 7 ? p.searchMetrics.last7DaysSearches : p.searchMetrics.last30DaysSearches;
      const purchases = days <= 7 ? p.purchaseMetrics.last7DaysPurchases : p.purchaseMetrics.last30DaysPurchases;
      const conversion = searches > 0 ? Math.round((purchases / searches) * 100) : 0;
      
      return {
        partNumber: p.partNumber,
        description: p.description || inv.description || 'Unknown Part',
        brand: p.brand || inv.brand || '',
        category: p.category || inv.category || 'general',
        searches,
        conversion,
        status: inv.quantity > 10 ? 'available' : 
                inv.quantity > 0 ? 'limited' : 'out-of-stock',
        inStock: (inv.quantity || 0) > 0,
        quantity: inv.quantity || 0,
        price: inv.price || 0,
        trend: p.searchMetrics.searchTrend || 'stable',
        trendPercentage: p.searchMetrics.trendPercentage || 0,
      };
    });
  } catch (error) {
    console.error('Error getting most searched parts:', error);
    return [];
  }
}

/**
 * Get top purchased parts
 */
async function getTopPurchasedParts(options = {}) {
  try {
    const { limit = 20, days = 30 } = options;
    
    // Get from actual orders
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const purchaseData = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      // Filter out items with no part number
      { $match: { 
        'items.partNumber': { $exists: true, $ne: null, $ne: '' }
      }},
      {
        $group: {
          _id: { $toUpper: { $trim: { input: '$items.partNumber' } } },
          description: { $first: '$items.description' },
          brand: { $first: '$items.brand' },
          category: { $first: '$items.category' },
          orders: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$items.price', 0] } },
          suppliers: { $addToSet: '$items.supplier' },
        },
      },
      // Filter out empty grouped IDs
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { orders: -1, revenue: -1 } },
      { $limit: limit },
    ]);
    
    // Get part numbers to look up actual Part details
    const partNumbers = purchaseData.map(p => p._id).filter(Boolean);
    
    // Look up real part details for better descriptions
    let partsLookup = {};
    if (partNumbers.length > 0) {
      const parts = await Part.find({ 
        partNumber: { $in: partNumbers } 
      }).select('partNumber description brand category').lean();
      
      parts.forEach(p => {
        if (p.partNumber) {
          partsLookup[p.partNumber.toUpperCase()] = p;
        }
      });
    }
    
    return purchaseData.map(p => {
      const partInfo = partsLookup[p._id] || {};
      return {
        partNumber: p._id,
        description: partInfo.description || p.description || p._id,
        brand: partInfo.brand || p.brand || 'N/A',
        category: partInfo.category || p.category || 'general',
        orders: p.orders,
        revenue: Math.round((p.revenue || 0) * 100) / 100,
        suppliers: (p.suppliers || []).filter(Boolean).slice(0, 3),
      };
    });
  } catch (error) {
    console.error('Error getting top purchased parts:', error);
    return [];
  }
}

/**
 * Get missed opportunities (searched but not available/bought)
 */
async function getMissedOpportunities(options = {}) {
  try {
    const { limit = 20, days = 30 } = options;
    
    const [searchMissed, partMissed] = await Promise.all([
      SearchAnalytics.getMissedOpportunities({ days, limit }),
      PartAnalytics.getSearchedNotPurchased({ limit, minSearches: 3 }),
    ]);
    
    // Combine and deduplicate
    const combined = new Map();
    
    searchMissed.forEach(item => {
      combined.set(item.partNumber, {
        partNumber: item.partNumber,
        searches: item.searchCount,
        reason: mapMissedReason(item.dominantReason),
        lastSearched: item.lastSearched,
        isExcelSearch: item.isExcelSearch,
        type: 'not_found',
      });
    });
    
    partMissed.forEach(item => {
      if (!combined.has(item.partNumber)) {
        combined.set(item.partNumber, {
          partNumber: item.partNumber,
          searches: item.searchMetrics.last30DaysSearches,
          reason: 'Searched but not purchased',
          lastSearched: item.searchMetrics.lastSearchDate,
          isExcelSearch: item.excelMetrics?.last30DaysExcelImports > 0,
          type: 'not_purchased',
        });
      }
    });
    
    return Array.from(combined.values())
      .sort((a, b) => b.searches - a.searches)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting missed opportunities:', error);
    return [];
  }
}

/**
 * Get trending parts
 */
async function getTrendingParts(options = {}) {
  try {
    const { limit = 20 } = options;
    
    // First update trending scores
    await PartAnalytics.updateTrendingScores();
    
    // Get trending parts
    const trending = await PartAnalytics.getTrendingParts({ limit });
    
    return trending.map(p => ({
      partNumber: p.partNumber,
      description: p.description || 'Unknown Part',
      brand: p.brand || '',
      category: p.category || 'general',
      trendScore: p.trending.trendScore,
      rank: p.trending.rank,
      searches: p.searchMetrics.last7DaysSearches,
      trend: p.searchMetrics.searchTrend,
      trendPercentage: p.searchMetrics.trendPercentage,
    }));
  } catch (error) {
    console.error('Error getting trending parts:', error);
    return [];
  }
}

/**
 * Get search trends over time
 */
async function getSearchTrends(options = {}) {
  try {
    const { days = 30 } = options;
    return SearchAnalytics.getSearchTrends({ days });
  } catch (error) {
    console.error('Error getting search trends:', error);
    return [];
  }
}

/**
 * Get Excel analytics
 */
async function getExcelAnalytics(options = {}) {
  try {
    const { days = 30 } = options;
    
    const [searchExcel, partExcel] = await Promise.all([
      SearchAnalytics.getExcelAnalytics({ days }),
      PartAnalytics.find({
        'excelMetrics.last30DaysExcelImports': { $gt: 0 }
      })
        .sort({ 'excelMetrics.last30DaysExcelImports': -1 })
        .limit(20)
        .lean(),
    ]);
    
    const summary = searchExcel[0] || {
      totalImports: 0,
      totalPartsSearched: 0,
      totalPartsNotFound: 0,
      conversions: 0,
      conversionRate: 0,
      findRate: 0,
    };
    
    return {
      summary,
      topParts: partExcel.map(p => ({
        partNumber: p.partNumber,
        imports: p.excelMetrics.last30DaysExcelImports,
        purchased: p.excelMetrics.purchasedFromExcel,
        notPurchased: p.excelMetrics.notPurchasedFromExcel,
        conversionRate: p.excelMetrics.excelConversionRate,
      })),
    };
  } catch (error) {
    console.error('Error getting excel analytics:', error);
    return { summary: {}, topParts: [] };
  }
}

/**
 * Get category breakdown
 */
async function getCategoryAnalytics(options = {}) {
  try {
    const { days = 30 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get from orders
    const categoryStats = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.category', 'general'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$items.price' },
          uniqueParts: { $addToSet: '$items.partNumber' },
        },
      },
      {
        $project: {
          category: '$_id',
          orders: 1,
          revenue: 1,
          uniqueParts: { $size: '$uniqueParts' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    
    return categoryStats;
  } catch (error) {
    console.error('Error getting category analytics:', error);
    return [];
  }
}

/**
 * Get purchase frequency analysis
 */
async function getPurchaseFrequency(options = {}) {
  try {
    const { days = 90 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Analyze repeat purchases by buyer
    const frequencyData = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $nin: ['cancelled'] } } },
      {
        $group: {
          _id: '$buyer',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' },
        },
      },
      {
        $bucket: {
          groupBy: '$orderCount',
          boundaries: [1, 2, 3, 5, 10, 20],
          default: '20+',
          output: {
            count: { $sum: 1 },
            avgSpent: { $avg: '$totalSpent' },
          },
        },
      },
    ]);
    
    // Map to readable labels
    const labels = {
      1: '1 order',
      2: '2 orders',
      3: '3-4 orders',
      5: '5-9 orders',
      10: '10-19 orders',
      '20+': '20+ orders',
    };
    
    return frequencyData.map(d => ({
      label: labels[d._id] || `${d._id} orders`,
      count: d.count,
      avgSpent: Math.round(d.avgSpent * 100) / 100,
    }));
  } catch (error) {
    console.error('Error getting purchase frequency:', error);
    return [];
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI FEATURES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Get AI-generated insights
 */
async function getAIInsights(options = {}) {
  try {
    const { days = 30 } = options;
    
    // Gather data for AI analysis
    const [
      dashboardStats,
      topSearched,
      missedOpportunities,
      trending,
      categoryData,
    ] = await Promise.all([
      getDashboardStats({ days }),
      getMostSearchedParts({ limit: 10, days }),
      getMissedOpportunities({ limit: 10, days }),
      getTrendingParts({ limit: 10 }),
      getCategoryAnalytics({ days }),
    ]);
    
    // Generate insights without AI if Gemini not available
    const insights = generateLocalInsights({
      dashboardStats,
      topSearched,
      missedOpportunities,
      trending,
      categoryData,
    });
    
    // Try to enhance with AI if available
    if (geminiService && geminiService.generateAnalyticsInsights) {
      try {
        const aiInsights = await geminiService.generateAnalyticsInsights({
          dashboardStats,
          topSearched,
          missedOpportunities,
          trending,
          categoryData,
        });
        return aiInsights;
      } catch (aiError) {
        console.warn('AI insights generation failed, using local insights:', aiError.message);
      }
    }
    
    return insights;
  } catch (error) {
    console.error('Error getting AI insights:', error);
    return getDefaultInsights();
  }
}

/**
 * AI Chat Assistant for Parts Analytics
 */
async function chatWithAI(message, context = {}) {
  try {
    // Gather relevant data for the AI
    const [
      dashboardStats,
      topSearched,
      topPurchased,
      missedOpportunities,
      trending,
      excelAnalytics,
    ] = await Promise.all([
      getDashboardStats({ days: 30 }),
      getMostSearchedParts({ limit: 10, days: 30 }),
      getTopPurchasedParts({ limit: 10, days: 30 }),
      getMissedOpportunities({ limit: 10, days: 30 }),
      getTrendingParts({ limit: 10 }),
      getExcelAnalytics({ days: 30 }),
    ]);

    const analyticsContext = {
      dashboardStats,
      topSearched,
      topPurchased,
      missedOpportunities,
      trending,
      excelAnalytics,
    };

    // Use Gemini if available
    if (geminiService && geminiService.analyticsChat) {
      try {
        const response = await geminiService.analyticsChat(message, analyticsContext);
        return {
          success: true,
          response,
          source: 'ai',
        };
      } catch (aiError) {
        console.warn('AI chat failed, using fallback:', aiError.message);
      }
    }

    // Fallback to rule-based responses
    const response = generateChatResponse(message, analyticsContext);
    return {
      success: true,
      response,
      source: 'local',
    };
  } catch (error) {
    console.error('Error in AI chat:', error);
    return {
      success: false,
      response: 'I apologize, but I encountered an error processing your request. Please try again.',
      error: error.message,
    };
  }
}

/**
 * Generate demand forecast for parts based on REAL order data
 */
async function getDemandForecast(options = {}) {
  try {
    const { days = 30 } = options;
    
    // Get purchase trends over multiple periods for comparison
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    
    const thisMonthStart = new Date(now);
    thisMonthStart.setDate(thisMonthStart.getDate() - 30);
    
    const lastMonthStart = new Date(now);
    lastMonthStart.setDate(lastMonthStart.getDate() - 60);
    
    // Get order trends for multiple periods
    const purchaseTrends = await Order.aggregate([
      { $match: { createdAt: { $gte: lastMonthStart }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $match: { 'items.partNumber': { $exists: true, $ne: null, $ne: '' } } },
      {
        $facet: {
          thisWeek: [
            { $match: { createdAt: { $gte: thisWeekStart } } },
            {
              $group: {
                _id: { $toUpper: { $trim: { input: '$items.partNumber' } } },
                orders: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$items.price', 0] } },
                description: { $first: '$items.description' },
                brand: { $first: '$items.brand' },
                category: { $first: '$items.category' },
              }
            }
          ],
          lastWeek: [
            { $match: { createdAt: { $gte: lastWeekStart, $lt: thisWeekStart } } },
            {
              $group: {
                _id: { $toUpper: { $trim: { input: '$items.partNumber' } } },
                orders: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$items.price', 0] } },
              }
            }
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: { $toUpper: { $trim: { input: '$items.partNumber' } } },
                orders: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$items.price', 0] } },
              }
            }
          ],
          lastMonth: [
            { $match: { createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } } },
            {
              $group: {
                _id: { $toUpper: { $trim: { input: '$items.partNumber' } } },
                orders: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$items.price', 0] } },
              }
            }
          ],
          dailyTrend: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                },
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: { $ifNull: ['$items.price', 0] } },
              }
            },
            { $sort: { '_id.date': 1 } }
          ],
        }
      }
    ]);
    
    const data = purchaseTrends[0] || {};
    const thisWeekData = data.thisWeek || [];
    const lastWeekData = data.lastWeek || [];
    const thisMonthData = data.thisMonth || [];
    const lastMonthData = data.lastMonth || [];
    const dailyTrend = data.dailyTrend || [];
    
    // Create lookup maps
    const lastWeekMap = new Map(lastWeekData.map(p => [p._id, p]));
    const lastMonthMap = new Map(lastMonthData.map(p => [p._id, p]));
    
    // Get all unique part numbers for Part lookup
    const allPartNumbers = [...new Set([
      ...thisWeekData.map(p => p._id),
      ...thisMonthData.map(p => p._id)
    ])].filter(Boolean);
    
    // Look up Part details
    let partsLookup = {};
    if (allPartNumbers.length > 0) {
      const parts = await Part.find({ 
        partNumber: { $in: allPartNumbers } 
      }).select('partNumber description brand category').lean();
      
      parts.forEach(p => {
        if (p.partNumber) {
          partsLookup[p.partNumber.toUpperCase()] = p;
        }
      });
    }
    
    // Generate forecasts based on real purchase data
    const forecasts = thisMonthData
      .filter(p => p._id)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 20)
      .map(part => {
        const partNumber = part._id;
        const partInfo = partsLookup[partNumber] || {};
        const lastWeekPart = lastWeekMap.get(partNumber);
        const lastMonthPart = lastMonthMap.get(partNumber);
        
        // Calculate week-over-week change
        const thisWeekOrders = thisWeekData.find(p => p._id === partNumber)?.orders || 0;
        const lastWeekOrders = lastWeekPart?.orders || 0;
        const weeklyChange = lastWeekOrders > 0 
          ? Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100)
          : (thisWeekOrders > 0 ? 100 : 0);
        
        // Calculate month-over-month change
        const thisMonthOrders = part.orders || 0;
        const lastMonthOrders = lastMonthPart?.orders || 0;
        const monthlyChange = lastMonthOrders > 0 
          ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100)
          : (thisMonthOrders > 0 ? 100 : 0);
        
        // Calculate trend direction
        const trend = weeklyChange > 10 ? 'rising' : weeklyChange < -10 ? 'falling' : 'stable';
        
        // Forecast based on current trajectory
        const avgDailyOrders = thisMonthOrders / 30;
        const growthMultiplier = 1 + (weeklyChange / 100);
        const forecast7Days = Math.round(avgDailyOrders * 7 * Math.max(0.5, Math.min(2, growthMultiplier)));
        const forecast30Days = Math.round(thisMonthOrders * Math.max(0.5, Math.min(2, growthMultiplier)));
        
        // Confidence based on data consistency
        const dataPoints = (thisWeekOrders > 0 ? 1 : 0) + (lastWeekOrders > 0 ? 1 : 0) + 
                          (thisMonthOrders > 0 ? 1 : 0) + (lastMonthOrders > 0 ? 1 : 0);
        const confidence = Math.min(95, 40 + (dataPoints * 15));
        
        // Generate recommendation
        let recommendation = 'Maintain current levels';
        if (trend === 'rising' && thisMonthOrders > 3) {
          recommendation = 'Consider increasing stock';
        } else if (trend === 'falling') {
          recommendation = 'Monitor closely';
        } else if (thisMonthOrders > 5) {
          recommendation = 'High demand - ensure stock';
        }
        
        return {
          partNumber,
          description: partInfo.description || part.description || partNumber,
          brand: partInfo.brand || part.brand || 'N/A',
          category: partInfo.category || part.category || 'General',
          currentDemand: thisMonthOrders,
          thisWeekOrders,
          lastWeekOrders,
          weeklyChange,
          monthlyChange,
          forecast7Days,
          forecast30Days,
          trend,
          trendPercentage: weeklyChange,
          confidence,
          recommendation,
          revenue: Math.round((part.revenue || 0) * 100) / 100,
        };
      });
    
    // Format daily trend data for charts
    const trendData = dailyTrend.map(d => ({
      date: d._id.date,
      orders: d.totalOrders,
      revenue: Math.round((d.totalRevenue || 0) * 100) / 100,
    }));
    
    return {
      forecasts,
      trendData,
      summary: {
        totalThisWeek: thisWeekData.reduce((sum, p) => sum + (p.orders || 0), 0),
        totalLastWeek: lastWeekData.reduce((sum, p) => sum + (p.orders || 0), 0),
        totalThisMonth: thisMonthData.reduce((sum, p) => sum + (p.orders || 0), 0),
        totalLastMonth: lastMonthData.reduce((sum, p) => sum + (p.orders || 0), 0),
        uniquePartsOrdered: allPartNumbers.length,
      },
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error generating demand forecast:', error);
    return { 
      forecasts: [], 
      trendData: [], 
      summary: { totalThisWeek: 0, totalLastWeek: 0, totalThisMonth: 0, totalLastMonth: 0, uniquePartsOrdered: 0 },
      generatedAt: new Date() 
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HELPER FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

function mapMissedReason(reason) {
  const reasonMap = {
    not_in_inventory: 'Not in inventory',
    price_too_high: 'Price too high',
    out_of_stock: 'Out of stock',
    no_match: 'No matching parts',
    abandoned: 'Search abandoned',
  };
  return reasonMap[reason] || 'Unknown reason';
}

function getDefaultDashboardStats() {
  return {
    totalSearches: 0,
    searchesChange: 0,
    partsViewed: 0,
    purchases: 0,
    purchasesChange: 0,
    searchedNotBought: 0,
    missedOpportunities: 0,
    missedChange: 0,
    trendingParts: 0,
    conversionRate: 0,
    excelSearches: 0,
    revenue: 0,
    revenueChange: 0,
  };
}

function getDefaultInsights() {
  return {
    summary: 'Analytics data is being collected. Check back later for insights.',
    keyInsights: [
      {
        type: 'info',
        title: 'Data Collection Active',
        description: 'The analytics system is now tracking searches and purchases.',
        icon: 'activity',
      },
    ],
    recommendations: [
      {
        priority: 'medium',
        action: 'Monitor Search Patterns',
        description: 'Review search data as it accumulates to identify trends.',
        impact: 'Better inventory planning',
      },
    ],
  };
}

function generateLocalInsights(data) {
  const insights = {
    summary: '',
    keyInsights: [],
    recommendations: [],
  };
  
  const { dashboardStats, topSearched, missedOpportunities, trending, categoryData } = data;
  
  // Generate summary
  insights.summary = `Over the past 30 days: ${dashboardStats.totalSearches} searches, ` +
    `${dashboardStats.purchases} purchases (${dashboardStats.conversionRate}% conversion rate). ` +
    `${dashboardStats.missedOpportunities} missed opportunities identified.`;
  
  // Key insights based on data
  if (dashboardStats.searchesChange > 10) {
    insights.keyInsights.push({
      type: 'success',
      title: 'Search Volume Growing',
      description: `Search volume increased by ${dashboardStats.searchesChange}% compared to previous period.`,
      icon: 'trending-up',
    });
  } else if (dashboardStats.searchesChange < -10) {
    insights.keyInsights.push({
      type: 'warning',
      title: 'Search Volume Declining',
      description: `Search volume decreased by ${Math.abs(dashboardStats.searchesChange)}%. Consider marketing activities.`,
      icon: 'trending-down',
    });
  }
  
  if (dashboardStats.conversionRate < 20) {
    insights.keyInsights.push({
      type: 'warning',
      title: 'Low Conversion Rate',
      description: `Only ${dashboardStats.conversionRate}% of searches lead to purchases. Review pricing and availability.`,
      icon: 'alert-triangle',
    });
  }
  
  if (missedOpportunities.length > 0) {
    const topMissed = missedOpportunities[0];
    insights.keyInsights.push({
      type: 'alert',
      title: 'Top Missed Opportunity',
      description: `"${topMissed.partNumber}" was searched ${topMissed.searches} times but not purchased. Reason: ${topMissed.reason}.`,
      icon: 'x-circle',
    });
  }
  
  if (trending.length > 0) {
    const topTrending = trending[0];
    insights.keyInsights.push({
      type: 'success',
      title: 'Trending Part',
      description: `"${topTrending.partNumber}" is trending with ${topTrending.trendPercentage}% growth in searches.`,
      icon: 'flame',
    });
  }
  
  // Generate recommendations
  if (missedOpportunities.filter(m => m.type === 'not_found').length > 5) {
    insights.recommendations.push({
      priority: 'high',
      action: 'Expand Inventory',
      description: `${missedOpportunities.filter(m => m.type === 'not_found').length} parts searched are not in your inventory.`,
      impact: 'Potential revenue increase',
    });
  }
  
  if (dashboardStats.excelSearches > 10) {
    insights.recommendations.push({
      priority: 'medium',
      action: 'Optimize Excel Import',
      description: 'Many users are importing Excel files. Consider improving bulk search features.',
      impact: 'Better user experience',
    });
  }
  
  if (categoryData.length > 0) {
    const topCategory = categoryData[0];
    insights.recommendations.push({
      priority: 'medium',
      action: `Focus on ${topCategory.category}`,
      description: `${topCategory.category} generates the most revenue. Consider expanding this category.`,
      impact: 'Revenue growth',
    });
  }
  
  return insights;
}

function generateChatResponse(message, context) {
  const msg = message.toLowerCase();
  const { dashboardStats, topSearched, topPurchased, missedOpportunities, trending, excelAnalytics } = context;
  
  // Pattern matching for common questions
  if (msg.includes('trending') || msg.includes('top') && msg.includes('search')) {
    const parts = topSearched.slice(0, 5);
    let response = '<p><strong>📈 Top Searched Parts (Last 30 Days):</strong></p><ol style="margin: 0.75rem 0; padding-left: 1.25rem;">';
    parts.forEach(p => {
      response += `<li><strong>${p.partNumber}</strong> - ${p.searches} searches (${p.conversion}% conversion)</li>`;
    });
    response += '</ol>';
    return response;
  }
  
  if (msg.includes('missed') || msg.includes('opportunit')) {
    const missed = missedOpportunities.slice(0, 5);
    let response = '<p><strong>🚨 Top Missed Opportunities:</strong></p><ul style="margin: 0.75rem 0; padding-left: 1.25rem;">';
    missed.forEach(m => {
      response += `<li><strong>${m.partNumber}</strong> - ${m.searches} searches - ${m.reason}</li>`;
    });
    response += '</ul><p><strong>💡 Recommendation:</strong> Consider adding these parts to your inventory to capture this demand.</p>';
    return response;
  }
  
  if (msg.includes('restock') || msg.includes('stock') || msg.includes('inventory')) {
    const needsRestock = trending.filter(t => t.trendPercentage > 10).slice(0, 5);
    let response = '<p><strong>📦 Restock Recommendations:</strong></p>';
    if (needsRestock.length > 0) {
      response += '<table style="width: 100%; margin: 0.75rem 0; font-size: 0.85rem;">';
      response += '<tr><th>Part</th><th>Trend</th><th>Action</th></tr>';
      needsRestock.forEach(p => {
        response += `<tr><td>${p.partNumber}</td><td>↑ ${p.trendPercentage}%</td><td>Increase stock</td></tr>`;
      });
      response += '</table>';
    } else {
      response += '<p>No urgent restocking needs identified based on current trends.</p>';
    }
    return response;
  }
  
  if (msg.includes('excel') || msg.includes('import')) {
    const summary = excelAnalytics.summary;
    return `<p><strong>📊 Excel Import Analytics (Last 30 Days):</strong></p>
      <ul style="margin: 0.75rem 0; padding-left: 1.25rem;">
        <li>Total Imports: <strong>${summary.totalImports || 0}</strong></li>
        <li>Parts Searched: <strong>${summary.totalPartsSearched || 0}</strong></li>
        <li>Parts Not Found: <strong>${summary.totalPartsNotFound || 0}</strong></li>
        <li>Conversion Rate: <strong>${summary.conversionRate || 0}%</strong></li>
      </ul>`;
  }
  
  if (msg.includes('purchase') || msg.includes('bought') || msg.includes('sold')) {
    const parts = topPurchased.slice(0, 5);
    let response = '<p><strong>🛒 Top Purchased Parts (Last 30 Days):</strong></p><ol style="margin: 0.75rem 0; padding-left: 1.25rem;">';
    parts.forEach(p => {
      response += `<li><strong>${p.partNumber}</strong> - ${p.orders} orders - AED ${p.revenue.toLocaleString()}</li>`;
    });
    response += '</ol>';
    return response;
  }
  
  if (msg.includes('stats') || msg.includes('summary') || msg.includes('overview')) {
    return `<p><strong>📈 Analytics Summary (Last 30 Days):</strong></p>
      <ul style="margin: 0.75rem 0; padding-left: 1.25rem;">
        <li>Total Searches: <strong>${dashboardStats.totalSearches.toLocaleString()}</strong> (${dashboardStats.searchesChange > 0 ? '+' : ''}${dashboardStats.searchesChange}%)</li>
        <li>Purchases: <strong>${dashboardStats.purchases}</strong></li>
        <li>Conversion Rate: <strong>${dashboardStats.conversionRate}%</strong></li>
        <li>Missed Opportunities: <strong>${dashboardStats.missedOpportunities}</strong></li>
        <li>Trending Parts: <strong>${dashboardStats.trendingParts}</strong></li>
      </ul>`;
  }
  
  // Default response
  return `<p>I can help you analyze your parts data. Here's what I found:</p>
    <ul style="margin: 0.75rem 0; padding-left: 1.25rem;">
      <li>📊 ${dashboardStats.totalSearches.toLocaleString()} searches in the last 30 days</li>
      <li>🛒 ${dashboardStats.purchases} purchases made</li>
      <li>📈 ${dashboardStats.trendingParts} trending parts</li>
      <li>⚠️ ${dashboardStats.missedOpportunities} missed opportunities</li>
    </ul>
    <p>Ask me about:</p>
    <ul style="margin: 0.5rem 0; padding-left: 1.25rem;">
      <li>"What are the top trending parts?"</li>
      <li>"Show missed opportunities"</li>
      <li>"What should I restock?"</li>
      <li>"Excel import analytics"</li>
      <li>"Top purchased parts"</li>
    </ul>`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAINTENANCE & SCHEDULED TASKS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Run daily maintenance (call from scheduler)
 */
async function runDailyMaintenance() {
  try {
    console.log('🔧 Running daily analytics maintenance...');
    
    // Reset daily counters and create snapshots
    const snapshot = await PartAnalytics.resetDailyCounters();
    
    // Update trending scores
    const trending = await PartAnalytics.updateTrendingScores();
    
    console.log(`✅ Daily maintenance complete: ${snapshot.snapshots} snapshots, ${trending.updated} trending updates`);
    
    return { success: true, snapshots: snapshot.snapshots, trending: trending.updated };
  } catch (error) {
    console.error('Error in daily maintenance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run weekly cleanup (call from scheduler)
 */
async function runWeeklyCleanup() {
  try {
    console.log('🔧 Running weekly analytics cleanup...');
    
    // Refresh rolling window counters
    await PartAnalytics.refreshRollingCounters();
    
    // Update all conversion rates
    const parts = await PartAnalytics.find({}).lean();
    for (const part of parts.slice(0, 1000)) { // Limit to prevent timeout
      await PartAnalytics.updateConversionRates(part.partNumber);
    }
    
    console.log('✅ Weekly cleanup complete');
    
    return { success: true };
  } catch (error) {
    console.error('Error in weekly cleanup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync analytics with historical orders (one-time or catch-up)
 */
async function syncWithHistoricalOrders(options = {}) {
  try {
    const { days = 365, batchSize = 100 } = options;
    
    console.log(`📊 Syncing analytics with orders from last ${days} days...`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const orders = await Order.find({
      createdAt: { $gte: startDate },
      status: { $nin: ['cancelled'] },
    }).lean();
    
    let processed = 0;
    
    for (const order of orders) {
      await trackPurchase(order);
      processed++;
      
      if (processed % batchSize === 0) {
        console.log(`  Processed ${processed}/${orders.length} orders...`);
      }
    }
    
    console.log(`✅ Synced ${processed} orders to analytics`);
    
    return { success: true, processed };
  } catch (error) {
    console.error('Error syncing historical orders:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  // Tracking
  trackSearch,
  trackExcelSearch,
  trackPartView,
  trackAddToCart,
  trackPurchase,
  
  // Data retrieval
  getDashboardStats,
  getMostSearchedParts,
  getTopPurchasedParts,
  getMissedOpportunities,
  getTrendingParts,
  getSearchTrends,
  getExcelAnalytics,
  getCategoryAnalytics,
  getPurchaseFrequency,
  
  // AI features
  getAIInsights,
  chatWithAI,
  getDemandForecast,
  
  // Maintenance
  runDailyMaintenance,
  runWeeklyCleanup,
  syncWithHistoricalOrders,
};

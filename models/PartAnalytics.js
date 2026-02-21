const mongoose = require('mongoose');

/**
 * PartAnalytics Model
 * Tracks analytics for individual parts - searches, views, purchases, trends
 */
const partAnalyticsSchema = new mongoose.Schema(
  {
    // Part Identification
    partNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    
    // Current inventory status
    inventory: {
      inStock: { type: Boolean, default: false },
      quantity: { type: Number, default: 0 },
      lastPrice: { type: Number, default: 0 },
      lastUpdated: Date,
    },
    
    // Search Metrics (rolling 30-day and all-time)
    searchMetrics: {
      totalSearches: { type: Number, default: 0 },
      last30DaysSearches: { type: Number, default: 0 },
      last7DaysSearches: { type: Number, default: 0 },
      todaySearches: { type: Number, default: 0 },
      lastSearchDate: Date,
      searchTrend: { type: String, enum: ['rising', 'stable', 'falling', 'new'], default: 'new' },
      trendPercentage: { type: Number, default: 0 },
    },
    
    // View Metrics (when user clicks to see details)
    viewMetrics: {
      totalViews: { type: Number, default: 0 },
      last30DaysViews: { type: Number, default: 0 },
      last7DaysViews: { type: Number, default: 0 },
      lastViewDate: Date,
    },
    
    // Cart Metrics
    cartMetrics: {
      totalAddToCart: { type: Number, default: 0 },
      last30DaysCart: { type: Number, default: 0 },
      last7DaysCart: { type: Number, default: 0 },
      lastCartDate: Date,
    },
    
    // Purchase Metrics
    purchaseMetrics: {
      totalPurchases: { type: Number, default: 0 },
      totalQuantitySold: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      last30DaysPurchases: { type: Number, default: 0 },
      last30DaysRevenue: { type: Number, default: 0 },
      last7DaysPurchases: { type: Number, default: 0 },
      lastPurchaseDate: Date,
      averageOrderValue: { type: Number, default: 0 },
    },
    
    // Conversion Metrics
    conversionMetrics: {
      searchToView: { type: Number, default: 0 }, // percentage
      viewToCart: { type: Number, default: 0 },
      cartToPurchase: { type: Number, default: 0 },
      searchToPurchase: { type: Number, default: 0 }, // overall conversion
    },
    
    // Excel Import Tracking
    excelMetrics: {
      timesInExcelImport: { type: Number, default: 0 },
      last30DaysExcelImports: { type: Number, default: 0 },
      purchasedFromExcel: { type: Number, default: 0 },
      notPurchasedFromExcel: { type: Number, default: 0 },
      excelConversionRate: { type: Number, default: 0 },
    },
    
    // Demand Forecasting
    demandForecast: {
      expectedDemand7Days: { type: Number, default: 0 },
      expectedDemand30Days: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      seasonalTrend: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
      restockRecommendation: { type: Number, default: 0 },
      lastForecastDate: Date,
    },
    
    // Trending & Ranking
    trending: {
      isTrending: { type: Boolean, default: false, index: true },
      trendScore: { type: Number, default: 0 },
      rank: { type: Number, default: 0 },
      lastRankUpdate: Date,
    },
    
    // Daily snapshots for historical analysis (last 30 days)
    dailySnapshots: [{
      date: Date,
      searches: Number,
      views: Number,
      carts: Number,
      purchases: Number,
      revenue: Number,
    }],
    
    // Related parts (often searched/bought together)
    relatedParts: [{
      partNumber: String,
      correlation: Number, // 0-1 correlation score
      type: { type: String, enum: ['searched_together', 'bought_together', 'alternative'] },
    }],
    
    // AI Insights
    aiInsights: {
      lastAnalysisDate: Date,
      insights: [String],
      recommendedActions: [String],
      priceOptimization: {
        suggestedPrice: Number,
        reason: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
partAnalyticsSchema.index({ 'searchMetrics.totalSearches': -1 });
partAnalyticsSchema.index({ 'searchMetrics.last30DaysSearches': -1 });
partAnalyticsSchema.index({ 'purchaseMetrics.totalPurchases': -1 });
partAnalyticsSchema.index({ 'purchaseMetrics.last30DaysPurchases': -1 });
partAnalyticsSchema.index({ 'trending.trendScore': -1 });
partAnalyticsSchema.index({ category: 1, 'searchMetrics.totalSearches': -1 });
partAnalyticsSchema.index({ brand: 1, 'purchaseMetrics.totalPurchases': -1 });

/**
 * Static: Increment search count for a part
 */
partAnalyticsSchema.statics.recordSearch = async function(partNumber, options = {}) {
  const normalizedPart = partNumber.trim().toUpperCase();
  
  const update = {
    $inc: {
      'searchMetrics.totalSearches': 1,
      'searchMetrics.last30DaysSearches': 1,
      'searchMetrics.last7DaysSearches': 1,
      'searchMetrics.todaySearches': 1,
    },
    $set: {
      'searchMetrics.lastSearchDate': new Date(),
    },
  };
  
  // Track Excel imports
  if (options.source === 'excel') {
    update.$inc['excelMetrics.timesInExcelImport'] = 1;
    update.$inc['excelMetrics.last30DaysExcelImports'] = 1;
  }
  
  // Set part info if provided
  if (options.description) {
    update.$set.description = options.description;
  }
  if (options.brand) {
    update.$set.brand = options.brand;
  }
  if (options.category) {
    update.$set.category = options.category;
  }
  
  return this.findOneAndUpdate(
    { partNumber: normalizedPart },
    update,
    { upsert: true, new: true }
  );
};

/**
 * Static: Record view of a part
 */
partAnalyticsSchema.statics.recordView = async function(partNumber) {
  const normalizedPart = partNumber.trim().toUpperCase();
  
  return this.findOneAndUpdate(
    { partNumber: normalizedPart },
    {
      $inc: {
        'viewMetrics.totalViews': 1,
        'viewMetrics.last30DaysViews': 1,
        'viewMetrics.last7DaysViews': 1,
      },
      $set: {
        'viewMetrics.lastViewDate': new Date(),
      },
    },
    { upsert: true, new: true }
  );
};

/**
 * Static: Record add to cart
 */
partAnalyticsSchema.statics.recordAddToCart = async function(partNumber, options = {}) {
  const normalizedPart = partNumber.trim().toUpperCase();
  
  return this.findOneAndUpdate(
    { partNumber: normalizedPart },
    {
      $inc: {
        'cartMetrics.totalAddToCart': 1,
        'cartMetrics.last30DaysCart': 1,
        'cartMetrics.last7DaysCart': 1,
      },
      $set: {
        'cartMetrics.lastCartDate': new Date(),
      },
    },
    { upsert: true, new: true }
  );
};

/**
 * Static: Record purchase
 */
partAnalyticsSchema.statics.recordPurchase = async function(partNumber, quantity = 1, revenue = 0, options = {}) {
  const normalizedPart = partNumber.trim().toUpperCase();
  
  const update = {
    $inc: {
      'purchaseMetrics.totalPurchases': 1,
      'purchaseMetrics.totalQuantitySold': quantity,
      'purchaseMetrics.totalRevenue': revenue,
      'purchaseMetrics.last30DaysPurchases': 1,
      'purchaseMetrics.last30DaysRevenue': revenue,
      'purchaseMetrics.last7DaysPurchases': 1,
    },
    $set: {
      'purchaseMetrics.lastPurchaseDate': new Date(),
    },
  };
  
  // Track Excel to purchase conversion
  if (options.fromExcel) {
    update.$inc['excelMetrics.purchasedFromExcel'] = 1;
  }
  
  // Update part info if provided
  if (options.description) {
    update.$set.description = options.description;
  }
  if (options.brand) {
    update.$set.brand = options.brand;
  }
  if (options.category) {
    update.$set.category = options.category;
  }
  if (options.supplier) {
    update.$set.supplier = options.supplier;
  }
  
  return this.findOneAndUpdate(
    { partNumber: normalizedPart },
    update,
    { upsert: true, new: true }
  );
};

/**
 * Static: Get top searched parts
 */
partAnalyticsSchema.statics.getTopSearched = async function(options = {}) {
  const { limit = 20, days = 30, category, brand, inStockOnly = false } = options;
  
  const query = {};
  if (category) query.category = new RegExp(category, 'i');
  if (brand) query.brand = new RegExp(brand, 'i');
  if (inStockOnly) query['inventory.inStock'] = true;
  
  const sortField = days <= 7 ? 'searchMetrics.last7DaysSearches' : 'searchMetrics.last30DaysSearches';
  
  return this.find(query)
    .sort({ [sortField]: -1 })
    .limit(limit)
    .lean();
};

/**
 * Static: Get top purchased parts
 */
partAnalyticsSchema.statics.getTopPurchased = async function(options = {}) {
  const { limit = 20, days = 30, category, brand } = options;
  
  const query = {};
  if (category) query.category = new RegExp(category, 'i');
  if (brand) query.brand = new RegExp(brand, 'i');
  
  const sortField = days <= 7 ? 'purchaseMetrics.last7DaysPurchases' : 'purchaseMetrics.last30DaysPurchases';
  
  return this.find(query)
    .sort({ [sortField]: -1 })
    .limit(limit)
    .lean();
};

/**
 * Static: Get trending parts
 */
partAnalyticsSchema.statics.getTrendingParts = async function(options = {}) {
  const { limit = 20 } = options;
  
  return this.find({ 'trending.isTrending': true })
    .sort({ 'trending.trendScore': -1 })
    .limit(limit)
    .lean();
};

/**
 * Static: Get parts searched but not purchased (missed opportunities)
 */
partAnalyticsSchema.statics.getSearchedNotPurchased = async function(options = {}) {
  const { limit = 20, minSearches = 5 } = options;
  
  return this.find({
    'searchMetrics.last30DaysSearches': { $gte: minSearches },
    'purchaseMetrics.last30DaysPurchases': 0,
  })
    .sort({ 'searchMetrics.last30DaysSearches': -1 })
    .limit(limit)
    .lean();
};

/**
 * Static: Get Excel imports not converted to purchases
 */
partAnalyticsSchema.statics.getExcelNotPurchased = async function(options = {}) {
  const { limit = 20, minImports = 2 } = options;
  
  return this.find({
    'excelMetrics.last30DaysExcelImports': { $gte: minImports },
    $expr: {
      $gt: ['$excelMetrics.notPurchasedFromExcel', '$excelMetrics.purchasedFromExcel']
    }
  })
    .sort({ 'excelMetrics.last30DaysExcelImports': -1 })
    .limit(limit)
    .lean();
};

/**
 * Static: Calculate and update conversion rates
 */
partAnalyticsSchema.statics.updateConversionRates = async function(partNumber) {
  const normalizedPart = partNumber.trim().toUpperCase();
  const part = await this.findOne({ partNumber: normalizedPart });
  
  if (!part) return null;
  
  const searches = part.searchMetrics.totalSearches || 1;
  const views = part.viewMetrics.totalViews || 0;
  const carts = part.cartMetrics.totalAddToCart || 0;
  const purchases = part.purchaseMetrics.totalPurchases || 0;
  
  const conversionMetrics = {
    searchToView: Math.round((views / searches) * 100 * 10) / 10,
    viewToCart: views > 0 ? Math.round((carts / views) * 100 * 10) / 10 : 0,
    cartToPurchase: carts > 0 ? Math.round((purchases / carts) * 100 * 10) / 10 : 0,
    searchToPurchase: Math.round((purchases / searches) * 100 * 10) / 10,
  };
  
  // Update Excel conversion rate
  const excelImports = part.excelMetrics.timesInExcelImport || 1;
  const excelPurchases = part.excelMetrics.purchasedFromExcel || 0;
  const excelConversionRate = Math.round((excelPurchases / excelImports) * 100 * 10) / 10;
  
  return this.findOneAndUpdate(
    { partNumber: normalizedPart },
    {
      $set: {
        conversionMetrics,
        'excelMetrics.excelConversionRate': excelConversionRate,
      },
    },
    { new: true }
  );
};

/**
 * Static: Update trending scores
 */
partAnalyticsSchema.statics.updateTrendingScores = async function() {
  // Get all parts with recent activity
  const parts = await this.find({
    $or: [
      { 'searchMetrics.last7DaysSearches': { $gt: 0 } },
      { 'purchaseMetrics.last7DaysPurchases': { $gt: 0 } },
    ],
  }).lean();
  
  const updates = [];
  
  for (const part of parts) {
    // Calculate trend score based on multiple factors
    const searchWeight = 0.4;
    const purchaseWeight = 0.4;
    const viewWeight = 0.2;
    
    const recentSearches = part.searchMetrics.last7DaysSearches || 0;
    const totalSearches = part.searchMetrics.totalSearches || 1;
    const recentPurchases = part.purchaseMetrics.last7DaysPurchases || 0;
    const totalPurchases = part.purchaseMetrics.totalPurchases || 1;
    const recentViews = part.viewMetrics.last7DaysViews || 0;
    const totalViews = part.viewMetrics.totalViews || 1;
    
    // Calculate growth rates
    const searchGrowth = recentSearches / (totalSearches / 4); // Compare to average week
    const purchaseGrowth = recentPurchases / (totalPurchases / 4);
    const viewGrowth = recentViews / (totalViews / 4);
    
    // Combined trend score (0-100)
    const trendScore = Math.min(100, Math.round(
      (searchGrowth * searchWeight + purchaseGrowth * purchaseWeight + viewGrowth * viewWeight) * 50
    ));
    
    // Determine trend direction
    const searchTrend = searchGrowth > 1.5 ? 'rising' : 
                        searchGrowth < 0.5 ? 'falling' : 'stable';
    
    const trendPercentage = Math.round((searchGrowth - 1) * 100);
    const isTrending = trendScore > 30;
    
    updates.push({
      updateOne: {
        filter: { partNumber: part.partNumber },
        update: {
          $set: {
            'trending.trendScore': trendScore,
            'trending.isTrending': isTrending,
            'trending.lastRankUpdate': new Date(),
            'searchMetrics.searchTrend': searchTrend,
            'searchMetrics.trendPercentage': trendPercentage,
          },
        },
      },
    });
  }
  
  if (updates.length > 0) {
    await this.bulkWrite(updates);
  }
  
  // Update ranks
  const rankedParts = await this.find({ 'trending.trendScore': { $gt: 0 } })
    .sort({ 'trending.trendScore': -1 })
    .lean();
  
  const rankUpdates = rankedParts.map((part, index) => ({
    updateOne: {
      filter: { partNumber: part.partNumber },
      update: { $set: { 'trending.rank': index + 1 } },
    },
  }));
  
  if (rankUpdates.length > 0) {
    await this.bulkWrite(rankUpdates);
  }
  
  return { updated: updates.length, ranked: rankUpdates.length };
};

/**
 * Static: Get dashboard summary
 */
partAnalyticsSchema.statics.getDashboardSummary = async function(options = {}) {
  const { days = 30 } = options;
  
  const [purchaseStats, searchStats, trendingCount] = await Promise.all([
    this.aggregate([
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: '$purchaseMetrics.last30DaysPurchases' },
          totalRevenue: { $sum: '$purchaseMetrics.last30DaysRevenue' },
          avgOrderValue: { $avg: '$purchaseMetrics.averageOrderValue' },
          uniquePartsSold: { $sum: { $cond: [{ $gt: ['$purchaseMetrics.last30DaysPurchases', 0] }, 1, 0] } },
        },
      },
    ]),
    this.aggregate([
      {
        $group: {
          _id: null,
          totalSearches: { $sum: '$searchMetrics.last30DaysSearches' },
          uniquePartsSearched: { $sum: { $cond: [{ $gt: ['$searchMetrics.last30DaysSearches', 0] }, 1, 0] } },
          searchedNotBought: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$searchMetrics.last30DaysSearches', 0] },
                    { $eq: ['$purchaseMetrics.last30DaysPurchases', 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    this.countDocuments({ 'trending.isTrending': true }),
  ]);
  
  return {
    purchases: purchaseStats[0] || {},
    searches: searchStats[0] || {},
    trendingCount,
  };
};

/**
 * Static: Reset daily counters (run at midnight)
 */
partAnalyticsSchema.statics.resetDailyCounters = async function() {
  // First, snapshot today's data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const parts = await this.find({
    'searchMetrics.todaySearches': { $gt: 0 }
  }).lean();
  
  const updates = parts.map(part => ({
    updateOne: {
      filter: { partNumber: part.partNumber },
      update: {
        $push: {
          dailySnapshots: {
            $each: [{
              date: today,
              searches: part.searchMetrics.todaySearches || 0,
              views: 0, // Would need separate tracking
              carts: 0,
              purchases: 0,
              revenue: 0,
            }],
            $slice: -30, // Keep only last 30 days
          },
        },
        $set: {
          'searchMetrics.todaySearches': 0,
        },
      },
    },
  }));
  
  if (updates.length > 0) {
    await this.bulkWrite(updates);
  }
  
  return { snapshots: updates.length };
};

/**
 * Static: Clean old rolling window counters (run weekly)
 */
partAnalyticsSchema.statics.refreshRollingCounters = async function() {
  // This would recalculate 7-day and 30-day counters from dailySnapshots
  // For now, we'll just reset aging counters
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Reset 7-day counters for parts not searched in 7 days
  await this.updateMany(
    { 'searchMetrics.lastSearchDate': { $lt: sevenDaysAgo } },
    { $set: { 'searchMetrics.last7DaysSearches': 0 } }
  );
  
  // Reset 30-day counters for parts not searched in 30 days
  await this.updateMany(
    { 'searchMetrics.lastSearchDate': { $lt: thirtyDaysAgo } },
    { 
      $set: { 
        'searchMetrics.last30DaysSearches': 0,
        'purchaseMetrics.last30DaysPurchases': 0,
        'purchaseMetrics.last30DaysRevenue': 0,
        'excelMetrics.last30DaysExcelImports': 0,
      } 
    }
  );
  
  return { status: 'completed' };
};

const PartAnalytics = mongoose.model('PartAnalytics', partAnalyticsSchema);

module.exports = PartAnalytics;

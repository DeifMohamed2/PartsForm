const mongoose = require('mongoose');

/**
 * SearchAnalytics Model
 * Comprehensive tracking of all search activities for analytics
 * Tracks: searches, missed parts, Excel imports, search-to-purchase conversion
 */
const searchAnalyticsSchema = new mongoose.Schema(
  {
    // Search Query Information
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    
    // Search Source
    source: {
      type: String,
      enum: ['manual', 'excel', 'ai-search', 'autocomplete', 'multi-search'],
      default: 'manual',
      index: true,
    },
    
    // Excel-specific tracking
    excelImport: {
      filename: String,
      sheetName: String,
      totalParts: Number,
      importedAt: Date,
    },
    
    // Search Results
    results: {
      totalFound: { type: Number, default: 0 },
      partsFound: [String], // Part numbers that were found
      partsNotFound: [String], // Part numbers that were NOT in inventory
      searchTime: Number, // milliseconds
      dataSource: { type: String, enum: ['elasticsearch', 'mongodb'], default: 'mongodb' },
    },
    
    // User Actions After Search
    userActions: {
      viewedResults: { type: Boolean, default: true },
      clickedPart: { type: Boolean, default: false },
      clickedPartNumbers: [String],
      addedToCart: { type: Boolean, default: false },
      addedPartNumbers: [String],
      purchased: { type: Boolean, default: false },
      purchasedPartNumbers: [String],
      refinedSearch: { type: Boolean, default: false },
      refinedQuery: String,
      abandonedAt: Date,
    },
    
    // Session & User Info
    sessionId: {
      type: String,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      index: true,
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
    
    // Device & Location
    metadata: {
      userAgent: String,
      ip: String,
      country: String,
      city: String,
      device: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' },
    },
    
    // Conversion tracking
    conversion: {
      converted: { type: Boolean, default: false, index: true },
      conversionType: { type: String, enum: ['view', 'cart', 'purchase', 'none'], default: 'none' },
      conversionTime: Number, // Time from search to conversion in ms
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      orderTotal: Number,
    },
    
    // Part categories searched
    categories: [String],
    brands: [String],
    
    // Analytics flags
    isMissedOpportunity: {
      type: Boolean,
      default: false,
      index: true,
    },
    missedReason: {
      type: String,
      enum: ['not_in_inventory', 'price_too_high', 'out_of_stock', 'no_match', 'abandoned', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient analytics queries
searchAnalyticsSchema.index({ createdAt: -1 });
searchAnalyticsSchema.index({ normalizedQuery: 1, createdAt: -1 });
searchAnalyticsSchema.index({ source: 1, createdAt: -1 });
searchAnalyticsSchema.index({ 'results.partsNotFound': 1 });
searchAnalyticsSchema.index({ isMissedOpportunity: 1, createdAt: -1 });
searchAnalyticsSchema.index({ 'conversion.converted': 1, createdAt: -1 });
searchAnalyticsSchema.index({ buyerId: 1, createdAt: -1 });

/**
 * Static: Record a new search
 */
searchAnalyticsSchema.statics.recordSearch = async function(data) {
  const normalizedQuery = data.query?.toLowerCase().trim() || '';
  
  const record = new this({
    query: data.query,
    normalizedQuery,
    source: data.source || 'manual',
    results: {
      totalFound: data.totalFound || 0,
      partsFound: data.partsFound || [],
      partsNotFound: data.partsNotFound || [],
      searchTime: data.searchTime,
      dataSource: data.dataSource || 'mongodb',
    },
    sessionId: data.sessionId,
    buyerId: data.buyerId,
    isAuthenticated: !!data.buyerId,
    metadata: data.metadata || {},
    categories: data.categories || [],
    brands: data.brands || [],
    isMissedOpportunity: (data.partsNotFound?.length > 0) || (data.totalFound === 0),
    missedReason: data.totalFound === 0 ? 'no_match' : 
                  (data.partsNotFound?.length > 0 ? 'not_in_inventory' : null),
  });
  
  if (data.excelImport) {
    record.excelImport = data.excelImport;
  }
  
  await record.save();
  return record;
};

/**
 * Static: Update search with user action
 */
searchAnalyticsSchema.statics.recordUserAction = async function(searchId, action, data = {}) {
  const update = {};
  
  switch(action) {
    case 'click':
      update['userActions.clickedPart'] = true;
      if (data.partNumber) {
        update.$addToSet = { 'userActions.clickedPartNumbers': data.partNumber };
      }
      break;
    case 'cart':
      update['userActions.addedToCart'] = true;
      if (data.partNumber) {
        update.$addToSet = { 'userActions.addedPartNumbers': data.partNumber };
      }
      update['conversion.conversionType'] = 'cart';
      break;
    case 'purchase':
      update['userActions.purchased'] = true;
      if (data.partNumbers) {
        update.$addToSet = { 'userActions.purchasedPartNumbers': { $each: data.partNumbers } };
      }
      update['conversion.converted'] = true;
      update['conversion.conversionType'] = 'purchase';
      update['conversion.orderId'] = data.orderId;
      update['conversion.orderTotal'] = data.orderTotal;
      break;
    case 'refine':
      update['userActions.refinedSearch'] = true;
      update['userActions.refinedQuery'] = data.newQuery;
      break;
    case 'abandon':
      update['userActions.abandonedAt'] = new Date();
      break;
  }
  
  return this.findByIdAndUpdate(searchId, update, { new: true });
};

/**
 * Static: Get most searched terms
 */
searchAnalyticsSchema.statics.getMostSearched = async function(options = {}) {
  const { days = 30, limit = 20, source } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const match = { createdAt: { $gte: startDate } };
  if (source) match.source = source;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$normalizedQuery',
        count: { $sum: 1 },
        totalFound: { $avg: '$results.totalFound' },
        converted: { $sum: { $cond: ['$conversion.converted', 1, 0] } },
        lastSearched: { $max: '$createdAt' },
        sources: { $addToSet: '$source' },
      },
    },
    {
      $project: {
        query: '$_id',
        searchCount: '$count',
        avgResults: { $round: ['$totalFound', 0] },
        conversionRate: { 
          $round: [{ $multiply: [{ $divide: ['$converted', '$count'] }, 100] }, 1] 
        },
        lastSearched: 1,
        sources: 1,
      },
    },
    { $sort: { searchCount: -1 } },
    { $limit: limit },
  ]);
};

/**
 * Static: Get missed opportunities (searched but not found)
 */
searchAnalyticsSchema.statics.getMissedOpportunities = async function(options = {}) {
  const { days = 30, limit = 20 } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        isMissedOpportunity: true,
      },
    },
    { $unwind: { path: '$results.partsNotFound', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: '$results.partsNotFound',
        searchCount: { $sum: 1 },
        reasons: { $push: '$missedReason' },
        lastSearched: { $max: '$createdAt' },
        sources: { $addToSet: '$source' },
      },
    },
    {
      $project: {
        partNumber: '$_id',
        searchCount: 1,
        dominantReason: { $arrayElemAt: ['$reasons', 0] },
        lastSearched: 1,
        sources: 1,
        isExcelSearch: { $in: ['excel', '$sources'] },
      },
    },
    { $sort: { searchCount: -1 } },
    { $limit: limit },
  ]);
};

/**
 * Static: Get search trends over time
 */
searchAnalyticsSchema.statics.getSearchTrends = async function(options = {}) {
  const { days = 30, groupBy = 'day' } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const dateFormat = groupBy === 'hour' ? '%Y-%m-%d %H:00' : 
                     groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d';
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        totalSearches: { $sum: 1 },
        uniqueQueries: { $addToSet: '$normalizedQuery' },
        conversions: { $sum: { $cond: ['$conversion.converted', 1, 0] } },
        missedOpportunities: { $sum: { $cond: ['$isMissedOpportunity', 1, 0] } },
        excelSearches: { $sum: { $cond: [{ $eq: ['$source', 'excel'] }, 1, 0] } },
      },
    },
    {
      $project: {
        date: '$_id',
        totalSearches: 1,
        uniqueQueries: { $size: '$uniqueQueries' },
        conversions: 1,
        conversionRate: {
          $round: [{ $multiply: [{ $divide: ['$conversions', '$totalSearches'] }, 100] }, 1],
        },
        missedOpportunities: 1,
        excelSearches: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

/**
 * Static: Get Excel import analytics
 */
searchAnalyticsSchema.statics.getExcelAnalytics = async function(options = {}) {
  const { days = 30 } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        source: 'excel',
      },
    },
    {
      $group: {
        _id: null,
        totalImports: { $sum: 1 },
        totalPartsSearched: { $sum: { $size: { $ifNull: ['$results.partsFound', []] } } },
        totalPartsNotFound: { $sum: { $size: { $ifNull: ['$results.partsNotFound', []] } } },
        conversions: { $sum: { $cond: ['$conversion.converted', 1, 0] } },
        uniqueUsers: { $addToSet: '$buyerId' },
      },
    },
    {
      $project: {
        totalImports: 1,
        totalPartsSearched: 1,
        totalPartsNotFound: 1,
        conversions: 1,
        conversionRate: {
          $round: [{ $multiply: [{ $divide: ['$conversions', '$totalImports'] }, 100] }, 1],
        },
        uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', as: 'u', cond: { $ne: ['$$u', null] } } } },
        findRate: {
          $round: [{
            $multiply: [{
              $divide: ['$totalPartsSearched', { $add: ['$totalPartsSearched', '$totalPartsNotFound'] }]
            }, 100]
          }, 1],
        },
      },
    },
  ]);
};

/**
 * Static: Get dashboard summary stats
 */
searchAnalyticsSchema.statics.getDashboardStats = async function(options = {}) {
  const { days = 30 } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const previousStart = new Date(startDate);
  previousStart.setDate(previousStart.getDate() - days);
  
  const [current, previous] = await Promise.all([
    this.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          uniqueQueries: { $addToSet: '$normalizedQuery' },
          conversions: { $sum: { $cond: ['$conversion.converted', 1, 0] } },
          missedOpportunities: { $sum: { $cond: ['$isMissedOpportunity', 1, 0] } },
          excelSearches: { $sum: { $cond: [{ $eq: ['$source', 'excel'] }, 1, 0] } },
          totalPartsViewed: { $sum: { $cond: ['$userActions.clickedPart', 1, 0] } },
        },
      },
    ]),
    this.aggregate([
      { $match: { createdAt: { $gte: previousStart, $lt: startDate } } },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          conversions: { $sum: { $cond: ['$conversion.converted', 1, 0] } },
          missedOpportunities: { $sum: { $cond: ['$isMissedOpportunity', 1, 0] } },
        },
      },
    ]),
  ]);
  
  const curr = current[0] || { totalSearches: 0, uniqueQueries: [], conversions: 0, missedOpportunities: 0 };
  const prev = previous[0] || { totalSearches: 1, conversions: 0, missedOpportunities: 0 };
  
  const calcChange = (c, p) => {
    if (p === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / p) * 100 * 10) / 10;
  };
  
  return {
    totalSearches: curr.totalSearches || 0,
    searchesChange: calcChange(curr.totalSearches, prev.totalSearches),
    uniqueQueries: curr.uniqueQueries?.length || 0,
    conversions: curr.conversions || 0,
    conversionsChange: calcChange(curr.conversions, prev.conversions),
    conversionRate: curr.totalSearches > 0 
      ? Math.round((curr.conversions / curr.totalSearches) * 100 * 10) / 10 
      : 0,
    missedOpportunities: curr.missedOpportunities || 0,
    missedChange: calcChange(curr.missedOpportunities, prev.missedOpportunities),
    excelSearches: curr.excelSearches || 0,
    partsViewed: curr.totalPartsViewed || 0,
  };
};

const SearchAnalytics = mongoose.model('SearchAnalytics', searchAnalyticsSchema);

module.exports = SearchAnalytics;

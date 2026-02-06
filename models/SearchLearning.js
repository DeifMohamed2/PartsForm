const mongoose = require('mongoose');

/**
 * SearchLearning Model
 * Stores AI learning data from search patterns, successes, and failures
 * The AI uses this to improve over time
 */
const searchLearningSchema = new mongoose.Schema(
  {
    // Query Information
    originalQuery: {
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

    // What AI understood
    aiUnderstanding: {
      keywords: [String],
      categories: [String],
      brands: [String],
      partNumbers: [String],
      priceConstraints: {
        maxPrice: Number,
        minPrice: Number,
        currency: String,
      },
      stockConstraints: {
        requireInStock: Boolean,
        requireHighStock: Boolean,
      },
    },

    // Search Outcome
    outcome: {
      resultsCount: { type: Number, default: 0 },
      wasSuccessful: { type: Boolean, default: false },
      userClickedResult: { type: Boolean, default: false },
      userRefinedSearch: { type: Boolean, default: false },
      refinedQuery: String,
      searchTime: Number,
      source: String, // elasticsearch, mongodb, etc.
    },

    // Learning Data
    learning: {
      // Keywords that actually found results
      effectiveKeywords: [String],
      // Keywords that didn't work
      ineffectiveKeywords: [String],
      // Better alternative found
      betterAlternative: {
        query: String,
        resultsCount: Number,
      },
      // Patterns learned
      patterns: [
        {
          input: String, // What user typed
          meaning: String, // What it actually meant
          confidence: Number, // 0-1 confidence score
        },
      ],
    },

    // Feedback & Scoring
    feedback: {
      implicit: {
        dwellTime: Number, // How long user stayed on results
        scrollDepth: Number, // How far they scrolled (0-100%)
        addedToCart: Boolean, // Did they add something to cart
        viewedDetails: Boolean, // Did they view part details
      },
      explicit: {
        rating: { type: Number, min: 1, max: 5 },
        helpful: Boolean,
        comment: String,
      },
    },

    // Success Score (calculated)
    successScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    // Usage Statistics
    usageCount: {
      type: Number,
      default: 1,
      index: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },

    // Session tracking
    sessionId: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient querying
searchLearningSchema.index({ normalizedQuery: 1, 'outcome.wasSuccessful': 1 });
searchLearningSchema.index({ 'learning.effectiveKeywords': 1 });
searchLearningSchema.index({ successScore: -1, usageCount: -1 });
searchLearningSchema.index({ createdAt: -1 });

// Text index for finding similar queries
searchLearningSchema.index(
  {
    originalQuery: 'text',
    'aiUnderstanding.keywords': 'text',
    'learning.effectiveKeywords': 'text',
  },
  {
    weights: {
      originalQuery: 10,
      'learning.effectiveKeywords': 5,
      'aiUnderstanding.keywords': 3,
    },
  },
);

/**
 * Calculate success score based on outcome and feedback
 */
searchLearningSchema.methods.calculateSuccessScore = function () {
  let score = 0;

  // Results found (0-40 points)
  if (this.outcome.resultsCount > 0) {
    score += Math.min(40, this.outcome.resultsCount * 2);
  }

  // User engagement (0-30 points)
  if (this.outcome.userClickedResult) score += 15;
  if (this.feedback?.implicit?.viewedDetails) score += 10;
  if (this.feedback?.implicit?.addedToCart) score += 5;

  // No refinement needed (0-20 points)
  if (!this.outcome.userRefinedSearch) score += 20;

  // Explicit feedback (0-10 points)
  if (this.feedback?.explicit?.helpful) score += 10;
  else if (this.feedback?.explicit?.rating) {
    score += (this.feedback.explicit.rating / 5) * 10;
  }

  this.successScore = Math.min(100, score);
  return this.successScore;
};

/**
 * Static: Find similar successful searches
 */
searchLearningSchema.statics.findSimilarSuccessful = async function (
  query,
  limit = 5,
) {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  // Try exact match first
  const exactMatch = await this.findOne({
    normalizedQuery,
    'outcome.wasSuccessful': true,
    successScore: { $gte: 50 },
  }).sort({ successScore: -1, usageCount: -1 });

  if (exactMatch) {
    return [exactMatch];
  }

  // Try text search for similar queries
  const similar = await this.find({
    $text: { $search: words.join(' ') },
    'outcome.wasSuccessful': true,
    successScore: { $gte: 30 },
  })
    .sort({ score: { $meta: 'textScore' }, successScore: -1 })
    .limit(limit)
    .lean();

  return similar;
};

/**
 * Static: Get learned patterns for keywords
 */
searchLearningSchema.statics.getLearnedPatterns = async function (keywords) {
  const patterns = await this.aggregate([
    {
      $match: {
        'learning.effectiveKeywords': { $in: keywords },
        'outcome.wasSuccessful': true,
        successScore: { $gte: 50 },
      },
    },
    {
      $group: {
        _id: null,
        effectiveKeywords: { $addToSet: '$learning.effectiveKeywords' },
        patterns: { $push: '$learning.patterns' },
        avgScore: { $avg: '$successScore' },
        totalUsage: { $sum: '$usageCount' },
      },
    },
  ]);

  return patterns[0] || { effectiveKeywords: [], patterns: [], avgScore: 0 };
};

/**
 * Static: Record a search and learn from it
 */
searchLearningSchema.statics.recordSearch = async function (data) {
  const normalizedQuery = data.query.toLowerCase().trim();

  // Check if we have this query already
  let existing = await this.findOne({ normalizedQuery });

  if (existing) {
    // Update existing record
    existing.usageCount += 1;
    existing.lastUsed = new Date();

    // Update outcome if this search was better
    if (data.resultsCount > existing.outcome.resultsCount) {
      existing.outcome.resultsCount = data.resultsCount;
      existing.outcome.wasSuccessful = data.resultsCount > 0;
      existing.aiUnderstanding =
        data.aiUnderstanding || existing.aiUnderstanding;
      existing.learning.effectiveKeywords =
        data.effectiveKeywords || existing.learning.effectiveKeywords;
    }

    existing.calculateSuccessScore();
    await existing.save();
    return existing;
  }

  // Create new record
  const record = new this({
    originalQuery: data.query,
    normalizedQuery,
    aiUnderstanding: data.aiUnderstanding || {},
    outcome: {
      resultsCount: data.resultsCount || 0,
      wasSuccessful: (data.resultsCount || 0) > 0,
      searchTime: data.searchTime,
      source: data.source,
    },
    learning: {
      effectiveKeywords: data.effectiveKeywords || [],
      ineffectiveKeywords: data.ineffectiveKeywords || [],
    },
    sessionId: data.sessionId,
    userId: data.userId,
  });

  record.calculateSuccessScore();
  await record.save();
  return record;
};

/**
 * Static: Learn from a failed search followed by successful refinement
 */
searchLearningSchema.statics.learnFromRefinement = async function (
  failedQuery,
  successfulQuery,
  successData,
) {
  const normalizedFailed = failedQuery.toLowerCase().trim();

  // Update the failed query record
  const failedRecord = await this.findOne({
    normalizedQuery: normalizedFailed,
  });
  if (failedRecord) {
    failedRecord.outcome.userRefinedSearch = true;
    failedRecord.outcome.refinedQuery = successfulQuery;
    failedRecord.learning.betterAlternative = {
      query: successfulQuery,
      resultsCount: successData.resultsCount,
    };

    // Extract what made the refined query better
    const failedWords = new Set(normalizedFailed.split(/\s+/));
    const successWords = successfulQuery.toLowerCase().split(/\s+/);
    const newWords = successWords.filter((w) => !failedWords.has(w));

    if (newWords.length > 0) {
      failedRecord.learning.patterns.push({
        input: failedQuery,
        meaning: `User meant: ${successfulQuery}. Added keywords: ${newWords.join(', ')}`,
        confidence: 0.8,
      });
    }

    failedRecord.calculateSuccessScore();
    await failedRecord.save();
  }

  return failedRecord;
};

/**
 * Static: Get suggestions for improving a query
 */
searchLearningSchema.statics.getSuggestions = async function (query) {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  // Find queries that started similar but were refined
  const refinements = await this.find({
    'outcome.userRefinedSearch': true,
    'learning.betterAlternative.query': { $exists: true },
    $or: [
      { normalizedQuery: { $regex: words[0], $options: 'i' } },
      { 'aiUnderstanding.keywords': { $in: words } },
    ],
  })
    .sort({ successScore: -1 })
    .limit(5)
    .lean();

  const suggestions = refinements.map((r) => ({
    original: r.originalQuery,
    suggested: r.learning.betterAlternative.query,
    reason:
      r.learning.patterns[0]?.meaning || 'Based on similar successful searches',
  }));

  // Also find top successful similar queries
  const successful = await this.find({
    'outcome.wasSuccessful': true,
    successScore: { $gte: 60 },
    $or: [
      { normalizedQuery: { $regex: words[0], $options: 'i' } },
      { 'learning.effectiveKeywords': { $in: words } },
    ],
  })
    .sort({ successScore: -1, usageCount: -1 })
    .limit(3)
    .lean();

  successful.forEach((s) => {
    if (!suggestions.find((sg) => sg.suggested === s.originalQuery)) {
      suggestions.push({
        original: query,
        suggested: s.originalQuery,
        reason: `Similar query with ${s.outcome.resultsCount} results`,
      });
    }
  });

  return suggestions.slice(0, 5);
};

const SearchLearning = mongoose.model('SearchLearning', searchLearningSchema);

module.exports = SearchLearning;

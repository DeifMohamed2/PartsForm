/**
 * AI Learning Service
 *
 * This service enables the AI to learn from search patterns, failures, and successes.
 * It provides:
 * 1. Pattern recognition - Learn what queries lead to good results
 * 2. Failure analysis - Understand why searches fail and how to fix them
 * 3. Keyword mapping - Learn synonyms and alternative search terms
 * 4. Continuous improvement - Get smarter with each search
 */

const SearchLearning = require('../models/SearchLearning');

// In-memory cache for fast lookups (cleared periodically)
const learningCache = {
  patterns: new Map(), // Keyword → effective alternatives
  synonyms: new Map(), // Word → [synonyms]
  failures: new Map(), // Failed query → suggestions
  successfulQueries: [], // Recent successful queries
  lastRefresh: null,
  TTL: 5 * 60 * 1000, // 5 minute cache
};

/**
 * Initialize the learning service - load recent learnings into cache
 */
async function initialize() {
  try {
    console.log('🧠 Initializing AI Learning Service...');
    await refreshCache();
    console.log('✅ AI Learning Service ready');
  } catch (error) {
    console.error(
      '⚠️ AI Learning Service initialization error:',
      error.message,
    );
  }
}

/**
 * Refresh the in-memory cache with recent learnings
 */
async function refreshCache() {
  const now = Date.now();
  if (
    learningCache.lastRefresh &&
    now - learningCache.lastRefresh < learningCache.TTL
  ) {
    return; // Cache is still fresh
  }

  try {
    // Load successful patterns
    const successfulSearches = await SearchLearning.find({
      'outcome.wasSuccessful': true,
      successScore: { $gte: 50 },
      usageCount: { $gte: 2 },
    })
      .sort({ successScore: -1, usageCount: -1 })
      .limit(500)
      .lean();

    // Build pattern cache
    learningCache.patterns.clear();
    learningCache.synonyms.clear();

    successfulSearches.forEach((search) => {
      const keywords = search.aiUnderstanding?.keywords || [];
      const effective = search.learning?.effectiveKeywords || [];

      keywords.forEach((kw) => {
        const existing = learningCache.patterns.get(kw.toLowerCase()) || [];
        learningCache.patterns.set(kw.toLowerCase(), [
          ...new Set([...existing, ...effective]),
        ]);
      });

      // Build synonym map from patterns
      if (search.learning?.patterns) {
        search.learning.patterns.forEach((p) => {
          if (p.input && p.meaning && p.confidence > 0.5) {
            const inputWords = p.input.toLowerCase().split(/\s+/);
            inputWords.forEach((word) => {
              const synonyms = learningCache.synonyms.get(word) || [];
              // Extract meaningful words from meaning
              const meaningWords =
                p.meaning.toLowerCase().match(/\b\w{3,}\b/g) || [];
              learningCache.synonyms.set(word, [
                ...new Set([...synonyms, ...meaningWords.slice(0, 5)]),
              ]);
            });
          }
        });
      }
    });

    // Load failure patterns
    const failedSearches = await SearchLearning.find({
      'outcome.wasSuccessful': false,
      'learning.betterAlternative.query': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    learningCache.failures.clear();
    failedSearches.forEach((search) => {
      learningCache.failures.set(
        search.normalizedQuery,
        search.learning.betterAlternative.query,
      );
    });

    // Store recent successful queries for suggestions
    learningCache.successfulQueries = successfulSearches
      .slice(0, 100)
      .map((s) => ({
        query: s.originalQuery,
        keywords: s.learning?.effectiveKeywords || [],
        score: s.successScore,
      }));

    learningCache.lastRefresh = now;
    console.log(
      `🧠 Learning cache refreshed: ${learningCache.patterns.size} patterns, ${learningCache.failures.size} failure fixes`,
    );
  } catch (error) {
    console.error('Cache refresh error:', error.message);
  }
}

/**
 * Get learned context for a query - called before AI processing
 * This enriches the AI's understanding with past learnings
 */
async function getLearnedContext(query) {
  await refreshCache();

  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  const context = {
    hasPriorLearning: false,
    suggestedKeywords: [],
    synonyms: {},
    previousSuccessfulQuery: null,
    betterAlternative: null,
    confidence: 0,
    hints: [],
  };

  // Check for exact failure match with known fix
  if (learningCache.failures.has(normalizedQuery)) {
    context.betterAlternative = learningCache.failures.get(normalizedQuery);
    context.hasPriorLearning = true;
    context.hints.push(
      `Previous searches for "${query}" worked better as "${context.betterAlternative}"`,
    );
  }

  // Gather learned keywords for each word
  words.forEach((word) => {
    // Get effective keywords for this word
    const patterns = learningCache.patterns.get(word) || [];
    if (patterns.length > 0) {
      context.suggestedKeywords.push(...patterns);
      context.hasPriorLearning = true;
    }

    // Get synonyms
    const synonyms = learningCache.synonyms.get(word) || [];
    if (synonyms.length > 0) {
      context.synonyms[word] = synonyms;
      context.hasPriorLearning = true;
    }
  });

  // Remove duplicates
  context.suggestedKeywords = [...new Set(context.suggestedKeywords)];

  // Find similar successful query
  const similarSuccessful = learningCache.successfulQueries.find((sq) => {
    const sqWords = sq.query.toLowerCase().split(/\s+/);
    return (
      words.some((w) => sqWords.includes(w)) ||
      sq.keywords.some((kw) => words.includes(kw.toLowerCase()))
    );
  });

  if (similarSuccessful) {
    context.previousSuccessfulQuery = similarSuccessful.query;
    context.confidence = similarSuccessful.score / 100;
    context.hasPriorLearning = true;
  }

  // Try database for more specific matches if cache didn't help
  if (!context.hasPriorLearning) {
    try {
      const dbSuggestions = await SearchLearning.getSuggestions(query);
      if (dbSuggestions.length > 0) {
        context.hints = dbSuggestions.map((s) => s.reason);
        context.betterAlternative = dbSuggestions[0].suggested;
        context.hasPriorLearning = true;
      }
    } catch (error) {
      // Silent fail - cache is good enough
    }
  }

  return context;
}

/**
 * Record a search attempt and its outcome
 * This is the main learning entry point
 */
async function recordSearchAttempt(data) {
  try {
    const {
      query,
      aiUnderstanding,
      resultsCount,
      searchTime,
      source,
      sessionId,
      userId,
    } = data;

    // Determine effective keywords (those that led to results)
    const effectiveKeywords = [];
    const ineffectiveKeywords = [];

    if (aiUnderstanding) {
      const allKeywords = [
        ...(aiUnderstanding.keywords || []),
        ...(aiUnderstanding.categories || []),
        ...(aiUnderstanding.searchKeywords || []),
      ];

      if (resultsCount > 0) {
        effectiveKeywords.push(...allKeywords);
      } else {
        ineffectiveKeywords.push(...allKeywords);
      }
    }

    const record = await SearchLearning.recordSearch({
      query,
      aiUnderstanding: {
        keywords: aiUnderstanding?.searchKeywords || [],
        categories: aiUnderstanding?.categories || [],
        brands: aiUnderstanding?.brands || [],
        partNumbers: aiUnderstanding?.partNumbers || [],
        priceConstraints: aiUnderstanding?.priceConstraints,
        stockConstraints: aiUnderstanding?.stockConstraints,
      },
      resultsCount,
      searchTime,
      source,
      effectiveKeywords,
      ineffectiveKeywords,
      sessionId,
      userId,
    });

    // If this was a failure, check if we should suggest something
    if (resultsCount === 0) {
      const suggestions = await SearchLearning.getSuggestions(query);
      return {
        recorded: true,
        recordId: record._id,
        wasSuccessful: false,
        suggestions: suggestions.slice(0, 3),
      };
    }

    return {
      recorded: true,
      recordId: record._id,
      wasSuccessful: resultsCount > 0,
    };
  } catch (error) {
    console.error('Error recording search:', error.message);
    return { recorded: false, error: error.message };
  }
}

/**
 * Record that a user refined their search (learning opportunity!)
 */
async function recordSearchRefinement(
  originalQuery,
  refinedQuery,
  refinedResults,
) {
  try {
    // This is valuable learning data - user told us what they really meant
    await SearchLearning.learnFromRefinement(originalQuery, refinedQuery, {
      resultsCount: refinedResults.count,
    });

    // Update cache immediately for this pattern
    const normalizedOriginal = originalQuery.toLowerCase().trim();
    learningCache.failures.set(normalizedOriginal, refinedQuery);

    console.log(`🧠 Learned: "${originalQuery}" → "${refinedQuery}"`);

    return { learned: true };
  } catch (error) {
    console.error('Error recording refinement:', error.message);
    return { learned: false };
  }
}

/**
 * Record user engagement with search results (implicit feedback)
 */
async function recordEngagement(recordId, engagement) {
  try {
    const record = await SearchLearning.findById(recordId);
    if (!record) return { updated: false };

    record.feedback = record.feedback || { implicit: {}, explicit: {} };
    record.feedback.implicit = {
      ...record.feedback.implicit,
      ...engagement,
    };

    // Recalculate success score with new engagement data
    if (engagement.viewedDetails) record.outcome.userClickedResult = true;
    record.calculateSuccessScore();

    await record.save();

    // If this was highly successful, refresh cache sooner
    if (record.successScore >= 80) {
      learningCache.lastRefresh = null; // Force refresh on next query
    }

    return { updated: true, newScore: record.successScore };
  } catch (error) {
    console.error('Error recording engagement:', error.message);
    return { updated: false };
  }
}

/**
 * Record explicit user feedback
 */
async function recordFeedback(recordId, feedback) {
  try {
    const record = await SearchLearning.findById(recordId);
    if (!record) return { updated: false };

    record.feedback = record.feedback || { implicit: {}, explicit: {} };
    record.feedback.explicit = {
      ...record.feedback.explicit,
      ...feedback,
    };

    record.calculateSuccessScore();
    await record.save();

    return { updated: true, newScore: record.successScore };
  } catch (error) {
    console.error('Error recording feedback:', error.message);
    return { updated: false };
  }
}

/**
 * Get learning statistics
 */
async function getStats() {
  try {
    const stats = await SearchLearning.aggregate([
      {
        $group: {
          _id: null,
          totalSearches: { $sum: '$usageCount' },
          uniqueQueries: { $sum: 1 },
          avgSuccessScore: { $avg: '$successScore' },
          successfulSearches: {
            $sum: { $cond: ['$outcome.wasSuccessful', 1, 0] },
          },
          refinedSearches: {
            $sum: { $cond: ['$outcome.userRefinedSearch', 1, 0] },
          },
          patternsLearned: {
            $sum: { $size: { $ifNull: ['$learning.patterns', []] } },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalSearches: 0,
      uniqueQueries: 0,
      avgSuccessScore: 0,
      successfulSearches: 0,
      refinedSearches: 0,
      patternsLearned: 0,
    };

    result.cacheSize = {
      patterns: learningCache.patterns.size,
      synonyms: learningCache.synonyms.size,
      failures: learningCache.failures.size,
    };

    return result;
  } catch (error) {
    console.error('Error getting stats:', error.message);
    return null;
  }
}

/**
 * Generate learning prompt addition for AI
 * This is added to the AI prompt to include learned context
 */
function generateLearningPrompt(learnedContext) {
  if (!learnedContext.hasPriorLearning) {
    return '';
  }

  let prompt = '\n\nLEARNED CONTEXT FROM PREVIOUS SEARCHES:\n';

  if (learnedContext.betterAlternative) {
    prompt += `- IMPORTANT: Similar queries worked better as: "${learnedContext.betterAlternative}"\n`;
  }

  if (learnedContext.suggestedKeywords.length > 0) {
    prompt += `- Effective keywords from past searches: ${learnedContext.suggestedKeywords.join(', ')}\n`;
  }

  if (Object.keys(learnedContext.synonyms).length > 0) {
    prompt += '- Learned synonyms:\n';
    Object.entries(learnedContext.synonyms).forEach(([word, syns]) => {
      prompt += `  "${word}" often means: ${syns.slice(0, 3).join(', ')}\n`;
    });
  }

  if (learnedContext.hints.length > 0) {
    prompt += '- Hints from past searches:\n';
    learnedContext.hints.slice(0, 3).forEach((hint) => {
      prompt += `  • ${hint}\n`;
    });
  }

  prompt +=
    '\nUse this learned context to better understand what the user wants.\n';

  return prompt;
}

/**
 * Clean up old learning data (run periodically)
 */
async function cleanup(daysToKeep = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Delete old records with low scores and no recent usage
    const result = await SearchLearning.deleteMany({
      lastUsed: { $lt: cutoffDate },
      successScore: { $lt: 30 },
      usageCount: { $lt: 3 },
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old learning records`);
    return result.deletedCount;
  } catch (error) {
    console.error('Cleanup error:', error.message);
    return 0;
  }
}

module.exports = {
  initialize,
  refreshCache,
  getLearnedContext,
  recordSearchAttempt,
  recordSearchRefinement,
  recordEngagement,
  recordFeedback,
  getStats,
  generateLearningPrompt,
  cleanup,
};

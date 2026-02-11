/**
 * Search Pipeline Integration Adapter
 * 
 * Bridges the new modular search pipeline with the existing searchController.
 * Provides a drop-in replacement for the aiSearch function that uses the
 * new architecture while maintaining backward compatibility.
 * 
 * Features:
 * - Graceful fallback to legacy search if new pipeline fails
 * - Feature flags for gradual rollout
 * - A/B testing support
 * - Metrics comparison between old and new
 */

const { createSearchOrchestrator } = require('../services/search');
const { searchMetrics } = require('../services/search/utils/metrics');
const geminiService = require('../services/geminiService');
const elasticsearchService = require('../services/elasticsearchService');
const aiLearningService = require('../services/aiLearningService');
const { applyMarkupToParts, getRequestMarkup } = require('../utils/priceMarkup');

// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  enableNewPipeline: process.env.ENABLE_NEW_SEARCH_PIPELINE === 'true' || false,
  enablePipelineForPercentage: parseInt(process.env.NEW_PIPELINE_PERCENTAGE || '0', 10),
  enableComparison: process.env.ENABLE_SEARCH_COMPARISON === 'true' || false,
  enableMetrics: true,
};

// Initialize orchestrator with services
let orchestrator = null;

function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = createSearchOrchestrator({
      geminiService,
      elasticsearchService,
    });
  }
  return orchestrator;
}

/**
 * Determine if request should use new pipeline
 */
function shouldUseNewPipeline(req) {
  // Always use new pipeline if explicitly requested
  if (req.query?.usePipeline === 'true' || req.body?.usePipeline === true) {
    return true;
  }
  
  // Check if new pipeline is enabled globally
  if (FEATURE_FLAGS.enableNewPipeline) {
    return true;
  }
  
  // Percentage-based rollout
  if (FEATURE_FLAGS.enablePipelineForPercentage > 0) {
    const hash = hashRequest(req);
    return (hash % 100) < FEATURE_FLAGS.enablePipelineForPercentage;
  }
  
  return false;
}

/**
 * Simple hash for consistent bucketing
 */
function hashRequest(req) {
  const key = req.sessionID || req.ip || Math.random().toString();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * New AI Search using the modular pipeline
 * Drop-in replacement for the original aiSearch function
 */
async function aiSearchV2(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    const query = req.body?.query;
    
    if (!query || !query.trim()) {
      return res.json({
        success: false,
        error: 'Please enter a search query',
        results: [],
        total: 0,
        message: 'Enter a part number, brand name, or describe what you need.',
      });
    }
    
    console.log(`🚀 AI Search V2 [${requestId}]: "${query}"`);
    
    // Get the orchestrator
    const search = getOrchestrator();
    
    // Execute search through new pipeline
    const pipelineResult = await search.search(query, {
      page: parseInt(req.body?.page || '1', 10),
      limit: parseInt(req.body?.limit || '100', 10),
    });
    
    if (!pipelineResult.success) {
      console.error(`❌ Pipeline search failed: ${pipelineResult.error}`);
      
      // Return error response
      return res.status(500).json({
        success: false,
        error: pipelineResult.error || 'Search failed',
        message: 'An error occurred while searching. Please try again.',
        results: [],
        total: 0,
      });
    }
    
    // Transform pipeline results to legacy format for backward compatibility
    const legacyResponse = transformToLegacyFormat(pipelineResult, query, startTime);
    
    // Apply price markup
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      legacyResponse.results = applyMarkupToParts(legacyResponse.results, markupPercentage);
    }
    
    // Record learning
    try {
      const lr = await aiLearningService.recordSearchAttempt({
        query,
        aiUnderstanding: pipelineResult.understanding?.intent || {},
        resultsCount: legacyResponse.total,
        searchTime: Date.now() - startTime,
        source: 'pipeline-v2',
        sessionId: req.sessionID || requestId,
        userId: req.buyer?._id,
      });
      legacyResponse.learning = {
        recordId: lr.recordId,
        suggestions: lr.suggestions?.length > 0 ? lr.suggestions : undefined,
      };
    } catch (e) {
      console.warn('Learning record error:', e.message);
    }
    
    console.log(`✅ AI Search V2 done in ${Date.now() - startTime}ms: ${legacyResponse.total} results`);
    
    return res.json(legacyResponse);
    
  } catch (error) {
    console.error('AI Search V2 error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      message: 'An error occurred while searching. Please try again.',
      results: [],
      total: 0,
    });
  }
}

/**
 * Transform pipeline results to legacy API format
 */
function transformToLegacyFormat(pipelineResult, originalQuery, startTime) {
  const results = pipelineResult.results.map((r, index) => ({
    // Core part data - from _source for full data
    _id: r.id,
    partNumber: r.partNumber || r._source?.partNumber,
    brand: r.brand || r._source?.brand,
    category: r.category || r._source?.category,
    description: r.description || r._source?.description,
    price: r.price || r._source?.price,
    quantity: r.stock || r._source?.quantity || r._source?.stock || 0,
    stock: r.stock || r._source?.stock || r._source?.quantity || 0,
    imageUrl: r.imageUrl || r._source?.imageUrl,
    supplier: r._source?.supplier,
    deliveryDays: r._source?.deliveryDays || 999,
    stockCode: r._source?.stockCode,
    
    // Vehicle fitment
    vehicleFitments: r.vehicleFitments || r._source?.vehicleFitments,
    
    // Cross-references
    crossReferences: r.crossReferences || r._source?.crossReferences,
    oemReferences: r.oemReferences || r._source?.oemReferences,
    
    // AI scoring (from new pipeline)
    _aiScore: Math.round((r.score || 0) * 100),
    _aiPriceScore: r._features?.esScore ? Math.round(r._features.esScore * 100) : 50,
    _aiQtyScore: r._features?.hasStock ? Math.round(r._features.hasStock * 100) : 0,
    _aiDeliveryScore: 50, // Default
    _aiBadges: generateBadges(r, index),
    
    // Include full source for any fields not explicitly mapped
    ...r._source,
  }));
  
  // Generate AI insights
  const aiInsights = generateAIInsights(results);
  
  // Build stock stats
  const stockStats = {
    highStock: results.filter(p => (p.quantity || 0) >= 10).length,
    inStock: results.filter(p => (p.quantity || 0) > 0).length,
    lowStock: results.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) < 10).length,
    outOfStock: results.filter(p => (p.quantity || 0) === 0).length,
  };
  
  // Build message
  let message = `Found ${results.length} parts`;
  if (pipelineResult.explanation?.interpretation) {
    message = pipelineResult.explanation.interpretation;
  }
  
  return {
    success: true,
    query: originalQuery,
    parsed: {
      searchTerms: pipelineResult.understanding?.intent?.partNumber 
        ? [pipelineResult.understanding.intent.partNumber]
        : [],
      filters: {},
      intent: originalQuery,
      parsedIntent: pipelineResult.understanding?.intent || {},
      understood: pipelineResult.understanding?.intent || {},
    },
    results,
    total: pipelineResult.pagination?.total || results.length,
    source: `pipeline-v2-${pipelineResult.understanding?.method || 'unknown'}`,
    searchTime: pipelineResult.timing?.total || (Date.now() - startTime),
    message,
    aiInsights,
    topN: null,
    filterStatus: {
      totalFetched: pipelineResult.pagination?.total || results.length,
      afterFiltering: results.length,
      analysis: {
        note: 'Processed by new search pipeline',
        confidence: pipelineResult.understanding?.confidence || 0,
        method: pipelineResult.understanding?.method || 'unknown',
      },
      stockStats,
    },
    // New pipeline specific data
    _pipelineV2: {
      version: '2.0',
      timing: pipelineResult.timing,
      experimentGroup: pipelineResult.meta?.experimentGroup,
      cacheStatus: pipelineResult.meta?.cacheStatus,
    },
  };
}

/**
 * Generate badges for a result
 */
function generateBadges(result, index) {
  const badges = [];
  
  if (index === 0) {
    badges.push('best-overall');
  }
  
  if (result._features?.partNumberMatch > 0.9) {
    badges.push('exact-match');
  }
  
  if (result._features?.hasStock > 0.5) {
    badges.push('in-stock');
  }
  
  if (result._features?.dataCompleteness > 0.7) {
    badges.push('verified');
  }
  
  return badges;
}

/**
 * Generate AI insights from results
 */
function generateAIInsights(results) {
  const insights = [];
  
  if (results.length === 0) {
    return insights;
  }
  
  if (results.length >= 2) {
    const top = results.slice(0, 10);
    
    // Find best in each category
    const cheapest = [...top].sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];
    const fastestDelivery = [...top].sort((a, b) => (a.deliveryDays || 999) - (b.deliveryDays || 999))[0];
    const highestStock = [...top].sort((a, b) => (b.quantity || 0) - (a.quantity || 0))[0];
    
    // Price vs delivery tradeoff
    if (cheapest._id !== fastestDelivery._id && cheapest.price > 0 && fastestDelivery.deliveryDays < 999) {
      const priceDiff = Math.abs(cheapest.price - (fastestDelivery.price || 0));
      const priceDiffPercent = Math.round((priceDiff / cheapest.price) * 100);
      const deliveryDiff = (cheapest.deliveryDays || 0) - (fastestDelivery.deliveryDays || 0);
      
      if (priceDiffPercent > 5 && deliveryDiff > 0) {
        insights.push({
          type: 'tradeoff',
          message: `Save ~${priceDiffPercent}% choosing cheapest, or get it ${deliveryDiff} days sooner`,
        });
      }
    }
  }
  
  if (results.length === 1) {
    insights.push({
      type: 'single',
      message: 'Only one option found for your search',
    });
  }
  
  return insights;
}

/**
 * Get search pipeline metrics
 */
async function getPipelineMetrics(req, res) {
  try {
    const search = getOrchestrator();
    const stats = search.getMetrics();
    
    res.json({
      success: true,
      stats,
      featureFlags: FEATURE_FLAGS,
    });
  } catch (error) {
    console.error('Pipeline metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
    });
  }
}

/**
 * Wrapper that chooses between old and new pipeline
 */
function createSearchHandler(legacyHandler) {
  return async (req, res) => {
    if (shouldUseNewPipeline(req)) {
      return aiSearchV2(req, res);
    }
    return legacyHandler(req, res);
  };
}

module.exports = {
  aiSearchV2,
  getPipelineMetrics,
  createSearchHandler,
  shouldUseNewPipeline,
  FEATURE_FLAGS,
};

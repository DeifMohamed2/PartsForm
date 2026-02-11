/**
 * Search Orchestrator
 * 
 * Coordinates the 5-stage search pipeline:
 * 1. Query Understanding - Parse intent from user query
 * 2. Retrieval - Get candidates from Elasticsearch
 * 3. Filtering - Apply post-retrieval filters
 * 4. Ranking - Score and sort results
 * 5. Explanation - Generate user-friendly explanations
 * 
 * Features:
 * - Configurable pipeline stages
 * - Metrics collection
 * - Circuit breaker integration
 * - Logging and observability
 */

const { QueryUnderstandingStage, queryUnderstanding } = require('./stages/queryUnderstanding');
const { RetrievalStage, retrievalStage } = require('./stages/retrieval');
const { FilteringStage, filteringStage } = require('./stages/filtering');
const { RankingStage, rankingStage, createRankingStage } = require('./stages/ranking');
const { ExplanationStage, explanationStage } = require('./stages/explanation');
const { searchMetrics } = require('./utils/metrics');
const { cacheService } = require('./utils/cacheService');

// Pipeline configuration
const PIPELINE_CONFIG = {
  stages: {
    understanding: { enabled: true, timeout: 3000 },
    retrieval: { enabled: true, timeout: 5000 },
    filtering: { enabled: true, timeout: 1000 },
    ranking: { enabled: true, timeout: 1000 },
    explanation: { enabled: true, timeout: 500 },
  },
  caching: {
    enabled: true,
    searchResultsTTL: 300, // 5 minutes
  },
  limits: {
    maxResults: 100,
    pageSize: 20,
  },
};

class SearchOrchestrator {
  constructor(options = {}) {
    this.config = { ...PIPELINE_CONFIG, ...options.config };
    
    // Initialize stages
    this.stages = {
      understanding: options.understandingStage || queryUnderstanding,
      retrieval: options.retrievalStage || retrievalStage,
      filtering: options.filteringStage || filteringStage,
      ranking: options.rankingStage || rankingStage,
      explanation: options.explanationStage || explanationStage,
    };
    
    // External services (injected)
    this.geminiService = options.geminiService || null;
    this.elasticsearchService = options.elasticsearchService || null;
    
    // Pipeline hooks for customization
    this.hooks = {
      beforeSearch: options.beforeSearch || null,
      afterUnderstanding: options.afterUnderstanding || null,
      afterRetrieval: options.afterRetrieval || null,
      afterFiltering: options.afterFiltering || null,
      afterRanking: options.afterRanking || null,
      afterSearch: options.afterSearch || null,
    };
  }

  /**
   * Main search entry point
   */
  async search(query, options = {}) {
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metricsContext = searchMetrics.startSearch(requestId);
    
    const searchContext = {
      requestId,
      originalQuery: query,
      options,
      startTime: Date.now(),
      stageResults: {},
    };

    try {
      // Before search hook
      if (this.hooks.beforeSearch) {
        await this.hooks.beforeSearch(searchContext);
      }

      // Check full search cache
      if (this.config.caching.enabled) {
        const cached = await this._checkSearchCache(query, options);
        if (cached) {
          searchMetrics.recordCacheAccess(true);
          return this._formatResponse(cached, searchContext, 'cache');
        }
        searchMetrics.recordCacheAccess(false);
      }

      // Stage 1: Query Understanding
      searchMetrics.recordStage(metricsContext, 'parse');
      const understandingResult = await this._runUnderstanding(query, searchContext);
      searchMetrics.recordStage(metricsContext, 'parse', {
        method: understandingResult.method,
        confidence: understandingResult.intent?.confidence,
      });
      
      if (this.hooks.afterUnderstanding) {
        await this.hooks.afterUnderstanding(understandingResult, searchContext);
      }

      // Stage 2: Retrieval
      searchMetrics.recordStage(metricsContext, 'retrieval');
      const retrievalResult = await this._runRetrieval(understandingResult.intent, searchContext);
      searchMetrics.recordStage(metricsContext, 'retrieval', {
        source: retrievalResult.strategy,
        candidateCount: retrievalResult.count,
      });
      
      if (this.hooks.afterRetrieval) {
        await this.hooks.afterRetrieval(retrievalResult, searchContext);
      }

      // Stage 3: Filtering
      searchMetrics.recordStage(metricsContext, 'filter');
      const filteringResult = await this._runFiltering(
        retrievalResult.candidates,
        understandingResult.intent,
        searchContext
      );
      searchMetrics.recordStage(metricsContext, 'filter', {
        preCount: filteringResult.preFilterCount,
        postCount: filteringResult.count,
        applied: filteringResult.filtersApplied,
      });
      
      if (this.hooks.afterFiltering) {
        await this.hooks.afterFiltering(filteringResult, searchContext);
      }

      // Stage 4: Ranking
      searchMetrics.recordStage(metricsContext, 'rank');
      const rankingResult = await this._runRanking(
        filteringResult.candidates,
        understandingResult.intent,
        searchContext
      );
      searchMetrics.recordStage(metricsContext, 'rank', {
        method: rankingResult.experimentGroup,
        weights: rankingResult.weights,
      });
      
      if (this.hooks.afterRanking) {
        await this.hooks.afterRanking(rankingResult, searchContext);
      }

      // Stage 5: Explanation
      const explanationResult = await this._runExplanation(
        rankingResult.candidates,
        understandingResult.intent,
        searchContext
      );

      // Build final response
      const response = this._buildResponse(
        query,
        understandingResult,
        rankingResult,
        explanationResult,
        searchContext,
        options
      );

      // Cache the response
      if (this.config.caching.enabled) {
        await this._cacheSearchResult(query, options, response);
      }

      // Record metrics
      searchMetrics.recordSearch(metricsContext, {
        success: true,
        query,
        resultCount: response.results.length,
        topResultIds: response.results.slice(0, 5).map(r => r.id),
      });

      // After search hook
      if (this.hooks.afterSearch) {
        await this.hooks.afterSearch(response, searchContext);
      }

      return response;

    } catch (error) {
      console.error('Search orchestration error:', error);
      
      // Record failed search
      searchMetrics.recordSearch(metricsContext, {
        success: false,
        query,
        resultCount: 0,
      });
      
      return this._errorResponse(query, error, searchContext);
    }
  }

  /**
   * Run query understanding stage
   */
  async _runUnderstanding(query, context) {
    if (!this.config.stages.understanding.enabled) {
      return {
        success: true,
        intent: { searchType: 'general', confidence: 0.5 },
        method: 'disabled',
      };
    }

    // Set Gemini service if available
    if (this.geminiService) {
      this.stages.understanding.setGeminiService(this.geminiService);
    }

    return await this.stages.understanding.understand(query, {
      requestId: context.requestId,
    });
  }

  /**
   * Run retrieval stage
   */
  async _runRetrieval(intent, context) {
    if (!this.config.stages.retrieval.enabled) {
      return { success: true, candidates: [], count: 0, strategy: 'disabled' };
    }

    // Set ES service if available
    if (this.elasticsearchService) {
      this.stages.retrieval.setElasticsearchService(this.elasticsearchService);
    }

    return await this.stages.retrieval.retrieve(intent, {
      requestId: context.requestId,
    });
  }

  /**
   * Run filtering stage
   */
  async _runFiltering(candidates, intent, context) {
    if (!this.config.stages.filtering.enabled) {
      return {
        success: true,
        candidates,
        count: candidates.length,
        preFilterCount: candidates.length,
        filtersApplied: [],
      };
    }

    return await this.stages.filtering.filter(candidates, intent, {
      requestId: context.requestId,
    });
  }

  /**
   * Run ranking stage
   */
  async _runRanking(candidates, intent, context) {
    if (!this.config.stages.ranking.enabled) {
      return {
        success: true,
        candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, rankScore: c.score })),
        count: candidates.length,
        weights: {},
      };
    }

    return await this.stages.ranking.rank(candidates, intent, {
      requestId: context.requestId,
    });
  }

  /**
   * Run explanation stage
   */
  async _runExplanation(candidates, intent, context) {
    if (!this.config.stages.explanation.enabled) {
      return {
        success: true,
        interpretation: '',
        resultExplanations: [],
        suggestions: [],
      };
    }

    // Set Gemini service if available
    if (this.geminiService) {
      this.stages.explanation.setGeminiService(this.geminiService);
    }

    return await this.stages.explanation.explain(candidates, intent, {
      requestId: context.requestId,
      originalQuery: context.originalQuery,
    });
  }

  /**
   * Build the final API response
   */
  _buildResponse(query, understanding, ranking, explanation, context, options) {
    const { page = 1, limit = this.config.limits.pageSize } = options;
    const offset = (page - 1) * limit;
    
    // Paginate results
    const totalResults = ranking.candidates.length;
    const paginatedCandidates = ranking.candidates.slice(offset, offset + limit);
    
    // Transform to response format
    const results = paginatedCandidates.map(candidate => ({
      id: candidate.id,
      rank: candidate.rank,
      score: candidate.rankScore,
      
      // Part data
      partNumber: candidate.source.partNumber,
      brand: candidate.source.brand,
      category: candidate.source.category,
      description: candidate.source.description,
      price: candidate.source.price,
      stock: candidate.source.stock,
      imageUrl: candidate.source.imageUrl,
      
      // Vehicle fitment
      vehicleFitments: candidate.source.vehicleFitments,
      
      // Cross-references
      crossReferences: candidate.source.crossReferences,
      oemReferences: candidate.source.oemReferences,
      
      // Full source for backward compatibility
      _source: candidate.source,
      
      // Ranking explanation (for debugging/transparency)
      _features: candidate.features,
    }));
    
    return {
      success: true,
      query,
      
      // Search understanding
      understanding: {
        intent: understanding.intent,
        method: understanding.method,
        confidence: understanding.intent?.confidence || 0,
        searchType: understanding.intent?.searchType || 'general',
      },
      
      // Explanation for UI
      explanation: {
        interpretation: explanation.interpretation,
        suggestions: explanation.suggestions,
      },
      
      // Results
      results,
      
      // Pagination
      pagination: {
        page,
        limit,
        total: totalResults,
        totalPages: Math.ceil(totalResults / limit),
        hasMore: offset + limit < totalResults,
      },
      
      // Timing
      timing: {
        total: Date.now() - context.startTime,
        understanding: understanding.durationMs,
        retrieval: context.stageResults.retrieval?.durationMs,
        filtering: context.stageResults.filtering?.durationMs,
        ranking: ranking.durationMs,
        explanation: explanation.durationMs,
      },
      
      // Meta
      meta: {
        requestId: context.requestId,
        experimentGroup: ranking.experimentGroup,
        cacheStatus: 'miss',
      },
    };
  }

  /**
   * Format cached response
   */
  _formatResponse(cached, context, cacheStatus) {
    return {
      ...cached,
      timing: {
        total: Date.now() - context.startTime,
      },
      meta: {
        ...cached.meta,
        requestId: context.requestId,
        cacheStatus,
      },
    };
  }

  /**
   * Error response
   */
  _errorResponse(query, error, context) {
    return {
      success: false,
      query,
      error: error.message,
      errorCode: error.code || 'SEARCH_ERROR',
      results: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      timing: { total: Date.now() - context.startTime },
      meta: { requestId: context.requestId },
    };
  }

  /**
   * Check search results cache
   */
  async _checkSearchCache(query, options) {
    try {
      const cacheKey = this._buildCacheKey(query, options);
      return await cacheService.getSearchResults(cacheKey);
    } catch {
      return null;
    }
  }

  /**
   * Cache search results
   */
  async _cacheSearchResult(query, options, response) {
    try {
      const cacheKey = this._buildCacheKey(query, options);
      await cacheService.cacheSearchResults(cacheKey, response);
    } catch (error) {
      console.warn('Failed to cache search result:', error.message);
    }
  }

  /**
   * Build cache key from query and options
   */
  _buildCacheKey(query, options) {
    const normalized = query.toLowerCase().trim();
    const optionsHash = JSON.stringify({
      page: options.page || 1,
      limit: options.limit || 20,
      filters: options.filters || {},
    });
    return `search:${normalized}:${optionsHash}`;
  }

  /**
   * Set Gemini service for all stages
   */
  setGeminiService(service) {
    this.geminiService = service;
    this.stages.understanding.setGeminiService?.(service);
    this.stages.explanation.setGeminiService?.(service);
  }

  /**
   * Set Elasticsearch service
   */
  setElasticsearchService(service) {
    this.elasticsearchService = service;
    this.stages.retrieval.setElasticsearchService?.(service);
  }

  /**
   * Set ranking experiment group
   */
  setExperimentGroup(group) {
    this.stages.ranking = createRankingStage(group);
  }

  /**
   * Get pipeline metrics
   */
  getMetrics() {
    return searchMetrics.getStats();
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    searchMetrics.reset();
  }
}

// Factory function for creating orchestrator with services
function createSearchOrchestrator(options = {}) {
  const orchestrator = new SearchOrchestrator(options);
  
  if (options.geminiService) {
    orchestrator.setGeminiService(options.geminiService);
  }
  
  if (options.elasticsearchService) {
    orchestrator.setElasticsearchService(options.elasticsearchService);
  }
  
  return orchestrator;
}

// Singleton instance (services need to be injected)
const searchOrchestrator = new SearchOrchestrator();

module.exports = {
  SearchOrchestrator,
  searchOrchestrator,
  createSearchOrchestrator,
  PIPELINE_CONFIG,
};

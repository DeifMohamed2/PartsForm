/**
 * Search Service - Main Export
 * 
 * Production-grade AI-powered search pipeline for automotive parts.
 * 
 * Architecture:
 * - 5-stage pipeline: Understanding → Retrieval → Filtering → Ranking → Explanation
 * - Token-based parsing with LLM enhancement
 * - Learning-to-Rank scoring
 * - Multi-tier caching (L1 in-process, L2 Redis)
 * - Circuit breakers for fault tolerance
 * - Comprehensive metrics and observability
 * 
 * Usage:
 * ```javascript
 * const { createSearchOrchestrator } = require('./services/search');
 * 
 * const search = createSearchOrchestrator({
 *   geminiService: require('./services/geminiService'),
 *   elasticsearchService: require('./services/elasticsearchService'),
 * });
 * 
 * const results = await search.search('brake pads for 2019 toyota camry');
 * ```
 */

// Main orchestrator
const { 
  SearchOrchestrator, 
  searchOrchestrator, 
  createSearchOrchestrator,
  PIPELINE_CONFIG,
} = require('./orchestrator');

// Pipeline stages
const { QueryUnderstandingStage, queryUnderstanding } = require('./stages/queryUnderstanding');
const { RetrievalStage, retrievalStage } = require('./stages/retrieval');
const { FilteringStage, filteringStage } = require('./stages/filtering');
const { RankingStage, rankingStage, createRankingStage, DEFAULT_WEIGHTS } = require('./stages/ranking');
const { ExplanationStage, explanationStage } = require('./stages/explanation');

// Parsers
const { TokenParser, tokenParser, PATTERNS } = require('./parsers/tokenParser');
const { 
  SchemaValidator, 
  strictValidator, 
  lenientValidator, 
  VALID_VALUES,
} = require('./parsers/schemaValidator');

// Utilities
const { CircuitBreaker, circuitBreakers, CircuitState } = require('./utils/circuitBreaker');
const { CacheService, cacheService, LRUCache } = require('./utils/cacheService');
const { SearchMetrics, searchMetrics } = require('./utils/metrics');

module.exports = {
  // Main API
  SearchOrchestrator,
  searchOrchestrator,
  createSearchOrchestrator,
  PIPELINE_CONFIG,
  
  // Pipeline stages (for testing/customization)
  stages: {
    QueryUnderstandingStage,
    queryUnderstanding,
    RetrievalStage,
    retrievalStage,
    FilteringStage,
    filteringStage,
    RankingStage,
    rankingStage,
    createRankingStage,
    ExplanationStage,
    explanationStage,
    DEFAULT_WEIGHTS,
  },
  
  // Parsers (for testing/customization)
  parsers: {
    TokenParser,
    tokenParser,
    PATTERNS,
    SchemaValidator,
    strictValidator,
    lenientValidator,
    VALID_VALUES,
  },
  
  // Utilities
  utils: {
    CircuitBreaker,
    circuitBreakers,
    CircuitState,
    CacheService,
    cacheService,
    LRUCache,
    SearchMetrics,
    searchMetrics,
  },
};

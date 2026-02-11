/**
 * Search Metrics Service - Observability & Evaluation
 * 
 * Tracks search quality metrics including:
 * - Query understanding accuracy
 * - Retrieval performance
 * - Ranking quality (MRR, NDCG)
 * - End-to-end latency
 * - User engagement (clicks, purchases)
 */

class SearchMetrics {
  constructor() {
    // Counters
    this.counters = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      zeroResultSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      llmCalls: 0,
      llmFallbacks: 0,
      clicks: new Map(), // position -> count
      purchases: 0,
    };
    
    // Histograms (buckets for latency tracking)
    this.histograms = {
      parseLatency: [],
      retrievalLatency: [],
      filterLatency: [],
      rankLatency: [],
      totalLatency: [],
    };
    
    // Gauges (current values)
    this.gauges = {
      avgMRR: 0,
      avgNDCG10: 0,
      avgResultCount: 0,
    };
    
    // Rolling window for quality metrics
    this.recentSearches = []; // Last 1000 searches
    this.maxRecentSearches = 1000;
    
    // Click tracking for MRR/NDCG calculation
    this.sessionClicks = new Map(); // sessionId -> click data
    this.sessionTTL = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Record the start of a search request
   */
  startSearch(requestId) {
    return {
      requestId,
      startTime: Date.now(),
      stages: {},
    };
  }

  /**
   * Record stage timing
   */
  recordStage(context, stageName, data = {}) {
    if (!context.stages[stageName]) {
      context.stages[stageName] = {
        startTime: Date.now(),
        ...data,
      };
    } else {
      context.stages[stageName].endTime = Date.now();
      context.stages[stageName].duration = 
        context.stages[stageName].endTime - context.stages[stageName].startTime;
      Object.assign(context.stages[stageName], data);
    }
  }

  /**
   * Record completed search with all metrics
   */
  recordSearch(context, result) {
    const endTime = Date.now();
    const totalDuration = endTime - context.startTime;
    
    // Update counters
    this.counters.totalSearches++;
    
    if (result.success) {
      this.counters.successfulSearches++;
    } else {
      this.counters.failedSearches++;
    }
    
    if (result.resultCount === 0) {
      this.counters.zeroResultSearches++;
    }
    
    // Record latencies
    this.histograms.totalLatency.push(totalDuration);
    
    if (context.stages.parse?.duration) {
      this.histograms.parseLatency.push(context.stages.parse.duration);
    }
    if (context.stages.retrieval?.duration) {
      this.histograms.retrievalLatency.push(context.stages.retrieval.duration);
    }
    if (context.stages.filter?.duration) {
      this.histograms.filterLatency.push(context.stages.filter.duration);
    }
    if (context.stages.rank?.duration) {
      this.histograms.rankLatency.push(context.stages.rank.duration);
    }
    
    // Keep histograms bounded
    const maxHistogramSize = 10000;
    for (const key of Object.keys(this.histograms)) {
      if (this.histograms[key].length > maxHistogramSize) {
        this.histograms[key] = this.histograms[key].slice(-maxHistogramSize);
      }
    }
    
    // Store for quality analysis
    const searchRecord = {
      requestId: context.requestId,
      timestamp: endTime,
      query: result.query,
      parseMethod: context.stages.parse?.method || 'unknown',
      parseConfidence: context.stages.parse?.confidence || 0,
      resultCount: result.resultCount || 0,
      totalDuration,
      stages: context.stages,
      topResultIds: result.topResultIds || [],
    };
    
    this.recentSearches.push(searchRecord);
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches.shift();
    }
    
    // Update gauges
    this._updateGauges();
    
    return searchRecord;
  }

  /**
   * Record a click event
   */
  recordClick(sessionId, requestId, partId, position) {
    // Update position click counter
    const posKey = Math.min(position, 20).toString();
    this.counters.clicks.set(posKey, (this.counters.clicks.get(posKey) || 0) + 1);
    
    // Store for MRR calculation
    if (!this.sessionClicks.has(sessionId)) {
      this.sessionClicks.set(sessionId, {
        clicks: [],
        createdAt: Date.now(),
      });
    }
    
    this.sessionClicks.get(sessionId).clicks.push({
      requestId,
      partId,
      position,
      timestamp: Date.now(),
    });
    
    // Clean old sessions
    this._cleanOldSessions();
    
    // Recalculate MRR
    this._calculateMRR();
  }

  /**
   * Record a purchase
   */
  recordPurchase(sessionId, partId) {
    this.counters.purchases++;
    
    if (this.sessionClicks.has(sessionId)) {
      const session = this.sessionClicks.get(sessionId);
      session.purchased = true;
      session.purchasedPartId = partId;
    }
  }

  /**
   * Record LLM usage
   */
  recordLLMCall(success = true) {
    this.counters.llmCalls++;
    if (!success) {
      this.counters.llmFallbacks++;
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheAccess(hit) {
    if (hit) {
      this.counters.cacheHits++;
    } else {
      this.counters.cacheMisses++;
    }
  }

  /**
   * Calculate percentiles from histogram
   */
  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Update gauge metrics
   */
  _updateGauges() {
    // Average result count
    if (this.recentSearches.length > 0) {
      const totalResults = this.recentSearches.reduce((sum, s) => sum + s.resultCount, 0);
      this.gauges.avgResultCount = Math.round(totalResults / this.recentSearches.length);
    }
  }

  /**
   * Calculate Mean Reciprocal Rank from click data
   */
  _calculateMRR() {
    const clickData = Array.from(this.sessionClicks.values());
    if (clickData.length === 0) return;
    
    let mrrSum = 0;
    let count = 0;
    
    for (const session of clickData) {
      if (session.clicks.length > 0) {
        // Use first click position for MRR
        const firstClick = session.clicks[0];
        mrrSum += 1 / firstClick.position;
        count++;
      }
    }
    
    this.gauges.avgMRR = count > 0 ? mrrSum / count : 0;
  }

  /**
   * Calculate NDCG@10 (requires relevance scores from clicks/purchases)
   */
  calculateNDCG(rankedResults, relevanceScores, k = 10) {
    // relevanceScores: Map<partId, score> where score = 0 (not relevant), 1 (clicked), 3 (purchased)
    
    // Calculate DCG
    let dcg = 0;
    for (let i = 0; i < Math.min(k, rankedResults.length); i++) {
      const partId = rankedResults[i];
      const relevance = relevanceScores.get(partId) || 0;
      dcg += relevance / Math.log2(i + 2); // +2 because position is 1-indexed
    }
    
    // Calculate IDCG (ideal DCG)
    const sortedRelevances = Array.from(relevanceScores.values())
      .sort((a, b) => b - a)
      .slice(0, k);
    
    let idcg = 0;
    for (let i = 0; i < sortedRelevances.length; i++) {
      idcg += sortedRelevances[i] / Math.log2(i + 2);
    }
    
    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * Clean old session data
   */
  _cleanOldSessions() {
    const now = Date.now();
    for (const [sessionId, data] of this.sessionClicks) {
      if (now - data.createdAt > this.sessionTTL) {
        this.sessionClicks.delete(sessionId);
      }
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const total = this.counters.totalSearches;
    const cacheTotal = this.counters.cacheHits + this.counters.cacheMisses;
    
    return {
      counters: {
        totalSearches: total,
        successRate: total > 0 ? ((this.counters.successfulSearches / total) * 100).toFixed(1) + '%' : 'N/A',
        zeroResultRate: total > 0 ? ((this.counters.zeroResultSearches / total) * 100).toFixed(1) + '%' : 'N/A',
        cacheHitRate: cacheTotal > 0 ? ((this.counters.cacheHits / cacheTotal) * 100).toFixed(1) + '%' : 'N/A',
        llmFallbackRate: this.counters.llmCalls > 0 
          ? ((this.counters.llmFallbacks / this.counters.llmCalls) * 100).toFixed(1) + '%' 
          : 'N/A',
        purchases: this.counters.purchases,
      },
      latency: {
        parse: {
          p50: this._percentile(this.histograms.parseLatency, 50),
          p95: this._percentile(this.histograms.parseLatency, 95),
          p99: this._percentile(this.histograms.parseLatency, 99),
        },
        retrieval: {
          p50: this._percentile(this.histograms.retrievalLatency, 50),
          p95: this._percentile(this.histograms.retrievalLatency, 95),
          p99: this._percentile(this.histograms.retrievalLatency, 99),
        },
        total: {
          p50: this._percentile(this.histograms.totalLatency, 50),
          p95: this._percentile(this.histograms.totalLatency, 95),
          p99: this._percentile(this.histograms.totalLatency, 99),
        },
      },
      quality: {
        mrr: this.gauges.avgMRR.toFixed(3),
        avgResultCount: this.gauges.avgResultCount,
        clicksByPosition: Object.fromEntries(this.counters.clicks),
      },
      sampleSize: {
        recent: this.recentSearches.length,
        sessions: this.sessionClicks.size,
      },
    };
  }

  /**
   * Generate a search log entry for persistence
   */
  createLogEntry(context, result, intent) {
    return {
      requestId: context.requestId,
      timestamp: new Date(),
      
      // Query understanding
      rawQuery: result.query,
      parsedIntent: intent,
      parseMethod: context.stages.parse?.method || 'unknown',
      parseTimeMs: context.stages.parse?.duration || 0,
      parseConfidence: context.stages.parse?.confidence || 0,
      
      // Retrieval
      retrievalSource: context.stages.retrieval?.source || 'unknown',
      candidateCount: context.stages.retrieval?.candidateCount || 0,
      retrievalTimeMs: context.stages.retrieval?.duration || 0,
      
      // Filtering
      preFilterCount: context.stages.filter?.preCount || 0,
      postFilterCount: context.stages.filter?.postCount || 0,
      filtersApplied: context.stages.filter?.applied || [],
      filterTimeMs: context.stages.filter?.duration || 0,
      
      // Ranking
      rankingMethod: context.stages.rank?.method || 'unknown',
      weights: context.stages.rank?.weights || {},
      rankTimeMs: context.stages.rank?.duration || 0,
      
      // Results
      resultCount: result.resultCount || 0,
      topResultId: result.topResultIds?.[0] || null,
      topResultScore: result.topResultScores?.[0] || null,
      totalTimeMs: Date.now() - context.startTime,
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      zeroResultSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      llmCalls: 0,
      llmFallbacks: 0,
      clicks: new Map(),
      purchases: 0,
    };
    
    this.histograms = {
      parseLatency: [],
      retrievalLatency: [],
      filterLatency: [],
      rankLatency: [],
      totalLatency: [],
    };
    
    this.gauges = {
      avgMRR: 0,
      avgNDCG10: 0,
      avgResultCount: 0,
    };
    
    this.recentSearches = [];
    this.sessionClicks.clear();
    
    console.log('📊 Search metrics reset');
  }
}

// Singleton instance
const searchMetrics = new SearchMetrics();

module.exports = {
  SearchMetrics,
  searchMetrics,
};

/**
 * Stage 2: Retrieval
 * 
 * Retrieves candidate parts from Elasticsearch using the parsed intent.
 * Implements multiple retrieval strategies:
 * 1. Exact match (part numbers)
 * 2. Multi-field search (categories, brands)
 * 3. Fuzzy matching (typo tolerance)
 * 4. Cross-reference lookup
 */

const { circuitBreakers } = require('../utils/circuitBreaker');
const { cacheService } = require('../utils/cacheService');
const { searchMetrics } = require('../utils/metrics');

// Retrieval configuration
const CONFIG = {
  maxCandidates: 500,     // Maximum candidates to retrieve
  fuzzyMaxEdits: 1,       // Max edit distance for fuzzy matching
  minScore: 0.3,          // Minimum relevance score to include
  timeout: 5000,          // ES query timeout
  boostExact: 10,         // Boost for exact matches
  boostPartNumber: 8,     // Boost for part number matches
  boostBrand: 3,          // Boost for brand matches
  boostCategory: 2,       // Boost for category matches
};

class RetrievalStage {
  constructor(options = {}) {
    this.esService = options.elasticsearchService || null;
    this.config = { ...CONFIG, ...options.config };
  }

  /**
   * Main retrieval method
   */
  async retrieve(intent, context = {}) {
    const startTime = Date.now();
    
    if (!this.esService) {
      return this._emptyResult('Elasticsearch service not configured');
    }

    try {
      // Determine retrieval strategy
      const strategy = this._selectStrategy(intent);
      
      // Execute retrieval with circuit breaker
      const candidates = await circuitBreakers.elasticsearch.execute(async () => {
        switch (strategy) {
          case 'exactPartNumber':
            return await this._retrieveByExactPartNumber(intent);
          
          case 'fuzzyPartNumber':
            return await this._retrieveByFuzzyPartNumber(intent);
          
          case 'crossReference':
            return await this._retrieveByCrossReference(intent);
          
          case 'fitment':
            return await this._retrieveByFitment(intent);
          
          case 'catalogBrowse':
            return await this._retrieveByCatalog(intent);
          
          case 'multiField':
          default:
            return await this._retrieveMultiField(intent);
        }
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        candidates,
        count: candidates.length,
        strategy,
        durationMs: duration,
      };

    } catch (error) {
      console.error('Retrieval error:', error);
      return this._emptyResult(error.message);
    }
  }

  /**
   * Select appropriate retrieval strategy based on intent
   */
  _selectStrategy(intent) {
    // Part number search - try exact first
    if (intent.partNumber) {
      return 'exactPartNumber';
    }

    // Cross-reference lookup
    if (intent.crossReference) {
      return 'crossReference';
    }

    // Fitment search (vehicle + category)
    if (intent.vehicleMake && intent.category) {
      return 'fitment';
    }

    // Catalog browse (brand + category)
    if (intent.brand?.length > 0 && intent.category) {
      return 'catalogBrowse';
    }

    // Default to multi-field search
    return 'multiField';
  }

  /**
   * Exact part number retrieval
   */
  async _retrieveByExactPartNumber(intent) {
    const partNumber = intent.partNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Check cache first
    const cacheKey = `part:${partNumber}`;
    const cached = await cacheService.getPartResults(cacheKey);
    if (cached) {
      searchMetrics.recordCacheAccess(true);
      return cached;
    }
    searchMetrics.recordCacheAccess(false);

    // Build exact + partial match query
    const query = {
      bool: {
        should: [
          // Exact match (highest priority)
          {
            term: {
              'partNumber.keyword': {
                value: intent.partNumber.toUpperCase(),
                boost: this.config.boostExact,
              },
            },
          },
          // Normalized match (no separators)
          {
            term: {
              'partNumberNormalized': {
                value: partNumber,
                boost: this.config.boostPartNumber,
              },
            },
          },
          // Prefix match
          {
            prefix: {
              'partNumber.keyword': {
                value: intent.partNumber.toUpperCase().substring(0, 6),
                boost: 2,
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    };

    const results = await this._executeQuery(query, this.config.maxCandidates);
    
    // If no results, fall back to fuzzy
    if (results.length === 0) {
      return await this._retrieveByFuzzyPartNumber(intent);
    }

    // Cache results
    if (results.length > 0) {
      await cacheService.cachePartResults(cacheKey, results);
    }

    return results;
  }

  /**
   * Fuzzy part number retrieval (for typos)
   */
  async _retrieveByFuzzyPartNumber(intent) {
    const query = {
      bool: {
        should: [
          {
            fuzzy: {
              'partNumber.keyword': {
                value: intent.partNumber.toUpperCase(),
                fuzziness: this.config.fuzzyMaxEdits,
                prefix_length: 2,
                boost: this.config.boostPartNumber,
              },
            },
          },
          // Also try ngram match
          {
            match: {
              'partNumber.ngram': {
                query: intent.partNumber,
                boost: 1,
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    };

    return await this._executeQuery(query, this.config.maxCandidates);
  }

  /**
   * Cross-reference retrieval
   */
  async _retrieveByCrossReference(intent) {
    const xref = intent.crossReference.toUpperCase();

    const query = {
      bool: {
        should: [
          // Search in cross-references array
          {
            term: {
              'crossReferences.keyword': {
                value: xref,
                boost: this.config.boostExact,
              },
            },
          },
          // Also search in OEM references
          {
            term: {
              'oemReferences.keyword': {
                value: xref,
                boost: this.config.boostPartNumber,
              },
            },
          },
          // Search in superseded part numbers
          {
            term: {
              'supersededBy.keyword': {
                value: xref,
                boost: this.config.boostPartNumber,
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    };

    return await this._executeQuery(query, this.config.maxCandidates);
  }

  /**
   * Fitment-based retrieval (vehicle compatibility)
   */
  async _retrieveByFitment(intent) {
    const must = [];
    const should = [];

    // Category filter (must match)
    if (intent.category) {
      must.push({
        match: {
          'category': {
            query: intent.category,
            boost: this.config.boostCategory,
          },
        },
      });
    }

    // Vehicle make (must match)
    if (intent.vehicleMake) {
      must.push({
        match: {
          'vehicleFitments.make': {
            query: intent.vehicleMake,
            boost: 2,
          },
        },
      });
    }

    // Vehicle model (should match if provided)
    if (intent.vehicleModel) {
      should.push({
        match: {
          'vehicleFitments.model': {
            query: intent.vehicleModel,
            boost: 3,
          },
        },
      });
    }

    // Vehicle year (should match if provided)
    if (intent.vehicleYear) {
      should.push({
        range: {
          'vehicleFitments.yearFrom': {
            lte: intent.vehicleYear,
          },
        },
      });
      should.push({
        range: {
          'vehicleFitments.yearTo': {
            gte: intent.vehicleYear,
          },
        },
      });
    }

    // Brand filter (if provided)
    if (intent.brand?.length > 0) {
      should.push({
        terms: {
          'brand.keyword': intent.brand,
          boost: this.config.boostBrand,
        },
      });
    }

    // Position filter
    if (intent.position?.length > 0) {
      should.push({
        terms: {
          'position.keyword': intent.position,
          boost: 1.5,
        },
      });
    }

    const query = {
      bool: {
        must,
        should,
        minimum_should_match: should.length > 0 ? 1 : 0,
      },
    };

    return await this._executeQuery(query, this.config.maxCandidates);
  }

  /**
   * Catalog browse retrieval (brand + category)
   */
  async _retrieveByCatalog(intent) {
    const must = [];
    const should = [];

    // Brand filter (must match one of the brands)
    if (intent.brand?.length > 0) {
      must.push({
        terms: {
          'brand.keyword': intent.brand,
          boost: this.config.boostBrand,
        },
      });
    }

    // Category filter
    if (intent.category) {
      must.push({
        match: {
          'category': {
            query: intent.category,
            boost: this.config.boostCategory,
          },
        },
      });
    }

    // Optional: vehicle compatibility
    if (intent.vehicleMake) {
      should.push({
        match: {
          'vehicleFitments.make': {
            query: intent.vehicleMake,
            boost: 1.5,
          },
        },
      });
    }

    const query = {
      bool: {
        must,
        should,
      },
    };

    return await this._executeQuery(query, this.config.maxCandidates);
  }

  /**
   * Multi-field general retrieval
   */
  async _retrieveMultiField(intent) {
    const should = [];

    // Search across multiple fields
    const searchTerms = [];
    
    if (intent.category) searchTerms.push(intent.category);
    if (intent.brand?.length > 0) searchTerms.push(...intent.brand);
    if (intent.vehicleMake) searchTerms.push(intent.vehicleMake);
    if (intent.vehicleModel) searchTerms.push(intent.vehicleModel);
    
    const queryString = searchTerms.join(' ');

    if (queryString) {
      // Multi-match across common fields
      should.push({
        multi_match: {
          query: queryString,
          fields: [
            'partNumber^3',
            'description^2',
            'category^2',
            'brand^2',
            'specifications',
            'vehicleFitments.make',
            'vehicleFitments.model',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Part number if present
    if (intent.partNumber) {
      should.push({
        match: {
          'partNumber': {
            query: intent.partNumber,
            boost: this.config.boostPartNumber,
          },
        },
      });
    }

    // If no search terms, return empty
    if (should.length === 0) {
      return [];
    }

    const query = {
      bool: {
        should,
        minimum_should_match: 1,
      },
    };

    return await this._executeQuery(query, this.config.maxCandidates);
  }

  /**
   * Execute Elasticsearch query
   */
  async _executeQuery(query, size) {
    try {
      const response = await this.esService.search({
        index: 'parts',
        body: {
          query,
          size,
          min_score: this.config.minScore,
          _source: true,
          timeout: `${this.config.timeout}ms`,
        },
      });

      // Transform hits to candidates
      return response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        source: hit._source,
      }));

    } catch (error) {
      console.error('ES query error:', error);
      throw error;
    }
  }

  /**
   * Empty result for error cases
   */
  _emptyResult(reason) {
    return {
      success: false,
      candidates: [],
      count: 0,
      strategy: 'none',
      durationMs: 0,
      error: reason,
    };
  }

  /**
   * Set Elasticsearch service (dependency injection)
   */
  setElasticsearchService(service) {
    this.esService = service;
  }
}

// Singleton instance
const retrievalStage = new RetrievalStage();

module.exports = {
  RetrievalStage,
  retrievalStage,
  CONFIG,
};

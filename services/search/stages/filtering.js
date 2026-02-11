/**
 * Stage 3: Filtering
 * 
 * Post-retrieval filtering to refine candidate results.
 * Applies filters that couldn't be efficiently handled in ES:
 * 1. Complex attribute matching
 * 2. Business rules (availability, pricing)
 * 3. User preferences
 * 4. Quality gates
 */

const { searchMetrics } = require('../utils/metrics');

// Filter configuration
const CONFIG = {
  maxResults: 200,              // Maximum filtered results
  minQualityScore: 0.1,         // Minimum quality threshold
  stockPriority: true,          // Prioritize in-stock items
  priceRangeBuffer: 0.1,        // 10% buffer for price ranges
};

// Quality indicators  
const QUALITY_WEIGHTS = {
  hasImage: 0.1,
  hasDescription: 0.1,
  hasSpecifications: 0.15,
  hasStock: 0.2,
  hasPrice: 0.15,
  hasCrossReference: 0.1,
  hasVehicleFitment: 0.2,
};

class FilteringStage {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options.config };
  }

  /**
   * Main filtering method
   */
  async filter(candidates, intent, context = {}) {
    const startTime = Date.now();
    
    if (!candidates || candidates.length === 0) {
      return this._emptyResult('No candidates to filter');
    }

    try {
      // Track pre-filter count
      const preFilterCount = candidates.length;
      let filtered = [...candidates];

      // Step 1: Apply hard filters (must match)
      filtered = this._applyHardFilters(filtered, intent);

      // Step 2: Apply soft filters (should match, affects ranking)
      filtered = this._applySoftFilters(filtered, intent);

      // Step 3: Calculate quality scores
      filtered = this._calculateQualityScores(filtered);

      // Step 4: Apply quality gate
      filtered = this._applyQualityGate(filtered);

      // Step 5: Apply business rules
      filtered = this._applyBusinessRules(filtered, context);

      // Step 6: Limit results
      filtered = filtered.slice(0, this.config.maxResults);

      const duration = Date.now() - startTime;

      return {
        success: true,
        candidates: filtered,
        count: filtered.length,
        preFilterCount,
        filtersApplied: this._getAppliedFilters(intent),
        durationMs: duration,
      };

    } catch (error) {
      console.error('Filtering error:', error);
      return this._emptyResult(error.message);
    }
  }

  /**
   * Hard filters - candidates must pass these to be included
   */
  _applyHardFilters(candidates, intent) {
    return candidates.filter(candidate => {
      const part = candidate.source;
      
      // Brand filter (exact match required if specified)
      if (intent.brand?.length > 0) {
        const partBrand = (part.brand || '').toLowerCase();
        const matchesBrand = intent.brand.some(b => 
          partBrand.includes(b.toLowerCase()) || 
          b.toLowerCase().includes(partBrand)
        );
        if (!matchesBrand) return false;
      }

      // Category filter (fuzzy match)
      if (intent.category) {
        const partCategory = (part.category || '').toLowerCase();
        const intentCategory = intent.category.toLowerCase();
        // Allow partial matches
        if (!partCategory.includes(intentCategory) && 
            !intentCategory.includes(partCategory)) {
          return false;
        }
      }

      // Vehicle year filter
      if (intent.vehicleYear && part.vehicleFitments?.length > 0) {
        const fitsYear = part.vehicleFitments.some(fit => {
          const yearFrom = fit.yearFrom || 1900;
          const yearTo = fit.yearTo || 2100;
          return intent.vehicleYear >= yearFrom && intent.vehicleYear <= yearTo;
        });
        if (!fitsYear) return false;
      }

      // Position filter
      if (intent.position?.length > 0 && part.position) {
        const partPos = (part.position || '').toLowerCase();
        const matchesPosition = intent.position.some(p => 
          partPos.includes(p.toLowerCase())
        );
        if (!matchesPosition) return false;
      }

      return true;
    });
  }

  /**
   * Soft filters - boost/penalize score based on preference match
   */
  _applySoftFilters(candidates, intent) {
    return candidates.map(candidate => {
      const part = candidate.source;
      let softScore = 0;
      let softFactors = [];

      // Vehicle make match
      if (intent.vehicleMake && part.vehicleFitments?.length > 0) {
        const matchesMake = part.vehicleFitments.some(fit => 
          (fit.make || '').toLowerCase().includes(intent.vehicleMake.toLowerCase())
        );
        if (matchesMake) {
          softScore += 0.2;
          softFactors.push('vehicleMake');
        }
      }

      // Vehicle model match
      if (intent.vehicleModel && part.vehicleFitments?.length > 0) {
        const matchesModel = part.vehicleFitments.some(fit => 
          (fit.model || '').toLowerCase().includes(intent.vehicleModel.toLowerCase())
        );
        if (matchesModel) {
          softScore += 0.15;
          softFactors.push('vehicleModel');
        }
      }

      // Engine code match
      if (intent.engineCode && part.engineCodes?.length > 0) {
        const matchesEngine = part.engineCodes.some(ec => 
          ec.toUpperCase() === intent.engineCode.toUpperCase()
        );
        if (matchesEngine) {
          softScore += 0.15;
          softFactors.push('engineCode');
        }
      }

      // Part number exact match bonus
      if (intent.partNumber) {
        const partNum = (part.partNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const intentNum = intent.partNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (partNum === intentNum) {
          softScore += 0.3;
          softFactors.push('exactPartNumber');
        }
      }

      return {
        ...candidate,
        softScore,
        softFactors,
      };
    });
  }

  /**
   * Calculate data quality scores for each candidate
   */
  _calculateQualityScores(candidates) {
    return candidates.map(candidate => {
      const part = candidate.source;
      let qualityScore = 0;

      // Check each quality indicator
      if (part.imageUrl || part.images?.length > 0) {
        qualityScore += QUALITY_WEIGHTS.hasImage;
      }
      
      if (part.description && part.description.length > 20) {
        qualityScore += QUALITY_WEIGHTS.hasDescription;
      }
      
      if (part.specifications && Object.keys(part.specifications).length > 0) {
        qualityScore += QUALITY_WEIGHTS.hasSpecifications;
      }
      
      if (part.stock > 0 || part.inStock === true) {
        qualityScore += QUALITY_WEIGHTS.hasStock;
      }
      
      if (part.price > 0 || part.prices?.length > 0) {
        qualityScore += QUALITY_WEIGHTS.hasPrice;
      }
      
      if (part.crossReferences?.length > 0 || part.oemReferences?.length > 0) {
        qualityScore += QUALITY_WEIGHTS.hasCrossReference;
      }
      
      if (part.vehicleFitments?.length > 0) {
        qualityScore += QUALITY_WEIGHTS.hasVehicleFitment;
      }

      return {
        ...candidate,
        qualityScore,
      };
    });
  }

  /**
   * Quality gate - remove very low quality results
   */
  _applyQualityGate(candidates) {
    // Only apply gate if we have enough results
    if (candidates.length <= 10) {
      return candidates;
    }

    return candidates.filter(c => c.qualityScore >= this.config.minQualityScore);
  }

  /**
   * Apply business rules
   */
  _applyBusinessRules(candidates, context) {
    // Sort by composite score
    candidates.sort((a, b) => {
      // Calculate composite scores
      const scoreA = this._calculateCompositeScore(a);
      const scoreB = this._calculateCompositeScore(b);
      return scoreB - scoreA;
    });

    // Apply stock priority if configured
    if (this.config.stockPriority) {
      candidates = this._prioritizeInStock(candidates);
    }

    return candidates;
  }

  /**
   * Calculate composite score for sorting
   */
  _calculateCompositeScore(candidate) {
    // Weighted combination of scores
    const esScore = candidate.score || 0;
    const softScore = candidate.softScore || 0;
    const qualityScore = candidate.qualityScore || 0;

    // Normalize ES score (typically 0-10+)
    const normalizedES = Math.min(esScore / 10, 1);

    // Composite: 50% ES relevance, 30% soft filters, 20% quality
    return (normalizedES * 0.5) + (softScore * 0.3) + (qualityScore * 0.2);
  }

  /**
   * Prioritize in-stock items while maintaining relevance
   */
  _prioritizeInStock(candidates) {
    const inStock = [];
    const outOfStock = [];

    for (const candidate of candidates) {
      const part = candidate.source;
      if (part.stock > 0 || part.inStock === true) {
        inStock.push(candidate);
      } else {
        outOfStock.push(candidate);
      }
    }

    // Return in-stock items first, then out-of-stock
    return [...inStock, ...outOfStock];
  }

  /**
   * Get list of applied filters for reporting
   */
  _getAppliedFilters(intent) {
    const applied = [];
    
    if (intent.brand?.length > 0) applied.push('brand');
    if (intent.category) applied.push('category');
    if (intent.vehicleMake) applied.push('vehicleMake');
    if (intent.vehicleModel) applied.push('vehicleModel');
    if (intent.vehicleYear) applied.push('vehicleYear');
    if (intent.position?.length > 0) applied.push('position');
    if (intent.engineCode) applied.push('engineCode');

    return applied;
  }

  /**
   * Empty result for error cases
   */
  _emptyResult(reason) {
    return {
      success: false,
      candidates: [],
      count: 0,
      preFilterCount: 0,
      filtersApplied: [],
      durationMs: 0,
      error: reason,
    };
  }

  /**
   * Filter by price range (utility method)
   */
  filterByPriceRange(candidates, minPrice, maxPrice) {
    const buffer = this.config.priceRangeBuffer;
    const adjustedMin = minPrice * (1 - buffer);
    const adjustedMax = maxPrice * (1 + buffer);

    return candidates.filter(c => {
      const price = c.source.price || c.source.prices?.[0]?.value || 0;
      return price >= adjustedMin && price <= adjustedMax;
    });
  }

  /**
   * Filter by availability (utility method) 
   */
  filterByAvailability(candidates, requireInStock = true) {
    if (!requireInStock) return candidates;

    return candidates.filter(c => {
      const part = c.source;
      return part.stock > 0 || part.inStock === true;
    });
  }
}

// Singleton instance
const filteringStage = new FilteringStage();

module.exports = {
  FilteringStage,
  filteringStage,
  CONFIG,
  QUALITY_WEIGHTS,
};

/**
 * Stage 4: Ranking
 * 
 * Learning-to-Rank inspired scoring system that combines:
 * 1. Text relevance (from Elasticsearch)
 * 2. Intent match scores
 * 3. Data quality signals
 * 4. Historical engagement (clicks, purchases)
 * 5. Business rules
 * 
 * Supports:
 * - Feature-based scoring with learned weights
 * - A/B testing different ranking models
 * - Personalization hooks
 */

const { searchMetrics } = require('../utils/metrics');

// Default scoring weights (can be learned from user behavior)
const DEFAULT_WEIGHTS = {
  // Text relevance features
  esScore: 0.25,              // Elasticsearch BM25 score
  partNumberMatch: 0.15,       // Exact/fuzzy part number match
  
  // Intent match features
  categoryMatch: 0.12,         // Category alignment
  brandMatch: 0.10,            // Brand preference match
  vehicleFitment: 0.12,        // Vehicle compatibility
  
  // Quality features
  dataCompleteness: 0.08,      // How complete the listing is
  hasImage: 0.03,              // Has product image
  hasStock: 0.05,              // Is in stock
  
  // Engagement features (from learning)
  clickRate: 0.05,             // Historical click-through rate
  purchaseRate: 0.03,          // Historical purchase rate
  
  // Recency feature
  freshness: 0.02,             // Recently updated/added
};

// Feature extraction utilities
const FEATURE_EXTRACTORS = {
  /**
   * Normalize Elasticsearch score to 0-1 range
   */
  normalizeESScore: (score, maxScore) => {
    if (!score || maxScore === 0) return 0;
    return Math.min(score / maxScore, 1);
  },

  /**
   * Calculate part number match score
   */
  partNumberMatchScore: (candidate, intent) => {
    if (!intent.partNumber) return 0;
    
    const partNum = (candidate.source.partNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const intentNum = intent.partNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Exact match
    if (partNum === intentNum) return 1.0;
    
    // Prefix match
    if (partNum.startsWith(intentNum) || intentNum.startsWith(partNum)) {
      const matchLen = Math.min(partNum.length, intentNum.length);
      const maxLen = Math.max(partNum.length, intentNum.length);
      return matchLen / maxLen;
    }
    
    // Containment match
    if (partNum.includes(intentNum) || intentNum.includes(partNum)) {
      return 0.5;
    }
    
    return 0;
  },

  /**
   * Calculate category match score
   */
  categoryMatchScore: (candidate, intent) => {
    if (!intent.category) return 0.5; // Neutral if no category intent
    
    const partCat = (candidate.source.category || '').toLowerCase();
    const intentCat = intent.category.toLowerCase();
    
    // Exact match
    if (partCat === intentCat) return 1.0;
    
    // One contains the other
    if (partCat.includes(intentCat) || intentCat.includes(partCat)) {
      return 0.8;
    }
    
    return 0;
  },

  /**
   * Calculate brand match score
   */
  brandMatchScore: (candidate, intent) => {
    if (!intent.brand || intent.brand.length === 0) return 0.5;
    
    const partBrand = (candidate.source.brand || '').toLowerCase();
    
    for (const brand of intent.brand) {
      const intentBrand = brand.toLowerCase();
      if (partBrand === intentBrand) return 1.0;
      if (partBrand.includes(intentBrand) || intentBrand.includes(partBrand)) {
        return 0.8;
      }
    }
    
    return 0;
  },

  /**
   * Calculate vehicle fitment score
   */
  vehicleFitmentScore: (candidate, intent) => {
    const fitments = candidate.source.vehicleFitments || [];
    if (fitments.length === 0) return 0.3; // Partial credit for universal parts
    
    let score = 0;
    let factors = 0;
    
    // Check make
    if (intent.vehicleMake) {
      factors++;
      const makeMatch = fitments.some(f => 
        (f.make || '').toLowerCase().includes(intent.vehicleMake.toLowerCase())
      );
      if (makeMatch) score += 0.4;
    }
    
    // Check model
    if (intent.vehicleModel) {
      factors++;
      const modelMatch = fitments.some(f => 
        (f.model || '').toLowerCase().includes(intent.vehicleModel.toLowerCase())
      );
      if (modelMatch) score += 0.3;
    }
    
    // Check year
    if (intent.vehicleYear) {
      factors++;
      const yearMatch = fitments.some(f => {
        const from = f.yearFrom || 1900;
        const to = f.yearTo || 2100;
        return intent.vehicleYear >= from && intent.vehicleYear <= to;
      });
      if (yearMatch) score += 0.3;
    }
    
    return factors === 0 ? 0.5 : score;
  },

  /**
   * Calculate data completeness score
   */
  dataCompletenessScore: (candidate) => {
    const part = candidate.source;
    let score = 0;
    
    if (part.partNumber) score += 0.15;
    if (part.description && part.description.length > 20) score += 0.15;
    if (part.brand) score += 0.1;
    if (part.category) score += 0.1;
    if (part.price > 0 || part.prices?.length > 0) score += 0.15;
    if (part.specifications && Object.keys(part.specifications).length > 0) score += 0.15;
    if (part.vehicleFitments?.length > 0) score += 0.1;
    if (part.crossReferences?.length > 0) score += 0.1;
    
    return Math.min(score, 1);
  },

  /**
   * Has image indicator
   */
  hasImageScore: (candidate) => {
    const part = candidate.source;
    return (part.imageUrl || part.images?.length > 0) ? 1 : 0;
  },

  /**
   * Has stock indicator
   */
  hasStockScore: (candidate) => {
    const part = candidate.source;
    if (part.stock > 10) return 1.0;
    if (part.stock > 0 || part.inStock === true) return 0.7;
    return 0;
  },

  /**
   * Historical engagement scores (placeholder - to be connected to analytics)
   */
  clickRateScore: (candidate, learningData) => {
    // This would pull from historical click-through rate data
    // For now, return 0.5 (neutral)
    if (!learningData) return 0.5;
    
    const partId = candidate.id;
    return learningData.clickRates?.get(partId) || 0.5;
  },

  purchaseRateScore: (candidate, learningData) => {
    // This would pull from historical conversion rate data
    if (!learningData) return 0.5;
    
    const partId = candidate.id;
    return learningData.purchaseRates?.get(partId) || 0.5;
  },

  /**
   * Freshness score based on last update
   */
  freshnessScore: (candidate) => {
    const part = candidate.source;
    if (!part.updatedAt) return 0.5;
    
    const now = Date.now();
    const updated = new Date(part.updatedAt).getTime();
    const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);
    
    // Decay function: 1.0 for same day, decays to 0.2 over 180 days
    return Math.max(0.2, 1 - (daysSinceUpdate / 180) * 0.8);
  },
};

class RankingStage {
  constructor(options = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    this.learningData = options.learningData || null;
    this.experimentGroup = options.experimentGroup || 'control';
  }

  /**
   * Main ranking method
   */
  async rank(candidates, intent, context = {}) {
    const startTime = Date.now();
    
    if (!candidates || candidates.length === 0) {
      return this._emptyResult('No candidates to rank');
    }

    try {
      // Find max ES score for normalization
      const maxESScore = Math.max(...candidates.map(c => c.score || 0), 1);

      // Calculate features and scores for each candidate
      const scored = candidates.map(candidate => {
        const features = this._extractFeatures(candidate, intent, maxESScore);
        const score = this._calculateScore(features);
        
        return {
          ...candidate,
          features,
          rankScore: score,
        };
      });

      // Sort by rank score (descending)
      scored.sort((a, b) => b.rankScore - a.rankScore);

      // Add rank positions
      scored.forEach((item, index) => {
        item.rank = index + 1;
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        candidates: scored,
        count: scored.length,
        weights: this.weights,
        experimentGroup: this.experimentGroup,
        durationMs: duration,
      };

    } catch (error) {
      console.error('Ranking error:', error);
      return this._emptyResult(error.message);
    }
  }

  /**
   * Extract all features for a candidate
   */
  _extractFeatures(candidate, intent, maxESScore) {
    return {
      // Text relevance
      esScore: FEATURE_EXTRACTORS.normalizeESScore(candidate.score, maxESScore),
      partNumberMatch: FEATURE_EXTRACTORS.partNumberMatchScore(candidate, intent),
      
      // Intent match
      categoryMatch: FEATURE_EXTRACTORS.categoryMatchScore(candidate, intent),
      brandMatch: FEATURE_EXTRACTORS.brandMatchScore(candidate, intent),
      vehicleFitment: FEATURE_EXTRACTORS.vehicleFitmentScore(candidate, intent),
      
      // Quality
      dataCompleteness: FEATURE_EXTRACTORS.dataCompletenessScore(candidate),
      hasImage: FEATURE_EXTRACTORS.hasImageScore(candidate),
      hasStock: FEATURE_EXTRACTORS.hasStockScore(candidate),
      
      // Engagement
      clickRate: FEATURE_EXTRACTORS.clickRateScore(candidate, this.learningData),
      purchaseRate: FEATURE_EXTRACTORS.purchaseRateScore(candidate, this.learningData),
      
      // Recency
      freshness: FEATURE_EXTRACTORS.freshnessScore(candidate),
      
      // Carry through existing scores
      softScore: candidate.softScore || 0,
      qualityScore: candidate.qualityScore || 0,
    };
  }

  /**
   * Calculate weighted score from features
   */
  _calculateScore(features) {
    let score = 0;
    
    for (const [feature, weight] of Object.entries(this.weights)) {
      if (features[feature] !== undefined) {
        score += features[feature] * weight;
      }
    }
    
    // Boost with soft and quality scores from filtering stage
    score += features.softScore * 0.1;
    score += features.qualityScore * 0.05;
    
    return score;
  }

  /**
   * Update weights based on learning signal
   */
  updateWeights(learningSignals) {
    // Simple online learning: gradient step based on click feedback
    // In production, this would use more sophisticated LtR algorithms
    
    for (const signal of learningSignals) {
      const { feature, direction, magnitude } = signal;
      
      if (this.weights[feature] !== undefined) {
        const learningRate = 0.01;
        this.weights[feature] += direction * magnitude * learningRate;
        
        // Clamp weights to reasonable range
        this.weights[feature] = Math.max(0, Math.min(1, this.weights[feature]));
      }
    }
    
    // Normalize weights to sum to ~1
    const total = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      for (const key of Object.keys(this.weights)) {
        this.weights[key] /= total;
      }
    }
  }

  /**
   * Set A/B experiment group
   */
  setExperimentGroup(group, weights = null) {
    this.experimentGroup = group;
    if (weights) {
      this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    }
  }

  /**
   * Set learning data for engagement features
   */
  setLearningData(data) {
    this.learningData = data;
  }

  /**
   * Get explainability info for a ranking decision
   */
  explainRanking(candidate) {
    const features = candidate.features;
    const weights = this.weights;
    
    if (!features) {
      return { explanation: 'No features available' };
    }

    const contributions = [];
    let totalScore = 0;
    
    for (const [feature, weight] of Object.entries(weights)) {
      if (features[feature] !== undefined) {
        const contribution = features[feature] * weight;
        totalScore += contribution;
        contributions.push({
          feature,
          value: features[feature],
          weight,
          contribution,
          percentage: 0, // Will be calculated below
        });
      }
    }
    
    // Calculate percentages
    for (const c of contributions) {
      c.percentage = totalScore > 0 ? (c.contribution / totalScore) * 100 : 0;
    }
    
    // Sort by contribution
    contributions.sort((a, b) => b.contribution - a.contribution);
    
    // Build explanation
    const topFactors = contributions.slice(0, 3);
    const explanation = topFactors
      .map(c => `${c.feature}: ${(c.percentage).toFixed(0)}%`)
      .join(', ');
    
    return {
      totalScore,
      contributions,
      topFactors,
      explanation: `Ranked by: ${explanation}`,
    };
  }

  /**
   * Empty result for error cases
   */
  _emptyResult(reason) {
    return {
      success: false,
      candidates: [],
      count: 0,
      weights: this.weights,
      experimentGroup: this.experimentGroup,
      durationMs: 0,
      error: reason,
    };
  }
}

// Factory for creating ranking instances with different weights (A/B testing)
function createRankingStage(experimentGroup = 'control') {
  const experimentWeights = {
    control: DEFAULT_WEIGHTS,
    
    // Experiment: emphasize relevance
    relevance_heavy: {
      ...DEFAULT_WEIGHTS,
      esScore: 0.35,
      partNumberMatch: 0.20,
      categoryMatch: 0.15,
    },
    
    // Experiment: emphasize quality
    quality_heavy: {
      ...DEFAULT_WEIGHTS,
      dataCompleteness: 0.15,
      hasImage: 0.08,
      hasStock: 0.12,
    },
    
    // Experiment: emphasize engagement
    engagement_heavy: {
      ...DEFAULT_WEIGHTS,
      clickRate: 0.15,
      purchaseRate: 0.10,
    },
  };
  
  return new RankingStage({
    weights: experimentWeights[experimentGroup] || DEFAULT_WEIGHTS,
    experimentGroup,
  });
}

// Singleton instance (default control group)
const rankingStage = new RankingStage();

module.exports = {
  RankingStage,
  rankingStage,
  createRankingStage,
  DEFAULT_WEIGHTS,
  FEATURE_EXTRACTORS,
};

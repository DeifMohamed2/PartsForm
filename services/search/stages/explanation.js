/**
 * Stage 5: Explanation
 * 
 * Generates user-friendly explanations for search results:
 * 1. Search interpretation ("We searched for...")
 * 2. Match explanations ("Found because...")
 * 3. Filter suggestions ("Try narrowing by...")
 * 4. Cross-sell recommendations
 */

const { circuitBreakers } = require('../utils/circuitBreaker');

// Templates for explanations
const TEMPLATES = {
  // Search interpretation templates
  searchInterpretation: {
    partNumber: 'Searching for part number "{partNumber}"',
    fitment: 'Showing {category} for {year} {make} {model}',
    catalog: 'Showing {brand} {category}',
    general: 'Showing results for "{query}"',
  },
  
  // Match explanation templates
  matchReasons: {
    exactPartNumber: 'Exact part number match',
    partialPartNumber: 'Part number contains "{partNumber}"',
    brandMatch: 'Matches brand: {brand}',
    categoryMatch: 'Category: {category}',
    vehicleFit: 'Fits {year} {make} {model}',
    crossReference: 'Cross-references {originalPart}',
    highQuality: 'Complete product data',
    inStock: 'In stock and ready to ship',
    popularItem: 'Popular choice',
  },
  
  // Filter suggestions
  filterSuggestions: {
    noResults: [
      'Try searching with fewer filters',
      'Check the spelling of the part number',
      'Search by category instead of part number',
    ],
    tooManyResults: [
      'Filter by vehicle make and model',
      'Select a specific brand',
      'Narrow down by position (front/rear)',
    ],
    refinement: [
      'Add vehicle year for better fitment',
      'Specify left or right side',
      'Filter by price range',
    ],
  },
};

class ExplanationStage {
  constructor(options = {}) {
    this.geminiService = options.geminiService || null;
    this.useLLM = options.useLLM !== false;
    this.maxExplanations = options.maxExplanations || 5;
  }

  /**
   * Generate explanations for search results
   */
  async explain(candidates, intent, context = {}) {
    const startTime = Date.now();
    
    try {
      const results = {
        // Overall search interpretation
        interpretation: this._generateInterpretation(intent, context.originalQuery),
        
        // Individual result explanations
        resultExplanations: this._generateResultExplanations(candidates, intent),
        
        // Filter suggestions based on result count
        suggestions: this._generateSuggestions(candidates, intent),
        
        // Meta information
        meta: {
          totalResults: candidates.length,
          searchType: intent.searchType,
          confidence: intent.confidence,
        },
        
        durationMs: 0,
      };
      
      results.durationMs = Date.now() - startTime;
      return { success: true, ...results };

    } catch (error) {
      console.error('Explanation error:', error);
      return {
        success: false,
        interpretation: 'Search completed',
        resultExplanations: [],
        suggestions: [],
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate search interpretation message
   */
  _generateInterpretation(intent, originalQuery) {
    switch (intent.searchType) {
      case 'partNumber':
        return this._fillTemplate(TEMPLATES.searchInterpretation.partNumber, {
          partNumber: intent.partNumber,
        });
        
      case 'fitment':
        return this._fillTemplate(TEMPLATES.searchInterpretation.fitment, {
          category: intent.category || 'parts',
          year: intent.vehicleYear || '',
          make: intent.vehicleMake || '',
          model: intent.vehicleModel || '',
        });
        
      case 'catalog':
        return this._fillTemplate(TEMPLATES.searchInterpretation.catalog, {
          brand: intent.brand?.[0] || '',
          category: intent.category || 'products',
        });
        
      default:
        return this._fillTemplate(TEMPLATES.searchInterpretation.general, {
          query: originalQuery || 'your search',
        });
    }
  }

  /**
   * Generate explanations for each result
   */
  _generateResultExplanations(candidates, intent) {
    return candidates.slice(0, this.maxExplanations).map((candidate, index) => {
      const reasons = this._getMatchReasons(candidate, intent);
      const highlights = this._getHighlights(candidate, intent);
      const explanation = this._rankingToExplanation(candidate);
      
      return {
        rank: index + 1,
        id: candidate.id,
        reasons,
        highlights,
        explanation,
      };
    });
  }

  /**
   * Get match reasons for a result
   */
  _getMatchReasons(candidate, intent) {
    const reasons = [];
    const part = candidate.source;
    const features = candidate.features || {};
    
    // Part number match
    if (intent.partNumber && features.partNumberMatch > 0.9) {
      reasons.push({
        type: 'exactPartNumber',
        text: TEMPLATES.matchReasons.exactPartNumber,
        weight: 'high',
      });
    } else if (intent.partNumber && features.partNumberMatch > 0.5) {
      reasons.push({
        type: 'partialPartNumber',
        text: this._fillTemplate(TEMPLATES.matchReasons.partialPartNumber, {
          partNumber: intent.partNumber,
        }),
        weight: 'medium',
      });
    }
    
    // Brand match
    if (intent.brand?.length > 0 && features.brandMatch > 0.7) {
      reasons.push({
        type: 'brandMatch',
        text: this._fillTemplate(TEMPLATES.matchReasons.brandMatch, {
          brand: part.brand,
        }),
        weight: 'high',
      });
    }
    
    // Category match
    if (intent.category && features.categoryMatch > 0.7) {
      reasons.push({
        type: 'categoryMatch',
        text: this._fillTemplate(TEMPLATES.matchReasons.categoryMatch, {
          category: part.category,
        }),
        weight: 'medium',
      });
    }
    
    // Vehicle fitment
    if ((intent.vehicleMake || intent.vehicleModel) && features.vehicleFitment > 0.5) {
      reasons.push({
        type: 'vehicleFit',
        text: this._fillTemplate(TEMPLATES.matchReasons.vehicleFit, {
          year: intent.vehicleYear || '',
          make: intent.vehicleMake || '',
          model: intent.vehicleModel || '',
        }),
        weight: 'high',
      });
    }
    
    // Cross-reference
    if (part.crossReferences?.length > 0 || part.oemReferences?.length > 0) {
      reasons.push({
        type: 'crossReference',
        text: this._fillTemplate(TEMPLATES.matchReasons.crossReference, {
          originalPart: part.crossReferences?.[0] || part.oemReferences?.[0],
        }),
        weight: 'medium',
      });
    }
    
    // Quality indicator
    if (features.dataCompleteness > 0.7) {
      reasons.push({
        type: 'highQuality',
        text: TEMPLATES.matchReasons.highQuality,
        weight: 'low',
      });
    }
    
    // Stock availability
    if (features.hasStock > 0.5) {
      reasons.push({
        type: 'inStock',
        text: TEMPLATES.matchReasons.inStock,
        weight: 'medium',
      });
    }
    
    // Limit to top 3 reasons
    return reasons.slice(0, 3);
  }

  /**
   * Get text highlights for search terms
   */
  _getHighlights(candidate, intent) {
    const highlights = [];
    const part = candidate.source;
    
    // Highlight part number match
    if (intent.partNumber && part.partNumber) {
      const matched = this._findMatch(part.partNumber, intent.partNumber);
      if (matched) {
        highlights.push({
          field: 'partNumber',
          text: part.partNumber,
          matchPosition: matched,
        });
      }
    }
    
    // Highlight in description
    if (part.description) {
      const searchTerms = [
        intent.category,
        intent.brand?.[0],
        intent.vehicleMake,
        intent.vehicleModel,
      ].filter(Boolean);
      
      for (const term of searchTerms) {
        const matched = this._findMatch(part.description, term);
        if (matched) {
          highlights.push({
            field: 'description',
            text: part.description.substring(
              Math.max(0, matched.start - 30),
              Math.min(part.description.length, matched.end + 30)
            ),
            matchPosition: matched,
          });
          break; // One description highlight is enough
        }
      }
    }
    
    return highlights;
  }

  /**
   * Convert ranking features to human-readable explanation
   */
  _rankingToExplanation(candidate) {
    const features = candidate.features;
    if (!features) return null;
    
    // Find top contributing factors
    const factors = [];
    
    if (features.esScore > 0.7) factors.push('high relevance');
    if (features.partNumberMatch > 0.8) factors.push('part number match');
    if (features.brandMatch > 0.8) factors.push('brand match');
    if (features.vehicleFitment > 0.7) factors.push('fits your vehicle');
    if (features.hasStock > 0.5) factors.push('in stock');
    
    if (factors.length === 0) return null;
    
    return `Ranked highly because: ${factors.join(', ')}`;
  }

  /**
   * Generate filter suggestions
   */
  _generateSuggestions(candidates, intent) {
    const suggestions = [];
    
    // No results case
    if (candidates.length === 0) {
      suggestions.push(...TEMPLATES.filterSuggestions.noResults.map(text => ({
        type: 'noResults',
        text,
      })));
      return suggestions;
    }
    
    // Too many results case
    if (candidates.length > 100) {
      // Suggest filters based on what's not already applied
      if (!intent.vehicleMake) {
        suggestions.push({
          type: 'addFilter',
          text: 'Filter by vehicle make and model',
          filter: 'vehicle',
        });
      }
      
      if (!intent.brand || intent.brand.length === 0) {
        suggestions.push({
          type: 'addFilter',
          text: 'Select a specific brand',
          filter: 'brand',
        });
      }
      
      if (!intent.position || intent.position.length === 0) {
        suggestions.push({
          type: 'addFilter',
          text: 'Specify position (front/rear/left/right)',
          filter: 'position',
        });
      }
    }
    
    // Refinement suggestions
    if (candidates.length > 20 && candidates.length <= 100) {
      if (intent.vehicleMake && !intent.vehicleYear) {
        suggestions.push({
          type: 'refine',
          text: 'Add vehicle year for better fitment matching',
          filter: 'year',
        });
      }
    }
    
    // Related category suggestion
    if (intent.category && candidates.length > 0) {
      const relatedCategories = this._getRelatedCategories(intent.category);
      if (relatedCategories.length > 0) {
        suggestions.push({
          type: 'related',
          text: `You might also need: ${relatedCategories.join(', ')}`,
          categories: relatedCategories,
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Get related categories for cross-sell
   */
  _getRelatedCategories(category) {
    const relatedMap = {
      'brake pad': ['brake disc', 'brake caliper'],
      'brake disc': ['brake pad', 'wheel bearing'],
      'oil filter': ['air filter', 'fuel filter', 'engine oil'],
      'air filter': ['cabin filter', 'spark plug'],
      'spark plug': ['ignition coil', 'plug wire'],
      'timing belt': ['water pump', 'tensioner'],
      'clutch': ['clutch disc', 'flywheel'],
      'water pump': ['thermostat', 'coolant'],
    };
    
    const lowerCat = category.toLowerCase();
    return relatedMap[lowerCat] || [];
  }

  /**
   * Find position of a match in text
   */
  _findMatch(text, searchTerm) {
    if (!text || !searchTerm) return null;
    
    const lowerText = text.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    const index = lowerText.indexOf(lowerTerm);
    if (index === -1) return null;
    
    return {
      start: index,
      end: index + searchTerm.length,
    };
  }

  /**
   * Fill template with values
   */
  _fillTemplate(template, values) {
    let result = template;
    
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    
    // Clean up extra spaces from empty values
    return result.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate LLM-powered natural language explanation (optional)
   */
  async generateNaturalExplanation(candidates, intent, originalQuery) {
    if (!this.useLLM || !this.geminiService || candidates.length === 0) {
      return null;
    }

    try {
      const topResult = candidates[0];
      const resultSummary = {
        partNumber: topResult.source.partNumber,
        brand: topResult.source.brand,
        category: topResult.source.category,
        count: candidates.length,
      };

      const prompt = `Generate a brief (1-2 sentences) natural language explanation for these search results.

Query: "${originalQuery}"
Understood as: ${JSON.stringify(intent, null, 2)}
Top result: ${JSON.stringify(resultSummary)}
Total results: ${candidates.length}

Explanation:`;

      const response = await circuitBreakers.llm.execute(async () => {
        return await this.geminiService.generateContent({
          prompt,
          config: { maxTokens: 100, temperature: 0.3 },
          timeout: 2000,
        });
      });

      return response?.trim() || null;

    } catch (error) {
      console.warn('Natural explanation generation failed:', error.message);
      return null;
    }
  }

  /**
   * Set Gemini service for LLM explanations
   */
  setGeminiService(service) {
    this.geminiService = service;
  }
}

// Singleton instance
const explanationStage = new ExplanationStage();

module.exports = {
  ExplanationStage,
  explanationStage,
  TEMPLATES,
};

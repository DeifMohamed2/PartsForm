/**
 * Stage 1: Query Understanding
 * 
 * Transforms raw user queries into structured search intents using:
 * 1. Token-based parsing (fast, deterministic)
 * 2. LLM parsing (for complex/ambiguous queries)
 * 3. Cache lookup (for repeated queries)
 * 
 * This stage replaces the monolithic parsing in geminiService.js with
 * a modular, testable approach.
 */

const { tokenParser } = require('../parsers/tokenParser');
const { strictValidator, lenientValidator } = require('../parsers/schemaValidator');
const { cacheService } = require('../utils/cacheService');
const { circuitBreakers } = require('../utils/circuitBreaker');
const { searchMetrics } = require('../utils/metrics');

// LLM configuration for query understanding
const LLM_CONFIG = {
  model: 'gemini-2.0-flash',
  maxTokens: 1024,
  temperature: 0.1, // Low temperature for consistent parsing
  timeout: 3000, // 3 seconds max
};

// System prompt for LLM-based query understanding
const QUERY_UNDERSTANDING_PROMPT = `You are an automotive parts search query parser. Extract structured search intent from user queries.

IMPORTANT RULES:
1. Extract ONLY information explicitly stated in the query
2. Do NOT infer or hallucinate values not present
3. Return null for any field without explicit evidence
4. Part numbers have specific patterns (letters+numbers, with dashes/dots)
5. Be conservative - when uncertain, leave fields null

OUTPUT FORMAT (JSON):
{
  "partNumber": "string or null - exact part number if found",
  "crossReference": "string or null - cross-reference number if mentioned",
  "category": "string or null - product category (filter, brake pad, sensor, etc.)",
  "brand": ["array of strings or null - brand names mentioned"],
  "vehicleMake": "string or null - vehicle manufacturer",
  "vehicleModel": "string or null - vehicle model name",
  "vehicleYear": "number or null - specific year",
  "engineCode": "string or null - engine code if mentioned",
  "position": ["array or null - front/rear/left/right positions"],
  "searchType": "partNumber|fitment|catalog|general",
  "confidence": 0.0-1.0
}

EXAMPLES:

Query: "04152-YZZA1"
Output: {"partNumber": "04152-YZZA1", "searchType": "partNumber", "confidence": 0.95}

Query: "brake pads for 2019 Toyota Camry"
Output: {"category": "brake pad", "vehicleMake": "Toyota", "vehicleModel": "Camry", "vehicleYear": 2019, "searchType": "fitment", "confidence": 0.9}

Query: "Bosch oil filter"
Output: {"category": "oil filter", "brand": ["Bosch"], "searchType": "catalog", "confidence": 0.85}

Query: "front left wheel bearing"
Output: {"category": "wheel bearing", "position": ["front", "left"], "searchType": "general", "confidence": 0.8}`;

class QueryUnderstandingStage {
  constructor(options = {}) {
    this.geminiService = options.geminiService || null;
    this.useCache = options.useCache !== false;
    this.useLLM = options.useLLM !== false;
    this.llmThreshold = options.llmThreshold || 0.6; // Confidence threshold to skip LLM
  }

  /**
   * Main entry point - understand the query
   */
  async understand(query, context = {}) {
    const startTime = Date.now();
    
    // Validate input
    if (!query || typeof query !== 'string') {
      return this._emptyIntent('Invalid query input');
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return this._emptyIntent('Empty query');
    }

    context.requestId = context.requestId || `req_${Date.now()}`;

    try {
      // Step 1: Check cache
      if (this.useCache) {
        const cached = await this._checkCache(normalizedQuery);
        if (cached) {
          searchMetrics.recordCacheAccess(true);
          return this._createResult(cached, 'cache', Date.now() - startTime);
        }
        searchMetrics.recordCacheAccess(false);
      }

      // Step 2: Token-based parsing (always runs, fast)
      const tokenResult = this._parseWithTokens(normalizedQuery);
      
      // Step 3: LLM enhancement (if token confidence is low and LLM is available)
      let finalIntent = tokenResult.intent;
      let method = 'token';

      if (this._shouldUseLLM(tokenResult)) {
        const llmResult = await this._parseWithLLM(normalizedQuery, tokenResult.intent);
        if (llmResult.success) {
          // Merge token and LLM results, preferring LLM for complex fields
          finalIntent = this._mergeIntents(tokenResult.intent, llmResult.intent);
          method = 'hybrid';
          searchMetrics.recordLLMCall(true);
        } else {
          searchMetrics.recordLLMCall(false);
        }
      }

      // Step 4: Validate final intent
      const validated = this._validateIntent(finalIntent);

      // Step 5: Cache for future requests
      if (this.useCache && validated.confidence >= 0.5) {
        await cacheService.cacheIntent(normalizedQuery, validated);
      }

      return this._createResult(validated, method, Date.now() - startTime);

    } catch (error) {
      console.error('QueryUnderstanding error:', error);
      
      // Return token result as fallback
      const fallback = this._parseWithTokens(normalizedQuery);
      return this._createResult(
        fallback.intent,
        'token-fallback',
        Date.now() - startTime,
        error.message
      );
    }
  }

  /**
   * Check cache for existing parsed intent
   */
  async _checkCache(query) {
    try {
      return await cacheService.getIntent(query);
    } catch (error) {
      console.warn('Cache check failed:', error.message);
      return null;
    }
  }

  /**
   * Parse query using token-based parser
   */
  _parseWithTokens(query) {
    const result = tokenParser.parse(query);
    
    return {
      intent: {
        partNumber: result.partNumbers[0]?.value || null,
        category: result.categories[0]?.value || null,
        brand: result.brands.map(b => b.value),
        vehicleMake: result.vehicle?.make || null,
        vehicleModel: result.vehicle?.model || null,
        vehicleYear: result.vehicle?.year || null,
        position: result.position,
        searchType: result.searchType,
        confidence: result.confidence,
        
        // Additional data for downstream stages
        _raw: {
          partNumbers: result.partNumbers,
          categories: result.categories,
          brands: result.brands,
          vehicle: result.vehicle,
          engine: result.engine,
          size: result.size,
        },
      },
      confidence: result.confidence,
    };
  }

  /**
   * Determine if LLM should be used
   */
  _shouldUseLLM(tokenResult) {
    // Don't use LLM if disabled
    if (!this.useLLM || !this.geminiService) {
      return false;
    }

    // Don't use LLM if token parsing is confident
    if (tokenResult.confidence >= this.llmThreshold) {
      return false;
    }

    // Don't use LLM if circuit breaker is open
    if (!circuitBreakers.llm.canExecute()) {
      return false;
    }

    // Don't use LLM for very short queries (likely part numbers)
    if (tokenResult.intent.partNumber && tokenResult.confidence >= 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Parse query using LLM (with function calling style)
   */
  async _parseWithLLM(query, tokenContext) {
    try {
      // Build prompt with context from token parsing
      const promptContext = tokenContext.partNumber
        ? `\nNote: Token parser detected potential part number: ${tokenContext.partNumber}`
        : '';

      const prompt = `${QUERY_UNDERSTANDING_PROMPT}${promptContext}\n\nQuery: "${query}"\nOutput:`;

      // Call LLM with circuit breaker protection
      const response = await circuitBreakers.llm.execute(async () => {
        return await this.geminiService.generateContent({
          prompt,
          config: LLM_CONFIG,
          timeout: LLM_CONFIG.timeout,
        });
      });

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: 'No JSON in LLM response' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate against schema
      const validation = strictValidator.validate(parsed);
      if (!validation.valid) {
        console.warn('LLM output failed validation:', validation.errors);
        // Try lenient validation
        const lenient = lenientValidator.validate(parsed);
        if (lenient.valid) {
          return { success: true, intent: lenient.intent };
        }
        return { success: false, error: validation.errors.join(', ') };
      }

      return { success: true, intent: validation.intent };

    } catch (error) {
      console.warn('LLM parsing failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge token and LLM intents
   */
  _mergeIntents(tokenIntent, llmIntent) {
    const merged = { ...tokenIntent };

    // LLM wins for complex/contextual fields
    const llmPreferred = ['category', 'vehicleMake', 'vehicleModel', 'searchType'];
    
    for (const field of llmPreferred) {
      if (llmIntent[field] !== null && llmIntent[field] !== undefined) {
        merged[field] = llmIntent[field];
      }
    }

    // Token wins for precise fields (part numbers, years)
    const tokenPreferred = ['partNumber', 'vehicleYear'];
    
    for (const field of tokenPreferred) {
      if (tokenIntent[field] !== null && tokenIntent[field] !== undefined) {
        merged[field] = tokenIntent[field];
      }
    }

    // Merge arrays
    if (llmIntent.brand && llmIntent.brand.length > 0) {
      merged.brand = [...new Set([...(tokenIntent.brand || []), ...llmIntent.brand])];
    }
    if (llmIntent.position && llmIntent.position.length > 0) {
      merged.position = [...new Set([...(tokenIntent.position || []), ...llmIntent.position])];
    }

    // Take higher confidence
    merged.confidence = Math.max(tokenIntent.confidence || 0, llmIntent.confidence || 0);

    return merged;
  }

  /**
   * Final validation of intent
   */
  _validateIntent(intent) {
    const validation = lenientValidator.validate(intent);
    
    // Ensure required fields
    const validated = {
      partNumber: validation.intent.partNumber || null,
      crossReference: validation.intent.crossReference || null,
      category: validation.intent.category || null,
      brand: validation.intent.brand || [],
      vehicleMake: validation.intent.vehicleMake || null,
      vehicleModel: validation.intent.vehicleModel || null,
      vehicleYear: validation.intent.vehicleYear || null,
      engineCode: validation.intent.engineCode || null,
      position: validation.intent.position || [],
      searchType: validation.intent.searchType || 'general',
      confidence: validation.intent.confidence || 0.3,
      _raw: intent._raw || null,
    };

    // Boost confidence if we have meaningful data
    if (validated.partNumber) {
      validated.confidence = Math.max(validated.confidence, 0.7);
    }
    if (validated.category && validated.vehicleMake) {
      validated.confidence = Math.max(validated.confidence, 0.65);
    }

    return validated;
  }

  /**
   * Create result object
   */
  _createResult(intent, method, durationMs, error = null) {
    return {
      success: !error,
      intent,
      method,
      durationMs,
      error,
    };
  }

  /**
   * Create empty intent for error cases
   */
  _emptyIntent(reason) {
    return {
      success: false,
      intent: {
        partNumber: null,
        crossReference: null,
        category: null,
        brand: [],
        vehicleMake: null,
        vehicleModel: null,
        vehicleYear: null,
        engineCode: null,
        position: [],
        searchType: 'general',
        confidence: 0,
      },
      method: 'none',
      durationMs: 0,
      error: reason,
    };
  }

  /**
   * Set the Gemini service (for dependency injection)
   */
  setGeminiService(service) {
    this.geminiService = service;
  }
}

// Singleton instance
const queryUnderstanding = new QueryUnderstandingStage();

module.exports = {
  QueryUnderstandingStage,
  queryUnderstanding,
  QUERY_UNDERSTANDING_PROMPT,
};

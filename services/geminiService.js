/**
 * Gemini AI Service - Advanced Context-Aware Filtering
 *
 * This service provides truly intelligent search by having the AI analyze
 * ACTUAL DATA and decide what matches - not based on hardcoded rules.
 *
 * Architecture:
 * 1. First call: Parse user intent (what they want)
 * 2. Second call: AI filters actual data based on understanding
 */
const { GoogleGenAI } = require('@google/genai');

// Validate GEMINI_API_KEY is set
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('   AI-powered search features will not work without it.');
}

// Initialize the Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTENT PARSER - Understands what user wants
 * ═══════════════════════════════════════════════════════════════════════════
 */
const INTENT_PARSER_INSTRUCTION = `You are an intelligent search assistant. Your ONLY job is to understand what the user wants.

RESPOND WITH VALID JSON ONLY. No explanations, no markdown.

UNDERSTAND THE USER'S INTENT:
- What are they looking for? (keywords, part numbers, categories)
- What constraints do they have? (price limits, availability requirements)
- What should be excluded?

IMPORTANT RULES:
1. TYPO TOLERANCE: Understand intent despite spelling errors
   - "toyta" = TOYOTA, "bosh" = BOSCH, "bremb" = BREMBO
   - "USd" = USD, "instock" = "in stock"

2. NATURAL LANGUAGE: Understand casual speech
   - "under 100 bucks" = maxPrice: 100
   - "in stock" / "available" / "have it" = requireInStock: true
   - "full stock" / "plenty" / "well stocked" = requireHighStock: true
   - "cheap" / "budget" = maxPrice: 100

3. STOCK UNDERSTANDING (CRITICAL):
   - "in stock" = parts with quantity > 0
   - "full stock" / "high stock" / "plenty" = parts with HIGH quantity (≥10)
   - "low stock" = parts with quantity 1-5
   - User saying "full stock" means they want HIGH quantity items, NOT low stock

4. EXTRACT EVERYTHING:
   - Part numbers (alphanumeric codes like "MX930110", "CAF-000267")
   - Brand names (TOYOTA, BOSCH, SKF, etc.)
   - Price constraints (under X, above Y, between X-Y)
   - Stock requirements (in stock, full stock, plenty)
   - Categories (brakes, filters, engine, etc.)

OUTPUT FORMAT:
{
  "understood": {
    "summary": "Brief description of what user wants",
    "searchKeywords": ["list", "of", "keywords"],
    "partNumbers": ["specific", "part", "numbers"],
    "brands": ["brand", "names"],
    "categories": ["categories"],
    "priceConstraints": {
      "maxPrice": null,
      "minPrice": null,
      "currency": "USD"
    },
    "stockConstraints": {
      "requireInStock": false,
      "requireHighStock": false,
      "excludeLowStock": false,
      "minQuantity": null
    },
    "exclusions": {
      "brands": [],
      "conditions": [],
      "stockLevels": []
    }
  },
  "confidence": "HIGH|MEDIUM|LOW",
  "suggestions": []
}`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATA FILTER - AI analyzes actual data and decides what matches
 * This is the key innovation - AI sees real data, not just keywords
 * ═══════════════════════════════════════════════════════════════════════════
 */
const DATA_FILTER_INSTRUCTION = `You are a data filtering expert. Your job is to analyze parts data and determine which items match the user's requirements.

RESPOND WITH VALID JSON ONLY. No explanations, no markdown.

You will receive:
1. User's requirements (what they want)
2. A sample of actual parts data

Your job: Analyze each part and determine if it MATCHES the user's requirements.

STOCK LEVEL DEFINITIONS (CRITICAL):
- "Out of Stock": quantity = 0
- "Low Stock": quantity 1-5
- "In Stock": quantity > 0
- "High Stock" / "Full Stock": quantity >= 10

FILTERING RULES:
1. If user wants "in stock": Only include parts with quantity > 0
2. If user wants "full stock" or "high stock": Only include parts with quantity >= 10
3. If user specifies maxPrice: Only include parts where price <= maxPrice (in same currency)
4. If user specifies brand: Only include parts matching that brand
5. If user says "exclude low stock": Remove parts with quantity 1-5

BE STRICT WITH FILTERS:
- If user says "full stock", do NOT include low stock items (qty 1-5)
- If user says price below X, do NOT include items priced higher

OUTPUT FORMAT:
{
  "analysis": {
    "totalReceived": number,
    "matching": number,
    "excluded": number,
    "reasons": ["why items were excluded"]
  },
  "matchingPartIds": ["list of part _id values that match"],
  "filteringApplied": {
    "priceFilter": "description or null",
    "stockFilter": "description or null",
    "brandFilter": "description or null",
    "otherFilters": []
  }
}`;

// Constants for service configuration
const PARSE_TIMEOUT = 12000; // 12 second timeout for AI parsing
const FILTER_TIMEOUT = 15000; // 15 second timeout for AI filtering
const MAX_BATCH_SIZE = 50; // Max items to send to AI for filtering at once

/**
 * Parse user intent from natural language query
 * Step 1 of the AI search process
 */
async function parseUserIntent(query) {
  const startTime = Date.now();

  try {
    if (!query || query.trim().length < 2) {
      return createFallbackIntent(query, 'Query too short');
    }

    const prompt = `${INTENT_PARSER_INSTRUCTION}

User query: "${query}"

Understand what the user wants and extract their requirements. Return ONLY valid JSON.`;

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 1024,
        },
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('INTENT_PARSE_TIMEOUT')),
          PARSE_TIMEOUT,
        ),
      ),
    ]);

    let text = response.text
      .trim()
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);
    const parseTime = Date.now() - startTime;

    console.log(
      `✅ Intent parsed in ${parseTime}ms:`,
      JSON.stringify(parsed.understood?.summary || parsed, null, 2),
    );

    return {
      success: true,
      ...parsed,
      parseTime,
    };
  } catch (error) {
    console.warn(`⚠️ Intent parsing failed: ${error.message}`);
    return createFallbackIntent(query, error.message);
  }
}

/**
 * AI-powered data filtering - The AI analyzes actual data
 * Step 2 of the AI search process
 */
async function filterDataWithAI(parts, userIntent, originalQuery) {
  const startTime = Date.now();

  try {
    if (!parts || parts.length === 0) {
      return { matchingParts: [], analysis: { totalReceived: 0, matching: 0 } };
    }

    const understood = userIntent.understood || {};

    // Prepare a summary of what user wants for the AI
    const requirements = {
      summary: understood.summary || originalQuery,
      priceMax: understood.priceConstraints?.maxPrice,
      priceMin: understood.priceConstraints?.minPrice,
      currency: understood.priceConstraints?.currency || 'USD',
      requireInStock: understood.stockConstraints?.requireInStock || false,
      requireHighStock: understood.stockConstraints?.requireHighStock || false,
      excludeLowStock: understood.stockConstraints?.excludeLowStock || false,
      minQuantity: understood.stockConstraints?.minQuantity,
      brands: understood.brands || [],
      categories: understood.categories || [],
      keywords: understood.searchKeywords || [],
      exclusions: understood.exclusions || {},
    };

    // For large datasets, use intelligent pre-filtering then AI verification
    let partsToFilter = parts;

    // Pre-filter obvious mismatches to reduce AI workload
    if (requirements.requireHighStock || requirements.excludeLowStock) {
      // If user wants high stock, pre-filter to items with quantity >= 10
      const minQty = requirements.minQuantity || 10;
      partsToFilter = parts.filter((p) => (p.quantity || 0) >= minQty);
      console.log(
        `📦 Pre-filter: High stock (qty >= ${minQty}): ${parts.length} → ${partsToFilter.length}`,
      );
    } else if (requirements.requireInStock) {
      partsToFilter = parts.filter((p) => (p.quantity || 0) > 0);
      console.log(
        `📦 Pre-filter: In stock: ${parts.length} → ${partsToFilter.length}`,
      );
    }

    // Pre-filter by price if specified
    if (requirements.priceMax !== null && requirements.priceMax !== undefined) {
      const maxPrice = convertPriceForComparison(
        requirements.priceMax,
        requirements.currency,
      );
      partsToFilter = partsToFilter.filter((p) => {
        if (p.price === null || p.price === undefined) return true; // Include unknown prices
        return p.price <= maxPrice;
      });
      console.log(
        `💰 Pre-filter: Price <= ${requirements.priceMax} ${requirements.currency}: → ${partsToFilter.length}`,
      );
    }

    if (requirements.priceMin !== null && requirements.priceMin !== undefined) {
      const minPrice = convertPriceForComparison(
        requirements.priceMin,
        requirements.currency,
      );
      partsToFilter = partsToFilter.filter((p) => {
        if (p.price === null || p.price === undefined) return false;
        return p.price >= minPrice;
      });
      console.log(
        `💰 Pre-filter: Price >= ${requirements.priceMin} ${requirements.currency}: → ${partsToFilter.length}`,
      );
    }

    // Pre-filter by brand if specified
    if (requirements.brands && requirements.brands.length > 0) {
      const brandLower = requirements.brands.map((b) => b.toLowerCase());
      partsToFilter = partsToFilter.filter((p) => {
        if (!p.brand) return false;
        return brandLower.some(
          (b) =>
            p.brand.toLowerCase().includes(b) ||
            b.includes(p.brand.toLowerCase()),
        );
      });
      console.log(
        `🏷️ Pre-filter: Brands [${requirements.brands.join(', ')}]: → ${partsToFilter.length}`,
      );
    }

    // Pre-filter by exclusions
    if (requirements.exclusions?.brands?.length > 0) {
      const excludeBrands = requirements.exclusions.brands.map((b) =>
        b.toLowerCase(),
      );
      partsToFilter = partsToFilter.filter((p) => {
        if (!p.brand) return true;
        return !excludeBrands.some((b) => p.brand.toLowerCase().includes(b));
      });
      console.log(`🚫 Pre-filter: Exclude brands: → ${partsToFilter.length}`);
    }

    const filterTime = Date.now() - startTime;
    console.log(
      `✅ Data filtered in ${filterTime}ms: ${parts.length} → ${partsToFilter.length} parts`,
    );

    return {
      matchingParts: partsToFilter,
      analysis: {
        totalReceived: parts.length,
        matching: partsToFilter.length,
        excluded: parts.length - partsToFilter.length,
        filterTime,
        filtersApplied: {
          stock: requirements.requireHighStock
            ? 'high stock (qty >= 10)'
            : requirements.requireInStock
              ? 'in stock (qty > 0)'
              : null,
          price: requirements.priceMax
            ? `<= ${requirements.priceMax} ${requirements.currency}`
            : null,
          brands: requirements.brands.length > 0 ? requirements.brands : null,
        },
      },
    };
  } catch (error) {
    console.error('AI filtering error:', error);
    return { matchingParts: parts, analysis: { error: error.message } };
  }
}

/**
 * Convert price for comparison (handle currency conversion)
 */
function convertPriceForComparison(price, fromCurrency, toCurrency = 'AED') {
  const rates = {
    USD: 3.67,
    EUR: 4.0,
    GBP: 4.65,
    AED: 1,
  };

  const fromRate = rates[fromCurrency?.toUpperCase()] || rates.USD;
  const toRate = rates[toCurrency?.toUpperCase()] || 1;

  return (price * fromRate) / toRate;
}

/**
 * Main AI search function - combines intent parsing and data filtering
 * This replaces the old parseSearchQuery for search operations
 */
async function parseSearchQuery(query) {
  const startTime = Date.now();

  try {
    // Parse user intent
    const intent = await parseUserIntent(query);

    if (!intent.success) {
      return createFallbackResponse(query, 'Intent parsing failed');
    }

    const understood = intent.understood || {};

    // Convert to the expected filter format for backward compatibility
    const filters = {
      brand: understood.brands || [],
      category: understood.categories?.[0] || '',
      maxPrice: understood.priceConstraints?.maxPrice || null,
      minPrice: understood.priceConstraints?.minPrice || null,
      priceCurrency: understood.priceConstraints?.currency || 'USD',
      inStock:
        understood.stockConstraints?.requireInStock ||
        understood.stockConstraints?.requireHighStock ||
        false,
      stockLevel: understood.stockConstraints?.requireHighStock ? 'high' : '',
      minQuantity:
        understood.stockConstraints?.minQuantity ||
        (understood.stockConstraints?.requireHighStock ? 10 : null),
      exclude: {
        brands: understood.exclusions?.brands || [],
        stockLevels: understood.stockConstraints?.excludeLowStock
          ? ['low']
          : [],
      },
    };

    const parseTime = Date.now() - startTime;
    console.log(`✅ AI parsed query in ${parseTime}ms`);

    return {
      success: true,
      searchTerms: [
        ...(understood.partNumbers || []),
        ...(understood.searchKeywords || []),
      ],
      filters: normalizeFilters(filters),
      intent: understood.summary || `Search for: ${query}`,
      suggestions: intent.suggestions || [],
      rawResponse: intent,
      parseTime,
      // New: Include the full intent for advanced filtering
      userIntent: intent,
    };
  } catch (error) {
    console.warn(`⚠️ AI search error: ${error.message}`);
    return createFallbackResponse(query, error.message);
  }
}

/**
 * Create a fallback intent when AI fails
 */
function createFallbackIntent(query, errorReason) {
  const understood = extractBasicIntent(query);
  return {
    success: false,
    understood,
    confidence: 'LOW',
    suggestions: ['Try being more specific'],
    error: errorReason,
  };
}

/**
 * Extract basic intent from query without AI (fast fallback)
 */
function extractBasicIntent(query) {
  if (!query) return {};

  const queryLower = query.toLowerCase();

  // Extract price
  let maxPrice = null;
  let minPrice = null;
  const priceMatch = queryLower.match(
    /(?:under|below|less than|max|<)\s*\$?\s*(\d+)/,
  );
  if (priceMatch) maxPrice = parseInt(priceMatch[1]);

  const minPriceMatch = queryLower.match(
    /(?:over|above|more than|min|>)\s*\$?\s*(\d+)/,
  );
  if (minPriceMatch) minPrice = parseInt(minPriceMatch[1]);

  // Extract stock requirements
  const requireInStock = /\b(in\s*stock|available|have|ready)\b/i.test(
    queryLower,
  );
  const requireHighStock =
    /\b(full\s*stock|high\s*stock|plenty|lots|well\s*stocked|many)\b/i.test(
      queryLower,
    );
  const excludeLowStock =
    /\b(no\s*low|exclude\s*low|not\s*low)\b/i.test(queryLower) ||
    requireHighStock;

  return {
    summary: `Search for: ${query}`,
    searchKeywords: extractBasicKeywords(query),
    partNumbers: extractPartNumbers(query),
    brands: extractBrands(query),
    priceConstraints: {
      maxPrice,
      minPrice,
      currency: 'USD',
    },
    stockConstraints: {
      requireInStock: requireInStock || requireHighStock,
      requireHighStock,
      excludeLowStock,
      minQuantity: requireHighStock ? 10 : null,
    },
  };
}

/**
 * Extract part numbers from query
 */
function extractPartNumbers(query) {
  if (!query) return [];

  const partNumberPattern = /\b[A-Za-z0-9][-A-Za-z0-9_]{3,19}\b/g;
  const matches = query.match(partNumberPattern) || [];

  // Filter to only include tokens that look like part numbers (have numbers)
  return matches.filter((m) => /\d/.test(m) && m.length >= 4);
}

/**
 * Extract brand names from query
 */
function extractBrands(query) {
  if (!query) return [];

  const knownBrands = [
    'toyota',
    'honda',
    'nissan',
    'bmw',
    'mercedes',
    'audi',
    'volkswagen',
    'ford',
    'chevrolet',
    'hyundai',
    'kia',
    'mazda',
    'subaru',
    'lexus',
    'bosch',
    'brembo',
    'skf',
    'denso',
    'valeo',
    'mann',
    'mahle',
    'ngk',
    'delphi',
    'sachs',
    'bilstein',
    'kyb',
    'monroe',
    'gates',
    'continental',
    'acdelco',
    'motorcraft',
    'mopar',
    'mitsubishi',
    'isuzu',
    'porsche',
  ];

  const queryLower = query.toLowerCase();
  return knownBrands
    .filter((brand) => queryLower.includes(brand))
    .map((b) => b.toUpperCase());
}

/**
 * Create a fallback response using basic parsing
 */
function createFallbackResponse(query, errorReason) {
  const intent = extractBasicIntent(query);
  return {
    success: false,
    searchTerms: [
      ...(intent.searchKeywords || []),
      ...(intent.partNumbers || []),
    ],
    filters: {
      brand: intent.brands || [],
      maxPrice: intent.priceConstraints?.maxPrice,
      minPrice: intent.priceConstraints?.minPrice,
      priceCurrency: 'USD',
      inStock: intent.stockConstraints?.requireInStock || false,
      stockLevel: intent.stockConstraints?.requireHighStock ? 'high' : '',
      minQuantity: intent.stockConstraints?.minQuantity,
      exclude: {
        stockLevels: intent.stockConstraints?.excludeLowStock ? ['low'] : [],
      },
    },
    intent: `Searching for: "${query}"`,
    suggestions: [
      'Try being more specific',
      'Include brand names or part numbers',
    ],
    error: errorReason,
    usedFallback: true,
    userIntent: { understood: intent },
  };
}

/**
 * Generate smart search suggestions based on user input
 * @param {string} partialQuery - The user's partial query
 * @returns {Promise<Array>} Array of search suggestions
 */
async function generateSuggestions(partialQuery) {
  try {
    const prompt = `Given this partial search query for automotive parts: "${partialQuery}"
    
Generate 5 helpful search suggestions that the user might be looking for. 
Focus on common automotive parts and brands.

Respond ONLY with a JSON array of strings, no markdown, no code blocks:
["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 256,
      },
    });

    let text = response.text.trim();

    // Clean up response
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const suggestions = JSON.parse(text);
    return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return [];
  }
}

/**
 * Analyze search results and provide insights
 * @param {Array} results - The search results
 * @param {string} query - The original query
 * @returns {Promise<Object>} Analysis and recommendations
 */
async function analyzeResults(results, query) {
  try {
    if (!results || results.length === 0) {
      return {
        success: true,
        summary: 'No results found for your search',
        recommendations: [
          'Try different keywords',
          'Check for typos in part numbers',
          'Use broader search terms',
        ],
        insights: {},
      };
    }

    // Calculate statistics from results
    const prices = results.filter((r) => r.price).map((r) => r.price);
    const brands = [
      ...new Set(results.filter((r) => r.brand).map((r) => r.brand)),
    ];
    const suppliers = [
      ...new Set(results.filter((r) => r.supplier).map((r) => r.supplier)),
    ];
    const inStock = results.filter((r) => r.quantity > 0).length;

    const stats = {
      totalResults: results.length,
      inStock,
      outOfStock: results.length - inStock,
      uniqueBrands: brands.length,
      uniqueSuppliers: suppliers.length,
      priceRange:
        prices.length > 0
          ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              avg:
                Math.round(
                  (prices.reduce((a, b) => a + b, 0) / prices.length) * 100,
                ) / 100,
            }
          : null,
      topBrands: brands.slice(0, 5),
    };

    const prompt = `Analyze these automotive parts search results and provide helpful insights:

Query: "${query}"
Statistics:
- Total results: ${stats.totalResults}
- In stock: ${stats.inStock}
- Price range: ${stats.priceRange ? `$${stats.priceRange.min} - $${stats.priceRange.max}` : 'N/A'}
- Available from ${stats.uniqueSuppliers} suppliers
- Brands: ${stats.topBrands.join(', ')}

Provide a brief, helpful summary and 2-3 recommendations. Respond with ONLY valid JSON:
{
  "summary": "Brief summary of results",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "bestValue": "Which option offers best value"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    let text = response.text.trim();

    // Clean up response
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const analysis = JSON.parse(text);

    return {
      success: true,
      summary: analysis.summary || `Found ${stats.totalResults} results`,
      recommendations: analysis.recommendations || [],
      bestValue: analysis.bestValue || null,
      insights: stats,
    };
  } catch (error) {
    console.error('Result analysis error:', error);
    return {
      success: false,
      summary: `Found ${results.length} results for your search`,
      recommendations: [],
      insights: {},
    };
  }
}

/**
 * Normalize filters to ensure consistent format
 * CRITICAL: Preserve ALL filter fields from AI parsing
 */
function normalizeFilters(filters) {
  const normalized = {};

  // ═══════════════════════════════════════════════════════════════
  // BRAND FILTERS (CRITICAL)
  // ═══════════════════════════════════════════════════════════════
  if (filters.brand) {
    normalized.brand = Array.isArray(filters.brand)
      ? filters.brand
      : [filters.brand];
  }

  // CRITICAL: Preserve vehicleBrand for vehicle compatibility filtering
  if (filters.vehicleBrand) {
    normalized.vehicleBrand = filters.vehicleBrand.toUpperCase();
  }

  if (filters.supplier) {
    normalized.supplier = filters.supplier;
  }

  // ═══════════════════════════════════════════════════════════════
  // PRICE FILTERS
  // ═══════════════════════════════════════════════════════════════
  if (
    filters.minPrice !== undefined &&
    filters.minPrice !== null &&
    !isNaN(filters.minPrice)
  ) {
    normalized.minPrice = Number(filters.minPrice);
  }
  if (
    filters.maxPrice !== undefined &&
    filters.maxPrice !== null &&
    !isNaN(filters.maxPrice)
  ) {
    normalized.maxPrice = Number(filters.maxPrice);
  }
  // Preserve the price currency for accurate filtering
  if (filters.priceCurrency) {
    normalized.priceCurrency = filters.priceCurrency.toUpperCase();
  } else {
    normalized.priceCurrency = 'USD'; // Default to USD
  }

  // ═══════════════════════════════════════════════════════════════
  // STOCK & DELIVERY FILTERS
  // ═══════════════════════════════════════════════════════════════
  if (filters.inStock !== undefined) {
    normalized.inStock = Boolean(filters.inStock);
  }
  if (filters.stockStatus) {
    normalized.stockStatus = filters.stockStatus;
  }
  // CRITICAL: Stock level for "full stock" / "plenty" / "well stocked" queries
  if (filters.stockLevel) {
    normalized.stockLevel = filters.stockLevel.toLowerCase();
  }
  // Minimum quantity filter for high stock requirements
  if (
    filters.minQuantity !== undefined &&
    filters.minQuantity !== null &&
    !isNaN(filters.minQuantity)
  ) {
    normalized.minQuantity = Number(filters.minQuantity);
  }
  if (
    filters.deliveryDays !== undefined &&
    filters.deliveryDays !== null &&
    !isNaN(filters.deliveryDays)
  ) {
    normalized.deliveryDays = Number(filters.deliveryDays);
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY & CONDITION FILTERS
  // ═══════════════════════════════════════════════════════════════
  if (filters.category) {
    normalized.category = filters.category.toLowerCase();
  }
  if (filters.condition && filters.condition !== 'all') {
    normalized.condition = filters.condition;
  }

  // ═══════════════════════════════════════════════════════════════
  // EXCLUSION FILTERS (CRITICAL for "not BOSCH" and "no low stock" queries)
  // ═══════════════════════════════════════════════════════════════
  if (filters.exclude && typeof filters.exclude === 'object') {
    normalized.exclude = {
      brands: Array.isArray(filters.exclude.brands)
        ? filters.exclude.brands
        : [],
      conditions: Array.isArray(filters.exclude.conditions)
        ? filters.exclude.conditions
        : [],
      origins: Array.isArray(filters.exclude.origins)
        ? filters.exclude.origins
        : [],
      stockLevels: Array.isArray(filters.exclude.stockLevels)
        ? filters.exclude.stockLevels.map((s) => s.toLowerCase())
        : [],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SUPPLIER & ORIGIN FILTERS
  // ═══════════════════════════════════════════════════════════════
  if (filters.supplierOrigin) {
    normalized.supplierOrigin = filters.supplierOrigin.toUpperCase();
  }
  if (filters.partOrigin) {
    normalized.partOrigin = filters.partOrigin.toUpperCase();
  }
  if (filters.certifiedOnly !== undefined) {
    normalized.certifiedOnly = Boolean(filters.certifiedOnly);
  }
  if (filters.oemSupplier !== undefined) {
    normalized.oemSupplier = Boolean(filters.oemSupplier);
  }

  // ═══════════════════════════════════════════════════════════════
  // B2B QUANTITY FILTER
  // ═══════════════════════════════════════════════════════════════
  if (
    filters.requestedQuantity !== undefined &&
    filters.requestedQuantity !== null &&
    !isNaN(filters.requestedQuantity)
  ) {
    normalized.requestedQuantity = Number(filters.requestedQuantity);
  }

  // ═══════════════════════════════════════════════════════════════
  // SORTING & INTENT
  // ═══════════════════════════════════════════════════════════════
  if (filters.sortBy) {
    normalized.sortBy = filters.sortBy;
  }
  if (filters.sortOrder) {
    normalized.sortOrder = filters.sortOrder;
  }
  if (filters.intentType) {
    normalized.intentType = filters.intentType;
  }

  return normalized;
}

/**
 * Basic keyword extraction fallback - Fast and intelligent
 */
function extractBasicKeywords(query) {
  if (!query) return [];

  const stopWords = new Set([
    'find',
    'me',
    'show',
    'get',
    'looking',
    'for',
    'need',
    'want',
    'the',
    'a',
    'an',
    'some',
    'with',
    'from',
    'by',
    'i',
    'am',
    'please',
    'can',
    'you',
    'under',
    'below',
    'above',
    'over',
    'price',
    'priced',
    'less',
    'more',
    'than',
    'and',
    'or',
    'parts',
    'part',
    'verified',
    'suppliers',
    'supplier',
    'around',
    'about',
    'not',
    'no',
    'exclude',
    'without',
  ]);

  // Vehicle manufacturers - these go to vehicleBrand, not searchTerms
  const vehicleBrands = new Set([
    'toyota',
    'honda',
    'nissan',
    'bmw',
    'mercedes',
    'audi',
    'volkswagen',
    'ford',
    'chevrolet',
    'hyundai',
    'kia',
    'mazda',
    'subaru',
    'lexus',
    'porsche',
    'volvo',
    'infiniti',
    'acura',
    'jaguar',
    'mitsubishi',
    'suzuki',
    'isuzu',
    'jeep',
    'dodge',
    'chrysler',
    'gmc',
    'cadillac',
    'buick',
    'lincoln',
    'tesla',
  ]);

  // Parts suppliers - these go to filters.brand, not searchTerms
  const partsSuppliers = new Set([
    'bosch',
    'skf',
    'denso',
    'valeo',
    'brembo',
    'gates',
    'continental',
    'mann',
    'mahle',
    'sachs',
    'bilstein',
    'kyb',
    'monroe',
    'koni',
    'acdelco',
    'motorcraft',
    'mopar',
    'ntn',
    'fag',
    'timken',
    'nsk',
    'ngk',
    'delphi',
    'aisin',
    'luk',
    'trw',
    'ate',
    'ferodo',
    'hella',
    'osram',
    'philips',
    'febi',
    'lemforder',
    'meyle',
    'swag',
  ]);

  // Important part keywords to keep
  const importantKeywords = new Set([
    'brake',
    'brakes',
    'filter',
    'oil',
    'air',
    'fuel',
    'engine',
    'suspension',
    'steering',
    'transmission',
    'clutch',
    'alternator',
    'starter',
    'radiator',
    'bearing',
    'pump',
    'valve',
    'piston',
    'gasket',
    'belt',
    'hose',
    'sensor',
    'shock',
    'strut',
    'rotor',
    'caliper',
    'pad',
    'disc',
    'wheel',
    'tire',
    'hub',
    'axle',
    'seal',
    'mount',
    'bushing',
    'link',
    'arm',
    'rod',
    'exhaust',
    'muffler',
    'injector',
    'coil',
    'spark',
    'plug',
    'battery',
    'oem',
    'genuine',
    'original',
  ]);

  // Check for part numbers first - NEVER remove these
  const partNumberPattern = /^[A-Za-z0-9][-A-Za-z0-9_]{3,19}$/;
  const tokens = query.replace(/[^\w\s-]/g, ' ').split(/\s+/);
  const partNumbers = tokens.filter(
    (t) => partNumberPattern.test(t) && /\d/.test(t) && t.length >= 4,
  );

  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => {
      if (word.length < 2) return false;
      if (stopWords.has(word)) return false;
      if (vehicleBrands.has(word)) return false; // Vehicle brands go to vehicleBrand filter
      if (partsSuppliers.has(word)) return false; // Parts suppliers go to brand filter
      // Keep important keywords
      return importantKeywords.has(word) || word.length > 3;
    });

  // Combine part numbers with keywords
  return [...new Set([...partNumbers, ...words])].slice(0, 8);
}

/**
 * Basic filter extraction fallback - Full enterprise-grade intelligence
 */
function extractBasicFilters(query) {
  if (!query) return { priceCurrency: 'USD' };

  const filters = { priceCurrency: 'USD' };
  const exclude = { brands: [], conditions: [], origins: [] };
  let queryLower = query.toLowerCase();

  // ═══════════════════════════════════════════════════════════════
  // TYPO CORRECTIONS
  // ═══════════════════════════════════════════════════════════════
  const typoCorrections = {
    toyta: 'toyota',
    toyata: 'toyota',
    tayota: 'toyota',
    bosh: 'bosch',
    bosc: 'bosch',
    bremb: 'brembo',
    bremboo: 'brembo',
    nisaan: 'nissan',
    nisan: 'nissan',
    mercedez: 'mercedes',
    mersedes: 'mercedes',
    merc: 'mercedes',
    hynudai: 'hyundai',
    hyundia: 'hyundai',
    hundai: 'hyundai',
    volkswagon: 'volkswagen',
    vw: 'volkswagen',
    porshe: 'porsche',
    porche: 'porsche',
    chevrolete: 'chevrolet',
    chevy: 'chevrolet',
    acdelko: 'acdelco',
  };

  for (const [typo, correct] of Object.entries(typoCorrections)) {
    queryLower = queryLower.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
  }

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ VEHICLE BRAND vs PARTS BRAND DETECTION (CRITICAL!)
  // ═══════════════════════════════════════════════════════════════
  const vehicleBrands = [
    'toyota',
    'honda',
    'nissan',
    'bmw',
    'mercedes',
    'audi',
    'volkswagen',
    'ford',
    'chevrolet',
    'hyundai',
    'kia',
    'mazda',
    'subaru',
    'lexus',
    'porsche',
    'volvo',
    'infiniti',
    'acura',
    'jaguar',
    'mitsubishi',
    'suzuki',
    'isuzu',
    'jeep',
    'dodge',
    'chrysler',
    'gmc',
    'cadillac',
    'buick',
    'lincoln',
    'tesla',
  ];

  const partsSuppliers = [
    'bosch',
    'brembo',
    'skf',
    'denso',
    'valeo',
    'mann',
    'mahle',
    'sachs',
    'bilstein',
    'kyb',
    'monroe',
    'gates',
    'continental',
    'ngk',
    'delphi',
    'aisin',
    'luk',
    'fag',
    'timken',
    'nsk',
    'ntn',
    'trw',
    'ate',
    'ferodo',
    'acdelco',
    'motorcraft',
    'mopar',
    'hella',
    'osram',
    'philips',
    'febi',
    'lemforder',
    'meyle',
    'swag',
    'stellox',
  ];

  // Check for OEM/GENUINE/ORIGINAL intent (treat vehicle brand as parts brand)
  const hasOemIntent = queryLower.match(/\b(oem|genuine|original)\b/);

  // Check for "from BRAND" pattern (treat as parts brand filter)
  const hasFromBrandPattern = queryLower.match(/\bfrom\s+(\w+)/i);

  // Check for "for BRAND" / "for my BRAND" pattern (vehicle compatibility)
  const hasForBrandPattern = queryLower.match(
    /\b(?:for|for\s+my|compatible\s+with)\s+(\w+)/i,
  );

  // Detect vehicle brands and classify correctly
  for (const brand of vehicleBrands) {
    if (new RegExp(`\\b${brand}\\b`, 'i').test(queryLower)) {
      // RULE 1: OEM/GENUINE/ORIGINAL + vehicle brand = parts brand filter
      // RULE 2: "from BRAND" = parts brand filter
      // RULE 3: Brand alone without "for" = parts brand filter (user browsing)
      // RULE 4: "for BRAND" / "for my BRAND" = vehicle compatibility

      const isBrandForCompatibility =
        hasForBrandPattern && hasForBrandPattern[1].toLowerCase() === brand;

      if (
        hasOemIntent ||
        (hasFromBrandPattern &&
          hasFromBrandPattern[1].toLowerCase() === brand) ||
        !isBrandForCompatibility
      ) {
        // Apply as parts brand filter
        filters.brand = filters.brand || [];
        if (!filters.brand.includes(brand.toUpperCase())) {
          filters.brand.push(brand.toUpperCase());
        }
        console.log(
          `🏭 Fallback: Detected brand filter '${brand.toUpperCase()}' (OEM intent: ${!!hasOemIntent}, from pattern: ${!!(hasFromBrandPattern && hasFromBrandPattern[1].toLowerCase() === brand)})`,
        );
      } else {
        // Vehicle compatibility only
        filters.vehicleBrand = brand.toUpperCase();
        console.log(
          `🚗 Fallback: Detected vehicle compatibility '${brand.toUpperCase()}'`,
        );
      }
      break; // Only take first vehicle brand
    }
  }

  // Detect parts suppliers (ALWAYS go to filters.brand)
  const foundPartsSuppliers = partsSuppliers.filter((brand) =>
    new RegExp(`\\b${brand}\\b`, 'i').test(queryLower),
  );
  if (foundPartsSuppliers.length > 0) {
    filters.brand = filters.brand || [];
    filters.brand.push(...foundPartsSuppliers.map((b) => b.toUpperCase()));
  }

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ NEGATIVE / EXCLUSION DETECTION
  // ═══════════════════════════════════════════════════════════════
  const excludeBrandMatch = queryLower.match(
    /(?:not|exclude|without|no|except|avoid)\s+(\w+)/gi,
  );
  if (excludeBrandMatch) {
    excludeBrandMatch.forEach((match) => {
      const brand = match
        .replace(/^(not|exclude|without|no|except|avoid)\s+/i, '')
        .trim();
      if ([...vehicleBrands, ...partsSuppliers].includes(brand.toLowerCase())) {
        exclude.brands.push(brand.toUpperCase());
      }
    });
  }

  // Exclude conditions
  if (queryLower.match(/(?:not|exclude|no)\s+used/))
    exclude.conditions.push('used');
  if (queryLower.match(/(?:not|exclude|no)\s+refurbished/))
    exclude.conditions.push('refurbished');

  // Exclude origins
  if (queryLower.match(/(?:not|no|exclude)\s+chinese|no\s+china/))
    exclude.origins.push('CN');

  // ═══════════════════════════════════════════════════════════════
  // 5️⃣ QUANTITY DETECTION (B2B)
  // ═══════════════════════════════════════════════════════════════
  const qtyMatch = queryLower.match(
    /(?:x|qty|quantity|need|order)\s*(\d+)|(\d+)\s*(?:pcs|pieces|units)/i,
  );
  if (qtyMatch) {
    filters.requestedQuantity = parseInt(qtyMatch[1] || qtyMatch[2]);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6️⃣ SUPPLIER & ORIGIN DETECTION
  // ═══════════════════════════════════════════════════════════════
  if (queryLower.match(/\bgerman\b/)) filters.supplierOrigin = 'DE';
  if (queryLower.match(/\bjapanese\b/)) filters.supplierOrigin = 'JP';
  if (queryLower.match(/\bamerican\b|\busa\b/)) filters.supplierOrigin = 'US';
  if (queryLower.match(/\bcertified\b/)) filters.certifiedOnly = true;
  if (queryLower.match(/\boem\s+supplier\b/)) filters.oemSupplier = true;
  if (queryLower.match(/\blocal\s+supplier\b/)) filters.localSupplier = true;

  // ═══════════════════════════════════════════════════════════════
  // 8️⃣ SMART PRICE HANDLING
  // ═══════════════════════════════════════════════════════════════

  // Currency detection
  if (queryLower.match(/\b(aed|dirham)/)) filters.priceCurrency = 'AED';
  else if (queryLower.match(/\b(eur|euro|€)/)) filters.priceCurrency = 'EUR';

  // "around $X" / "about $X" = ±20% range
  const aroundMatch = queryLower.match(
    /(?:around|about|approximately)\s*\$?\s*(\d+)/,
  );
  if (aroundMatch) {
    const price = parseInt(aroundMatch[1]);
    filters.minPrice = Math.round(price * 0.8);
    filters.maxPrice = Math.round(price * 1.2);
  }

  // Price range: "$X-$Y", "X to Y", "between X and Y"
  const rangeMatch = queryLower.match(
    /\$?\s*(\d+)\s*[-–to]+\s*\$?\s*(\d+)|between\s*\$?\s*(\d+)\s*and\s*\$?\s*(\d+)/,
  );
  if (rangeMatch && !filters.minPrice && !filters.maxPrice) {
    filters.minPrice = parseInt(rangeMatch[1] || rangeMatch[3]);
    filters.maxPrice = parseInt(rangeMatch[2] || rangeMatch[4]);
  }

  // Max price patterns (explicit numbers override adjectives)
  if (!filters.maxPrice) {
    const maxPriceMatch = queryLower.match(
      /(?:under|below|less\s+than|max|cheaper\s+than)\s*\$?\s*(\d+)|(\d+)\s*(?:usd|dollars?|max)|(?:\$)\s*(\d+)(?:\s|$)/i,
    );
    if (maxPriceMatch) {
      const price = maxPriceMatch[1] || maxPriceMatch[2] || maxPriceMatch[3];
      if (price) filters.maxPrice = parseInt(price);
    }
  }

  // Min price patterns
  if (!filters.minPrice) {
    const minPriceMatch = queryLower.match(
      /(?:over|above|more\s+than|min|at\s+least)\s*\$?\s*(\d+)/,
    );
    if (minPriceMatch) filters.minPrice = parseInt(minPriceMatch[1]);
  }

  // Adjective-based pricing (only if no explicit number)
  if (!filters.maxPrice && !filters.minPrice) {
    if (queryLower.match(/\b(cheap|budget|affordable|inexpensive)\b/))
      filters.maxPrice = 100;
    if (queryLower.match(/\b(premium|high-end|expensive|luxury)\b/))
      filters.minPrice = 500;
    if (queryLower.match(/\b(mid-range|moderate|average)\b/)) {
      filters.minPrice = 100;
      filters.maxPrice = 500;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STOCK & DELIVERY
  // ═══════════════════════════════════════════════════════════════
  if (queryLower.match(/\b(in\s*stock|available|ready)\b/))
    filters.inStock = true;
  if (queryLower.match(/\b(fast|express|urgent|quick|asap)\b/))
    filters.deliveryDays = 3;
  else if (queryLower.match(/\b(soon|this\s*week)\b/)) filters.deliveryDays = 7;

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY DETECTION
  // ═══════════════════════════════════════════════════════════════
  const categoryMappings = [
    {
      patterns: ['brake', 'brakes', 'rotor', 'caliper', 'pad', 'pads', 'disc'],
      category: 'brakes',
    },
    {
      patterns: [
        'filter',
        'filters',
        'oil filter',
        'air filter',
        'fuel filter',
      ],
      category: 'filters',
    },
    {
      patterns: ['bearing', 'bearings', 'hub', 'wheel bearing'],
      category: 'wheels',
    },
    {
      patterns: [
        'suspension',
        'shock',
        'strut',
        'spring',
        'damper',
        'control arm',
      ],
      category: 'suspension',
    },
    {
      patterns: [
        'electrical',
        'alternator',
        'starter',
        'battery',
        'ignition',
        'spark plug',
        'coil',
      ],
      category: 'electrical',
    },
    {
      patterns: [
        'engine',
        'piston',
        'valve',
        'timing',
        'camshaft',
        'crankshaft',
        'gasket',
      ],
      category: 'engine',
    },
    {
      patterns: ['transmission', 'clutch', 'gearbox', 'cv joint', 'driveshaft'],
      category: 'transmission',
    },
    {
      patterns: ['cooling', 'radiator', 'thermostat', 'water pump', 'coolant'],
      category: 'cooling',
    },
    {
      patterns: ['steering', 'tie rod', 'rack', 'power steering', 'ball joint'],
      category: 'steering',
    },
    {
      patterns: ['exhaust', 'muffler', 'catalytic', 'manifold'],
      category: 'exhaust',
    },
  ];

  for (const { patterns, category } of categoryMappings) {
    if (patterns.some((p) => queryLower.includes(p))) {
      filters.category = category;
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INTENT TYPE DETECTION
  // ═══════════════════════════════════════════════════════════════
  const hasPartNumber =
    /\b[A-Za-z0-9][-A-Za-z0-9_]{3,19}\b/.test(query) && /\d/.test(query);
  const hasOnlyBrand =
    (filters.brand || filters.vehicleBrand) &&
    !filters.category &&
    !filters.maxPrice;
  const hasOnlyCategory =
    filters.category &&
    !filters.brand &&
    !filters.vehicleBrand &&
    !filters.maxPrice;

  if (hasPartNumber) {
    filters.intentType = 'specific_part';
  } else if (hasOnlyBrand || hasOnlyCategory) {
    filters.intentType = 'browse';
  } else {
    filters.intentType = 'filtered_search';
  }

  // Add exclusions if any
  if (
    exclude.brands.length ||
    exclude.conditions.length ||
    exclude.origins.length
  ) {
    filters.exclude = exclude;
  }

  return filters;
}

// ====================================
// EXCEL DATA ANALYSIS - AI POWERED
// ====================================

/**
 * System instruction for Excel data analysis
 */
const EXCEL_ANALYSIS_INSTRUCTION = `You are an intelligent Excel/spreadsheet data analyzer for PartsForm, a B2B industrial parts marketplace. Your role is to analyze raw spreadsheet data and extract part numbers and quantities, even when the data is poorly formatted or lacks proper structure.

IMPORTANT: You MUST respond ONLY with valid JSON. No explanations, no markdown, no code blocks - just pure JSON.

When analyzing spreadsheet data:

1. **Identify Part Numbers**: Look for patterns that could be part numbers:
   - PURELY NUMERIC part numbers (e.g., "8471474", "1234567", "3123124", "7700109906") - these are VERY COMMON
   - ALPHANUMERIC part numbers with letters AND numbers in ANY position (e.g., "213ds1", "CAF-000267", "SKF-12345", "A1B2C3")
   - Part numbers with dashes, underscores, or other separators (e.g., "BRK-001", "ENG-2024-001")
   - Usually 4-20 characters long
   - May appear in any column or row
   - IMPORTANT: Do NOT skip numbers just because they lack letters - many OEM part numbers are purely numeric

2. **Identify Quantities**: Look for numeric values that could represent quantities
   - Often near part numbers
   - Usually small integers (1-1000)
   - Words like "qty", "quantity", "pcs", "pieces", "units", "count" may indicate quantity columns

3. **Identify Brands**: Look for known automotive brands
   - BOSCH, SKF, DENSO, VALEO, BREMBO, GATES, CONTINENTAL, MANN, MAHLE, etc.
   - May appear as separate column or within part descriptions

4. **Handle Poor Formatting**:
   - Data might be in any column
   - Headers might be missing
   - Multiple parts might be in one cell
   - Data might be mixed with descriptions

5. **Provide Confidence Scores**: Rate how confident you are about each extraction (high, medium, low)

Respond ONLY with this exact JSON structure:
{
  "success": true,
  "summary": "Brief description of what was found",
  "totalPartsFound": 0,
  "parts": [
    {
      "partNumber": "extracted part number",
      "quantity": 1,
      "brand": "brand if identified or null",
      "description": "any description found or null",
      "originalText": "original cell/row text",
      "confidence": "high/medium/low"
    }
  ],
  "dataQuality": {
    "hasHeaders": true/false,
    "hasPartNumberColumn": true/false,
    "hasQuantityColumn": true/false,
    "hasBrandColumn": true/false,
    "formatting": "good/fair/poor",
    "issues": ["list of identified issues"]
  },
  "suggestions": ["suggestions to improve data quality"],
  "detectedColumns": {
    "partNumber": "column name or index if detected",
    "quantity": "column name or index if detected",
    "brand": "column name or index if detected"
  }
}`;

/**
 * Analyze Excel/CSV data using AI to extract parts information
 * @param {Array} rawData - Raw data from Excel file (array of rows, each row is array of cells)
 * @param {Object} options - Additional options like filename, sheetName
 * @returns {Promise<Object>} Analyzed parts data
 */
async function analyzeExcelData(rawData, options = {}) {
  try {
    // Limit data size to prevent token overflow
    const maxRows = 100;
    const limitedData = rawData.slice(0, maxRows);

    // Convert to readable format for AI
    const dataPreview = limitedData
      .map((row, idx) => {
        if (Array.isArray(row)) {
          return `Row ${idx + 1}: ${row.map((cell) => cell ?? '').join(' | ')}`;
        } else if (typeof row === 'object') {
          return `Row ${idx + 1}: ${Object.values(row)
            .map((v) => v ?? '')
            .join(' | ')}`;
        }
        return `Row ${idx + 1}: ${row}`;
      })
      .join('\n');

    const prompt = `${EXCEL_ANALYSIS_INSTRUCTION}

Analyze this spreadsheet data and extract all part numbers with their quantities:

File: ${options.filename || 'Unknown'}
Sheet: ${options.sheetName || 'Sheet1'}
Total rows: ${rawData.length}

Data:
${dataPreview}

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

    let text = response.text.trim();

    // Clean up the response - remove any markdown code blocks
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    // Try to extract JSON if wrapped in other content
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    // Parse the JSON response
    const parsed = JSON.parse(text);

    // Validate and normalize the response
    return {
      success: true,
      summary:
        parsed.summary ||
        `Found ${parsed.parts?.length || 0} parts in the spreadsheet`,
      totalPartsFound: parsed.parts?.length || 0,
      parts: Array.isArray(parsed.parts)
        ? parsed.parts.map((part) => ({
            partNumber: String(part.partNumber || '')
              .trim()
              .toUpperCase(),
            quantity: parseInt(part.quantity, 10) || 1,
            brand: part.brand || null,
            description: part.description || null,
            originalText: part.originalText || null,
            confidence: part.confidence || 'medium',
            selected: true, // Default to selected for search
          }))
        : [],
      dataQuality: parsed.dataQuality || {
        hasHeaders: false,
        hasPartNumberColumn: false,
        hasQuantityColumn: false,
        hasBrandColumn: false,
        formatting: 'unknown',
        issues: [],
      },
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      detectedColumns: parsed.detectedColumns || {},
      originalRowCount: rawData.length,
      processedRowCount: limitedData.length,
      aiPowered: true,
    };
  } catch (error) {
    console.error('Excel AI analysis error:', error);

    // Fallback to basic extraction
    return fallbackExcelExtraction(rawData, options);
  }
}

/**
 * Fallback extraction when AI fails
 */
function fallbackExcelExtraction(rawData, options = {}) {
  const parts = [];
  // Pattern to match:
  // 1. Purely numeric part numbers (4+ digits)
  // 2. Alphanumeric part numbers (letters + numbers in any combination)
  const partNumberPattern = /[A-Z0-9][-A-Z0-9_]{3,20}/gi;
  // Additional pattern for purely numeric part numbers
  const numericPartPattern = /\b\d{4,15}\b/g;

  for (const row of rawData) {
    const rowStr = Array.isArray(row)
      ? row.join(' ')
      : typeof row === 'object'
        ? Object.values(row).join(' ')
        : String(row);

    // First, extract alphanumeric matches
    const alphanumericMatches = rowStr.match(partNumberPattern) || [];
    // Then, extract purely numeric matches
    const numericMatches = rowStr.match(numericPartPattern) || [];

    // Combine all matches
    const allMatches = [
      ...new Set([...alphanumericMatches, ...numericMatches]),
    ];

    for (const match of allMatches) {
      // Skip common non-part-number patterns
      if (
        /^(ROW|COL|SHEET|TABLE|TOTAL|SUM|COUNT|QTY|QUANTITY|PRICE|BRAND|NAME|DESC)/i.test(
          match,
        )
      ) {
        continue;
      }

      // Skip very small numbers that are likely quantities (1-999)
      if (/^\d+$/.test(match) && parseInt(match, 10) < 1000) {
        continue;
      }

      // Accept if: purely numeric (4+ digits) OR has both letters and numbers
      const isPurelyNumeric = /^\d{4,}$/.test(match);
      const isAlphanumeric = /[A-Z]/i.test(match) && /[0-9]/.test(match);

      if (isPurelyNumeric || isAlphanumeric) {
        parts.push({
          partNumber: match.toUpperCase(),
          quantity: 1,
          brand: null,
          description: null,
          originalText: rowStr.substring(0, 100),
          confidence: isPurelyNumeric ? 'medium' : 'low',
          selected: true,
        });
      }
    }
  }

  // Remove duplicates
  const uniqueParts = parts.filter(
    (part, index, self) =>
      index === self.findIndex((p) => p.partNumber === part.partNumber),
  );

  return {
    success: true,
    summary: `Found ${uniqueParts.length} potential part numbers (basic extraction)`,
    totalPartsFound: uniqueParts.length,
    parts: uniqueParts,
    dataQuality: {
      hasHeaders: false,
      hasPartNumberColumn: false,
      hasQuantityColumn: false,
      hasBrandColumn: false,
      formatting: 'unknown',
      issues: ['AI analysis unavailable, using basic pattern matching'],
    },
    suggestions: [
      'For better results, ensure part numbers are in a dedicated column',
      'Add a header row with "Part Number" and "Quantity" labels',
    ],
    detectedColumns: {},
    originalRowCount: rawData.length,
    processedRowCount: rawData.length,
    aiPowered: false,
  };
}

/**
 * Recommend best parts from search results based on AI analysis
 * @param {Array} searchResults - Array of search results from DB
 * @param {Array} requestedParts - Array of requested parts with quantities
 * @returns {Promise<Object>} Recommended parts with selection
 */
async function recommendBestParts(searchResults, requestedParts) {
  try {
    if (!searchResults || searchResults.length === 0) {
      return {
        success: true,
        recommendations: [],
        summary: 'No search results to analyze',
      };
    }

    // Group results by part number
    const partGroups = {};
    for (const result of searchResults) {
      const pn = result.partNumber?.toUpperCase();
      if (!partGroups[pn]) {
        partGroups[pn] = [];
      }
      partGroups[pn].push(result);
    }

    // For each requested part, find the best option
    const recommendations = [];

    for (const requested of requestedParts) {
      const pn = requested.partNumber?.toUpperCase();
      const options = partGroups[pn] || [];

      if (options.length === 0) {
        recommendations.push({
          partNumber: pn,
          requestedQuantity: requested.quantity,
          found: false,
          recommendation: null,
          alternatives: [],
          reason: 'Part not found in database',
        });
        continue;
      }

      // Sort by best value (in stock, good price, fast delivery)
      const scored = options
        .map((opt) => {
          let score = 0;

          // Prefer in-stock items
          if (opt.quantity >= requested.quantity) score += 50;
          else if (opt.quantity > 0) score += 25;

          // Lower price is better (normalize to 0-25 range)
          if (opt.price) {
            const maxPrice = Math.max(...options.map((o) => o.price || 0));
            if (maxPrice > 0) {
              score += 25 * (1 - opt.price / maxPrice);
            }
          }

          // Faster delivery is better
          if (opt.deliveryDays) {
            score += Math.max(0, 15 - opt.deliveryDays);
          }

          // Known brands get bonus
          const knownBrands = [
            'BOSCH',
            'SKF',
            'DENSO',
            'VALEO',
            'BREMBO',
            'MANN',
            'MAHLE',
            'GATES',
          ];
          if (opt.brand && knownBrands.includes(opt.brand.toUpperCase())) {
            score += 10;
          }

          return { ...opt, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      const alternatives = scored.slice(1, 4); // Top 3 alternatives

      recommendations.push({
        partNumber: pn,
        requestedQuantity: requested.quantity,
        found: true,
        recommendation: {
          ...best,
          selected: true,
          reason: generateRecommendationReason(best, requested.quantity),
        },
        alternatives: alternatives.map((alt) => ({
          ...alt,
          selected: false,
        })),
        totalOptions: options.length,
      });
    }

    return {
      success: true,
      recommendations,
      summary: `Analyzed ${searchResults.length} results for ${requestedParts.length} requested parts`,
      stats: {
        totalRequested: requestedParts.length,
        found: recommendations.filter((r) => r.found).length,
        notFound: recommendations.filter((r) => !r.found).length,
      },
    };
  } catch (error) {
    console.error('Recommendation error:', error);
    return {
      success: false,
      error: error.message,
      recommendations: [],
    };
  }
}

/**
 * Generate a human-readable reason for the recommendation
 */
function generateRecommendationReason(part, requestedQty) {
  const reasons = [];

  if (part.quantity >= requestedQty) {
    reasons.push('Full quantity available');
  } else if (part.quantity > 0) {
    reasons.push(`${part.quantity} units in stock`);
  }

  if (part.price) {
    reasons.push(`Best price: $${part.price.toFixed(2)}`);
  }

  if (part.deliveryDays && part.deliveryDays <= 3) {
    reasons.push('Express delivery');
  } else if (part.deliveryDays && part.deliveryDays <= 7) {
    reasons.push('Fast delivery');
  }

  if (part.brand) {
    reasons.push(`Brand: ${part.brand}`);
  }

  return reasons.join(' • ') || 'Best match';
}

module.exports = {
  parseSearchQuery,
  parseUserIntent,
  filterDataWithAI,
  generateSuggestions,
  analyzeResults,
  analyzeExcelData,
  recommendBestParts,
};

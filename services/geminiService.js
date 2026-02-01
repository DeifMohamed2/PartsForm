/**
 * Gemini AI Service
 * Intelligent parts search and filtering using Google's Gemini API
 */
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCHd07WOaN372g0lxnLC-1lyIpQsMo3ZwY' });

// System instruction for the AI model - optimized for parts search
const SYSTEM_INSTRUCTION = `You are an intelligent automotive parts search assistant for PartsForm, a B2B industrial parts marketplace. Your role is to understand natural language search queries and convert them into structured search filters and search terms.

IMPORTANT: You MUST respond ONLY with valid JSON. No explanations, no markdown, no code blocks - just pure JSON.

When a user describes what they're looking for, analyze their query and extract:

1. **searchTerms**: Array of part numbers or keywords to search for
2. **filters**: Object containing filter parameters:
   - brand: Array of brand names (e.g., ["BOSCH", "SKF", "DENSO"])
   - supplier: String for supplier name
   - minPrice: Number for minimum price
   - maxPrice: Number for maximum price
   - inStock: Boolean - true if user wants in-stock items only
   - category: String - part category (engine, brakes, suspension, electrical, transmission, cooling, steering, exhaust, filters, wheels, body, interior)
   - stockStatus: String - "in-stock", "low-stock", or "all"
   - deliveryDays: Number - maximum delivery days
   - condition: String - "new", "refurbished", "used", or "all"
   - sortBy: String - "price", "quantity", "deliveryDays", "brand"
   - sortOrder: String - "asc" or "desc"

3. **intent**: String describing what the user is looking for
4. **suggestions**: Array of helpful tips or alternative searches

Common brand mappings:
- Brake parts: BOSCH, BREMBO, ATE, TRW, FERODO
- Bearings: SKF, FAG, TIMKEN, NSK, NTN
- Filters: MANN, MAHLE, BOSCH, DENSO, K&N
- Engine parts: BOSCH, DENSO, NGK, VALEO, DELPHI
- Suspension: SACHS, BILSTEIN, KYB, MONROE, KONI
- Transmission: LUK, SACHS, VALEO, AISIN

Category mappings (be flexible with synonyms):
- "brake pads", "brake disc", "brake rotor", "calipers" → category: "brakes"
- "oil filter", "air filter", "fuel filter", "cabin filter" → category: "filters"
- "shock absorber", "strut", "spring", "control arm" → category: "suspension"
- "spark plug", "ignition coil", "alternator", "starter" → category: "electrical"
- "water pump", "thermostat", "radiator", "cooling fan" → category: "cooling"
- "piston", "valve", "timing belt", "engine mount" → category: "engine"
- "clutch kit", "gearbox", "cv joint", "driveshaft" → category: "transmission"
- "power steering pump", "tie rod", "rack and pinion" → category: "steering"
- "muffler", "catalytic converter", "exhaust manifold" → category: "exhaust"
- "wheel bearing", "hub assembly", "tire", "rim" → category: "wheels"

Price interpretation:
- "cheap", "budget", "affordable" → maxPrice: 100
- "mid-range", "moderate" → minPrice: 100, maxPrice: 500
- "premium", "high-end", "expensive" → minPrice: 500
- "under $X" or "below $X" → maxPrice: X
- "over $X" or "above $X" → minPrice: X
- "X USD", "X dollars", "$X" → priceCurrency: "USD"
- "X EUR", "X euros", "€X" → priceCurrency: "EUR"
- "X AED", "X dirhams" → priceCurrency: "AED"
- Default priceCurrency is "USD" if not specified

Delivery interpretation:
- "urgent", "express", "fast", "quick" → deliveryDays: 3
- "soon", "this week" → deliveryDays: 7
- "standard" → deliveryDays: 14

Stock interpretation:
- "available", "in stock", "ready" → inStock: true
- "low stock", "limited" → stockStatus: "low-stock"

Respond ONLY with this exact JSON structure (no markdown, no code blocks):
{
  "searchTerms": [],
  "filters": {},
  "intent": "",
  "suggestions": []
}`;

/**
 * Parse a natural language query into structured search parameters
 * @param {string} query - The user's natural language query
 * @returns {Promise<Object>} Parsed search parameters
 */
async function parseSearchQuery(query) {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}

Parse this parts search query and extract filters: "${query}"

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks, no explanations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });
    
    let text = response.text.trim();
    
    // Clean up the response - remove any markdown code blocks
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    
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
      searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
      filters: normalizeFilters(parsed.filters || {}),
      intent: parsed.intent || 'Search for parts',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      rawResponse: parsed,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Fallback to basic keyword extraction
    return {
      success: false,
      searchTerms: extractBasicKeywords(query),
      filters: extractBasicFilters(query),
      intent: 'Search for parts matching your query',
      suggestions: ['Try being more specific', 'Include brand names or part numbers'],
      error: error.message,
    };
  }
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
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    
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
    const prices = results.filter(r => r.price).map(r => r.price);
    const brands = [...new Set(results.filter(r => r.brand).map(r => r.brand))];
    const suppliers = [...new Set(results.filter(r => r.supplier).map(r => r.supplier))];
    const inStock = results.filter(r => r.quantity > 0).length;
    
    const stats = {
      totalResults: results.length,
      inStock,
      outOfStock: results.length - inStock,
      uniqueBrands: brands.length,
      uniqueSuppliers: suppliers.length,
      priceRange: prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
      } : null,
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
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    
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
 */
function normalizeFilters(filters) {
  const normalized = {};
  
  if (filters.brand) {
    normalized.brand = Array.isArray(filters.brand) ? filters.brand : [filters.brand];
  }
  if (filters.supplier) {
    normalized.supplier = filters.supplier;
  }
  if (filters.minPrice !== undefined && !isNaN(filters.minPrice)) {
    normalized.minPrice = Number(filters.minPrice);
  }
  if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
    normalized.maxPrice = Number(filters.maxPrice);
  }
  if (filters.inStock !== undefined) {
    normalized.inStock = Boolean(filters.inStock);
  }
  if (filters.category) {
    normalized.category = filters.category;
  }
  if (filters.stockStatus) {
    normalized.stockStatus = filters.stockStatus;
  }
  if (filters.deliveryDays !== undefined && !isNaN(filters.deliveryDays)) {
    normalized.deliveryDays = Number(filters.deliveryDays);
  }
  if (filters.condition && filters.condition !== 'all') {
    normalized.condition = filters.condition;
  }
  if (filters.sortBy) {
    normalized.sortBy = filters.sortBy;
  }
  if (filters.sortOrder) {
    normalized.sortOrder = filters.sortOrder;
  }
  // Preserve the price currency for accurate filtering
  if (filters.priceCurrency) {
    normalized.priceCurrency = filters.priceCurrency.toUpperCase();
  } else {
    normalized.priceCurrency = 'USD'; // Default to USD
  }
  
  return normalized;
}

/**
 * Basic keyword extraction fallback
 */
function extractBasicKeywords(query) {
  const stopWords = ['find', 'me', 'show', 'get', 'looking', 'for', 'need', 'want', 'the', 'a', 'an', 'some', 'with', 'from', 'i', 'am', 'please', 'can', 'you'];
  const words = query.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  return [...new Set(words)].slice(0, 5);
}

/**
 * Basic filter extraction fallback
 */
function extractBasicFilters(query) {
  const filters = {};
  const queryLower = query.toLowerCase();
  
  // Currency extraction - detect what currency user is searching in
  // Default to USD if not specified
  filters.priceCurrency = 'USD';
  if (queryLower.match(/\b(aed|dirham|dirhams)\b/)) {
    filters.priceCurrency = 'AED';
  } else if (queryLower.match(/\b(eur|euro|euros|€)\b/)) {
    filters.priceCurrency = 'EUR';
  } else if (queryLower.match(/\b(gbp|pound|pounds|£)\b/)) {
    filters.priceCurrency = 'GBP';
  } else if (queryLower.match(/\b(usd|dollar|dollars|\$)\b/)) {
    filters.priceCurrency = 'USD';
  }
  
  // Price extraction - enhanced patterns
  const priceUnderMatch = queryLower.match(/under\s*\$?\s*(\d+)|below\s*\$?\s*(\d+)|less\s+than\s*\$?\s*(\d+)|max\s*\$?\s*(\d+)|(\d+)\s*(usd|dollars?|eur|euro|aed|dirhams?)\s*(or\s+less|max)?/i);
  if (priceUnderMatch) {
    const price = priceUnderMatch[1] || priceUnderMatch[2] || priceUnderMatch[3] || priceUnderMatch[4] || priceUnderMatch[5];
    if (price) {
      filters.maxPrice = parseInt(price);
    }
  }
  
  const priceOverMatch = queryLower.match(/over\s*\$?\s*(\d+)|above\s*\$?\s*(\d+)|more\s+than\s*\$?\s*(\d+)|min\s*\$?\s*(\d+)|at\s+least\s*\$?\s*(\d+)/);
  if (priceOverMatch) {
    filters.minPrice = parseInt(priceOverMatch[1] || priceOverMatch[2] || priceOverMatch[3] || priceOverMatch[4] || priceOverMatch[5]);
  }
  
  // Price range extraction (e.g., "$10 to $50", "between 10 and 50")
  const priceRangeMatch = queryLower.match(/\$?\s*(\d+)\s*(?:to|-|and)\s*\$?\s*(\d+)/);
  if (priceRangeMatch) {
    filters.minPrice = parseInt(priceRangeMatch[1]);
    filters.maxPrice = parseInt(priceRangeMatch[2]);
  }
  
  // Brand extraction
  const brands = ['bosch', 'skf', 'denso', 'valeo', 'brembo', 'gates', 'continental', 'mann', 'mahle', 'sachs', 'bilstein', 'kyb'];
  const foundBrands = brands.filter(brand => queryLower.includes(brand));
  if (foundBrands.length > 0) {
    filters.brand = foundBrands.map(b => b.toUpperCase());
  }
  
  // Stock extraction
  if (queryLower.includes('in stock') || queryLower.includes('available') || queryLower.includes('ready')) {
    filters.inStock = true;
  }
  
  // Category extraction
  const categoryMappings = {
    'brake': 'brakes',
    'filter': 'filters',
    'suspension': 'suspension',
    'shock': 'suspension',
    'electrical': 'electrical',
    'engine': 'engine',
    'transmission': 'transmission',
    'cooling': 'cooling',
    'steering': 'steering',
    'exhaust': 'exhaust',
    'wheel': 'wheels',
  };
  
  for (const [keyword, category] of Object.entries(categoryMappings)) {
    if (queryLower.includes(keyword)) {
      filters.category = category;
      break;
    }
  }
  
  return filters;
}

module.exports = {
  parseSearchQuery,
  generateSuggestions,
  analyzeResults,
};

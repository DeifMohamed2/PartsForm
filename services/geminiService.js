/**
 * Gemini AI Service
 * Intelligent parts search and filtering using Google's Gemini API
 */
const { GoogleGenAI } = require('@google/genai');

// Validate GEMINI_API_KEY is set
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('   AI-powered search features will not work without it.');
}

// Initialize the Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System instruction for the AI model - optimized for parts search
const SYSTEM_INSTRUCTION = `You are an intelligent automotive parts search assistant for PartsForm, a B2B industrial parts marketplace. Your role is to understand natural language search queries and convert them into structured search filters and search terms.

IMPORTANT: You MUST respond ONLY with valid JSON. No explanations, no markdown, no code blocks - just pure JSON.

When a user describes what they're looking for, analyze their query and extract:

1. **searchTerms**: Array of part numbers or keywords to search for
   - CRITICAL: ALWAYS correct spelling mistakes and typos before adding to searchTerms
   - "porchhe" → use "PORSCHE" in searchTerms
   - "bremb" → use "BREMBO" in searchTerms
   - "toyta" → use "TOYOTA" in searchTerms
   - Use the CORRECT spelling in searchTerms, not the user's misspelled input
   - Brand names should be UPPERCASE in searchTerms
   
2. **filters**: Object containing filter parameters:
   - brand: Array of brand names (e.g., ["BOSCH", "SKF", "DENSO"]) - ALWAYS use correct spelling
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

3. **intent**: String describing what the user is looking for (can mention you corrected a spelling)
4. **suggestions**: Array of helpful tips or alternative searches

Common brand mappings (use these correct spellings):
- Car manufacturers: PORSCHE, TOYOTA, HONDA, BMW, MERCEDES, AUDI, VOLKSWAGEN, FORD, CHEVROLET, NISSAN, HYUNDAI, KIA, MAZDA, SUBARU, LEXUS, INFINITI, ACURA, JAGUAR, LAND ROVER, VOLVO, FIAT, ALFA ROMEO, MASERATI, FERRARI, LAMBORGHINI, BENTLEY, ROLLS ROYCE, ASTON MARTIN, MCLAREN, BUGATTI
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

SPELLING CORRECTION EXAMPLES:
- "porchhe parts" → searchTerms: ["PORSCHE"], filters.brand: ["PORSCHE"]
- "bosh spark plug" → searchTerms: ["BOSCH", "spark plug"], filters.brand: ["BOSCH"]
- "toyta camry brakes" → searchTerms: ["TOYOTA", "CAMRY", "brakes"], filters.brand: ["TOYOTA"], filters.category: "brakes"
- "merceeds benz oil filter" → searchTerms: ["MERCEDES", "oil filter"], filters.brand: ["MERCEDES"], filters.category: "filters"

Respond ONLY with this exact JSON structure (no markdown, no code blocks):
{
  "searchTerms": [],
  "filters": {},
  "intent": "",
  "suggestions": []
}`;

// Constants for service configuration
const PARSE_TIMEOUT = 10000; // 10 second timeout for AI parsing
const MAX_RETRIES = 1; // Only retry once on failure

/**
 * Parse a natural language query into structured search parameters
 * @param {string} query - The user's natural language query
 * @returns {Promise<Object>} Parsed search parameters
 */
async function parseSearchQuery(query) {
  const startTime = Date.now();
  
  try {
    // Quick validation
    if (!query || query.trim().length < 2) {
      return createFallbackResponse(query, 'Query too short');
    }
    
    const prompt = `${SYSTEM_INSTRUCTION}

Parse this parts search query and extract filters: "${query}"

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks, no explanations.`;

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_PARSE_TIMEOUT')), PARSE_TIMEOUT);
    });

    // Race between AI call and timeout
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 512, // Reduced for faster response
        },
      }),
      timeoutPromise,
    ]);
    
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
    
    const parseTime = Date.now() - startTime;
    console.log(`✅ AI parsed query in ${parseTime}ms`);
    
    // Validate and normalize the response
    return {
      success: true,
      searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
      filters: normalizeFilters(parsed.filters || {}),
      intent: parsed.intent || 'Search for parts',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      rawResponse: parsed,
      parseTime,
    };
  } catch (error) {
    const parseTime = Date.now() - startTime;
    const isTimeout = error.message === 'AI_PARSE_TIMEOUT';
    
    console.warn(`⚠️ Gemini API ${isTimeout ? 'timeout' : 'error'} after ${parseTime}ms:`, error.message);
    
    // Return fast fallback response
    return createFallbackResponse(query, error.message);
  }
}

/**
 * Create a fallback response using basic parsing
 */
function createFallbackResponse(query, errorReason) {
  return {
    success: false,
    searchTerms: extractBasicKeywords(query),
    filters: extractBasicFilters(query),
    intent: `Searching for: "${query}"`,
    suggestions: ['Try being more specific', 'Include brand names or part numbers'],
    error: errorReason,
    usedFallback: true,
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
 * Basic keyword extraction fallback - Fast and efficient
 */
function extractBasicKeywords(query) {
  if (!query) return [];
  
  const stopWords = new Set(['find', 'me', 'show', 'get', 'looking', 'for', 'need', 'want', 'the', 'a', 'an', 'some', 'with', 'from', 'i', 'am', 'please', 'can', 'you', 'under', 'below', 'above', 'over', 'price', 'priced', 'less', 'more', 'than', 'and', 'or', 'parts', 'part']);
  
  // Known brands to preserve
  const knownBrands = new Set(['bosch', 'skf', 'denso', 'valeo', 'brembo', 'gates', 'continental', 'mann', 'mahle', 'sachs', 'bilstein', 'kyb', 'monroe', 'koni', 'toyota', 'honda', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'ford', 'chevrolet', 'hyundai', 'kia', 'acdelco', 'motorcraft', 'mopar', 'ntn', 'fag', 'timken', 'nsk', 'ngk', 'delphi', 'aisin', 'luk']);
  
  // Important part keywords
  const importantKeywords = new Set(['brake', 'brakes', 'filter', 'oil', 'air', 'fuel', 'engine', 'suspension', 'steering', 'transmission', 'clutch', 'alternator', 'starter', 'radiator', 'bearing', 'pump', 'valve', 'piston', 'gasket', 'belt', 'hose', 'sensor', 'shock', 'strut', 'rotor', 'caliper', 'pad', 'disc', 'wheel', 'tire', 'hub', 'axle', 'seal', 'mount', 'bushing', 'link', 'arm', 'rod', 'exhaust', 'muffler', 'injector', 'coil', 'spark', 'plug', 'battery']);
  
  const words = query.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => {
      if (word.length < 2) return false;
      if (stopWords.has(word)) return false;
      // Keep brands, important keywords, or longer words
      return knownBrands.has(word) || importantKeywords.has(word) || word.length > 3;
    });
  
  return [...new Set(words)].slice(0, 6);
}

/**
 * Basic filter extraction fallback - Fast and comprehensive
 */
function extractBasicFilters(query) {
  if (!query) return { priceCurrency: 'USD' };
  
  const filters = { priceCurrency: 'USD' };
  const queryLower = query.toLowerCase();
  
  // Currency extraction - detect what currency user is searching in
  if (queryLower.match(/\b(aed|dirham|dirhams)\b/)) {
    filters.priceCurrency = 'AED';
  } else if (queryLower.match(/\b(eur|euro|euros|€)\b/)) {
    filters.priceCurrency = 'EUR';
  } else if (queryLower.match(/\b(gbp|pound|pounds|£)\b/)) {
    filters.priceCurrency = 'GBP';
  }
  
  // Price extraction - comprehensive patterns
  // Match: "under $100", "below 100", "less than $500", "max $200", "100 USD or less"
  const maxPriceMatch = queryLower.match(/(?:under|below|less\s+than|max|cheaper\s+than)\s*\$?\s*(\d+)|(\d+)\s*(?:usd|dollars?|eur|euro|aed|dirhams?)\s*(?:or\s+less|max)/i);
  if (maxPriceMatch) {
    const price = maxPriceMatch[1] || maxPriceMatch[2];
    if (price) filters.maxPrice = parseInt(price);
  }
  
  // Match: "over $100", "above 100", "more than $500", "min $200", "at least 100"
  const minPriceMatch = queryLower.match(/(?:over|above|more\s+than|min|at\s+least)\s*\$?\s*(\d+)/);
  if (minPriceMatch) {
    filters.minPrice = parseInt(minPriceMatch[1]);
  }
  
  // Price range: "$10 to $50", "between 10 and 50", "$100-$500"
  const priceRangeMatch = queryLower.match(/\$?\s*(\d+)\s*(?:to|-|and)\s*\$?\s*(\d+)/);
  if (priceRangeMatch && !filters.maxPrice && !filters.minPrice) {
    filters.minPrice = parseInt(priceRangeMatch[1]);
    filters.maxPrice = parseInt(priceRangeMatch[2]);
  }
  
  // Brand extraction - expanded list
  const knownBrands = ['bosch', 'skf', 'denso', 'valeo', 'brembo', 'gates', 'continental', 'mann', 'mahle', 'sachs', 'bilstein', 'kyb', 'monroe', 'toyota', 'honda', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'ford', 'chevrolet', 'hyundai', 'kia', 'acdelco', 'ntn', 'fag', 'timken', 'ngk', 'delphi', 'aisin'];
  const foundBrands = knownBrands.filter(brand => {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    return regex.test(queryLower);
  });
  if (foundBrands.length > 0) {
    filters.brand = foundBrands.map(b => b.toUpperCase());
  }
  
  // Stock extraction
  if (queryLower.match(/\b(in\s*stock|available|ready|have)\b/)) {
    filters.inStock = true;
  }
  
  // Delivery extraction
  if (queryLower.match(/\b(fast|express|urgent|quick|asap)\b/)) {
    filters.deliveryDays = 3;
  } else if (queryLower.match(/\b(soon|this\s*week)\b/)) {
    filters.deliveryDays = 7;
  }
  
  // Category extraction - with word boundaries
  const categoryMappings = [
    { patterns: ['brake', 'brakes', 'rotor', 'caliper', 'pad'], category: 'brakes' },
    { patterns: ['filter', 'oil filter', 'air filter', 'fuel filter'], category: 'filters' },
    { patterns: ['suspension', 'shock', 'strut', 'spring', 'control arm'], category: 'suspension' },
    { patterns: ['electrical', 'alternator', 'starter', 'battery', 'fuse'], category: 'electrical' },
    { patterns: ['engine', 'piston', 'valve', 'timing', 'camshaft'], category: 'engine' },
    { patterns: ['transmission', 'clutch', 'gearbox', 'cv joint'], category: 'transmission' },
    { patterns: ['cooling', 'radiator', 'thermostat', 'water pump'], category: 'cooling' },
    { patterns: ['steering', 'tie rod', 'rack', 'power steering'], category: 'steering' },
    { patterns: ['exhaust', 'muffler', 'catalytic', 'manifold'], category: 'exhaust' },
    { patterns: ['wheel', 'tire', 'hub', 'bearing'], category: 'wheels' },
  ];
  
  for (const { patterns, category } of categoryMappings) {
    if (patterns.some(p => queryLower.includes(p))) {
      filters.category = category;
      break;
    }
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
    const dataPreview = limitedData.map((row, idx) => {
      if (Array.isArray(row)) {
        return `Row ${idx + 1}: ${row.map(cell => cell ?? '').join(' | ')}`;
      } else if (typeof row === 'object') {
        return `Row ${idx + 1}: ${Object.values(row).map(v => v ?? '').join(' | ')}`;
      }
      return `Row ${idx + 1}: ${row}`;
    }).join('\n');

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
      summary: parsed.summary || `Found ${parsed.parts?.length || 0} parts in the spreadsheet`,
      totalPartsFound: parsed.parts?.length || 0,
      parts: Array.isArray(parsed.parts) ? parsed.parts.map(part => ({
        partNumber: String(part.partNumber || '').trim().toUpperCase(),
        quantity: parseInt(part.quantity, 10) || 1,
        brand: part.brand || null,
        description: part.description || null,
        originalText: part.originalText || null,
        confidence: part.confidence || 'medium',
        selected: true, // Default to selected for search
      })) : [],
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
    const allMatches = [...new Set([...alphanumericMatches, ...numericMatches])];
    
    for (const match of allMatches) {
      // Skip common non-part-number patterns
      if (/^(ROW|COL|SHEET|TABLE|TOTAL|SUM|COUNT|QTY|QUANTITY|PRICE|BRAND|NAME|DESC)/i.test(match)) {
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
  const uniqueParts = parts.filter((part, index, self) => 
    index === self.findIndex(p => p.partNumber === part.partNumber)
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
      const scored = options.map(opt => {
        let score = 0;
        
        // Prefer in-stock items
        if (opt.quantity >= requested.quantity) score += 50;
        else if (opt.quantity > 0) score += 25;
        
        // Lower price is better (normalize to 0-25 range)
        if (opt.price) {
          const maxPrice = Math.max(...options.map(o => o.price || 0));
          if (maxPrice > 0) {
            score += 25 * (1 - (opt.price / maxPrice));
          }
        }
        
        // Faster delivery is better
        if (opt.deliveryDays) {
          score += Math.max(0, 15 - opt.deliveryDays);
        }
        
        // Known brands get bonus
        const knownBrands = ['BOSCH', 'SKF', 'DENSO', 'VALEO', 'BREMBO', 'MANN', 'MAHLE', 'GATES'];
        if (opt.brand && knownBrands.includes(opt.brand.toUpperCase())) {
          score += 10;
        }
        
        return { ...opt, score };
      }).sort((a, b) => b.score - a.score);

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
        alternatives: alternatives.map(alt => ({
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
        found: recommendations.filter(r => r.found).length,
        notFound: recommendations.filter(r => !r.found).length,
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
  generateSuggestions,
  analyzeResults,
  analyzeExcelData,
  recommendBestParts,
};

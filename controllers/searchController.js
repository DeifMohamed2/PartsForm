/**
 * Search Controller
 * Handles product search API endpoints for buyers
 * IMPORTANT: Search is by EXACT part number only - returns all suppliers for that part number
 */
const Part = require('../models/Part');
const elasticsearchService = require('../services/elasticsearchService');
const geminiService = require('../services/geminiService');

/**
 * Search parts by EXACT part number
 * GET /api/search
 * Returns all parts with the exact same part number from different suppliers
 */
const searchParts = async (req, res) => {
  try {
    const {
      q: query,
      page = 1,
      limit = 100,
      sortBy = 'price',
      sortOrder = 'asc',
      brand,
      supplier,
      minPrice,
      maxPrice,
      inStock,
    } = req.query;

    if (!query || !query.trim()) {
      return res.json({
        success: true,
        query: '',
        results: [],
        total: 0,
        page: 1,
        limit: parseInt(limit, 10),
        totalPages: 0,
        hasMore: false,
      });
    }

    const partNumber = query.trim();
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const skip = (pageNum - 1) * limitNum;

    let results = [];
    let total = 0;
    let source = 'mongodb';

    // Use cached check - much faster than calling getStats() every time
    const useElasticsearch = await elasticsearchService.hasDocuments();

    // Use Elasticsearch if available AND has data
    if (useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchByExactPartNumber(
          partNumber,
          {
            limit: limitNum,
            skip,
            sortBy,
            sortOrder,
          },
        );
        results = esResult.results;
        total = esResult.total;
        source = 'elasticsearch';
      } catch (esError) {
        console.error(
          'Elasticsearch search failed, falling back to MongoDB:',
          esError.message,
        );
      }
    }

    // Fallback to MongoDB if Elasticsearch didn't work
    if (results.length === 0 && source === 'mongodb') {
      // EXACT part number match only (case-insensitive)
      const mongoQuery = {
        partNumber: {
          $regex: `^${partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      };

      const mongoResults = await Part.find(mongoQuery)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      total = await Part.countDocuments(mongoQuery);
      results = mongoResults;
    }

    // Apply additional filters (brand, supplier, price, stock) client-side if needed
    let filteredResults = results;

    if (brand) {
      filteredResults = filteredResults.filter(
        (p) => p.brand && p.brand.toLowerCase().includes(brand.toLowerCase()),
      );
    }
    if (supplier) {
      filteredResults = filteredResults.filter(
        (p) =>
          p.supplier &&
          p.supplier.toLowerCase().includes(supplier.toLowerCase()),
      );
    }
    if (minPrice !== undefined) {
      const min = parseFloat(minPrice);
      filteredResults = filteredResults.filter((p) => (p.price || 0) >= min);
    }
    if (maxPrice !== undefined) {
      const max = parseFloat(maxPrice);
      filteredResults = filteredResults.filter((p) => (p.price || 0) <= max);
    }
    if (inStock === 'true') {
      filteredResults = filteredResults.filter((p) => (p.quantity || 0) > 0);
    }

    res.json({
      success: true,
      query: partNumber,
      results: filteredResults,
      total: filteredResults.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filteredResults.length / limitNum),
      hasMore: skip + filteredResults.length < total,
      searchTime: null,
      source,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message,
    });
  }
};

/**
 * Autocomplete suggestions - Part Number Only
 * GET /api/search/autocomplete
 */
const autocomplete = async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 1) {
      return res.json({ success: true, suggestions: [] });
    }

    let suggestions;
    // Use cached check for speed
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      suggestions = await elasticsearchService.autocomplete(
        query,
        parseInt(limit, 10),
      );
    } else {
      // MongoDB fallback - Part Number Prefix Match Only
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Aggregate to get unique part numbers that START WITH the query
      const results = await Part.aggregate([
        {
          $match: {
            // Only match part numbers that START with the query (prefix match)
            partNumber: { $regex: `^${escapedQuery}`, $options: 'i' },
          },
        },
        {
          $group: {
            _id: '$partNumber',
            brand: { $first: '$brand' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: parseInt(limit, 10) },
      ]);

      suggestions = results.map((r) => ({
        partNumber: r._id,
        brand: r.brand,
        count: r.count,
      }));
    }

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ success: false, error: 'Autocomplete failed' });
  }
};

/**
 * Get filter options for search results
 * GET /api/search/filters
 */
const getFilterOptions = async (req, res) => {
  try {
    const { q: query } = req.query;

    let filterOptions;
    // Use cached check for speed
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      filterOptions = await elasticsearchService.getFilterOptions(query || '');
    } else {
      filterOptions = await Part.getFilterOptions(query || '');
    }

    res.json({
      success: true,
      filters: filterOptions,
    });
  } catch (error) {
    console.error('Filter options error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to get filter options' });
  }
};

/**
 * Get part by ID
 * GET /api/parts/:id
 */
const getPartById = async (req, res) => {
  try {
    const part = await Part.findById(req.params.id).lean();

    if (!part) {
      return res.status(404).json({ success: false, error: 'Part not found' });
    }

    res.json({
      success: true,
      part,
    });
  } catch (error) {
    console.error('Get part error:', error);
    res.status(500).json({ success: false, error: 'Failed to get part' });
  }
};

/**
 * Get parts by part number (multiple suppliers)
 * GET /api/parts/by-number/:partNumber
 */
const getPartsByNumber = async (req, res) => {
  try {
    const { partNumber } = req.params;
    const { limit = 50, sortBy = 'price', sortOrder = 'asc' } = req.query;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const parts = await Part.find({
      partNumber: { $regex: `^${partNumber}$`, $options: 'i' },
    })
      .sort(sort)
      .limit(parseInt(limit, 10))
      .lean();

    res.json({
      success: true,
      partNumber,
      count: parts.length,
      parts,
    });
  } catch (error) {
    console.error('Get parts by number error:', error);
    res.status(500).json({ success: false, error: 'Failed to get parts' });
  }
};

/**
 * Get search statistics
 * GET /api/search/stats
 */
const getSearchStats = async (req, res) => {
  try {
    const [totalParts, esStats] = await Promise.all([
      Part.estimatedDocumentCount(),
      elasticsearchService.isAvailable ? elasticsearchService.getStats() : null,
    ]);

    res.json({
      success: true,
      stats: {
        totalParts,
        elasticsearch: esStats,
        searchEngine: elasticsearchService.isAvailable
          ? 'elasticsearch'
          : 'mongodb',
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
};

/**
 * Search multiple parts at once - OPTIMIZED for speed
 * POST /api/search/multi
 * Body: { partNumbers: ['CAF-000267-KH', 'SAF-000033-BH', 'ICL-000013-AN'] }
 * or query string: ?q=CAF-000267-KH,SAF-000033-BH,ICL-000013-AN
 */
const searchMultipleParts = async (req, res) => {
  try {
    let partNumbers = [];

    // Accept part numbers from body or query string
    if (
      req.body &&
      req.body.partNumbers &&
      Array.isArray(req.body.partNumbers)
    ) {
      partNumbers = req.body.partNumbers;
    } else if (req.query.q) {
      // Parse comma or semicolon separated list
      partNumbers = req.query.q
        .split(/[,;]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    if (partNumbers.length === 0) {
      return res.json({
        success: true,
        results: [],
        total: 0,
        partNumbers: [],
        found: [],
        notFound: [],
      });
    }

    // Limit to 100 parts at once
    const originalCount = partNumbers.length;
    if (partNumbers.length > 100) {
      partNumbers = partNumbers.slice(0, 100);
    }

    console.log(
      `Searching for ${partNumbers.length} parts (from ${originalCount} requested)`,
    );
    const startTime = Date.now();

    let allResults = [];
    let found = [];
    let notFound = [];
    let source = 'mongodb';

    // Try Elasticsearch first (FAST bulk search)
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchMultiplePartNumbers(
          partNumbers,
          {
            limitPerPart: 50,
          },
        );

        allResults = esResult.results;
        found = esResult.found;
        notFound = esResult.notFound;
        source = 'elasticsearch';

        console.log(`ES bulk search completed in ${Date.now() - startTime}ms`);

        // Skip MongoDB fallback when ES is available - ES is the source of truth
        // Parts not in ES won't be in MongoDB either (they're synced)
      } catch (esError) {
        console.error('Elasticsearch multi-search failed:', esError.message);
      }
    }

    // Only use MongoDB if ES is NOT available (not as fallback for not-found parts)
    if (source === 'mongodb') {
      const partsToSearchInMongo = partNumbers;

      if (partsToSearchInMongo.length > 0) {
        console.log('Using MongoDB for search (ES not available)');

        // Use $in with exact matches instead of regex for speed
        const upperCaseParts = partsToSearchInMongo.map((pn) =>
          pn.trim().toUpperCase(),
        );
        const lowerCaseParts = partsToSearchInMongo.map((pn) =>
          pn.trim().toLowerCase(),
        );
        const originalParts = partsToSearchInMongo.map((pn) => pn.trim());

        // Combine all case variations
        const allVariations = [
          ...new Set([...upperCaseParts, ...lowerCaseParts, ...originalParts]),
        ];

        // Single MongoDB query with $in (faster than $or with regex)
        const mongoQuery = {
          partNumber: { $in: allVariations },
        };

        const mongoResults = await Part.find(mongoQuery).limit(1000).lean();

        if (mongoResults.length > 0) {
          // Determine which parts were found in MongoDB
          const mongoFoundParts = new Set();
          mongoResults.forEach((r) => {
            if (r.partNumber) {
              mongoFoundParts.add(r.partNumber.toUpperCase());
            }
          });

          // Update found/notFound for MongoDB results
          found = [];
          notFound = [];
          partNumbers.forEach((pn) => {
            if (mongoFoundParts.has(pn.trim().toUpperCase())) {
              found.push(pn);
            } else {
              notFound.push(pn);
            }
          });
          allResults = mongoResults;
        } else {
          notFound = partNumbers;
        }

        console.log(`MongoDB search completed in ${Date.now() - startTime}ms`);
      }
    }

    const searchTime = Date.now() - startTime;
    console.log(
      `Multi-search complete: ${found.length} found, ${notFound.length} not found, ${allResults.length} results in ${searchTime}ms`,
    );

    res.json({
      success: true,
      results: allResults,
      total: allResults.length,
      partNumbers: partNumbers,
      found: found,
      notFound: notFound,
      source,
      searchTime,
    });
  } catch (error) {
    console.error('Multi-search error:', error);
    res.status(500).json({
      success: false,
      error: 'Multi-search failed',
      message: error.message,
    });
  }
};

/**
 * AI-powered Excel analysis
 * POST /api/excel/analyze
 * Body: { data: [[...], [...]], filename: "parts.xlsx" }
 */
const aiExcelAnalyze = async (req, res) => {
  try {
    const { data, filename, sheetName } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Excel data array is required',
      });
    }

    if (data.length === 0) {
      return res.json({
        success: true,
        summary: 'Empty spreadsheet',
        totalPartsFound: 0,
        parts: [],
        dataQuality: {
          hasHeaders: false,
          formatting: 'empty',
          issues: ['The spreadsheet appears to be empty'],
        },
        suggestions: ['Please upload a spreadsheet with part numbers'],
      });
    }

    console.log(
      `📊 AI Excel Analysis: ${data.length} rows from ${filename || 'unknown file'}`,
    );
    const startTime = Date.now();

    // Use Gemini to analyze the Excel data
    const analysis = await geminiService.analyzeExcelData(data, {
      filename,
      sheetName: sheetName || 'Sheet1',
    });

    const analysisTime = Date.now() - startTime;
    console.log(
      `✅ Excel analysis completed in ${analysisTime}ms: ${analysis.totalPartsFound} parts found`,
    );

    res.json({
      success: true,
      ...analysis,
      analysisTime,
    });
  } catch (error) {
    console.error('AI Excel Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Excel analysis failed',
      message: error.message,
    });
  }
};

/**
 * AI-powered Excel search with recommendations
 * POST /api/excel/search
 * Body: { parts: [{ partNumber, quantity }, ...] }
 */
const aiExcelSearch = async (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Parts array is required',
      });
    }

    console.log(`🔍 AI Excel Search: ${parts.length} parts`);
    const startTime = Date.now();

    // Extract part numbers for search
    const partNumbers = parts.map((p) => p.partNumber).filter(Boolean);

    if (partNumbers.length === 0) {
      return res.json({
        success: true,
        results: [],
        recommendations: [],
        found: [],
        notFound: parts.map((p) => p.partNumber),
      });
    }

    // Limit to 100 parts
    const searchPartNumbers = partNumbers.slice(0, 100);

    let allResults = [];
    let found = [];
    let notFound = [];
    let source = 'mongodb';

    // Try Elasticsearch first (same approach as searchMultipleParts)
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchMultiplePartNumbers(
          searchPartNumbers,
          {
            limitPerPart: 50,
          },
        );
        allResults = esResult.results;
        found = esResult.found;
        notFound = esResult.notFound;
        source = 'elasticsearch';

        console.log(`ES Excel search completed in ${Date.now() - startTime}ms`);
      } catch (esError) {
        console.error('Elasticsearch Excel search failed:', esError.message);
        // Reset source to try MongoDB
        source = 'mongodb';
      }
    }

    // Fallback to MongoDB if ES not available or failed
    if (source === 'mongodb') {
      console.log('Using MongoDB for Excel search');

      // Use $in with exact matches instead of regex for speed (same as searchMultipleParts)
      const upperCaseParts = searchPartNumbers.map((pn) =>
        pn.trim().toUpperCase(),
      );
      const lowerCaseParts = searchPartNumbers.map((pn) =>
        pn.trim().toLowerCase(),
      );
      const originalParts = searchPartNumbers.map((pn) => pn.trim());

      // Combine all case variations
      const allVariations = [
        ...new Set([...upperCaseParts, ...lowerCaseParts, ...originalParts]),
      ];

      // Single MongoDB query with $in (faster than $or with regex)
      const mongoQuery = {
        partNumber: { $in: allVariations },
      };

      allResults = await Part.find(mongoQuery).limit(1000).lean();

      // Determine which parts were found
      const foundSet = new Set();
      allResults.forEach((r) => {
        if (r.partNumber) {
          foundSet.add(r.partNumber.toUpperCase());
        }
      });

      // Update found/notFound
      found = [];
      notFound = [];
      searchPartNumbers.forEach((pn) => {
        if (foundSet.has(pn.trim().toUpperCase())) {
          found.push(pn);
        } else {
          notFound.push(pn);
        }
      });

      console.log(
        `MongoDB Excel search completed in ${Date.now() - startTime}ms`,
      );
    }

    // Get AI recommendations for best parts
    const recommendations = await geminiService.recommendBestParts(
      allResults,
      parts,
    );

    const searchTime = Date.now() - startTime;
    console.log(
      `✅ Excel search completed in ${searchTime}ms: ${allResults.length} results for ${found.length} parts`,
    );

    res.json({
      success: true,
      results: allResults,
      recommendations: recommendations.recommendations,
      stats: recommendations.stats,
      found,
      notFound,
      source,
      searchTime,
    });
  } catch (error) {
    console.error('AI Excel Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Excel search failed',
      message: error.message,
    });
  }
};

module.exports = {
  searchParts,
  autocomplete,
  getFilterOptions,
  getPartById,
  getPartsByNumber,
  getSearchStats,
  searchMultipleParts,
  aiSearch,
  aiSuggestions,
  aiAnalyze,
  aiExcelAnalyze,
  aiExcelSearch,
};

/**
 * Exchange rates for currency conversion in AI search
 * Database stores prices in AED by default, but users search in USD
 * Rates are approximate - for accurate pricing, frontend uses live API
 */
const EXCHANGE_RATES = {
  USD: 1,
  AED: 3.67, // 1 USD = 3.67 AED
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CNY: 7.24,
};

/**
 * Convert price from one currency to another
 * @param {number} amount - The amount to convert
 * @param {string} fromCurrency - Source currency (e.g., 'USD')
 * @param {string} toCurrency - Target currency (e.g., 'AED')
 * @returns {number} - Converted amount
 */
function convertCurrency(amount, fromCurrency = 'USD', toCurrency = 'AED') {
  if (!amount || isNaN(amount)) return amount;
  if (fromCurrency === toCurrency) return amount;

  // Get rates (relative to USD as base)
  const fromRate = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1;
  const toRate = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1;

  // Convert: amount in fromCurrency -> USD -> toCurrency
  const amountInUSD = amount / fromRate;
  const converted = amountInUSD * toRate;

  return Math.round(converted * 100) / 100; // Round to 2 decimals
}

// Track active AI search requests to prevent duplicates
const activeAISearches = new Map();
const AI_SEARCH_TIMEOUT = 15000; // 15 second timeout for AI parsing
const DB_QUERY_TIMEOUT = 10000; // 10 second timeout for database queries

/**
 * AI-powered search - Parse natural language and search
 * POST /api/ai-search
 * Body: { query: "Find Bosch brake pads under $500" }
 */
async function aiSearch(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.json({
        success: false,
        error: 'Please enter a search query',
        results: [],
        total: 0,
        message: 'Enter a part number, brand name, or describe what you need.',
      });
    }

    // Check for duplicate active request with same query
    const normalizedQuery = query.trim().toLowerCase();
    if (activeAISearches.has(normalizedQuery)) {
      console.log(`⚡ Duplicate AI search request detected: "${query}"`);
      // Wait for existing request or timeout
      const existingRequest = activeAISearches.get(normalizedQuery);
      if (Date.now() - existingRequest.startTime < AI_SEARCH_TIMEOUT) {
        return res.json({
          success: false,
          error: 'Search in progress',
          message: 'Please wait for the current search to complete.',
          results: [],
          total: 0,
        });
      }
    }

    // Register this search as active
    activeAISearches.set(normalizedQuery, { requestId, startTime: Date.now() });

    console.log(`🤖 AI Search [${requestId}]: "${query}"`);
    const startTime = Date.now();

    // Step 1: Parse the natural language query using Gemini with timeout
    let parsed;
    try {
      const parsePromise = geminiService.parseSearchQuery(query);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('AI_PARSE_TIMEOUT')),
          AI_SEARCH_TIMEOUT,
        ),
      );
      parsed = await Promise.race([parsePromise, timeoutPromise]);
      console.log('AI parsed query:', JSON.stringify(parsed, null, 2));

      // Enhanced logging for stock-related filters
      if (parsed.filters) {
        const stockInfo = {
          inStock: parsed.filters.inStock,
          stockLevel: parsed.filters.stockLevel,
          minQuantity: parsed.filters.minQuantity,
          excludeStockLevels: parsed.filters.exclude?.stockLevels,
        };
        console.log(
          '📦 Stock filters detected:',
          JSON.stringify(stockInfo, null, 2),
        );
      }
    } catch (parseError) {
      console.warn(`⚠️ AI parsing failed/timeout: ${parseError.message}`);
      // Use fast fallback parsing
      parsed = {
        success: false,
        searchTerms: extractBasicKeywordsFromQuery(query),
        filters: extractBasicFiltersFromQuery(query),
        intent: `Searching for: "${query}"`,
        suggestions: [
          'Try being more specific',
          'Include brand names or part numbers',
        ],
      };
    }

    // Step 2: Build search parameters from AI output
    // Filter out generic/useless search terms that would match too many results
    const genericWords = new Set([
      'parts',
      'part',
      'find',
      'get',
      'show',
      'search',
      'looking',
      'need',
      'want',
      'items',
      'products',
      'all',
      'any',
      'some',
      'oem',
      'original',
      'genuine',
      'new',
      'used',
      'verified',
      'suppliers',
      'supplier',
      'from',
      'for',
      'the',
      'and',
      'with',
      'under',
      'below',
      'above',
      'over',
      'price',
      'priced',
      'quality',
      'best',
      'good',
    ]);

    // Important automotive keywords that should be kept even if they seem generic
    const importantKeywords = new Set([
      'brake',
      'brakes',
      'engine',
      'filter',
      'oil',
      'air',
      'fuel',
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
      'cv',
      'joint',
      'seal',
      'mount',
      'bushing',
      'link',
      'arm',
      'rod',
      'rack',
      'pinion',
      'exhaust',
      'muffler',
      'catalytic',
      'converter',
      'manifold',
      'injector',
      'coil',
      'plug',
      'spark',
      'battery',
      'fuse',
      'relay',
      'switch',
      'motor',
      'compressor',
      'condenser',
      'evaporator',
      'heater',
      'blower',
      'wiper',
      'mirror',
      'light',
      'lamp',
      'bulb',
      'headlight',
      'taillight',
      'indicator',
      'door',
      'window',
      'glass',
      'bumper',
      'fender',
      'hood',
      'trunk',
      'panel',
      'trim',
      'carpet',
      'seat',
      'console',
      'dashboard',
      'gauge',
      'cluster',
      'clock',
      'radio',
      'speaker',
      'antenna',
      'cable',
      'wire',
      'harness',
      'connector',
      'terminal',
      'clip',
      'bolt',
      'nut',
      'screw',
      'washer',
      'clamp',
      'bracket',
      'spring',
      'damper',
    ]);

    // Known brand names that should always be kept
    const knownBrands = new Set([
      'bosch',
      'brembo',
      'denso',
      'valeo',
      'skf',
      'fag',
      'timken',
      'nsk',
      'ntn',
      'mann',
      'mahle',
      'sachs',
      'bilstein',
      'kyb',
      'monroe',
      'koni',
      'gates',
      'continental',
      'delphi',
      'aisin',
      'luk',
      'ngk',
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
      'acdelco',
      'motorcraft',
      'mopar',
    ]);

    // Split compound terms and filter intelligently
    let searchTerms = [];
    for (const term of parsed.searchTerms || []) {
      const words = term.toLowerCase().trim().split(/\s+/);
      for (const word of words) {
        const cleanWord = word.replace(/[^a-z0-9-]/g, '');
        if (cleanWord.length < 2) continue;
        if (searchTerms.includes(cleanWord)) continue;

        // Keep if it's an important keyword, known brand, or not generic
        if (
          importantKeywords.has(cleanWord) ||
          knownBrands.has(cleanWord) ||
          !genericWords.has(cleanWord)
        ) {
          searchTerms.push(cleanWord);
        }
      }
    }

    const filters = parsed.filters || {};

    let allResults = [];
    let source = 'mongodb';
    let isGenericSearch = searchTerms.length === 0; // Flag for broad searches

    console.log(
      `🔍 Filtered search terms: [${searchTerms.join(', ')}], isGenericSearch: ${isGenericSearch}`,
    );

    // Step 3: Search for parts
    const useElasticsearch = await elasticsearchService.hasDocuments();

    // If we have specific search terms (part numbers/keywords), search for them
    if (searchTerms.length > 0) {
      if (useElasticsearch) {
        try {
          // Search for multiple part numbers/terms
          const esResult = await elasticsearchService.searchMultiplePartNumbers(
            searchTerms,
            {
              limitPerPart: 100,
            },
          );
          allResults = esResult.results;
          source = 'elasticsearch';
        } catch (esError) {
          console.error('ES AI search failed:', esError.message);
        }
      }

      // MongoDB fallback
      if (allResults.length === 0) {
        for (const term of searchTerms.slice(0, 5)) {
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mongoResults = await Part.find({
            $or: [
              { partNumber: { $regex: escapedTerm, $options: 'i' } },
              { description: { $regex: escapedTerm, $options: 'i' } },
              { brand: { $regex: escapedTerm, $options: 'i' } },
            ],
          })
            .limit(100)
            .lean();
          allResults.push(...mongoResults);
        }
      }
    }

    // If no results from search terms OR no search terms provided, fetch parts to filter
    if (allResults.length === 0) {
      const searchQuery = {};

      // Build query based on filters
      if (filters.category) {
        searchQuery.$or = [
          { category: { $regex: filters.category, $options: 'i' } },
          { description: { $regex: filters.category, $options: 'i' } },
        ];
      }

      // If we still have search terms that didn't match, try searching in description
      if (searchTerms.length > 0 && !filters.category) {
        const termPatterns = searchTerms.map((t) => new RegExp(t, 'i'));
        searchQuery.$or = [
          { description: { $in: termPatterns } },
          { brand: { $in: termPatterns } },
          { category: { $in: termPatterns } },
        ];
      }

      if (filters.brand && filters.brand.length > 0) {
        const brandRegex = filters.brand.map((b) => new RegExp(b, 'i'));
        searchQuery.brand = { $in: brandRegex };
      }

      // If we have price filters, convert from USD to AED for database query
      // User searches in USD (e.g., "under 100 USD") but DB stores prices in AED
      const userCurrency = filters.priceCurrency || 'USD';
      const dbCurrency = 'AED'; // Database default currency

      if (filters.maxPrice !== undefined) {
        const convertedMaxPrice = convertCurrency(
          filters.maxPrice,
          userCurrency,
          dbCurrency,
        );
        searchQuery.price = { ...searchQuery.price, $lte: convertedMaxPrice };
        console.log(
          `💱 Price filter: max ${filters.maxPrice} ${userCurrency} → ${convertedMaxPrice} ${dbCurrency}`,
        );
      }
      if (filters.minPrice !== undefined) {
        const convertedMinPrice = convertCurrency(
          filters.minPrice,
          userCurrency,
          dbCurrency,
        );
        searchQuery.price = { ...searchQuery.price, $gte: convertedMinPrice };
        console.log(
          `💱 Price filter: min ${filters.minPrice} ${userCurrency} → ${convertedMinPrice} ${dbCurrency}`,
        );
      }

      // If we have stock filter, only get in-stock items
      if (filters.inStock || filters.stockStatus === 'in-stock') {
        searchQuery.quantity = { $gt: 0 };
      }

      console.log('Fetching parts with query:', JSON.stringify(searchQuery));

      // Use a timeout to prevent long-running queries
      const queryPromise = Part.find(searchQuery).limit(500).lean();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000),
      );

      try {
        allResults = await Promise.race([queryPromise, timeoutPromise]);
      } catch (queryError) {
        console.warn(
          'Query timed out or failed, fetching with price filter only',
        );
        // Fallback: just use price filter
        const fallbackQuery = {};
        if (searchQuery.price) fallbackQuery.price = searchQuery.price;
        allResults = await Part.find(fallbackQuery).limit(200).lean();
      }

      source = 'mongodb-filtered';
    }

    // Step 4: Apply AI-extracted filters to results
    // ═══════════════════════════════════════════════════════════════
    // INTELLIGENT ADAPTIVE FILTERING SYSTEM
    // Instead of strict filtering that returns 0 results, we use:
    // 1. HARD filters (price) - must match
    // 2. SOFT filters (stock, category) - prefer but don't exclude
    // 3. Progressive relaxation - if 0 results, explain why
    // ═══════════════════════════════════════════════════════════════

    let filteredResults = [...allResults];
    const appliedFilters = [];
    const relaxedFilters = [];
    const filterStats = {};

    // ═══════════════════════════════════════════════════════════════
    // SMART BRAND DETECTION from rawResponse
    // ═══════════════════════════════════════════════════════════════
    const rawFilters = parsed.rawResponse?.filters || {};
    const queryLower = query.toLowerCase();
    const hasOemIntent = queryLower.match(/\b(oem|genuine|original)\b/);

    if (
      hasOemIntent &&
      rawFilters.vehicleBrand &&
      (!filters.brand || filters.brand.length === 0)
    ) {
      filters.brand = [rawFilters.vehicleBrand.toUpperCase()];
      console.log(
        `🔧 OEM intent detected: treating vehicleBrand '${rawFilters.vehicleBrand}' as brand filter`,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER: Apply filter with fallback
    // ═══════════════════════════════════════════════════════════════
    const applyFilterSmart = (
      results,
      filterFn,
      filterName,
      isHardFilter = false,
    ) => {
      const filtered = results.filter(filterFn);
      const beforeCount = results.length;
      const afterCount = filtered.length;

      filterStats[filterName] = { before: beforeCount, after: afterCount };

      if (afterCount > 0) {
        appliedFilters.push(filterName);
        console.log(`✅ ${filterName}: ${beforeCount} → ${afterCount} results`);
        return filtered;
      } else if (isHardFilter) {
        // Hard filter with 0 results - still apply it
        appliedFilters.push(filterName);
        console.log(
          `⚠️ ${filterName}: ${beforeCount} → 0 results (hard filter)`,
        );
        return filtered;
      } else {
        // Soft filter - don't apply, just note it
        relaxedFilters.push(filterName);
        console.log(
          `🔄 ${filterName}: relaxed (would eliminate all ${beforeCount} results)`,
        );
        return results;
      }
    };

    // ═══════════════════════════════════════════════════════════════
    // 1. BRAND FILTER (Soft - prefer but don't exclude all)
    // ═══════════════════════════════════════════════════════════════
    if (filters.brand && filters.brand.length > 0) {
      filteredResults = applyFilterSmart(
        filteredResults,
        (p) => {
          if (!p.brand) return false;
          const partBrand = p.brand.toLowerCase();
          return filters.brand.some((b) => {
            const filterBrand = b.toLowerCase();
            return (
              partBrand === filterBrand ||
              partBrand.includes(filterBrand) ||
              filterBrand.includes(partBrand)
            );
          });
        },
        `Brand [${filters.brand.join(', ')}]`,
        false, // Soft filter
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. VEHICLE COMPATIBILITY FILTER (Soft)
    // ═══════════════════════════════════════════════════════════════
    if (filters.vehicleBrand && !hasOemIntent) {
      const vehicleBrand = filters.vehicleBrand.toLowerCase();
      filteredResults = applyFilterSmart(
        filteredResults,
        (p) => {
          const combined =
            `${p.brand || ''} ${p.description || ''} ${p.compatibility || ''} ${p.notes || ''} ${p.partNumber || ''}`.toLowerCase();
          return combined.includes(vehicleBrand);
        },
        `Vehicle [${filters.vehicleBrand}]`,
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. EXCLUSION FILTERS (Hard - always apply)
    // ═══════════════════════════════════════════════════════════════
    if (filters.exclude?.brands?.length > 0) {
      filteredResults = applyFilterSmart(
        filteredResults,
        (p) =>
          !p.brand ||
          !filters.exclude.brands.some((b) =>
            p.brand.toLowerCase().includes(b.toLowerCase()),
          ),
        `Exclude brands [${filters.exclude.brands.join(', ')}]`,
        true,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. PRICE FILTER (Semi-hard - apply but show message if 0)
    // ═══════════════════════════════════════════════════════════════
    const userCurrency = filters.priceCurrency || 'USD';
    let priceFilterApplied = false;

    if (filters.maxPrice !== undefined) {
      const beforePrice = filteredResults.length;
      filteredResults = filteredResults.filter((p) => {
        if (p.price === null || p.price === undefined) return true; // Include parts without price
        const partCurrency = p.currency || 'AED';
        const convertedMaxPrice = convertCurrency(
          filters.maxPrice,
          userCurrency,
          partCurrency,
        );
        return p.price <= convertedMaxPrice;
      });
      priceFilterApplied = true;
      filterStats['maxPrice'] = {
        before: beforePrice,
        after: filteredResults.length,
        value: filters.maxPrice,
      };
      appliedFilters.push(`Max Price $${filters.maxPrice}`);
      console.log(
        `💰 Max price $${filters.maxPrice}: ${beforePrice} → ${filteredResults.length} results`,
      );
    }

    if (filters.minPrice !== undefined) {
      const beforePrice = filteredResults.length;
      filteredResults = filteredResults.filter((p) => {
        if (p.price === null || p.price === undefined) return false;
        const partCurrency = p.currency || 'AED';
        const convertedMinPrice = convertCurrency(
          filters.minPrice,
          userCurrency,
          partCurrency,
        );
        return p.price >= convertedMinPrice;
      });
      priceFilterApplied = true;
      filterStats['minPrice'] = {
        before: beforePrice,
        after: filteredResults.length,
        value: filters.minPrice,
      };
      appliedFilters.push(`Min Price $${filters.minPrice}`);
      console.log(
        `💰 Min price $${filters.minPrice}: ${beforePrice} → ${filteredResults.length} results`,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. STOCK FILTER (INTELLIGENT - handles "full stock", "in stock", etc.)
    // ═══════════════════════════════════════════════════════════════
    let stockFilterRequested =
      filters.inStock || filters.stockStatus === 'in-stock';
    let highStockRequested =
      filters.stockLevel === 'high' ||
      filters.minQuantity > 0 ||
      filters.exclude?.stockLevels?.includes('low');

    let inStockCount = 0;
    let highStockCount = 0;

    // Define quantity thresholds
    const LOW_STOCK_THRESHOLD = 5; // 1-5 = low stock
    const HIGH_STOCK_THRESHOLD = filters.minQuantity || 10; // 10+ = full/high stock

    // Helper to determine stock level
    const getStockLevel = (quantity) => {
      if (!quantity || quantity <= 0) return 'out';
      if (quantity <= LOW_STOCK_THRESHOLD) return 'low';
      return 'high';
    };

    if (highStockRequested) {
      // User wants "full stock" / "plenty" / "well stocked" - EXCLUDE low stock items
      console.log(
        `🔍 High stock requested (minQuantity: ${HIGH_STOCK_THRESHOLD})`,
      );

      const beforeCount = filteredResults.length;
      highStockCount = filteredResults.filter(
        (p) => (p.quantity || 0) >= HIGH_STOCK_THRESHOLD,
      ).length;

      if (highStockCount > 0) {
        // Filter OUT low stock items, sort by quantity
        filteredResults = filteredResults
          .filter((p) => (p.quantity || 0) >= HIGH_STOCK_THRESHOLD)
          .map((p) => ({
            ...p,
            _inStock: true,
            _stockLevel: 'high',
            _stockScore: Math.min(100, p.quantity || 0), // Score by quantity
          }))
          .sort((a, b) => b._stockScore - a._stockScore);

        appliedFilters.push(`Full Stock (qty ≥${HIGH_STOCK_THRESHOLD})`);
        console.log(
          `📦 Full stock filter: ${beforeCount} → ${highStockCount} (excluded low stock items)`,
        );
      } else if (stockFilterRequested) {
        // No high stock but user also wanted in-stock, try that
        inStockCount = filteredResults.filter(
          (p) => (p.quantity || 0) > 0,
        ).length;

        if (inStockCount > 0) {
          filteredResults = filteredResults
            .filter((p) => (p.quantity || 0) > 0)
            .map((p) => ({
              ...p,
              _inStock: true,
              _stockLevel: getStockLevel(p.quantity),
              _stockScore: p.quantity || 0,
            }))
            .sort((a, b) => b._stockScore - a._stockScore);

          appliedFilters.push('In Stock (high stock not available)');
          relaxedFilters.push(
            `Full Stock (only ${inStockCount} in-stock items found)`,
          );
          console.log(
            `🔄 High stock relaxed: showing ${inStockCount} in-stock items sorted by quantity`,
          );
        } else {
          relaxedFilters.push('Full Stock');
          relaxedFilters.push('In Stock');
          console.log(`🔄 All stock filters relaxed: no in-stock items found`);
        }
      } else {
        relaxedFilters.push('Full Stock');
        console.log(`🔄 Full stock filter relaxed: 0 high-stock items found`);
      }

      filterStats['stockLevel'] = {
        requested: 'high',
        minQuantity: HIGH_STOCK_THRESHOLD,
        highStockFound: highStockCount,
        inStockFound: inStockCount,
        total: filteredResults.length,
      };
    } else if (stockFilterRequested) {
      // Basic in-stock request - boost but don't exclude
      inStockCount = filteredResults.filter(
        (p) => (p.quantity || 0) > 0,
      ).length;

      if (inStockCount > 0) {
        // Sort in-stock items to the top (boost, not filter)
        filteredResults = filteredResults.map((p) => ({
          ...p,
          _inStock: (p.quantity || 0) > 0,
          _stockLevel: getStockLevel(p.quantity),
          _stockScore:
            (p.quantity || 0) > HIGH_STOCK_THRESHOLD
              ? 2
              : (p.quantity || 0) > 0
                ? 1
                : 0,
        }));
        filteredResults.sort((a, b) => b._stockScore - a._stockScore);
        appliedFilters.push('In Stock (prioritized)');
        console.log(
          `📦 Stock boost: ${inStockCount} in-stock items boosted to top`,
        );
      } else {
        // No in-stock items - note but don't filter out
        relaxedFilters.push('In Stock');
        console.log(
          `🔄 Stock filter relaxed: 0 in-stock items found, showing all ${filteredResults.length}`,
        );
      }
      filterStats['inStock'] = {
        requested: true,
        found: inStockCount,
        total: filteredResults.length,
      };
    }

    // Handle explicit exclude low stock (even without high stock request)
    if (filters.exclude?.stockLevels?.includes('low') && !highStockRequested) {
      const beforeExclude = filteredResults.length;
      filteredResults = filteredResults.filter(
        (p) =>
          (p.quantity || 0) > LOW_STOCK_THRESHOLD || (p.quantity || 0) === 0,
      );
      appliedFilters.push('Exclude Low Stock');
      console.log(
        `🚫 Exclude low stock: ${beforeExclude} → ${filteredResults.length}`,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. CATEGORY FILTER (Soft)
    // ═══════════════════════════════════════════════════════════════
    if (filters.category) {
      const categorySearchTerms = {
        brakes: [
          'brake',
          'brakes',
          'braking',
          'rotor',
          'caliper',
          'pad',
          'disc',
        ],
        filters: [
          'filter',
          'filters',
          'oil filter',
          'air filter',
          'fuel filter',
        ],
        suspension: [
          'suspension',
          'shock',
          'strut',
          'spring',
          'damper',
          'absorber',
        ],
        electrical: [
          'electrical',
          'electric',
          'alternator',
          'starter',
          'battery',
          'ignition',
        ],
        engine: [
          'engine',
          'motor',
          'piston',
          'valve',
          'timing',
          'gasket',
          'camshaft',
        ],
        transmission: [
          'transmission',
          'gearbox',
          'clutch',
          'gear',
          'cv joint',
          'driveshaft',
        ],
        cooling: [
          'cooling',
          'coolant',
          'radiator',
          'thermostat',
          'water pump',
          'fan',
        ],
        steering: [
          'steering',
          'tie rod',
          'rack',
          'power steering',
          'ball joint',
        ],
        exhaust: ['exhaust', 'muffler', 'catalytic', 'manifold', 'pipe'],
        wheels: ['wheel', 'wheels', 'tire', 'tires', 'hub', 'rim', 'bearing'],
      };

      const terms = categorySearchTerms[filters.category.toLowerCase()] || [
        filters.category.toLowerCase(),
      ];

      filteredResults = applyFilterSmart(
        filteredResults,
        (p) => {
          const combined =
            `${p.category || ''} ${p.description || ''} ${p.partNumber || ''}`.toLowerCase();
          return terms.some((term) => combined.includes(term));
        },
        `Category [${filters.category}]`,
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. DELIVERY FILTER (Soft - boost fast delivery)
    // ═══════════════════════════════════════════════════════════════
    if (filters.deliveryDays !== undefined) {
      const fastDeliveryCount = filteredResults.filter(
        (p) =>
          p.deliveryDays !== null && p.deliveryDays <= filters.deliveryDays,
      ).length;

      if (fastDeliveryCount > 0) {
        filteredResults = filteredResults.map((p) => ({
          ...p,
          _fastDelivery:
            p.deliveryDays !== null && p.deliveryDays <= filters.deliveryDays,
        }));
        filteredResults.sort(
          (a, b) => (b._fastDelivery ? 1 : 0) - (a._fastDelivery ? 1 : 0),
        );
        appliedFilters.push(
          `Fast Delivery (≤${filters.deliveryDays} days prioritized)`,
        );
      } else {
        relaxedFilters.push(`Delivery ≤${filters.deliveryDays} days`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. QUANTITY FILTER (Soft - boost sufficient stock)
    // ═══════════════════════════════════════════════════════════════
    if (filters.requestedQuantity && filters.requestedQuantity > 1) {
      filteredResults = filteredResults.map((p) => ({
        ...p,
        _hasSufficientStock: (p.quantity || 0) >= filters.requestedQuantity,
      }));
      filteredResults.sort((a, b) => {
        if (a._hasSufficientStock && !b._hasSufficientStock) return -1;
        if (!a._hasSufficientStock && b._hasSufficientStock) return 1;
        return 0;
      });
      console.log(
        `📦 Quantity boost: prioritizing parts with ${filters.requestedQuantity}+ units`,
      );
    }

    // Step 5: Sort results
    const sortBy = filters.sortBy || 'price';
    const sortOrder = filters.sortOrder || 'asc';

    filteredResults.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Remove duplicates by part number + supplier
    const seen = new Set();
    filteredResults = filteredResults.filter((p) => {
      const key = `${p.partNumber}-${p.supplier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Diversify results - ensure we show variety of brands, not just one type
    // Group by brand and interleave results for better variety
    if (filteredResults.length > 20) {
      const brandGroups = {};
      filteredResults.forEach((p) => {
        const brand = p.brand || 'Unknown';
        if (!brandGroups[brand]) brandGroups[brand] = [];
        brandGroups[brand].push(p);
      });

      // Interleave brands for diversity
      const diversifiedResults = [];
      const brands = Object.keys(brandGroups);
      let maxItems = Math.max(...brands.map((b) => brandGroups[b].length));

      for (let i = 0; i < maxItems && diversifiedResults.length < 500; i++) {
        for (const brand of brands) {
          if (brandGroups[brand][i]) {
            diversifiedResults.push(brandGroups[brand][i]);
            if (diversifiedResults.length >= 500) break;
          }
        }
      }
      filteredResults = diversifiedResults;
    }

    const searchTime = Date.now() - startTime;
    console.log(
      `🤖 AI Search completed in ${searchTime}ms: ${filteredResults.length} results`,
    );

    // Determine if this is a browse intent
    const intentType = filters.intentType || 'filtered_search';
    const isBrowseMode = intentType === 'browse';

    // Build response with messaging for broad searches
    const response = {
      success: true,
      query,
      parsed: {
        searchTerms: searchTerms, // Use filtered terms, not original
        filters: parsed.filters,
        intent: parsed.intent,
        intentType: intentType,
        suggestions: parsed.suggestions,
        confidence: parsed.confidence,
      },
      results: filteredResults.slice(0, 500),
      total: filteredResults.length,
      source,
      searchTime,
      // NEW: Include filter status for UI
      filterStatus: {
        applied: appliedFilters,
        relaxed: relaxedFilters,
        stats: filterStats,
      },
    };

    // Add helpful messaging based on results and intent
    if (filteredResults.length === 0) {
      response.message =
        'No parts found matching your criteria. Try adjusting your filters.';
      response.suggestions = [
        'Remove some filters to broaden your search',
        'Check the spelling of part numbers or brand names',
        'Try a different price range',
      ];
    } else if (relaxedFilters.length > 0) {
      // Some filters were relaxed
      const relaxedMsg =
        relaxedFilters.length === 1
          ? `Note: "${relaxedFilters[0]}" filter was relaxed to show more results.`
          : `Note: Some filters were relaxed (${relaxedFilters.join(', ')}) to show more results.`;

      if (stockFilterRequested && inStockCount === 0) {
        response.message = `Found ${filteredResults.length} parts matching price criteria. None currently in stock - in-stock items will appear first when available.`;
        response.stockInfo = {
          requested: true,
          inStockFound: 0,
          totalResults: filteredResults.length,
          note: 'All matching parts are currently out of stock',
        };
      } else if (stockFilterRequested && inStockCount > 0) {
        response.message = `Found ${filteredResults.length} parts. ${inStockCount} in stock (shown first).`;
        response.stockInfo = {
          requested: true,
          inStockFound: inStockCount,
          totalResults: filteredResults.length,
        };
      } else {
        response.message = `Found ${filteredResults.length} parts. ${relaxedMsg}`;
      }
      response.filtersRelaxed = relaxedFilters;
    } else if (isBrowseMode) {
      response.message = `Browsing ${filteredResults.length} parts. Add more criteria to narrow results.`;
      response.isBrowseMode = true;

      const uniqueBrands = [
        ...new Set(filteredResults.map((p) => p.brand).filter(Boolean)),
      ]
        .sort()
        .slice(0, 20);
      response.availableBrands = uniqueBrands;

      const uniqueCategories = [
        ...new Set(filteredResults.map((p) => p.category).filter(Boolean)),
      ]
        .sort()
        .slice(0, 10);
      response.availableCategories = uniqueCategories;
    } else if (isGenericSearch && filteredResults.length > 100) {
      response.message =
        'Showing results based on your filters. For more specific results, try adding a brand or part category.';
      response.isBroadSearch = true;

      const uniquePartNumbers = [
        ...new Set(filteredResults.map((p) => p.partNumber)),
      ].slice(0, 30);
      response.samplePartNumbers = uniquePartNumbers;

      const uniqueBrands = [
        ...new Set(filteredResults.map((p) => p.brand).filter(Boolean)),
      ]
        .sort()
        .slice(0, 15);
      response.availableBrands = uniqueBrands;
    } else if (filteredResults.length > 0 && filteredResults.length <= 10) {
      response.message = `Found ${filteredResults.length} part${filteredResults.length > 1 ? 's' : ''} matching your search.`;
    } else if (filteredResults.length > 10) {
      response.message = `Found ${filteredResults.length} parts matching your criteria.`;
    }

    // Add quantity availability info if requested
    if (filters.requestedQuantity && filters.requestedQuantity > 1) {
      const withSufficientStock = filteredResults.filter(
        (p) => p._hasSufficientStock,
      ).length;
      response.quantityInfo = {
        requested: filters.requestedQuantity,
        partsWithSufficientStock: withSufficientStock,
        partsWithPartialStock: filteredResults.length - withSufficientStock,
      };
      if (withSufficientStock === 0 && filteredResults.length > 0) {
        response.message = `Found ${filteredResults.length} parts but none have ${filters.requestedQuantity} units in stock. Contact suppliers for bulk orders.`;
      }
    }

    // Add vehicle compatibility info if filtered
    if (filters.vehicleBrand) {
      response.vehicleCompatibility = filters.vehicleBrand;
    }

    // Clean up active request tracking
    activeAISearches.delete(normalizedQuery);

    res.json(response);
  } catch (error) {
    // Clean up active request tracking on error
    const normalizedQuery = (req.body?.query || '').trim().toLowerCase();
    activeAISearches.delete(normalizedQuery);

    console.error('AI Search error:', error);

    // Return user-friendly error message
    const isTimeout =
      error.message?.includes('TIMEOUT') || error.message?.includes('timeout');
    res.status(isTimeout ? 408 : 500).json({
      success: false,
      error: isTimeout ? 'Search timed out' : 'Search failed',
      message: isTimeout
        ? 'The search took too long. Please try a more specific query.'
        : 'An error occurred while searching. Please try again.',
      results: [],
      total: 0,
    });
  }
}

/**
 * Fast basic keyword extraction for fallback
 */
function extractBasicKeywordsFromQuery(query) {
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
    'i',
    'am',
    'please',
    'can',
    'you',
    'under',
    'below',
    'above',
    'over',
    'and',
    'or',
  ]);
  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word),
    );

  return [...new Set(words)].slice(0, 5);
}

/**
 * Fast basic filter extraction for fallback
 */
function extractBasicFiltersFromQuery(query) {
  const filters = { priceCurrency: 'USD' };
  const queryLower = query.toLowerCase();

  // Price extraction
  const priceMatch = queryLower.match(
    /(?:under|below|less than|max|cheaper than)\s*\$?\s*(\d+)/i,
  );
  if (priceMatch) filters.maxPrice = parseInt(priceMatch[1]);

  const minPriceMatch = queryLower.match(
    /(?:over|above|more than|min|at least)\s*\$?\s*(\d+)/i,
  );
  if (minPriceMatch) filters.minPrice = parseInt(minPriceMatch[1]);

  // Currency detection
  if (queryLower.match(/\b(aed|dirham)/)) filters.priceCurrency = 'AED';
  else if (queryLower.match(/\b(eur|euro|€)/)) filters.priceCurrency = 'EUR';

  // Stock filter
  if (queryLower.includes('in stock') || queryLower.includes('available'))
    filters.inStock = true;

  return filters;
}

/**
 * AI-powered suggestions
 * GET /api/ai-suggestions?q=brake
 */
async function aiSuggestions(req, res) {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const suggestions = await geminiService.generateSuggestions(query);

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('AI Suggestions error:', error);
    res.json({ success: true, suggestions: [] });
  }
}

/**
 * AI-powered result analysis
 * POST /api/ai-analyze
 * Body: { results: [...], query: "..." }
 */
async function aiAnalyze(req, res) {
  try {
    const { results, query } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.json({
        success: false,
        error: 'Results array is required',
      });
    }

    const analysis = await geminiService.analyzeResults(results, query || '');

    res.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
    });
  }
}

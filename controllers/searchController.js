/**
 * Search Controller
 * Handles product search API endpoints for buyers
 * IMPORTANT: Search is by EXACT part number only - returns all suppliers for that part number
 */
const Part = require('../models/Part');
const elasticsearchService = require('../services/elasticsearchService');
const geminiService = require('../services/geminiService');
const aiLearningService = require('../services/aiLearningService');
const {
  applyMarkupToParts,
  applyMarkupToPart,
  getRequestMarkup,
} = require('../utils/priceMarkup');

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

    // Apply price markup for buyer (transparent - buyer never sees original price)
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      filteredResults = applyMarkupToParts(filteredResults, markupPercentage);
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

    // Apply price markup for buyer
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      applyMarkupToPart(part, markupPercentage);
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

    // Apply price markup for buyer
    const markupPercentage = await getRequestMarkup(req);
    let markedUpParts = parts;
    if (markupPercentage > 0) {
      markedUpParts = applyMarkupToParts(parts, markupPercentage);
    }

    res.json({
      success: true,
      partNumber,
      count: markedUpParts.length,
      parts: markedUpParts,
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

    // Apply price markup for buyer
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      allResults = applyMarkupToParts(allResults, markupPercentage);
    }

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

    // Apply price markup for buyer
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      allResults = applyMarkupToParts(allResults, markupPercentage);
    }

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
  // AI Learning endpoints
  recordSearchEngagement,
  recordSearchRefinement,
  recordSearchFeedback,
  getLearningStats,
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
// Track active AI search requests to prevent duplicates
const activeAISearches = new Map();
const AI_SEARCH_TIMEOUT = 15000;
const DB_QUERY_TIMEOUT = 10000;

/**
 * AI-Powered Smart Search (REBUILT)
 * ─────────────────────────────────
 * Architecture:
 *   1. Parse user intent (local parser + optional Gemini enhancement)
 *   2. Fetch data from DB / Elasticsearch using extracted search terms
 *   3. Deterministic code-based filtering (price, stock, brand, delivery…)
 *   4. Sort, deduplicate, return with clear explanation
 *
 * CRITICAL: prices in DB are stored in AED.
 *           User queries default to USD.  1 USD = 3.67 AED.
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

    // Prevent duplicate concurrent requests
    const normalizedQuery = query.trim().toLowerCase();
    if (activeAISearches.has(normalizedQuery)) {
      const existing = activeAISearches.get(normalizedQuery);
      if (Date.now() - existing.startTime < AI_SEARCH_TIMEOUT) {
        return res.json({
          success: false,
          error: 'Search in progress',
          message: 'Please wait for the current search to complete.',
          results: [],
          total: 0,
        });
      }
    }
    activeAISearches.set(normalizedQuery, { requestId, startTime: Date.now() });

    console.log(`🤖 AI Search [${requestId}]: "${query}"`);
    const startTime = Date.now();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: PARSE USER INTENT  (local + optional Gemini merge)
    // ─────────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = await geminiService.parseSearchQuery(query);
      console.log(
        '🧠 Parsed intent:',
        JSON.stringify(parsed.parsedIntent, null, 2),
      );
    } catch (parseError) {
      console.warn(`⚠️ parseSearchQuery failed: ${parseError.message}`);
      parsed = {
        success: false,
        searchTerms: [],
        filters: {},
        intent: query,
        parsedIntent: null,
      };
    }

    const parsedIntent = parsed.parsedIntent || {};
    const filters = parsed.filters || {};

    // Extract search components from the new flat parsedIntent
    const partNumbers = parsedIntent.partNumbers || parsed.searchTerms || [];
    const keywords = parsedIntent.searchKeywords || [];
    const categories = parsedIntent.categories || [];
    const partsBrands = parsedIntent.partsBrands || [];

    // Combine for text search
    const searchKeywords = [...new Set([...keywords, ...categories])];
    const brandsList =
      partsBrands.length > 0 ? partsBrands : filters.brand || [];

    const hasPartNumbers =
      partNumbers.length > 0 &&
      partNumbers.some((pn) => /^[A-Z0-9\-]{3,}$/i.test(pn));
    const hasKeywords = searchKeywords.length > 0;

    console.log(
      `🔍 Strategy: partNumbers=${partNumbers.length}, keywords=${searchKeywords.length}, brands=${brandsList.length}`,
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 2: FETCH DATA  (3 strategies: part#s → text → fallback)
    // ─────────────────────────────────────────────────────────────
    let allResults = [];
    let source = 'mongodb';
    const useElasticsearch = await elasticsearchService.hasDocuments();

    // STRATEGY 1 — exact part number search
    if (hasPartNumbers && useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchMultiplePartNumbers(
          partNumbers,
          { limitPerPart: 200 },
        );
        allResults = esResult.results;
        source = 'elasticsearch-parts';
        console.log(
          `📦 Part# search: ${esResult.found?.length || 0} found, ${esResult.notFound?.length || 0} not found`,
        );
      } catch (e) {
        console.error('ES part search failed:', e.message);
      }
    }

    // STRATEGY 2 — text / keyword search
    if (allResults.length === 0 && (hasKeywords || !hasPartNumbers)) {
      const searchQuery = searchKeywords.join(' ') || query;

      if (useElasticsearch) {
        try {
          const esResult = await elasticsearchService.search(searchQuery, {
            limit: 500,
            brand: brandsList.length > 0 ? brandsList[0] : undefined,
            inStock: parsedIntent.requireInStock || false,
          });
          allResults = esResult.results || [];
          source = 'elasticsearch-text';
          console.log(
            `📦 Text search "${searchQuery}": ${allResults.length} results`,
          );
        } catch (e) {
          console.error('ES text search failed:', e.message);
        }
      }

      // MongoDB fallback
      if (allResults.length === 0) {
        const terms = searchKeywords.length > 0 ? searchKeywords : [query];
        for (const term of terms.slice(0, 5)) {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mongoQ = {
            $or: [
              { partNumber: { $regex: escaped, $options: 'i' } },
              { description: { $regex: escaped, $options: 'i' } },
              { brand: { $regex: escaped, $options: 'i' } },
              { category: { $regex: escaped, $options: 'i' } },
            ],
          };
          if (brandsList.length > 0) {
            mongoQ.brand = { $in: brandsList.map((b) => new RegExp(b, 'i')) };
          }
          const rows = await Part.find(mongoQ).limit(300).lean();
          allResults.push(...rows);
        }
        source = 'mongodb-text';
        console.log(`📦 MongoDB text search: ${allResults.length} results`);
      }
    }

    // STRATEGY 3 — broad fallback
    if (allResults.length === 0) {
      const dbQuery = {};
      if (brandsList.length > 0) {
        dbQuery.brand = { $in: brandsList.map((b) => new RegExp(b, 'i')) };
      }
      if (parsedIntent.requireInStock) {
        dbQuery.quantity = { $gt: 0 };
      }

      const qp = Part.find(dbQuery).limit(1000).lean();
      const tp = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('DB_TIMEOUT')), DB_QUERY_TIMEOUT),
      );
      try {
        allResults = await Promise.race([qp, tp]);
      } catch {
        allResults = await Part.find(dbQuery).limit(300).lean();
      }
      source = 'mongodb-fallback';
    }

    console.log(`📦 Fetched ${allResults.length} parts from ${source}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: DETERMINISTIC FILTERING  (code-only, no AI call)
    // ─────────────────────────────────────────────────────────────
    let filteredResults;
    let filterAnalysis;

    if (parsedIntent && Object.keys(parsedIntent).length > 0) {
      // Use the rebuilt deterministic filterDataWithAI (synchronous, code-only)
      const filterResult = geminiService.filterDataWithAI(
        allResults,
        parsedIntent,
        query,
      );
      filteredResults = filterResult.matchingParts;
      filterAnalysis = filterResult.analysis;
      console.log('🎯 Filter result:', filterAnalysis);
    } else {
      // Minimal fallback — just return everything (no intent parsed)
      filteredResults = [...allResults];
      filterAnalysis = { note: 'No intent parsed — returning raw results' };
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: MULTI-FACTOR AI RANKING, DEDUP & COMPARISON
    // ─────────────────────────────────────────────────────────────

    // Deduplicate — use _id (always unique per DB document), or fallback
    // to a composite key for ES results that might have duplicate entries
    const seen = new Set();
    filteredResults = filteredResults.filter((p) => {
      const key = p._id
        ? p._id.toString()
        : `${p.partNumber}-${p.supplier || ''}-${p.stockCode || ''}-${p.price || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate min/max for normalization
    const prices = filteredResults
      .map((p) => p.price || 0)
      .filter((p) => p > 0);
    const quantities = filteredResults.map((p) => p.quantity || 0);
    const deliveries = filteredResults.map((p) => p.deliveryDays || 999);

    const minPrice = Math.min(...(prices.length ? prices : [0]));
    const maxPrice = Math.max(...(prices.length ? prices : [1]));
    const minQty = Math.min(...quantities);
    const maxQty = Math.max(...(quantities.length ? quantities : [1]));
    const minDelivery = Math.min(...deliveries);
    const maxDelivery = Math.max(...deliveries);

    // Score each result on multiple factors (0-100 scale each)
    // Weights are dynamic based on the user's sort/priority preference
    const sortPref = parsedIntent.sortPreference || null;

    // Dynamic weight calculation
    let wPrice = 0.35, wDelivery = 0.30, wQty = 0.20, wStock = 0.15;

    if (sortPref === 'quantity_desc') {
      // User prioritizes quantity/stock availability
      wQty = 0.50; wStock = 0.25; wPrice = 0.15; wDelivery = 0.10;
    } else if (sortPref === 'stock_priority') {
      // User prioritizes in-stock / availability
      wStock = 0.40; wQty = 0.30; wPrice = 0.15; wDelivery = 0.15;
    } else if (sortPref === 'price_asc') {
      // User prioritizes lowest price
      wPrice = 0.55; wDelivery = 0.20; wQty = 0.15; wStock = 0.10;
    } else if (sortPref === 'price_desc') {
      // User wants highest price (premium)
      wPrice = 0.55; wDelivery = 0.20; wQty = 0.15; wStock = 0.10;
    } else if (sortPref === 'delivery_asc') {
      // User prioritizes fastest delivery
      wDelivery = 0.50; wPrice = 0.20; wQty = 0.15; wStock = 0.15;
    } else if (sortPref === 'weight_asc') {
      // User prioritizes lightest weight — fall back to price-like scoring
      wPrice = 0.40; wDelivery = 0.25; wQty = 0.20; wStock = 0.15;
    } else if (sortPref === 'quality_desc') {
      // User prioritizes quality — favor OEM/premium, in-stock, reasonable price
      wStock = 0.35; wQty = 0.30; wPrice = 0.20; wDelivery = 0.15;
    }

    console.log(`📊 Scoring weights: Price=${wPrice}, Delivery=${wDelivery}, Qty=${wQty}, Stock=${wStock} (pref: ${sortPref || 'balanced'})`);

    filteredResults.forEach((p) => {
      const price = p.price || 0;
      const qty = p.quantity || 0;
      const delivery = p.deliveryDays || 999;
      const inStock = qty > 0 ? 1 : 0;

      // Price score: lower is better (inverted) — unless price_desc
      let priceScore;
      if (sortPref === 'price_desc') {
        // Higher price = better (premium)
        priceScore =
          price > 0 && maxPrice > minPrice
            ? ((price - minPrice) / (maxPrice - minPrice)) * 100
            : price > 0
              ? 50
              : 0;
      } else {
        priceScore =
          price > 0 && maxPrice > minPrice
            ? ((maxPrice - price) / (maxPrice - minPrice)) * 100
            : price > 0
              ? 50
              : 0;
      }

      // Quantity score: higher is better
      const qtyScore =
        maxQty > minQty
          ? ((qty - minQty) / (maxQty - minQty)) * 100
          : qty > 0
            ? 50
            : 0;

      // Delivery score: fewer days is better (inverted)
      const deliveryScore =
        delivery < 999 && maxDelivery > minDelivery
          ? ((maxDelivery - delivery) / (maxDelivery - minDelivery)) * 100
          : delivery < 999
            ? 50
            : 0;

      // Stock bonus
      const stockBonus = inStock ? 20 : 0;

      // Weighted composite score using dynamic weights
      const compositeScore =
        priceScore * wPrice +
        deliveryScore * wDelivery +
        qtyScore * wQty +
        stockBonus * wStock;

      p._aiScore = Math.round(compositeScore * 10) / 10;
      p._aiPriceScore = Math.round(priceScore);
      p._aiQtyScore = Math.round(qtyScore);
      p._aiDeliveryScore = Math.round(deliveryScore);
    });

    // Sort by composite AI score (highest first)
    filteredResults.sort((a, b) => {
      // In-stock always first
      const aIn = (a.quantity || 0) > 0 ? 1 : 0;
      const bIn = (b.quantity || 0) > 0 ? 1 : 0;
      if (bIn !== aIn) return bIn - aIn;
      // Then by AI composite score
      return (b._aiScore || 0) - (a._aiScore || 0);
    });

    // Generate comparison insights for top results
    const aiInsights = [];
    if (filteredResults.length >= 2) {
      const top = filteredResults.slice(0, 10);
      // Find best in each category
      const cheapest = [...top].sort(
        (a, b) => (a.price || Infinity) - (b.price || Infinity),
      )[0];
      const fastestDelivery = [...top].sort(
        (a, b) => (a.deliveryDays || 999) - (b.deliveryDays || 999),
      )[0];
      const highestStock = [...top].sort(
        (a, b) => (b.quantity || 0) - (a.quantity || 0),
      )[0];
      const bestOverall = top[0]; // Already sorted by composite

      // Assign badges to results
      filteredResults.forEach((p) => {
        p._aiBadges = [];
        const pid = p._id?.toString() || `${p.partNumber}-${p.supplier}`;
        const cheapestId =
          cheapest._id?.toString() ||
          `${cheapest.partNumber}-${cheapest.supplier}`;
        const fastestId =
          fastestDelivery._id?.toString() ||
          `${fastestDelivery.partNumber}-${fastestDelivery.supplier}`;
        const stockId =
          highestStock._id?.toString() ||
          `${highestStock.partNumber}-${highestStock.supplier}`;
        const bestId =
          bestOverall._id?.toString() ||
          `${bestOverall.partNumber}-${bestOverall.supplier}`;

        if (pid === bestId) p._aiBadges.push('best-overall');
        if (pid === cheapestId) p._aiBadges.push('lowest-price');
        if (pid === fastestId && (fastestDelivery.deliveryDays || 999) < 999)
          p._aiBadges.push('fastest-delivery');
        if (pid === stockId && (highestStock.quantity || 0) > 0)
          p._aiBadges.push('highest-stock');
      });

      // Build tie/comparison explanations
      const topTwo = top.slice(0, 2);
      if (topTwo.length === 2) {
        const [first, second] = topTwo;
        const scoreDiff = Math.abs(
          (first._aiScore || 0) - (second._aiScore || 0),
        );
        if (scoreDiff < 5) {
          // Very close - explain why both are good
          const firstAdvantages = [];
          const secondAdvantages = [];

          if ((first.price || Infinity) < (second.price || Infinity))
            firstAdvantages.push('lower price');
          else if ((second.price || Infinity) < (first.price || Infinity))
            secondAdvantages.push('lower price');

          if ((first.deliveryDays || 999) < (second.deliveryDays || 999))
            firstAdvantages.push('faster delivery');
          else if ((second.deliveryDays || 999) < (first.deliveryDays || 999))
            secondAdvantages.push('faster delivery');

          if ((first.quantity || 0) > (second.quantity || 0))
            firstAdvantages.push('more stock');
          else if ((second.quantity || 0) > (first.quantity || 0))
            secondAdvantages.push('more stock');

          aiInsights.push({
            type: 'tie',
            message: `Top 2 options are very close in overall score`,
            first: {
              supplier: first.supplier || first.brand,
              advantages: firstAdvantages,
            },
            second: {
              supplier: second.supplier || second.brand,
              advantages: secondAdvantages,
            },
          });
        }
      }

      // Price vs delivery tradeoff insight
      const cheapestPid =
        cheapest._id?.toString() ||
        `${cheapest.partNumber}-${cheapest.supplier}`;
      const fastestPid =
        fastestDelivery._id?.toString() ||
        `${fastestDelivery.partNumber}-${fastestDelivery.supplier}`;
      if (
        cheapestPid !== fastestPid &&
        (cheapest.price || 0) > 0 &&
        (fastestDelivery.deliveryDays || 999) < 999
      ) {
        const priceDiffPercent = Math.round(
          (Math.abs((cheapest.price || 0) - (fastestDelivery.price || 0)) /
            (cheapest.price || 1)) *
            100,
        );
        const deliveryDiff =
          (cheapest.deliveryDays || 0) - (fastestDelivery.deliveryDays || 0);
        if (priceDiffPercent > 5 && deliveryDiff > 0) {
          aiInsights.push({
            type: 'tradeoff',
            message: `Save ~${priceDiffPercent}% choosing the cheapest, or get it ${deliveryDiff} days sooner with faster option`,
          });
        }
      }
    } else if (filteredResults.length === 1) {
      filteredResults[0]._aiBadges = ['best-overall', 'only-option'];
    }

    // Apply topN limit if user asked for "best 3", "top 5", etc.
    const topN = parsedIntent.topN || null;
    if (topN && topN >= 2 && filteredResults.length > topN) {
      filteredResults = filteredResults.slice(0, topN);
    } else {
      filteredResults = filteredResults.slice(0, 500);
    }

    const searchTime = Date.now() - startTime;
    console.log(
      `✅ AI Search done in ${searchTime}ms: ${filteredResults.length} results`,
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 5: BUILD RESPONSE
    // ─────────────────────────────────────────────────────────────
    const stockStats = {
      highStock: filteredResults.filter((p) => (p.quantity || 0) >= 10).length,
      inStock: filteredResults.filter((p) => (p.quantity || 0) > 0).length,
      lowStock: filteredResults.filter(
        (p) => (p.quantity || 0) > 0 && (p.quantity || 0) < 10,
      ).length,
      outOfStock: filteredResults.filter((p) => (p.quantity || 0) === 0).length,
    };

    let message = `Found ${filteredResults.length} parts`;
    if (filterAnalysis?.filtersApplied) {
      const fa = filterAnalysis.filtersApplied;
      const applied = [];
      if (fa.price) applied.push(`price ${fa.price}`);
      if (fa.stock) applied.push(fa.stock);
      if (fa.brands) applied.push(`brands: ${fa.brands.join(', ')}`);
      if (fa.delivery) applied.push(fa.delivery);
      if (fa.keywords) applied.push(`keywords: ${fa.keywords}`);
      if (applied.length > 0)
        message += ` (filtered by: ${applied.join(', ')})`;
    }

    activeAISearches.delete(normalizedQuery);
    const allSearchTerms = [...new Set([...partNumbers, ...searchKeywords])];

    // Learning
    let learningRecordId = null;
    let learningSuggestions = [];
    try {
      const lr = await aiLearningService.recordSearchAttempt({
        query,
        aiUnderstanding: parsedIntent,
        resultsCount: filteredResults.length,
        searchTime,
        source,
        sessionId: req.sessionID || requestId,
        userId: req.buyer?._id,
      });
      learningRecordId = lr.recordId;
      if (!lr.wasSuccessful && lr.suggestions?.length > 0) {
        learningSuggestions = lr.suggestions;
      }
    } catch (e) {
      console.warn('Learning record error:', e.message);
    }

    // Response — backward-compatible shape
    const response = {
      success: true,
      query,
      parsed: {
        searchTerms: allSearchTerms,
        filters: parsed.filters,
        intent: parsed.intent,
        parsedIntent,
        understood: parsedIntent, // backward-compat alias
      },
      results: filteredResults,
      total: filteredResults.length,
      source,
      searchTime,
      message,
      aiInsights: aiInsights || [],
      topN: topN || null,
      filterStatus: {
        totalFetched: allResults.length,
        afterFiltering: filteredResults.length,
        analysis: filterAnalysis,
        stockStats,
      },
      learning: {
        recordId: learningRecordId,
        suggestions:
          learningSuggestions.length > 0 ? learningSuggestions : undefined,
      },
    };

    // Apply price markup for buyer (transparent)
    const markupPercentage = await getRequestMarkup(req);
    if (markupPercentage > 0) {
      response.results = applyMarkupToParts(response.results, markupPercentage);
    }

    res.json(response);
  } catch (error) {
    const normalizedQuery = (req.body?.query || '').trim().toLowerCase();
    activeAISearches.delete(normalizedQuery);
    console.error('AI Search error:', error);

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

// ═══════════════════════════════════════════════════════════════════════════
// AI LEARNING ENDPOINTS - Help the AI get smarter over time
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record user engagement with search results (implicit learning)
 * POST /api/ai-learn/engagement
 * Body: { recordId: "...", engagement: { viewedDetails: true, addedToCart: false, ... } }
 */
async function recordSearchEngagement(req, res) {
  try {
    const { recordId, engagement } = req.body;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: 'recordId is required',
      });
    }

    const result = await aiLearningService.recordEngagement(
      recordId,
      engagement || {},
    );

    res.json({
      success: result.updated,
      newScore: result.newScore,
    });
  } catch (error) {
    console.error('Learning engagement error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to record engagement' });
  }
}

/**
 * Record search refinement (user searched again with better query)
 * POST /api/ai-learn/refinement
 * Body: { originalQuery: "...", refinedQuery: "...", refinedResultsCount: 10 }
 */
async function recordSearchRefinement(req, res) {
  try {
    const { originalQuery, refinedQuery, refinedResultsCount } = req.body;

    if (!originalQuery || !refinedQuery) {
      return res.status(400).json({
        success: false,
        error: 'originalQuery and refinedQuery are required',
      });
    }

    const result = await aiLearningService.recordSearchRefinement(
      originalQuery,
      refinedQuery,
      { count: refinedResultsCount || 0 },
    );

    res.json({
      success: result.learned,
      message: result.learned
        ? 'AI learned from refinement'
        : 'Learning deferred',
    });
  } catch (error) {
    console.error('Learning refinement error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to record refinement' });
  }
}

/**
 * Record explicit user feedback
 * POST /api/ai-learn/feedback
 * Body: { recordId: "...", feedback: { rating: 5, helpful: true, comment: "..." } }
 */
async function recordSearchFeedback(req, res) {
  try {
    const { recordId, feedback } = req.body;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: 'recordId is required',
      });
    }

    const result = await aiLearningService.recordFeedback(
      recordId,
      feedback || {},
    );

    res.json({
      success: result.updated,
      message: result.updated
        ? 'Thank you for your feedback!'
        : 'Feedback not recorded',
    });
  } catch (error) {
    console.error('Learning feedback error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to record feedback' });
  }
}

/**
 * Get AI learning statistics
 * GET /api/ai-learn/stats
 */
async function getLearningStats(req, res) {
  try {
    const stats = await aiLearningService.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Learning stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
}

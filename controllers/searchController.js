/**
 * Search Controller
 * Handles product search API endpoints for buyers
 * IMPORTANT: Search is by EXACT part number only - returns all suppliers for that part number
 */
const Part = require('../models/Part');
const elasticsearchService = require('../services/elasticsearchService');
const geminiService = require('../services/geminiService');
const aiLearningService = require('../services/aiLearningService');

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
      // EXACT part number match only (case-insensitive) with timeout guard
      const mongoQuery = {
        partNumber: {
          $regex: `^${partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      };

      try {
        const mongoResults = await Part.find(mongoQuery)
          .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limitNum)
          .maxTimeMS(15000)
          .lean();

        total = await Part.countDocuments(mongoQuery).maxTimeMS(10000);
        results = mongoResults;
      } catch (mongoErr) {
        console.error('MongoDB fallback search timeout/error:', mongoErr.message);
        // Return empty rather than hanging until 504
        results = [];
        total = 0;
        source = 'mongodb-timeout';
      }
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

    // Strip leading single quotes/backticks/double quotes (Excel text-prefix artifacts)
    partNumbers = partNumbers.map(p => p.replace(/^['‘’`"]+/, '').trim()).filter(p => p.length > 0);

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

    // Deduplicate part numbers (case-insensitive)
    const seen = new Set();
    partNumbers = partNumbers.filter(p => {
      const upper = p.toUpperCase();
      if (seen.has(upper)) return false;
      seen.add(upper);
      return true;
    });

    // Limit to 1000 parts at once to prevent browser lag from too many results
    const originalCount = partNumbers.length;
    if (partNumbers.length > 1000) {
      partNumbers = partNumbers.slice(0, 1000);
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
            limitPerPart: 5,
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

        const mongoResults = await Part.find(mongoQuery).limit(5000).lean();

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
const MAX_EXCEL_ROWS = 5000;

const aiExcelAnalyze = async (req, res) => {
  try {
    let { data, filename, sheetName } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Excel data array is required',
      });
    }

    // Cap rows to prevent excessive processing
    if (data.length > MAX_EXCEL_ROWS) {
      console.warn(`⚠️ Excel data trimmed from ${data.length} to ${MAX_EXCEL_ROWS} rows`);
      data = data.slice(0, MAX_EXCEL_ROWS);
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
      console.log('🧠 Parsed intent:', JSON.stringify(parsed.parsedIntent, null, 2));
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
    const brandsList = partsBrands.length > 0 ? partsBrands : (filters.brand || []);

    const hasPartNumbers = partNumbers.length > 0 &&
      partNumbers.some(pn => /^[A-Z0-9\-]{3,}$/i.test(pn));
    const hasKeywords = searchKeywords.length > 0;

    console.log(`🔍 Strategy: partNumbers=${partNumbers.length}, keywords=${searchKeywords.length}, brands=${brandsList.length}`);

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
          partNumbers, { limitPerPart: 200 }
        );
        allResults = esResult.results;
        source = 'elasticsearch-parts';
        console.log(`📦 Part# search: ${esResult.found?.length || 0} found, ${esResult.notFound?.length || 0} not found`);
      } catch (e) { console.error('ES part search failed:', e.message); }
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
          console.log(`📦 Text search "${searchQuery}": ${allResults.length} results`);
        } catch (e) { console.error('ES text search failed:', e.message); }
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
            mongoQ.brand = { $in: brandsList.map(b => new RegExp(b, 'i')) };
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
        dbQuery.brand = { $in: brandsList.map(b => new RegExp(b, 'i')) };
      }
      if (parsedIntent.requireInStock) { dbQuery.quantity = { $gt: 0 }; }

      const qp = Part.find(dbQuery).limit(1000).lean();
      const tp = new Promise((_, rej) => setTimeout(() => rej(new Error('DB_TIMEOUT')), DB_QUERY_TIMEOUT));
      try { allResults = await Promise.race([qp, tp]); }
      catch { allResults = await Part.find(dbQuery).limit(300).lean(); }
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
      const filterResult = geminiService.filterDataWithAI(allResults, parsedIntent, query);
      filteredResults = filterResult.matchingParts;
      filterAnalysis = filterResult.analysis;
      console.log('🎯 Filter result:', filterAnalysis);
    } else {
      // Minimal fallback — just return everything (no intent parsed)
      filteredResults = [...allResults];
      filterAnalysis = { note: 'No intent parsed — returning raw results' };
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: SORT & DEDUPLICATE
    // ─────────────────────────────────────────────────────────────
    filteredResults.sort((a, b) => {
      const aIn = (a.quantity || 0) > 0 ? 1 : 0;
      const bIn = (b.quantity || 0) > 0 ? 1 : 0;
      if (bIn !== aIn) return bIn - aIn;
      if ((b.quantity || 0) !== (a.quantity || 0)) return (b.quantity || 0) - (a.quantity || 0);
      return (a.price || Infinity) - (b.price || Infinity);
    });

    // Deduplicate only truly identical entries (same part + supplier + price + quantity)
    const seen = new Set();
    filteredResults = filteredResults.filter(p => {
      const id = p._id ? p._id.toString() : `${p.partNumber}-${p.supplier || ''}-${p.price || 0}-${p.quantity || 0}-${p.stockCode || ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    filteredResults = filteredResults.slice(0, 500);

    // Apply topN limit if user asked for specific number of results (e.g. "best 3", "top 5")
    // Only apply when topN >= 2 ("best 1" or "best" = sort by best, not limit)
    if (parsedIntent.topN && parsedIntent.topN >= 2) {
      filteredResults = filteredResults.slice(0, parsedIntent.topN);
      console.log(`🎯 Applied topN=${parsedIntent.topN}, showing ${filteredResults.length} results`);
    }

    const searchTime = Date.now() - startTime;
    console.log(`✅ AI Search done in ${searchTime}ms: ${filteredResults.length} results`);

    // ─────────────────────────────────────────────────────────────
    // STEP 5: BUILD RESPONSE
    // ─────────────────────────────────────────────────────────────
    const stockStats = {
      highStock: filteredResults.filter(p => (p.quantity || 0) >= 10).length,
      inStock: filteredResults.filter(p => (p.quantity || 0) > 0).length,
      lowStock: filteredResults.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) < 10).length,
      outOfStock: filteredResults.filter(p => (p.quantity || 0) === 0).length,
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
      if (applied.length > 0) message += ` (filtered by: ${applied.join(', ')})`;
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
    } catch (e) { console.warn('Learning record error:', e.message); }

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
      filterStatus: {
        totalFetched: allResults.length,
        afterFiltering: filteredResults.length,
        analysis: filterAnalysis,
        stockStats,
      },
      learning: {
        recordId: learningRecordId,
        suggestions: learningSuggestions.length > 0 ? learningSuggestions : undefined,
      },
    };

    res.json(response);
  } catch (error) {
    const normalizedQuery = (req.body?.query || '').trim().toLowerCase();
    activeAISearches.delete(normalizedQuery);
    console.error('AI Search error:', error);

    const isTimeout = error.message?.includes('TIMEOUT') || error.message?.includes('timeout');
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

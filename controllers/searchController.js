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
 * AI-powered search - Professional grade with true AI understanding
 * POST /api/ai-search
 *
 * NEW ARCHITECTURE:
 * 1. AI parses user intent (understands what they want)
 * 2. Fetch data from database
 * 3. AI-driven filtering (smart filtering based on actual data)
 * 4. Return results with clear explanation
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

    // Prevent duplicate requests
    const normalizedQuery = query.trim().toLowerCase();
    if (activeAISearches.has(normalizedQuery)) {
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

    activeAISearches.set(normalizedQuery, { requestId, startTime: Date.now() });
    console.log(`🤖 AI Search [${requestId}]: "${query}"`);
    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: AI PARSES USER INTENT
    // ═══════════════════════════════════════════════════════════════
    let parsed;
    try {
      parsed = await geminiService.parseSearchQuery(query);
      console.log(
        '🧠 AI Intent:',
        JSON.stringify(parsed.intent || parsed.filters, null, 2),
      );
    } catch (parseError) {
      console.warn(`⚠️ AI parsing failed: ${parseError.message}`);
      parsed = {
        success: false,
        searchTerms: [],
        filters: {},
        intent: query,
        userIntent: null,
      };
    }

    const filters = parsed.filters || {};
    const userIntent = parsed.userIntent || null;
    const understood = userIntent?.understood || {};

    // Log what AI understood
    console.log('📋 Understood:', {
      stockRequirements: understood.stockConstraints,
      priceConstraints: understood.priceConstraints,
      brands: understood.brands,
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: FETCH DATA FROM DATABASE
    // ═══════════════════════════════════════════════════════════════
    let allResults = [];
    let source = 'mongodb';
    const searchTerms = parsed.searchTerms || [];

    const useElasticsearch = await elasticsearchService.hasDocuments();

    // Search by terms if provided
    if (searchTerms.length > 0) {
      if (useElasticsearch) {
        try {
          const esResult = await elasticsearchService.searchMultiplePartNumbers(
            searchTerms,
            { limitPerPart: 200 },
          );
          allResults = esResult.results;
          source = 'elasticsearch';
        } catch (esError) {
          console.error('ES search failed:', esError.message);
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
            .limit(200)
            .lean();
          allResults.push(...mongoResults);
        }
      }
    }

    // If no search terms or no results, fetch by filters
    if (allResults.length === 0) {
      const dbQuery = {};

      // Brand filter
      if (filters.brand && filters.brand.length > 0) {
        dbQuery.brand = { $in: filters.brand.map((b) => new RegExp(b, 'i')) };
      }

      // Fetch a broader set of data for AI filtering
      const queryPromise = Part.find(dbQuery).limit(1000).lean();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), DB_QUERY_TIMEOUT),
      );

      try {
        allResults = await Promise.race([queryPromise, timeoutPromise]);
      } catch (err) {
        console.warn('DB query timeout, using smaller limit');
        allResults = await Part.find(dbQuery).limit(300).lean();
      }
      source = 'mongodb-filtered';
    }

    console.log(`📦 Fetched ${allResults.length} parts from ${source}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: INTELLIGENT AI-DRIVEN FILTERING
    // This is where the magic happens - AI filters based on understanding
    // ═══════════════════════════════════════════════════════════════
    let filteredResults;
    let filterAnalysis;

    if (userIntent) {
      // Use the new AI-driven filtering
      const filterResult = await geminiService.filterDataWithAI(
        allResults,
        userIntent,
        query,
      );
      filteredResults = filterResult.matchingParts;
      filterAnalysis = filterResult.analysis;
      console.log('🎯 AI Filter Result:', filterAnalysis);
    } else {
      // Fallback to basic filtering
      filteredResults = applyBasicFilters(allResults, filters, query);
      filterAnalysis = { note: 'Used basic filtering (AI unavailable)' };
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: SORT AND DEDUPLICATE
    // ═══════════════════════════════════════════════════════════════

    // Sort by relevance: in-stock items first, then by quantity (high to low), then price
    filteredResults.sort((a, b) => {
      // First priority: Stock availability
      const aInStock = (a.quantity || 0) > 0 ? 1 : 0;
      const bInStock = (b.quantity || 0) > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;

      // Second priority: Quantity (higher is better for "full stock" queries)
      const aQty = a.quantity || 0;
      const bQty = b.quantity || 0;
      if (bQty !== aQty) return bQty - aQty;

      // Third priority: Price (lower is better)
      const aPrice = a.price || Infinity;
      const bPrice = b.price || Infinity;
      return aPrice - bPrice;
    });

    // Deduplicate by partNumber + supplier
    const seen = new Set();
    filteredResults = filteredResults.filter((p) => {
      const key = `${p.partNumber}-${p.supplier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Limit results
    filteredResults = filteredResults.slice(0, 500);

    const searchTime = Date.now() - startTime;
    console.log(
      `✅ AI Search completed in ${searchTime}ms: ${filteredResults.length} results`,
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: BUILD RESPONSE WITH CLEAR MESSAGING
    // ═══════════════════════════════════════════════════════════════
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
      const appliedFilters = [];
      if (filterAnalysis.filtersApplied.stock)
        appliedFilters.push(filterAnalysis.filtersApplied.stock);
      if (filterAnalysis.filtersApplied.price)
        appliedFilters.push(`price ${filterAnalysis.filtersApplied.price}`);
      if (filterAnalysis.filtersApplied.brands)
        appliedFilters.push(
          `brands: ${filterAnalysis.filtersApplied.brands.join(', ')}`,
        );

      if (appliedFilters.length > 0) {
        message += ` (filtered by: ${appliedFilters.join(', ')})`;
      }
    }

    if (
      stockStats.highStock > 0 &&
      (understood.stockConstraints?.requireHighStock ||
        filters.stockLevel === 'high')
    ) {
      message += `. ${stockStats.highStock} with high stock (qty ≥ 10).`;
    }

    // Clean up
    activeAISearches.delete(normalizedQuery);

    res.json({
      success: true,
      query,
      parsed: {
        searchTerms,
        filters: parsed.filters,
        intent: parsed.intent,
        understood: understood,
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
    });
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
 * Apply basic filters when AI is unavailable (fallback)
 */
function applyBasicFilters(parts, filters, query) {
  let filtered = [...parts];

  // Price filter
  if (filters.maxPrice !== undefined) {
    const maxPriceAED = convertCurrency(
      filters.maxPrice,
      filters.priceCurrency || 'USD',
      'AED',
    );
    filtered = filtered.filter(
      (p) =>
        p.price === null || p.price === undefined || p.price <= maxPriceAED,
    );
  }

  if (filters.minPrice !== undefined) {
    const minPriceAED = convertCurrency(
      filters.minPrice,
      filters.priceCurrency || 'USD',
      'AED',
    );
    filtered = filtered.filter(
      (p) =>
        p.price !== null && p.price !== undefined && p.price >= minPriceAED,
    );
  }

  // Stock filter
  if (filters.stockLevel === 'high' || filters.minQuantity >= 10) {
    filtered = filtered.filter((p) => (p.quantity || 0) >= 10);
  } else if (filters.inStock) {
    filtered = filtered.filter((p) => (p.quantity || 0) > 0);
  }

  // Exclude low stock if specified
  if (filters.exclude?.stockLevels?.includes('low')) {
    filtered = filtered.filter(
      (p) => (p.quantity || 0) >= 10 || (p.quantity || 0) === 0,
    );
  }

  // Brand filter
  if (filters.brand && filters.brand.length > 0) {
    const brandLower = filters.brand.map((b) => b.toLowerCase());
    filtered = filtered.filter((p) => {
      if (!p.brand) return false;
      return brandLower.some((b) => p.brand.toLowerCase().includes(b));
    });
  }

  // Exclude brands
  if (filters.exclude?.brands?.length > 0) {
    const excludeBrands = filters.exclude.brands.map((b) => b.toLowerCase());
    filtered = filtered.filter((p) => {
      if (!p.brand) return true;
      return !excludeBrands.some((b) => p.brand.toLowerCase().includes(b));
    });
  }

  return filtered;
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
  if (queryLower.includes('in stock') || queryLower.includes('available')) {
    filters.inStock = true;
  }

  // Full/high stock
  if (
    queryLower.match(/\b(full\s*stock|high\s*stock|plenty|well\s*stocked)\b/)
  ) {
    filters.stockLevel = 'high';
    filters.minQuantity = 10;
    filters.inStock = true;
  }

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

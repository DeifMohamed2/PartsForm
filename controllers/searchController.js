/**
 * Search Controller
 * Handles product search API endpoints for buyers
 */
const Part = require('../models/Part');
const elasticsearchService = require('../services/elasticsearchService');

/**
 * Search parts
 * GET /api/search
 */
const searchParts = async (req, res) => {
  try {
    const {
      q: query,
      page = 1,
      limit = 50,
      sortBy = 'importedAt',
      sortOrder = 'desc',
      brand,
      supplier,
      minPrice,
      maxPrice,
      inStock,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const filters = {
      brand,
      supplier,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      inStock: inStock === 'true',
      limit: limitNum,
      skip,
      sortBy,
      sortOrder,
    };

    let result;
    // Use cached check - much faster than calling getStats() every time
    const useElasticsearch = await elasticsearchService.hasDocuments();

    // Use Elasticsearch if available AND has data, otherwise fallback to MongoDB
    if (useElasticsearch) {
      result = await elasticsearchService.search(query || '', filters);
    } else {
      // Fallback to MongoDB
      result = await Part.searchParts(query || '', {
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder,
        filters: { brand, supplier, minPrice, maxPrice, inStock: inStock === 'true' },
      });
    }

    res.json({
      success: true,
      query: query || '',
      results: result.results,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: result.totalPages || Math.ceil(result.total / limitNum),
      hasMore: result.hasMore,
      searchTime: result.searchTime || null,
      source: useElasticsearch ? 'elasticsearch' : 'mongodb',
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
 * Autocomplete suggestions
 * GET /api/search/autocomplete
 */
const autocomplete = async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    let suggestions;
    // Use cached check for speed
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      suggestions = await elasticsearchService.autocomplete(query, parseInt(limit, 10));
    } else {
      // MongoDB fallback
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const results = await Part.find({
        $or: [
          { partNumber: { $regex: escapedQuery, $options: 'i' } },
          { description: { $regex: escapedQuery, $options: 'i' } },
        ],
      })
        .select('partNumber description brand supplier')
        .limit(parseInt(limit, 10))
        .lean();

      suggestions = results.map((r) => ({
        partNumber: r.partNumber,
        description: r.description,
        brand: r.brand,
        supplier: r.supplier,
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
    res.status(500).json({ success: false, error: 'Failed to get filter options' });
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
        searchEngine: elasticsearchService.isAvailable ? 'elasticsearch' : 'mongodb',
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
};

module.exports = {
  searchParts,
  autocomplete,
  getFilterOptions,
  getPartById,
  getPartsByNumber,
  getSearchStats,
};

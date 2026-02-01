/**
 * Elasticsearch Service
 * Ultra-fast search for automotive parts with millisecond response times
 * Supports 200M+ records with optimized indexing and search
 */
const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    this.client = null;
    this.indexName = 'automotive_parts';
    this.isAvailable = false;
    this.bulkQueue = [];
    this.bulkSize = 5000;
    this.bulkTimeout = null;
    // Cache for document count to avoid checking on every request
    this._cachedDocCount = null;
    this._docCountCacheTime = null;
    this._docCountCacheTTL = 60000; // 60 seconds cache
  }

  /**
   * Check if Elasticsearch has indexed documents (with caching)
   */
  async hasDocuments() {
    if (!this.isAvailable) return false;

    const now = Date.now();
    // Return cached value if still valid
    if (this._cachedDocCount !== null && this._docCountCacheTime && (now - this._docCountCacheTime) < this._docCountCacheTTL) {
      return this._cachedDocCount > 0;
    }

    try {
      const count = await this.client.count({ index: this.indexName });
      this._cachedDocCount = count.count;
      this._docCountCacheTime = now;
      return count.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate document count cache (call after indexing)
   */
  invalidateDocCountCache() {
    this._cachedDocCount = null;
    this._docCountCacheTime = null;
  }

  /**
   * Initialize Elasticsearch connection
   */
  async initialize() {
    try {
      const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

      const clientConfig = {
        node: esNode,
        maxRetries: 3,
        requestTimeout: 60000,
        sniffOnStart: false,
      };

      // Add auth if configured
      if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
        clientConfig.auth = {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD,
        };
      }

      this.client = new Client(clientConfig);

      // Test connection with timeout
      const health = await this.client.cluster.health({}, { requestTimeout: 5000 });
      console.log(`✅ Elasticsearch connected - Status: ${health.status}`);

      this.isAvailable = true;

      // Create optimized index
      await this.createIndex();

      return true;
    } catch (error) {
      console.error('⚠️  Elasticsearch connection failed:', error.message);
      console.log('   Falling back to MongoDB for search');
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Create index with optimized settings for large datasets
   */
  async createIndex() {
    try {
      const indexExists = await this.client.indices.exists({ index: this.indexName });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 3,
              number_of_replicas: 1,
              refresh_interval: '30s',
              max_result_window: 10000,
              analysis: {
                analyzer: {
                  part_number_analyzer: {
                    type: 'custom',
                    tokenizer: 'keyword',
                    filter: ['lowercase'],
                  },
                  autocomplete_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'autocomplete_filter'],
                  },
                  autocomplete_search_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase'],
                  },
                },
                filter: {
                  autocomplete_filter: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 20,
                  },
                },
              },
            },
            mappings: {
              properties: {
                partNumber: {
                  type: 'keyword',
                  fields: {
                    text: { type: 'text', analyzer: 'part_number_analyzer' },
                    autocomplete: {
                      type: 'text',
                      analyzer: 'autocomplete_analyzer',
                      search_analyzer: 'autocomplete_search_analyzer',
                    },
                  },
                },
                description: {
                  type: 'text',
                  analyzer: 'standard',
                  fields: { keyword: { type: 'keyword', ignore_above: 256 } },
                },
                brand: {
                  type: 'keyword',
                  fields: { text: { type: 'text', analyzer: 'standard' } },
                },
                supplier: {
                  type: 'keyword',
                  fields: { text: { type: 'text', analyzer: 'standard' } },
                },
                price: { type: 'float' },
                currency: { type: 'keyword' },
                quantity: { type: 'integer' },
                minOrderQty: { type: 'integer' },
                stock: { type: 'keyword' },
                stockCode: { type: 'keyword' },
                weight: { type: 'float' },
                volume: { type: 'float' },
                deliveryDays: { type: 'integer' },
                category: { type: 'keyword' },
                integration: { type: 'keyword' },
                integrationName: { type: 'keyword' },
                fileName: { type: 'keyword' },
                importedAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });

        console.log('✅ Elasticsearch index created with optimized settings');
      } else {
        console.log('✅ Elasticsearch index already exists');
      }
    } catch (error) {
      console.error('Error creating Elasticsearch index:', error.message);
      throw error;
    }
  }

  /**
   * Search for parts with advanced filtering
   */
  async search(query, filters = {}) {
    if (!this.isAvailable) {
      throw new Error('Elasticsearch is not available');
    }

    try {
      const limit = filters.limit || 50;
      const skip = filters.skip || 0;
      const sortBy = filters.sortBy || 'importedAt';
      const sortOrder = filters.sortOrder || 'desc';

      const must = [];
      const filter = [];

      // Main search query
      if (query && query.trim()) {
        const searchTerm = query.trim();

        must.push({
          bool: {
            should: [
              { term: { partNumber: { value: searchTerm, boost: 10.0 } } },
              { term: { partNumber: { value: searchTerm.toUpperCase(), boost: 10.0 } } },
              { prefix: { partNumber: { value: searchTerm.toUpperCase(), boost: 5.0 } } },
              { match: { 'partNumber.autocomplete': { query: searchTerm, boost: 3.0 } } },
              { match: { description: { query: searchTerm, boost: 2.0 } } },
              { match: { 'brand.text': { query: searchTerm, boost: 2.0 } } },
              { match: { 'supplier.text': { query: searchTerm, boost: 1.5 } } },
            ],
            minimum_should_match: 1,
          },
        });
      }

      // Filters
      if (filters.partNumber) {
        filter.push({
          wildcard: {
            partNumber: { value: `*${filters.partNumber.trim().toUpperCase()}*`, case_insensitive: true },
          },
        });
      }

      if (filters.brand) {
        filter.push({
          wildcard: {
            brand: { value: `*${filters.brand.trim()}*`, case_insensitive: true },
          },
        });
      }

      if (filters.supplier) {
        filter.push({
          wildcard: {
            supplier: { value: `*${filters.supplier.trim()}*`, case_insensitive: true },
          },
        });
      }

      if (filters.integration) {
        filter.push({ term: { integration: filters.integration } });
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const range = {};
        if (filters.minPrice !== undefined) range.gte = parseFloat(filters.minPrice);
        if (filters.maxPrice !== undefined) range.lte = parseFloat(filters.maxPrice);
        filter.push({ range: { price: range } });
      }

      if (filters.inStock) {
        filter.push({ range: { quantity: { gt: 0 } } });
      }

      // Build search body
      const searchBody = {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter: filter.length > 0 ? filter : undefined,
          },
        },
        sort: [{ [sortBy]: { order: sortOrder } }],
        from: skip,
        size: limit,
        track_total_hits: true,
      };

      const startTime = Date.now();
      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });
      const searchTime = Date.now() - startTime;

      const results = response.hits.hits.map((hit) => ({
        _id: hit._id,
        ...hit._source,
        _score: hit._score,
      }));

      console.log(`🔍 ES Search: "${query}" - ${response.hits.total.value} results in ${searchTime}ms`);

      return {
        results,
        total: response.hits.total.value,
        limit,
        skip,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(response.hits.total.value / limit),
        hasMore: skip + results.length < response.hits.total.value,
        searchTime: `${searchTime}ms`,
      };
    } catch (error) {
      console.error('Elasticsearch search error:', error.message);
      throw error;
    }
  }

  /**
   * Autocomplete suggestions - Part Number Only (Prefix Match)
   * Returns unique part numbers that START WITH the query
   * NO description matching, NO fuzzy matching
   * Optimized to avoid fielddata and reduce memory usage
   */
  async autocomplete(query, limit = 10) {
    if (!this.isAvailable || !query || !query.trim()) {
      return [];
    }

    try {
      const searchTerm = query.trim();
      
      // Use field collapsing instead of terms aggregation to avoid fielddata memory issues
      // This is much more memory-efficient for large datasets
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              should: [
                // Prefix match - case insensitive
                { prefix: { partNumber: { value: searchTerm, case_insensitive: true } } },
                // Prefix match - uppercase
                { prefix: { partNumber: { value: searchTerm.toUpperCase() } } },
              ],
              minimum_should_match: 1,
            },
          },
          // Use field collapsing to get unique part numbers - avoids fielddata
          collapse: {
            field: 'partNumber',
            inner_hits: {
              name: 'count_hits',
              size: 0, // We just need the count
            },
          },
          sort: [{ partNumber: { order: 'asc' } }],
          size: limit,
          _source: ['partNumber', 'brand'],
          // Limit track_total_hits to reduce memory
          track_total_hits: false,
        },
        // Reduce request timeout and add circuit breaker friendly settings
        request_cache: true,
      });

      // Extract unique part numbers from collapsed hits
      return response.hits.hits.map((hit) => ({
        partNumber: hit._source.partNumber,
        brand: hit._source.brand || '',
        count: hit.inner_hits?.count_hits?.hits?.total?.value || 1,
      }));
    } catch (error) {
      console.error('Autocomplete error:', error.message);
      // If circuit breaker trips, return empty gracefully
      if (error.message?.includes('circuit_breaking_exception') || error.message?.includes('Data too large')) {
        console.warn('Elasticsearch memory limit reached - returning empty autocomplete');
        return [];
      }
      return [];
    }
  }

  /**
   * Search by EXACT part number ONLY - returns all suppliers with the same part number
   * This is the primary search method - NO fuzzy matching, NO description matching
   * @param {string} partNumber - The exact part number to search for
   * @param {object} filters - Optional filters (sortBy, sortOrder, limit, skip)
   */
  async searchByExactPartNumber(partNumber, filters = {}) {
    if (!this.isAvailable || !partNumber || !partNumber.trim()) {
      return { results: [], total: 0 };
    }

    try {
      const limit = filters.limit || 100;
      const skip = filters.skip || 0;
      const sortBy = filters.sortBy || 'price';
      const sortOrder = filters.sortOrder || 'asc';
      
      // Clean the part number - exact match only
      const exactPartNumber = partNumber.trim();

      // Use term query for EXACT match on the keyword field
      // This ensures only parts with the EXACT same part number are returned
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              should: [
                // Exact match - case as provided
                { term: { partNumber: exactPartNumber } },
                // Exact match - uppercase
                { term: { partNumber: exactPartNumber.toUpperCase() } },
                // Exact match - lowercase
                { term: { partNumber: exactPartNumber.toLowerCase() } },
              ],
              minimum_should_match: 1,
            },
          },
          sort: [{ [sortBy]: { order: sortOrder, missing: '_last' } }],
          from: skip,
          size: limit,
          track_total_hits: true,
        },
      });

      const results = response.hits.hits.map((hit) => ({
        _id: hit._id,
        ...hit._source,
        _score: hit._score,
      }));

      console.log(`🔍 ES Exact Part Number Search: "${partNumber}" - ${response.hits.total.value} results (exact match only)`);

      return {
        results,
        total: response.hits.total.value,
        partNumber: exactPartNumber,
      };
    } catch (error) {
      console.error('Exact part number search error:', error.message);
      throw error;
    }
  }

  /**
   * Search multiple part numbers in a single query - FAST bulk search
   * @param {string[]} partNumbers - Array of part numbers to search
   * @param {object} options - Optional settings (limit per part)
   * @returns {object} { results: [], found: [], notFound: [], total: number }
   */
  async searchMultiplePartNumbers(partNumbers, options = {}) {
    if (!this.isAvailable || !partNumbers || partNumbers.length === 0) {
      return { results: [], found: [], notFound: partNumbers || [], total: 0 };
    }

    try {
      const limitPerPart = options.limitPerPart || 50;
      const totalLimit = Math.min(partNumbers.length * limitPerPart, 1000);

      // Build terms for all part numbers (with case variations)
      const allTerms = [];
      partNumbers.forEach(pn => {
        const trimmed = pn.trim();
        allTerms.push(trimmed);
        allTerms.push(trimmed.toUpperCase());
        allTerms.push(trimmed.toLowerCase());
      });

      // Single query to find all parts at once
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            terms: {
              partNumber: allTerms,
            },
          },
          size: totalLimit,
          track_total_hits: true,
        },
      });

      const results = response.hits.hits.map((hit) => ({
        _id: hit._id,
        ...hit._source,
        _score: hit._score,
      }));

      // Determine which parts were found
      const foundPartNumbers = new Set();
      results.forEach(r => {
        if (r.partNumber) {
          foundPartNumbers.add(r.partNumber.toUpperCase());
        }
      });

      const found = [];
      const notFound = [];
      partNumbers.forEach(pn => {
        const upper = pn.trim().toUpperCase();
        if (foundPartNumbers.has(upper)) {
          found.push(pn);
        } else {
          notFound.push(pn);
        }
      });

      console.log(`🔍 ES Multi-Part Search: ${partNumbers.length} parts requested, ${found.length} found, ${notFound.length} not found, ${results.length} total results`);

      return {
        results,
        total: results.length,
        found,
        notFound,
      };
    } catch (error) {
      console.error('Multi-part search error:', error.message);
      return { results: [], found: [], notFound: partNumbers, total: 0 };
    }
  }

  /**
   * Get filter aggregations
   */
  async getFilterOptions(query = '', filters = {}) {
    if (!this.isAvailable) {
      return { brands: [], suppliers: [], priceRange: { min: 0, max: 0 } };
    }

    try {
      const must = [];
      if (query && query.trim()) {
        must.push({
          multi_match: {
            query: query.trim(),
            fields: ['partNumber^10', 'partNumber.autocomplete^5', 'description^2', 'brand.text^2', 'supplier.text'],
          },
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: { bool: { must: must.length > 0 ? must : [{ match_all: {} }] } },
          size: 0,
          aggs: {
            brands: { terms: { field: 'brand', size: 100, order: { _key: 'asc' } } },
            suppliers: { terms: { field: 'supplier', size: 100, order: { _key: 'asc' } } },
            priceRange: { stats: { field: 'price' } },
          },
        },
      });

      return {
        brands: response.aggregations.brands.buckets.map((b) => b.key).filter(Boolean),
        suppliers: response.aggregations.suppliers.buckets.map((b) => b.key).filter(Boolean),
        priceRange: {
          min: response.aggregations.priceRange.min || 0,
          max: response.aggregations.priceRange.max || 0,
        },
      };
    } catch (error) {
      console.error('Filter options error:', error.message);
      return { brands: [], suppliers: [], priceRange: { min: 0, max: 0 } };
    }
  }

  /**
   * Bulk index documents with retry logic for 429 errors
   */
  async bulkIndex(documents, retryCount = 0) {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 1000; // 1 second base delay

    if (!this.isAvailable || documents.length === 0) {
      return { indexed: 0, errors: 0 };
    }

    try {
      const body = documents.flatMap((doc) => [
        { index: { _index: this.indexName, _id: doc._id?.toString() || undefined } },
        {
          partNumber: doc.partNumber,
          description: doc.description,
          brand: doc.brand,
          supplier: doc.supplier,
          price: doc.price,
          currency: doc.currency,
          quantity: doc.quantity,
          minOrderQty: doc.minOrderQty,
          stock: doc.stock,
          stockCode: doc.stockCode,
          weight: doc.weight,
          volume: doc.volume,
          deliveryDays: doc.deliveryDays,
          category: doc.category,
          integration: doc.integration?.toString(),
          integrationName: doc.integrationName,
          fileName: doc.fileName,
          importedAt: doc.importedAt,
          createdAt: doc.createdAt,
        },
      ]);

      const startTime = Date.now();
      const response = await this.client.bulk({ body, refresh: false });
      const indexTime = Date.now() - startTime;

      const errors = response.items.filter((item) => item.index?.error);
      const indexed = documents.length - errors.length;

      if (errors.length > 0) {
        console.error(`⚠️  ${errors.length} errors during bulk indexing`);
      }

      console.log(`✅ ES Indexed ${indexed} documents in ${indexTime}ms`);

      return { indexed, errors: errors.length };
    } catch (error) {
      // Handle 429 Too Many Requests with exponential backoff
      if (error.meta?.statusCode === 429 && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`⚠️  ES rate limited (429). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.bulkIndex(documents, retryCount + 1);
      }
      
      console.error('Bulk index error:', error.message);
      // Return error count instead of throwing to allow sync to continue
      return { indexed: 0, errors: documents.length, error: error.message };
    }
  }

  /**
   * Queue document for bulk indexing
   */
  async queueDocument(document) {
    if (!this.isAvailable) return;

    this.bulkQueue.push(document);

    if (this.bulkQueue.length >= this.bulkSize) {
      await this.flushBulkQueue();
    } else {
      if (this.bulkTimeout) clearTimeout(this.bulkTimeout);
      this.bulkTimeout = setTimeout(() => this.flushBulkQueue(), 5000);
    }
  }

  /**
   * Flush bulk queue
   */
  async flushBulkQueue() {
    if (this.bulkQueue.length === 0) return;

    const documents = [...this.bulkQueue];
    this.bulkQueue = [];

    if (this.bulkTimeout) {
      clearTimeout(this.bulkTimeout);
      this.bulkTimeout = null;
    }

    await this.bulkIndex(documents);
    // Invalidate cache so new docs are discovered
    this.invalidateDocCountCache();
  }

  /**
   * Get index statistics
   */
  async getStats() {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const [stats, count] = await Promise.all([
        this.client.indices.stats({ index: this.indexName }),
        this.client.count({ index: this.indexName }),
      ]);

      return {
        documentCount: count.count,
        indexSize: stats.indices[this.indexName]?.total?.store?.size_in_bytes || 0,
        indexSizeHuman: this._formatBytes(stats.indices[this.indexName]?.total?.store?.size_in_bytes || 0),
      };
    } catch (error) {
      console.error('Error getting ES stats:', error.message);
      return null;
    }
  }

  /**
   * Refresh index
   */
  async refreshIndex() {
    if (!this.isAvailable) return;

    try {
      await this.client.indices.refresh({ index: this.indexName });
      console.log('✅ Elasticsearch index refreshed');
    } catch (error) {
      console.error('Error refreshing index:', error.message);
    }
  }

  /**
   * Delete documents by integration
   */
  async deleteByIntegration(integrationId) {
    if (!this.isAvailable) return { deleted: 0 };

    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: { term: { integration: integrationId.toString() } },
        },
      });

      console.log(`✅ Deleted ${response.deleted} documents for integration ${integrationId}`);
      return { deleted: response.deleted };
    } catch (error) {
      console.error('Error deleting by integration:', error.message);
      return { deleted: 0 };
    }
  }

  /**
   * Helper: Format bytes
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Clear fielddata cache to free memory
   * Call this when circuit breaker errors occur
   */
  async clearFielddataCache() {
    if (!this.isAvailable) return { success: false, message: 'Elasticsearch not available' };

    try {
      await this.client.indices.clearCache({
        index: this.indexName,
        fielddata: true,
      });
      console.log('✅ Elasticsearch fielddata cache cleared');
      return { success: true, message: 'Fielddata cache cleared' };
    } catch (error) {
      console.error('Error clearing fielddata cache:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get memory usage stats for monitoring
   */
  async getMemoryStats() {
    if (!this.isAvailable) return null;

    try {
      const stats = await this.client.nodes.stats({ metric: ['breaker', 'jvm'] });
      const nodes = stats.nodes;
      const nodeStats = Object.values(nodes)[0];
      
      return {
        heapUsed: this._formatBytes(nodeStats.jvm?.mem?.heap_used_in_bytes || 0),
        heapMax: this._formatBytes(nodeStats.jvm?.mem?.heap_max_in_bytes || 0),
        heapPercent: nodeStats.jvm?.mem?.heap_used_percent || 0,
        fielddata: this._formatBytes(nodeStats.breaker?.fielddata?.estimated_size_in_bytes || 0),
        request: this._formatBytes(nodeStats.breaker?.request?.estimated_size_in_bytes || 0),
        parent: {
          limit: this._formatBytes(nodeStats.breaker?.parent?.limit_size_in_bytes || 0),
          estimated: this._formatBytes(nodeStats.breaker?.parent?.estimated_size_in_bytes || 0),
        },
      };
    } catch (error) {
      console.error('Error getting memory stats:', error.message);
      return null;
    }
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      await this.flushBulkQueue();
      await this.client.close();
      console.log('✅ Elasticsearch connection closed');
    }
  }
}

// Export singleton instance
const elasticsearchService = new ElasticsearchService();
module.exports = elasticsearchService;

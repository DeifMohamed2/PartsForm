/**
 * Elasticsearch Service
 * Ultra-fast search for automotive parts with millisecond response times
 * Supports 200M+ records with optimized indexing and search
 */
const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

class ElasticsearchService {
  constructor() {
    this.client = null;
    this.indexName = process.env.ELASTICSEARCH_INDEX || 'automotive_parts';
    this.isAvailable = false;
    this.bulkQueue = [];
    this.bulkSize = parseInt(process.env.ELASTICSEARCH_BULK_SIZE, 10) || 25000; // 25k for 16GB ES - ULTRA-FAST
    this.bulkTimeout = null;
    // Cache for document count to avoid checking on every request
    this._cachedDocCount = null;
    this._docCountCacheTime = null;
    this._docCountCacheTTL = 30000; // 30 seconds cache (shorter for fast recovery after sync)
    // Production mode - less logging
    this.productionMode = process.env.NODE_ENV === 'production' || process.env.SYNC_PRODUCTION_MODE === 'true';
    this._indexedCount = 0;
    this._lastLogTime = 0;
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
        maxRetries: 5,
        requestTimeout: 120000, // 2 min for large bulk operations
        sniffOnStart: false,
        compression: 'gzip', // Reduce network overhead
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
      logger.info(`Elasticsearch connected - Status: ${health.status}`, { service: 'elasticsearch' });

      this.isAvailable = true;

      // Create optimized index
      await this.createIndex();

      return true;
    } catch (error) {
      logger.error('Elasticsearch connection failed', { service: 'elasticsearch', error: error.message });
      logger.warn('Falling back to MongoDB for search', { service: 'elasticsearch' });
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
              number_of_shards: 5, // More shards for 74M+ parts
              number_of_replicas: 0, // Disable during bulk indexing (enable after)
              refresh_interval: '-1', // Disable refresh during bulk indexing
              max_result_window: 50000,
              'index.translog.durability': 'async', // Faster indexing
              'index.translog.sync_interval': '30s',
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
                deliveryTime: { type: 'keyword' },
                category: { type: 'keyword' },
                integration: { type: 'keyword' },
                integrationName: { type: 'keyword' },
                sourceType: { type: 'keyword' },
                sourceSupplierId: { type: 'keyword' },
                sourceSupplierName: { type: 'keyword' },
                fileName: { type: 'keyword' },
                importedAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });

        console.log('✅ Elasticsearch index created with optimized settings');
      } else {
        if (!this.productionMode) console.log('✅ Elasticsearch index already exists');
      }
    } catch (error) {
      console.error('Error creating Elasticsearch index:', error.message);
      throw error;
    }
  }

  /**
   * Finalize indexing - re-enable refresh and replicas after bulk sync
   * Call this after completing a large sync operation
   */
  async finalizeIndexing() {
    if (!this.isAvailable) return;
    
    try {
      await this.client.indices.putSettings({
        index: this.indexName,
        body: {
          'index.refresh_interval': '5s', // Normal refresh interval
          'index.number_of_replicas': 1, // Enable replicas
          'index.translog.durability': 'request' // Normal durability
        }
      });
      
      // Force refresh to make all docs searchable
      await this.client.indices.refresh({ index: this.indexName });
      
      console.log('✅ Elasticsearch index finalized - refresh and replicas enabled');
    } catch (error) {
      console.error('Error finalizing ES index:', error.message);
    }
  }

  /**
   * Prepare index for bulk indexing - disable refresh and replicas
   */
  async prepareForBulkIndexing() {
    if (!this.isAvailable) return;
    
    try {
      await this.client.indices.putSettings({
        index: this.indexName,
        body: {
          'index.refresh_interval': '-1', // Disable refresh
          'index.number_of_replicas': 0, // No replicas during bulk
          'index.translog.durability': 'async'
        }
      });
      
      if (!this.productionMode) console.log('⚡ ES index prepared for bulk indexing');
    } catch (error) {
      console.error('Error preparing ES for bulk:', error.message);
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
              // Exact matches (highest priority)
              { term: { partNumber: { value: searchTerm, boost: 10.0 } } },
              { term: { partNumber: { value: searchTerm.toUpperCase(), boost: 10.0 } } },
              // Vendor code match (supplier parts)
              { term: { vendorCode: { value: searchTerm, boost: 9.0 } } },
              { term: { vendorCode: { value: searchTerm.toUpperCase(), boost: 9.0 } } },
              { prefix: { vendorCode: { value: searchTerm.toUpperCase(), boost: 6.0 } } },
              // Part number prefix
              { prefix: { partNumber: { value: searchTerm.toUpperCase(), boost: 5.0 } } },
              // Autocomplete matches
              { match: { 'partNumber.autocomplete': { query: searchTerm, boost: 3.0 } } },
              { match: { 'vendorCode.text': { query: searchTerm, boost: 3.0 } } },
              // Description and brand
              { match: { description: { query: searchTerm, boost: 2.0 } } },
              { match: { 'brand.text': { query: searchTerm, boost: 2.0 } } },
              // Supplier name
              { match: { 'supplier.text': { query: searchTerm, boost: 1.5 } } },
              { match: { 'supplierName.text': { query: searchTerm, boost: 1.5 } } },
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

      // Supplier ID filter (for supplier-specific data)
      if (filters.supplierId) {
        filter.push({ term: { supplierId: filters.supplierId.toString() } });
      }

      // Table ID filter
      if (filters.tableId) {
        filter.push({ term: { tableId: filters.tableId.toString() } });
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

      // Clean part numbers: strip leading quotes (Excel text-prefix artifacts like 'ST1538)
      const stripQuotes = (s) => s.trim().replace(/^['"'‘’`]+/, '').trim();
      const cleanedParts = partNumbers.map(stripQuotes).filter(Boolean);

      // Batch large requests (ES terms query has practical limits)
      const BATCH_SIZE = 500;
      const batches = [];
      for (let i = 0; i < cleanedParts.length; i += BATCH_SIZE) {
        batches.push(cleanedParts.slice(i, i + BATCH_SIZE));
      }

      let results = [];

      for (const batch of batches) {
        const batchTerms = new Set();
        batch.forEach(pn => {
          batchTerms.add(pn);
          batchTerms.add(pn.toUpperCase());
          batchTerms.add(pn.toLowerCase());
        });

        const batchLimit = Math.min(batch.length * limitPerPart, 5000);

        const response = await this.client.search({
          index: this.indexName,
          body: {
            query: {
              terms: {
                partNumber: [...batchTerms],
              },
            },
            size: batchLimit,
            track_total_hits: true,
          },
        });

        const batchResults = response.hits.hits.map((hit) => ({
          _id: hit._id,
          ...hit._source,
          _score: hit._score,
        }));

        results = results.concat(batchResults);
      }

      // Determine which parts were found
      const foundPartNumbers = new Set();
      results.forEach(r => {
        if (r.partNumber) {
          foundPartNumbers.add(r.partNumber.toUpperCase());
        }
      });

      const found = [];
      const notFound = [];
      cleanedParts.forEach(pn => {
        const upper = pn.trim().toUpperCase();
        if (foundPartNumbers.has(upper)) {
          found.push(pn);
        } else {
          notFound.push(pn);
        }
      });

      console.log(`ES Multi-Part Search: ${cleanedParts.length} parts requested, ${found.length} found, ${notFound.length} not found, ${results.length} total results`);

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
          // Core part fields
          partNumber: doc.partNumber,
          vendorCode: doc.vendorCode, // Supplier's part code
          description: doc.description,
          brand: doc.brand,
          supplier: doc.supplier,
          price: doc.price,
          currency: doc.currency,
          quantity: doc.quantity,
          minOrderQty: doc.minOrderQty || doc.minLot, // Consolidated: minLot = minOrderQty
          stock: doc.stock,
          stockCode: doc.stockCode,
          weight: doc.weight,
          volume: doc.volume,
          deliveryDays: doc.deliveryDays,
          deliveryTime: doc.deliveryTime,
          category: doc.category,
          // Integration fields (for API integrations)
          integration: doc.integration?.toString(),
          integrationName: doc.integrationName,
          // Supplier data tracking fields (legacy)
          supplierId: doc.supplierId,
          supplierName: doc.supplierName,
          supplierCode: doc.supplierCode,
          tableId: doc.tableId,
          tableName: doc.tableName,
          recordId: doc.recordId,
          dataSource: doc.dataSource,
          // Supplier upload tracking fields (NEW - for supplier portal uploads)
          sourceSupplierId: doc.sourceSupplierId,
          sourceType: doc.sourceType,
          sourceSupplierName: doc.sourceSupplierName,
          // File and date info
          fileName: doc.fileName,
          importedAt: doc.importedAt,
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
        },
      ]);

      const startTime = Date.now();
      const response = await this.client.bulk({ body, refresh: false });
      const indexTime = Date.now() - startTime;

      const errors = response.items.filter((item) => item.index?.error);
      const indexed = documents.length - errors.length;

      if (errors.length > 0 && !this.productionMode) {
        console.error(`⚠️  ${errors.length} ES index errors`);
      }

      // In production, only log periodically (every 50k docs or 30 seconds)
      this._indexedCount += indexed;
      const now = Date.now();
      const LOG_INTERVAL = this.productionMode ? 30000 : 5000; // 30s in prod, 5s in dev
      const LOG_THRESHOLD = this.productionMode ? 50000 : 10000; // 50k in prod, 10k in dev
      
      if ((now - this._lastLogTime > LOG_INTERVAL) || this._indexedCount >= LOG_THRESHOLD) {
        console.log(`✅ ES: ${this._indexedCount.toLocaleString()} docs indexed`);
        this._indexedCount = 0;
        this._lastLogTime = now;
      }

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

      // When using aliases, stats are keyed by the real index name, not the alias
      let indexStats = stats.indices[this.indexName];
      if (!indexStats) {
        // Find the actual index behind the alias
        const realIndex = Object.keys(stats.indices)[0];
        if (realIndex) indexStats = stats.indices[realIndex];
      }

      return {
        documentCount: count.count,
        indexSize: indexStats?.total?.store?.size_in_bytes || 0,
        indexSizeHuman: this._formatBytes(indexStats?.total?.store?.size_in_bytes || 0),
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
      if (!this.productionMode) console.log('✅ Elasticsearch index refreshed');
    } catch (error) {
      console.error('Error refreshing index:', error.message);
    }
  }

  /**
   * Delete documents by integration - optimized for speed
   */
  async deleteByIntegration(integrationId) {
    if (!this.isAvailable) return { deleted: 0 };

    try {
      const startTime = Date.now();
      
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: { term: { integration: integrationId.toString() } },
        },
        conflicts: 'proceed', // Don't fail on version conflicts
        refresh: false, // Don't refresh after delete (faster)
        wait_for_completion: true,
        slices: 'auto', // Parallel delete across shards
        scroll_size: 10000, // Process 10k docs per batch
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🗑️  ES: Deleted ${response.deleted?.toLocaleString() || 0} docs in ${duration}s`);
      return { deleted: response.deleted || 0 };
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

  /**
   * FAST BULK REINDEX - Index all parts for an integration from MongoDB to ES
   * Called AFTER MongoDB import is complete for maximum speed
   * Uses streaming cursor to avoid memory issues with 76M+ records
   * @param {string} integrationId - The integration to reindex
   * @param {function} onProgress - Optional progress callback
   */
  async reindexIntegration(integrationId, onProgress = null) {
    if (!this.isAvailable) {
      console.log('⚠️  ES not available, skipping reindex');
      return { indexed: 0, errors: 0 };
    }

    const Part = require('../models/Part');
    const startTime = Date.now();
    let totalIndexed = 0;
    let totalErrors = 0;
    let batchNum = 0;
    
    // ULTRA-FAST: Large batches with high parallelism
    // 16GB ES with 96GB server RAM can handle this
    const REINDEX_BATCH_SIZE = 25000;  // 25k per batch
    const PARALLEL_BULK = 5;            // 5 concurrent bulk operations
    
    console.log(`🔄 Starting ULTRA-FAST ES reindex for integration ${integrationId}...`);
    
    try {
      // Prepare ES for bulk indexing
      await this.prepareForBulkIndexing();
      
      // Use cursor to stream from MongoDB (memory efficient)
      const cursor = Part.find({ integration: integrationId })
        .select('partNumber description brand supplier price currency quantity minOrderQty stock stockCode weight volume deliveryDays deliveryTime category integration integrationName fileName importedAt createdAt')
        .lean()
        .cursor({ batchSize: REINDEX_BATCH_SIZE });
      
      let batch = [];
      let pendingBulks = [];
      
      for await (const doc of cursor) {
        batch.push({
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
          deliveryTime: doc.deliveryTime,
          category: doc.category,
          integration: doc.integration?.toString(),
          integrationName: doc.integrationName,
          fileName: doc.fileName,
          importedAt: doc.importedAt,
          createdAt: doc.createdAt,
          _id: doc._id?.toString(),
        });
        
        if (batch.length >= REINDEX_BATCH_SIZE) {
          const batchToIndex = [...batch];
          batch = [];
          batchNum++;
          
          // Queue bulk operation
          pendingBulks.push(this.bulkIndex(batchToIndex));
          
          // Process in parallel batches of PARALLEL_BULK
          if (pendingBulks.length >= PARALLEL_BULK) {
            const results = await Promise.all(pendingBulks);
            pendingBulks = [];
            
            for (const r of results) {
              totalIndexed += r.indexed || 0;
              totalErrors += r.errors || 0;
            }
            
            // Progress callback
            if (onProgress && batchNum % 10 === 0) {
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const rate = Math.round(totalIndexed / parseFloat(elapsed));
              onProgress({
                indexed: totalIndexed,
                errors: totalErrors,
                elapsed: elapsed,
                rate: rate,
              });
            }
            
            // Yield to event loop
            await new Promise(resolve => setImmediate(resolve));
          }
        }
      }
      
      // Process remaining batches
      if (batch.length > 0) {
        pendingBulks.push(this.bulkIndex(batch));
      }
      
      if (pendingBulks.length > 0) {
        const results = await Promise.all(pendingBulks);
        for (const r of results) {
          totalIndexed += r.indexed || 0;
          totalErrors += r.errors || 0;
        }
      }
      
      // Finalize indexing
      await this.finalizeIndexing();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = Math.round(totalIndexed / parseFloat(duration));
      console.log(`✅ ES reindex complete: ${totalIndexed.toLocaleString()} docs in ${duration}s (${rate.toLocaleString()}/s)`);
      
      return { indexed: totalIndexed, errors: totalErrors, duration: parseFloat(duration) };
      
    } catch (error) {
      console.error('❌ ES reindex error:', error.message);
      await this.finalizeIndexing(); // Ensure we restore settings
      return { indexed: totalIndexed, errors: totalErrors, error: error.message };
    }
  }

  // ==================== SUPPLIER DATA INDEXING ====================

  /**
   * Update ES mapping to add supplier-specific fields (call once)
   */
  async updateMappingForSupplierData() {
    if (!this.isAvailable) return;
    
    try {
      await this.client.indices.putMapping({
        index: this.indexName,
        body: {
          properties: {
            // Supplier tracking fields
            supplierId: { type: 'keyword' },
            supplierName: { type: 'keyword', fields: { text: { type: 'text' } } },
            supplierCode: { type: 'keyword' },
            tableId: { type: 'keyword' },
            tableName: { type: 'keyword' },
            recordId: { type: 'keyword' },
            dataSource: { type: 'keyword' }, // 'supplier_import', 'integration', 'manual'
            // Vendor code - supplier's internal part identifier
            vendorCode: { type: 'keyword', fields: { text: { type: 'text' } } },
            updatedAt: { type: 'date' },
          }
        }
      });
      console.log('✅ ES mapping updated for supplier data');
    } catch (error) {
      // Ignore if mapping already exists
      if (!error.message.includes('mapper_parsing_exception')) {
        console.error('Error updating ES mapping:', error.message);
      }
    }
  }

  /**
   * Index supplier data from a table import
   * @param {Object} options - Indexing options
   * @param {string} options.tableId - MongoDB ID of the data table
   * @param {string} options.tableName - Name of the table
   * @param {string} options.supplierId - MongoDB ID of the supplier
   * @param {string} options.supplierName - Name of the supplier
   * @param {string} options.supplierCode - Supplier code
   * @param {Array} options.records - Array of records to index
   * @param {Object} options.columnMapping - Map of column keys to ES fields
   * @param {string} options.fileName - Original file name
   * @param {boolean} options.replaceExisting - If true, delete existing table data first
   */
  async indexSupplierData({
    tableId,
    tableName,
    supplierId,
    supplierName,
    supplierCode,
    records,
    columnMapping = {},
    fileName,
    replaceExisting = true,
  }) {
    if (!this.isAvailable) {
      console.log('⚠️  Elasticsearch not available, skipping indexing');
      return { indexed: 0, errors: 0, skipped: true };
    }

    if (!records || records.length === 0) {
      return { indexed: 0, errors: 0 };
    }

    const startTime = Date.now();
    console.log(`📊 Indexing ${records.length.toLocaleString()} supplier records to ES...`);

    try {
      // Ensure mapping is updated
      await this.updateMappingForSupplierData();

      // Delete existing records for this table if replacing
      if (replaceExisting && tableId) {
        const deleteResult = await this.deleteByTable(tableId);
        if (deleteResult.deleted > 0) {
          console.log(`🗑️  Removed ${deleteResult.deleted.toLocaleString()} existing records for table`);
        }
      }

      // Prepare for bulk indexing
      await this.prepareForBulkIndexing();

      // Smart field mapping from supplier data to ES fields
      // Note: minLot maps to minOrderQty (consolidated), oem/article map to partNumber as fallback
      const fieldMap = {
        // Part number fields - vendor_code is kept separate, others fill partNumber
        'part_number': 'partNumber', 'partnumber': 'partNumber', 'sku': 'partNumber',
        'oem_number': 'partNumber', 'oem': 'partNumber', // OEM goes to partNumber
        'article_number': 'partNumber', 'article': 'partNumber', // Article goes to partNumber
        'vendor_code': 'vendorCode', 'vendorcode': 'vendorCode', // Vendor code stays separate
        // Description fields
        'description': 'description', 'title': 'description', 'name': 'description',
        'product_name': 'description', 'item_name': 'description',
        // Brand fields
        'brand': 'brand', 'make': 'brand', 'manufacturer': 'brand',
        // Price fields
        'price': 'price', 'priceaed': 'price', 'price_aed': 'price',
        'unit_price': 'price', 'sell_price': 'price',
        // Quantity fields
        'quantity': 'quantity', 'qty': 'quantity', 'stock_qty': 'quantity',
        'min_lot': 'minOrderQty', 'minlot': 'minOrderQty', 'min_order': 'minOrderQty', // All map to minOrderQty
        // Stock fields
        'stock': 'stock', 'availability': 'stock', 'in_stock': 'stock',
        'stock_code': 'stockCode',
        // Weight/Volume
        'weight': 'weight', 'volume': 'volume',
        // Delivery
        'delivery': 'deliveryDays', 'delivery_days': 'deliveryDays', 'lead_time': 'deliveryDays',
        // Category
        'category': 'category', 'product_category': 'category',
        ...columnMapping,
      };

      // Convert records to ES documents
      const now = new Date();
      const documents = records.map((record, index) => {
        const data = record.data || record;
        const doc = {
          _id: record._id?.toString() || `${tableId}_${index}_${Date.now()}`,
          // Supplier tracking
          supplierId: supplierId?.toString(),
          supplierName: supplierName,
          supplierCode: supplierCode,
          tableId: tableId?.toString(),
          tableName: tableName,
          recordId: record._id?.toString(),
          dataSource: 'supplier_import',
          // File info
          fileName: fileName,
          importedAt: now,
          updatedAt: now,
        };

        // Map data fields to ES fields
        for (const [key, value] of Object.entries(data)) {
          if (value === null || value === undefined || value === '') continue;
          
          const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const esField = fieldMap[lowerKey] || fieldMap[key];
          
          if (esField) {
            // Type conversion based on ES field
            if (['price', 'weight', 'volume'].includes(esField)) {
              const numVal = parseFloat(String(value).replace(',', '.'));
              if (!isNaN(numVal)) doc[esField] = numVal;
            } else if (['quantity', 'minOrderQty', 'deliveryDays'].includes(esField)) {
              const intVal = parseInt(String(value).replace(/[^\d]/g, ''), 10);
              if (!isNaN(intVal)) doc[esField] = intVal;
            } else {
              doc[esField] = String(value).trim();
            }
          }
          
          // Also store with original key if it's a known parts field
          if (['partNumber', 'vendorCode', 'brand', 'description'].includes(esField)) {
            // Already mapped above
          }
        }

        // Use vendorCode as partNumber fallback if not set
        if (!doc.partNumber && doc.vendorCode) {
          doc.partNumber = doc.vendorCode;
        }

        // Fallback: use first text column as part number if still not mapped
        if (!doc.partNumber) {
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'string' && value.length > 0 && value.length < 100) {
              doc.partNumber = String(value).trim().toUpperCase();
              break;
            }
          }
        }

        // Set supplier name as supplier field for search
        doc.supplier = supplierName || supplierCode;

        return doc;
      });

      // Bulk index in batches
      const batchSize = 5000;
      let totalIndexed = 0;
      let totalErrors = 0;

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const result = await this.bulkIndex(batch);
        totalIndexed += result.indexed || 0;
        totalErrors += result.errors || 0;
      }

      // Finalize
      await this.finalizeIndexing();
      this.invalidateDocCountCache();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = Math.round(totalIndexed / parseFloat(duration));
      console.log(`✅ Supplier data indexed: ${totalIndexed.toLocaleString()} docs in ${duration}s (${rate.toLocaleString()}/s)`);

      return {
        indexed: totalIndexed,
        errors: totalErrors,
        duration: parseFloat(duration),
        rate,
      };
    } catch (error) {
      console.error('❌ Error indexing supplier data:', error.message);
      await this.finalizeIndexing();
      return { indexed: 0, errors: records.length, error: error.message };
    }
  }

  /**
   * Delete all documents from a specific table
   */
  async deleteByTable(tableId) {
    if (!this.isAvailable || !tableId) return { deleted: 0 };

    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: { term: { tableId: tableId.toString() } },
        },
        conflicts: 'proceed',
        refresh: false,
        wait_for_completion: true,
        slices: 'auto',
      });

      this.invalidateDocCountCache();
      return { deleted: response.deleted || 0 };
    } catch (error) {
      console.error('Error deleting by table:', error.message);
      return { deleted: 0 };
    }
  }

  /**
   * Delete all documents from a specific supplier
   * Handles both new format (sourceSupplierId) and legacy format (delete by document IDs)
   */
  async deleteBySupplier(supplierId, supplierDocIds = null) {
    if (!this.isAvailable || !supplierId) return { deleted: 0 };

    try {
      const startTime = Date.now();
      let totalDeleted = 0;
      
      // First try: Delete by sourceSupplierId (new format)
      const response1 = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: { term: { sourceSupplierId: supplierId.toString() } },
        },
        conflicts: 'proceed',
        refresh: true,
        wait_for_completion: true,
        slices: 'auto',
        scroll_size: 10000,
      });
      totalDeleted += response1.deleted || 0;
      
      // Second try: If we have document IDs from MongoDB, delete those too (legacy docs)
      if (supplierDocIds && supplierDocIds.length > 0) {
        // Delete in batches of 10000
        const batchSize = 10000;
        for (let i = 0; i < supplierDocIds.length; i += batchSize) {
          const batch = supplierDocIds.slice(i, i + batchSize).map(id => id.toString());
          const response2 = await this.client.deleteByQuery({
            index: this.indexName,
            body: {
              query: { ids: { values: batch } },
            },
            conflicts: 'proceed',
            refresh: true,
            wait_for_completion: true,
          });
          totalDeleted += response2.deleted || 0;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🗑️  ES: Deleted ${totalDeleted.toLocaleString()} supplier docs in ${duration}s`);
      this.invalidateDocCountCache();
      return { deleted: totalDeleted };
    } catch (error) {
      console.error('Error deleting by supplier:', error.message);
      return { deleted: 0 };
    }
  }

  /**
   * Delete all documents from a specific supplier's file
   * Handles both new format (sourceSupplierId+fileName) and legacy format (fileName only)
   */
  async deleteBySupplierFile(supplierId, fileName, supplierDocIds = null) {
    if (!this.isAvailable || !fileName) return { deleted: 0 };

    try {
      const startTime = Date.now();
      let totalDeleted = 0;
      
      // First try: Delete by sourceSupplierId + fileName (new format)
      if (supplierId) {
        const response1 = await this.client.deleteByQuery({
          index: this.indexName,
          body: {
            query: {
              bool: {
                must: [
                  { term: { sourceSupplierId: supplierId.toString() } },
                  { term: { fileName: fileName } }
                ]
              }
            },
          },
          conflicts: 'proceed',
          refresh: true,
          wait_for_completion: true,
          slices: 'auto',
        });
        totalDeleted += response1.deleted || 0;
      }
      
      // Second try: If we have document IDs, delete by IDs (most reliable for legacy)
      if (supplierDocIds && supplierDocIds.length > 0) {
        const batchSize = 10000;
        for (let i = 0; i < supplierDocIds.length; i += batchSize) {
          const batch = supplierDocIds.slice(i, i + batchSize).map(id => id.toString());
          const response2 = await this.client.deleteByQuery({
            index: this.indexName,
            body: {
              query: { ids: { values: batch } },
            },
            conflicts: 'proceed',
            refresh: true,
            wait_for_completion: true,
          });
          totalDeleted += response2.deleted || 0;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🗑️  ES: Deleted ${totalDeleted.toLocaleString()} docs for file "${fileName}" in ${duration}s`);
      this.invalidateDocCountCache();
      return { deleted: totalDeleted };
    } catch (error) {
      console.error('Error deleting by supplier file:', error.message);
      return { deleted: 0 };
    }
  }

  /**
   * Delete a single document by ID
   */
  async deleteDocument(docId) {
    if (!this.isAvailable || !docId) return false;

    try {
      await this.client.delete({
        index: this.indexName,
        id: docId.toString(),
        refresh: true
      });
      return true;
    } catch (error) {
      // Ignore 404 errors (doc already deleted)
      if (error.meta?.statusCode !== 404) {
        console.error('Error deleting document:', error.message);
      }
      return false;
    }
  }

  /**
   * Get stats for a specific supplier
   */
  async getSupplierStats(supplierId) {
    if (!this.isAvailable || !supplierId) return null;

    try {
      const [countResponse, tablesResponse] = await Promise.all([
        this.client.count({
          index: this.indexName,
          body: { query: { term: { supplierId: supplierId.toString() } } }
        }),
        this.client.search({
          index: this.indexName,
          body: {
            size: 0,
            query: { term: { supplierId: supplierId.toString() } },
            aggs: {
              tables: { terms: { field: 'tableId', size: 100 } },
              brands: { terms: { field: 'brand', size: 50 } },
              latestImport: { max: { field: 'importedAt' } },
            }
          }
        })
      ]);

      return {
        totalRecords: countResponse.count,
        tables: tablesResponse.aggregations?.tables?.buckets?.length || 0,
        brands: tablesResponse.aggregations?.brands?.buckets?.map(b => b.key) || [],
        lastImport: tablesResponse.aggregations?.latestImport?.value_as_string,
      };
    } catch (error) {
      console.error('Error getting supplier stats:', error.message);
      return null;
    }
  }

  /**
   * Search parts from a specific supplier only
   */
  async searchSupplierParts(supplierId, query, filters = {}) {
    if (!this.isAvailable) {
      throw new Error('Elasticsearch is not available');
    }

    const limit = filters.limit || 50;
    const skip = filters.skip || 0;

    try {
      const must = [
        { term: { supplierId: supplierId.toString() } }
      ];

      if (query && query.trim()) {
        must.push({
          bool: {
            should: [
              { term: { partNumber: { value: query.trim().toUpperCase(), boost: 10 } } },
              { prefix: { partNumber: { value: query.trim().toUpperCase(), boost: 5 } } },
              { match: { 'partNumber.autocomplete': { query: query.trim(), boost: 3 } } },
              { match: { description: { query: query.trim(), boost: 2 } } },
              { match: { 'vendorCode.text': { query: query.trim(), boost: 2 } } },
              { match: { 'brand.text': { query: query.trim(), boost: 1 } } },
            ],
            minimum_should_match: 1,
          }
        });
      }

      const filter = [];
      if (filters.tableId) {
        filter.push({ term: { tableId: filters.tableId.toString() } });
      }
      if (filters.brand) {
        filter.push({ term: { brand: filters.brand } });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          from: skip,
          size: limit,
          query: {
            bool: {
              must,
              filter: filter.length > 0 ? filter : undefined,
            }
          },
          sort: [
            { _score: 'desc' },
            { importedAt: 'desc' }
          ],
        }
      });

      return {
        hits: response.hits.hits.map(hit => ({
          _id: hit._id,
          _score: hit._score,
          ...hit._source,
        })),
        total: response.hits.total?.value || response.hits.total || 0,
      };
    } catch (error) {
      console.error('Error searching supplier parts:', error.message);
      throw error;
    }
  }

  /**
   * Re-index all records from a specific supplier table
   * Useful for re-indexing after ES mapping updates
   */
  async reindexSupplierTable(tableId, DataTable, DataRecord, Supplier) {
    if (!this.isAvailable) {
      return { success: false, message: 'Elasticsearch not available' };
    }

    try {
      const table = await DataTable.findById(tableId).populate('supplier');
      if (!table) {
        return { success: false, message: 'Table not found' };
      }

      const supplier = table.supplier;
      const records = await DataRecord.find({ table: tableId, status: 'active' }).lean();

      if (records.length === 0) {
        return { success: true, indexed: 0, message: 'No records to index' };
      }

      // Build ES records
      const esRecords = records.map(record => ({
        _id: record._id.toString(),
        data: record.data,
      }));

      // Build column mapping from table columns
      const columnMapping = {};
      for (const col of table.columns) {
        columnMapping[col.key] = col.key;
      }

      const result = await this.indexSupplierData({
        tableId: table._id.toString(),
        tableName: table.name,
        supplierId: supplier._id.toString(),
        supplierName: supplier.name || supplier.username,
        supplierCode: supplier.code || supplier.username,
        records: esRecords,
        columnMapping,
        fileName: table.description || table.name,
        replaceExisting: true,
      });

      return {
        success: true,
        ...result,
        tableName: table.name,
        supplierName: supplier.name || supplier.username,
      };
    } catch (error) {
      console.error('Error reindexing supplier table:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Re-index all supplier data from all tables
   * Call this after ES mapping updates to ensure all data is properly indexed
   */
  async reindexAllSupplierData(DataTable, DataRecord, Supplier) {
    if (!this.isAvailable) {
      return { success: false, message: 'Elasticsearch not available' };
    }

    const startTime = Date.now();
    console.log('🔄 Starting full re-index of all supplier data...');

    try {
      // Get all active tables
      const tables = await DataTable.find({ status: 'active' }).populate('supplier').lean();
      console.log(`📊 Found ${tables.length} tables to re-index`);

      let totalIndexed = 0;
      let totalErrors = 0;
      const results = [];

      for (const table of tables) {
        try {
          const records = await DataRecord.find({ table: table._id, status: 'active' }).lean();
          
          if (records.length === 0) {
            results.push({ table: table.name, indexed: 0, skipped: true });
            continue;
          }

          const esRecords = records.map(record => ({
            _id: record._id.toString(),
            data: record.data,
          }));

          const columnMapping = {};
          for (const col of table.columns) {
            columnMapping[col.key] = col.key;
          }

          const supplier = table.supplier || {};
          const result = await this.indexSupplierData({
            tableId: table._id.toString(),
            tableName: table.name,
            supplierId: supplier._id?.toString() || table.supplier?.toString(),
            supplierName: supplier.name || supplier.username || 'Unknown',
            supplierCode: supplier.code || supplier.username || 'unknown',
            records: esRecords,
            columnMapping,
            fileName: table.description || table.name,
            replaceExisting: true,
          });

          totalIndexed += result.indexed || 0;
          totalErrors += result.errors || 0;
          results.push({
            table: table.name,
            supplier: supplier.name || supplier.username,
            indexed: result.indexed,
            errors: result.errors,
          });
        } catch (tableError) {
          console.error(`Error indexing table ${table.name}:`, tableError.message);
          results.push({ table: table.name, error: tableError.message });
          totalErrors++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Full re-index complete: ${totalIndexed.toLocaleString()} docs in ${duration}s`);

      return {
        success: true,
        tablesProcessed: tables.length,
        totalIndexed,
        totalErrors,
        duration: parseFloat(duration),
        results,
      };
    } catch (error) {
      console.error('Error in full re-index:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get diagnostic info for supplier data indexing
   */
  async getSupplierDataDiagnostics() {
    if (!this.isAvailable) {
      return { available: false, message: 'Elasticsearch not available' };
    }

    try {
      const [totalCount, supplierDataCount, aggregations] = await Promise.all([
        this.client.count({ index: this.indexName }),
        this.client.count({
          index: this.indexName,
          body: { query: { exists: { field: 'supplierId' } } }
        }),
        this.client.search({
          index: this.indexName,
          body: {
            size: 0,
            aggs: {
              suppliers: { terms: { field: 'supplierId', size: 100 } },
              tables: { terms: { field: 'tableId', size: 100 } },
              dataSources: { terms: { field: 'dataSource', size: 10 } },
            }
          }
        })
      ]);

      return {
        available: true,
        totalDocuments: totalCount.count,
        supplierDataCount: supplierDataCount.count,
        integrationDataCount: totalCount.count - supplierDataCount.count,
        uniqueSuppliers: aggregations.aggregations?.suppliers?.buckets?.length || 0,
        uniqueTables: aggregations.aggregations?.tables?.buckets?.length || 0,
        dataSources: aggregations.aggregations?.dataSources?.buckets?.map(b => ({
          source: b.key,
          count: b.doc_count,
        })) || [],
      };
    } catch (error) {
      return { available: true, error: error.message };
    }
  }
}

// Export singleton instance
const elasticsearchService = new ElasticsearchService();
module.exports = elasticsearchService;

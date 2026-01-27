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
                stock: { type: 'keyword' },
                origin: { type: 'keyword' },
                weight: { type: 'float' },
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
   * Autocomplete suggestions
   */
  async autocomplete(query, limit = 10) {
    if (!this.isAvailable || !query || !query.trim()) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              should: [
                { prefix: { partNumber: { value: query.trim().toUpperCase(), boost: 10 } } },
                { match: { 'partNumber.autocomplete': { query: query.trim(), boost: 5 } } },
                { match_phrase_prefix: { description: { query: query.trim(), boost: 2 } } },
              ],
              minimum_should_match: 1,
            },
          },
          size: limit,
          _source: ['partNumber', 'description', 'brand', 'supplier'],
        },
      });

      return response.hits.hits.map((hit) => ({
        partNumber: hit._source.partNumber,
        description: hit._source.description,
        brand: hit._source.brand,
        supplier: hit._source.supplier,
      }));
    } catch (error) {
      console.error('Autocomplete error:', error.message);
      return [];
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
   * Bulk index documents
   */
  async bulkIndex(documents) {
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
          stock: doc.stock,
          origin: doc.origin,
          weight: doc.weight,
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
      console.error('Bulk index error:', error.message);
      throw error;
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

/**
 * API Service
 * Professional API integration service for external data sources
 * Supports REST APIs, GraphQL, multiple authentication methods,
 * rate limiting, pagination, retry logic, and data transformation
 */

const EventEmitter = require('events');

class APIService extends EventEmitter {
  constructor() {
    super();
    this.rateLimiters = new Map(); // Track rate limits per integration
    this.requestQueues = new Map(); // Queue requests for rate limiting
    this.activeRequests = new Map(); // Track active requests
    this.retryDefaults = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
    };
  }

  /**
   * Test API connection with comprehensive validation
   * @param {Object} config - API configuration
   * @returns {Promise<Object>} Test result
   */
  async testConnection(config) {
    try {
      const { baseUrl, authType, apiKey, headers, username, password, testEndpoint } = config;

      if (!baseUrl) {
        return { success: false, error: 'Base URL is required' };
      }

      // Validate URL format
      let parsedUrl;
      try {
        parsedUrl = new URL(baseUrl);
      } catch (e) {
        return { success: false, error: 'Invalid URL format' };
      }

      // Build request headers
      const requestHeaders = this._buildHeaders(config);
      
      // Determine test endpoint
      const testUrl = testEndpoint ? new URL(testEndpoint, baseUrl).toString() : baseUrl;

      console.log(`🔌 Testing API connection to: ${testUrl}`);

      // Attempt connection with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Check response
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let responseData = null;
          let recordCount = 0;

          // Try to parse response to get record count
          if (contentType.includes('application/json')) {
            try {
              responseData = await response.json();
              recordCount = this._estimateRecordCount(responseData);
            } catch (e) {
              // JSON parse failed, but connection worked
            }
          }

          return {
            success: true,
            message: 'Connection successful',
            status: response.status,
            contentType,
            estimatedRecords: recordCount,
            headers: Object.fromEntries(response.headers.entries()),
          };
        } else {
          // Get error details
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch (e) {
            errorBody = 'Unable to read error response';
          }

          return {
            success: false,
            error: `API returned ${response.status}: ${response.statusText}`,
            status: response.status,
            statusText: response.statusText,
            details: errorBody.substring(0, 500), // Limit error body length
          };
        }
      } catch (fetchError) {
        clearTimeout(timeout);
        
        if (fetchError.name === 'AbortError') {
          return { success: false, error: 'Connection timed out (15 seconds)' };
        }
        
        return {
          success: false,
          error: `Connection failed: ${fetchError.message}`,
          details: fetchError.cause?.message || null,
        };
      }
    } catch (error) {
      console.error('API test error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch data from API with full feature support
   * @param {Object} integration - Integration configuration
   * @param {Object} options - Fetch options with callbacks
   * @returns {Promise<Object>} Fetched data result
   */
  async fetchData(integration, options = {}) {
    const { onProgress, onError } = options;
    const startTime = Date.now();
    
    const config = integration.api || {};
    const endpoints = config.endpoints || [{ path: '/', method: 'GET' }];
    
    const results = {
      success: true,
      totalRecords: 0,
      records: [],
      errors: [],
      endpoints: [],
      duration: 0,
    };

    try {
      // Process each endpoint
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        
        if (onProgress) {
          onProgress({
            phase: 'fetching',
            currentEndpoint: endpoint.path,
            endpointIndex: i + 1,
            totalEndpoints: endpoints.length,
            message: `Fetching from ${endpoint.path}...`,
          });
        }

        try {
          const endpointResult = await this._fetchEndpoint(integration, endpoint, options);
          
          results.records.push(...endpointResult.records);
          results.totalRecords += endpointResult.records.length;
          results.endpoints.push({
            path: endpoint.path,
            status: 'success',
            recordCount: endpointResult.records.length,
            pages: endpointResult.pages || 1,
          });

          if (onProgress) {
            onProgress({
              phase: 'fetching',
              recordsFetched: results.totalRecords,
              message: `Fetched ${endpointResult.records.length} records from ${endpoint.path}`,
            });
          }
        } catch (endpointError) {
          console.error(`Error fetching endpoint ${endpoint.path}:`, endpointError);
          
          results.errors.push({
            endpoint: endpoint.path,
            error: endpointError.message,
          });
          
          results.endpoints.push({
            path: endpoint.path,
            status: 'failed',
            error: endpointError.message,
          });

          if (onError) {
            onError({
              endpoint: endpoint.path,
              error: endpointError.message,
            });
          }
        }
      }

      results.duration = Date.now() - startTime;
      results.success = results.errors.length === 0;

      return results;
    } catch (error) {
      console.error('API fetch error:', error);
      return {
        success: false,
        error: error.message,
        totalRecords: 0,
        records: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch single endpoint with pagination support
   * @private
   */
  async _fetchEndpoint(integration, endpoint, options = {}) {
    const config = integration.api || {};
    const pagination = config.pagination || {};
    const baseUrl = config.baseUrl;
    
    const allRecords = [];
    let page = 1;
    let hasMore = true;
    let pages = 0;

    // Build full URL
    const buildUrl = (pageNum, cursor) => {
      const url = new URL(endpoint.path, baseUrl);
      
      // Add pagination parameters
      if (pagination.paginationType === 'page') {
        url.searchParams.set(pagination.pageParam || 'page', pageNum);
        if (pagination.limitParam) {
          url.searchParams.set(pagination.limitParam, pagination.pageSize || 100);
        }
      } else if (pagination.paginationType === 'offset') {
        const offset = (pageNum - 1) * (pagination.pageSize || 100);
        url.searchParams.set(pagination.offsetParam || 'offset', offset);
        url.searchParams.set(pagination.limitParam || 'limit', pagination.pageSize || 100);
      } else if (pagination.paginationType === 'cursor' && cursor) {
        url.searchParams.set(pagination.cursorParam || 'cursor', cursor);
      }

      // Add any additional query parameters from endpoint config
      if (endpoint.queryParams) {
        Object.entries(endpoint.queryParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      return url.toString();
    };

    let cursor = null;

    while (hasMore) {
      // Apply rate limiting
      await this._applyRateLimit(integration._id?.toString() || 'default', config.rateLimit || 60);

      const url = buildUrl(page, cursor);
      console.log(`📡 API Request: ${url}`);

      try {
        const response = await this._makeRequest(integration, url, endpoint.method || 'GET', endpoint.body);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        pages++;

        // Extract records from response
        const records = this._extractRecords(data, config.dataPath || endpoint.dataPath);
        
        if (records.length === 0) {
          hasMore = false;
        } else {
          // Transform records if mapping is defined
          const transformedRecords = this._transformRecords(records, config.fieldMapping || endpoint.fieldMapping);
          allRecords.push(...transformedRecords);

          // Check for more pages
          if (pagination.paginationType === 'cursor') {
            cursor = this._extractCursor(data, pagination.cursorPath);
            hasMore = !!cursor;
          } else if (pagination.paginationType === 'page' || pagination.paginationType === 'offset') {
            // Check if we have more pages
            const totalRecords = this._extractValue(data, pagination.totalPath);
            const pageSize = pagination.pageSize || 100;
            
            if (totalRecords !== undefined) {
              hasMore = allRecords.length < totalRecords;
            } else {
              // No total, check if we got a full page
              hasMore = records.length >= pageSize;
            }
            page++;
          } else {
            // No pagination, single request
            hasMore = false;
          }
        }

        // Safety limit
        if (pages >= (pagination.maxPages || 100)) {
          console.log(`⚠️ Reached max pages limit (${pagination.maxPages || 100})`);
          hasMore = false;
        }
      } catch (error) {
        // Retry logic
        const retried = await this._retryRequest(integration, url, endpoint.method || 'GET', endpoint.body);
        if (retried.success) {
          const data = retried.data;
          const records = this._extractRecords(data, config.dataPath || endpoint.dataPath);
          const transformedRecords = this._transformRecords(records, config.fieldMapping || endpoint.fieldMapping);
          allRecords.push(...transformedRecords);
        }
        hasMore = false; // Stop pagination on error
      }
    }

    return { records: allRecords, pages };
  }

  /**
   * Make HTTP request with proper headers and authentication
   * @private
   */
  async _makeRequest(integration, url, method = 'GET', body = null) {
    const config = integration.api || {};
    const headers = this._buildHeaders(config);

    const requestOptions = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    // Add timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout || 30000);
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Build request headers based on authentication config
   * @private
   */
  _buildHeaders(config) {
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'PARTSFORM/1.0',
    };

    // Add custom headers
    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    // Add authentication
    switch (config.authType) {
      case 'api-key':
      case 'apikey':
        const headerName = config.authHeader || 'X-API-Key';
        headers[headerName] = config.apiKey;
        break;
        
      case 'bearer':
        headers['Authorization'] = `Bearer ${config.apiKey || config.token}`;
        break;
        
      case 'basic':
        const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
        
      case 'oauth2':
        if (config.accessToken) {
          headers['Authorization'] = `Bearer ${config.accessToken}`;
        }
        break;
        
      case 'none':
      default:
        // No authentication
        break;
    }

    return headers;
  }

  /**
   * Extract records from API response using data path
   * @private
   */
  _extractRecords(data, dataPath) {
    if (!dataPath) {
      // Auto-detect: if data is array, use it; otherwise check common paths
      if (Array.isArray(data)) {
        return data;
      }
      
      // Check common data paths
      const commonPaths = ['data', 'results', 'items', 'records', 'parts', 'products', 'response', 'content'];
      for (const path of commonPaths) {
        if (Array.isArray(data[path])) {
          return data[path];
        }
      }
      
      // If nothing found, return empty or wrap single object
      return typeof data === 'object' ? [data] : [];
    }

    // Navigate to specified path
    return this._extractValue(data, dataPath) || [];
  }

  /**
   * Extract value from nested object using dot notation path
   * @private
   */
  _extractValue(data, path) {
    if (!path) return data;
    
    const parts = path.split('.');
    let current = data;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      
      // Handle array index
      const match = part.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        current = current[match[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(match[2])];
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Extract cursor for pagination
   * @private
   */
  _extractCursor(data, cursorPath) {
    if (!cursorPath) {
      // Check common cursor locations
      const commonCursorPaths = [
        'next_cursor', 'nextCursor', 'cursor', 'next',
        'pagination.next', 'meta.next_cursor', 'paging.next'
      ];
      
      for (const path of commonCursorPaths) {
        const cursor = this._extractValue(data, path);
        if (cursor) return cursor;
      }
      
      return null;
    }
    
    return this._extractValue(data, cursorPath);
  }

  /**
   * Transform records using field mapping
   * @private
   */
  _transformRecords(records, fieldMapping) {
    if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
      return records;
    }

    return records.map(record => {
      const transformed = {};

      // Apply field mapping
      for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
        if (typeof sourceField === 'string') {
          transformed[targetField] = this._extractValue(record, sourceField);
        } else if (typeof sourceField === 'object') {
          // Complex mapping with transformation
          let value = this._extractValue(record, sourceField.field);
          
          // Apply transformations
          if (sourceField.transform) {
            value = this._applyTransform(value, sourceField.transform);
          }
          
          // Apply default
          if (value === undefined && sourceField.default !== undefined) {
            value = sourceField.default;
          }
          
          transformed[targetField] = value;
        }
      }

      // Include original fields that aren't mapped
      for (const [key, value] of Object.entries(record)) {
        if (!transformed.hasOwnProperty(key)) {
          transformed[key] = value;
        }
      }

      return transformed;
    });
  }

  /**
   * Apply transformation to a value
   * @private
   */
  _applyTransform(value, transform) {
    if (value === null || value === undefined) return value;

    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'number':
        return parseFloat(value) || 0;
      case 'integer':
        return parseInt(value) || 0;
      case 'boolean':
        return Boolean(value);
      case 'string':
        return String(value);
      case 'date':
        return new Date(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }

  /**
   * Apply rate limiting
   * @private
   */
  async _applyRateLimit(integrationId, requestsPerMinute) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    if (!this.rateLimiters.has(integrationId)) {
      this.rateLimiters.set(integrationId, { requests: [], limit: requestsPerMinute });
    }
    
    const limiter = this.rateLimiters.get(integrationId);
    limiter.limit = requestsPerMinute;
    
    // Remove old requests outside the window
    limiter.requests = limiter.requests.filter(time => now - time < windowMs);
    
    // Check if we've hit the limit
    if (limiter.requests.length >= limiter.limit) {
      // Wait until the oldest request expires
      const oldestRequest = limiter.requests[0];
      const waitTime = windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
      
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Clean up again after waiting
      limiter.requests = limiter.requests.filter(time => Date.now() - time < windowMs);
    }
    
    // Record this request
    limiter.requests.push(Date.now());
  }

  /**
   * Retry failed request with exponential backoff
   * @private
   */
  async _retryRequest(integration, url, method, body, attempt = 1) {
    const maxRetries = integration.options?.maxRetries || this.retryDefaults.maxRetries;
    
    if (attempt > maxRetries) {
      return { success: false, error: `Max retries (${maxRetries}) exceeded` };
    }

    const delay = Math.min(
      this.retryDefaults.baseDelay * Math.pow(this.retryDefaults.backoffMultiplier, attempt - 1),
      this.retryDefaults.maxDelay
    );

    console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const response = await this._makeRequest(integration, url, method, body);
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      
      // Retry on certain status codes
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        return this._retryRequest(integration, url, method, body, attempt + 1);
      }
      
      return { success: false, error: `API returned ${response.status}` };
    } catch (error) {
      return this._retryRequest(integration, url, method, body, attempt + 1);
    }
  }

  /**
   * Estimate record count from response data
   * @private
   */
  _estimateRecordCount(data) {
    if (Array.isArray(data)) {
      return data.length;
    }
    
    // Check common paths
    const commonPaths = ['data', 'results', 'items', 'records', 'parts', 'products'];
    for (const path of commonPaths) {
      if (Array.isArray(data[path])) {
        return data[path].length;
      }
    }
    
    // Check for total count in metadata
    const countPaths = ['total', 'totalCount', 'total_count', 'count', 'meta.total', 'pagination.total'];
    for (const path of countPaths) {
      const count = this._extractValue(data, path);
      if (typeof count === 'number') {
        return count;
      }
    }
    
    return 0;
  }

  /**
   * Parse and validate parts data from API response
   * @param {Array} records - Raw records from API
   * @param {Object} mapping - Column/field mapping
   * @returns {Object} Parsed data with valid and invalid records
   */
  parsePartsData(records, mapping = {}) {
    const validRecords = [];
    const invalidRecords = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Extract part number (required)
        const partNumber = this._extractMappedValue(record, mapping, 'partNumber', ['part_number', 'partNumber', 'PartNumber', 'PART_NUMBER', 'pn', 'PN', 'SKU', 'sku', 'id', 'ID']);
        
        if (!partNumber) {
          invalidRecords.push({ index: i, record, reason: 'Missing part number' });
          continue;
        }

        // Extract other fields with fallbacks
        const parsedPart = {
          partNumber: String(partNumber).trim(),
          description: this._extractMappedValue(record, mapping, 'description', ['description', 'Description', 'DESCRIPTION', 'desc', 'name', 'Name', 'title', 'Title']) || '',
          supplier: this._extractMappedValue(record, mapping, 'supplier', ['supplier', 'Supplier', 'SUPPLIER', 'vendor', 'Vendor', 'manufacturer', 'Manufacturer']) || 'Unknown',
          price: this._parseNumber(this._extractMappedValue(record, mapping, 'price', ['price', 'Price', 'PRICE', 'cost', 'Cost', 'unitPrice', 'unit_price'])),
          quantity: this._parseNumber(this._extractMappedValue(record, mapping, 'quantity', ['quantity', 'Quantity', 'QUANTITY', 'qty', 'Qty', 'QTY', 'stock', 'Stock', 'inventory'])),
          condition: this._extractMappedValue(record, mapping, 'condition', ['condition', 'Condition', 'CONDITION', 'cond', 'status']) || 'New',
          brand: this._extractMappedValue(record, mapping, 'brand', ['brand', 'Brand', 'BRAND', 'manufacturer', 'Manufacturer', 'make', 'Make']) || '',
          leadTime: this._extractMappedValue(record, mapping, 'leadTime', ['leadTime', 'lead_time', 'LeadTime', 'LEAD_TIME', 'delivery', 'Delivery']) || '',
          uom: this._extractMappedValue(record, mapping, 'uom', ['uom', 'UOM', 'unit', 'Unit', 'UNIT', 'unitOfMeasure']) || 'EA',
          category: this._extractMappedValue(record, mapping, 'category', ['category', 'Category', 'CATEGORY', 'type', 'Type', 'class', 'Class']) || '',
          subcategory: this._extractMappedValue(record, mapping, 'subcategory', ['subcategory', 'Subcategory', 'SUBCATEGORY', 'subtype', 'SubType']) || '',
          
          // Store original data for reference
          _original: record,
        };

        validRecords.push(parsedPart);
      } catch (error) {
        invalidRecords.push({ index: i, record, reason: error.message });
        errors.push({ index: i, error: error.message });
      }
    }

    return {
      validRecords,
      invalidRecords,
      errors,
      stats: {
        total: records.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
      },
    };
  }

  /**
   * Extract value using mapping or fallback field names
   * @private
   */
  _extractMappedValue(record, mapping, targetField, fallbackFields) {
    // Check if mapping specifies a source field
    if (mapping && mapping[targetField]) {
      const value = this._extractValue(record, mapping[targetField]);
      if (value !== undefined && value !== null) return value;
    }

    // Try fallback field names
    for (const field of fallbackFields) {
      const value = this._extractValue(record, field);
      if (value !== undefined && value !== null) return value;
    }

    return null;
  }

  /**
   * Parse number from various formats
   * @private
   */
  _parseNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    
    // Remove currency symbols, commas, and trim
    const cleaned = String(value).replace(/[$€£¥,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * GraphQL query execution
   * @param {Object} integration - Integration config
   * @param {string} query - GraphQL query
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Query result
   */
  async executeGraphQL(integration, query, variables = {}) {
    const config = integration.api || {};
    const url = config.graphqlEndpoint || config.baseUrl;
    
    const headers = this._buildHeaders(config);
    headers['Content-Type'] = 'application/json';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          errors: result.errors,
          data: result.data,
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear rate limiter for an integration
   */
  clearRateLimiter(integrationId) {
    this.rateLimiters.delete(integrationId);
  }
}

// Export singleton instance
module.exports = new APIService();

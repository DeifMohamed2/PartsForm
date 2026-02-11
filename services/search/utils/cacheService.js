/**
 * Cache Service - Multi-tier Caching Strategy
 * 
 * L1: In-process LRU cache (fastest, limited size)
 * L2: Redis distributed cache (fast, shared across instances)
 * L3: Elasticsearch request cache (handled by ES)
 */

const crypto = require('crypto');

// Simple LRU Cache implementation
class LRUCache {
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access order (move to end)
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }
    
    return entry.value;
  }

  set(key, value) {
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.cache.delete(oldest);
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
    this.accessOrder.push(key);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) this.accessOrder.splice(idx, 1);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }
}

class CacheService {
  constructor() {
    // L1: In-process caches with different TTLs
    this.intentCache = new LRUCache(200, 10 * 60 * 1000);     // 10 min TTL
    this.partResultCache = new LRUCache(500, 5 * 60 * 1000);   // 5 min TTL
    this.searchResultCache = new LRUCache(100, 2 * 60 * 1000); // 2 min TTL
    
    // L2: Redis client (optional, initialized separately)
    this.redis = null;
    this.redisEnabled = false;
    
    // Metrics
    this.metrics = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      sets: 0,
    };
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis(redisUrl = null) {
    try {
      const Redis = require('ioredis');
      const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      
      await this.redis.connect();
      this.redisEnabled = true;
      console.log('✅ Redis cache connected');
      
      // Handle reconnection
      this.redis.on('error', (err) => {
        console.warn('⚠️ Redis error:', err.message);
      });
      
      this.redis.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });
      
      return true;
    } catch (err) {
      console.warn('⚠️ Redis not available, using L1 cache only:', err.message);
      this.redisEnabled = false;
      return false;
    }
  }

  /**
   * Check if Redis is connected (and try to connect if not)
   */
  async checkConnection() {
    // Already connected
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.ping();
        return true;
      } catch {
        this.redisEnabled = false;
      }
    }
    
    // Try to connect
    return await this.initializeRedis();
  }

  /**
   * Hash a string for cache key
   */
  hash(str) {
    return crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
  }

  /**
   * Cache parsed intent
   */
  async cacheIntent(query, intent) {
    const key = `intent:${this.hash(query.toLowerCase().trim())}`;
    
    // Always set L1
    this.intentCache.set(key, intent);
    this.metrics.sets++;
    
    // Set L2 if available
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.setex(key, 600, JSON.stringify(intent)); // 10 min TTL
      } catch (err) {
        console.warn('Redis set error:', err.message);
      }
    }
  }

  /**
   * Get cached intent
   */
  async getIntent(query) {
    const key = `intent:${this.hash(query.toLowerCase().trim())}`;
    
    // Check L1 first
    const l1Result = this.intentCache.get(key);
    if (l1Result) {
      this.metrics.l1Hits++;
      return l1Result;
    }
    this.metrics.l1Misses++;
    
    // Check L2 if available
    if (this.redisEnabled && this.redis) {
      try {
        const l2Result = await this.redis.get(key);
        if (l2Result) {
          this.metrics.l2Hits++;
          const parsed = JSON.parse(l2Result);
          // Promote to L1
          this.intentCache.set(key, parsed);
          return parsed;
        }
        this.metrics.l2Misses++;
      } catch (err) {
        console.warn('Redis get error:', err.message);
      }
    }
    
    return null;
  }

  /**
   * Cache part number search results
   */
  async cachePartResults(partNumber, results) {
    const key = `parts:${partNumber.toUpperCase().trim()}`;
    
    // L1
    this.partResultCache.set(key, results);
    this.metrics.sets++;
    
    // L2
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.setex(key, 300, JSON.stringify(results)); // 5 min TTL
      } catch (err) {
        console.warn('Redis set error:', err.message);
      }
    }
  }

  /**
   * Get cached part results
   */
  async getPartResults(partNumber) {
    const key = `parts:${partNumber.toUpperCase().trim()}`;
    
    // Check L1
    const l1Result = this.partResultCache.get(key);
    if (l1Result) {
      this.metrics.l1Hits++;
      return l1Result;
    }
    this.metrics.l1Misses++;
    
    // Check L2
    if (this.redisEnabled && this.redis) {
      try {
        const l2Result = await this.redis.get(key);
        if (l2Result) {
          this.metrics.l2Hits++;
          const parsed = JSON.parse(l2Result);
          this.partResultCache.set(key, parsed);
          return parsed;
        }
        this.metrics.l2Misses++;
      } catch (err) {
        console.warn('Redis get error:', err.message);
      }
    }
    
    return null;
  }

  /**
   * Build smart cache key for search results
   */
  buildSearchCacheKey(intent) {
    const normalized = {
      terms: (intent.searchTerms || []).sort().join(','),
      pn: (intent.partNumbers || []).sort().join(','),
      maxPrice: intent.constraints?.maxPrice || null,
      minPrice: intent.constraints?.minPrice || null,
      inStock: intent.constraints?.requireInStock || false,
      brands: (intent.constraints?.brands || []).sort().join(','),
      sortPriority: intent.preferences?.sortPriority || 'balanced',
    };
    return `search:${this.hash(JSON.stringify(normalized))}`;
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(intent, results) {
    const key = this.buildSearchCacheKey(intent);
    
    // Limit what we cache (top 100 results only)
    const toCache = {
      results: results.slice(0, 100),
      total: results.length,
      cachedAt: Date.now(),
    };
    
    this.searchResultCache.set(key, toCache);
    this.metrics.sets++;
    
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.setex(key, 120, JSON.stringify(toCache)); // 2 min TTL
      } catch (err) {
        console.warn('Redis set error:', err.message);
      }
    }
  }

  /**
   * Get cached search results
   */
  async getSearchResults(intent) {
    const key = this.buildSearchCacheKey(intent);
    
    const l1Result = this.searchResultCache.get(key);
    if (l1Result) {
      this.metrics.l1Hits++;
      return l1Result;
    }
    this.metrics.l1Misses++;
    
    if (this.redisEnabled && this.redis) {
      try {
        const l2Result = await this.redis.get(key);
        if (l2Result) {
          this.metrics.l2Hits++;
          const parsed = JSON.parse(l2Result);
          this.searchResultCache.set(key, parsed);
          return parsed;
        }
        this.metrics.l2Misses++;
      } catch (err) {
        console.warn('Redis get error:', err.message);
      }
    }
    
    return null;
  }

  /**
   * Invalidate caches for a part number
   */
  async invalidatePartCache(partNumber) {
    const key = `parts:${partNumber.toUpperCase().trim()}`;
    this.partResultCache.delete(key);
    
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn('Redis del error:', err.message);
      }
    }
  }

  /**
   * Clear all caches
   */
  async clearAll() {
    this.intentCache.clear();
    this.partResultCache.clear();
    this.searchResultCache.clear();
    
    if (this.redisEnabled && this.redis) {
      try {
        await this.redis.flushdb();
      } catch (err) {
        console.warn('Redis flush error:', err.message);
      }
    }
    
    console.log('🗑️ All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const l1Total = this.metrics.l1Hits + this.metrics.l1Misses;
    const l2Total = this.metrics.l2Hits + this.metrics.l2Misses;
    
    return {
      l1: {
        hits: this.metrics.l1Hits,
        misses: this.metrics.l1Misses,
        hitRate: l1Total > 0 ? (this.metrics.l1Hits / l1Total * 100).toFixed(1) + '%' : 'N/A',
        size: {
          intent: this.intentCache.size(),
          parts: this.partResultCache.size(),
          search: this.searchResultCache.size(),
        },
      },
      l2: {
        enabled: this.redisEnabled,
        hits: this.metrics.l2Hits,
        misses: this.metrics.l2Misses,
        hitRate: l2Total > 0 ? (this.metrics.l2Hits / l2Total * 100).toFixed(1) + '%' : 'N/A',
      },
      totalSets: this.metrics.sets,
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = {
  CacheService,
  cacheService,
  LRUCache,
};

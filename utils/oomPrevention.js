/**
 * OOM (Out-Of-Memory) Prevention Utilities
 * =========================================
 * 
 * Provides defensive mechanisms to prevent OOM errors:
 * - Circuit Breaker: Fail fast when dependencies are unavailable
 * - Log Throttler: Prevent log spam during outages
 * - Memory Watchdog: Stop work before memory exhaustion
 * - Exponential Backoff: Smart retry with increasing delays
 * 
 * Usage:
 *   const { circuitBreaker, logThrottle, memoryWatchdog, backoff } = require('./utils/oomPrevention');
 */

/**
 * ============================================
 * CIRCUIT BREAKER
 * ============================================
 * Detects service failures and prevents retry storms.
 * Opens circuit after N failures, closes after timeout.
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 60s
    this.halfOpenTimeout = options.halfOpenTimeout || 10000; // 10s
    
    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.successesSinceHalfOpen = 0;
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'half-open';
        this.successesSinceHalfOpen = 0;
        return true;
      }
      return false;
    }
    if (this.state === 'half-open') return true;
    return false;
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === 'half-open') {
      this.successesSinceHalfOpen++;
      // After 3 successes in half-open, close circuit
      if (this.successesSinceHalfOpen >= 3) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
    this.lastSuccess = Date.now();
  }

  /**
   * Record a failed operation
   */
  recordFailure(error = null) {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === 'half-open') {
      // Any failure in half-open immediately opens circuit
      this.state = 'open';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Get current state info
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure ? new Date(this.lastFailure).toISOString() : null,
      lastSuccess: this.lastSuccess ? new Date(this.lastSuccess).toISOString() : null,
      isAvailable: this.isAvailable(),
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = null;
    this.successesSinceHalfOpen = 0;
  }
}

// Global circuit breakers for services
const circuitBreakers = {
  mongodb: new CircuitBreaker({ name: 'mongodb', failureThreshold: 3, resetTimeout: 30000 }),
  elasticsearch: new CircuitBreaker({ name: 'elasticsearch', failureThreshold: 3, resetTimeout: 30000 }),
  ftp: new CircuitBreaker({ name: 'ftp', failureThreshold: 5, resetTimeout: 60000 }),
};


/**
 * ============================================
 * LOG THROTTLER
 * ============================================
 * Prevents log spam by limiting duplicate messages.
 */
class LogThrottler {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute window
    this.maxPerWindow = options.maxPerWindow || 3; // Max 3 logs per message type
    this.messages = new Map();
    this.cleanupInterval = null;
    
    // Auto cleanup every minute
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * Check if a message should be logged
   * @param {string} key - Unique key for this message type
   * @returns {boolean|{shouldLog: boolean, suppressed: number}}
   */
  shouldLog(key) {
    const now = Date.now();
    const record = this.messages.get(key);
    
    if (!record) {
      this.messages.set(key, { count: 1, firstSeen: now, lastSeen: now, suppressed: 0 });
      return { shouldLog: true, suppressed: 0 };
    }
    
    // Check if we're in a new window
    if (now - record.firstSeen > this.windowMs) {
      const suppressed = record.suppressed;
      this.messages.set(key, { count: 1, firstSeen: now, lastSeen: now, suppressed: 0 });
      return { shouldLog: true, suppressed };
    }
    
    // Within window
    record.count++;
    record.lastSeen = now;
    
    if (record.count <= this.maxPerWindow) {
      return { shouldLog: true, suppressed: 0 };
    }
    
    // Suppress
    record.suppressed++;
    
    // Log a summary every 10th suppression
    if (record.suppressed === 10 || record.suppressed % 100 === 0) {
      return { shouldLog: true, isSummary: true, suppressed: record.suppressed };
    }
    
    return { shouldLog: false, suppressed: record.suppressed };
  }

  /**
   * Throttled console.error
   */
  error(key, message) {
    const result = this.shouldLog(key);
    if (result.shouldLog) {
      if (result.isSummary) {
        console.error(`[THROTTLED x${result.suppressed}] ${message}`);
      } else {
        console.error(message);
        if (result.suppressed > 0) {
          console.log(`  (${result.suppressed} similar messages were suppressed)`);
        }
      }
    }
  }

  /**
   * Throttled console.log
   */
  log(key, message) {
    const result = this.shouldLog(key);
    if (result.shouldLog) {
      if (result.isSummary) {
        console.log(`[THROTTLED x${result.suppressed}] ${message}`);
      } else {
        console.log(message);
        if (result.suppressed > 0) {
          console.log(`  (${result.suppressed} similar messages were suppressed)`);
        }
      }
    }
  }

  /**
   * Cleanup old entries
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, record] of this.messages.entries()) {
      if (now - record.lastSeen > this.windowMs * 2) {
        this.messages.delete(key);
      }
    }
  }

  /**
   * Destroy throttler (stop cleanup interval)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.messages.clear();
  }
}

// Global log throttler instance
const logThrottle = new LogThrottler();


/**
 * ============================================
 * MEMORY WATCHDOG
 * ============================================
 * Monitors memory usage and provides alerts/guards.
 */
class MemoryWatchdog {
  constructor(options = {}) {
    // Memory thresholds in MB
    this.warningThresholdMB = options.warningThresholdMB || 1024;  // 1GB
    this.criticalThresholdMB = options.criticalThresholdMB || 1536; // 1.5GB
    this.maxThresholdMB = options.maxThresholdMB || 2048; // 2GB
    
    this.lastWarning = 0;
    this.warningCooldownMs = 60000; // Only warn once per minute
  }

  /**
   * Get current memory usage
   */
  getUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    };
  }

  /**
   * Check if memory is safe for heavy operations
   * @returns {{ safe: boolean, level: string, usage: object }}
   */
  checkMemory() {
    const usage = this.getUsage();
    const rssMB = usage.rss;
    
    let level = 'ok';
    let safe = true;
    
    if (rssMB >= this.maxThresholdMB) {
      level = 'critical';
      safe = false;
    } else if (rssMB >= this.criticalThresholdMB) {
      level = 'high';
      safe = false;
    } else if (rssMB >= this.warningThresholdMB) {
      level = 'warning';
      safe = true; // Still allow operations but warn
    }
    
    return { safe, level, usage };
  }

  /**
   * Guard function - throws if memory is too high
   * @param {string} operationName - Name of operation for error message
   */
  guard(operationName = 'operation') {
    const { safe, level, usage } = this.checkMemory();
    
    if (!safe) {
      throw new Error(
        `Memory threshold exceeded (${level}): ${usage.rss}MB RSS. ` +
        `Cannot start ${operationName}. Please try again later.`
      );
    }
    
    if (level === 'warning' && Date.now() - this.lastWarning > this.warningCooldownMs) {
      console.warn(`⚠️  Memory warning: ${usage.rss}MB RSS - approaching threshold`);
      this.lastWarning = Date.now();
    }
    
    return usage;
  }

  /**
   * Force garbage collection if available
   */
  forceGC() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Get memory status for logging/monitoring
   */
  getStatus() {
    const { safe, level, usage } = this.checkMemory();
    return {
      ...usage,
      level,
      safe,
      thresholds: {
        warning: this.warningThresholdMB,
        critical: this.criticalThresholdMB,
        max: this.maxThresholdMB,
      },
    };
  }
}

// Global memory watchdog
const memoryWatchdog = new MemoryWatchdog();


/**
 * ============================================
 * EXPONENTIAL BACKOFF
 * ============================================
 * Smart retry with exponential delay increases.
 */
class ExponentialBackoff {
  constructor(options = {}) {
    this.baseDelayMs = options.baseDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 30000;
    this.maxRetries = options.maxRetries || 5;
    this.multiplier = options.multiplier || 2;
    this.jitter = options.jitter !== false; // Add random jitter by default
  }

  /**
   * Calculate delay for a given attempt
   * @param {number} attempt - 0-indexed attempt number
   * @returns {number} Delay in milliseconds
   */
  getDelay(attempt) {
    let delay = this.baseDelayMs * Math.pow(this.multiplier, attempt);
    delay = Math.min(delay, this.maxDelayMs);
    
    // Add jitter (±20%)
    if (this.jitter) {
      const jitterFactor = 0.8 + Math.random() * 0.4;
      delay = Math.round(delay * jitterFactor);
    }
    
    return delay;
  }

  /**
   * Execute function with retry
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Options { onRetry, shouldRetry }
   * @returns {Promise<any>}
   */
  async execute(fn, options = {}) {
    const { onRetry, shouldRetry = () => true } = options;
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        if (!shouldRetry(error, attempt)) {
          throw error;
        }
        
        // Check if we have retries left
        if (attempt >= this.maxRetries) {
          break;
        }
        
        const delay = this.getDelay(attempt);
        
        if (onRetry) {
          onRetry(error, attempt + 1, delay);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Create a sleep function for manual backoff
   */
  sleep(attempt) {
    const delay = this.getDelay(attempt);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}


/**
 * ============================================
 * RATE LIMITER
 * ============================================
 * Limits concurrent operations.
 */
class RateLimiter {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 10;
    this.queueSize = options.queueSize || 100;
    this.current = 0;
    this.queue = [];
  }

  /**
   * Acquire a slot
   */
  async acquire() {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return true;
    }
    
    if (this.queue.length >= this.queueSize) {
      throw new Error('Rate limiter queue full');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.queue.indexOf(item);
        if (index > -1) this.queue.splice(index, 1);
        reject(new Error('Rate limiter timeout'));
      }, 30000);
      
      const item = { resolve, reject, timeout };
      this.queue.push(item);
    });
  }

  /**
   * Release a slot
   */
  release() {
    if (this.queue.length > 0) {
      const item = this.queue.shift();
      clearTimeout(item.timeout);
      item.resolve(true);
    } else {
      this.current = Math.max(0, this.current - 1);
    }
  }

  /**
   * Execute function with rate limiting
   */
  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}


/**
 * ============================================
 * MUTEX / JOB LOCK
 * ============================================
 * Prevents parallel execution of the same job.
 */
class JobLock {
  constructor() {
    this.locks = new Map();
  }

  /**
   * Try to acquire lock
   * @param {string} key - Lock key
   * @param {number} ttlMs - Lock TTL in milliseconds
   * @returns {boolean} True if lock acquired
   */
  tryLock(key, ttlMs = 3600000) {
    const existing = this.locks.get(key);
    
    if (existing) {
      // Check if lock expired
      if (Date.now() < existing.expiresAt) {
        return false;
      }
      // Lock expired, remove it
    }
    
    this.locks.set(key, {
      acquiredAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    
    return true;
  }

  /**
   * Release lock
   */
  unlock(key) {
    this.locks.delete(key);
  }

  /**
   * Check if locked
   */
  isLocked(key) {
    const existing = this.locks.get(key);
    if (!existing) return false;
    if (Date.now() >= existing.expiresAt) {
      this.locks.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Execute function with lock
   */
  async withLock(key, fn, ttlMs = 3600000) {
    if (!this.tryLock(key, ttlMs)) {
      throw new Error(`Job ${key} is already running`);
    }
    
    try {
      return await fn();
    } finally {
      this.unlock(key);
    }
  }
}

// Global job lock instance
const jobLock = new JobLock();


/**
 * ============================================
 * HELPER FUNCTIONS
 * ============================================
 */

/**
 * Wrap an async function with OOM protection
 */
function withOOMProtection(fn, options = {}) {
  const {
    serviceName = 'unknown',
    memoryGuard = true,
    circuitBreaker: cb = null,
    lockKey = null,
  } = options;
  
  return async (...args) => {
    // Check memory
    if (memoryGuard) {
      memoryWatchdog.guard(serviceName);
    }
    
    // Check circuit breaker
    if (cb && !cb.isAvailable()) {
      throw new Error(`${serviceName} circuit breaker is open - service unavailable`);
    }
    
    // Check job lock
    if (lockKey && !jobLock.tryLock(lockKey)) {
      throw new Error(`${serviceName} job is already running`);
    }
    
    try {
      const result = await fn(...args);
      if (cb) cb.recordSuccess();
      return result;
    } catch (error) {
      if (cb) cb.recordFailure(error);
      throw error;
    } finally {
      if (lockKey) jobLock.unlock(lockKey);
    }
  };
}

/**
 * Check if error is a connection error (service unavailable)
 */
function isConnectionError(error) {
  if (!error) return false;
  const message = error.message || '';
  return (
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('ENETUNREACH') ||
    message.includes('connection') && message.includes('refused') ||
    message.includes('timeout') ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT'
  );
}


/**
 * ============================================
 * EXPORTS
 * ============================================
 */
module.exports = {
  // Classes
  CircuitBreaker,
  LogThrottler,
  MemoryWatchdog,
  ExponentialBackoff,
  RateLimiter,
  JobLock,
  
  // Global instances
  circuitBreakers,
  logThrottle,
  memoryWatchdog,
  jobLock,
  
  // Helper functions
  withOOMProtection,
  isConnectionError,
};

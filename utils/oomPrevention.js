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
 * MEMORY WATCHDOG (ENHANCED)
 * ============================================
 * Monitors BOTH process and system memory usage.
 * Adaptive thresholds based on total system RAM.
 * Proactive GC and sync pause capabilities.
 */
class MemoryWatchdog {
  constructor(options = {}) {
    // Get total system memory for adaptive thresholds
    const os = require('os');
    const totalSystemMB = Math.round(os.totalmem() / 1024 / 1024);
    this.totalSystemMB = totalSystemMB;
    
    // Adaptive thresholds based on system RAM
    // For 96GB server: warning=60GB, critical=72GB, max=80GB
    // For 16GB server: warning=10GB, critical=12GB, max=14GB
    const systemFactor = Math.max(1, totalSystemMB / 16384); // Scale from 16GB baseline
    
    // Process-level thresholds (for Node.js process)
    this.warningThresholdMB = options.warningThresholdMB || Math.round(1024 * Math.sqrt(systemFactor));
    this.criticalThresholdMB = options.criticalThresholdMB || Math.round(1536 * Math.sqrt(systemFactor));
    this.maxThresholdMB = options.maxThresholdMB || Math.round(2048 * Math.sqrt(systemFactor));
    
    // SYSTEM-level thresholds (% of total RAM available)
    this.systemWarningPercent = options.systemWarningPercent || 30;  // Warn when <30% available
    this.systemCriticalPercent = options.systemCriticalPercent || 15; // Critical when <15% available
    this.systemMaxPercent = options.systemMaxPercent || 8;           // Stop when <8% available
    
    this.lastWarning = 0;
    this.warningCooldownMs = 60000; // Only warn once per minute
    
    // Memory pressure tracking for proactive management
    this.memoryPressureHistory = [];
    this.maxHistorySize = 10;
    this.syncPaused = false;
    this.pauseReason = null;
    
    // Callbacks for memory events
    this.onHighMemory = null;
    this.onCriticalMemory = null;
    this.onMemoryRecovered = null;
    
    console.log(`🧠 MemoryWatchdog initialized: System ${totalSystemMB}MB, thresholds: warning=${this.warningThresholdMB}MB, critical=${this.criticalThresholdMB}MB, max=${this.maxThresholdMB}MB`);
  }

  /**
   * Get current memory usage (both process and system)
   */
  getUsage() {
    const os = require('os');
    const usage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      // Process memory
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      // System memory
      systemTotal: Math.round(totalMem / 1024 / 1024),
      systemFree: Math.round(freeMem / 1024 / 1024),
      systemUsed: Math.round(usedMem / 1024 / 1024),
      systemFreePercent: Math.round((freeMem / totalMem) * 100),
      systemUsedPercent: Math.round((usedMem / totalMem) * 100),
    };
  }

  /**
   * Check if memory is safe for heavy operations
   * Now checks BOTH process AND system memory
   * @returns {{ safe: boolean, level: string, usage: object, reason: string }}
   */
  checkMemory() {
    const usage = this.getUsage();
    const rssMB = usage.rss;
    const systemFreePercent = usage.systemFreePercent;
    
    let level = 'ok';
    let safe = true;
    let reason = 'Memory levels normal';
    
    // Check process memory first
    if (rssMB >= this.maxThresholdMB) {
      level = 'critical';
      safe = false;
      reason = `Process memory critical: ${rssMB}MB RSS (max: ${this.maxThresholdMB}MB)`;
    } else if (rssMB >= this.criticalThresholdMB) {
      level = 'high';
      safe = false;
      reason = `Process memory high: ${rssMB}MB RSS (critical: ${this.criticalThresholdMB}MB)`;
    } else if (rssMB >= this.warningThresholdMB) {
      level = 'warning';
      safe = true; // Still allow operations but warn
      reason = `Process memory warning: ${rssMB}MB RSS`;
    }
    
    // Check SYSTEM memory (more important for OOM killer prevention)
    if (systemFreePercent <= this.systemMaxPercent) {
      level = 'critical';
      safe = false;
      reason = `SYSTEM memory critical: only ${systemFreePercent}% free (${usage.systemFree}MB of ${usage.systemTotal}MB)`;
    } else if (systemFreePercent <= this.systemCriticalPercent && level !== 'critical') {
      level = 'high';
      safe = false;
      reason = `SYSTEM memory high: only ${systemFreePercent}% free (${usage.systemFree}MB)`;
    } else if (systemFreePercent <= this.systemWarningPercent && level === 'ok') {
      level = 'warning';
      reason = `SYSTEM memory warning: ${systemFreePercent}% free`;
    }
    
    // Track memory pressure history
    this.memoryPressureHistory.push({ level, timestamp: Date.now(), usage });
    if (this.memoryPressureHistory.length > this.maxHistorySize) {
      this.memoryPressureHistory.shift();
    }
    
    // Trigger callbacks if registered
    if (!safe && level === 'critical' && this.onCriticalMemory) {
      this.onCriticalMemory({ level, usage, reason });
    } else if (!safe && this.onHighMemory) {
      this.onHighMemory({ level, usage, reason });
    } else if (safe && this.syncPaused && this.onMemoryRecovered) {
      this.onMemoryRecovered({ level, usage });
    }
    
    return { safe, level, usage, reason };
  }

  /**
   * Guard function - throws if memory is too high
   * @param {string} operationName - Name of operation for error message
   * @param {Object} options - Options { force: boolean, attemptGC: boolean }
   */
  guard(operationName = 'operation', options = {}) {
    const { force = false, attemptGC = true } = options;
    
    let { safe, level, usage, reason } = this.checkMemory();
    
    // If not safe and GC is available, try forcing GC first
    if (!safe && attemptGC && global.gc) {
      console.log(`⚠️  Memory ${level} - attempting garbage collection...`);
      global.gc();
      // Re-check after GC
      const recheck = this.checkMemory();
      safe = recheck.safe;
      level = recheck.level;
      usage = recheck.usage;
      reason = recheck.reason;
      
      if (safe) {
        console.log(`✅ Memory recovered after GC: ${usage.rss}MB RSS, ${usage.systemFreePercent}% system free`);
      }
    }
    
    if (!safe && !force) {
      this.syncPaused = true;
      this.pauseReason = reason;
      throw new Error(
        `Memory threshold exceeded (${level}): ${reason}. ` +
        `Cannot start ${operationName}. Please try again later.`
      );
    }
    
    if (level === 'warning' && Date.now() - this.lastWarning > this.warningCooldownMs) {
      console.warn(`⚠️  Memory warning: ${usage.rss}MB RSS, ${usage.systemFreePercent}% system free - approaching threshold`);
      this.lastWarning = Date.now();
    }
    
    // Memory is good, clear pause state
    if (safe && this.syncPaused) {
      this.syncPaused = false;
      this.pauseReason = null;
    }
    
    return usage;
  }

  /**
   * Force garbage collection if available
   * @returns {{ success: boolean, before: object, after: object }}
   */
  forceGC() {
    const before = this.getUsage();
    if (global.gc) {
      global.gc();
      const after = this.getUsage();
      const freed = before.rss - after.rss;
      console.log(`🧹 GC freed ${freed}MB (${before.rss}MB → ${after.rss}MB)`);
      return { success: true, before, after, freed };
    }
    return { success: false, before, after: before, freed: 0 };
  }

  /**
   * Pause sync operations due to memory pressure
   * Called externally when we need to stop work
   */
  pauseForMemory(reason = 'Memory pressure') {
    this.syncPaused = true;
    this.pauseReason = reason;
    console.log(`⏸️  Sync paused: ${reason}`);
  }

  /**
   * Resume sync operations after memory recovered
   */
  resumeSync() {
    const { safe, usage } = this.checkMemory();
    if (safe) {
      this.syncPaused = false;
      this.pauseReason = null;
      console.log(`▶️  Sync resumed: ${usage.rss}MB RSS, ${usage.systemFreePercent}% system free`);
      return true;
    }
    return false;
  }

  /**
   * Check if sync is currently paused
   */
  isSyncPaused() {
    return { paused: this.syncPaused, reason: this.pauseReason };
  }

  /**
   * Get memory trend (increasing/decreasing/stable)
   */
  getMemoryTrend() {
    if (this.memoryPressureHistory.length < 3) return 'unknown';
    
    const recent = this.memoryPressureHistory.slice(-5);
    const rssValues = recent.map(h => h.usage.rss);
    const first = rssValues[0];
    const last = rssValues[rssValues.length - 1];
    const diff = last - first;
    
    if (diff > 100) return 'increasing';
    if (diff < -100) return 'decreasing';
    return 'stable';
  }

  /**
   * Get memory status for logging/monitoring
   */
  getStatus() {
    const { safe, level, usage, reason } = this.checkMemory();
    return {
      ...usage,
      level,
      safe,
      reason,
      trend: this.getMemoryTrend(),
      syncPaused: this.syncPaused,
      pauseReason: this.pauseReason,
      thresholds: {
        process: {
          warning: this.warningThresholdMB,
          critical: this.criticalThresholdMB,
          max: this.maxThresholdMB,
        },
        system: {
          warningPercent: this.systemWarningPercent,
          criticalPercent: this.systemCriticalPercent,
          maxPercent: this.systemMaxPercent,
        },
      },
    };
  }

  /**
   * Register callbacks for memory events
   */
  setCallbacks({ onHighMemory, onCriticalMemory, onMemoryRecovered }) {
    if (onHighMemory) this.onHighMemory = onHighMemory;
    if (onCriticalMemory) this.onCriticalMemory = onCriticalMemory;
    if (onMemoryRecovered) this.onMemoryRecovered = onMemoryRecovered;
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
 * SYSTEM MEMORY MONITOR
 * ============================================
 * Background monitor for system-wide memory management.
 * Takes proactive action to prevent OOM killer.
 */
class SystemMemoryMonitor {
  constructor(options = {}) {
    const os = require('os');
    this.totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
    
    // Configurable thresholds (% of free memory to trigger action)
    this.warningThreshold = options.warningThreshold || 25;   // 25% free = warning
    this.criticalThreshold = options.criticalThreshold || 15; // 15% free = critical
    this.emergencyThreshold = options.emergencyThreshold || 8; // 8% free = emergency
    
    // Monitoring interval
    this.intervalMs = options.intervalMs || 10000; // Check every 10 seconds
    this.monitorInterval = null;
    this.isRunning = false;
    
    // Action handlers
    this.onWarning = options.onWarning || null;
    this.onCritical = options.onCritical || null;
    this.onEmergency = options.onEmergency || null;
    this.onRecovered = options.onRecovered || null;
    
    // State tracking
    this.currentLevel = 'ok';
    this.lastActionTime = 0;
    this.actionCooldownMs = 30000; // 30s cooldown between actions
    this.consecutiveCritical = 0;
  }

  /**
   * Get current system memory status
   */
  getStatus() {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const freePercent = Math.round((freeMem / totalMem) * 100);
    
    let level = 'ok';
    if (freePercent <= this.emergencyThreshold) {
      level = 'emergency';
    } else if (freePercent <= this.criticalThreshold) {
      level = 'critical';
    } else if (freePercent <= this.warningThreshold) {
      level = 'warning';
    }
    
    return {
      totalMB: Math.round(totalMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      freePercent,
      usedPercent: 100 - freePercent,
      level,
    };
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`🔍 SystemMemoryMonitor started (${this.totalMemMB}MB total, checking every ${this.intervalMs/1000}s)`);
    
    this.monitorInterval = setInterval(() => this._check(), this.intervalMs);
    
    // Initial check
    this._check();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('🛑 SystemMemoryMonitor stopped');
  }

  /**
   * Internal check function
   */
  async _check() {
    const status = this.getStatus();
    const prevLevel = this.currentLevel;
    this.currentLevel = status.level;
    
    const now = Date.now();
    const canTakeAction = (now - this.lastActionTime) >= this.actionCooldownMs;
    
    // Track consecutive critical states
    if (status.level === 'critical' || status.level === 'emergency') {
      this.consecutiveCritical++;
    } else {
      this.consecutiveCritical = 0;
    }
    
    // Handle state transitions
    if (status.level === 'emergency' && canTakeAction) {
      console.error(`🚨 EMERGENCY: System memory at ${status.freePercent}% free (${status.freeMB}MB)!`);
      this.lastActionTime = now;
      
      // Force GC if available
      if (global.gc) {
        console.log('🧹 Emergency GC triggered');
        global.gc();
      }
      
      // Call emergency handler
      if (this.onEmergency) {
        try {
          await this.onEmergency(status);
        } catch (e) {
          console.error('Emergency handler error:', e.message);
        }
      }
      
      // Pause sync via memoryWatchdog
      memoryWatchdog.pauseForMemory(`EMERGENCY: Only ${status.freePercent}% system memory free`);
      
    } else if (status.level === 'critical' && canTakeAction) {
      console.warn(`⚠️  CRITICAL: System memory at ${status.freePercent}% free (${status.freeMB}MB)`);
      this.lastActionTime = now;
      
      // Try GC first
      if (global.gc) {
        global.gc();
      }
      
      if (this.onCritical) {
        try {
          await this.onCritical(status);
        } catch (e) {
          console.error('Critical handler error:', e.message);
        }
      }
      
      // Pause sync if multiple consecutive critical states
      if (this.consecutiveCritical >= 3) {
        memoryWatchdog.pauseForMemory(`CRITICAL: ${status.freePercent}% system memory for ${this.consecutiveCritical} checks`);
      }
      
    } else if (status.level === 'warning' && prevLevel === 'ok') {
      console.log(`⚡ Warning: System memory at ${status.freePercent}% free`);
      if (this.onWarning) {
        try {
          await this.onWarning(status);
        } catch (e) {}
      }
      
    } else if (status.level === 'ok' && (prevLevel === 'critical' || prevLevel === 'emergency')) {
      console.log(`✅ Memory recovered: ${status.freePercent}% free (${status.freeMB}MB)`);
      memoryWatchdog.resumeSync();
      if (this.onRecovered) {
        try {
          await this.onRecovered(status);
        } catch (e) {}
      }
    }
  }

  /**
   * Set action handlers
   */
  setHandlers({ onWarning, onCritical, onEmergency, onRecovered }) {
    if (onWarning) this.onWarning = onWarning;
    if (onCritical) this.onCritical = onCritical;
    if (onEmergency) this.onEmergency = onEmergency;
    if (onRecovered) this.onRecovered = onRecovered;
  }
}

// Global system memory monitor instance
const systemMemoryMonitor = new SystemMemoryMonitor();


/**
 * ============================================
 * MEMORY SAFE EXECUTOR
 * ============================================
 * Wrapper for executing heavy operations with memory checkpoints.
 */
class MemorySafeExecutor {
  constructor(options = {}) {
    this.checkIntervalMs = options.checkIntervalMs || 5000;
    this.pauseOnHighMemory = options.pauseOnHighMemory !== false;
    this.autoGC = options.autoGC !== false;
  }

  /**
   * Execute a function with memory checkpoints
   * Will pause and wait if memory is too high
   */
  async execute(fn, options = {}) {
    const { name = 'operation', maxWaitMs = 300000 } = options;
    
    // Initial memory check
    const { safe, level, reason } = memoryWatchdog.checkMemory();
    
    if (!safe && this.pauseOnHighMemory) {
      console.log(`⏳ Waiting for memory to recover before ${name}... (${reason})`);
      
      const startWait = Date.now();
      while (!memoryWatchdog.checkMemory().safe) {
        if (Date.now() - startWait > maxWaitMs) {
          throw new Error(`Timeout waiting for memory to recover for ${name}`);
        }
        
        // Try GC
        if (this.autoGC && global.gc) {
          global.gc();
        }
        
        await new Promise(r => setTimeout(r, 5000));
      }
      
      console.log(`✅ Memory recovered, proceeding with ${name}`);
    }
    
    return await fn();
  }

  /**
   * Execute with periodic memory checks and pause capability
   * For long-running operations with yield points
   */
  async executeWithCheckpoints(fn, options = {}) {
    const { name = 'operation', checkInterval = this.checkIntervalMs } = options;
    
    let lastCheck = Date.now();
    
    // Checkpoint function to call periodically
    const checkpoint = async () => {
      const now = Date.now();
      if (now - lastCheck < checkInterval) return true;
      lastCheck = now;
      
      const { safe, level, reason } = memoryWatchdog.checkMemory();
      
      if (!safe) {
        console.log(`⏸️  Memory checkpoint: pausing ${name} (${reason})`);
        
        // Try GC
        if (this.autoGC && global.gc) {
          global.gc();
        }
        
        // Wait up to 2 minutes for recovery
        const waitStart = Date.now();
        while (!memoryWatchdog.checkMemory().safe && Date.now() - waitStart < 120000) {
          await new Promise(r => setTimeout(r, 5000));
        }
        
        if (memoryWatchdog.checkMemory().safe) {
          console.log(`▶️  Memory recovered, resuming ${name}`);
          return true;
        } else {
          console.error(`❌ Memory did not recover, aborting ${name}`);
          return false;
        }
      }
      
      return true;
    };
    
    return await fn(checkpoint);
  }
}

// Global executor instance
const memorySafeExecutor = new MemorySafeExecutor();


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
  SystemMemoryMonitor,
  MemorySafeExecutor,
  
  // Global instances
  circuitBreakers,
  logThrottle,
  memoryWatchdog,
  jobLock,
  systemMemoryMonitor,
  memorySafeExecutor,
  
  // Helper functions
  withOOMProtection,
  isConnectionError,
};

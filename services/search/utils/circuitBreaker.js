/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects against cascading failures when external services are down.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.threshold = options.threshold || 5;           // Failures before opening
    this.timeout = options.timeout || 30000;           // Time to wait before half-open (ms)
    this.successThreshold = options.successThreshold || 2;  // Successes to close
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastStateChange = Date.now();
    
    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackCalls: 0,
      stateChanges: [],
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - The async function to execute
   * @param {Function} fallback - Fallback function if circuit is open or fn fails
   * @returns {Promise<any>} Result from fn or fallback
   */
  async execute(fn, fallback) {
    this.metrics.totalCalls++;
    
    // Check if we should try to recover from OPEN state
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailure;
      if (timeSinceFailure > this.timeout) {
        this._changeState('HALF_OPEN');
      } else {
        // Circuit is open, use fallback immediately
        this.metrics.fallbackCalls++;
        console.log(`⚡ [CircuitBreaker:${this.name}] OPEN - using fallback`);
        return this._executeFallback(fallback);
      }
    }
    
    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      this.metrics.fallbackCalls++;
      return this._executeFallback(fallback, error);
    }
  }

  /**
   * Execute fallback, handling both sync and async fallbacks
   */
  async _executeFallback(fallback, error = null) {
    if (typeof fallback === 'function') {
      try {
        const result = fallback(error);
        return result instanceof Promise ? await result : result;
      } catch (fallbackError) {
        console.error(`⚠️ [CircuitBreaker:${this.name}] Fallback also failed:`, fallbackError.message);
        throw fallbackError;
      }
    }
    return fallback; // Return fallback value directly if not a function
  }

  _onSuccess() {
    this.metrics.successfulCalls++;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this._changeState('CLOSED');
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      // Gradually reduce failure count on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  _onFailure(error) {
    this.metrics.failedCalls++;
    this.failures++;
    this.lastFailure = Date.now();
    this.successes = 0;
    
    console.warn(`⚠️ [CircuitBreaker:${this.name}] Failure #${this.failures}: ${error.message}`);
    
    if (this.failures >= this.threshold && this.state !== 'OPEN') {
      this._changeState('OPEN');
    }
  }

  _changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: this.lastStateChange,
    });
    
    console.log(`🔄 [CircuitBreaker:${this.name}] State: ${oldState} → ${newState}`);
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      threshold: this.threshold,
      lastFailure: this.lastFailure,
      lastStateChange: this.lastStateChange,
      metrics: this.metrics,
    };
  }

  /**
   * Force reset the circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    console.log(`🔄 [CircuitBreaker:${this.name}] Reset to CLOSED`);
  }

  /**
   * Check if circuit allows requests
   */
  isAllowed() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    
    // Check if timeout has passed for OPEN state
    const timeSinceFailure = Date.now() - this.lastFailure;
    return timeSinceFailure > this.timeout;
  }
}

// Pre-configured circuit breakers for different services
const circuitBreakers = {
  llm: new CircuitBreaker({ name: 'LLM', threshold: 3, timeout: 30000 }),
  elasticsearch: new CircuitBreaker({ name: 'Elasticsearch', threshold: 5, timeout: 20000 }),
  mongodb: new CircuitBreaker({ name: 'MongoDB', threshold: 5, timeout: 15000 }),
};

module.exports = {
  CircuitBreaker,
  circuitBreakers,
};

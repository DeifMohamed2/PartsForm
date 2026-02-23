/**
 * Error Tracking Service
 * 
 * Features:
 * - Error aggregation and pattern detection
 * - Error rate monitoring
 * - Alerts for critical errors
 * - Error statistics for admin dashboard
 * - Recent errors retrieval
 */

const logger = require('../utils/logger');
const EventEmitter = require('events');

class ErrorTracker extends EventEmitter {
  constructor() {
    super();
    
    // In-memory error store (recent errors for quick access)
    this.recentErrors = [];
    this.maxRecentErrors = 500;
    
    // Error counters by type
    this.errorCounts = new Map();
    
    // Error rates (per minute)
    this.errorRates = [];
    this.maxRateHistory = 60; // 1 hour of minute-by-minute data
    
    // Alert thresholds
    this.alertThresholds = {
      criticalErrorsPerMinute: 10,
      totalErrorsPerMinute: 50,
      uniqueErrorTypes: 20,
    };
    
    // Start rate tracking
    this.startRateTracking();
    
    // Bind methods
    this.trackError = this.trackError.bind(this);
    this.getStats = this.getStats.bind(this);
  }

  /**
   * Track an error
   * @param {Error} error - The error object
   * @param {Object} context - Additional context
   */
  trackError(error, context = {}) {
    const errorEntry = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      code: error.code,
      type: this.classifyError(error),
      severity: this.determineSeverity(error),
      context: {
        requestId: context.requestId,
        userId: context.userId,
        url: context.url,
        method: context.method,
        ip: context.ip,
        userAgent: context.userAgent,
        ...context,
      },
    };
    
    // Add to recent errors
    this.recentErrors.unshift(errorEntry);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }
    
    // Update error counts
    const errorKey = `${errorEntry.name}:${errorEntry.type}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Emit event for listeners
    this.emit('error', errorEntry);
    
    // Check for alerts
    this.checkAlerts(errorEntry);
    
    return errorEntry;
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    const message = (error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();
    
    if (name.includes('mongo') || message.includes('mongodb') || message.includes('mongoose')) {
      return 'database';
    }
    if (name.includes('validation') || message.includes('validation')) {
      return 'validation';
    }
    if (name.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'authentication';
    }
    if (message.includes('timeout') || message.includes('econnrefused') || message.includes('enotfound')) {
      return 'network';
    }
    if (message.includes('syntax') || message.includes('reference') || message.includes('type')) {
      return 'runtime';
    }
    if (message.includes('memory') || message.includes('heap') || message.includes('oom')) {
      return 'memory';
    }
    if (name.includes('elasticsearch') || message.includes('elasticsearch')) {
      return 'elasticsearch';
    }
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    
    return 'unknown';
  }

  /**
   * Determine error severity
   */
  determineSeverity(error) {
    const message = (error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();
    
    // Critical errors
    if (
      message.includes('out of memory') ||
      message.includes('fatal') ||
      message.includes('database connection') ||
      name.includes('systemerror')
    ) {
      return 'critical';
    }
    
    // High severity
    if (
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('mongodb') ||
      message.includes('timeout')
    ) {
      return 'high';
    }
    
    // Medium severity
    if (
      message.includes('validation') ||
      message.includes('not found') ||
      message.includes('bad request')
    ) {
      return 'medium';
    }
    
    // Low severity
    return 'low';
  }

  /**
   * Start tracking error rates
   */
  startRateTracking() {
    // Record error rate every minute
    setInterval(() => {
      const now = new Date();
      const oneMinuteAgo = new Date(now - 60000);
      
      const errorsInLastMinute = this.recentErrors.filter(
        e => new Date(e.timestamp) > oneMinuteAgo
      ).length;
      
      this.errorRates.unshift({
        timestamp: now.toISOString(),
        count: errorsInLastMinute,
      });
      
      if (this.errorRates.length > this.maxRateHistory) {
        this.errorRates = this.errorRates.slice(0, this.maxRateHistory);
      }
    }, 60000);
  }

  /**
   * Check and emit alerts
   */
  checkAlerts(errorEntry) {
    // Check critical error count
    if (errorEntry.severity === 'critical') {
      const criticalCount = this.recentErrors.filter(
        e => e.severity === 'critical' && 
        Date.now() - new Date(e.timestamp).getTime() < 60000
      ).length;
      
      if (criticalCount >= this.alertThresholds.criticalErrorsPerMinute) {
        this.emit('alert', {
          type: 'critical_errors',
          message: `Critical error rate exceeded: ${criticalCount} in last minute`,
          count: criticalCount,
          threshold: this.alertThresholds.criticalErrorsPerMinute,
        });
        
        logger.error('ALERT: Critical error rate exceeded', {
          alertType: 'critical_errors',
          count: criticalCount,
          threshold: this.alertThresholds.criticalErrorsPerMinute,
        });
      }
    }
  }

  /**
   * Get error statistics
   */
  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    const recentWithTime = this.recentErrors.map(e => ({
      ...e,
      time: new Date(e.timestamp).getTime(),
    }));
    
    return {
      total: this.recentErrors.length,
      lastMinute: recentWithTime.filter(e => e.time > oneMinuteAgo).length,
      lastHour: recentWithTime.filter(e => e.time > oneHourAgo).length,
      lastDay: recentWithTime.filter(e => e.time > oneDayAgo).length,
      
      bySeverity: {
        critical: recentWithTime.filter(e => e.severity === 'critical').length,
        high: recentWithTime.filter(e => e.severity === 'high').length,
        medium: recentWithTime.filter(e => e.severity === 'medium').length,
        low: recentWithTime.filter(e => e.severity === 'low').length,
      },
      
      byType: this.getErrorsByType(),
      
      topErrors: this.getTopErrors(10),
      
      errorRates: this.errorRates.slice(0, 30), // Last 30 minutes
      
      uniqueErrorTypes: this.errorCounts.size,
    };
  }

  /**
   * Get errors grouped by type
   */
  getErrorsByType() {
    const byType = {};
    for (const error of this.recentErrors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
    }
    return byType;
  }

  /**
   * Get top occurring errors
   */
  getTopErrors(limit = 10) {
    const errorGroups = new Map();
    
    for (const error of this.recentErrors) {
      const key = `${error.name}:${error.message?.substring(0, 100)}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, {
          name: error.name,
          message: error.message?.substring(0, 200),
          type: error.type,
          severity: error.severity,
          count: 0,
          lastOccurred: error.timestamp,
        });
      }
      errorGroups.get(key).count++;
    }
    
    return Array.from(errorGroups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50, filters = {}) {
    let errors = [...this.recentErrors];
    
    if (filters.severity) {
      errors = errors.filter(e => e.severity === filters.severity);
    }
    if (filters.type) {
      errors = errors.filter(e => e.type === filters.type);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      errors = errors.filter(e => 
        e.message?.toLowerCase().includes(search) ||
        e.name?.toLowerCase().includes(search)
      );
    }
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      errors = errors.filter(e => new Date(e.timestamp).getTime() > since);
    }
    
    return errors.slice(0, limit);
  }

  /**
   * Clear old errors
   */
  clearOldErrors(olderThan = 86400000) { // 24 hours default
    const cutoff = Date.now() - olderThan;
    this.recentErrors = this.recentErrors.filter(
      e => new Date(e.timestamp).getTime() > cutoff
    );
  }

  /**
   * Reset error counts
   */
  resetCounts() {
    this.errorCounts.clear();
    logger.info('Error counts reset');
  }
}

// Export singleton instance
const errorTracker = new ErrorTracker();

// Listen for alerts and log them
errorTracker.on('alert', (alert) => {
  logger.error('Error tracker alert', alert);
});

module.exports = errorTracker;

/**
 * Professional Logger System for PARTSFORM
 * 
 * Features:
 * - Multiple log levels (error, warn, info, http, debug)
 * - Daily rotating log files with compression
 * - Separate error logs for critical issues
 * - Request ID tracking for request tracing
 * - Pretty console output for development
 * - JSON format for production (easy parsing)
 * - Context-aware logging with metadata
 * - Performance timing utilities
 * - Error stack trace capture
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Custom log levels (npm standard + http)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

// ==== FORMAT DEFINITIONS ====

// Timestamp format - [HH:mm:ss] style
const timestampFormat = winston.format.timestamp({
  format: 'HH:mm:ss',
});

// Error stack trace format
const errorStackFormat = winston.format((info) => {
  if (info.error instanceof Error) {
    info.stack = info.error.stack;
    info.errorMessage = info.error.message;
    info.errorName = info.error.name;
  }
  if (info instanceof Error) {
    return {
      ...info,
      message: info.message,
      stack: info.stack,
    };
  }
  return info;
});

// Add metadata format
const metadataFormat = winston.format((info) => {
  // Add process info
  info.pid = process.pid;
  info.hostname = require('os').hostname();
  
  // Add memory usage on errors
  if (info.level === 'error') {
    const memUsage = process.memoryUsage();
    info.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    };
  }
  
  return info;
});

// Human-readable status messages
const STATUS_MESSAGES = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved', 302: 'Redirect', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  422: 'Validation Error', 429: 'Too Many Requests',
  500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable'
};

// Pretty print format - [HH:mm:ss] level: message {"service":"partsform","event":"..."}
const prettyPrintFormat = winston.format.printf(({ 
  level, 
  message, 
  timestamp, 
  requestId,
  userId,
  method,
  url,
  statusCode,
  responseTime,
  stack,
  error,
  errorMessage,
  ...metadata 
}) => {
  const levelLower = level.toLowerCase();
  let log = `[${timestamp}] ${levelLower}: `;
  
  // Build metadata JSON (service + event + relevant fields)
  const meta = { service: 'partsform' };
  
  // HTTP request
  if (method && url) {
    const statusMsg = STATUS_MESSAGES[statusCode] || statusCode;
    const timeStr = responseTime != null ? ` (${responseTime}ms)` : '';
    log += `HTTP ${method} ${url} ${statusCode} ${statusMsg}${timeStr}`;
    meta.event = 'HTTP_REQUEST';
    meta.method = method;
    meta.url = url;
    meta.statusCode = statusCode;
    if (responseTime != null) meta.responseTime = responseTime;
  } else {
    log += message;
    if (metadata.event) meta.event = metadata.event;
    if (metadata.socketId) meta.socketId = metadata.socketId;
    if (metadata.user) meta.user = metadata.user;
    if (metadata.claimId) meta.claimId = metadata.claimId;
    if (metadata.host) meta.host = metadata.host;
    if (metadata.error) meta.error = metadata.error;
    if (metadata.port) meta.port = metadata.port;
    if (metadata.nodeEnv) meta.nodeEnv = metadata.nodeEnv;
  }
  
  // Add request ID for errors
  if (level === 'error' && requestId) {
    meta.requestId = requestId.substring(0, 8);
  }
  if (level === 'error' && (errorMessage || metadata.errorMessage)) {
    meta.error = errorMessage || metadata.errorMessage;
  }
  
  log += ` ${JSON.stringify(meta)}`;
  
  // Stack trace for errors (on new line)
  const errStack = stack || error?.stack;
  if (errStack && level === 'error') {
    log += `\n  ${errStack.split('\n').slice(0, 5).join('\n  ')}`;
  }
  
  return log;
});

// JSON format for production (structured logging)
const jsonFormat = winston.format.combine(
  timestampFormat,
  errorStackFormat(),
  metadataFormat(),
  winston.format.json()
);

// Console format (colorized level, [HH:mm:ss] style)
const consoleFormat = winston.format.combine(
  timestampFormat,
  errorStackFormat(),
  winston.format.colorize({ level: true }),
  prettyPrintFormat
);

// ==== TRANSPORT DEFINITIONS ====

// Console transport
const consoleTransport = new winston.transports.Console({
  level: logLevel,
  format: consoleFormat,
  handleExceptions: true,
  handleRejections: true,
});

// Combined log file (all levels) - rotates daily
const combinedFileTransport = new DailyRotateFile({
  level: logLevel,
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '30d', // Keep 30 days of logs
  format: jsonFormat,
});

// Error log file (errors only) - rotates daily
const errorFileTransport = new DailyRotateFile({
  level: 'error',
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '90d', // Keep 90 days of error logs
  format: jsonFormat,
});

// HTTP access log - rotates daily
const httpFileTransport = new DailyRotateFile({
  level: 'http',
  filename: path.join(logsDir, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '14d', // Keep 14 days of access logs
  format: jsonFormat,
});

// Exception log file
const exceptionFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'exceptions-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '90d',
  format: jsonFormat,
});

// ==== CREATE MAIN LOGGER ====

const logger = winston.createLogger({
  levels,
  level: logLevel,
  defaultMeta: { service: 'partsform' },
  transports: [
    consoleTransport,
    combinedFileTransport,
    errorFileTransport,
  ],
  exceptionHandlers: [
    exceptionFileTransport,
    consoleTransport,
  ],
  rejectionHandlers: [
    exceptionFileTransport,
    consoleTransport,
  ],
  exitOnError: false, // Don't exit on handled exceptions
});

// Create separate HTTP logger
const httpLogger = winston.createLogger({
  levels,
  level: 'http',
  defaultMeta: { service: 'partsform-http' },
  transports: [
    httpFileTransport,
    isDevelopment ? consoleTransport : null,
  ].filter(Boolean),
});

// ==== ENHANCED LOGGING METHODS ====

/**
 * Create a child logger with request context
 * @param {Object} context - Context object with requestId, userId, etc.
 */
logger.child = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    http: (message, meta = {}) => httpLogger.http(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
  };
};

/**
 * Log an error with full stack trace
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {Object} meta - Additional metadata
 */
logger.logError = (message, error, meta = {}) => {
  logger.error(message, {
    ...meta,
    error,
    errorMessage: error?.message,
    errorName: error?.name,
    stack: error?.stack,
  });
};

/**
 * Performance timer utility
 * @param {string} label - Timer label
 * @returns {Function} - Function to stop timer and log duration
 */
logger.startTimer = (label) => {
  const start = process.hrtime.bigint();
  return (meta = {}) => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    logger.debug(`${label} completed`, {
      ...meta,
      duration: `${durationMs.toFixed(2)}ms`,
      durationMs,
    });
    return durationMs;
  };
};

/**
 * Log database query
 * @param {string} operation - Query operation (find, insert, update, etc.)
 * @param {string} collection - Collection name
 * @param {Object} query - Query object
 * @param {number} duration - Query duration in ms
 */
logger.logQuery = (operation, collection, query = {}, duration = 0) => {
  logger.debug('Database query', {
    type: 'db_query',
    operation,
    collection,
    query: JSON.stringify(query).substring(0, 500),
    durationMs: duration,
  });
};

/**
 * Log external API call
 * @param {string} service - External service name
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {number} statusCode - Response status code
 * @param {number} duration - Request duration in ms
 */
logger.logExternalApi = (service, endpoint, method, statusCode, duration) => {
  const level = statusCode >= 400 ? 'warn' : 'debug';
  logger[level]('External API call', {
    type: 'external_api',
    service,
    endpoint,
    method,
    statusCode,
    durationMs: duration,
  });
};

/**
 * Log security event
 * @param {string} event - Security event type
 * @param {Object} details - Event details
 */
logger.logSecurity = (event, details = {}) => {
  logger.warn('Security event', {
    type: 'security',
    event,
    ...details,
  });
};

/**
 * Log business event
 * @param {string} event - Business event name
 * @param {Object} data - Event data
 */
logger.logBusinessEvent = (event, data = {}) => {
  logger.info('Business event', {
    type: 'business',
    event,
    ...data,
  });
};

/**
 * Log system metrics
 * @param {Object} metrics - System metrics object
 */
logger.logMetrics = (metrics) => {
  logger.info('System metrics', {
    type: 'metrics',
    ...metrics,
  });
};

// ==== STREAM FOR MORGAN ====

logger.stream = {
  write: (message) => {
    // Remove newline from morgan message
    httpLogger.http(message.trim());
  },
};

// ==== LOG RETRIEVAL METHODS ====

/**
 * Get recent logs from file
 * @param {string} type - Log type (combined, error, access)
 * @param {number} lines - Number of lines to retrieve
 * @param {string} search - Search filter
 * @returns {Promise<Array>} - Array of log entries
 */
logger.getRecentLogs = async (type = 'combined', lines = 100, search = '') => {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    let filename;
    
    switch (type) {
      case 'error':
        filename = `error-${today}.log`;
        break;
      case 'access':
      case 'http':
        filename = `access-${today}.log`;
        break;
      case 'exceptions':
        filename = `exceptions-${today}.log`;
        break;
      default:
        filename = `combined-${today}.log`;
    }
    
    const filePath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let logLines = content.trim().split('\n').filter(Boolean);
      
      // Parse JSON lines
      const logs = logLines
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch {
            return { level: 'info', message: line, timestamp: new Date().toISOString() };
          }
        })
        .filter(log => {
          if (!search) return true;
          const searchLower = search.toLowerCase();
          return (
            log.message?.toLowerCase().includes(searchLower) ||
            log.level?.toLowerCase().includes(searchLower) ||
            JSON.stringify(log).toLowerCase().includes(searchLower)
          );
        });
      
      // Return last N lines
      resolve(logs.slice(-lines));
    } catch (error) {
      logger.error('Error reading logs', { error: error.message, filePath });
      resolve([]);
    }
  });
};

/**
 * Get log file stats
 * @returns {Object} - Log file statistics
 */
logger.getLogStats = () => {
  const stats = {
    files: [],
    totalSize: 0,
    oldestLog: null,
    newestLog: null,
  };
  
  try {
    const files = fs.readdirSync(logsDir);
    
    for (const file of files) {
      if (!file.endsWith('.log') && !file.endsWith('.gz')) continue;
      
      const filePath = path.join(logsDir, file);
      const fileStat = fs.statSync(filePath);
      
      stats.files.push({
        name: file,
        size: fileStat.size,
        sizeFormatted: formatBytes(fileStat.size),
        created: fileStat.birthtime,
        modified: fileStat.mtime,
      });
      
      stats.totalSize += fileStat.size;
      
      if (!stats.oldestLog || fileStat.birthtime < stats.oldestLog) {
        stats.oldestLog = fileStat.birthtime;
      }
      if (!stats.newestLog || fileStat.mtime > stats.newestLog) {
        stats.newestLog = fileStat.mtime;
      }
    }
    
    stats.totalSizeFormatted = formatBytes(stats.totalSize);
    stats.fileCount = stats.files.length;
  } catch (error) {
    logger.error('Error getting log stats', { error: error.message });
  }
  
  return stats;
};

// Helper function
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==== STARTUP LOG ====

logger.info('Logger ready', { service: 'partsform' });

module.exports = logger;
module.exports.httpLogger = httpLogger;

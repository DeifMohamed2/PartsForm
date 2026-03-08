/**
 * Request Logger Middleware
 * 
 * Features:
 * - Unique request ID generation for tracing
 * - Response time tracking
 * - Clean, human-readable HTTP logging (INFO/WARN/ERROR with colors)
 * - Skip health checks and static files
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Skip logging for these paths (health checks, static files, browser noise)
const SKIP_PATHS = [
  '/health',
  '/favicon.ico',
  '/robots.txt',
  '/.well-known/',
  '/css/',
  '/js/',
  '/images/',
  '/fonts/',
  '/uploads/',
];

/**
 * Request ID middleware - adds unique ID and logs each request when finished
 */
const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  req.startTime = process.hrtime.bigint();
  
  req.log = logger.child({
    requestId: req.requestId,
    userId: req.user?.id || req.admin?.id || req.user?._id || null,
    userType: req.userRole || (req.admin ? 'admin' : 'anonymous'),
    ip: req.ip || req.connection?.remoteAddress,
  });
  
  res.on('finish', () => {
    if (shouldSkipLogging(req.path)) return;
    
    const endTime = process.hrtime.bigint();
    const responseTime = Math.round(Number(endTime - req.startTime) / 1000000);
    
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      userId: req.user?.id || req.admin?.id || req.user?._id,
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.info('Request', logData);
    }
  });
  
  next();
};

/**
 * Check if logging should be skipped for this path
 */
function shouldSkipLogging(path) {
  return SKIP_PATHS.some(skipPath => path.startsWith(skipPath));
}

/**
 * Morgan middleware - kept for http file logging only (no console output)
 * Uses a no-op stream in dev since requestIdMiddleware handles console
 */
const morganMiddleware = (req, res, next) => next();

/**
 * Error logging middleware - capture and log errors
 * Place this AFTER routes but BEFORE error handler
 */
const errorLoggerMiddleware = (err, req, res, next) => {
  const errorData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: req.user?.id || req.admin?.id,
    userType: req.userRole || (req.admin ? 'admin' : 'anonymous'),
    ip: req.ip,
    body: sanitizeBody(req.body),
    query: req.query,
    params: req.params,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status || err.statusCode || 500,
    },
  };
  
  // Log the error
  logger.error('Unhandled request error', errorData);
  
  // Pass to next error handler
  next(err);
};

/**
 * Sanitize request body to remove sensitive data before logging
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = [
    'password',
    'confirmPassword',
    'currentPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
  ];
  
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Limit body size for logging
  const bodyString = JSON.stringify(sanitized);
  if (bodyString.length > 2000) {
    return { _truncated: true, _size: bodyString.length };
  }
  
  return sanitized;
}

/**
 * Request body logger - logs request body for debugging
 * Only for non-GET requests and non-file uploads
 */
const bodyLoggerMiddleware = (req, res, next) => {
  // Skip for GET requests, file uploads, and health checks
  if (
    req.method === 'GET' ||
    req.is('multipart/form-data') ||
    shouldSkipLogging(req.path)
  ) {
    return next();
  }
  
  // Only log in debug mode
  if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
    if (req.body && Object.keys(req.body).length > 0) {
      req.log?.debug('Request body', {
        body: sanitizeBody(req.body),
        contentType: req.get('content-type'),
      });
    }
  }
  
  next();
};

/**
 * Security logger - logs security-related events
 */
const securityLoggerMiddleware = (req, res, next) => {
  // Only check non-GET requests and URLs (skip body serialization for performance)
  const fullUrl = req.originalUrl || req.url;
  
  // Quick check on URL only (avoid expensive JSON.stringify on every request)
  const suspiciousUrlPatterns = [
    /(\.\.|\/etc\/|\/proc\/)/i, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /\$ne|\$gt|\$lt|\$or/i, // NoSQL injection
  ];
  
  for (const pattern of suspiciousUrlPatterns) {
    if (pattern.test(fullUrl)) {
      logger.logSecurity('suspicious_request', {
        requestId: req.requestId,
        method: req.method,
        url: fullUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        pattern: pattern.source,
      });
      break;
    }
  }
  
  // Only check body for POST/PUT/PATCH (not on every GET)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const body = JSON.stringify(req.body);
    for (const pattern of suspiciousUrlPatterns) {
      if (pattern.test(body)) {
        logger.logSecurity('suspicious_request_body', {
          requestId: req.requestId,
          method: req.method,
          url: fullUrl,
          ip: req.ip,
          pattern: pattern.source,
        });
        break;
      }
    }
  }
  
  next();
};

/**
 * Slow request logger - logs requests that take too long
 */
const slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 3000; // 3 seconds

const slowRequestLoggerMiddleware = (req, res, next) => {
  const timeout = setTimeout(() => {
    logger.warn('Slow request detected', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      threshold: slowRequestThreshold,
      userId: req.user?.id || req.admin?.id,
      ip: req.ip,
    });
  }, slowRequestThreshold);
  
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  res.on('close', () => {
    clearTimeout(timeout);
  });
  
  next();
};

module.exports = {
  requestIdMiddleware,
  morganMiddleware,
  errorLoggerMiddleware,
  bodyLoggerMiddleware,
  securityLoggerMiddleware,
  slowRequestLoggerMiddleware,
  sanitizeBody,
};

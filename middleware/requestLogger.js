/**
 * Request Logger Middleware
 * 
 * Features:
 * - Unique request ID generation for tracing
 * - Response time tracking
 * - Full request/response logging
 * - User context capture
 * - Skip health checks and static files
 * - Morgan integration
 */

const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Skip logging for these paths (health checks, static files, etc.)
const SKIP_PATHS = [
  '/health',
  '/favicon.ico',
  '/robots.txt',
  '/css/',
  '/js/',
  '/images/',
  '/fonts/',
  '/uploads/',
];

/**
 * Request ID middleware - adds unique ID to each request
 */
const requestIdMiddleware = (req, res, next) => {
  // Use existing request ID from header (for distributed tracing) or generate new one
  req.requestId = req.headers['x-request-id'] || uuidv4();
  
  // Add request ID to response headers for client-side tracking
  res.setHeader('X-Request-ID', req.requestId);
  
  // Store start time for response time calculation
  req.startTime = process.hrtime.bigint();
  
  // Create a child logger with request context
  req.log = logger.child({
    requestId: req.requestId,
    userId: req.user?.id || req.admin?.id || req.user?._id || null,
    userType: req.userRole || (req.admin ? 'admin' : 'anonymous'),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')?.substring(0, 200),
  });
  
  // Log response when finished
  res.on('finish', () => {
    // Skip logging for certain paths
    if (shouldSkipLogging(req.path)) return;
    
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - req.startTime) / 1000000; // Convert to ms
    
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: Math.round(responseTime),
      contentLength: res.get('content-length'),
      userId: req.user?.id || req.admin?.id || req.user?._id,
      userType: req.userRole || (req.admin ? 'admin' : 'anonymous'),
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent')?.substring(0, 100),
      referer: req.get('referer'),
    };
    
    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error('HTTP Request Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.http('HTTP Request', logData);
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
 * Morgan middleware configuration
 * Using combined format for comprehensive logging
 */
const morganFormat = ':method :url :status :response-time ms - :res[content-length] - :req[x-request-id]';

// Custom Morgan tokens
morgan.token('req-id', (req) => req.requestId || '-');
morgan.token('user-id', (req) => req.user?.id || req.admin?.id || '-');

// Morgan middleware with skip logic and custom format
const morganMiddleware = morgan(morganFormat, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip health checks and static files
    if (shouldSkipLogging(req.path)) return true;
    // In production, skip successful static/OPTIONS requests
    if (process.env.NODE_ENV === 'production') {
      return req.method === 'OPTIONS' || (res.statusCode < 400 && req.path.includes('.'));
    }
    return false;
  },
});

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
  // Log suspicious activity patterns
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/)/i, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /\$ne|\$gt|\$lt|\$or/i, // NoSQL injection
  ];
  
  const fullUrl = req.originalUrl || req.url;
  const body = JSON.stringify(req.body || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl) || pattern.test(body)) {
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

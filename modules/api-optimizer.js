/**
 * API Optimization Module for BLUEORION QMS
 * Pagination, field selection, and response compression
 * Phase 3: API Enhancement
 */

/**
 * Pagination middleware
 * Usage: GET /api/workers?page=1&limit=50
 */
function paginationMiddleware(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 500));
  
  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit
  };
  
  next();
}

/**
 * Apply pagination to data
 * @param {array} data - Data to paginate
 * @param {object} pagination - Pagination object from middleware
 * @returns {object} Paginated result with metadata
 */
function applyPagination(data, pagination) {
  const total = data.length;
  const pages = Math.ceil(total / pagination.limit);
  const paginatedData = data.slice(
    pagination.offset,
    pagination.offset + pagination.limit
  );
  
  return {
    data: paginatedData,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages,
      hasNext: pagination.page < pages,
      hasPrev: pagination.page > 1
    }
  };
}

/**
 * Field selection utility
 * Usage: GET /api/workers?fields=id,name,passport
 * @param {array} data - Array of objects
 * @param {string} fieldsParam - Comma-separated field names
 * @returns {array} Data with selected fields only
 */
function selectFields(data, fieldsParam) {
  if (!fieldsParam) return data;
  
  const fields = fieldsParam.split(',').map(f => f.trim()).filter(f => f);
  if (fields.length === 0) return data;
  
  return data.map(item => {
    const selected = {};
    for (const field of fields) {
      if (field in item) {
        selected[field] = item[field];
      }
    }
    return selected;
  });
}

/**
 * Batch multiple API queries
 * Usage: POST /api/batch with body:
 * {
 *   "queries": [
 *     { "endpoint": "/api/workers", "params": { "page": 1 } },
 *     { "endpoint": "/api/complaints", "params": { "status": "open" } }
 *   ]
 * }
 */
async function batchRequests(queries, requestHandler) {
  const results = await Promise.allSettled(
    queries.map(q => requestHandler(q.endpoint, q.params))
  );
  
  return results.map((result, index) => ({
    query: queries[index],
    status: result.status,
    data: result.status === 'fulfilled' ? result.value : result.reason
  }));
}

/**
 * Response compression configuration
 * Automatically compress responses > 1KB
 */
function compressionConfig() {
  const compression = require('compression');
  return compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6, // Balance between compression and speed
    threshold: 1024 // Only compress > 1KB
  });
}

/**
 * Cache control headers for API responses
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} cacheType - 'public', 'private', or 'no-cache'
 * @param {number} maxAge - Max age in seconds
 */
function setCacheHeaders(req, res, cacheType = 'private', maxAge = 300) {
  res.set('Cache-Control', `${cacheType}, max-age=${maxAge}`);
  res.set('Vary', 'Accept-Encoding, X-User-Role');
}

/**
 * Rate limiting configuration
 * @returns {object} Rate limiter middleware
 */
function rateLimitConfig() {
  const rateLimit = require('express-rate-limit');
  
  return {
    // General API rate limiting
    apiLimiter: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    }),
    
    // Strict rate limiting for auth endpoints
    authLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      message: 'Too many login attempts, please try again later'
    }),
    
    // Loose rate limiting for read operations
    readLimiter: rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 1000,
      skipFailedRequests: true
    })
  };
}

/**
 * API versioning helper
 * Supports: /api/v1/workers, /api/v2/workers
 */
function apiVersionMiddleware(req, res, next) {
  const versionMatch = req.path.match(/\/api\/(v\d+)\//);
  req.apiVersion = versionMatch ? versionMatch[1] : 'v1';
  next();
}

/**
 * Structured error response
 * @param {object} res - Express response
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error code
 * @param {string} message - Error message
 * @param {object} details - Additional error details
 */
function sendApiError(res, statusCode, error, message, details = {}) {
  res.status(statusCode).json({
    success: false,
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Structured success response
 * @param {object} res - Express response
 * @param {*} data - Response data
 * @param {object} meta - Optional metadata
 */
function sendApiSuccess(res, data, meta = {}) {
  res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  paginationMiddleware,
  applyPagination,
  selectFields,
  batchRequests,
  compressionConfig,
  setCacheHeaders,
  rateLimitConfig,
  apiVersionMiddleware,
  sendApiError,
  sendApiSuccess
};

/**
 * BLUEORION QMS - Enhanced Server Integration
 * Integrates all performance enhancement modules (Phase 1-4)
 * This file orchestrates: Caching, Indexing, Database, API Optimization, Monitoring
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const CacheManager = require('./cache-manager');
const DataIndexer = require('./data-indexer');
const { PerformanceMonitor, monitoringMiddleware } = require('./performance-monitor');
const apiOptimizer = require('./api-optimizer');

// Initialize core systems
const cache = new CacheManager({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 10000,
  defaultTTL: parseInt(process.env.CACHE_TTL_MS) || 5 * 60 * 1000
});

const monitor = new PerformanceMonitor({
  enabled: process.env.MONITORING_ENABLED !== 'false',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL_MS) || 60000
});

// Data indexers for critical entities
const workerIndexer = new DataIndexer([], {
  passport_no: 'unique',
  working_country: 'multi',
  employment_status: 'multi'
});

const complaintIndexer = new DataIndexer([], {
  id: 'unique',
  worker_id: 'multi',
  status: 'multi'
});

const documentIndexer = new DataIndexer([], {
  name: 'unique',
  category: 'multi',
  tags: 'multi'
});

/**
 * Setup all enhancement modules on Express app
 * @param {express.Application} app - Express app instance
 */
function setupEnhancements(app) {
  // 1. PHASE 4: Monitoring middleware
  app.use(monitoringMiddleware(monitor));
  
  // 2. PHASE 3: API optimization
  if (process.env.FEATURE_API_BATCHING !== 'false') {
    app.use(apiOptimizer.paginationMiddleware);
    app.use(apiOptimizer.apiVersionMiddleware);
    
    // Rate limiting (if not in development)
    if (process.env.NODE_ENV === 'production') {
      const limits = apiOptimizer.rateLimitConfig();
      app.use('/api/', limits.apiLimiter);
      app.use('/login', limits.authLimiter);
    }
  }
  
  // 3. PHASE 1: Cache management endpoints (admin only)
  setupCacheEndpoints(app);
  
  // 4. Monitoring endpoints (admin only)
  setupMonitoringEndpoints(app);
}

/**
 * Setup cache management endpoints
 * @param {express.Application} app - Express app instance
 */
function setupCacheEndpoints(app) {
  app.get('/api/admin/cache/stats', requireAdmin, (req, res) => {
    res.json(cache.getStats());
  });
  
  app.post('/api/admin/cache/clear', requireAdmin, (req, res) => {
    const pattern = req.body.pattern || null;
    if (pattern) {
      cache.deletePattern(pattern);
      res.json({ message: `Cleared cache entries matching: ${pattern}` });
    } else {
      cache.clear();
      res.json({ message: 'Cache cleared' });
    }
  });
}

/**
 * Setup monitoring endpoints
 * @param {express.Application} app - Express app instance
 */
function setupMonitoringEndpoints(app) {
  app.get('/api/admin/health', (req, res) => {
    res.json(monitor.getHealthStatus());
  });
  
  app.get('/api/admin/metrics', requireAdmin, (req, res) => {
    res.json(monitor.getMetrics());
  });
  
  app.get('/api/admin/metrics/reset', requireAdmin, (req, res) => {
    monitor.reset();
    res.json({ message: 'Metrics reset' });
  });
}

/**
 * Load data from JSON file and create indexes
 * PHASE 1 OPTIMIZATION: Replaces repeated fs.readFileSync calls
 * @param {string} filePath - Path to JSON file
 * @param {DataIndexer} indexer - Indexer instance to populate
 * @returns {array} Loaded data
 */
function loadDataWithCaching(filePath, indexer) {
  const cacheKey = `data:${filePath}`;
  
  // Check cache first
  let data = cache.get(cacheKey);
  if (data) {
    monitor.trackCacheAccess(true);
    return data;
  }
  
  monitor.trackCacheAccess(false);
  
  // Load from disk
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Cache the data
      cache.set(cacheKey, data);
      
      // Build indexes
      if (indexer) {
        indexer.data = data;
        indexer.buildIndexes();
      }
      
      return data;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      return [];
    }
  }
  
  return [];
}

/**
 * Save data to JSON file and invalidate cache
 * @param {string} filePath - Path to JSON file
 * @param {array} data - Data to save
 * @param {string} cacheKey - Cache key to invalidate
 */
function saveDataAndInvalidateCache(filePath, data, cacheKey) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // Invalidate cache
    cache.delete(cacheKey);
    
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Optimized data search with caching
 * PHASE 1 OPTIMIZATION: Replaces multiple .find() calls with index lookups
 * @param {DataIndexer} indexer - Data indexer instance
 * @param {object} filters - Filter criteria
 * @param {object} options - Search options
 * @returns {array} Matching items
 */
function optimizedSearch(indexer, filters, options = {}) {
  const cacheKey = `search:${JSON.stringify({ filters, options })}`;
  
  // Check cache
  let results = cache.get(cacheKey);
  if (results) {
    monitor.trackCacheAccess(true);
    return results;
  }
  
  monitor.trackCacheAccess(false);
  
  // Perform search
  results = indexer.filter(filters);
  
  // Cache results with shorter TTL for searches
  cache.set(cacheKey, results, 60000); // 1 minute
  
  return results;
}

/**
 * Parse API request with field selection
 * PHASE 3 OPTIMIZATION: Reduce payload size
 * @param {express.Request} req - Express request
 * @param {array} data - Data to return
 * @returns {object} Paginated and selected data
 */
function buildApiResponse(req, data) {
  // Apply field selection if requested
  if (process.env.FEATURE_FIELD_SELECTION !== 'false' && req.query.fields) {
    data = apiOptimizer.selectFields(data, req.query.fields);
  }
  
  // Apply pagination if requested
  if (req.pagination) {
    return apiOptimizer.applyPagination(data, req.pagination);
  }
  
  return { data };
}

/**
 * Placeholder for admin authentication check
 * Replace with your actual auth logic
 */
function requireAdmin(req, res, next) {
  // This should be integrated with your actual authentication
  // For now, just check for admin role header
  const role = (req.headers['x-user-role'] || 'viewer').toLowerCase();
  if (role !== 'admin' && role !== 'qmr') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = {
  // Core systems
  cache,
  monitor,
  workerIndexer,
  complaintIndexer,
  documentIndexer,
  
  // Setup functions
  setupEnhancements,
  setupCacheEndpoints,
  setupMonitoringEndpoints,
  
  // Utility functions
  loadDataWithCaching,
  saveDataAndInvalidateCache,
  optimizedSearch,
  buildApiResponse,
  
  // Re-export modules
  apiOptimizer
};

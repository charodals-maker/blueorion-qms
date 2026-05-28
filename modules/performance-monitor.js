/**
 * Performance Monitoring & APM Module for BLUEORION QMS
 * Application performance monitoring, metrics collection, and health checks
 * Phase 4: Infrastructure Enhancement
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.metricsInterval = options.metricsInterval || 60000; // 1 minute
    
    // Metrics storage
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        avgResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      database: {
        queries: 0,
        avgDuration: 0,
        slowQueries: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      system: {
        uptime: 0,
        cpuUsage: 0
      }
    };
    
    this.requestTimings = [];
    this.slowQueries = [];
    this.errors = [];
    
    // Start periodic metrics collection
    if (this.enabled) {
      this.startMetricsCollection();
    }
  }

  /**
   * Track request timing
   * @param {string} path - Request path
   * @param {number} duration - Request duration in ms
   * @param {number} statusCode - HTTP status code
   */
  trackRequest(path, duration, statusCode) {
    if (!this.enabled) return;
    
    this.requestTimings.push({
      path,
      duration,
      statusCode,
      timestamp: Date.now()
    });
    
    this.metrics.requests.total++;
    if (statusCode >= 200 && statusCode < 300) {
      this.metrics.requests.success++;
    } else if (statusCode >= 400) {
      this.metrics.requests.errors++;
    }
    
    // Keep only last 1000 requests in memory
    if (this.requestTimings.length > 1000) {
      this.requestTimings.shift();
    }
  }

  /**
   * Track database query
   * @param {string} query - Query string
   * @param {number} duration - Query duration in ms
   */
  trackDatabaseQuery(query, duration) {
    if (!this.enabled) return;
    
    this.metrics.database.queries++;
    this.metrics.database.avgDuration = 
      (this.metrics.database.avgDuration * (this.metrics.database.queries - 1) + duration) / 
      this.metrics.database.queries;
    
    if (duration > 1000) {
      this.metrics.database.slowQueries++;
      this.slowQueries.push({
        query: query.substring(0, 100),
        duration,
        timestamp: Date.now()
      });
      
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }
  }

  /**
   * Track cache hit/miss
   * @param {boolean} isHit - True if cache hit
   */
  trackCacheAccess(isHit) {
    if (!this.enabled) return;
    
    if (isHit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = ((this.metrics.cache.hits / total) * 100).toFixed(2);
  }

  /**
   * Track errors
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  trackError(error, context = '') {
    if (!this.enabled) return;
    
    this.errors.push({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
    
    if (this.errors.length > 100) {
      this.errors.shift();
    }
  }

  /**
   * Collect memory and system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    };
    
    this.metrics.system.uptime = Math.floor(process.uptime());
    
    // CPU usage (rough estimate)
    const usage = process.cpuUsage();
    this.metrics.system.cpuUsage = 
      (usage.user + usage.system) / 1000000; // Convert to seconds
  }

  /**
   * Calculate response time percentiles
   */
  calculatePercentiles() {
    if (this.requestTimings.length === 0) return;
    
    const durations = this.requestTimings
      .map(r => r.duration)
      .sort((a, b) => a - b);
    
    const len = durations.length;
    this.metrics.requests.avgResponseTime = 
      Math.round(durations.reduce((a, b) => a + b) / len);
    
    this.metrics.requests.p50 = durations[Math.floor(len * 0.5)];
    this.metrics.requests.p95 = durations[Math.floor(len * 0.95)];
    this.metrics.requests.p99 = durations[Math.floor(len * 0.99)];
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
      this.calculatePercentiles();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Metrics:', JSON.stringify(this.metrics, null, 2));
      }
    }, this.metricsInterval);
  }

  /**
   * Get all metrics
   * @returns {object} Current metrics
   */
  getMetrics() {
    this.collectSystemMetrics();
    this.calculatePercentiles();
    
    return {
      metrics: this.metrics,
      recentErrors: this.errors.slice(-10),
      slowQueries: this.slowQueries.slice(-10),
      topEndpoints: this.getTopEndpoints()
    };
  }

  /**
   * Get top endpoints by request count
   * @returns {array} Top 10 endpoints
   */
  getTopEndpoints() {
    const endpointCounts = {};
    
    for (const req of this.requestTimings) {
      endpointCounts[req.path] = (endpointCounts[req.path] || 0) + 1;
    }
    
    return Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    const mem = this.metrics.memory;
    const memUsagePercent = (mem.heapUsed / mem.heapTotal) * 100;
    
    return {
      status: memUsagePercent > 90 ? 'warning' : 'healthy',
      uptime: this.metrics.system.uptime,
      memory: {
        used: `${mem.heapUsed}MB`,
        total: `${mem.heapTotal}MB`,
        percentage: memUsagePercent.toFixed(1)
      },
      requests: {
        total: this.metrics.requests.total,
        errorRate: ((this.metrics.requests.errors / this.metrics.requests.total) * 100).toFixed(2) + '%'
      },
      cache: {
        hitRate: this.metrics.cache.hitRate
      },
      database: {
        slowQueryCount: this.metrics.database.slowQueries
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.requestTimings = [];
    this.slowQueries = [];
    this.errors = [];
    this.metrics = {
      requests: { total: 0, success: 0, errors: 0, avgResponseTime: 0, p50: 0, p95: 0, p99: 0 },
      database: { queries: 0, avgDuration: 0, slowQueries: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
      system: { uptime: 0, cpuUsage: 0 }
    };
  }
}

/**
 * Express middleware for request timing
 */
function monitoringMiddleware(monitor) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Wrap res.send to capture response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      monitor.trackRequest(req.path, duration, res.statusCode);
      
      // Add timing header
      res.set('X-Response-Time', `${duration}ms`);
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

module.exports = {
  PerformanceMonitor,
  monitoringMiddleware
};

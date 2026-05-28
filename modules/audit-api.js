/**
 * Audit Log API Routes for BLUEORION QMS
 * RESTful endpoints for accessing, querying, and managing audit logs
 * Integrate into server-enhanced.js
 */

const AuditLogger = require('./audit-logger');
const AuditLogProcessor = require('./audit-log-processor');

const auditLogger = new AuditLogger();
const auditProcessor = new AuditLogProcessor();

/**
 * Setup audit log routes
 * @param {express.Application} app - Express app
 */
function setupAuditRoutes(app, options = {}) {
  const staffAuth = options.requireStaffAuth || requireStaffAuth;
  const adminAuth = options.requireAdmin || requireAdmin;
  
  /**
   * GET /api/audit/events
   * Retrieve recent audit events with optional filtering
   * Query params: ?user=charo&action=login&limit=50&offset=0
   */
  app.get('/api/audit/events', staffAuth, (req, res) => {
    try {
      const { user, action, category, severity, limit = 50, offset = 0 } = req.query;
      
      // Build filters
      const filters = {};
      if (user) filters.user = user;
      if (category) filters.category = category;
      if (severity) filters.severity = severity;
      if (action) filters.action = action;
      
      // Filter events
      let events = Object.keys(filters).length > 0 
        ? auditLogger.filterEvents(filters)
        : auditLogger.getRecentEvents();
      
      // Pagination
      const total = events.length;
      const paginatedEvents = events.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );
      
      res.json({
        success: true,
        data: paginatedEvents,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/events/search
   * Search audit events
   * Query params: ?q=login&limit=100
   */
  app.get('/api/audit/events/search', staffAuth, (req, res) => {
    try {
      const { q, limit = 100 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required'
        });
      }
      
      const results = auditLogger.search(q).slice(0, parseInt(limit));
      
      res.json({
        success: true,
        query: q,
        count: results.length,
        data: results
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/events/:id
   * Retrieve specific audit event details
   */
  app.get('/api/audit/events/:id', staffAuth, (req, res) => {
    try {
      const events = auditLogger.getRecentEvents();
      const event = events.find((_, idx) => idx.toString() === req.params.id);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }
      
      res.json({ success: true, data: event });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/stats
   * Get audit log statistics
   */
  app.get('/api/audit/stats', staffAuth, (req, res) => {
    try {
      const stats = auditLogger.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/users
   * Get list of active users in audit logs
   */
  app.get('/api/audit/users', staffAuth, (req, res) => {
    try {
      const stats = auditLogger.getStats();
      const users = Object.entries(stats.byUser)
        .sort((a, b) => b[1] - a[1])
        .map(([user, count]) => ({ user, count }));
      
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/audit/log
   * Manually log an event (admin only)
   * Body: { user, action, details }
   */
  app.post('/api/audit/log', adminAuth, (req, res) => {
    try {
      const { user, action, details } = req.body;
      
      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required'
        });
      }
      
      auditLogger.logEvent({
        user: user || req.user?.username || 'admin',
        action,
        details: details || {},
        ip: req.ip
      });
      
      res.json({ success: true, message: 'Event logged' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/audit/process
   * Process raw audit logs (admin only)
   * Body: { entries: [...] }
   */
  app.post('/api/audit/process', adminAuth, (req, res) => {
    try {
      const { entries } = req.body;
      
      if (!Array.isArray(entries)) {
        return res.status(400).json({
          success: false,
          error: 'Entries must be an array'
        });
      }
      
      const result = auditProcessor.processEntries(entries);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/export
   * Export audit logs
   * Query params: ?format=json&user=charo&category=AUTHENTICATION
   */
  app.get('/api/audit/export', adminAuth, (req, res) => {
    try {
      const { format = 'json', user, category, severity } = req.query;
      
      // Validate format
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: 'Format must be "json" or "csv"'
        });
      }
      
      // Build filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `./logs/audit-export-${timestamp}.${format === 'json' ? 'json' : 'csv'}`;
      
      // Build filters
      const filters = {};
      if (user) filters.user = user;
      if (category) filters.category = category;
      if (severity) filters.severity = severity;
      
      // Export
      const result = auditProcessor.exportLogs(format, filename);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }
      
      res.json({
        success: true,
        message: `Exported ${result.count} events`,
        filename: result.filename
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/audit/cleanup
   * Clean old audit logs (admin only)
   */
  app.delete('/api/audit/cleanup', adminAuth, (req, res) => {
    try {
      const result = auditLogger.cleanOldLogs();
      
      res.json({
        success: result.success,
        message: result.deleted ? `Deleted ${result.deleted} old log files` : 'No old logs to delete',
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/audit/health
   * Check audit logging health
   */
  app.get('/api/audit/health', (req, res) => {
    try {
      const stats = auditLogger.getStats();
      res.json({
        success: true,
        status: 'healthy',
        data: {
          eventsLogged: stats.total,
          errors: stats.errors,
          warnings: stats.warnings,
          bufferUtilization: `${((stats.bufferSize / stats.maxBufferSize) * 100).toFixed(2)}%`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  });
}

/**
 * Middleware: Require authenticated staff
 * (Replace with your actual auth implementation)
 */
function requireStaffAuth(req, res, next) {
  // This should check actual session
  const userRole = (req.headers['x-user-role'] || 'viewer').toLowerCase();
  if (userRole !== 'staff' && userRole !== 'admin' && userRole !== 'qmr') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
}

/**
 * Middleware: Require admin
 */
function requireAdmin(req, res, next) {
  const userRole = (req.headers['x-user-role'] || 'viewer').toLowerCase();
  if (userRole !== 'admin' && userRole !== 'qmr') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

module.exports = {
  setupAuditRoutes,
  auditLogger,
  auditProcessor
};

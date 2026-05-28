/**
 * Comprehensive Audit Logger for BLUEORION QMS
 * Handles event tracking, error logging, and compliance auditing
 * Phase 4: Infrastructure Enhancement
 */

const fs = require('fs');
const path = require('path');

class AuditLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || './logs';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.retentionDays = options.retentionDays || 90;
    
    this.ensureLogDir();
    
    // Event counters for statistics
    this.eventStats = {
      total: 0,
      byType: {},
      byUser: {},
      errors: 0,
      warnings: 0
    };
    
    // In-memory buffer for recent events
    this.eventBuffer = [];
    this.maxBufferSize = 1000;
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log an audit event
   * @param {object} event - Event object
   */
  logEvent(event) {
    // Validate and normalize event
    const normalizedEvent = this.normalizeEvent(event);
    
    // Update statistics
    this.updateStats(normalizedEvent);
    
    // Add to buffer
    this.eventBuffer.push(normalizedEvent);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }
    
    // Write to file
    this.writeToFile(normalizedEvent);
    
    // Check if rotation needed
    this.checkFileRotation();
  }

  /**
   * Normalize and validate event
   * @param {object} event - Raw event
   * @returns {object} Normalized event
   */
  normalizeEvent(event) {
    return {
      timestamp: event.timestamp || new Date().toISOString(),
      date: new Date(event.timestamp || Date.now()).toLocaleDateString('en-US'),
      time: new Date(event.timestamp || Date.now()).toLocaleTimeString('en-US'),
      user: event.user || event.username || 'unknown',
      action: event.action || event.type || 'unknown',
      category: this.categorizeAction(event.action || event.type),
      details: event.details || {},
      severity: this.determineSeverity(event),
      ip: event.ip || 'unknown',
      status: event.status || 'success'
    };
  }

  /**
   * Categorize action type
   * @param {string} action - Action name
   * @returns {string} Category
   */
  categorizeAction(action) {
    const action_lower = (action || '').toLowerCase();
    
    if (action_lower.includes('login') || action_lower.includes('auth')) return 'AUTHENTICATION';
    if (action_lower.includes('create') || action_lower.includes('submit')) return 'CREATE';
    if (action_lower.includes('update') || action_lower.includes('edit')) return 'UPDATE';
    if (action_lower.includes('delete') || action_lower.includes('remove')) return 'DELETE';
    if (action_lower.includes('error') || action_lower.includes('fail')) return 'ERROR';
    if (action_lower.includes('approve') || action_lower.includes('reject')) return 'APPROVAL';
    if (action_lower.includes('export') || action_lower.includes('download')) return 'EXPORT';
    if (action_lower.includes('access') || action_lower.includes('view')) return 'ACCESS';
    
    return 'OTHER';
  }

  /**
   * Determine event severity
   * @param {object} event - Event object
   * @returns {string} Severity level
   */
  determineSeverity(event) {
    const action = (event.action || event.type || '').toLowerCase();
    const status = (event.status || '').toLowerCase();
    
    // Critical events
    if (action.includes('delete') || action.includes('purge')) return 'CRITICAL';
    if (action.includes('failed') || status.includes('error')) return 'ERROR';
    if (action.includes('warning')) return 'WARNING';
    
    // Admin actions
    if (action.includes('admin') || action.includes('permission')) return 'IMPORTANT';
    
    // Default
    return 'INFO';
  }

  /**
   * Update event statistics
   * @param {object} event - Normalized event
   */
  updateStats(event) {
    this.eventStats.total++;
    
    // Count by type
    if (!this.eventStats.byType[event.category]) {
      this.eventStats.byType[event.category] = 0;
    }
    this.eventStats.byType[event.category]++;
    
    // Count by user
    if (!this.eventStats.byUser[event.user]) {
      this.eventStats.byUser[event.user] = 0;
    }
    this.eventStats.byUser[event.user]++;
    
    // Count errors/warnings
    if (event.severity === 'ERROR') this.eventStats.errors++;
    if (event.severity === 'WARNING') this.eventStats.warnings++;
  }

  /**
   * Write event to file
   * @param {object} event - Normalized event
   */
  writeToFile(event) {
    const today = new Date().toISOString().split('T')[0];
    const filename = path.join(this.logDir, `audit-${today}.log`);
    
    const logLine = [
      event.date,
      event.time,
      event.user,
      event.action,
      JSON.stringify(event.details),
      event.severity,
      event.ip
    ].join('\t');
    
    try {
      fs.appendFileSync(filename, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Error writing audit log:', error.message);
    }
  }

  /**
   * Check if log file rotation is needed
   */
  checkFileRotation() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = path.join(this.logDir, `audit-${today}.log`);
      
      if (fs.existsSync(filename)) {
        const stats = fs.statSync(filename);
        if (stats.size > this.maxFileSize) {
          const backup = filename.replace('.log', `-${Date.now()}.log.bak`);
          fs.renameSync(filename, backup);
        }
      }
    } catch (error) {
      console.warn('Log rotation check failed:', error.message);
    }
  }

  /**
   * Get recent events from buffer
   * @param {number} count - Number of recent events
   * @returns {array} Recent events
   */
  getRecentEvents(count = 100) {
    return this.eventBuffer.slice(-count);
  }

  /**
   * Filter events by criteria
   * @param {object} filters - Filter criteria
   * @returns {array} Filtered events
   */
  filterEvents(filters) {
    return this.eventBuffer.filter(event => {
      if (filters.user && event.user !== filters.user) return false;
      if (filters.category && event.category !== filters.category) return false;
      if (filters.severity && event.severity !== filters.severity) return false;
      if (filters.action && !event.action.includes(filters.action)) return false;
      return true;
    });
  }

  /**
   * Get audit statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.eventStats,
      bufferSize: this.eventBuffer.length,
      maxBufferSize: this.maxBufferSize
    };
  }

  /**
   * Search audit logs
   * @param {string} query - Search query
   * @returns {array} Matching events
   */
  search(query) {
    const q = query.toLowerCase();
    return this.eventBuffer.filter(event =>
      event.user.toLowerCase().includes(q) ||
      event.action.toLowerCase().includes(q) ||
      JSON.stringify(event.details).toLowerCase().includes(q)
    );
  }

  /**
   * Export logs to JSON
   * @param {string} filename - Output filename
   * @param {object} filters - Optional filters
   */
  exportJSON(filename, filters = {}) {
    const events = filters && Object.keys(filters).length > 0 
      ? this.filterEvents(filters)
      : this.eventBuffer;
    
    try {
      fs.writeFileSync(filename, JSON.stringify(events, null, 2), 'utf8');
      return { success: true, count: events.length, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export logs to CSV
   * @param {string} filename - Output filename
   * @param {object} filters - Optional filters
   */
  exportCSV(filename, filters = {}) {
    const events = filters && Object.keys(filters).length > 0
      ? this.filterEvents(filters)
      : this.eventBuffer;
    
    try {
      const header = 'Timestamp,User,Action,Category,Severity,IP,Details\n';
      const rows = events.map(e =>
        `"${e.timestamp}","${e.user}","${e.action}","${e.category}","${e.severity}","${e.ip}","${JSON.stringify(e.details).replace(/"/g, '""')}"`
      ).join('\n');
      
      fs.writeFileSync(filename, header + rows, 'utf8');
      return { success: true, count: events.length, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean old logs based on retention policy
   */
  cleanOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const files = fs.readdirSync(this.logDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('audit-')) {
          const filepath = path.join(this.logDir, file);
          const stats = fs.statSync(filepath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }
      }
      
      return { success: true, deleted: deletedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = AuditLogger;

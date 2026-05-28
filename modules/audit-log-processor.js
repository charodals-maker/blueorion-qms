/**
 * Audit Log Processor for BLUEORION QMS
 * Processes, validates, and fixes audit log entries
 * Handles error detection and correction
 */

const AuditLogger = require('./audit-logger');

class AuditLogProcessor {
  constructor() {
    this.logger = new AuditLogger({
      logDir: './logs',
      maxFileSize: 10 * 1024 * 1024,
      retentionDays: 90
    });
    
    this.errorLog = [];
    this.processedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Parse raw log entry
   * @param {string} logEntry - Raw log entry string
   * @returns {object|null} Parsed entry or null if invalid
   */
  parseLogEntry(logEntry) {
    try {
      // Expected format: DATE\tTIME\tUSER\tACTION\tJSON_DETAILS
      const parts = logEntry.trim().split('\t');
      
      if (parts.length < 4) {
        return null; // Invalid format
      }
      
      const [date, time, user, action, ...detailsParts] = parts;
      let details = {};
      
      // Try to parse JSON details
      if (detailsParts.length > 0) {
        const detailsStr = detailsParts.join('\t');
        try {
          details = JSON.parse(detailsStr);
        } catch (e) {
          details = { raw: detailsStr };
        }
      }
      
      return {
        date,
        time,
        user: user || 'unknown',
        action: action || 'unknown',
        details
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate log entry
   * @param {object} entry - Parsed log entry
   * @returns {object} Validation result
   */
  validateEntry(entry) {
    const errors = [];
    const warnings = [];
    
    // Validate required fields
    if (!entry.user || entry.user === 'unknown') {
      warnings.push('User not identified');
    }
    
    if (!entry.action || entry.action === 'unknown') {
      errors.push('Missing action');
    }
    
    // Validate date format
    if (!this.isValidDate(entry.date)) {
      errors.push(`Invalid date format: ${entry.date}`);
    }
    
    // Validate time format
    if (!this.isValidTime(entry.time)) {
      errors.push(`Invalid time format: ${entry.time}`);
    }
    
    // Check for suspicious patterns
    if (entry.details && entry.details.ip) {
      const ips = entry.details.ip.split(',').map(ip => ip.trim());
      if (ips.length > 3) {
        warnings.push('Multiple IP addresses detected (possible proxy chain)');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      severity: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARNING' : 'OK')
    };
  }

  /**
   * Check if valid date format (M/D/YYYY)
   * @param {string} dateStr - Date string
   * @returns {boolean}
   */
  isValidDate(dateStr) {
    const regex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;
    
    const [month, day, year] = dateStr.split('/').map(Number);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000;
  }

  /**
   * Check if valid time format (H:MM:SS AM/PM)
   * @param {string} timeStr - Time string
   * @returns {boolean}
   */
  isValidTime(timeStr) {
    const regex = /^\d{1,2}:\d{2}:\d{2}\s(AM|PM)$/i;
    return regex.test(timeStr);
  }

  /**
   * Fix common log errors
   * @param {object} entry - Log entry
   * @returns {object} Fixed entry
   */
  fixErrors(entry) {
    const fixed = { ...entry };
    
    // Fix unknown user
    if (!fixed.user || fixed.user === 'unknown') {
      if (fixed.details && fixed.details.username) {
        fixed.user = fixed.details.username;
      }
    }
    
    // Fix missing action
    if (!fixed.action || fixed.action === 'unknown') {
      if (fixed.details && fixed.details.action) {
        fixed.action = fixed.details.action;
      } else {
        fixed.action = 'system-event';
      }
    }
    
    // Normalize date format
    if (fixed.date && !this.isValidDate(fixed.date)) {
      const dateObj = new Date(fixed.date);
      if (!isNaN(dateObj.getTime())) {
        fixed.date = (dateObj.getMonth() + 1) + '/' + dateObj.getDate() + '/' + dateObj.getFullYear();
      }
    }
    
    // Normalize time format
    if (fixed.time && !this.isValidTime(fixed.time)) {
      const timeObj = new Date(`${fixed.date} ${fixed.time}`);
      if (!isNaN(timeObj.getTime())) {
        fixed.time = timeObj.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    }
    
    return fixed;
  }

  /**
   * Process multiple log entries
   * @param {array} entries - Array of raw log strings or objects
   * @returns {object} Processing result
   */
  processEntries(entries) {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      warnings: 0,
      fixedErrors: 0,
      details: []
    };
    
    for (const entry of entries) {
      try {
        this.processedCount++;
        
        // Parse entry
        let parsed = typeof entry === 'string' ? this.parseLogEntry(entry) : entry;
        
        if (!parsed) {
          results.failed++;
          results.details.push({
            index: this.processedCount,
            status: 'PARSE_ERROR',
            entry: entry
          });
          continue;
        }
        
        // Validate entry
        const validation = this.validateEntry(parsed);
        
        if (!validation.valid) {
          // Try to fix errors
          parsed = this.fixErrors(parsed);
          results.fixedErrors++;
          
          // Re-validate
          const revalidation = this.validateEntry(parsed);
          if (!revalidation.valid) {
            results.failed++;
            results.details.push({
              index: this.processedCount,
              status: 'VALIDATION_FAILED',
              errors: revalidation.errors,
              entry: parsed
            });
            continue;
          }
        }
        
        if (validation.warnings.length > 0) {
          results.warnings++;
        }
        
        // Log the entry
        this.logger.logEvent(parsed);
        results.successful++;
        
      } catch (error) {
        this.errorCount++;
        results.failed++;
        results.details.push({
          index: this.processedCount,
          status: 'PROCESSING_ERROR',
          error: error.message,
          entry
        });
      }
    }
    
    return results;
  }

  /**
   * Get processing statistics
   * @returns {object} Stats
   */
  getStats() {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      auditStats: this.logger.getStats()
    };
  }

  /**
   * Get error report
   * @returns {object} Error report
   */
  getErrorReport() {
    return {
      totalErrors: this.errorCount,
      recentErrors: this.errorLog.slice(-50)
    };
  }

  /**
   * Export processed logs
   * @param {string} format - 'json' or 'csv'
   * @param {string} filename - Output filename
   */
  exportLogs(format = 'json', filename) {
    if (format === 'json') {
      return this.logger.exportJSON(filename);
    } else if (format === 'csv') {
      return this.logger.exportCSV(filename);
    }
    return { success: false, error: 'Invalid format' };
  }

  /**
   * Get audit logger instance
   * @returns {AuditLogger}
   */
  getLogger() {
    return this.logger;
  }
}

module.exports = AuditLogProcessor;

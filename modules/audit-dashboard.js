/**
 * Audit Dashboard Server Integration
 * Add these routes to server-enhanced.js to serve the audit dashboard
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

function passThroughAuth(req, res, next) {
  next();
}

function loadAuditLogs() {
  const filePath = path.join(__dirname, '..', 'data', 'audit_logs.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Merge live in-memory logs with persisted disk entries.
 * Deduplicates by id (when present) or by timestamp+user+action composite key.
 * Returns newest-first.
 * @param {Array|null} liveLogsRef - reference to server's in-memory auditLogs array
 */
function getMergedLogs(liveLogsRef) {
  const disk = loadAuditLogs();
  const live = Array.isArray(liveLogsRef) ? liveLogsRef.slice() : [];

  // Build a dedup map: prefer live entries (they are the source of truth)
  const seen = new Map();
  const key = e => e.id || `${e.timestamp}|${e.user}|${e.action}`;

  for (const e of disk) seen.set(key(e), e);
  for (const e of live) seen.set(key(e), e); // live overwrites disk duplicates

  return [...seen.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function normalizeEvent(entry) {
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  return {
    id: entry.id || null,
    timestamp: entry.timestamp || new Date().toISOString(),
    user: entry.user || 'unknown',
    action: entry.action || 'unknown-action',
    severity: (entry.severity || 'INFO').toUpperCase(),
    category: entry.category || 'SYSTEM',
    ip: entry.ip || null,
    details
  };
}

function calculateStats(logs) {
  return {
    total: logs.length,
    applications: logs.filter(l => {
      const a = (l.action || '').toLowerCase();
      return a.includes('application') || a.includes('applicant');
    }).length,
    logins: logs.filter(l => (l.action || '').toLowerCase().includes('login')).length,
    warnings: logs.filter(l => (l.severity || '').toUpperCase() === 'WARNING').length,
    errors: logs.filter(l => (l.severity || '').toUpperCase() === 'ERROR').length,
    byCategory: logs.reduce((acc, l) => {
      const cat = l.category || 'SYSTEM';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {}),
    uniqueUsers: [...new Set(logs.map(l => l.user).filter(u => u && u !== 'unknown'))].length
  };
}

function applyFilters(logs, filters = {}) {
  const { user, action, severity, search } = filters;
  let filteredLogs = [...logs];

  if (user) {
    const u = String(user).toLowerCase();
    filteredLogs = filteredLogs.filter(log => String(log.user).toLowerCase().includes(u));
  }

  if (action) {
    const a = String(action).toLowerCase();
    filteredLogs = filteredLogs.filter(log => String(log.action).toLowerCase().includes(a));
  }

  if (severity) {
    const s = String(severity).toUpperCase();
    filteredLogs = filteredLogs.filter(log => String(log.severity).toUpperCase() === s);
  }

  if (search) {
    const q = String(search).toLowerCase();
    filteredLogs = filteredLogs.filter(log => {
      const detailsText = JSON.stringify(log.details || {}).toLowerCase();
      return (
        String(log.user).toLowerCase().includes(q) ||
        String(log.action).toLowerCase().includes(q) ||
        String(log.severity).toLowerCase().includes(q) ||
        detailsText.includes(q)
      );
    });
  }

  filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return filteredLogs;
}

function toCsv(logs) {
  const headers = ['id', 'timestamp', 'user', 'action', 'severity', 'details'];
  const rows = logs.map(log => [
    log.id || '',
    log.timestamp || '',
    log.user || '',
    log.action || '',
    log.severity || '',
    JSON.stringify(log.details || {})
  ]);

  const encode = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [headers, ...rows].map(row => row.map(encode).join(',')).join('\n');
}

/**
 * Setup audit dashboard routes
 * @param {express.Application} app - Express app
 */
function setupAuditDashboard(app, options = {}) {
  const staffAuth = options.requireStaffAuth || passThroughAuth;
  // Live reference to server's in-memory auditLogs array (passed from server-enhanced.js)
  const liveLogsRef = options.liveLogsRef || null;

  /**
   * GET /audit-dashboard
   * Serve interactive audit log dashboard
   */
  app.get('/audit-dashboard', staffAuth, (req, res) => {
    const dashboardPath = path.join(__dirname, '..', 'audit-dashboard.html');
    res.sendFile(dashboardPath);
  });

  /**
   * GET /api/audit/dashboard/data
   * Get audit log data in JSON format for dashboard (merged live + disk)
   */
  app.get('/api/audit/dashboard/data', staffAuth, (req, res) => {
    try {
      const { user, action, severity, limit = 1000, search } = req.query;
      const maxLimit = Math.min(parseInt(limit, 10) || 1000, 5000);

      const merged = getMergedLogs(liveLogsRef).map(normalizeEvent);
      const filteredLogs = applyFilters(merged, { user, action, severity, search });

      const data = {
        logs: filteredLogs.slice(0, maxLimit),
        stats: calculateStats(filteredLogs),
        recentActivity: filteredLogs.slice(0, 20),
        pagination: {
          limit: maxLimit,
          total: filteredLogs.length,
          returned: Math.min(filteredLogs.length, maxLimit)
        }
      };

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/audit/dashboard/export
   * Export merged audit logs from dashboard
   * Body: { format: 'json' | 'csv', filters: {...} }
   */
  app.post('/api/audit/dashboard/export', staffAuth, (req, res) => {
    try {
      const { format = 'json', filters = {} } = req.body;
      const normalizedFormat = String(format).toLowerCase();
      const merged = getMergedLogs(liveLogsRef).map(normalizeEvent);
      const filteredLogs = applyFilters(merged, filters);

      if (normalizedFormat === 'csv') {
        const csv = toCsv(filteredLogs);
        const filename = `audit-logs-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.status(200).send(csv);
      }

      const filename = `audit-logs-${Date.now()}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.status(200).send(JSON.stringify(filteredLogs, null, 2));
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = { setupAuditDashboard };

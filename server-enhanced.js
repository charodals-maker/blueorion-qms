// ============================================================================
// BLUEORION QMS SERVER - ENHANCED FOR PUBLIC RELEASE
// Production-ready with comprehensive error handling, validation, and documentation
// ============================================================================

// 1. REQUIRE ALL MODULES
const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const archiver = require('archiver');
const multer = require('multer');
const crypto = require('crypto');
const cors = require('cors');
const auditModule = require('./modules/audit-improvement');

let setupEnhancements = null;
let setupAuditRoutes = null;
let setupAuditDashboard = null;

try {
  ({ setupEnhancements } = require('./modules/enhancements'));
} catch (error) {
  console.warn('[enhancements] skipped:', error.message);
}

try {
  ({ setupAuditRoutes } = require('./modules/audit-api'));
} catch (error) {
  console.warn('[audit-api] skipped:', error.message);
}

try {
  ({ setupAuditDashboard } = require('./modules/audit-dashboard'));
} catch (error) {
  console.warn('[audit-dashboard] skipped:', error.message);
}

// 2. INITIALIZE EXPRESS APP
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 3. HELPER FUNCTIONS & UTILITIES
/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and message
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain number' };
  }
  return { isValid: true, message: 'Password is valid' };
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim();
}

/**
 * Count files in a directory
 * @param {string} folder - Folder path
 * @returns {number} File count
 */
function countFiles(folder) {
  const dirPath = path.join(__dirname, folder);
  if (!fs.existsSync(dirPath)) return 0;
  try {
    return fs.readdirSync(dirPath).length;
  } catch {
    return 0;
  }
}

/**
 * Get user role from request
 * @param {object} req - Express request
 * @returns {string} User role
 */
function getUserRole(req) {
  if (req && req.user && req.user.role) return req.user.role.toLowerCase();
  const headerRole = req && req.headers ? req.headers['x-user-role'] : '';
  const queryRole = req && req.query ? req.query.role : '';
  return String(headerRole || queryRole || 'viewer').toLowerCase();
}

/**
 * Parse cookies from request header
 * @param {object} req - Express request
 * @returns {object} Parsed cookies
 */
function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};
  return raw.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    acc[key] = val;
    return acc;
  }, {});
}

/**
 * Get auth token from Authorization header or session cookie
 * @param {object} req - Express request
 * @returns {string|null} Token
 */
function getAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookies = parseCookies(req);
  if (cookies.blueorion_session) return cookies.blueorion_session;
  if (typeof req.query.token === 'string' && req.query.token.trim()) return req.query.token.trim();
  return null;
}

/**
 * Create in-memory login session
 * @param {object} user - Authenticated user
 * @param {object} req - Express request
 * @returns {string} Session token
 */
function createSession(user, req) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    username: user.username,
    role: user.role,
    ip: req.ip || 'unknown',
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  persistSessions();
  return token;
}

/**
 * Resolve and validate active session from request
 * @param {object} req - Express request
 * @returns {object|null} Session object
 */
function getSession(req) {
  const token = getAuthToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

/**
 * Set secure session cookie
 * @param {object} res - Express response
 * @param {string} token - Session token
 */
function setSessionCookie(res, token) {
  const secureFlag = NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `blueorion_session=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax${secureFlag}`);
}

/**
 * Clear session cookie
 * @param {object} res - Express response
 */
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'blueorion_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

/**
 * Middleware: Require authenticated staff/admin session
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next
 */
function requireStaffAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    const accept = req.headers.accept || '';
    const fetchDest = req.headers['sec-fetch-dest'] || '';
    const isApi = req.path.startsWith('/api/');
    const originalPath = String(req.originalUrl || req.path || '').toLowerCase();
    const isAuthPageRequest = originalPath.startsWith('/login.html') || originalPath.startsWith('/session-login');
    const isBrowserNavigation = accept.includes('text/html') || fetchDest === 'document';
    if (!isApi && isBrowserNavigation && !isAuthPageRequest) {
      const nextUrl = encodeURIComponent(req.originalUrl || '/dashboard');
      return res.redirect(`/login.html?next=${nextUrl}`);
    }
    return sendError(res, 401, 'UNAUTHORIZED', 'Login required');
  }
  if (session.role === 'applicant') {
    return sendError(res, 403, 'FORBIDDEN', 'Access denied: staff/admin only');
  }
  req.user = { username: session.username, role: session.role };
  next();
}

/**
 * Middleware: Require specific role
 * @param {string} role - Required role
 * @returns {function} Express middleware
 */
function requireRole(role) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Login required');
    }
    req.user = { username: session.username, role: session.role };
    if (getUserRole(req) !== role) {
      return sendError(res, 403, 'FORBIDDEN', 'Access denied: insufficient permissions');
    }
    next();
  };
}

/**
 * Middleware: Require admin-level role (president or qmr ONLY)
 */
function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    const accept = req.headers.accept || '';
    const fetchDest = req.headers['sec-fetch-dest'] || '';
    const originalPath = String(req.originalUrl || req.path || '').toLowerCase();
    const isAuthPageRequest = originalPath.startsWith('/login.html') || originalPath.startsWith('/session-login');
    const isApi = req.path.startsWith('/api/');
    const isBrowserNavigation = accept.includes('text/html') || fetchDest === 'document';
    if (!isApi && isBrowserNavigation && !isAuthPageRequest) {
      const nextUrl = encodeURIComponent(req.originalUrl || '/admin-monitoring');
      return res.redirect(`/login.html?next=${nextUrl}`);
    }
    return sendError(res, 401, 'UNAUTHORIZED', 'Login required');
  }
  req.user = { username: session.username, role: session.role };
  const adminRoles = ['president', 'qmr'];
  if (!adminRoles.includes((session.role || '').toLowerCase())) {
    if (!req.path.startsWith('/api/')) return res.redirect('/qms-dashboard');
    return sendError(res, 403, 'FORBIDDEN', 'Access denied: admin only (president or qmr)');
  }
  next();
}

const ADMIN_DELETE_SECRET_CODE = process.env.ADMIN_DELETE_SECRET_CODE || '027679';
const OWNER_PRIVATE_USERNAMES = String(process.env.OWNER_PRIVATE_USERNAMES || 'charo,president.blueorion')
  .split(',')
  .map(v => v.trim().toLowerCase())
  .filter(Boolean);

function getDeleteCode(req) {
  if (req && req.headers && req.headers['x-admin-delete-code']) return String(req.headers['x-admin-delete-code']).trim();
  if (req && req.body && req.body.deleteCode) return String(req.body.deleteCode).trim();
  if (req && req.query && req.query.deleteCode) return String(req.query.deleteCode).trim();
  return '';
}

function requireAdminDeleteCode(req, res, next) {
  const session = getSession(req);
  if (!session) return sendError(res, 401, 'UNAUTHORIZED', 'Login required');
  req.user = { username: session.username, role: session.role };
  const deleteRoles = ['president', 'qmr', 'admin'];
  if (!deleteRoles.includes((session.role || '').toLowerCase())) {
    return sendError(res, 403, 'FORBIDDEN', 'Only admin can delete records. Ask admin to enter the secret code.');
  }
  const code = getDeleteCode(req);
  if (!code) {
    return sendError(res, 400, 'DELETE_CODE_REQUIRED', 'Admin secret code is required before deleting.');
  }
  if (code !== ADMIN_DELETE_SECRET_CODE) {
    logAudit('delete-code-invalid', { path: req.path, username: session.username }, req);
    return sendError(res, 403, 'INVALID_DELETE_CODE', 'Invalid admin secret code.');
  }
  next();
}

function requireOwnerOnly(req, res, next) {
  const session = getSession(req);
  if (!session) {
    const accept = req.headers.accept || '';
    const fetchDest = req.headers['sec-fetch-dest'] || '';
    const isApi = req.path.startsWith('/api/');
    const isBrowserNavigation = accept.includes('text/html') || fetchDest === 'document';
    if (!isApi && isBrowserNavigation) {
      const nextUrl = encodeURIComponent(req.originalUrl || '/admin/private-finance');
      return res.redirect(`/login.html?next=${nextUrl}`);
    }
    return sendError(res, 401, 'UNAUTHORIZED', 'Login required');
  }

  req.user = { username: session.username, role: session.role };
  const normalized = String(session.username || '').toLowerCase();
  if (!OWNER_PRIVATE_USERNAMES.includes(normalized)) {
    if (!req.path.startsWith('/api/')) return res.redirect('/admin');
    return sendError(res, 403, 'FORBIDDEN', 'Access denied: owner-only module');
  }
  next();
}

function canAccessAgentName(req) {
  const adminRoles = ['president', 'qmr'];
  return adminRoles.includes(getUserRole(req || {}));
}

function stripAgentName(record, req) {
  if (canAccessAgentName(req) || !record || typeof record !== 'object') return record;
  const sanitized = { ...record };
  delete sanitized.agentName;
  return sanitized;
}

function stripAgentNameFromList(records, req) {
  if (canAccessAgentName(req) || !Array.isArray(records)) return records;
  return records.map(record => stripAgentName(record, req));
}

function sanitizeAgentNameForWrite(record, req) {
  if (!record || typeof record !== 'object') return record;
  if (canAccessAgentName(req)) return record;
  const sanitized = { ...record };
  delete sanitized.agentName;
  return sanitized;
}

/**
 * Log audit event
 * @param {string} action - Action name
 * @param {object} details - Action details
 * @param {object} req - Express request
 */
const AUDIT_IGNORED_ACTIONS = new Set([
  'list-documents',
  'list-complaints',
  'list-applicants',
  'view-audit-logs'
]);

// Debounce timer for audit log disk persistence
let _auditSaveTimer = null;
function _scheduleAuditSave() {
  if (_auditSaveTimer) clearTimeout(_auditSaveTimer);
  _auditSaveTimer = setTimeout(() => {
    // Persist only the most recent 1000 entries to keep file size manageable
    saveStore('audit_logs.json', auditLogs.slice(-1000));
    _auditSaveTimer = null;
  }, 2000);
}

function _auditSeverity(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('fail') || a.includes('error') || a.includes('lockout') || a.includes('locked')) return 'ERROR';
  if (a.includes('delete') || a.includes('reject') || a.includes('warning') || a.includes('duplicate')) return 'WARNING';
  return 'INFO';
}

function _auditCategory(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('login') || a.includes('logout') || a.includes('auth') || a.includes('session')) return 'AUTHENTICATION';
  if (a.includes('upload') || a.includes('submit') || a.includes('create') || a.includes('applied') || a.includes('applicant') || a.includes('application') || a.includes('register')) return 'CREATE';
  if (a.includes('update') || a.includes('edit') || a.includes('status') || a.includes('review') || a.includes('approve')) return 'UPDATE';
  if (a.includes('delete') || a.includes('remove') || a.includes('purge')) return 'DELETE';
  if (a.includes('export') || a.includes('download') || a.includes('report')) return 'EXPORT';
  return 'SYSTEM';
}

function logAudit(action, details, req) {
  if (AUDIT_IGNORED_ACTIONS.has(action)) {
    return;
  }

  // Resolve real username: prefer details.username, request user, then active session, then header.
  let user = 'unknown';
  if (details && details.username) {
    user = details.username;
  } else if (req && req.user && req.user.username) {
    user = req.user.username;
  } else if (req) {
    const session = getSession(req);
    if (session && session.username) user = session.username;
  } else if (req && req.headers && req.headers['x-user']) {
    user = req.headers['x-user'];
  }

  // Clean IP (first hop only — handles proxy chains transparently)
  const rawIp = (req?.headers?.['x-forwarded-for'] || req?.ip || 'unknown').toString();
  const ip = rawIp.split(',')[0].trim();

  const entry = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    timestamp: new Date().toISOString(),
    user,
    action,
    severity: _auditSeverity(action),
    category: _auditCategory(action),
    details: details || {},
    ip
  };

  auditLogs.push(entry);

  // Cap in-memory log at 5000 entries to prevent memory growth
  if (auditLogs.length > 5000) {
    auditLogs.splice(0, auditLogs.length - 5000);
  }

  // Persist to disk (debounced 2s to batch rapid events)
  _scheduleAuditSave();
}

/**
 * Add system notification
 * @param {string} type - Notification type
 * @param {string} message - Notification message
 */
function addNotification(type, message) {
  notifications.push({
    id: (Date.now() + '-' + Math.floor(Math.random() * 10000)).toString(),
    timestamp: Date.now(),
    type,
    message,
    read: false
  });
}

/**
 * Standardized success response
 * @param {object} res - Express response
 * @param {number} status - HTTP status code
 * @param {object} data - Response data
 * @param {string} message - Success message
 */
function sendSuccess(res, status = 200, data = null, message = 'Success') {
  res.status(status).json({
    success: true,
    status,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Standardized error response
 * @param {object} res - Express response
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {object} details - Additional details
 */
function sendError(res, status = 500, code = 'INTERNAL_ERROR', message = 'An error occurred', details = null) {
  res.status(status).json({
    success: false,
    status,
    error: { code, message, details },
    timestamp: new Date().toISOString()
  });
}

/**
 * Get system statistics
 * @returns {object} System stats
 */
function getSystemStats() {
  return {
    qmsDocsCount: qmsDocs.length,
    welfareComplaintsCount: welfareComplaints.length,
    applicantFormsCount: applicantForms.length,
    documentsFolder: countFiles('Documents'),
    welfareFolder: countFiles('Welfare'),
    vouchersFolder: countFiles('Vouchers'),
    hiredWorkers: 1245,
    unreadNotifications: notifications.filter(n => !n.read).length,
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV
  };
}

/**
 * Save data to Excel file
 * @param {string} filePath - File path
 * @param {object} data - Data to save
 * @param {string} sheetName - Sheet name
 * @returns {boolean} Success status
 */
function saveToExcel(filePath, data, sheetName = 'Data') {
  try {
    let wb, ws;
    if (fs.existsSync(filePath)) {
      wb = XLSX.readFile(filePath);
      ws = wb.Sheets[wb.SheetNames[0]];
      let existingData = XLSX.utils.sheet_to_json(ws);
      existingData.push(data);
      ws = XLSX.utils.json_to_sheet(existingData);
      wb.Sheets[wb.SheetNames[0]] = ws;
    } else {
      wb = XLSX.utils.book_new();
      ws = XLSX.utils.json_to_sheet([data]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, filePath);
    return true;
  } catch (err) {
    console.error('Excel save error:', err);
    return false;
  }
}

// 4. GLOBAL CONSTANTS & DATA STORAGE
const qmsFolders = ['Welfare', 'Sourcing', 'Complaints', 'Management', 'Resources', 'Audit', 'Documents', 'Vouchers', 'Profiles', 'Selection', 'Contracts', 'FRA_System'];
const qmsDocsDir = path.join(__dirname, 'uploads', 'qms_docs');
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

if (!fs.existsSync(qmsDocsDir)) fs.mkdirSync(qmsDocsDir, { recursive: true });

// ── PERSISTENT JSON STORAGE ──────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadStore(filename, fallback = []) {
  const file = path.join(dataDir, filename);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('loadStore error', filename, e.message); }
  return fallback;
}

function loadArrayStore(filename, fallback = []) {
  const data = loadStore(filename, fallback);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.complaints)) return data.complaints;
  if (Array.isArray(data?.data?.complaints)) return data.data.complaints;
  console.error('loadArrayStore invalid array payload', filename);
  return Array.isArray(fallback) ? fallback : [];
}

function saveStore(filename, data) {
  try {
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.error('saveStore error', filename, e.message); }
}

let qmsDocs = loadStore('qms_docs.json');
let welfareComplaints = loadStore('welfare_complaints.json');
let welfareWorkers = loadStore('welfare_workers.json', [
  { id: 'WKR-001', name: 'Maria Santos', status: 'active', lastCheckin: '2026-04-10', country: 'Saudi Arabia' },
  { id: 'WKR-002', name: 'Juan Dela Cruz', status: 'inactive', lastCheckin: '2026-03-28', country: 'Qatar' }
]);
let welfareWorkerLogs = loadStore('welfare_worker_logs.json', [
  '2026-04-10: Maria Santos checked in from Saudi Arabia.',
  '2026-03-28: Juan Dela Cruz missed check-in.'
]);
let applicantForms = loadStore('applicant_forms.json');

let fraWorkers = loadStore('fra_workers.json');
let auditLogs = loadStore('audit_logs.json');
let sourcingLeads = loadStore('sourcing_leads.json');
let staffPerformance = loadStore('staff_performance.json');
let competenceNotes = loadStore('competence_notes.json');
let foundationTracker = loadStore('foundation_tracker.json', {});
let expenses = loadStore('expenses.json');
let ofwWorkers = loadStore('ofw_workers.json');
let ofwComplaints = loadArrayStore('ofw_complaints.json');
let interestedApplicants = loadStore('interested_applicants.json');
let marketingAgents = loadStore('marketing_agents.json', [
  { agentId: 'AGT-001', name: 'Blueorion Field Team A', status: 'active' },
  { agentId: 'AGT-002', name: 'Blueorion Field Team B', status: 'active' }
]);
let auditImprovementItems = loadStore('audit_improvement_items.json');
let privateFinanceRecords = loadStore('private_applicant_finance.json', []);

const sessions = new Map();
// Load persisted sessions from disk (survive server restarts)
(function loadPersistedSessions() {
  try {
    const file = path.join(dataDir, 'sessions.json');
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const now = Date.now();
      let loaded = 0;
      for (const [token, sess] of Object.entries(raw)) {
        if (sess.expiresAt > now) { sessions.set(token, sess); loaded++; }
      }
      if (loaded) console.log(`[Sessions] Restored ${loaded} active sessions from disk.`);
    }
  } catch (e) { console.error('[Sessions] Failed to load persisted sessions:', e.message); }
})();
function persistSessions() {
  try {
    const now = Date.now();
    const obj = {};
    for (const [token, sess] of sessions.entries()) {
      if (sess.expiresAt > now) obj[token] = sess;
    }
    fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(obj), 'utf8');
  } catch (e) { /* non-critical */ }
}
// Prune expired sessions every 30 minutes and persist
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of sessions.entries()) {
    if (sess.expiresAt <= now) sessions.delete(token);
  }
  persistSessions();
}, 30 * 60 * 1000);
let notifications = [{
  id: '0',
  timestamp: Date.now(),
  type: 'info',
  message: 'QMS System initialized',
  read: false
}];
let loginAttempts = {};

// ── SERVER ERROR TRACKING MODULE ─────────────────────────────────────────────
// Tracks runtime errors for visibility in the admin dashboard error monitor
const SERVER_ERRORS_MAX = 200;
let serverErrors = [];

/**
 * Log a server-side runtime error to the in-memory error store.
 * @param {Error|string} err - The error object or message
 * @param {string} context   - Where the error occurred (route, function name, etc.)
 * @param {object} [req]     - Express request (optional, for IP/path)
 */
function logServerError(err, context, req) {
  const entry = {
    id: `ERR-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    timestamp: new Date().toISOString(),
    context: String(context || 'unknown').slice(0, 120),
    message: err instanceof Error ? err.message : String(err || 'Unknown error'),
    stack: err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 5).join(' | ') : null,
    path: req ? (req.method + ' ' + req.originalUrl) : null,
    ip: req ? String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() : null
  };
  serverErrors.push(entry);
  if (serverErrors.length > SERVER_ERRORS_MAX) {
    serverErrors.splice(0, serverErrors.length - SERVER_ERRORS_MAX);
  }
  console.error(`[ServerError][${entry.context}] ${entry.message}`);
}

const users = [
  { username: 'finance.accounting', password: hashPassword('Blue@Accounting2026'), role: 'accounting' },
  { username: 'blueorion.sg', password: hashPassword('Blue@2026!S'), role: 'document_controller' },
  { username: 'charo', password: hashPassword('president2026'), role: 'president' },
  { username: 'president.blueorion', password: hashPassword('Blue@President2026'), role: 'president' },
  { username: 'manager.operations', password: hashPassword('Blue@Manager2026'), role: 'manager' },
  { username: 'blueorion_staff01', password: hashPassword('BlueorionStart2026!'), role: 'encoder' },
  { username: 'welfare.officer', password: hashPassword('Blue@Welfare2026'), role: 'welfare_officer' },
  // QMR — Lyndie B. Jamias
  { username: 'lyndie', password: hashPassword('Blue@QMR2026'), role: 'qmr' },
  { username: 'lyndie.jamias', password: hashPassword('Blue@QMR2026'), role: 'qmr' },
  // Document Controller — Genevieve B. Caro
  { username: 'genevieve', password: hashPassword('Blue@DocCtrl2026'), role: 'document_controller' },
  { username: 'genevieve.caro', password: hashPassword('Blue@DocCtrl2026'), role: 'document_controller' },
  // DPO — Emmanuel Carbonilla
  { username: 'emmanuel', password: hashPassword('Blue@DPO2026'), role: 'dpo' },
  { username: 'eman', password: hashPassword('Blue@DPO2026'), role: 'dpo' },
  { username: 'applicant1', password: hashPassword('Applicant@2026'), role: 'applicant', allowedModules: ['complaint-grievance', 'sourcing-selection', 'welfare-monitoring'] },
];

const SIDEBAR_LINKS = {
  admin: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'QMS Document Center', url: '/views/qms_document_center.html', icon: '📂' },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Reports', url: '/views/report.html', icon: '📊' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  president: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  manager: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  document_controller: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  accounting: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  encoder: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  welfare_officer: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  qmr: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  dpo: [
    { label: 'Staff Dashboard', url: '/staff', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare', icon: '🩺' },
    { label: 'Complaint & Grievance', url: '/complaints', icon: '📋' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  applicant: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'Profile', url: '/views/profile.html', icon: '👤' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ]
};

// 5. MULTER STORAGE CONFIGURATION

// General QMS docs storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, qmsDocsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// Application submissions storage (CVs, photos, passports)
const applicationsDir = path.join(__dirname, 'uploads', 'applications');
if (!fs.existsSync(applicationsDir)) fs.mkdirSync(applicationsDir, { recursive: true });

const applicationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, applicationsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${file.fieldname}-${safeName}`);
  }
});

const uploadApplication = multer({
  storage: applicationStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // fallback for .doc/.docx on some browsers
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp'
    ];
    const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      console.warn(`[uploadApplication] Rejected file: ${file.originalname} (${file.mimetype})`);
      cb(null, false); // skip the file instead of throwing, so route handler still runs
    }
  }
});

// OFW complaint attachments storage
const ofwComplaintUploadsDir = path.join(__dirname, 'uploads', 'ofw_complaints');
if (!fs.existsSync(ofwComplaintUploadsDir)) fs.mkdirSync(ofwComplaintUploadsDir, { recursive: true });

const ofwComplaintStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ofwComplaintUploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-complaint-${safeName}`);
  }
});

const uploadOfwComplaintAttachment = multer({
  storage: ofwComplaintStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp'
    ];
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// On startup: recover any uploaded CV files that have no matching record in applicantForms
(function recoverOrphanedApplicationFiles() {
  try {
    if (!fs.existsSync(applicationsDir)) return;
    const files = fs.readdirSync(applicationsDir);
    const knownFiles = new Set();
    applicantForms.forEach(a => {
      if (a.files) { ['cv','photo','passport'].forEach(f => { if (a.files[f]) knownFiles.add(a.files[f]); }); }
    });
    // Group files by timestamp prefix (new format: TIMESTAMP-field-name.ext)
    const groups = {};
    files.forEach(fname => {
      const m = fname.match(/^(\d{13})-(cv|photo|passport)-(.+)$/i);
      if (m) {
        const ts = m[1]; const field = m[2].toLowerCase();
        if (!groups[ts]) groups[ts] = { ts };
        groups[ts][field] = fname;
        return;
      }
      // Old format: Name_field_TIMESTAMP.ext
      const oldM = fname.match(/^(.+?)_(cv|photo|passport)_(\d{13})\.\w+$/i);
      if (oldM) {
        const name = oldM[1]; const field = oldM[2].toLowerCase(); const ts = oldM[3];
        const key = 'old-' + name;
        if (!groups[key]) groups[key] = { ts, _nameKey: name };
        groups[key][field] = fname;
      }
    });
    let recovered = 0;
    Object.values(groups).forEach(g => {
      if (!g.cv) return; // CV is mandatory — skip groups without one
      if (knownFiles.has(g.cv)) return; // already in database
      const nameRaw = g._nameKey
        ? g._nameKey.replace(/_/g, ' ').trim()
        : g.cv.replace(/^\d{13}-cv-/, '').replace(/\.\w+$/, '').replace(/[_-]/g, ' ').trim();
      const record = {
        id: 'APP-' + g.ts,
        submittedAt: new Date(parseInt(g.ts)).toISOString(),
        fullName: nameRaw.substring(0, 60) || 'Applicant',
        email: '', phone: '', jobType: '', positions: [], country: '',
        remarks: 'Auto-recovered from upload',
        status: 'new',
        _recovered: true,
        files: { cv: g.cv, photo: g.photo || null, passport: g.passport || null }
      };
      applicantForms.push(record);
      const alreadyLead = sourcingLeads.find(l => l.id === record.id || l._id === record.id);
      if (!alreadyLead) {
        sourcingLeads.push({
          _id: record.id, id: record.id,
          candidateName: record.fullName,
          email: '', contactNumber: '', jobInterest: '', positions: [], country: '',
          source: 'Online Application', status: 'new',
          submittedAt: record.submittedAt,
          cvFile: `/uploads/applications/${g.cv}`,
          notes: record.remarks
        });
      }
      recovered++;
    });
    if (recovered > 0) {
      saveStore('applicant_forms.json', applicantForms);
      saveStore('sourcing_leads.json', sourcingLeads);
      console.log(`[startup] Recovered ${recovered} orphaned application file(s) into the database.`);
    }
  } catch (e) {
    console.error('[startup] recoverOrphanedApplicationFiles error:', e.message);
  }
})();

// 6. MIDDLEWARE

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const protectedRootHtmlFiles = new Set([
  'repatriated.html',
  'invoice_template.html',
  'payment_template.html',
  'master_invoice_tracker.html'
]);

app.use((req, res, next) => {
  const requestedFile = path.basename((req.path || '').toLowerCase());
  if (protectedRootHtmlFiles.has(requestedFile)) {
    return requireStaffAuth(req, res, next);
  }
  next();
});

app.use(express.static(__dirname, { 
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.type('text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
const protectedViewFiles = new Set([
  'admin.html',
  'private_finance_admin.html',
  'sourcing_dashboard.html',
  'complaint_grievance.html',
  'qms_document_center.html',
  'welfare_monitoring.html',
  'management_leadership.html',
  'resource_competence.html',
  'contract_reengagement.html',
  'deployment.html',
  'expense_voucher.html',
  'report.html',
  'contact_us.html',
  'applicant.html',
  'ofw_monitoring.html'
]);
app.use('/views', (req, res, next) => {
  const requestedFile = path.basename((req.path || '').toLowerCase());
  if (protectedViewFiles.has(requestedFile)) {
    return requireStaffAuth(req, res, next);
  }
  next();
}, express.static(path.join(__dirname, 'views')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/blueorion-qms', express.static(path.join(__dirname, 'BLUEORION_QMS')));
// Alias /images → /assets so legacy logo paths work
app.use('/images', express.static(path.join(__dirname, 'assets')));
app.get('/images/logo.png', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'logo blueorion2026PNG.png')));
app.get('/logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'logo.svg')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Ensure QMS folders exist
qmsFolders.forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Folder created: ${folder}`);
  }
  app.use(`/folders/${folder}`, express.static(dir));
});

if (typeof setupEnhancements === 'function') {
  setupEnhancements(app);
}

if (typeof setupAuditRoutes === 'function') {
  setupAuditRoutes(app, { requireStaffAuth, requireAdmin });
}

if (typeof setupAuditDashboard === 'function') {
  setupAuditDashboard(app, { requireStaffAuth, liveLogsRef: auditLogs });
}

// 7. HEALTH CHECK & API INFO
app.get('/api/health', (req, res) => {
  const stats = getSystemStats();
  const recentErrors = serverErrors.slice(-10);
  const criticalErrors = serverErrors.filter(e => {
    const ageMs = Date.now() - new Date(e.timestamp).getTime();
    return ageMs < 60 * 60 * 1000; // errors in last hour
  }).length;
  const healthStatus = criticalErrors > 5 ? 'Degraded' : criticalErrors > 0 ? 'Warning' : 'Operational';
  sendSuccess(res, 200, {
    ...stats,
    health: healthStatus,
    errors: {
      total: serverErrors.length,
      lastHour: criticalErrors,
      recent: recentErrors.map(e => ({ id: e.id, timestamp: e.timestamp, context: e.context, message: e.message }))
    },
    serverTime: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  }, 'Health check OK');
});

// GET /api/errors — returns paginated server error log (admin/president/manager/qmr)
app.get('/api/errors', requireStaffAuth, (req, res) => {
  try {
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit)  || 50));
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const { context, search } = req.query;
    let list = [...serverErrors].reverse();
    if (context) list = list.filter(e => (e.context || '').toLowerCase().includes(context.toLowerCase()));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(e =>
        (e.message || '').toLowerCase().includes(s) ||
        (e.context || '').toLowerCase().includes(s) ||
        (e.path    || '').toLowerCase().includes(s)
      );
    }
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = list.slice((page - 1) * limit, page * limit);
    const lastHour = serverErrors.filter(e => (Date.now() - new Date(e.timestamp).getTime()) < 3600000).length;
    sendSuccess(res, 200, {
      errors: paged,
      pagination: { page, limit, total, totalPages },
      summary: { total: serverErrors.length, lastHour }
    }, 'Error log retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch error log');
  }
});

// DELETE /api/errors/clear — clear all server errors (admin + secret code)
app.delete('/api/errors/clear', requireAdminDeleteCode, (req, res) => {
  try {
    const count = serverErrors.length;
    serverErrors.length = 0;
    logAudit('error-log-cleared', { clearedCount: count }, req);
    sendSuccess(res, 200, { cleared: count }, `${count} error(s) cleared`);
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to clear errors');
  }
});

// Returns the current session's user info — used by client-side auth guards
// Never redirects — always returns JSON so fetch() calls work correctly
app.get('/api/me', (req, res) => {
  const session = getSession(req);
  if (!session) return sendError(res, 401, 'UNAUTHORIZED', 'Not logged in');
  if (session.role === 'applicant') return sendError(res, 403, 'FORBIDDEN', 'Access denied: staff/admin only');
  sendSuccess(res, 200, {
    username: session.username,
    role: session.role
  }, 'Session active');
});

app.get('/api/info', (req, res) => {
  sendSuccess(res, 200, {
    name: 'BLUEORION QMS',
    version: '2.0.0',
    description: 'Quality Management System for Recruitment & Welfare',
    environment: NODE_ENV,
    endpoints: {
      auth: '/api/login',
      documents: '/api/qms-documents',
      complaints: '/api/welfare-complaints',
      applicants: '/api/applicant-form',
      health: '/api/health'
    }
  }, 'API Information');
});

// 8. CORE ROUTES
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /'));

// Public application form — no login required
app.get('/apply', (req, res) => res.sendFile(path.join(__dirname, 'apply.html')));
// Unified public portal route: point /blueorion to the live landing page
app.get('/blueorion', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
// Keep legacy blueorion page available if needed
app.get('/blueorion-legacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blueorion.html')));
app.use('/uploads/applications', express.static(applicationsDir));

// Staff Workstation — restricted to staff/admin roles only (not applicants)
const STAFF_ROLES = ['president','manager','document_controller','accounting','encoder','welfare_officer','admin','dpo','qmr'];
function requireWorkstationAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    const next2 = encodeURIComponent(req.originalUrl || '/workstation');
    return res.redirect(`/login.html?next=${next2}`);
  }
  if (!STAFF_ROLES.includes(session.role)) {
    return res.status(403).sendFile(path.join(__dirname, 'views', '403.html'), () => {
      res.status(403).send('<h2 style="font-family:sans-serif;color:#b91c1c;padding:40px">403 – Access Denied: Staff/Admin only.</h2>');
    });
  }
  req.user = { username: session.username, role: session.role };
  next();
}
app.get('/workstation', requireWorkstationAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '-1');
  res.setHeader('ETag', 'W/"' + Date.now() + '"');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.sendFile(path.join(__dirname, 'staff_workstation.html'), { etag: false });
});
app.get('/applications-inbox', requireStaffAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'views', 'applications_inbox.html'));
});
app.get('/qms-dashboard', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// QMS Manual — secret password gate (admin-only access via PIN 027679)
const MANUAL_PIN = '027679';
const manualUnlocked = new Set(); // tracks session tokens that entered the PIN
const certUnlocked = new Set();   // tracks sessions unlocked for certificate
const PUBLIC_MANUAL_CODE = process.env.PUBLIC_MANUAL_CODE || MANUAL_PIN;
const publicManualUnlocked = new Set();

// Certificate — same PIN lock as QMS Manual
app.get('/certificate', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (certUnlocked.has(ip)) {
    return res.sendFile(path.join(__dirname, 'blueorion_certificate.html'));
  }
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QMS Certificate — Restricted</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif}
  .box{background:#fff;border-radius:14px;padding:44px 48px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .lock{font-size:48px;margin-bottom:16px}
  h1{font-size:20px;color:#003366;font-weight:800;margin-bottom:6px}
  p{font-size:13px;color:#64748b;margin-bottom:24px;line-height:1.6}
  input{width:100%;padding:13px 16px;border:2px solid #e2e8f0;border-radius:8px;font-size:18px;text-align:center;letter-spacing:6px;outline:none;color:#1e293b;font-weight:700;transition:border .2s}
  input:focus{border-color:#003366}
  button{width:100%;margin-top:14px;padding:13px;background:#003366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;transition:background .2s}
  button:hover{background:#0055b3}
  .err{color:#dc2626;font-size:13px;margin-top:10px;display:none}
</style></head><body>
<div class="box">
  <div class="lock">🏅</div>
  <h1>QMS Certificate</h1>
  <p>This certificate is restricted.<br>Enter the access code to view.</p>
  <form method="POST" action="/certificate-unlock">
    <input type="password" name="pin" maxlength="10" placeholder="••••••" autocomplete="off" autofocus>
    <button type="submit">Unlock Certificate</button>
    <div class="err" id="err"${req.query.err === '1' ? ' style="display:block"' : ''}>Incorrect code. Try again.</div>
  </form>
</div>
</body></html>`);
});

app.post('/certificate-unlock', (req, res) => {
  const pin = (req.body && req.body.pin) ? String(req.body.pin).trim() : '';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (pin === MANUAL_PIN) {
    certUnlocked.add(ip);
    return res.redirect('/certificate');
  }
  return res.redirect('/certificate?err=1');
});

function setPublicManualCookie(res, token) {
  const secureFlag = NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `blueorion_manual_public=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${secureFlag}`);
}

function isPublicManualUnlocked(req) {
  const cookies = parseCookies(req);
  const token = cookies.blueorion_manual_public;
  return !!(token && publicManualUnlocked.has(token));
}

function renderPublicManualGate(req, res) {
  const nextTarget = String(req.query.next || '/qms-manual-public');
  const allowedTargets = new Set(['/qms-manual-public', '/qms-manual-online', '/qms_manual_print.html']);
  const safeNext = allowedTargets.has(nextTarget) ? nextTarget : '/qms-manual-public';
  return res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QMS Manual Public Access</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0b1220;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif}
.box{background:#fff;border-radius:14px;padding:42px 44px;max-width:400px;width:92%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.42)}
.lock{font-size:44px;margin-bottom:14px}
h1{font-size:20px;color:#003366;font-weight:800;margin-bottom:8px}
p{font-size:13px;color:#5b6472;margin-bottom:20px;line-height:1.6}
input{width:100%;padding:13px 16px;border:2px solid #d9e2f0;border-radius:8px;font-size:18px;text-align:center;letter-spacing:5px;outline:none;color:#1e293b;font-weight:700}
input:focus{border-color:#003366}
button{width:100%;margin-top:12px;padding:13px;background:#003366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
button:hover{background:#0055b3}
.err{color:#dc2626;font-size:12px;margin-top:10px;display:${req.query.err === '1' ? 'block' : 'none'}}
</style></head><body>
<div class="box">
  <div class="lock">🔐</div>
  <h1>Protected QMS Manual</h1>
  <p>Enter the secret access code to open the online manual.</p>
  <form method="POST" action="/qms-manual-public-unlock">
    <input type="hidden" name="next" value="${safeNext}">
    <input type="password" name="code" maxlength="32" placeholder="••••••" autocomplete="off" autofocus>
    <button type="submit">Open Manual</button>
    <div class="err">Invalid code. Please try again.</div>
  </form>
</div>
</body></html>`);
}

function requirePublicManualCode(req, res, next) {
  if (isPublicManualUnlocked(req)) return next();
  const nextTarget = encodeURIComponent(req.path || '/qms-manual-public');
  return res.redirect(`/qms-manual-public-gate?next=${nextTarget}`);
}

app.get('/qms-manual', requireStaffAuth, (req, res) => {
  const token = getAuthToken(req);
  if (manualUnlocked.has(token)) {
    return res.sendFile(path.join(__dirname, 'qms_manual_print.html'));
  }
  // Show PIN entry page
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QMS Manual — Restricted Access</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif}
  .box{background:#fff;border-radius:14px;padding:44px 48px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .lock{font-size:48px;margin-bottom:16px}
  h1{font-size:20px;color:#003366;font-weight:800;margin-bottom:6px}
  p{font-size:13px;color:#64748b;margin-bottom:24px;line-height:1.6}
  input{width:100%;padding:13px 16px;border:2px solid #e2e8f0;border-radius:8px;font-size:18px;text-align:center;letter-spacing:6px;outline:none;color:#1e293b;font-weight:700;transition:border .2s}
  input:focus{border-color:#003366}
  button{width:100%;margin-top:14px;padding:13px;background:#003366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;transition:background .2s}
  button:hover{background:#0055b3}
  .err{color:#dc2626;font-size:12px;margin-top:10px;display:none}
</style></head><body>
<div class="box">
  <div class="lock">🔐</div>
  <h1>QMS Manual</h1>
  <p>This document is restricted.<br>Enter the access code to continue.</p>
  <form method="POST" action="/qms-manual-unlock">
    <input type="password" name="pin" maxlength="10" placeholder="••••••" autocomplete="off" autofocus>
    <button type="submit">Unlock</button>
    <div class="err" id="err">${req.query.err === '1' ? 'Incorrect code. Try again.' : ''}</div>
  </form>
</div>
<script>if('${req.query.err}'==='1')document.getElementById('err').style.display='block'</script>
</body></html>`);
});

app.post('/qms-manual-unlock', requireStaffAuth, (req, res) => {
  const pin = (req.body && req.body.pin) ? String(req.body.pin).trim() : '';
  const token = getAuthToken(req);
  if (pin === MANUAL_PIN && token) {
    manualUnlocked.add(token);
    return res.redirect('/qms-manual');
  }
  return res.redirect('/qms-manual?err=1');
});

// Public online copy of QMS manual (shareable URL)
app.get('/qms-manual-public', requirePublicManualCode, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.sendFile(path.join(__dirname, 'qms_manual_print.html'));
});

// Public aliases for compatibility with different links/bookmarks
app.get('/qms-manual-online', requirePublicManualCode, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.sendFile(path.join(__dirname, 'qms_manual_print.html'));
});

app.get('/qms_manual_print.html', requirePublicManualCode, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.sendFile(path.join(__dirname, 'qms_manual_print.html'));
});

app.get('/api/qms-manual-public', (req, res) => {
  return res.redirect('/qms-manual-public');
});

app.get('/qms-manual-public-gate', (req, res) => {
  return renderPublicManualGate(req, res);
});

app.post('/qms-manual-public-unlock', (req, res) => {
  const code = (req.body && req.body.code) ? String(req.body.code).trim() : '';
  const requestedNext = (req.body && req.body.next) ? String(req.body.next) : '/qms-manual-public';
  const allowedTargets = new Set(['/qms-manual-public', '/qms-manual-online', '/qms_manual_print.html']);
  const nextTarget = allowedTargets.has(requestedNext) ? requestedNext : '/qms-manual-public';

  if (code === PUBLIC_MANUAL_CODE) {
    const token = crypto.randomBytes(24).toString('hex');
    publicManualUnlocked.add(token);
    setPublicManualCookie(res, token);
    return res.redirect(nextTarget);
  }
  return res.redirect(`/qms-manual-public-gate?next=${encodeURIComponent(nextTarget)}&err=1`);
});

// DMW Slide Presentation (staff/admin only)
app.get('/dmw-slides', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'dmw_slides.html')));

// Staff / admin shortcuts — all require login inside the HTML
app.get('/admin', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/dashboard', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/staff', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/sourcing', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'sourcing_dashboard.html')));
app.get('/sourcing-dashboard', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'sourcing_dashboard.html')));

// Download applicant document (CV, photo, passport) — for all staff
app.get('/api/download-applicant-file/:leadId/:fileType', requireStaffAuth, (req, res) => {
  try {
    const { leadId, fileType } = req.params;
    if (!['cv', 'photo', 'passport'].includes(fileType)) {
      return sendError(res, 400, 'INVALID_FILE_TYPE', 'File type must be cv, photo, or passport');
    }
    const app = applicantForms.find(a => a.id === leadId || a._id === leadId);
    if (!app || !app.files) {
      return sendError(res, 404, 'NOT_FOUND', 'Applicant not found');
    }
    const filename = app.files[fileType];
    if (!filename) {
      return sendError(res, 404, 'NOT_FOUND', `No ${fileType} file for this applicant`);
    }
    const filePath = path.join(applicationsDir, filename);
    if (!fs.existsSync(filePath)) {
      return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found on disk');
    }
    logAudit('document-download', { leadId, fileType, filename, candidateName: app.fullName }, req);
    res.download(filePath, filename);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to download file');
  }
});

// Inline viewer for CV/passport/photo — serves file inline (for iframe/browser preview)
app.get('/api/view-applicant-file/:leadId/:fileType', requireStaffAuth, (req, res) => {
  try {
    const { leadId, fileType } = req.params;
    if (!['cv', 'photo', 'passport'].includes(fileType)) {
      return sendError(res, 400, 'INVALID_FILE_TYPE', 'Invalid file type');
    }
    const app = applicantForms.find(a => a.id === leadId || a._id === leadId);
    if (!app || !app.files) return sendError(res, 404, 'NOT_FOUND', 'Applicant not found');
    const filename = app.files[fileType];
    if (!filename) return sendError(res, 404, 'NOT_FOUND', `No ${fileType} on record`);
    const filePath = path.join(applicationsDir, path.basename(filename));
    if (!fs.existsSync(filePath)) return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found on disk');
    logAudit('document-view', { leadId, fileType, filename, candidateName: app.fullName }, req);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filename)}"`);
    res.sendFile(filePath);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to serve file');
  }
});

// Inline viewer for any upload-path attachment (medical, QMS docs, etc.)
app.get('/api/view-attachment', requireStaffAuth, (req, res) => {
  try {
    const rawPath = req.query.path || '';
    // Strip leading slash and resolve safely within uploads/
    const relative = rawPath.replace(/^\/+/, '').replace(/\.\.\//g, '');
    const filePath = path.join(__dirname, relative);
    // Security: must be inside project directory
    if (!filePath.startsWith(__dirname + path.sep)) {
      return sendError(res, 403, 'FORBIDDEN', 'Access denied');
    }
    if (!fs.existsSync(filePath)) {
      return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found');
    }
    logAudit('attachment-view', { path: relative }, req);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.sendFile(filePath);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to serve attachment');
  }
});

app.get('/complaints', requireStaffAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'views', 'complaint_grievance.html'));
});
app.get('/qms', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'qms_document_center.html')));
app.get('/welfare', requireStaffAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'views', 'welfare_monitoring.html'));
});

// Legacy links used by older dashboards now route to the current authenticated pages.
app.get('/complaint_grievance.html', requireStaffAuth, (req, res) => res.redirect('/complaints'));
app.get('/welfare_monitoring.html', requireStaffAuth, (req, res) => res.redirect('/welfare'));
app.get('/management', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'management_leadership.html')));
app.get('/resources', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'resource_competence.html')));
app.get('/contracts', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'contract_reengagement.html')));
app.get('/deployment', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'deployment.html')));
app.get('/vouchers', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'expense_voucher.html')));
app.get('/expense-voucher', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'expense_voucher.html')));
app.get('/views/expense_voucher.html', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'expense_voucher.html')));
app.get('/invoice_template.html', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'invoice_template.html')));
app.get('/payment_template.html', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'payment_template.html')));
app.get('/soa-template-pdf', requireStaffAuth, (req, res) => {
  const candidates = [
    path.join(__dirname, 'Payments', 'SOA_Template_Blueorion.pdf'),
    path.join(__dirname, 'Vouchers', 'SOA_Template_Blueorion.pdf'),
    path.join(__dirname, 'SOA_Template_Blueorion.pdf')
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) return sendError(res, 404, 'NOT_FOUND', 'SOA PDF file not found');
  res.setHeader('Content-Disposition', 'inline; filename="SOA_Template_Blueorion.pdf"');
  return res.sendFile(hit);
});
app.get('/soa-pdf', requireStaffAuth, (req, res) => res.redirect('/soa-template-pdf'));
app.get('/master_invoice_tracker.html', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'master_invoice_tracker.html')));
app.get('/Payments/SOA_Template_Blueorion.pdf', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'Payments', 'SOA_Template_Blueorion.pdf')));
app.get('/payments/SOA_Template_Blueorion.pdf', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'Payments', 'SOA_Template_Blueorion.pdf')));
app.get('/Vouchers/SOA_Template_Blueorion.pdf', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'Vouchers', 'SOA_Template_Blueorion.pdf')));
app.get('/vouchers/SOA_Template_Blueorion.pdf', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'Vouchers', 'SOA_Template_Blueorion.pdf')));
app.get('/ofw-monitoring', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'ofw_monitoring.html')));
app.get('/ofw-portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ofw_portal.html')));

// OFW MONITORING SYSTEM APIs

// Public: Check worker status by passport+name
app.get('/api/ofw/check', (req, res) => {
  try {
    const { passport, name } = req.query;
    if (!passport || !name) return sendError(res, 400, 'VALIDATION_ERROR', 'Passport and name required');
    const w = ofwWorkers.find(x =>
      x.passportNo && x.passportNo.toUpperCase() === passport.toUpperCase() &&
      x.fullName && x.fullName.toLowerCase().includes(name.toLowerCase())
    );
    if (!w) return sendSuccess(res, 200, null, 'Not found');
    const safe = { id: w.id, fullName: w.fullName, country: w.country, employer: w.employer, position: w.position, deploymentDate: w.deploymentDate, contractEnd: w.contractEnd, status: w.status };
    sendSuccess(res, 200, safe, 'Worker found');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to check status'); }
});

// GET all OFW workers (admin)
app.get('/api/ofw/workers', requireStaffAuth, (req, res) => {
  try {
    const { country, status, search } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    let list = ofwWorkers.map(w => ({
      ...w,
      complaintCount: ofwComplaints.filter(c => c.passportNo === w.passportNo).length
    }));
    if (country) list = list.filter(w => w.country === country);
    if (status)  list = list.filter(w => w.status === status);
    if (search)  list = list.filter(w => w.fullName && w.fullName.toLowerCase().includes(search.toLowerCase()));
    const total = list.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paged = stripAgentNameFromList(list.slice(start, start + limit), req);
    res.json({ success: true, data: paged, pagination: { page, limit, total, totalPages }, message: 'Workers retrieved' });
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch workers'); }
});

// GET single OFW worker with complaints
app.get('/api/ofw/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const w = ofwWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const complaints = ofwComplaints.filter(c => c.passportNo === w.passportNo);
    sendSuccess(res, 200, stripAgentName({ ...w, complaints, complaintCount: complaints.length }, req), 'Worker retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch worker'); }
});

// POST register new OFW worker
app.post('/api/ofw/workers', requireStaffAuth, (req, res) => {
  try {
    const { fullName, passportNo, country } = req.body;
    if (!fullName || !passportNo || !country) return sendError(res, 400, 'VALIDATION_ERROR', 'Full name, passport, and country are required');
    const dup = ofwWorkers.find(w => w.passportNo && w.passportNo.toUpperCase() === passportNo.toUpperCase());
    if (dup) return sendError(res, 409, 'DUPLICATE', 'A worker with this passport number already exists');
    const worker = {
      id: 'OFW-' + Date.now(),
      fullName: sanitizeInput(fullName),
      passportNo: sanitizeInput(passportNo.toUpperCase()),
      dob: req.body.dob ? sanitizeInput(req.body.dob) : '',
      country: sanitizeInput(country),
      employer: sanitizeInput(req.body.employer || ''),
      position: sanitizeInput(req.body.position || ''),
      salary: sanitizeInput(req.body.salary || ''),
      deploymentDate: sanitizeInput(req.body.deploymentDate || ''),
      contractEnd: sanitizeInput(req.body.contractEnd || ''),
      status: sanitizeInput(req.body.status || 'Active'),
      emergencyContact: sanitizeInput(req.body.emergencyContact || ''),
      agentName: canAccessAgentName(req) ? sanitizeInput(req.body.agentName || '') : '',
      notes: sanitizeInput(req.body.notes || ''),
      createdAt: new Date().toISOString()
    };
    ofwWorkers.push(worker);
    saveStore('ofw_workers.json', ofwWorkers);
    logAudit('ofw-worker-registered', { id: worker.id, name: worker.fullName, country: worker.country }, req);
    sendSuccess(res, 201, { id: worker.id }, 'Worker registered');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to register worker'); }
});

// PATCH update OFW worker status
app.patch('/api/ofw/workers/:id/status', requireStaffAuth, (req, res) => {
  try {
    const w = ofwWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    w.status = sanitizeInput(req.body.status || w.status);
    if (req.body.remarks) w.lastRemark = sanitizeInput(req.body.remarks);
    w.updatedAt = new Date().toISOString();
    saveStore('ofw_workers.json', ofwWorkers);
    logAudit('ofw-status-updated', { id: w.id, status: w.status }, req);
    sendSuccess(res, 200, { id: w.id, status: w.status }, 'Status updated');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update status'); }
});

// GET OFW stats
app.get('/api/ofw/stats', requireStaffAuth, (req, res) => {
  try {
    const byCountry = {};
    ofwWorkers.forEach(w => { byCountry[w.country] = (byCountry[w.country] || 0) + 1; });

    // Daily deployment counts
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const toDateStr = d => d.toISOString().slice(0, 10);
    const todayStr     = toDateStr(nowPH);
    const yesterdayStr = toDateStr(new Date(nowPH - 86400000));
    const tomorrowStr  = toDateStr(new Date(nowPH.getTime() + 86400000));

    // Build daily map for ±14 days window
    const daily = {};
    ofwWorkers.forEach(w => {
      if (w.deploymentDate) {
        const d = String(w.deploymentDate).slice(0, 10);
        daily[d] = (daily[d] || 0) + 1;
      }
    });

    // Build sorted schedule for dashboard: last 3 days + next 14 days
    const schedule = [];
    for (let i = -3; i <= 14; i++) {
      const dt = new Date(nowPH.getTime() + i * 86400000);
      const ds = toDateStr(dt);
      if (daily[ds] || i === 0) {
        let label = ds;
        if (i === -1) label = 'Yesterday';
        else if (i === 0) label = 'Today';
        else if (i === 1) label = 'Tomorrow';
        schedule.push({ date: ds, label, count: daily[ds] || 0 });
      }
    }

    sendSuccess(res, 200, {
      total: ofwWorkers.length,
      byCountry,
      openComplaints: ofwComplaints.filter(c => ['open','pending','in progress'].includes(String(c.status || '').toLowerCase())).length,
      deployedYesterday: daily[yesterdayStr] || 0,
      deployedToday:     daily[todayStr]     || 0,
      deployedTomorrow:  daily[tomorrowStr]  || 0,
      daily,
      schedule
    }, 'Stats retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get stats'); }
});

// GET tracker data (PUBLIC - for deployment dashboard)
app.get('/api/ofw/tracker', (req, res) => {
  try {
    // Return all workers (both deployed and pending) for tracker analytics
    const publicWorkers = ofwWorkers.map(w => stripAgentName(w, null));
    const deployed = publicWorkers.filter(w => w.status === 'Active');
    const pending = publicWorkers.filter(w => w.status === 'Pending');
    
    sendSuccess(res, 200, {
      data: publicWorkers,
      deployed: deployed,
      pending: pending,
      stats: {
        total: publicWorkers.length,
        deployedCount: deployed.length,
        pendingCount: pending.length,
        conversionRate: publicWorkers.length > 0 ? Math.round((deployed.length / publicWorkers.length) * 100) : 0
      }
    }, 'Tracker data retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get tracker data'); }
});

// GET all complaints (admin)
app.get('/api/ofw/complaints', requireStaffAuth, (req, res) => {
  try {
    const { country, status, severity } = req.query;
    let list = [...ofwComplaints].sort((a, b) => new Date(b.dateFiled) - new Date(a.dateFiled));
    if (country) list = list.filter(c => String(c.country || '').toLowerCase() === String(country).toLowerCase());
    if (status) list = list.filter(c => String(c.status || '').toLowerCase() === String(status).toLowerCase());
    if (severity) list = list.filter(c => String(c.severity || '').toLowerCase() === String(severity).toLowerCase());
    // Include canonical aliases so old/new UI fields stay connected.
    const normalized = list.map(c => ({
      ...c,
      referenceNo: c.referenceNo || c.refNo || c.id,
      complaintDetails: c.complaintDetails || c.details || c.description || '',
      details: c.details || c.complaintDetails || c.description || '',
      statusNormalized: String(c.status || '').toLowerCase(),
      adminNotes: c.adminNotes || c.note || ''
    }));
    sendSuccess(res, 200, normalized, 'Complaints retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaints'); }
});

// POST file complaint (public — worker portal)
app.post('/api/ofw/complaints', uploadOfwComplaintAttachment.single('attachment'), (req, res) => {
  try {
    const { workerName, passportNo, country, category, severity, details } = req.body;
    if (!workerName || !passportNo || !country || !category || !severity || !details)
      return sendError(res, 400, 'VALIDATION_ERROR', 'All required fields must be filled');

    const attachmentUrl = req.file ? `/uploads/ofw_complaints/${req.file.filename}` : '';
    const attachmentName = req.file ? req.file.originalname : '';

    const complaint = {
      id: 'COMP-' + Date.now(),
      refNo: 'OFW-COMP-' + Date.now(),
      workerName: sanitizeInput(workerName),
      passportNo: sanitizeInput(passportNo.toUpperCase()),
      country: sanitizeInput(country),
      category: sanitizeInput(category),
      severity: sanitizeInput(severity),
      employer: sanitizeInput(req.body.employer || ''),
      summary: sanitizeInput(details).slice(0, 120),
      details: sanitizeInput(details),
      contactNo: sanitizeInput(req.body.contactNo || ''),
      email: sanitizeInput(req.body.email || ''),
      attachmentUrl,
      attachmentName: sanitizeInput(attachmentName),
      status: 'open',
      adminNotes: '',
      dateFiled: new Date().toISOString()
    };
    ofwComplaints.push(complaint);
    saveStore('ofw_complaints.json', ofwComplaints);
    sendSuccess(res, 201, { id: complaint.id, refNo: complaint.refNo, attachmentUrl: complaint.attachmentUrl }, 'Complaint filed');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to file complaint'); }
});

// Public: Track complaint by ref+passport
app.get('/api/ofw/complaints/track', (req, res) => {
  try {
    const { ref, passport } = req.query;
    if (!ref || !passport) return sendError(res, 400, 'VALIDATION_ERROR', 'Reference and passport required');
    const c = ofwComplaints.find(x =>
      x.refNo && x.refNo.toUpperCase() === ref.toUpperCase() &&
      x.passportNo && x.passportNo.toUpperCase() === passport.toUpperCase()
    );
    if (!c) return sendSuccess(res, 200, null, 'Not found');
    sendSuccess(res, 200, { refNo: c.refNo, category: c.category, severity: c.severity, dateFiled: c.dateFiled, status: c.status, adminNotes: c.adminNotes }, 'Found');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to track complaint'); }
});

// PATCH update complaint status (admin)
app.patch('/api/ofw/complaints/:id/status', requireStaffAuth, (req, res) => {
  try {
    const c = ofwComplaints.find(x => x.id === req.params.id);
    if (!c) return sendError(res, 404, 'NOT_FOUND', 'Complaint not found');
    c.status = sanitizeInput(String(req.body.status || c.status).toLowerCase());
    if (req.body.adminNotes !== undefined) c.adminNotes = sanitizeInput(req.body.adminNotes);
    c.updatedAt = new Date().toISOString();
    saveStore('ofw_complaints.json', ofwComplaints);
    logAudit('ofw-complaint-updated', { id: c.id, status: c.status }, req);
    sendSuccess(res, 200, { id: c.id, status: c.status }, 'Complaint updated');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update complaint'); }
});

// PUT full edit of OFW worker record
app.put('/api/ofw/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const idx = ofwWorkers.findIndex(x => x.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const w = ofwWorkers[idx];
    if (req.body.passportNo) {
      const wanted = String(req.body.passportNo).toUpperCase();
      const dup = ofwWorkers.find(x => x.id !== w.id && x.passportNo && x.passportNo.toUpperCase() === wanted);
      if (dup) return sendError(res, 409, 'DUPLICATE', 'A worker with this passport number already exists');
    }
    const editable = ['fullName','passportNo','dob','country','employer','position',
      'deploymentDate','contractEnd','status','emergencyContact','salary','notes'];
    if (canAccessAgentName(req)) editable.push('agentName');
    editable.forEach(f => {
      if (req.body[f] === undefined) return;
      const raw = String(req.body[f]);
      w[f] = sanitizeInput(f === 'passportNo' ? raw.toUpperCase() : raw);
    });
    w.updatedAt = new Date().toISOString();
    ofwWorkers[idx] = w;
    saveStore('ofw_workers.json', ofwWorkers);
    logAudit('ofw-worker-updated', { id: w.id, name: w.fullName }, req);
    sendSuccess(res, 200, w, 'Worker updated');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update worker'); }
});

// DELETE OFW worker record
app.delete('/api/ofw/workers/:id', requireAdminDeleteCode, (req, res) => {
  try {
    const idx = ofwWorkers.findIndex(x => x.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const removed = ofwWorkers.splice(idx, 1)[0];
    saveStore('ofw_workers.json', ofwWorkers);
    logAudit('ofw-worker-deleted', { id: removed.id, name: removed.fullName }, req);
    sendSuccess(res, 200, { id: removed.id }, 'Worker record deleted');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to delete worker'); }
});

// GET export OFW workers as CSV
app.get('/api/ofw/export', requireStaffAuth, (req, res) => {
  try {
    const includeAgent = canAccessAgentName(req);
    const headers = ['ID','Full Name','Passport No','Date of Birth','Country','Employer',
      'Position','Salary','Deployment Date','Contract End','Status','Emergency Contact'];
    if (includeAgent) headers.push('Agent');
    headers.push('Notes');
    const rows = ofwWorkers.map(w => [
      w.id, w.fullName, w.passportNo, w.dob || '', w.country, w.employer || '',
      w.position || '', w.salary || '', w.deploymentDate || '', w.contractEnd || '',
      w.status || 'Active', w.emergencyContact || ''
    ].concat(includeAgent ? [w.agentName || ''] : []).concat([
      (w.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ofw_workers_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to export workers'); }
});

// GET workers with expiring contracts or active alerts
app.get('/api/ofw/alerts', requireStaffAuth, (req, res) => {
  try {
    const today = new Date();
    const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const alerts = [];
    ofwWorkers.forEach(w => {
      if (w.contractEnd) {
        const end = new Date(w.contractEnd);
        if (end <= in60days && end >= today) {
          const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
          alerts.push({ type: 'contract_expiry', workerId: w.id, workerName: w.fullName,
            country: w.country, contractEnd: w.contractEnd, daysLeft: days });
        } else if (end < today && w.status === 'Active') {
          alerts.push({ type: 'contract_expired', workerId: w.id, workerName: w.fullName,
            country: w.country, contractEnd: w.contractEnd, daysLeft: 0 });
        }
      }
      if (w.status === 'Emergency') {
        alerts.push({ type: 'emergency', workerId: w.id, workerName: w.fullName,
          country: w.country, status: w.status });
      }
    });
    sendSuccess(res, 200, alerts, `${alerts.length} alert(s) found`);
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get alerts'); }
});

// 9. AUTHENTICATION
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      logAudit('login-fail', { reason: 'Missing credentials' }, req);
      return sendError(res, 400, 'MISSING_FIELDS', 'Username and password are required');
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return sendError(res, 400, 'INVALID_INPUT', 'Username and password must be strings');
    }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const key = username + '|' + ip;
    const now = Date.now();

    // Rate limiting
    if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lockUntil: 0 };
    if (loginAttempts[key].lockUntil > now) {
      logAudit('login-locked', { username, ip }, req);
      return sendError(res, 429, 'RATE_LIMIT', 'Too many attempts. Try again later');
    }

    const user = users.find(u => u.username === username);
    if (!user || user.password !== hashPassword(password)) {
      loginAttempts[key].count++;
      if (loginAttempts[key].count >= MAX_LOGIN_ATTEMPTS) {
        loginAttempts[key].lockUntil = now + LOGIN_LOCK_TIME;
        logAudit('login-lockout', { username, ip }, req);
        return sendError(res, 429, 'ACCOUNT_LOCKED', 'Account locked. Try again in 10 minutes');
      }
      logAudit('login-fail', { username, attempts: loginAttempts[key].count }, req);
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }

    loginAttempts[key] = { count: 0, lockUntil: 0 };
    logAudit('login-success', { username, ip }, req);
    addNotification('auth', `User ${username} logged in`);

    const sessionToken = createSession(user, req);
    setSessionCookie(res, sessionToken);

    sendSuccess(res, 200, {
      message: 'Login successful',
      role: user.role,
      username: user.username,
      token: sessionToken,
      ...(user.allowedModules && { allowedModules: user.allowedModules })
    });
  } catch (err) {
    console.error('Login error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

// Bridge route: establish cookie-backed session then redirect to target page
app.get('/session-login', (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const nextPath = typeof req.query.next === 'string' ? req.query.next : '/dashboard.html';
    const session = token ? sessions.get(token) : null;

    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      clearSessionCookie(res);
      return res.redirect('/login.html');
    }

    // Allow only internal relative redirects.
    const safeNext = (nextPath.startsWith('/') && !nextPath.startsWith('//')) ? nextPath : '/dashboard.html';
    setSessionCookie(res, token);
    return res.redirect(safeNext);
  } catch (err) {
    clearSessionCookie(res);
    return res.redirect('/login.html');
  }
});

app.get('/logout', (req, res) => {
  const session = getSession(req);
  if (session) sessions.delete(session.token);
  clearSessionCookie(res);
  logAudit('logout', {}, req);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.redirect('/login.html');
});

// 10. DASHBOARD & STATISTICS
app.get('/api/stats', (req, res) => {
  try {
    sendSuccess(res, 200, getSystemStats(), 'Statistics retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch statistics');
  }
});

app.get('/api/dashboard-stats', requireStaffAuth, (req, res) => {
  try {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthBuckets = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const safePct = (current, previous) => {
      if (!previous && !current) return 0;
      if (!previous) return 100;
      return Math.round(((current - previous) / previous) * 100);
    };
    const isoMonth = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 7);
    };
    const normalizeStatus = (s) => String(s || 'unknown').trim().toLowerCase();
    const countByStatus = (items, accessor) => {
      return items.reduce((acc, item) => {
        const key = normalizeStatus(accessor(item));
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    };

    // ── Workstation data stores ──────────────────────────────────────────────
    const wsCommissions  = wsData.commissions  || [];
    const wsPayroll      = wsData.payroll      || [];
    const wsAttendance   = wsData.attendance   || [];
    const wsSelections   = wsData.selections   || [];
    const wsDepRecords   = wsData.dep_records  || [];
    const wsContracts    = wsData.contracts    || [];
    const wsOwwa         = wsData.owwa         || [];
    const wsBio          = wsData.bio          || [];
    const wsAvailCvs     = wsData.availablecvs || [];
    const wsFra          = wsData.fra          || [];
    const wsComCv        = wsData.com_cv       || [];

    // ── Applicant pipeline ───────────────────────────────────────────────────
    const totalApplicants = applicantForms.length + interestedApplicants.length;
    const officialApplicants = applicantForms.length;
    const interestedLeads = interestedApplicants.length;
    const selectedCount = sourcingLeads.filter(l => ['selected','shortlisted','approved'].includes((l.status||'').toLowerCase())).length;
    // deployedCount: sourcing leads + deployment tracking page records
    const depRecords = wsDepRecords.length ? wsDepRecords : loadStore('ws_dep_records.json');
    const depRecordsDeployed = depRecords.filter(d => (d.status||'').toLowerCase() !== 'cancelled').length;
    const deployedCount = Math.max(
      sourcingLeads.filter(l => ['deployed','hired'].includes((l.status||'').toLowerCase())).length,
      depRecordsDeployed
    ) || depRecordsDeployed;

    // Welfare complaints
    const totalComplaints = welfareComplaints.length;
    const openComplaints = welfareComplaints.filter(c => !['resolved','closed'].includes((c.status||'').toLowerCase())).length;
    const criticalComplaints = welfareComplaints.filter(c => (c.urgency||'').toLowerCase() === 'critical').length;

    // Audit improvement
    const openAuditItems = auditImprovementItems.filter(i => (i.status||'').toLowerCase() === 'open').length;
    const overdueAuditItems = auditImprovementItems.filter(i => {
      if (!i.dueDate || ['closed','resolved'].includes((i.status||'').toLowerCase())) return false;
      return new Date(i.dueDate) < now;
    }).length;

    // Expenses this month
    const monthExpenses = expenses.filter(e => (e.dateIncurred||e.createdAt||'').startsWith(thisMonth));
    const totalExpensesThisMonth = monthExpenses.reduce((s,e) => s + (parseFloat(e.amountPhp)||0), 0);
    const totalExpensesAllTime = expenses.reduce((s,e) => s + (parseFloat(e.amountPhp)||0), 0);

    // OFW
    const totalOFW = ofwWorkers.length;
    const activeOFW = ofwWorkers.filter(w => (w.status||'').toLowerCase() === 'active').length;

    // FRA partners
    const fraPartners = fraWorkers.length;

    // Documents
    const totalDocs = qmsDocs.length;

    // Compliance score (based on closed audit items)
    const closedAudit = auditImprovementItems.filter(i => ['closed','resolved'].includes((i.status||'').toLowerCase())).length;
    const totalAudit = auditImprovementItems.length;
    const complianceScore = totalAudit ? Math.round(((totalAudit - openAuditItems) / totalAudit) * 100) : 100;

    // Monthly trends
    const officialApplicantsByMonth = monthBuckets.map(m =>
      applicantForms.filter(a => isoMonth(a.submittedAt || a.submitted || a.createdAt) === m).length
    );
    const interestedLeadsByMonth = monthBuckets.map(m =>
      interestedApplicants.filter(a => isoMonth(a.submittedAt || a.submitted || a.createdAt) === m).length
    );
    const deploymentsByMonth = monthBuckets.map(m =>
      sourcingLeads.filter(l => {
        const st = normalizeStatus(l.status);
        if (!['deployed', 'hired'].includes(st)) return false;
        return isoMonth(l.updatedAt || l.deployedAt || l.createdAt) === m;
      }).length
    );
    const expensesByMonth = monthBuckets.map(m =>
      expenses
        .filter(e => isoMonth(e.dateIncurred || e.createdAt || e.date) === m)
        .reduce((sum, e) => sum + (parseFloat(e.amountPhp || e.amount) || 0), 0)
    );

    // Growth metrics (current month vs last month)
    const officialThisMonth = officialApplicantsByMonth[officialApplicantsByMonth.length - 1] || 0;
    const officialLastMonth = officialApplicantsByMonth[officialApplicantsByMonth.length - 2] || 0;
    const leadsThisMonth = interestedLeadsByMonth[interestedLeadsByMonth.length - 1] || 0;
    const leadsLastMonth = interestedLeadsByMonth[interestedLeadsByMonth.length - 2] || 0;
    const deployedThisMonth = deploymentsByMonth[deploymentsByMonth.length - 1] || 0;
    const deployedLastMonth = deploymentsByMonth[deploymentsByMonth.length - 2] || 0;
    const expThisMonth = expensesByMonth[expensesByMonth.length - 1] || 0;
    const expLastMonth = expensesByMonth[expensesByMonth.length - 2] || 0;

    // ── Commission stats ─────────────────────────────────────────────────────
    const comThisMonth      = wsCommissions.filter(c => (c.date||'').startsWith(thisMonth));
    const commissionGrossAll = wsCommissions.reduce((s,c) => s + (parseFloat(c.total)||0), 0);
    const commissionNetAll   = wsCommissions.reduce((s,c) => s + (parseFloat(c.net)||0),   0);
    const commissionNetMonth = comThisMonth.reduce( (s,c) => s + (parseFloat(c.net)||0),   0);
    const commissionGrossMonth = comThisMonth.reduce((s,c) => s + (parseFloat(c.total)||0), 0);
    const commissionPending  = wsCommissions.filter(c => (c.status||'').toLowerCase() === 'pending release').length;
    const commissionReleased = wsCommissions.filter(c => (c.status||'').toLowerCase() === 'released').length;
    const commissionHeld     = wsCommissions.filter(c => (c.status||'').toLowerCase() === 'held').length;

    // ── Payroll stats ────────────────────────────────────────────────────────
    const payThisMonth     = wsPayroll.filter(p => (p.from||p.date||'').startsWith(thisMonth));
    const payrollNetAll    = wsPayroll.reduce( (s,p) => s + (parseFloat(p.net)||0), 0);
    const payrollGrossAll  = wsPayroll.reduce( (s,p) => s + (parseFloat(p.gross)||0), 0);
    const payrollNetMonth  = payThisMonth.reduce((s,p) => s + (parseFloat(p.net)||0), 0);
    const payrollHeadcount = [...new Set(wsPayroll.map(p => (p.name||'').trim().toLowerCase()).filter(Boolean))].length;

    // ── Attendance stats ─────────────────────────────────────────────────────
    const attendanceThisMonth = wsAttendance.filter(a => (a.date||'').startsWith(thisMonth));
    const attendancePresent   = attendanceThisMonth.filter(a => (a.status||'').toLowerCase() === 'present').length;
    const attendanceAbsent    = attendanceThisMonth.filter(a => (a.status||'').toLowerCase() === 'absent').length;
    const attendanceLate      = attendanceThisMonth.filter(a => (a.status||'').toLowerCase() === 'late').length;
    const attendanceTotal     = wsAttendance.length;

    // ── CV / Selection pipeline ──────────────────────────────────────────────
    const cvAvailable   = wsAvailCvs.length;
    const cvSelected    = wsSelections.length;
    const comCvCount    = wsComCv.length;

    // ── Contracts & deployments (workstation) ────────────────────────────────
    const contractsObj    = Array.isArray(wsContracts) && wsContracts.length === 1 && typeof wsContracts[0] === 'object' ? wsContracts[0] : (Array.isArray(wsContracts) ? {} : wsContracts);
    const contractActive  = Array.isArray(contractsObj.contracts) ? contractsObj.contracts.filter(c => (c.status||'').toLowerCase() === 'active').length : 0;
    const contractExpiring= Array.isArray(contractsObj.contracts) ? contractsObj.contracts.filter(c => {
      if (!c.endDate || (c.status||'').toLowerCase() !== 'active') return false;
      const diff = (new Date(c.endDate) - now) / (1000*60*60*24);
      return diff >= 0 && diff <= 30;
    }).length : 0;
    const wsDeployTotal   = wsDepRecords.filter(d => (d.status||'').toLowerCase() !== 'cancelled').length;
    const wsDeployActive  = wsDepRecords.filter(d => (d.status||'').toLowerCase() === 'deployed').length;

    // ── OWWA / Bio / FRA ────────────────────────────────────────────────────
    const owwaCount     = wsOwwa.length;
    const bioCount      = wsBio.length;
    const fraCount      = wsFra.length;
    const fraReportCnt  = (wsData.fraworkersreport||[]).length;

    // Breakdown sets
    const leadStatusBreakdown = countByStatus(sourcingLeads, l => l.status);
    const complaintStatusBreakdown = countByStatus(welfareComplaints, c => c.status);
    const auditStatusBreakdown = countByStatus(auditImprovementItems, i => i.status);
    const complaintUrgencyBreakdown = countByStatus(welfareComplaints, c => c.urgency);
    const comStatusBreakdown  = { pending: commissionPending, released: commissionReleased, held: commissionHeld };

    // Recent activity (multi-source)
    const recentActivity = [
      ...auditLogs.slice(-30).map(l => {
        const labelMap = {
          'login-success': '🔐 Login',
          'login-fail': '⚠️ Failed Login',
          'login-lockout': '🔒 Account Locked',
          'login-locked': '🔒 Login Blocked',
          'logout': '👋 Logout',
        };
        return {
          type: l.action && l.action.startsWith('login') ? 'login' : 'audit',
          label: labelMap[l.action] || l.action || 'Audit log',
          detail: l.user && l.user !== 'unknown' ? l.user : (l.details ? JSON.stringify(l.details).slice(0,50) : ''),
          ts: l.timestamp
        };
      }),
      ...applicantForms.slice(-15).map(a => ({
        type: 'applicant',
        label: '📋 New Applicant',
        detail: a.fullName || a.name || 'Applicant',
        ts: a.submittedAt || a.submitted || a.createdAt
      })),
      ...welfareComplaints.slice(-10).map(c => ({
        type: 'complaint',
        label: '⚠️ Welfare Complaint',
        detail: c.workerName || c.name || c.title || 'Complaint filed',
        ts: c.createdAt || c.dateFiled || c.date
      })),
      ...wsCommissions.slice(-10).map(c => ({
        type: 'commission',
        label: '💰 Commission Saved',
        detail: `${c.name||'Staff'} — ₱${parseFloat(c.net||0).toLocaleString()}`,
        ts: c.date ? c.date + 'T00:00:00' : null
      })),
      ...wsPayroll.slice(-10).map(p => ({
        type: 'payroll',
        label: '📑 Payroll Saved',
        detail: `${p.name||'Staff'} — Net ₱${parseFloat(p.net||0).toLocaleString()}`,
        ts: p.from ? p.from + 'T00:00:00' : null
      }))
    ]
      .filter(a => a.ts)
      .sort((a,b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 15);

    // Notifications unread
    const unreadNotifs = notifications.filter(n => !n.read).length;

    // Alerts/workload summary
    const pendingRecruitment = Math.max(totalApplicants - selectedCount - deployedCount, 0);
    const totalActionRequired = openComplaints + overdueAuditItems + pendingRecruitment + contractExpiring;
    const alerts = [];
    if (criticalComplaints > 0) alerts.push({ level: 'critical', code: 'CRITICAL_COMPLAINTS', message: `${criticalComplaints} critical complaint(s) need immediate attention` });
    if (overdueAuditItems > 0) alerts.push({ level: 'warning', code: 'OVERDUE_AUDITS', message: `${overdueAuditItems} audit item(s) are overdue` });
    if (contractExpiring > 0) alerts.push({ level: 'warning', code: 'EXPIRING_CONTRACTS', message: `${contractExpiring} contract(s) expiring within 30 days` });
    if (commissionPending > 0) alerts.push({ level: 'info', code: 'PENDING_COMMISSION', message: `${commissionPending} commission(s) pending release` });
    if (pendingRecruitment > 0) alerts.push({ level: 'info', code: 'PENDING_RECRUITMENT', message: `${pendingRecruitment} applicant(s) still in pipeline` });

    sendSuccess(res, 200, {
      kpi: {
        // Applicants
        totalApplicants, officialApplicants, interestedLeads,
        selectedCount, deployedCount,
        // Welfare
        totalComplaints, openComplaints, criticalComplaints,
        // Docs & Audit
        totalDocs, openAuditItems, overdueAuditItems, complianceScore,
        // OFW & FRA
        totalOFW, activeOFW, fraPartners,
        // Expenses
        totalExpensesThisMonth, totalExpensesAllTime,
        // Notifications
        unreadNotifs,
        // Commission
        commissionCount: wsCommissions.length,
        commissionGrossAll: Math.round(commissionGrossAll),
        commissionNetAll:   Math.round(commissionNetAll),
        commissionGrossMonth: Math.round(commissionGrossMonth),
        commissionNetMonth:  Math.round(commissionNetMonth),
        commissionPending, commissionReleased, commissionHeld,
        // Payroll
        payrollCount:     wsPayroll.length,
        payrollHeadcount,
        payrollNetAll:    Math.round(payrollNetAll),
        payrollGrossAll:  Math.round(payrollGrossAll),
        payrollNetMonth:  Math.round(payrollNetMonth),
        // Attendance
        attendanceTotal, attendancePresent, attendanceAbsent, attendanceLate,
        // CV & Selection
        cvAvailable, cvSelected, comCvCount,
        // Contracts & Deployments
        contractActive, contractExpiring,
        wsDeployTotal, wsDeployActive,
        // OWWA / Bio / FRA
        owwaCount, bioCount, fraCount, fraReportCnt
      },
      growth: {
        month: thisMonth,
        previousMonth: lastMonth,
        officialApplicantsPct: safePct(officialThisMonth, officialLastMonth),
        interestedLeadsPct: safePct(leadsThisMonth, leadsLastMonth),
        deploymentsPct: safePct(deployedThisMonth, deployedLastMonth),
        expensesPct: safePct(expThisMonth, expLastMonth)
      },
      trends: {
        months: monthBuckets,
        officialApplicants: officialApplicantsByMonth,
        interestedLeads: interestedLeadsByMonth,
        deployments: deploymentsByMonth,
        expenses: expensesByMonth
      },
      breakdown: {
        leadStatus: leadStatusBreakdown,
        complaintStatus: complaintStatusBreakdown,
        complaintUrgency: complaintUrgencyBreakdown,
        auditStatus: auditStatusBreakdown,
        commissionStatus: comStatusBreakdown
      },
      workload: {
        pendingRecruitment,
        openComplaints,
        overdueAuditItems,
        contractExpiring,
        totalActionRequired
      },
      alerts,
      recentActivity,
      system: {
        uptime: Math.floor(process.uptime()),
        environment: NODE_ENV,
        health: 'Operational',
        serverTime: now.toISOString()
      },
      generatedAt: now.toISOString()
    }, 'Dashboard statistics retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch dashboard statistics');
  }
});

// 11. QMS DOCUMENTS - Enhanced with validation
app.post('/api/qms-documents/upload', requireRole('admin'), upload.single('file'), (req, res) => {
  try {
    if (!req.file || !req.body.name) {
      return sendError(res, 400, 'MISSING_FIELDS', 'File and document name are required');
    }

    const name = sanitizeInput(req.body.name);
    if (!name || name.length < 3) {
      return sendError(res, 400, 'INVALID_NAME', 'Document name must be at least 3 characters');
    }

    const now = new Date().toISOString();
    const url = `/uploads/qms_docs/${req.file.filename}`;
    const categories = req.body.categories ? req.body.categories.split(',').map(s => sanitizeInput(s)).filter(Boolean) : [];
    const tags = req.body.tags ? req.body.tags.split(',').map(s => sanitizeInput(s)).filter(Boolean) : [];

    let doc = qmsDocs.find(d => d.name === name);
    if (doc) {
      doc.versions = doc.versions || [];
      doc.versions.push({ url: doc.url, dateUploaded: doc.dateUploaded });
      doc.url = url;
      doc.type = req.file.mimetype;
      doc.uploadedBy = sanitizeInput(req.body.uploadedBy) || 'Unknown';
      doc.dateUploaded = now;
      doc.version = (doc.version || 1) + 1;
      doc.approval = { status: 'pending', requestedBy: doc.uploadedBy, dateRequested: now };
      doc.categories = categories;
      doc.tags = tags;
    } else {
      doc = {
        id: Date.now().toString(),
        name,
        type: req.file.mimetype,
        uploadedBy: sanitizeInput(req.body.uploadedBy) || 'Unknown',
        dateUploaded: now,
        url,
        version: 1,
        approval: { status: 'pending', requestedBy: sanitizeInput(req.body.uploadedBy) || 'Unknown', dateRequested: now },
        categories,
        tags,
        versions: [],
        fileSize: req.file.size
      };
      qmsDocs.push(doc);
    }

    logAudit('document-upload', { name: doc.name, version: doc.version }, req);
    addNotification('qms', `Document: ${name} uploaded`);

    sendSuccess(res, 201, doc, 'Document uploaded successfully');
  } catch (err) {
    console.error('Upload error:', err);
    sendError(res, 500, 'UPLOAD_ERROR', 'Failed to upload document', err.message);
  }
});

app.get('/api/qms-documents', (req, res) => {
  try {
    logAudit('list-documents', { count: qmsDocs.length }, req);
    let docs = qmsDocs;

    const { q, uploader, category, tag, limit = 100, offset = 0 } = req.query;

    if (q) {
      const query = sanitizeInput(q).toLowerCase();
      docs = docs.filter(d => (d.name || '').toLowerCase().includes(query));
    }
    if (uploader) {
      docs = docs.filter(d => (d.uploadedBy || '').toLowerCase().includes(sanitizeInput(uploader).toLowerCase()));
    }
    if (category) {
      docs = docs.filter(d => (d.categories || []).map(c => c.toLowerCase()).includes(sanitizeInput(category).toLowerCase()));
    }
    if (tag) {
      docs = docs.filter(d => (d.tags || []).map(t => t.toLowerCase()).includes(sanitizeInput(tag).toLowerCase()));
    }

    const total = docs.length;
    const paginated = docs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    sendSuccess(res, 200, {
      documents: paginated,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
    }, 'Documents retrieved');
  } catch (err) {
    console.error('List documents error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to list documents');
  }
});

// 12. WELFARE COMPLAINTS - Enhanced validation
app.post('/api/welfare-complaints', (req, res) => {
  try {
    const applicantName = sanitizeInput(req.body.applicantName || req.body.workerName || '');
    const location = sanitizeInput(req.body.location || req.body.fraName || req.body.country || 'Not specified');
    const employerName = sanitizeInput(req.body.employerName || req.body.employer || req.body.fraName || 'Not specified');
    const agencyName = sanitizeInput(req.body.agencyName || req.body.fraName || 'Blueorion');
    const category = sanitizeInput(req.body.category || 'General Grievance');
    const urgencyRaw = sanitizeInput(req.body.urgency || 'medium');
    const description = sanitizeInput(req.body.description || req.body.complaintDetails || '');
    const mobileNo = sanitizeInput(req.body.mobileNo || req.body.contactNo || '');
    const referenceNo = sanitizeInput(req.body.referenceNo || ('WEL-' + Date.now() + '-' + Math.floor(Math.random() * 1000)));

    // Validation
    if (!applicantName || !description) {
      return sendError(res, 400, 'MISSING_FIELDS', 'All fields are required');
    }

    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    if (!validUrgencies.includes(urgencyRaw.toLowerCase())) {
      return sendError(res, 400, 'INVALID_URGENCY', `Urgency must be one of: ${validUrgencies.join(', ')}`);
    }

    const complaint = {
      id: Date.now().toString(),
      referenceNo,
      applicantName,
      workerName: applicantName,
      mobileNo,
      location,
      employerName,
      agencyName,
      category,
      urgency: urgencyRaw.toLowerCase(),
      description,
      date: new Date().toISOString(),
      status: 'pending'
    };

    welfareComplaints.push(complaint);
    saveStore('welfare_complaints.json', welfareComplaints);
    saveToExcel(path.join(__dirname, 'welfare_complaints.xlsx'), complaint, 'Complaints');
    logAudit('complaint-submitted', { applicantName: complaint.applicantName, urgency: complaint.urgency }, req);
    addNotification('welfare', `Complaint from ${complaint.applicantName}`);

    sendSuccess(res, 201, complaint, 'Complaint submitted successfully');
  } catch (err) {
    console.error('Complaint submission error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to submit complaint');
  }
});

app.get('/api/welfare-complaints', (req, res) => {
  try {
    logAudit('list-complaints', { count: welfareComplaints.length }, req);
    const { status, urgency, search = '', limit = 100, offset = 0 } = req.query;

    let filtered = welfareComplaints;
    if (status) filtered = filtered.filter(c => (c.status || '').toLowerCase() === String(status).toLowerCase());
    if (urgency) filtered = filtered.filter(c => (c.urgency || '').toLowerCase() === String(urgency).toLowerCase());
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(c =>
        (c.referenceNo || '').toLowerCase().includes(q) ||
        (c.applicantName || '').toLowerCase().includes(q) ||
        (c.workerName || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }

    filtered = filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const total = filtered.length;
    const paginated = filtered
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(c => ({
        ...c,
        complaintDetails: c.complaintDetails || c.description || c.details || '',
        description: c.description || c.complaintDetails || c.details || '',
        fraName: c.fraName || c.agencyName || c.employerName || '',
        agencyName: c.agencyName || c.fraName || c.employerName || '',
        employerName: c.employerName || c.agencyName || c.fraName || '',
        adminNotes: c.adminNotes || c.note || ''
      }));

    // Return plain array for legacy pages while keeping metadata for modern clients.
    if (req.query.format === 'legacy' || req.headers['x-legacy-client'] === '1') {
      return res.status(200).json(paginated);
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Complaints retrieved',
      data: { complaints: paginated, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } },
      complaints: paginated,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaints');
  }
});

app.get('/api/welfare-complaints/summary', (req, res) => {
  try {
    const total = welfareComplaints.length;
    const byStatus = welfareComplaints.reduce((acc, c) => {
      const key = (c.status || 'pending').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byUrgency = welfareComplaints.reduce((acc, c) => {
      const key = (c.urgency || 'medium').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    sendSuccess(res, 200, { total, byStatus, byUrgency }, 'Complaint summary retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaint summary');
  }
});

function updateComplaintStatusByKey(key, newStatus, note, req, res) {
  const complaint = welfareComplaints.find(c => c.id === key || c.referenceNo === key);
  if (!complaint) return sendError(res, 404, 'NOT_FOUND', 'Complaint not found');

  const validStatuses = ['pending', 'open', 'in progress', 'resolved', 'closed'];
  const normalized = String(newStatus || '').toLowerCase();
  if (!validStatuses.includes(normalized)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status');
  }

  complaint.status = normalized;
  complaint.updatedAt = new Date().toISOString();
  if (note) {
    const cleanNote = sanitizeInput(note);
    complaint.note = cleanNote;
    complaint.adminNotes = cleanNote;
  }
  saveStore('welfare_complaints.json', welfareComplaints);

  logAudit('complaint-status-updated', { key, status: complaint.status }, req);
  sendSuccess(res, 200, complaint, 'Complaint status updated');
}

app.patch('/api/welfare-complaints/:key/status', (req, res) => {
  try {
    return updateComplaintStatusByKey(req.params.key, req.body?.status, req.body?.note, req, res);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update complaint status');
  }
});

app.post('/api/welfare-complaints/:key/status', (req, res) => {
  try {
    return updateComplaintStatusByKey(req.params.key, req.body?.status, req.body?.note, req, res);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update complaint status');
  }
});

// 12B. WELFARE WORKERS (persistent)
app.get('/api/welfare-workers', (req, res) => {
  try {
    const { status, search = '' } = req.query;
    let rows = welfareWorkers.slice();

    if (status) {
      const st = String(status).toLowerCase();
      rows = rows.filter(w => String(w.status || '').toLowerCase() === st);
    }

    if (search) {
      const q = String(search).toLowerCase();
      rows = rows.filter(w =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.country || '').toLowerCase().includes(q) ||
        (w.status || '').toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    sendSuccess(res, 200, { workers: rows }, 'Welfare workers retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch welfare workers');
  }
});

app.post('/api/welfare-workers', (req, res) => {
  try {
    const name = sanitizeInput(req.body?.name || '');
    const country = sanitizeInput(req.body?.country || '');
    const statusRaw = sanitizeInput(req.body?.status || 'Active');
    const validStatuses = ['active', 'inactive'];

    if (!name || !country) {
      return sendError(res, 400, 'MISSING_FIELDS', 'name and country are required');
    }
    if (!validStatuses.includes(statusRaw.toLowerCase())) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'status must be Active or Inactive');
    }

    const worker = {
      id: 'WKR-' + Date.now(),
      name,
      status: statusRaw.toLowerCase() === 'inactive' ? 'inactive' : 'active',
      lastCheckin: new Date().toISOString().slice(0, 10),
      country
    };

    welfareWorkers.push(worker);
    welfareWorkerLogs.unshift(`${worker.lastCheckin}: ${worker.name} added and checked in from ${worker.country}.`);
    welfareWorkerLogs = welfareWorkerLogs.slice(0, 500);

    saveStore('welfare_workers.json', welfareWorkers);
    saveStore('welfare_worker_logs.json', welfareWorkerLogs);
    logAudit('welfare-worker-added', { worker: worker.name, country: worker.country }, req);

    sendSuccess(res, 201, worker, 'Welfare worker added');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to add welfare worker');
  }
});

app.patch('/api/welfare-workers/:id/status', (req, res) => {
  try {
    const worker = welfareWorkers.find(w => w.id === req.params.id);
    if (!worker) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');

    const nextStatus = String(req.body?.status || '').toLowerCase();
    if (!['active', 'inactive'].includes(nextStatus)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'status must be active or inactive');
    }

    worker.status = nextStatus === 'inactive' ? 'inactive' : 'active';
    const day = new Date().toISOString().slice(0, 10);
    if (worker.status === 'active') worker.lastCheckin = day;

    welfareWorkerLogs.unshift(
      worker.status === 'active'
        ? `${day}: ${worker.name} checked in from ${worker.country}.`
        : `${day}: ${worker.name} marked inactive.`
    );
    welfareWorkerLogs = welfareWorkerLogs.slice(0, 500);

    saveStore('welfare_workers.json', welfareWorkers);
    saveStore('welfare_worker_logs.json', welfareWorkerLogs);
    logAudit('welfare-worker-status', { worker: worker.name, status: worker.status }, req);

    sendSuccess(res, 200, worker, 'Worker status updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update worker status');
  }
});

app.post('/api/welfare-workers/:id/checkin', (req, res) => {
  try {
    const worker = welfareWorkers.find(w => w.id === req.params.id);
    if (!worker) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');

    const day = new Date().toISOString().slice(0, 10);
    worker.lastCheckin = day;
    worker.status = 'Active';
    welfareWorkerLogs.unshift(`${day}: ${worker.name} checked in from ${worker.country}.`);
    welfareWorkerLogs = welfareWorkerLogs.slice(0, 500);

    saveStore('welfare_workers.json', welfareWorkers);
    saveStore('welfare_worker_logs.json', welfareWorkerLogs);
    logAudit('welfare-worker-checkin', { worker: worker.name }, req);

    sendSuccess(res, 200, worker, 'Check-in logged');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to log check-in');
  }
});

app.get('/api/welfare-workers/logs', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '200', 10), 1000));
    sendSuccess(res, 200, { logs: welfareWorkerLogs.slice(0, limit) }, 'Welfare logs retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch welfare logs');
  }
});

app.get('/api/welfare-workers/export.xlsx', (req, res) => {
  try {
    const payload = welfareWorkers.map(w => ({
      WorkerID: w.id,
      WorkerName: w.name,
      Status: w.status,
      LastCheckin: w.lastCheckin,
      Country: w.country
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(payload);
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');
    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="welfare-workers-${stamp}.xlsx"`);
    res.send(fileBuffer);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to export workers');
  }
});

// 13. APPLICANT FORMS
app.post('/api/applicant-form', (req, res) => {
  try {
    const { fullName, email, contact, position, applicationDate, notes } = req.body;

    if (!fullName || !email || !contact || !position || !applicationDate) {
      return sendError(res, 400, 'MISSING_FIELDS', 'Required fields: fullName, email, contact, position, applicationDate');
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'INVALID_EMAIL', 'Invalid email format');
    }

    const entry = {
      id: Date.now().toString(),
      fullName: sanitizeInput(fullName),
      email: email.toLowerCase().trim(),
      contact: sanitizeInput(contact),
      position: sanitizeInput(position),
      applicationDate,
      notes: sanitizeInput(notes || ''),
      submitted: new Date().toISOString()
    };

    applicantForms.push(entry);
    saveToExcel(path.join(__dirname, 'applicant_forms.xlsx'), entry, 'Applicants');
    logAudit('applicant-submitted', { fullName: entry.fullName, position: entry.position }, req);
    addNotification('applicant', `Application from ${entry.fullName}`);

    sendSuccess(res, 201, entry, 'Application submitted successfully');
  } catch (err) {
    console.error('Applicant submission error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to submit application');
  }
});

app.get('/api/applicant-form', requireStaffAuth, (req, res) => {
  try {
    logAudit('list-applicants', { count: applicantForms.length }, req);
    const { limit = 100, offset = 0 } = req.query;

    const total = applicantForms.length;
    const paginated = applicantForms.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    sendSuccess(res, 200, {
      applicants: paginated,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
    }, 'Applicants retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch applicants');
  }
});

// GET /api/applicants — alias used by staff_workstation (combines applicantForms + interestedApplicants)
app.get('/api/applicants', requireStaffAuth, (req, res) => {
  try {
    const { limit = 500, offset = 0, status, search } = req.query;
    let combined = [
      ...applicantForms.map(a => ({ ...a, _source: 'form' })),
      ...interestedApplicants.map(a => ({ ...a, _source: 'interested' }))
    ];
    if (status) combined = combined.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(a =>
        (a.fullName || a.name || '').toLowerCase().includes(q) ||
        (a.positionApplied || a.position || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      );
    }
    const total = combined.length;
    const items = combined.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    sendSuccess(res, 200, { items, total }, 'Applicants retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch applicants');
  }
});

// PATCH /api/applicants/:id/status — update status of an applicant
app.patch('/api/applicants/:id/status', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return sendError(res, 400, 'MISSING_STATUS', 'status is required');

    // Try applicantForms first
    let idx = applicantForms.findIndex(a => a.id === id);
    if (idx !== -1) {
      applicantForms[idx].status = status;
      applicantForms[idx].updatedAt = new Date().toISOString();
      saveStore('applicant_forms.json', applicantForms);
      logAudit('applicant-status-updated', { id, status }, req);
      return sendSuccess(res, 200, applicantForms[idx], 'Status updated');
    }
    // Try interestedApplicants
    idx = interestedApplicants.findIndex(a => a.id === id);
    if (idx !== -1) {
      interestedApplicants[idx].status = status;
      interestedApplicants[idx].updatedAt = new Date().toISOString();
      saveStore('interested_applicants.json', interestedApplicants);
      logAudit('applicant-status-updated', { id, status }, req);
      return sendSuccess(res, 200, interestedApplicants[idx], 'Status updated');
    }
    sendError(res, 404, 'NOT_FOUND', 'Applicant not found');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update status');
  }
});

// GET /api/applications — application profiles (alias for sourcing leads + applicantForms)
app.get('/api/applications', requireStaffAuth, (req, res) => {
  try {
    const { limit = 500, offset = 0 } = req.query;
    const applications = applicantForms.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    sendSuccess(res, 200, { applications, total: applicantForms.length }, 'Applications retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch applications');
  }
});

// PATCH /api/applications/:id — update phone, positions, status for an applicant
app.patch('/api/applications/:id', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { phone, positions, status } = req.body;
    const idx = applicantForms.findIndex(a => a.id === id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Applicant not found');
    if (phone    !== undefined) applicantForms[idx].phone     = String(phone).trim();
    if (positions !== undefined) applicantForms[idx].positions = Array.isArray(positions) ? positions : (positions ? [String(positions)] : []);
    if (status   !== undefined) applicantForms[idx].status    = String(status).trim();
    applicantForms[idx].updatedAt = new Date().toISOString();
    fs.writeFileSync(path.join(dataDir, 'applicant_forms.json'), JSON.stringify(applicantForms, null, 2));
    sendSuccess(res, 200, applicantForms[idx], 'Applicant updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Update failed: ' + err.message);
  }
});

// GET /api/applications/scan-uploads — scan uploads/applications dir for orphaned files
app.get('/api/applications/scan-uploads', requireStaffAuth, (req, res) => {
  try {
    if (!fs.existsSync(applicationsDir)) return sendSuccess(res, 200, { groups: [] }, 'No uploads directory');
    const files = fs.readdirSync(applicationsDir);
    // Group by prefix: new format "TIMESTAMP-fieldname-originalname", old format "Name_fieldname_TIMESTAMP.ext"
    const groups = {};
    files.forEach(fname => {
      // New format: 1777116333478-photo-CHARO_ID.jpg
      const newMatch = fname.match(/^(\d+)-(cv|photo|passport)-(.+)$/);
      if (newMatch) {
        const ts = newMatch[1];
        const field = newMatch[2];
        if (!groups[ts]) groups[ts] = { prefix: ts, modifiedAt: new Date(parseInt(ts)).toISOString() };
        groups[ts][field] = fname;
        const namePart = newMatch[3].replace(/\.\w+$/, '').replace(/_/g, ' ').replace(/-/g, ' ');
        if (!groups[ts].name) groups[ts].name = namePart.substring(0, 40);
        return;
      }
      // Old format: FirstName_LastName_field_TIMESTAMP.ext
      const oldMatch = fname.match(/^(.+?)_(cv|photo|passport)_(\d+)\.\w+$/i);
      if (oldMatch) {
        const nameKey = oldMatch[1];
        const field = oldMatch[2].toLowerCase();
        if (!groups[nameKey]) groups[nameKey] = { prefix: nameKey, name: nameKey.replace(/_/g, ' '), modifiedAt: null };
        groups[nameKey][field] = fname;
      }
    });
    sendSuccess(res, 200, { groups: Object.values(groups) }, 'Scan complete');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Scan failed: ' + err.message);
  }
});

// 14. NOTIFICATIONS
app.get('/api/notifications', requireStaffAuth, (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const recent = notifications.slice(-limit).reverse();
    sendSuccess(res, 200, recent, 'Notifications retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch notifications');
  }
});

app.post('/api/notifications/:id/read', (req, res) => {
  try {
    const notif = notifications.find(n => n.id === req.params.id);
    if (!notif) {
      return sendError(res, 404, 'NOT_FOUND', 'Notification not found');
    }
    notif.read = true;
    sendSuccess(res, 200, notif, 'Notification marked as read');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update notification');
  }
});

// Staff notification broadcast — share applicant to all staff
app.post('/api/staff-notification', requireStaffAuth, (req, res) => {
  try {
    const { message, type, leadId, candidateName, count, sharedBy, sharedAt } = req.body || {};
    if (!message) return sendError(res, 400, 'VALIDATION_ERROR', 'message is required');
    const entry = {
      id: 'notif-' + Date.now(),
      timestamp: sharedAt || new Date().toISOString(),
      type: type || 'applicant-share',
      message: sanitizeInput(message),
      sharedBy: sanitizeInput(sharedBy || req.user.username),
      leadId: leadId || null,
      candidateName: candidateName ? sanitizeInput(candidateName) : null,
      count: count || 1,
      read: false
    };
    notifications.push(entry);
    // Also persist to a dedicated shared-applicants feed
    const sharedFeed = loadStore('staff_shared_applicants.json');
    sharedFeed.push(entry);
    saveStore('staff_shared_applicants.json', sharedFeed.slice(-200));
    logAudit('applicant-shared-to-staff', { leadId, candidateName, sharedBy: entry.sharedBy }, req);
    sendSuccess(res, 201, entry, 'Shared to all staff successfully');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to share notification');
  }
});

// Get staff shared applicants feed
app.get('/api/staff-shared-applicants', requireStaffAuth, (req, res) => {
  try {
    const feed = loadStore('staff_shared_applicants.json');
    sendSuccess(res, 200, feed.slice().reverse(), 'Shared applicants feed retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch shared feed');
  }
});

// 15. FOUNDATION TRACKER (shared across staff)
app.get('/api/foundation-tracker', (req, res) => {
  try {
    sendSuccess(res, 200, foundationTracker, 'Foundation tracker retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch foundation tracker');
  }
});

app.post('/api/foundation-tracker', (req, res) => {
  try {
    const allowedStatuses = ['missing', 'uploaded', 'review', 'approved'];
    const { item, status, tracker } = req.body || {};

    if (tracker && typeof tracker === 'object' && !Array.isArray(tracker)) {
      const cleaned = {};
      Object.entries(tracker).forEach(([k, v]) => {
        if (typeof k === 'string' && allowedStatuses.includes(v)) cleaned[k] = v;
      });
      foundationTracker = cleaned;
    } else if (item && status) {
      const key = sanitizeInput(String(item));
      if (!allowedStatuses.includes(status)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status value');
      }
      foundationTracker[key] = status;
    } else {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Provide tracker object or item+status');
    }

    saveStore('foundation_tracker.json', foundationTracker);
    sendSuccess(res, 200, foundationTracker, 'Foundation tracker updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update foundation tracker');
  }
});

// 16. AUDIT LOGS (Admin only)
app.get('/api/qms-audit-logs', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const user = req.query.user || '';
    const action = req.query.action || '';
    const severity = req.query.severity || '';
    let logs = auditLogs.slice();
    if (user)     logs = logs.filter(l => (l.user || '').toLowerCase().includes(user.toLowerCase()));
    if (action)   logs = logs.filter(l => (l.action || '').toLowerCase().includes(action.toLowerCase()));
    if (severity) logs = logs.filter(l => (l.severity || '').toUpperCase() === severity.toUpperCase());
    logs = logs.slice(-limit).reverse();
    sendSuccess(res, 200, logs, 'Audit logs retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch audit logs');
  }
});

// Alias used by admin monitoring panel — returns newest first, supports filters
app.get('/api/audit-logs', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const user = req.query.user || '';
    const action = req.query.action || '';
    const severity = req.query.severity || '';
    let logs = auditLogs.slice();
    if (user)     logs = logs.filter(l => (l.user || '').toLowerCase().includes(user.toLowerCase()));
    if (action)   logs = logs.filter(l => (l.action || '').toLowerCase().includes(action.toLowerCase()));
    if (severity) logs = logs.filter(l => (l.severity || '').toUpperCase() === severity.toUpperCase());
    logs = logs.slice(-limit).reverse();
    sendSuccess(res, 200, logs, 'Audit logs retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch audit logs');
  }
});

// 16. SOURCING ENDPOINTS

// PUBLIC — Submit job application with CV, photo, passport uploads
function handleApplicationUpload(req, res, next) {
  uploadApplication.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'passport', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      console.error('[submit_application] Multer error:', err.message);
      return sendError(res, 400, 'UPLOAD_ERROR', err.message || 'File upload failed');
    }
    next();
  });
}

app.post('/submit_application', handleApplicationUpload, (req, res) => {
  try {
    console.log('[submit_application] body fields:', Object.keys(req.body || {}));
    console.log('[submit_application] files received:', Object.keys(req.files || {}));
    const { fullName, email, phone, jobType, country, remarks } = req.body;
    const positions = req.body['positions[]'] || req.body.positions || [];

    if (!fullName || !email || !phone || !jobType || !country) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Full name, email, phone, job type, and country are required');
    }
    if (!isValidEmail(email)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid email address');
    }
    if (!req.files || !req.files.cv || !req.files.cv[0]) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'CV/Resume is required');
    }

    const application = {
      id: 'APP-' + Date.now(),
      submittedAt: new Date().toISOString(),
      fullName: sanitizeInput(fullName),
      email: sanitizeInput(email),
      phone: sanitizeInput(phone),
      jobType: sanitizeInput(jobType),
      positions: Array.isArray(positions) ? positions.map(p => sanitizeInput(p)) : [sanitizeInput(positions)],
      country: sanitizeInput(country),
      remarks: sanitizeInput(remarks || ''),
      status: 'new',
      files: {
        cv: req.files.cv ? req.files.cv[0].filename : null,
        photo: req.files.photo ? req.files.photo[0].filename : null,
        passport: req.files.passport ? req.files.passport[0].filename : null
      }
    };

    applicantForms.push(application);
    saveStore('applicant_forms.json', applicantForms);

    // Also add to sourcing leads for the dashboard
    sourcingLeads.push({
      _id: application.id,
      id: application.id,
      candidateName: application.fullName,
      email: application.email,
      contactNumber: application.phone,
      jobInterest: application.jobType,
      positions: application.positions,
      country: application.country,
      source: 'Online Application',
      status: 'new',
      submittedAt: application.submittedAt,
      cvFile: application.files.cv ? `/uploads/applications/${application.files.cv}` : null,
      notes: application.remarks
    });
    saveStore('sourcing_leads.json', sourcingLeads);

    logAudit('application-submitted', { id: application.id, name: application.fullName }, req);

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully! We will contact you within 24 hours.',
      applicationId: application.id
    });
  } catch (err) {
    console.error('Application submit error:', err);
    return sendError(res, 500, 'SERVER_ERROR', 'Failed to submit application. Please try again.');
  }
});

// ADMIN — Update application status
app.post('/api/applications/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['new', 'reviewed', 'shortlisted', 'rejected', 'hired'];
    if (!allowed.includes(status)) return sendError(res, 400, 'VALIDATION_ERROR', `Status must be one of: ${allowed.join(', ')}`);
    const app = applicantForms.find(a => a.id === id);
    if (!app) return sendError(res, 404, 'NOT_FOUND', 'Application not found');
    app.status = status;
    // also sync status in sourcingLeads
    const lead = sourcingLeads.find(l => l.id === id || l._id === id);
    if (lead) lead.status = status;
    saveStore('applicant_forms.json', applicantForms);
    saveStore('sourcing_leads.json', sourcingLeads);
    logAudit('application-status-updated', { id, status }, req);
    sendSuccess(res, 200, { id, status }, 'Status updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update status');
  }
});

// GET sourcing leads — merged from sourcingLeads + applicantForms
app.get('/api/sourcing-leads', requireStaffAuth, (req, res) => {
  try {
    // Build a merged list: applicantForms entries not already in sourcingLeads
    const existingIds = new Set(sourcingLeads.map(l => l.id || l._id));
    const fromForms = applicantForms
      .filter(a => !existingIds.has(a.id))
      .map(a => ({
        _id: a.id,
        id: a.id,
        candidateName: a.fullName || a.candidateName || '',
        email: a.email || '',
        contactNumber: a.phone || a.contact || a.contactNumber || '',
        jobInterest: a.jobType || a.position || a.jobInterest || '',
        positions: a.positions || [],
        country: a.country || '',
        source: a._source === 'interested' ? 'Interested Applicant' : 'Online Application',
        status: a.status || 'new',
        submittedAt: a.submittedAt || a.submitted || a.applicationDate || null,
        dateSubmitted: (a.submittedAt || a.submitted || a.applicationDate || '').split('T')[0] || null,
        cvFile: a.files && a.files.cv ? `/uploads/applications/${a.files.cv}` : null,
        notes: a.notes || a.remarks || ''
      }));
    const merged = [...sourcingLeads, ...fromForms];
    sendSuccess(res, 200, merged, 'Sourcing leads retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch sourcing leads');
  }
});

// POST upload medical file
app.post('/api/upload-medical-file', upload.single('file'), (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId is required');
    const lead = sourcingLeads.find(l => l.id === leadId || l._id === leadId);
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    if (lead && fileUrl) lead.medicalFile = fileUrl;
    logAudit('upload-medical-file', { leadId, fileUrl }, req);
    sendSuccess(res, 200, { fileUrl }, 'Medical file uploaded');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to upload medical file');
  }
});

// POST audit log entry
app.post('/api/audit-log', requireStaffAuth, (req, res) => {
  try {
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body
    };
    auditLogs.push(entry);
    sendSuccess(res, 200, { id: entry.id }, 'Audit log recorded');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to record audit log');
  }
});

// POST send WhatsApp alert (mock — no external service)
app.post('/api/send-whatsapp-alert', (req, res) => {
  try {
    const { leadId, candidateName, phoneNumber } = req.body;
    if (!leadId || !candidateName) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId and candidateName are required');
    logAudit('whatsapp-alert', { leadId, candidateName, phoneNumber }, req);
    sendSuccess(res, 200, { sent: true, mode: 'mock' }, `WhatsApp alert queued for ${candidateName}`);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to send WhatsApp alert');
  }
});

// POST send partner notification (mock — no external email service)
app.post('/api/send-partner-notification', (req, res) => {
  try {
    const { leadId, candidateName } = req.body;
    if (!leadId || !candidateName) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId and candidateName are required');
    logAudit('partner-notification', { leadId, candidateName }, req);
    sendSuccess(res, 200, { sent: true, mode: 'mock' }, `Partner notification queued for ${candidateName}`);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to send partner notification');
  }
});

// POST competence note
app.post('/api/competence-note', (req, res) => {
  try {
    const { leadId, note } = req.body;
    if (!leadId) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId is required');
    const entry = { id: Date.now().toString(), leadId, note, timestamp: new Date().toISOString() };
    competenceNotes.push(entry);
    const lead = sourcingLeads.find(l => l.id === leadId || l._id === leadId);
    if (lead) lead.notes = note;
    sendSuccess(res, 200, { id: entry.id }, 'Competence note saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to save competence note');
  }
});

// POST staff performance tracking
app.post('/api/staff-performance', requireStaffAuth, (req, res) => {
  try {
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body
    };
    staffPerformance.push(entry);
    sendSuccess(res, 200, { id: entry.id }, 'Performance tracked');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to track performance');
  }
});

// GET marketing agents for intake routing
app.get('/api/marketing-agents', (req, res) => {
  try {
    const activeOnly = String(req.query.activeOnly || 'false').toLowerCase() === 'true';
    const list = activeOnly ? marketingAgents.filter(a => (a.status || 'active') === 'active') : marketingAgents;
    // Legacy clients expect a plain array.
    res.status(200).json(list);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch marketing agents');
  }
});

// Interested applicants intake + pipeline source
app.post('/api/interested-applicants', (req, res) => {
  try {
    const {
      fullName,
      mobileNumber,
      location,
      positionApplied,
      source,
      agentId,
      remarks,
      followUpDate,
      isQualified
    } = req.body || {};

    if (!fullName || !mobileNumber) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'fullName and mobileNumber are required');
    }

    const item = {
      id: 'INT-' + Date.now(),
      fullName: sanitizeInput(fullName),
      mobileNumber: sanitizeInput(mobileNumber),
      location: sanitizeInput(location || ''),
      positionApplied: sanitizeInput(positionApplied || ''),
      source: sanitizeInput(source || 'Walk-in'),
      agentId: sanitizeInput(agentId || ''),
      remarks: sanitizeInput(remarks || ''),
      followUpDate: sanitizeInput(followUpDate || ''),
      isQualified: typeof isQualified === 'boolean' ? isQualified : null,
      status: 'interested',
      createdAt: new Date().toISOString()
    };

    interestedApplicants.push(item);
    saveStore('interested_applicants.json', interestedApplicants);
    logAudit('interested-applicant-added', { id: item.id, fullName: item.fullName, source: item.source }, req);

    sendSuccess(res, 201, item, 'Interested applicant saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to save interested applicant');
  }
});

app.get('/api/interested-applicants', (req, res) => {
  try {
    const { period, search = '', limit = 200, offset = 0 } = req.query;
    let list = [...interestedApplicants];

    if (period) {
      const month = String(period);
      list = list.filter(i => (i.createdAt || '').startsWith(month) || (i.followUpDate || '').startsWith(month));
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(i =>
        (i.fullName || '').toLowerCase().includes(q) ||
        (i.mobileNumber || '').toLowerCase().includes(q) ||
        (i.positionApplied || '').toLowerCase().includes(q)
      );
    }

    list = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const interestedLeads = interestedApplicants.length;
    const officialApplicants = applicantForms.length;

    const parsedOffset = parseInt(offset, 10) || 0;
    const parsedLimit = parseInt(limit, 10) || 200;
    const paginated = list.slice(parsedOffset, parsedOffset + parsedLimit);

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Interested applicants retrieved',
      items: paginated,
      pagination: { total: list.length, limit: parsedLimit, offset: parsedOffset },
      pipeline: { interestedLeads, officialApplicants },
      data: {
        items: paginated,
        pagination: { total: list.length, limit: parsedLimit, offset: parsedOffset },
        pipeline: { interestedLeads, officialApplicants }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch interested applicants');
  }
});

// Audit & improvement reporting helpers
function normalizeCaseStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'RESOLVED';
  if (s === 'in progress') return 'IN PROGRESS';
  return 'OPEN';
}

function getPeriodBounds(period) {
  const month = /^\d{4}-\d{2}$/.test(String(period || '')) ? String(period) : new Date().toISOString().slice(0, 7);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { month, start, end };
}

// Welfare cases formatted for reporting module
app.get('/api/welfare-cases', (req, res) => {
  try {
    const { period, status, search = '', limit = 500 } = req.query;
    const { month } = getPeriodBounds(period);

    let cases = welfareComplaints
      .filter(c => !period || (c.date || '').startsWith(month))
      .map(c => ({
        caseId: c.referenceNo || c.id,
        applicantName: c.applicantName || c.workerName || '',
        fraPartner: c.agencyName || c.employerName || c.location || 'Unknown',
        country: c.location || 'N/A',
        reasonOfComplaint: c.description || '',
        category: c.category || 'General Grievance',
        urgency: (c.urgency || 'medium').toUpperCase(),
        status: normalizeCaseStatus(c.status),
        createdAt: c.date,
        updatedAt: c.updatedAt || c.date
      }));

    if (status) {
      const wanted = String(status).toUpperCase();
      cases = cases.filter(c => c.status === wanted);
    }
    if (search) {
      const q = String(search).toLowerCase();
      cases = cases.filter(c =>
        (c.caseId || '').toLowerCase().includes(q) ||
        (c.applicantName || '').toLowerCase().includes(q) ||
        (c.fraPartner || '').toLowerCase().includes(q) ||
        (c.reasonOfComplaint || '').toLowerCase().includes(q)
      );
    }

    const parsedLimit = parseInt(limit, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) cases = cases.slice(0, parsedLimit);

    // Legacy clients expect a plain array.
    res.status(200).json(cases);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch welfare cases');
  }
});

// Audit & Improvement monthly KPI endpoint used by Module 6 report
app.get('/api/monthly-report', (req, res) => {
  try {
    const { period } = req.query;
    const { month, start, end } = getPeriodBounds(period);

    const inMonth = (isoDate) => {
      if (!isoDate) return false;
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d < end;
    };

    const monthLeads = interestedApplicants.filter(i => inMonth(i.createdAt));
    const monthApplicants = applicantForms.filter(a => inMonth(a.submitted || a.submittedAt || a.createdAt));
    const monthCases = welfareComplaints.filter(c => inMonth(c.date));
    const monthExpenses = expenses.filter(e => inMonth(e.createdAt || e.dateIncurred));

    const selectedCount = sourcingLeads.filter(l => {
      const s = String(l.status || '').toLowerCase();
      return inMonth(l.submittedAt || l.createdAt) && (s === 'selected' || s === 'shortlisted' || s === 'approved');
    }).length;

    const deployedCount = sourcingLeads.filter(l => {
      const s = String(l.status || '').toLowerCase();
      return inMonth(l.submittedAt || l.createdAt) && (s === 'deployed' || s === 'hired');
    }).length;

    const complaints = monthCases.length;
    const totalCashOutflow = monthExpenses.reduce((sum, e) => sum + (parseFloat(e.amountPhp) || 0), 0);

    const resolved = monthCases.filter(c => normalizeCaseStatus(c.status) === 'RESOLVED').length;
    const openCases = monthCases.filter(c => normalizeCaseStatus(c.status) !== 'RESOLVED').length;
    const resolutionRate = complaints ? Math.round((resolved / complaints) * 100) : 100;

    const responseData = {
      period: month,
      periodLabel: month,
      generatedAt: new Date().toISOString(),
      kpi: {
        selected: selectedCount,
        deployed: deployedCount,
        complaints,
        totalCashOutflow
      },
      auditImprovement: {
        openFindings: openCases,
        resolvedFindings: resolved,
        resolutionRate,
        leadsCaptured: monthLeads.length,
        officialApplicants: monthApplicants.length
      }
    };

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Monthly report generated',
      ...responseData,
      data: responseData,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to generate monthly report');
  }
});

// Improvement register – System #7 Audit & Improvement
app.get('/api/audit-improvements', (req, res) => {
  try {
    const { status, severity, system, owner, overdueOnly, limit = 200 } = req.query;
    const list = auditModule.filterRecords(auditImprovementItems, {
      status, severity, system, owner,
      overdueOnly: overdueOnly === 'true' || overdueOnly === '1',
      limit,
    });
    // Enrich each record with computed fields
    const enriched = list.map(r => ({
      ...r,
      isOverdue: auditModule.isOverdue(r),
      daysOpen: auditModule.daysOpen(r),
    }));
    sendSuccess(res, 200, enriched, 'Audit improvement register retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch audit improvements');
  }
});

app.post('/api/audit-improvements', (req, res) => {
  try {
    const { title, finding, owner, dueDate, severity } = req.body || {};
    if (!title && !finding) return sendError(res, 400, 'VALIDATION_ERROR', 'title or finding is required');

    const item = {
      id: 'AIM-' + Date.now(),
      title: sanitizeInput(title || finding),
      finding: sanitizeInput(finding || title),
      owner: sanitizeInput(owner || 'Unassigned'),
      severity: sanitizeInput((severity || 'medium').toLowerCase()),
      dueDate: sanitizeInput(dueDate || ''),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    auditImprovementItems.push(item);
    saveStore('audit_improvement_items.json', auditImprovementItems);
    logAudit('audit-improvement-added', { id: item.id, title: item.title, owner: item.owner }, req);

    sendSuccess(res, 201, item, 'Audit improvement item created');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to create audit improvement item');
  }
});

app.patch('/api/audit-improvements/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body || {};
    const allowed = ['open', 'in progress', 'closed', 'resolved'];
    const next = String(status || '').toLowerCase();
    if (!allowed.includes(next)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status');

    const item = auditImprovementItems.find(i => i.id === id);
    if (!item) return sendError(res, 404, 'NOT_FOUND', 'Audit improvement item not found');

    item.status = next;
    item.note = sanitizeInput(note || item.note || '');
    item.updatedAt = new Date().toISOString();
    saveStore('audit_improvement_items.json', auditImprovementItems);
    logAudit('audit-improvement-status-updated', { id, status: next }, req);

    sendSuccess(res, 200, item, 'Audit improvement status updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update audit improvement status');
  }
});

// POST approve lead → move to profiles
app.post('/api/lead-approve', (req, res) => {
  try {
    const { leadId, candidateName, contactNumber, email } = req.body;
    if (!leadId || !candidateName) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId and candidateName are required');
    const profileId = 'PRF-' + Date.now();
    const lead = sourcingLeads.find(l => l.id === leadId || l._id === leadId);
    if (lead) lead.status = 'approved';
    logAudit('lead-approved', { leadId, candidateName, profileId }, req);
    sendSuccess(res, 200, { profileId, approved: true }, `${candidateName} approved`);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to approve lead');
  }
});

// POST reject lead → archive
app.post('/api/lead-reject', (req, res) => {
  try {
    const { leadId, candidateName, reason } = req.body;
    if (!leadId || !candidateName) return sendError(res, 400, 'VALIDATION_ERROR', 'leadId and candidateName are required');
    const lead = sourcingLeads.find(l => l.id === leadId || l._id === leadId);
    if (lead) lead.status = 'rejected';
    logAudit('lead-rejected', { leadId, candidateName, reason }, req);
    sendSuccess(res, 200, { archived: true }, `${candidateName} rejected and archived`);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to reject lead');
  }
});

// GET expenses list
app.get('/api/expenses', (req, res) => {
  try {
    const { status, category, search, limit } = req.query;
    let list = [...expenses].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (status) list = list.filter(e => (e.paymentStatus || '').toUpperCase() === String(status).toUpperCase());
    if (category) list = list.filter(e => (e.category || '').toLowerCase() === String(category).toLowerCase());
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(e =>
        (e.referenceNo || '').toLowerCase().includes(q) ||
        (e.payeeName || '').toLowerCase().includes(q) ||
        (e.particulars || '').toLowerCase().includes(q)
      );

      // Legacy alias: approve by URL parameter
      app.post('/api/lead-approve/:leadId', (req, res) => {
        try {
          const leadId = req.params.leadId;
          const lead = sourcingLeads.find(l => l.id === leadId);
          if (!lead) return sendError(res, 404, 'NOT_FOUND', 'Lead not found');
          const candidateName = sanitizeInput(req.body?.candidateName || lead.name || 'Unknown');
          const profileId = sanitizeInput(req.body?.profileId || '');
          lead.status = 'approved';
          logAudit('lead-approved', { leadId, candidateName, profileId }, req);
          sendSuccess(res, 200, { approved: true }, `${candidateName} approved`);
        } catch (err) {
          sendError(res, 500, 'SERVER_ERROR', 'Failed to approve lead');
        }
      });
    }

    const parsedLimit = parseInt(limit, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      list = list.slice(0, parsedLimit);
    }

    const totalAmount = list.reduce((sum, item) => sum + (parseFloat(item.amountPhp) || 0), 0);
    sendSuccess(res, 200, { items: list, totalAmount, count: list.length }, 'Expenses retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch expenses');
  }
});

// Legacy alias: reject by URL parameter
app.post('/api/lead-reject/:leadId', (req, res) => {
  try {
    const leadId = req.params.leadId;
    const lead = sourcingLeads.find(l => l.id === leadId);
    if (!lead) return sendError(res, 404, 'NOT_FOUND', 'Lead not found');
    const candidateName = sanitizeInput(req.body?.candidateName || lead.name || 'Unknown');
    const reason = sanitizeInput(req.body?.reason || 'No reason provided');
    if (lead) lead.status = 'rejected';
    logAudit('lead-rejected', { leadId, candidateName, reason }, req);
    sendSuccess(res, 200, { archived: true }, `${candidateName} rejected and archived`);
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to reject lead');
  }
});

// Legacy alias: GET /api/expense
app.get('/api/expense', (req, res) => {
  try {
    req.query = req.query || {};
    return res.redirect('/api/expenses');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch expenses');
  }
});

// POST save expense voucher
app.post('/api/expenses', (req, res) => {
  try {
    const { referenceNo, dateIncurred, category, payeeName, particulars, amountPhp, paymentStatus, agentId, period } = req.body;
    if (!category) return sendError(res, 400, 'VALIDATION_ERROR', 'Category is required');
    if (!amountPhp || amountPhp <= 0) return sendError(res, 400, 'VALIDATION_ERROR', 'Valid amount is required');
    const expense = {
      id: 'EXP-' + Date.now(),
      referenceNo: sanitizeInput(referenceNo || ''),
      dateIncurred: sanitizeInput(dateIncurred || new Date().toISOString().slice(0, 10)),
      category: sanitizeInput(category),
      payeeName: sanitizeInput(payeeName || ''),
      particulars: sanitizeInput(particulars || ''),
      amountPhp: parseFloat(amountPhp) || 0,
      paymentStatus: sanitizeInput(paymentStatus || 'PAID'),
      agentId: agentId ? sanitizeInput(agentId) : undefined,
      period: sanitizeInput(period || ''),
      createdAt: new Date().toISOString()
    };
    expenses.push(expense);
    saveStore('expenses.json', expenses);
    logAudit('expense-saved', { id: expense.id, referenceNo: expense.referenceNo, amount: expense.amountPhp }, req);
    sendSuccess(res, 201, expense, 'Expense voucher saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to save expense');
  }
});

// Legacy alias: POST /api/expense
app.post('/api/expense', (req, res) => {
  try {
    const { referenceNo, dateIncurred, category, payeeName, particulars, amountPhp, paymentStatus, agentId, period } = req.body;
    if (!category) return sendError(res, 400, 'VALIDATION_ERROR', 'Category is required');
    if (!amountPhp || amountPhp <= 0) return sendError(res, 400, 'VALIDATION_ERROR', 'Valid amount is required');
    const expense = {
      id: 'EXP-' + Date.now(),
      referenceNo: sanitizeInput(referenceNo || ''),
      dateIncurred: sanitizeInput(dateIncurred || new Date().toISOString().slice(0, 10)),
      category: sanitizeInput(category),
      payeeName: sanitizeInput(payeeName || ''),
      particulars: sanitizeInput(particulars || ''),
      amountPhp: parseFloat(amountPhp) || 0,
      paymentStatus: sanitizeInput(paymentStatus || 'PAID'),
      agentId: agentId ? sanitizeInput(agentId) : undefined,
      period: sanitizeInput(period || ''),
      createdAt: new Date().toISOString()
    };
    expenses.push(expense);
    saveStore('expenses.json', expenses);
    logAudit('expense-saved', { id: expense.id, referenceNo: expense.referenceNo, amount: expense.amountPhp }, req);
    sendSuccess(res, 201, expense, 'Expense voucher saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to save expense');
  }
});

// Summary endpoint used by reports
app.get('/api/expenses/summary', (req, res) => {
  try {
    const { period } = req.query;
    let list = [...expenses];
    if (period) list = list.filter(e => (e.period || '').startsWith(String(period)) || (e.dateIncurred || '').startsWith(String(period)));
    const total = list.reduce((sum, item) => sum + (parseFloat(item.amountPhp) || 0), 0);
    const byCategory = list.reduce((acc, item) => {
      const key = item.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + (parseFloat(item.amountPhp) || 0);
      return acc;
    }, {});
    const byStatus = list.reduce((acc, item) => {
      const key = (item.paymentStatus || 'UNKNOWN').toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const directCategories = ['medical', 'biometric', 'tesda', 'deployment', 'processing', 'visa'];
    const operatingCategories = ['utilities', 'transportation', 'office supplies', 'rent', 'internet', 'salary', 'operations'];
    const incentivesCategories = ['marketing', 'commission', 'cash advance', 'incentives'];

    const sumFor = (pred) => list.reduce((sum, item) => {
      const cat = String(item.category || '').toLowerCase();
      return pred(cat) ? sum + (parseFloat(item.amountPhp) || 0) : sum;
    }, 0);

    const directCosts = sumFor(cat => directCategories.some(c => cat.includes(c)));
    const operatingCosts = sumFor(cat => operatingCategories.some(c => cat.includes(c)));
    const incentives = sumFor(cat => incentivesCategories.some(c => cat.includes(c)));

    const payload = {
      total,
      grandTotal: total,
      count: list.length,
      byStatus,
      byCategory,
      directCosts,
      operatingCosts,
      incentives,
      locked: false
    };

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Expense summary retrieved',
      ...payload,
      data: payload,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to compute expense summary');
  }
});

// Legacy compatibility: save expense endpoint used by older dashboards
app.post('/api/save-expense', (req, res) => {
  try {
    const { referenceNo, dateIncurred, category, payeeName, particulars, amountPhp, paymentStatus, agentId, period } = req.body || {};
    if (!category) return sendError(res, 400, 'VALIDATION_ERROR', 'Category is required');
    if (!amountPhp || amountPhp <= 0) return sendError(res, 400, 'VALIDATION_ERROR', 'Valid amount is required');

    const expense = {
      id: 'EXP-' + Date.now(),
      referenceNo: sanitizeInput(referenceNo || ''),
      dateIncurred: sanitizeInput(dateIncurred || new Date().toISOString().slice(0, 10)),
      category: sanitizeInput(category),
      payeeName: sanitizeInput(payeeName || ''),
      particulars: sanitizeInput(particulars || ''),
      amountPhp: parseFloat(amountPhp) || 0,
      paymentStatus: sanitizeInput(paymentStatus || 'PAID'),
      agentId: agentId ? sanitizeInput(agentId) : undefined,
      period: sanitizeInput(period || ''),
      createdAt: new Date().toISOString()
    };

    expenses.push(expense);
    saveStore('expenses.json', expenses);
    logAudit('expense-saved-legacy', { id: expense.id, referenceNo: expense.referenceNo, amount: expense.amountPhp }, req);
    sendSuccess(res, 201, expense, 'Expense saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to save expense');
  }
});

// Legacy compatibility: voucher upload endpoint used by older dashboards
app.post('/api/upload-voucher', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, 'VALIDATION_ERROR', 'Voucher file is required');
    const voucher = {
      id: 'VCH-' + Date.now(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/qms_docs/${req.file.filename}`,
      uploadedAt: new Date().toISOString()
    };
    logAudit('voucher-uploaded', { id: voucher.id, file: voucher.originalName }, req);
    sendSuccess(res, 201, voucher, 'Voucher uploaded');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to upload voucher');
  }
});

// PATCH update voucher payment status
app.patch('/api/expenses/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body || {};
    const allowed = ['PAID', 'PENDING', 'CANCELLED'];
    const nextStatus = String(paymentStatus || '').toUpperCase();

    if (!allowed.includes(nextStatus)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid payment status');
    }

    const expense = expenses.find(e => e.id === id);
    if (!expense) return sendError(res, 404, 'NOT_FOUND', 'Voucher not found');

    expense.paymentStatus = nextStatus;
    expense.updatedAt = new Date().toISOString();
    saveStore('expenses.json', expenses);
    logAudit('expense-status-updated', { id: expense.id, status: expense.paymentStatus }, req);
    sendSuccess(res, 200, expense, 'Voucher status updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update voucher status');
  }
});

// ── REPATRIATED WORKERS REGISTRY ─────────────────────────────────────────────
let repatriatedWorkers = loadStore('repatriated_workers.json');

// GET all — public live view (no auth needed for staff sharing)
app.get('/api/repatriated/live', (req, res) => {
  try {
    const { q, agent, legal, country } = req.query;
    let list = [...repatriatedWorkers];
    if (q) {
      const qL = String(q).toLowerCase();
      list = list.filter(r =>
        (r.workerName||'').toLowerCase().includes(qL) ||
        (r.agent||'').toLowerCase().includes(qL) ||
        (r.notes||'').toLowerCase().includes(qL) ||
        (r.country||'').toLowerCase().includes(qL)
      );
    }
    if (agent) list = list.filter(r => (r.agent||'').toLowerCase() === String(agent).toLowerCase());
    if (legal === 'true') list = list.filter(r => r.hasLegalCase);
    if (country) list = list.filter(r => (r.country||'').toLowerCase().includes(String(country).toLowerCase()));
    const agents = [...new Set(repatriatedWorkers.map(r => r.agent).filter(Boolean))].sort();
    sendSuccess(res, 200, { records: list, total: list.length, agents }, 'Repatriated workers retrieved');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to load records'); }
});

app.post('/api/repatriated', requireStaffAuth, (req, res) => {
  try {
    const { workerName, passportNo, agent, country, repatriationDate, repatriationReason, notes, hasLegalCase, comDeductDate } = req.body;
    if (!workerName) return sendError(res, 400, 'VALIDATION_ERROR', 'Worker name is required');
    const rec = {
      id: 'RPT-' + Date.now(),
      no: repatriatedWorkers.length + 1,
      workerName: sanitizeInput(workerName),
      passportNo: sanitizeInput(passportNo || ''),
      agent: sanitizeInput(agent || ''),
      country: sanitizeInput(country || 'Saudi Arabia'),
      repatriationDate: sanitizeInput(repatriationDate || ''),
      repatriationReason: sanitizeInput(repatriationReason || ''),
      notes: sanitizeInput(notes || ''),
      hasLegalCase: Boolean(hasLegalCase),
      comDeductDate: sanitizeInput(comDeductDate || ''),
      createdAt: new Date().toISOString()
    };
    repatriatedWorkers.push(rec);
    saveStore('repatriated_workers.json', repatriatedWorkers);
    logAudit('repatriated-add', { id: rec.id, name: rec.workerName }, req);
    sendSuccess(res, 201, rec, 'Repatriated worker record added');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to add record'); }
});

app.patch('/api/repatriated/:id', requireStaffAuth, (req, res) => {
  try {
    const rec = repatriatedWorkers.find(r => r.id === req.params.id);
    if (!rec) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const allowed = ['workerName','passportNo','agent','country','repatriationDate','repatriationReason','notes','hasLegalCase','comDeductDate'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'hasLegalCase') rec[f] = Boolean(req.body[f]);
        else rec[f] = sanitizeInput(String(req.body[f]));
      }
    });
    saveStore('repatriated_workers.json', repatriatedWorkers);
    logAudit('repatriated-update', { id: rec.id, name: rec.workerName }, req);
    sendSuccess(res, 200, rec, 'Record updated');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update record'); }
});

app.delete('/api/repatriated/:id', requireAdminDeleteCode, (req, res) => {
  try {
    const idx = repatriatedWorkers.findIndex(r => r.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const [removed] = repatriatedWorkers.splice(idx, 1);
    saveStore('repatriated_workers.json', repatriatedWorkers);
    logAudit('repatriated-delete', { id: removed.id, name: removed.workerName }, req);
    sendSuccess(res, 200, { id: removed.id }, 'Record deleted');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to delete record'); }
});

// ── PRIVATE OWNER-ONLY APPLICANT FINANCE MODULE ────────────────────────────
app.get('/admin/private-finance', requireOwnerOnly, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'private_finance_admin.html'));
});

function normalizeFlag(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return 'pending';
  if (['yes', 'y', 'true', '1', 'done', 'complete', 'completed'].includes(v)) return 'yes';
  if (['no', 'n', 'false', '0'].includes(v)) return 'no';
  return 'pending';
}

function normalizeStatus(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('repatri')) return 'repatriated';
  if (v.includes('deploy')) return 'deployed';
  if (v.includes('not') && v.includes('deploy')) return 'not_deployed';
  if (v.includes('pending')) return 'pending';
  return 'pending';
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function surnameKey(name) {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(' ');
  return String(parts[parts.length - 1] || '').toUpperCase();
}

function normalizePrivateRecord(input) {
  const applicantName = sanitizeInput(input.applicantName || input.name || input.applicant || '');
  const familyGroup = sanitizeInput(input.familyGroup || input.family || input.familyRelation || '');
  return {
    id: input.id || ('PVT-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000)),
    applicantName,
    agent: sanitizeInput(input.agent || input.agentName || ''),
    amount: normalizeMoney(input.amount || input.amountPaid || input.paymentAmount || 0),
    paymentDate: sanitizeInput(input.paymentDate || input.datePaid || ''),
    tesda: normalizeFlag(input.tesda),
    medical: normalizeFlag(input.medical),
    oec: normalizeFlag(input.oec),
    status: normalizeStatus(input.status || input.deploymentStatus),
    familyGroup,
    familySurname: surnameKey(applicantName),
    notes: sanitizeInput(input.notes || ''),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function parseSimpleCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });
    return row;
  });
}

function privateFinanceAnalytics(records) {
  const all = Array.isArray(records) ? records : [];
  const byFamily = new Map();
  all.forEach(r => {
    const familyKey = String(r.familyGroup || r.familySurname || '').trim().toUpperCase();
    if (!familyKey) return;
    if (!byFamily.has(familyKey)) byFamily.set(familyKey, []);
    byFamily.get(familyKey).push(r);
  });

  const familyClusters = Array.from(byFamily.entries())
    .map(([family, members]) => ({
      family,
      count: members.length,
      members: members.map(m => ({
        id: m.id,
        applicantName: m.applicantName,
        status: m.status,
        amount: m.amount,
        agent: m.agent
      }))
    }))
    .filter(c => c.count >= 2)
    .sort((a, b) => b.count - a.count);

  const repatriatedNotDeployed = all.filter(r => r.status === 'repatriated' || r.status === 'not_deployed');

  return {
    totalRecords: all.length,
    totalAmount: all.reduce((sum, r) => sum + (r.amount || 0), 0),
    deployed: all.filter(r => r.status === 'deployed').length,
    repatriated: all.filter(r => r.status === 'repatriated').length,
    notDeployed: all.filter(r => r.status === 'not_deployed').length,
    familyClusters,
    repatriatedNotDeployed
  };
}

app.get('/api/private-finance/records', requireOwnerOnly, (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase();
    const status = String(req.query.status || '').toLowerCase();
    const family = String(req.query.family || '').toLowerCase();

    let list = [...privateFinanceRecords];
    if (q) {
      list = list.filter(r =>
        String(r.applicantName || '').toLowerCase().includes(q) ||
        String(r.agent || '').toLowerCase().includes(q) ||
        String(r.familyGroup || '').toLowerCase().includes(q) ||
        String(r.familySurname || '').toLowerCase().includes(q)
      );
    }
    if (status) list = list.filter(r => String(r.status || '').toLowerCase() === status);
    if (family) list = list.filter(r => String(r.familyGroup || r.familySurname || '').toLowerCase().includes(family));

    sendSuccess(res, 200, {
      records: list,
      analytics: privateFinanceAnalytics(privateFinanceRecords)
    }, 'Private finance records retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch private finance records');
  }
});

app.post('/api/private-finance/records', requireOwnerOnly, (req, res) => {
  try {
    const rec = normalizePrivateRecord(req.body || {});
    if (!rec.applicantName) return sendError(res, 400, 'VALIDATION_ERROR', 'Applicant name is required');
    privateFinanceRecords.push(rec);
    saveStore('private_applicant_finance.json', privateFinanceRecords);
    logAudit('private-finance-add', { id: rec.id, applicantName: rec.applicantName }, req);
    sendSuccess(res, 201, rec, 'Private finance record added');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to add private finance record');
  }
});

app.patch('/api/private-finance/records/:id', requireOwnerOnly, (req, res) => {
  try {
    const idx = privateFinanceRecords.findIndex(r => r.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const merged = { ...privateFinanceRecords[idx], ...(req.body || {}) };
    const normalized = normalizePrivateRecord(merged);
    normalized.id = privateFinanceRecords[idx].id;
    normalized.createdAt = privateFinanceRecords[idx].createdAt || normalized.createdAt;
    privateFinanceRecords[idx] = normalized;
    saveStore('private_applicant_finance.json', privateFinanceRecords);
    logAudit('private-finance-update', { id: normalized.id }, req);
    sendSuccess(res, 200, normalized, 'Private finance record updated');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update private finance record');
  }
});

app.delete('/api/private-finance/records/:id', requireOwnerOnly, (req, res) => {
  try {
    const idx = privateFinanceRecords.findIndex(r => r.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const [removed] = privateFinanceRecords.splice(idx, 1);
    saveStore('private_applicant_finance.json', privateFinanceRecords);
    logAudit('private-finance-delete', { id: removed.id }, req);
    sendSuccess(res, 200, { id: removed.id }, 'Private finance record deleted');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to delete private finance record');
  }
});

app.post('/api/private-finance/import', requireOwnerOnly, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, 'VALIDATION_ERROR', 'Import file is required');
    const ext = String(path.extname(req.file.originalname || '')).toLowerCase();
    const abs = req.file.path;

    let rows = [];
    if (ext === '.json') {
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
      rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : []);
    } else if (ext === '.xlsx' || ext === '.xls') {
      const wb = XLSX.readFile(abs);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      rows = parseSimpleCsv(fs.readFileSync(abs, 'utf8'));
    }

    const mapped = rows.map(normalizePrivateRecord).filter(r => r.applicantName);
    if (!mapped.length) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid rows found in import file');

    privateFinanceRecords = mapped;
    saveStore('private_applicant_finance.json', privateFinanceRecords);
    logAudit('private-finance-import', { rows: mapped.length, file: req.file.originalname }, req);
    sendSuccess(res, 200, {
      imported: mapped.length,
      analytics: privateFinanceAnalytics(privateFinanceRecords)
    }, 'Private finance data imported');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to import private finance data');
  }
});

app.post('/api/private-finance/import-from-data', requireOwnerOnly, (req, res) => {
  try {
    const rawName = String(req.body?.filename || '').trim();
    if (!rawName) return sendError(res, 400, 'VALIDATION_ERROR', 'filename is required');

    const safeName = path.basename(rawName);
    const abs = path.join(dataDir, safeName);
    if (!fs.existsSync(abs)) return sendError(res, 404, 'NOT_FOUND', 'File not found in data folder');

    const ext = String(path.extname(safeName || '')).toLowerCase();
    let rows = [];

    if (ext === '.json') {
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
      rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : []);
    } else if (ext === '.xlsx' || ext === '.xls') {
      const wb = XLSX.readFile(abs);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      rows = parseSimpleCsv(fs.readFileSync(abs, 'utf8'));
    }

    const mapped = rows.map(normalizePrivateRecord).filter(r => r.applicantName);
    if (!mapped.length) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid rows found in file');

    privateFinanceRecords = mapped;
    saveStore('private_applicant_finance.json', privateFinanceRecords);
    logAudit('private-finance-import-from-data', { rows: mapped.length, file: safeName }, req);
    sendSuccess(res, 200, {
      imported: mapped.length,
      analytics: privateFinanceAnalytics(privateFinanceRecords)
    }, 'Private finance data loaded from data folder');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to import private finance data from data folder');
  }
});

app.get('/api/private-finance/analytics', requireOwnerOnly, (req, res) => {
  try {
    sendSuccess(res, 200, privateFinanceAnalytics(privateFinanceRecords), 'Private finance analytics retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to compute analytics');
  }
});

// ── FRA DEPLOYMENT LEDGER ────────────────────────────────────────────────────
let fraDeploymentLedger = loadStore('fra_deployment_ledger.json');

function buildFraLedgerSummary(list) {
  const records = Array.isArray(list) ? list : [];
  const total = records.length;
  const totalValue = records.reduce((s, r) => s + (r.value || 0), 0);
  const replacements = records.filter(r => (r.status || '').toLowerCase() === 'replacement').length;
  const welfareNeeded = records.filter(r => {
    if (!r.arrivalDate || r.welfareCheckDone) return false;
    const days = (Date.now() - new Date(r.arrivalDate).getTime()) / 86400000;
    return days >= 75;
  }).length;
  return { records, total, totalValue, replacements, welfareNeeded };
}

// Public read-only live report for staff sharing
app.get('/api/fra/ledger/live', (req, res) => {
  try {
    const { status, search, month, fra } = req.query;
    let list = [...fraDeploymentLedger];
    if (status) list = list.filter(r => (r.status || '').toLowerCase() === String(status).toLowerCase());
    if (month) list = list.filter(r => (r.arrivalDate || '').startsWith(String(month)));
    if (fra) list = list.filter(r => (r.fraName || '').toLowerCase().includes(String(fra).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(r =>
        (r.workerName || '').toLowerCase().includes(q) ||
        (r.passportNo || '').toLowerCase().includes(q) ||
        (r.employer || '').toLowerCase().includes(q) ||
        (r.clientId || '').toLowerCase().includes(q) ||
        (r.fraName || '').toLowerCase().includes(q) ||
        (r.replacedApplicantName || '').toLowerCase().includes(q)
      );
    }
    const safeList = list.map(r => ({
      id: r.id,
      no: r.no,
      workerName: r.workerName,
      passportNo: r.passportNo,
      employer: r.employer,
      clientId: r.clientId,
      arrivalDate: r.arrivalDate,
      value: r.value,
      status: r.status,
      position: r.position,
      country: r.country,
      fraName: r.fraName || '',
      replacedApplicantName: r.replacedApplicantName || '',
      notes: r.notes,
      welfareCheckDone: !!r.welfareCheckDone,
      replacementReason: r.replacementReason || '',
      batchTag: r.batchTag || '',
      deploymentDate: r.deploymentDate || ''
    }));
    res.set('Cache-Control', 'no-store');
    sendSuccess(res, 200, buildFraLedgerSummary(safeList), 'Live FRA ledger retrieved');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch live ledger'); }
});

app.get('/api/fra/ledger', requireStaffAuth, (req, res) => {
  try {
    const { status, search, month, fra } = req.query;
    let list = [...fraDeploymentLedger];
    if (status) list = list.filter(r => (r.status||'').toLowerCase() === String(status).toLowerCase());
    if (month) list = list.filter(r => (r.arrivalDate||'').startsWith(String(month)));
    if (fra) list = list.filter(r => (r.fraName||'').toLowerCase().includes(String(fra).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(r =>
        (r.workerName||'').toLowerCase().includes(q) ||
        (r.passportNo||'').toLowerCase().includes(q) ||
        (r.employer||'').toLowerCase().includes(q) ||
        (r.clientId||'').toLowerCase().includes(q) ||
        (r.fraName||'').toLowerCase().includes(q) ||
        (r.replacedApplicantName||'').toLowerCase().includes(q)
      );
    }
    sendSuccess(res, 200, buildFraLedgerSummary(list));
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch ledger'); }
});

app.post('/api/fra/ledger', requireStaffAuth, (req, res) => {
  try {
    const { workerName, passportNo, employer, clientId, arrivalDate, value, status, position, country, notes, fraName, replacedApplicantName, replacementReason, repatriationDate, repatriationReason } = req.body;
    if (!workerName) return sendError(res, 400, 'VALIDATION_ERROR', 'Worker name is required');
    const normalizedStatus = sanitizeInput(status || 'Deployed');
    const numericValue = parseFloat(value) || 0;
    const rec = {
      id: 'FDL-' + Date.now(),
      no: fraDeploymentLedger.length + 1,
      workerName: sanitizeInput(workerName),
      passportNo: sanitizeInput(passportNo || ''),
      employer: sanitizeInput(employer || ''),
      clientId: sanitizeInput(clientId || ''),
      arrivalDate: sanitizeInput(arrivalDate || ''),
      value: normalizedStatus.toLowerCase() === 'replacement' ? 0 : numericValue,
      status: normalizedStatus,
      position: sanitizeInput(position || 'Household Service Worker'),
      country: sanitizeInput(country || 'Saudi Arabia'),
      fraName: sanitizeInput(fraName || ''),
      replacedApplicantName: sanitizeInput(replacedApplicantName || ''),
      notes: sanitizeInput(notes || ''),
      repatriationDate: sanitizeInput(repatriationDate || ''),
      repatriationReason: sanitizeInput(repatriationReason || ''),
      welfareCheckDone: false,
      replacementReason: sanitizeInput(replacementReason || ''),
      createdAt: new Date().toISOString()
    };
    fraDeploymentLedger.push(rec);
    saveStore('fra_deployment_ledger.json', fraDeploymentLedger);
    logAudit('fra-ledger-add', { id: rec.id, name: rec.workerName }, req);
    sendSuccess(res, 201, rec, 'Record added');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to add record'); }
});

app.patch('/api/fra/ledger/:id', requireStaffAuth, (req, res) => {
  try {
    const rec = fraDeploymentLedger.find(r => r.id === req.params.id);
    if (!rec) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const allowed = ['workerName','passportNo','employer','clientId','arrivalDate','value','status','position','country','notes','welfareCheckDone','replacementReason','fraName','replacedApplicantName','repatriationDate','repatriationReason'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'value') rec[f] = parseFloat(req.body[f]) || 0;
        else if (f === 'welfareCheckDone') rec[f] = Boolean(req.body[f]);
        else rec[f] = sanitizeInput(String(req.body[f]));
      }
    });
    if ((rec.status || '').toLowerCase() === 'replacement') {
      rec.value = 0;
    }
    rec.updatedAt = new Date().toISOString();
    saveStore('fra_deployment_ledger.json', fraDeploymentLedger);
    logAudit('fra-ledger-update', { id: rec.id, name: rec.workerName }, req);
    sendSuccess(res, 200, rec, 'Record updated');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update record'); }
});

app.delete('/api/fra/ledger/:id', requireAdminDeleteCode, (req, res) => {
  try {
    const idx = fraDeploymentLedger.findIndex(r => r.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    const [removed] = fraDeploymentLedger.splice(idx, 1);
    saveStore('fra_deployment_ledger.json', fraDeploymentLedger);
    logAudit('fra-ledger-delete', { id: removed.id, name: removed.workerName }, req);
    sendSuccess(res, 200, {}, 'Record deleted');
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Failed to delete record'); }
});

app.get('/api/fra/ledger/export/csv', requireStaffAuth, (req, res) => {
  try {
    const headers = ['No','FRA Name','Worker Name','Replaced Applicant Name','Passport No','Employer / Client','Client ID No','Arrival Date','Value (USD)','Status','Position','Country','Welfare Check Done','Replacement Reason','Notes'];
    const rows = fraDeploymentLedger.map(r => [
      r.no, r.fraName || '', r.workerName, r.replacedApplicantName || '', r.passportNo, r.employer, r.clientId, r.arrivalDate,
      r.value, r.status, r.position, r.country,
      r.welfareCheckDone ? 'YES' : 'NO',
      (r.replacementReason || '').replace(/,/g,';').replace(/\n/g,' '),
      (r.notes||'').replace(/,/g,';').replace(/\n/g,' ')
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="FRA_Deployment_Ledger_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (e) { sendError(res, 500, 'SERVER_ERROR', 'Export failed'); }
});

// POST add FRA worker
app.post('/api/fra/add-worker', requireStaffAuth, (req, res) => {
  try {
    const { name, position, department, passportNo, nationality, employer, country, contractStart, contractEnd, salary, status } = req.body;
    if (!name) return sendError(res, 400, 'VALIDATION_ERROR', 'Worker name is required');
    const worker = {
      id: 'FRA-' + Date.now(),
      name: sanitizeInput(name),
      position: sanitizeInput(position || ''),
      department: sanitizeInput(department || ''),
      passportNo: sanitizeInput(passportNo || ''),
      nationality: sanitizeInput(nationality || ''),
      employer: sanitizeInput(employer || ''),
      country: sanitizeInput(country || ''),
      contractStart: sanitizeInput(contractStart || ''),
      contractEnd: sanitizeInput(contractEnd || ''),
      salary: parseFloat(salary) || 0,
      status: sanitizeInput(status || 'active'),
      createdAt: new Date().toISOString()
    };
    fraWorkers.push(worker);
    saveStore('fra_workers.json', fraWorkers);
    logAudit('fra-add-worker', { id: worker.id, name: worker.name }, req);
    sendSuccess(res, 201, worker, 'FRA worker added');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to add FRA worker');
  }
});

app.get('/api/fra/workers', requireStaffAuth, (req, res) => {
  try {
    const { search, status, country } = req.query;
    let list = [...fraWorkers];
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(w => (w.name||'').toLowerCase().includes(q) || (w.passportNo||'').toLowerCase().includes(q) || (w.position||'').toLowerCase().includes(q));
    }
    if (status) list = list.filter(w => (w.status||'').toLowerCase() === String(status).toLowerCase());
    if (country) list = list.filter(w => (w.country||'').toLowerCase() === String(country).toLowerCase());
    sendSuccess(res, 200, { workers: list, total: list.length }, 'FRA workers retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch FRA workers');
  }
});

app.patch('/api/fra/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const w = fraWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'FRA worker not found');
    const allowed = ['name','position','department','passportNo','nationality','employer','country','contractStart','contractEnd','salary','status'];
    allowed.forEach(f => { if (req.body[f] !== undefined) w[f] = f === 'salary' ? parseFloat(req.body[f]) || 0 : sanitizeInput(String(req.body[f])); });
    w.updatedAt = new Date().toISOString();
    saveStore('fra_workers.json', fraWorkers);
    logAudit('fra-update-worker', { id: w.id, name: w.name }, req);
    sendSuccess(res, 200, w, 'FRA worker updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update FRA worker');
  }
});

// ── DEPLOYMENT TRACKING ──────────────────────────────────────────────────────
let deploymentRecords = loadStore('deployment_records.json');

app.get('/api/deployments', requireStaffAuth, (req, res) => {
  try {
    const { status, country, search, limit = 100, offset = 0 } = req.query;
    let list = [...deploymentRecords].sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    if (status) list = list.filter(d => (d.status||'').toLowerCase() === String(status).toLowerCase());
    if (country) list = list.filter(d => (d.country||'').toLowerCase().includes(String(country).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(d => (d.applicantName||'').toLowerCase().includes(q) || (d.passportNo||'').toLowerCase().includes(q) || (d.employer||'').toLowerCase().includes(q));
    }
    const total = list.length;
    const paginated = list.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    sendSuccess(res, 200, { deployments: paginated, total, pending: deploymentRecords.filter(d=>(d.status||'')===  'pending').length, deployed: deploymentRecords.filter(d=>(d.status||'')==='deployed').length }, 'Deployments retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch deployments');
  }
});

app.post('/api/deployments', requireStaffAuth, (req, res) => {
  try {
    const { applicantName, passportNo, country, employer, position, flightDate, oecStatus, owwaStatus, insuranceStatus, remarks } = req.body;
    if (!applicantName || !country) return sendError(res, 400, 'VALIDATION_ERROR', 'Applicant name and country are required');
    const record = {
      id: 'DEP-' + Date.now(),
      applicantName: sanitizeInput(applicantName),
      passportNo: sanitizeInput(passportNo || ''),
      country: sanitizeInput(country),
      employer: sanitizeInput(employer || ''),
      position: sanitizeInput(position || ''),
      flightDate: sanitizeInput(flightDate || ''),
      oecStatus: sanitizeInput(oecStatus || 'pending'),
      owwaStatus: sanitizeInput(owwaStatus || 'pending'),
      insuranceStatus: sanitizeInput(insuranceStatus || 'pending'),
      remarks: sanitizeInput(remarks || ''),
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: req.user?.username || 'staff'
    };
    deploymentRecords.push(record);
    saveStore('deployment_records.json', deploymentRecords);
    logAudit('deployment-added', { id: record.id, applicantName: record.applicantName, country: record.country }, req);
    sendSuccess(res, 201, record, 'Deployment record created');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to create deployment record');
  }
});

app.patch('/api/deployments/:id', requireStaffAuth, (req, res) => {
  try {
    const rec = deploymentRecords.find(d => d.id === req.params.id);
    if (!rec) return sendError(res, 404, 'NOT_FOUND', 'Deployment record not found');
    const editable = ['applicantName','passportNo','country','employer','position','flightDate','oecStatus','owwaStatus','insuranceStatus','remarks','status'];
    editable.forEach(f => { if (req.body[f] !== undefined) rec[f] = sanitizeInput(String(req.body[f])); });
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = req.user?.username || 'staff';
    saveStore('deployment_records.json', deploymentRecords);
    logAudit('deployment-updated', { id: rec.id, status: rec.status }, req);
    sendSuccess(res, 200, rec, 'Deployment updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update deployment');
  }
});

app.get('/api/deployments/stats', requireStaffAuth, (req, res) => {
  try {
    const byCountry = deploymentRecords.reduce((acc, d) => { const k = d.country||'Unknown'; acc[k]=(acc[k]||0)+1; return acc; }, {});
    const byStatus  = deploymentRecords.reduce((acc, d) => { const k = d.status||'pending';  acc[k]=(acc[k]||0)+1; return acc; }, {});
    const oecReady  = deploymentRecords.filter(d => d.oecStatus === 'complete').length;
    const owwaReady = deploymentRecords.filter(d => d.owwaStatus === 'complete').length;
    sendSuccess(res, 200, { total: deploymentRecords.length, byCountry, byStatus, oecReady, owwaReady }, 'Deployment stats retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch deployment stats');
  }
});

// ── STAFF MANAGEMENT ─────────────────────────────────────────────────────────
let staffRecords = loadStore('staff_records.json');

app.get('/api/staff', requireStaffAuth, (req, res) => {
  try {
    const { search, role, status } = req.query;
    let list = [...staffRecords];
    if (search) { const q = String(search).toLowerCase(); list = list.filter(s => (s.fullName||'').toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q)); }
    if (role)   list = list.filter(s => (s.role||'').toLowerCase() === String(role).toLowerCase());
    if (status) list = list.filter(s => (s.status||'').toLowerCase() === String(status).toLowerCase());
    sendSuccess(res, 200, { staff: list, total: list.length }, 'Staff retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch staff');
  }
});

app.post('/api/staff', requireStaffAuth, (req, res) => {
  try {
    const { fullName, email, role, department, dateHired, dailyRate, contactNo } = req.body;
    if (!fullName || !role) return sendError(res, 400, 'VALIDATION_ERROR', 'Full name and role are required');
    if (email && !isValidEmail(email)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid email format');
    const record = {
      id: 'STF-' + Date.now(),
      fullName: sanitizeInput(fullName),
      email: email ? email.toLowerCase().trim() : '',
      role: sanitizeInput(role),
      department: sanitizeInput(department || ''),
      dateHired: sanitizeInput(dateHired || ''),
      dailyRate: parseFloat(dailyRate) || 0,
      contactNo: sanitizeInput(contactNo || ''),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    staffRecords.push(record);
    saveStore('staff_records.json', staffRecords);
    logAudit('staff-added', { id: record.id, fullName: record.fullName, role: record.role }, req);
    sendSuccess(res, 201, record, 'Staff record created');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to create staff record');
  }
});

app.patch('/api/staff/:id', requireStaffAuth, (req, res) => {
  try {
    const s = staffRecords.find(x => x.id === req.params.id);
    if (!s) return sendError(res, 404, 'NOT_FOUND', 'Staff record not found');
    const editable = ['fullName','email','role','department','dateHired','dailyRate','contactNo','status'];
    editable.forEach(f => { if (req.body[f] !== undefined) s[f] = f === 'dailyRate' ? parseFloat(req.body[f])||0 : sanitizeInput(String(req.body[f])); });
    s.updatedAt = new Date().toISOString();
    saveStore('staff_records.json', staffRecords);
    logAudit('staff-updated', { id: s.id, fullName: s.fullName }, req);
    sendSuccess(res, 200, s, 'Staff record updated');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to update staff record');
  }
});

// ── ATTENDANCE / DTR ──────────────────────────────────────────────────────────
let attendanceRecords = loadStore('attendance_records.json');

app.get('/api/attendance', requireStaffAuth, (req, res) => {
  try {
    const { staffId, period, search, limit = 200 } = req.query;
    let list = [...attendanceRecords];
    if (staffId) list = list.filter(a => a.staffId === staffId);
    if (period) list = list.filter(a => (a.date||'').startsWith(String(period)));
    if (search) { const q = String(search).toLowerCase(); list = list.filter(a => (a.staffName||'').toLowerCase().includes(q)); }
    list = list.sort((a,b) => new Date(b.date||0) - new Date(a.date||0)).slice(0, parseInt(limit));
    sendSuccess(res, 200, { records: list, total: list.length }, 'Attendance records retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch attendance');
  }
});

app.post('/api/attendance', requireStaffAuth, (req, res) => {
  try {
    const { staffId, staffName, date, timeIn, timeOut, hoursWorked, overtime, status, remarks } = req.body;
    if (!staffName || !date) return sendError(res, 400, 'VALIDATION_ERROR', 'Staff name and date are required');
    const record = {
      id: 'ATT-' + Date.now(),
      staffId: sanitizeInput(staffId || ''),
      staffName: sanitizeInput(staffName),
      date: sanitizeInput(date),
      timeIn: sanitizeInput(timeIn || ''),
      timeOut: sanitizeInput(timeOut || ''),
      hoursWorked: parseFloat(hoursWorked) || 0,
      overtime: parseFloat(overtime) || 0,
      status: sanitizeInput(status || 'present'),
      remarks: sanitizeInput(remarks || ''),
      loggedBy: req.user?.username || 'staff',
      createdAt: new Date().toISOString()
    };
    attendanceRecords.push(record);
    saveStore('attendance_records.json', attendanceRecords);
    sendSuccess(res, 201, record, 'Attendance logged');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to log attendance');
  }
});

app.get('/api/attendance/summary', requireStaffAuth, (req, res) => {
  try {
    const { period } = req.query;
    let list = attendanceRecords;
    if (period) list = list.filter(a => (a.date||'').startsWith(String(period)));
    const present = list.filter(a => (a.status||'')  === 'present').length;
    const absent  = list.filter(a => (a.status||'')  === 'absent').length;
    const late    = list.filter(a => (a.status||'')  === 'late').length;
    const totalOT = list.reduce((s, a) => s + (parseFloat(a.overtime)||0), 0);
    sendSuccess(res, 200, { total: list.length, present, absent, late, totalOT }, 'Attendance summary');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to get attendance summary');
  }
});

// ── PAYROLL ───────────────────────────────────────────────────────────────────
let payrollRecords = loadStore('payroll_records.json');

app.get('/api/payroll', requireStaffAuth, (req, res) => {
  try {
    const { staffId, period, limit = 100 } = req.query;
    let list = [...payrollRecords];
    if (staffId) list = list.filter(p => p.staffId === staffId);
    if (period) list = list.filter(p => (p.period||'').startsWith(String(period)));
    list = list.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)).slice(0, parseInt(limit));
    sendSuccess(res, 200, { records: list, total: list.length }, 'Payroll records retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch payroll');
  }
});

app.post('/api/payroll', requireStaffAuth, (req, res) => {
  try {
    const CUTOFF_DAYS = 15;
    const { staffId, staffName, period, dailyRate, daysWorked, daysPresent, daysAbsent, overtimeHours, sssDeduction, philhealthDeduction, pagibigDeduction, taxDeduction, cashAdvanceDeduction, loanDeduction, otherDeductions, remarks } = req.body;
    if (!staffName || !period) return sendError(res, 400, 'VALIDATION_ERROR', 'Staff name and period are required');

    const cutoffRate = parseFloat(dailyRate) || 0;
    const rawPresent = parseFloat(daysPresent ?? daysWorked) || 0;
    const rawAbsent = parseFloat(daysAbsent) || 0;
    const presentDays = Math.max(0, Math.min(CUTOFF_DAYS, rawPresent));
    let absentDays = Math.max(0, Math.min(CUTOFF_DAYS, rawAbsent));
    const workedDays = Math.max(0, presentDays - absentDays);
    const ot   = parseFloat(overtimeHours) || 0;

    const basicPay    = cutoffRate / CUTOFF_DAYS * workedDays;
    const dailyRate_c = cutoffRate / CUTOFF_DAYS;
    const hourlyRate  = dailyRate_c / 8;
    const otPay       = hourlyRate * 1.25 * ot;
    const grossPay    = basicPay + otPay;

    const cashAdvance = parseFloat(cashAdvanceDeduction) || 0;
    const totalDed = (parseFloat(sssDeduction)||0) + (parseFloat(philhealthDeduction)||0) + (parseFloat(pagibigDeduction)||0) + (parseFloat(taxDeduction)||0) + cashAdvance + (parseFloat(loanDeduction)||0) + (parseFloat(otherDeductions)||0);
    const netPay = grossPay - totalDed;

    const record = {
      id: 'PAY-' + Date.now(),
      staffId: sanitizeInput(staffId || ''),
      staffName: sanitizeInput(staffName),
      period: sanitizeInput(period),
      dailyRate: cutoffRate, daysWorked: workedDays, daysPresent: presentDays, daysAbsent: absentDays, overtimeHours: ot,
      basicPay: Math.round(basicPay * 100) / 100,
      otPay: Math.round(otPay * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      deductions: {
        sss: parseFloat(sssDeduction)||0,
        philhealth: parseFloat(philhealthDeduction)||0,
        pagibig: parseFloat(pagibigDeduction)||0,
        tax: parseFloat(taxDeduction)||0,
        cashAdvance,
        loan: parseFloat(loanDeduction)||0,
        other: parseFloat(otherDeductions)||0,
        total: Math.round(totalDed * 100) / 100
      },
      netPay: Math.round(netPay * 100) / 100,
      remarks: sanitizeInput(remarks || ''),
      createdBy: req.user?.username || 'staff',
      createdAt: new Date().toISOString()
    };
    payrollRecords.push(record);
    saveStore('payroll_records.json', payrollRecords);
    logAudit('payroll-computed', { id: record.id, staffName: record.staffName, netPay: record.netPay, period: record.period }, req);
    sendSuccess(res, 201, record, 'Payroll computed and saved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to compute payroll');
  }
});

// ── SEARCH API ────────────────────────────────────────────────────────────────
app.get('/api/search', requireStaffAuth, (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || String(q).trim().length < 2) return sendError(res, 400, 'VALIDATION_ERROR', 'Search query must be at least 2 characters');
    const query = String(q).toLowerCase().trim();

    const results = {};
    if (!type || type === 'applicants') {
      results.applicants = applicantForms.filter(a =>
        (a.fullName||a.fullname||'').toLowerCase().includes(query) ||
        (a.email||'').toLowerCase().includes(query) ||
        (a.position||'').toLowerCase().includes(query)
      ).slice(0, 10).map(a => ({ id: a.id, name: a.fullName||a.fullname, type: 'applicant', sub: a.position||'' }));
    }
    if (!type || type === 'complaints') {
      results.complaints = welfareComplaints.filter(c =>
        (c.applicantName||c.workerName||'').toLowerCase().includes(query) ||
        (c.referenceNo||'').toLowerCase().includes(query)
      ).slice(0, 10).map(c => ({ id: c.id, name: c.applicantName||c.workerName, type: 'complaint', sub: c.referenceNo||'' }));
    }
    if (!type || type === 'documents') {
      results.documents = qmsDocs.filter(d =>
        (d.name||'').toLowerCase().includes(query)
      ).slice(0, 10).map(d => ({ id: d.id, name: d.name, type: 'document', sub: d.uploadedBy||'' }));
    }
    if (!type || type === 'ofw') {
      results.ofw = ofwWorkers.filter(w =>
        (w.fullName||'').toLowerCase().includes(query) ||
        (w.passportNo||'').toLowerCase().includes(query)
      ).slice(0, 10).map(w => ({ id: w.id, name: w.fullName, type: 'ofw', sub: w.country||'' }));
    }
    if (!type || type === 'leads') {
      results.leads = interestedApplicants.filter(i =>
        (i.fullName||'').toLowerCase().includes(query) ||
        (i.mobileNumber||'').toLowerCase().includes(query)
      ).slice(0, 10).map(i => ({ id: i.id, name: i.fullName, type: 'lead', sub: i.positionApplied||'' }));
    }

    const totalFound = Object.values(results).reduce((s, arr) => s + arr.length, 0);
    sendSuccess(res, 200, { query, results, totalFound }, 'Search complete');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Search failed');
  }
});

// ── REPORTS / EXPORT ──────────────────────────────────────────────────────────
app.get('/api/export/applicants', requireStaffAuth, (req, res) => {
  try {
    const { format = 'json', status } = req.query;
    let list = applicantForms;
    if (status) list = list.filter(a => (a.status||'').toLowerCase() === String(status).toLowerCase());
    if (format === 'csv') {
      const headers = ['ID','Full Name','Email','Phone','Position','Country','Date','Status'];
      const rows = list.map(a => [a.id, a.fullName||a.fullname||'', a.email||'', a.phone||a.contact||'', a.position||a.jobType||'', a.country||'', (a.submittedAt||a.submitted||'').slice(0,10), a.status||'new']);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="applicants.csv"');
      return res.send(csv);
    }
    sendSuccess(res, 200, { count: list.length, applicants: list }, 'Applicants exported');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Export failed');
  }
});

app.get('/api/export/complaints', requireStaffAuth, (req, res) => {
  try {
    const { format = 'json' } = req.query;
    if (format === 'csv') {
      const headers = ['ID','Ref No','Worker Name','Category','Urgency','Status','Date'];
      const rows = welfareComplaints.map(c => [c.id, c.referenceNo||'', c.applicantName||c.workerName||'', c.category||'', c.urgency||'', c.status||'', (c.date||'').slice(0,10)]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
      return res.send(csv);
    }
    sendSuccess(res, 200, { count: welfareComplaints.length, complaints: welfareComplaints }, 'Complaints exported');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Export failed');
  }
});

app.get('/api/export/expenses', requireStaffAuth, (req, res) => {
  try {
    const { format = 'json', period } = req.query;
    let list = period ? expenses.filter(e => (e.dateIncurred||e.createdAt||'').startsWith(String(period))) : expenses;
    if (format === 'csv') {
      const headers = ['ID','Ref No','Date','Category','Payee','Particulars','Amount (PHP)','Status'];
      const rows = list.map(e => [e.id, e.referenceNo||'', e.dateIncurred||'', e.category||'', e.payeeName||'', e.particulars||'', e.amountPhp||0, e.paymentStatus||'']);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
      return res.send(csv);
    }
    sendSuccess(res, 200, { count: list.length, expenses: list, total: list.reduce((s,e) => s+(parseFloat(e.amountPhp)||0),0) }, 'Expenses exported');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Export failed');
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/change-password', requireStaffAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return sendError(res, 400, 'VALIDATION_ERROR', 'Current and new password required');
    const session = getSession(req);
    const user = users.find(u => u.username === session.username);
    if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');
    if (user.password !== hashPassword(currentPassword)) return sendError(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    const validation = validatePassword(newPassword);
    if (!validation.isValid) return sendError(res, 400, 'WEAK_PASSWORD', validation.message);
    user.password = hashPassword(newPassword);
    logAudit('password-changed', { username: user.username }, req);
    sendSuccess(res, 200, null, 'Password changed successfully');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to change password');
  }
});

// ── SYSTEM SUMMARY (admin) ────────────────────────────────────────────────────
app.get('/api/system-summary', requireStaffAuth, (req, res) => {
  try {
    sendSuccess(res, 200, {
      counts: {
        applicants: applicantForms.length,
        leads: interestedApplicants.length,
        sourcingLeads: sourcingLeads.length,
        complaints: welfareComplaints.length,
        documents: qmsDocs.length,
        expenses: expenses.length,
        ofw: ofwWorkers.length,
        fra: fraWorkers.length,
        deployments: deploymentRecords.length,
        auditItems: auditImprovementItems.length,
        staff: staffRecords.length,
        attendance: attendanceRecords.length,
        payroll: payrollRecords.length
      },
      uptime: Math.floor(process.uptime()),
      environment: NODE_ENV,
      serverTime: new Date().toISOString(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }, 'System summary retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to get system summary');
  }
});

// ── APPLICANTS ALIAS (for staff workstation) ──────────────────────────────────
app.get('/api/applicants', requireStaffAuth, (req, res) => {
  try {
    const { limit = 500, offset = 0, search, status, position } = req.query;
    let list = [...applicantForms];
    if (status)   list = list.filter(a => (a.status||'').toLowerCase() === String(status).toLowerCase());
    if (position) list = list.filter(a => (a.position||a.jobType||'').toLowerCase().includes(String(position).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(a => (a.fullName||a.fullname||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q));
    }
    list = list.sort((a,b) => new Date(b.submittedAt||b.submitted||0) - new Date(a.submittedAt||a.submitted||0));
    const total = list.length;
    const paginated = list.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    sendSuccess(res, 200, { applicants: paginated, total }, 'Applicants retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch applicants');
  }
});

// ── WORKSTATION MODULE CRUD API ───────────────────────────────────────────────
// Server-side persistent storage for the staff workstation's modules.
const wsStoreFiles = {
  attendance:  'ws_attendance.json',
  payroll:     'ws_payroll.json',
  expenses:    'ws_expenses.json',
  selections:  'ws_selections.json',
  deployments: 'ws_deployments.json',
  owwa:        'ws_owwa.json',
  bio:         'ws_bio.json',
  availablecvs:'ws_available_cvs.json',
  fra:         'ws_fra.json',
  fraworkersreport: 'ws_fra_workers_report.json',
  dep_records:       'ws_dep_records.json',        // deployment tracking page
  contracts:         'ws_contracts.json',           // contract & re-engagement
  mgmt:              'ws_mgmt.json',                // management & leadership
  resource:          'ws_resource.json',            // resource & competence
  commissions:       'ws_commissions.json',         // staff commissions
  payroll:           'ws_payroll.json',             // staff payroll
  com_cv:            'ws_com_cv.json',              // CV tracker
};
const wsData = {};
Object.keys(wsStoreFiles).forEach(k => { wsData[k] = loadStore(wsStoreFiles[k]); });
const WS_MODULES = new Set(Object.keys(wsStoreFiles));

// ── Staff Chat API ────────────────────────────────────────────────────────────
const CHAT_FILE   = 'ws_chat.json';
const CHAT_LIMIT  = 200; // keep last 200 messages
let chatMessages  = loadStore(CHAT_FILE);
if (!Array.isArray(chatMessages)) chatMessages = [];

// GET /api/chat — fetch recent messages
app.get('/api/chat', requireStaffAuth, (req, res) => {
  const since = parseInt(req.query.since || '0', 10);
  const msgs  = since ? chatMessages.filter(m => m.id > since) : chatMessages.slice(-80);
  sendSuccess(res, 200, msgs);
});

// POST /api/chat — post a new message
app.post('/api/chat', requireStaffAuth, (req, res) => {
  const text = (req.body.text || '').toString().trim().slice(0, 500);
  if (!text) return sendError(res, 400, 'EMPTY', 'Message cannot be empty');
  const msg = {
    id:       Date.now(),
    username: req.user.username,
    role:     req.user.role,
    text,
    ts:       new Date().toISOString()
  };
  chatMessages.push(msg);
  if (chatMessages.length > CHAT_LIMIT) chatMessages = chatMessages.slice(-CHAT_LIMIT);
  saveStore(CHAT_FILE, chatMessages);
  sendSuccess(res, 200, msg);
});

// DELETE /api/chat/:id — admin can delete a message
app.delete('/api/chat/:id', requireAdminDeleteCode, (req, res) => {
  const id = parseInt(req.params.id, 10);
  chatMessages = chatMessages.filter(m => m.id !== id);
  saveStore(CHAT_FILE, chatMessages);
  sendSuccess(res, 200, null, 'Message deleted');
});

// GET /api/ws-stats — workstation dashboard KPIs (defined before generic :module route)
app.get('/api/ws-stats', requireStaffAuth, (req, res) => {
  try {
    const today      = new Date().toISOString().split('T')[0];
    const thisMonth  = new Date().toISOString().slice(0, 7);
    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const isoMonth = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 7);
    };
    const normalizeStatus = (s) => String(s || 'unknown').trim().toLowerCase();
    const countByStatus = (items, accessor) => {
      return items.reduce((acc, item) => {
        const key = normalizeStatus(accessor(item));
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    };
    const totalApplicants = applicantForms.length + interestedApplicants.length;
    const selected     = wsData.selections.filter(s => (s.status||'').toLowerCase() === 'selected').length;
    const deployed     = wsData.deployments.length;
    const activeFra    = wsData.fra.filter(f => (f.status||'').toLowerCase() === 'active').length;
    const inactiveFra  = wsData.fra.length - activeFra;
    const pendingOwwa  = wsData.owwa.filter(r => (r.status||'').toLowerCase() === 'pending').length;
    const pendingExp   = wsData.expenses.filter(e => (e.status||'').toLowerCase() === 'pending').length;
    const monthExpAmt  = wsData.expenses
      .filter(e => (e.date||'').startsWith(thisMonth))
      .reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
    const todayAtt     = wsData.attendance.filter(r => r.date === today).length;
    const presentToday = wsData.attendance.filter(r => r.date === today && (r.status||'').toLowerCase() === 'present').length;
    const monthPayroll = wsData.payroll
      .filter(p => (p.from||'').startsWith(thisMonth) || (p.to||'').startsWith(thisMonth))
      .reduce((s,p) => s + (parseFloat(p.net)||0), 0);
    const openCerts    = wsData.bio.filter(b => (b.result||'').toLowerCase() === 'pending result').length;
    const recentActions = auditLogs
      .filter(l => l.action && l.action.startsWith('ws-'))
      .slice(-15).reverse()
      .map(l => ({ action: l.action, ts: l.timestamp, user: l.user }));
    const selectionsByMonth = monthBuckets.map(m =>
      wsData.selections.filter(s => isoMonth(s.selectionDate || s.createdAt) === m).length
    );
    const deploymentsByMonth = monthBuckets.map(m =>
      wsData.deployments.filter(d => isoMonth(d.flightDate || d.createdAt) === m).length
    );
    const expensesByMonth = monthBuckets.map(m =>
      wsData.expenses
        .filter(e => isoMonth(e.date || e.createdAt) === m)
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    );
    const fraWorkersRows = wsData.fraworkersreport || [];
    const deploymentStatusBreakdown = countByStatus(fraWorkersRows, r => r.status);
    const taskBacklog = pendingOwwa + pendingExp + openCerts;
    const alerts = [];
    if (pendingOwwa > 0) alerts.push({ level: 'warning', code: 'OWWA_PENDING', message: `${pendingOwwa} OWWA/TESDA record(s) pending` });
    if (pendingExp > 0) alerts.push({ level: 'warning', code: 'EXPENSE_PENDING', message: `${pendingExp} expense item(s) pending approval` });
    if (openCerts > 0) alerts.push({ level: 'info', code: 'MEDICAL_PENDING', message: `${openCerts} biometric/medical result(s) pending` });
    sendSuccess(res, 200, {
      applicants: totalApplicants, selected, deployed, activeFra,
      inactiveFra,
      pendingOwwa, pendingExp, monthExpAmt, todayAtt, presentToday,
      monthPayroll, openCerts,
      pipeline: { total: totalApplicants, selected, deployed },
      recentActions,
      trend: {
        months: monthBuckets,
        selections: selectionsByMonth,
        deployments: deploymentsByMonth,
        expenses: expensesByMonth
      },
      breakdown: {
        attendanceStatus: countByStatus(wsData.attendance, r => r.status),
        expenseStatus: countByStatus(wsData.expenses, e => e.status),
        fraStatus: countByStatus(wsData.fra, f => f.status),
        deploymentStatus: deploymentStatusBreakdown
      },
      workload: {
        pendingOwwa,
        pendingExp,
        openCerts,
        taskBacklog
      },
      alerts,
      generatedAt: new Date().toISOString()
    }, 'Workstation stats retrieved');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get stats'); }
});

// PUT /api/ws-replace/:module — full client→server sync (array or object)
app.put('/api/ws-replace/:module', requireStaffAuth, (req, res) => {
  try {
    const mod = req.params.module;
    if (!WS_MODULES.has(mod)) return sendError(res, 404, 'NOT_FOUND', 'Unknown module');
    const body = req.body;
    // Object payloads (contracts, mgmt, resource) — store as single-element array wrapping the object
    if (!Array.isArray(body)) {
      if (typeof body !== 'object' || body === null) return sendError(res, 400, 'VALIDATION_ERROR', 'Body must be array or object');
      // Sanitize string values in the object tree
      const sanitizeObj = (obj) => {
        if (Array.isArray(obj)) return obj.map(sanitizeObj);
        if (obj && typeof obj === 'object') {
          const out = {};
          Object.keys(obj).forEach(k => { out[k] = sanitizeObj(obj[k]); });
          return out;
        }
        if (typeof obj === 'string') return sanitizeInput(obj);
        return obj;
      };
      const sanitized = sanitizeAgentNameForWrite(sanitizeObj(body), req);
      wsData[mod].length = 0;
      wsData[mod].push(sanitized);
      saveStore(wsStoreFiles[mod], wsData[mod]);
      return sendSuccess(res, 200, { count: 1 }, `${mod} synced`);
    }
    const sanitized = body.map(record => {
      const r = { ...sanitizeAgentNameForWrite(record, req) };
      Object.keys(r).forEach(k => { if (typeof r[k] === 'string') r[k] = sanitizeInput(r[k]); });
      if (!r.id) r.id = 'WS-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
      return r;
    });
    wsData[mod].length = 0;
    sanitized.forEach(r => wsData[mod].push(r));
    saveStore(wsStoreFiles[mod], wsData[mod]);
    sendSuccess(res, 200, { count: wsData[mod].length }, `${mod} synced`);
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to sync module'); }
});

// GET /api/ws/:module — list all records (array) or unwrap stored object
app.get('/api/ws/:module', requireStaffAuth, (req, res) => {
  try {
    const mod = req.params.module;
    if (!WS_MODULES.has(mod)) return sendError(res, 404, 'NOT_FOUND', 'Unknown module');
    const stored = wsData[mod];
    // Object-type modules: stored as [obj] — return the object directly
    const OBJ_MODULES = new Set(['contracts','mgmt','resource']);
    if (OBJ_MODULES.has(mod) && Array.isArray(stored) && stored.length === 1 && !Array.isArray(stored[0])) {
      return sendSuccess(res, 200, sanitizeAgentNameForWrite(stored[0], req), `${mod} retrieved`);
    }
    sendSuccess(res, 200, stripAgentNameFromList(stored, req), `${mod} retrieved`);
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to load module'); }
});

// GET /api/ws-export/:module.xlsx — export workstation module as Excel
app.get('/api/ws-export/:module.xlsx', requireStaffAuth, (req, res) => {
  try {
    const mod = req.params.module;
    if (!WS_MODULES.has(mod)) return sendError(res, 404, 'NOT_FOUND', 'Unknown module');

    const rows = stripAgentNameFromList(wsData[mod] || [], req).map(record => {
      const row = { ...record };
      delete row.id;
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No records found' }]);
    XLSX.utils.book_append_sheet(wb, ws, mod);
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${mod}-export.xlsx"`);
    res.send(buffer);
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to export module'); }
});

// POST /api/ws/:module — add a record
app.post('/api/ws/:module', requireStaffAuth, (req, res) => {
  try {
    const mod = req.params.module;
    if (!WS_MODULES.has(mod)) return sendError(res, 404, 'NOT_FOUND', 'Unknown module');
    const record = { id: 'WS-' + Date.now(), ...sanitizeAgentNameForWrite(req.body, req), createdAt: new Date().toISOString() };
    Object.keys(record).forEach(k => { if (typeof record[k] === 'string') record[k] = sanitizeInput(record[k]); });
    wsData[mod].push(record);
    saveStore(wsStoreFiles[mod], wsData[mod]);
    logAudit(`ws-${mod}-add`, { id: record.id }, req);
    sendSuccess(res, 201, record, `${mod} record saved`);
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to save record'); }
});

// DELETE /api/ws/:module/:id — delete a record
app.delete('/api/ws/:module/:id', requireAdminDeleteCode, (req, res) => {
  try {
    const mod = req.params.module;
    if (!WS_MODULES.has(mod)) return sendError(res, 404, 'NOT_FOUND', 'Unknown module');
    const idx = wsData[mod].findIndex(r => r.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    wsData[mod].splice(idx, 1);
    saveStore(wsStoreFiles[mod], wsData[mod]);
    logAudit(`ws-${mod}-delete`, { id: req.params.id }, req);
    sendSuccess(res, 200, { deleted: true }, 'Record deleted');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to delete record'); }
});

// PATCH /api/applicants/:id/status — update applicant status from workstation
app.patch('/api/applicants/:id/status', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const status = sanitizeInput(String(req.body.status || ''));
    if (!status) return sendError(res, 400, 'VALIDATION_ERROR', 'status is required');
    const a = applicantForms.find(x => x.id === id);
    const l = sourcingLeads.find(x => x.id === id || x._id === id);
    const i = interestedApplicants.find(x => x.id === id);
    if (!a && !l && !i) return sendError(res, 404, 'NOT_FOUND', 'Applicant not found');
    if (a) { a.status = status; saveStore('applicant_forms.json', applicantForms); }
    if (l) { l.status = status; saveStore('sourcing_leads.json', sourcingLeads); }
    if (i) { i.status = status; saveStore('interested_applicants.json', interestedApplicants); }
    logAudit('applicant-status-updated', { id, status }, req);
    sendSuccess(res, 200, { id, status }, 'Status updated');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update status'); }
});

// ─── 16b. PHOTO GALLERY ─────────────────────────────────────────────────────
const galleryDir = path.join(__dirname, 'uploads', 'gallery');
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, galleryDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safe);
  }
});
const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});
const galleryMetaFile = path.join(galleryDir, '_meta.json');
function loadGalleryMeta() {
  try {
    const raw = JSON.parse(fs.readFileSync(galleryMetaFile, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function saveGalleryMeta(data) {
  fs.writeFileSync(galleryMetaFile, JSON.stringify(data, null, 2));
}

function galleryUrlForFilename(filename) {
  // Encode each path segment to support spaces and special characters in file names.
  return '/uploads/gallery/' + encodeURIComponent(String(filename || ''));
}

function encodeGalleryUrl(url) {
  if (!url) return '';
  // Split into path segments, encode each segment, rejoin — preserves leading slash and folder structure
  try {
    return url.split('/').map((seg, i) => i === 0 && seg === '' ? '' : encodeURIComponent(seg)).join('/');
  } catch (e) { return url; }
}

function normalizeGalleryMeta(meta) {
  return (Array.isArray(meta) ? meta : []).map(p => {
    const filename = String(p.filename || '').trim();
    const hasUploadFile = filename && fs.existsSync(path.join(galleryDir, filename));
    let url;
    if (hasUploadFile) {
      url = galleryUrlForFilename(filename);
    } else if (p.url && p.url.startsWith('/uploads/gallery/')) {
      url = galleryUrlForFilename(filename);
    } else {
      url = encodeGalleryUrl(p.url || '');
    }
    return { ...p, filename, url };
  });
}

app.get('/api/gallery', (req, res) => {
  try {
    let meta = normalizeGalleryMeta(loadGalleryMeta());
    // Auto-discover any uploaded files on disk not yet in meta (self-healing)
    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
    let diskFiles = [];
    try { diskFiles = fs.readdirSync(galleryDir); } catch (e) { diskFiles = []; }
    const knownFiles = new Set(meta.map(p => p.filename));
    const orphans = diskFiles.filter(f => {
      if (f === '_meta.json') return false;
      const ext = path.extname(f).toLowerCase();
      return IMAGE_EXTS.has(ext) && !knownFiles.has(f);
    });
    if (orphans.length) {
      const today = new Date().toISOString().split('T')[0];
      const orphanEntries = orphans.map(f => ({
        filename: f,
        url: galleryUrlForFilename(f),
        caption: '',
        category: 'General',
        uploadedBy: 'Staff',
        date: today,
        size: (() => { try { return fs.statSync(path.join(galleryDir, f)).size; } catch { return 0; } })()
      }));
      meta = [...orphanEntries, ...meta];
      saveGalleryMeta(meta);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, photos: meta });
  } catch (e) {
    console.error('Gallery GET error:', e);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, photos: [] });
  }
});

app.post('/api/gallery/upload', (req, res, next) => {
  galleryUpload.array('photos', 20)(req, res, (err) => {
    if (err) {
      console.error('Gallery upload error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    try {
      const meta = normalizeGalleryMeta(loadGalleryMeta());
      const uploadedBy = sanitizeInput(req.body.uploadedBy || (req.user && req.user.username) || 'Staff');
      const added = req.files.map(f => ({
        filename: f.filename,
        url: galleryUrlForFilename(f.filename),
        caption: sanitizeInput((req.body.caption || '').trim().substring(0, 3000)),
        category: sanitizeInput((req.body.category || 'General').substring(0, 50)),
        uploadedBy,
        date: new Date().toISOString().split('T')[0],
        size: f.size
      }));
      meta.unshift(...added);
      saveGalleryMeta(meta);
      res.json({ success: true, uploaded: added.length, photos: added });
    } catch (e) {
      console.error('Gallery upload processing error:', e);
      res.status(500).json({ success: false, message: 'Processing failed: ' + e.message });
    }
  });
});

app.delete('/api/gallery/:filename', requireAdminDeleteCode, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(galleryDir, filename);
  let meta = loadGalleryMeta();
  meta = meta.filter(p => p.filename !== filename);
  saveGalleryMeta(meta);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true, message: 'Photo deleted' });
});

app.delete('/api/gallery', requireAdminDeleteCode, (req, res) => {
  const filenames = req.body.filenames;
  if (!Array.isArray(filenames) || !filenames.length) return res.status(400).json({ message: 'No filenames provided' });
  let meta = loadGalleryMeta();
  filenames.forEach(fn => {
    const safe = path.basename(fn);
    meta = meta.filter(p => p.filename !== safe);
    const fp = path.join(galleryDir, safe);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  saveGalleryMeta(meta);
  res.json({ success: true, deleted: filenames.length });
});
// ─────────────────────────────────────────────────────────────────────────────

// 17. ERROR HANDLER
app.use((err, req, res, next) => {
  logServerError(err, req.method + ' ' + req.originalUrl, req);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'File size exceeds limit');
    }
    return sendError(res, 400, 'UPLOAD_ERROR', err.message);
  }
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
});

// ── TEAM CHAT API ─────────────────────────────────────────────────────────────
let teamChatMessages = [];
const CHAT_MAX = 200; // keep last 200 messages

// GET /api/chat?since=<timestamp>  — poll for new messages
app.get('/api/chat', requireStaffAuth, (req, res) => {
  try {
    const since = parseInt(req.query.since) || 0;
    const messages = teamChatMessages.filter(m => m.ts > since);
    sendSuccess(res, 200, { messages });
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Chat fetch failed');
  }
});

// POST /api/chat  — send a message
app.post('/api/chat', requireStaffAuth, (req, res) => {
  try {
    const text = sanitizeInput((req.body.text || '').toString().substring(0, 500));
    if (!text) return sendError(res, 400, 'VALIDATION_ERROR', 'Message cannot be empty');
    const sender = sanitizeInput((req.body.sender || 'Staff').toString().substring(0, 60));
    const msg = { id: Date.now() + '-' + Math.floor(Math.random()*9999), ts: Date.now(), sender, text };
    teamChatMessages.push(msg);
    if (teamChatMessages.length > CHAT_MAX) teamChatMessages = teamChatMessages.slice(-CHAT_MAX);
    sendSuccess(res, 200, { message: msg });
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Chat send failed');
  }
});

// ── ADMIN STAFF MONITORING SYSTEM ────────────────────────────────────────────
// Data store: staff work submissions & requests
let staffWorkSubmissions = loadStore('staff_work_submissions.json');

function normalizeWorkSubmission(entry) {
  const submittedAt = entry && entry.submittedAt ? new Date(entry.submittedAt).toISOString() : new Date().toISOString();
  const reviewedAt = entry && entry.reviewedAt ? new Date(entry.reviewedAt).toISOString() : null;
  const status = ['pending', 'approved', 'rejected', 'revision'].includes(entry?.status) ? entry.status : 'pending';
  const safeTitle = sanitizeInput(String(entry?.title || 'Work update').slice(0, 120));
  const safeModule = sanitizeInput(String(entry?.module || 'General').slice(0, 60));
  const safeDescription = sanitizeInput(String(entry?.description || 'No description provided').slice(0, 1000));
  return {
    id: String(entry?.id || `WRK-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`),
    staff: sanitizeInput(String(entry?.staff || 'unknown').slice(0, 60)),
    role: sanitizeInput(String(entry?.role || 'staff').slice(0, 60)),
    title: safeTitle,
    module: safeModule,
    description: safeDescription,
    notes: sanitizeInput(String(entry?.notes || '').slice(0, 500)),
    status,
    adminNote: sanitizeInput(String(entry?.adminNote || '').slice(0, 500)),
    submittedAt,
    reviewedAt,
    reviewedBy: reviewedAt ? sanitizeInput(String(entry?.reviewedBy || '').slice(0, 60)) : null
  };
}

function refreshStaffWorkSubmissions() {
  const loaded = loadStore('staff_work_submissions.json');
  staffWorkSubmissions = Array.isArray(loaded) ? loaded.map(normalizeWorkSubmission) : [];
}

function persistStaffWorkSubmissions() {
  saveStore('staff_work_submissions.json', staffWorkSubmissions.map(normalizeWorkSubmission));
}

refreshStaffWorkSubmissions();

// Staff: Submit work entry for review
app.post('/api/staff/submit-work', requireStaffAuth, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const { title, module, description, notes } = req.body;
    if (!title || !module || !description) {
      return sendError(res, 400, 'MISSING_FIELDS', 'title, module, and description are required');
    }
    const entry = {
      id: 'WRK-' + Date.now(),
      staff: req.user.username,
      role: req.user.role,
      title: sanitizeInput(title.toString().slice(0, 120)),
      module: sanitizeInput(module.toString().slice(0, 60)),
      description: sanitizeInput(description.toString().slice(0, 1000)),
      notes: sanitizeInput((notes || '').toString().slice(0, 500)),
      status: 'pending',       // pending | approved | rejected | revision
      adminNote: '',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null
    };
    staffWorkSubmissions.push(entry);
    persistStaffWorkSubmissions();
    logAudit('staff-work-submitted', { id: entry.id, title: entry.title, module: entry.module }, req);
    addNotification('info', `📋 ${req.user.username} submitted work for review: "${entry.title}"`);
    sendSuccess(res, 201, entry, 'Work submitted for review');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to submit work');
  }
});

// Staff: Get own submissions
app.get('/api/staff/my-submissions', requireStaffAuth, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const mine = staffWorkSubmissions
      .filter(s => s.staff === req.user.username)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    sendSuccess(res, 200, mine, 'Submissions retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch submissions');
  }
});

// Admin: Get ALL staff submissions with filters
app.get('/api/admin/staff-submissions', requireAdmin, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    let results = [...staffWorkSubmissions];
    const { status, staff, module: mod, from, to } = req.query;
    if (status) results = results.filter(s => s.status === status);
    if (staff) results = results.filter(s => s.staff.toLowerCase().includes(staff.toLowerCase()));
    if (mod) results = results.filter(s => s.module.toLowerCase().includes(mod.toLowerCase()));
    if (from) results = results.filter(s => new Date(s.submittedAt) >= new Date(from));
    if (to) results = results.filter(s => new Date(s.submittedAt) <= new Date(to));
    results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    sendSuccess(res, 200, results, 'All staff submissions retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch submissions');
  }
});

// Admin: Review a submission (approve / reject / revision)
app.post('/api/admin/review-submission/:id', requireAdmin, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const allowed = ['approved', 'rejected', 'revision'];
    if (!allowed.includes(status)) {
      return sendError(res, 400, 'INVALID_STATUS', 'status must be: approved, rejected, or revision');
    }
    const entry = staffWorkSubmissions.find(s => s.id === id);
    if (!entry) return sendError(res, 404, 'NOT_FOUND', 'Submission not found');
    entry.status = status;
    entry.adminNote = sanitizeInput((adminNote || '').toString().slice(0, 500));
    entry.reviewedAt = new Date().toISOString();
    entry.reviewedBy = req.user.username;
    persistStaffWorkSubmissions();
    logAudit('admin-reviewed-submission', { id: entry.id, status, reviewer: req.user.username, staff: entry.staff }, req);
    const emoji = { approved: '✅', rejected: '❌', revision: '🔄' }[status];
    addNotification('info', `${emoji} ${req.user.username} ${status} "${entry.title}" by ${entry.staff}`);
    sendSuccess(res, 200, entry, `Submission ${status}`);
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to review submission');
  }
});

// Admin: Delete a submission
app.delete('/api/admin/staff-submissions/:id', requireAdminDeleteCode, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const idx = staffWorkSubmissions.findIndex(s => s.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Submission not found');
    const [removed] = staffWorkSubmissions.splice(idx, 1);
    persistStaffWorkSubmissions();
    logAudit('admin-deleted-submission', { id: removed.id, title: removed.title }, req);
    sendSuccess(res, 200, null, 'Submission deleted');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to delete submission');
  }
});

// Admin: Bootstrap submissions from recent audit activity when list is empty
app.post('/api/admin/staff-submissions/bootstrap', requireAdmin, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const force = String(req.query.force || '').toLowerCase() === 'true';
    if (staffWorkSubmissions.length > 0 && !force) {
      return sendSuccess(res, 200, {
        created: 0,
        total: staffWorkSubmissions.length,
        reason: 'Submissions already exist. Use ?force=true to add more.'
      }, 'Bootstrap skipped');
    }

    const since = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const ignoreUsers = new Set(['unknown']);
    const candidateLogs = auditLogs
      .filter(l => l && l.user && !ignoreUsers.has(String(l.user).toLowerCase()))
      .filter(l => new Date(l.timestamp || 0).getTime() >= since)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const userRoleMap = {};
    users.forEach(u => { userRoleMap[String(u.username || '').toLowerCase()] = u.role || 'staff'; });

    const generated = [];
    const seenKeys = new Set();
    for (const log of candidateLogs) {
      const staff = sanitizeInput(String(log.user || '').slice(0, 60));
      const action = sanitizeInput(String(log.action || 'system-update').slice(0, 80));
      if (!staff || !action) continue;
      const key = `${staff}|${action}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      generated.push(normalizeWorkSubmission({
        id: `WRK-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
        staff,
        role: userRoleMap[staff.toLowerCase()] || 'staff',
        title: `Activity Report: ${action}`,
        module: (action.includes('welfare') ? 'Welfare' : action.includes('audit') ? 'Audit' : action.includes('applicant') ? 'Recruitment' : 'Operations'),
        description: `Auto-generated from recent staff activity (${action}) to initialize monitoring workflow.`,
        notes: 'Generated by admin bootstrap tool',
        status: 'pending',
        submittedAt: log.timestamp || new Date().toISOString()
      }));

      if (generated.length >= 12) break;
    }

    if (generated.length === 0) {
      const fallbackStaff = users.filter(u => !['applicant'].includes((u.role || '').toLowerCase())).slice(0, 4);
      fallbackStaff.forEach((u, idx) => {
        generated.push(normalizeWorkSubmission({
          id: `WRK-${Date.now()}-${idx + 1}${Math.floor(Math.random() * 9000 + 1000)}`,
          staff: u.username,
          role: u.role,
          title: 'Daily Operational Report',
          module: idx % 2 === 0 ? 'Recruitment' : 'Welfare',
          description: 'Seeded starter submission to activate admin monitoring workflow and KPI counters.',
          notes: 'Auto-seeded due to no recent activity logs',
          status: 'pending',
          submittedAt: new Date(Date.now() - idx * 3600000).toISOString()
        }));
      });
    }

    staffWorkSubmissions = force ? [...staffWorkSubmissions, ...generated] : generated;
    staffWorkSubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    persistStaffWorkSubmissions();
    logAudit('admin-bootstrapped-submissions', {
      created: generated.length,
      total: staffWorkSubmissions.length,
      force
    }, req);
    addNotification('info', `📋 ${req.user.username} initialized monitoring submissions (${generated.length} generated)`);
    sendSuccess(res, 201, { created: generated.length, total: staffWorkSubmissions.length }, 'Submissions bootstrapped');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to bootstrap submissions');
  }
});

// Admin: Get staff activity overview (who did what today)
app.get('/api/admin/staff-activity', requireAdmin, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const since = new Date(req.query.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const recentLogs = auditLogs.filter(l => new Date(l.timestamp) >= since && l.user && l.user !== 'unknown');
    // Group by user
    const byUser = {};
    recentLogs.forEach(l => {
      if (!byUser[l.user]) byUser[l.user] = { username: l.user, actions: [], lastSeen: l.timestamp };
      byUser[l.user].actions.push({ action: l.action, ts: l.timestamp, ip: l.ip });
      if (new Date(l.timestamp) > new Date(byUser[l.user].lastSeen)) byUser[l.user].lastSeen = l.timestamp;
    });
    const staffList = Object.values(byUser).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    // Pending submissions count per staff
    const pendingByStaff = {};
    staffWorkSubmissions.filter(s => s.status === 'pending').forEach(s => {
      pendingByStaff[s.staff] = (pendingByStaff[s.staff] || 0) + 1;
    });
    staffList.forEach(s => { s.pendingSubmissions = pendingByStaff[s.username] || 0; });
    sendSuccess(res, 200, { staffActivity: staffList, totalLogs: recentLogs.length }, 'Staff activity retrieved');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch staff activity');
  }
});

// Admin: Summary counts for monitoring panel
app.get('/api/admin/monitoring-summary', requireAdmin, (req, res) => {
  try {
    refreshStaffWorkSubmissions();
    const pending  = staffWorkSubmissions.filter(s => s.status === 'pending').length;
    const approved = staffWorkSubmissions.filter(s => s.status === 'approved').length;
    const rejected = staffWorkSubmissions.filter(s => s.status === 'rejected').length;
    const revision = staffWorkSubmissions.filter(s => s.status === 'revision').length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = staffWorkSubmissions.filter(s => s.submittedAt.startsWith(today)).length;
    // Unique active staff (submitted in last 7 days)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeStaff = [...new Set(staffWorkSubmissions.filter(s => s.submittedAt > week).map(s => s.staff))].length;
    sendSuccess(res, 200, { pending, approved, rejected, revision, todayCount, activeStaff }, 'Monitoring summary');
  } catch (e) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch monitoring summary');
  }
});

// Admin page route
app.get('/admin-monitoring', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin_monitoring.html'));
});

// 404 handler
app.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

// 17. START SERVER
const server = app.listen(PORT, () => {
  console.log(`\n✓ BLUEORION QMS Server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${NODE_ENV}`);
  console.log(`✓ Folders initialized: ${qmsFolders.join(', ')}`);
  console.log(`✓ API Info: GET http://localhost:${PORT}/api/info`);
  console.log(`✓ Health Check: GET http://localhost:${PORT}/api/health\n`);

  // ── Keep-Alive Self-Ping (prevents Render free tier from sleeping) ────────
  // Render free tier sleeps after 15 min of inactivity.
  // We ping our own /api/health every 14 minutes to stay awake.
  if (NODE_ENV === 'production' || process.env.RENDER) {
    const https = require('https');
    const http  = require('http');
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const pingInterval = 14 * 60 * 1000; // 14 minutes

    const selfPing = () => {
      const url = SELF_URL + '/api/health';
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, (res) => {
        console.log(`[keep-alive] ping → ${url} | status ${res.statusCode} | ${new Date().toISOString()}`);
      });
      req.on('error', (err) => console.warn('[keep-alive] ping error:', err.message));
      req.end();
    };

    // First ping after 1 minute, then every 14 minutes
    setTimeout(() => {
      selfPing();
      setInterval(selfPing, pingInterval);
    }, 60 * 1000);

    console.log(`✓ Keep-alive self-ping enabled (every 14 min) → ${SELF_URL}/api/health`);
  }
});

module.exports = app;

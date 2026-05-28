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
const compression = require('compression');
const rateLimit = require('express-rate-limit');
try { require('dotenv').config(); } catch (_) {}
const auditModule = require('./modules/audit-improvement');
const pgStore = require('./modules/pg-store');
const setupApplicantLifecycle = require('./modules/applicant-lifecycle');

// Global Path Declarations - Fixed Order (Initialized before any conditional usage)
const dataDir = process.env.DATA_DIR || './data';
if (dataDir !== '/data' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
const BASE_PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Mount announcement API routes
const announcementRoutes = require('./routes/announcements');
app.use('/api/announcements', announcementRoutes);

// Rendel guard: keep live-only services disabled unless running in production.
function initRendelGuard() {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ [Rendel] Guard triggered: Live environment not detected. Execution halted.');
    // Exit or disable Rendel features safely.
    return false;
  }
  console.log('🚀 [Rendel] Confirmed live environment. Initializing services...');
  return true;
}

const RENDEL_ENABLED = initRendelGuard();

// Production-only endpoint access control: lock down APIs if not running in production.
function createProductionGuard(req, res, next) {
  if (NODE_ENV !== 'production') {
    const isDevScript = process.argv.some(arg => arg.includes('nodemon') || arg.includes('dev'));
    if (isDevScript) {
      console.warn('⚠️ [Production Guard] Dev script detected. Live endpoints disabled.');
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Endpoints are disabled outside production environment.');
    }
  }
  next();
}

// Enforce strict CORS in production mode only (disable open origins).
function enforceProductionCORS() {
  if (NODE_ENV === 'production') {
    if (CORS_ORIGINS.length === 0) {
      console.warn('⚠️ [CORS Security] Production mode detected but CORS_ORIGINS env not set. Defaulting to deny-all.');
      return { origin: false };  // Reject all origins if not explicitly allowed
    }
  }
  return corsOptions;  // Use configured CORS options
}

function getDatabaseUrlState() {
  const conn = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.PG_URL
    || process.env.DB_URL
    || process.env.RENDER_DATABASE_URL
    || process.env.PG_CONNECTION_STRING;
  return conn ? 'set' : 'not set';
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

const PACKAGE_INFO = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return { name: pkg.name || 'blueorion-qms', version: pkg.version || '0.0.0' };
  } catch {
    return { name: 'blueorion-qms', version: '0.0.0' };
  }
})();

const SERVER_STARTED_AT = new Date().toISOString();
const BUILD_INFO = {
  app: PACKAGE_INFO.name,
  version: PACKAGE_INFO.version,
  commit: (process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.GITHUB_SHA || '').trim() || 'unknown',
  environment: NODE_ENV,
  startedAt: SERVER_STARTED_AT
};

const DASHBOARD_CACHE_TTL_MS = Math.max(5000, Number(process.env.DASHBOARD_CACHE_TTL_MS) || 15000);
const dashboardStatsCache = new Map();

function isTruthyFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function getDashboardStatsCacheKey(req) {
  const session = getSession(req || {});
  const role = String(session?.role || 'staff').toLowerCase();
  const lite = isTruthyFlag(req?.query?.lite);
  return `${role}:${lite ? 'lite' : 'full'}`;
}

function getDashboardStatsCacheEntry(key) {
  const hit = dashboardStatsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > DASHBOARD_CACHE_TTL_MS) {
    dashboardStatsCache.delete(key);
    return null;
  }
  return hit.payload;
}

function setDashboardStatsCacheEntry(key, payload) {
  dashboardStatsCache.set(key, { createdAt: Date.now(), payload });
}

function extractOriginFromUrl(urlValue) {
  if (!urlValue) return null;
  try {
    return new URL(String(urlValue).trim()).origin;
  } catch {
    return null;
  }
}

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const inferredCorsOrigins = [
  extractOriginFromUrl(process.env.RENDER_EXTERNAL_URL),
  extractOriginFromUrl(process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null),
  extractOriginFromUrl(process.env.PUBLIC_BASE_URL),
  extractOriginFromUrl(process.env.APP_URL)
].filter(Boolean);

const CORS_ORIGINS = Array.from(new Set([
  ...configuredCorsOrigins,
  ...inferredCorsOrigins
]));

if (NODE_ENV === 'production' && configuredCorsOrigins.length === 0 && inferredCorsOrigins.length > 0) {
  console.warn(`[CORS Security] CORS_ORIGINS is not set. Auto-allowing platform origin(s): ${inferredCorsOrigins.join(', ')}`);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Role', 'X-User', 'X-Admin-Delete-Code'],
  maxAge: 86400
};

function getStartupReadiness() {
  const dbAliases = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRESQL_URL',
    'PG_URL',
    'DB_URL',
    'RENDER_DATABASE_URL',
    'PG_CONNECTION_STRING'
  ];
  const dbEnvConfigured = dbAliases.some(name => String(process.env[name] || '').trim().length > 0);
  const corsEnvConfigured = configuredCorsOrigins.length > 0;
  const corsInferred = inferredCorsOrigins.length > 0;
  const diskPersistenceAvailable = !!(process.env.RENDER && fs.existsSync(dataDir));

  const checks = {
    nodeEnvProduction: NODE_ENV === 'production',
    corsAllowedOriginsResolved: CORS_ORIGINS.length > 0,
    postgresEnvConfigured: dbEnvConfigured,
    postgresConnected: !!(pgStore && pgStore.ready),
    diskPersistenceAvailable
  };

  const missing = [];
  if (!checks.corsAllowedOriginsResolved) {
    missing.push('CORS_ORIGINS');
  }
  if (!checks.postgresEnvConfigured && !checks.diskPersistenceAvailable) {
    missing.push('DATABASE_URL|POSTGRES_URL|POSTGRESQL_URL|PG_URL|DB_URL|RENDER_DATABASE_URL|PG_CONNECTION_STRING');
  }

  const status = missing.length === 0 && (checks.postgresConnected || checks.diskPersistenceAvailable) ? 'ready' : 'degraded';
  return {
    status,
    checks,
    missing,
    envHints: {
      cors: {
        configuredDirectly: corsEnvConfigured,
        inferredFromPlatform: corsInferred,
        resolvedOriginsCount: CORS_ORIGINS.length
      },
      database: {
        configuredViaAnyAlias: dbEnvConfigured,
        diskFallbackAvailable: diskPersistenceAvailable,
        acceptedAliases: dbAliases
      }
    }
  };
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' } }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'Too many login attempts. Please try again later.' } }
});

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

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = sanitizeInput(v);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
  }
  return out;
}

function isAnnouncementWidgetEmbedRecord(mod, record) {
  if (String(mod || '').toLowerCase() !== 'announcements') return false;
  const kind = String(record?.kind || '').toLowerCase();
  return kind === 'widget_embed';
}

function normalizeAnnouncementWidgetSnippet(snippet) {
  const raw = String(snippet || '').trim();
  if (!raw) return '';

  const decoded = raw
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();

  if (decoded.includes('<script') || decoded.includes('<div')) return decoded;

  const appClassMatch = decoded.match(/elfsight-app-[A-Za-z0-9_-]+/i);
  if (/apps\.elfsight\.com\/p\/platform\.js/i.test(decoded) && appClassMatch) {
    const appClass = appClassMatch[0];
    return `<script src="https://apps.elfsight.com/p/platform.js" defer></script><div class="${appClass}" data-elfsight-app-lazy></div>`;
  }

  return decoded;
}

function isAllowedAnnouncementWidgetSnippet(snippet) {
  const raw = String(snippet || '');
  return /elfsight\.com|noticeable/i.test(raw);
}

function getUserIdentifier(req) {
  return req.user?.username || req.session?.username || 'system';
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

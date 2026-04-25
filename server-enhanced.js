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
  if (req.user && req.user.role) return req.user.role.toLowerCase();
  return (req.headers['x-user-role'] || req.query.role || 'viewer').toLowerCase();
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
  return cookies.blueorion_session || null;
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
 * Log audit event
 * @param {string} action - Action name
 * @param {object} details - Action details
 * @param {object} req - Express request
 */
function logAudit(action, details, req) {
  auditLogs.push({
    timestamp: new Date().toISOString(),
    user: (req && req.headers && req.headers['x-user']) ? req.headers['x-user'] : 'unknown',
    action,
    details,
    ip: req?.ip || 'unknown'
  });
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

function saveStore(filename, data) {
  try {
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.error('saveStore error', filename, e.message); }
}

let qmsDocs = loadStore('qms_docs.json');
let welfareComplaints = loadStore('welfare_complaints.json');
let applicantForms = loadStore('applicant_forms.json');
let fraWorkers = loadStore('fra_workers.json');
let auditLogs = loadStore('audit_logs.json');
let sourcingLeads = loadStore('sourcing_leads.json');
let staffPerformance = loadStore('staff_performance.json');
let competenceNotes = loadStore('competence_notes.json');
let foundationTracker = loadStore('foundation_tracker.json', {});
let expenses = loadStore('expenses.json');
let ofwWorkers = loadStore('ofw_workers.json');
let ofwComplaints = loadStore('ofw_complaints.json');
const sessions = new Map();
let notifications = [{
  id: '0',
  timestamp: Date.now(),
  type: 'info',
  message: 'QMS System initialized',
  read: false
}];
let loginAttempts = {};

const users = [
  { username: 'finance.accounting', password: hashPassword('Blue@Accounting2026'), role: 'accounting' },
  { username: 'blueorion.sg', password: hashPassword('Blue@2026!S'), role: 'document_controller' },
  { username: 'charo', password: hashPassword('president2026'), role: 'president' },
  { username: 'president.blueorion', password: hashPassword('Blue@President2026'), role: 'president' },
  { username: 'manager.operations', password: hashPassword('Blue@Manager2026'), role: 'manager' },
  { username: 'blueorion_staff01', password: hashPassword('BlueorionStart2026!'), role: 'encoder' },
  { username: 'welfare.officer', password: hashPassword('Blue@Welfare2026'), role: 'welfare_officer' },
  { username: 'applicant1', password: hashPassword('Applicant@2026'), role: 'applicant', allowedModules: ['complaint-grievance', 'sourcing-selection', 'welfare-monitoring'] },
];

const SIDEBAR_LINKS = {
  admin: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'QMS Document Center', url: '/views/qms_document_center.html', icon: '📂' },
    { label: 'Welfare & Monitoring', url: '/welfare_monitoring.html', icon: '🩺' },
    { label: 'Reports', url: '/views/report.html', icon: '📊' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  welfare_officer: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare_monitoring.html', icon: '🩺' },
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
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word documents and images are allowed'));
    }
  }
});

// 6. MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const protectedViewFiles = new Set([
  'admin.html',
  'sourcing_dashboard.html',
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

// 7. HEALTH CHECK & API INFO
app.get('/api/health', (req, res) => {
  sendSuccess(res, 200, getSystemStats(), 'System healthy');
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
app.get('/blueorion', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blueorion.html')));
app.use('/uploads/applications', express.static(applicationsDir));

// Staff / admin shortcuts — all require login inside the HTML
app.get('/admin', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/dashboard', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/staff', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/sourcing', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'sourcing_dashboard.html')));
app.get('/qms', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'qms_document_center.html')));
app.get('/welfare', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'welfare_monitoring.html')));
app.get('/management', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'management_leadership.html')));
app.get('/resources', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'resource_competence.html')));
app.get('/contracts', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'contract_reengagement.html')));
app.get('/deployment', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'deployment.html')));
app.get('/vouchers', requireStaffAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'expense_voucher.html')));
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
    let list = ofwWorkers.map(w => ({
      ...w,
      complaintCount: ofwComplaints.filter(c => c.passportNo === w.passportNo).length
    }));
    if (country) list = list.filter(w => w.country === country);
    if (status) list = list.filter(w => w.status === status);
    if (search) list = list.filter(w => w.fullName && w.fullName.toLowerCase().includes(search.toLowerCase()));
    sendSuccess(res, 200, list, 'Workers retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch workers'); }
});

// GET single OFW worker with complaints
app.get('/api/ofw/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const w = ofwWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const complaints = ofwComplaints.filter(c => c.passportNo === w.passportNo);
    sendSuccess(res, 200, { ...w, complaints, complaintCount: complaints.length }, 'Worker retrieved');
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
      deploymentDate: sanitizeInput(req.body.deploymentDate || ''),
      contractEnd: sanitizeInput(req.body.contractEnd || ''),
      status: sanitizeInput(req.body.status || 'Active'),
      emergencyContact: sanitizeInput(req.body.emergencyContact || ''),
      agentName: sanitizeInput(req.body.agentName || ''),
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
    sendSuccess(res, 200, {
      total: ofwWorkers.length,
      byCountry,
      openComplaints: ofwComplaints.filter(c => c.status === 'Open' || c.status === 'Pending').length
    }, 'Stats retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get stats'); }
});

// GET all complaints (admin)
app.get('/api/ofw/complaints', requireStaffAuth, (req, res) => {
  try {
    const { country, status, severity } = req.query;
    let list = [...ofwComplaints].sort((a, b) => new Date(b.dateFiled) - new Date(a.dateFiled));
    if (country) list = list.filter(c => c.country === country);
    if (status) list = list.filter(c => c.status === status);
    if (severity) list = list.filter(c => c.severity === severity);
    sendSuccess(res, 200, list, 'Complaints retrieved');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaints'); }
});

// POST file complaint (public — worker portal)
app.post('/api/ofw/complaints', (req, res) => {
  try {
    const { workerName, passportNo, country, category, severity, details } = req.body;
    if (!workerName || !passportNo || !country || !category || !severity || !details)
      return sendError(res, 400, 'VALIDATION_ERROR', 'All required fields must be filled');
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
      status: 'Open',
      adminNotes: '',
      dateFiled: new Date().toISOString()
    };
    ofwComplaints.push(complaint);
    saveStore('ofw_complaints.json', ofwComplaints);
    sendSuccess(res, 201, { id: complaint.id, refNo: complaint.refNo }, 'Complaint filed');
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
    c.status = sanitizeInput(req.body.status || c.status);
    if (req.body.adminNotes) c.adminNotes = sanitizeInput(req.body.adminNotes);
    c.updatedAt = new Date().toISOString();
    saveStore('ofw_complaints.json', ofwComplaints);
    logAudit('ofw-complaint-updated', { id: c.id, status: c.status }, req);
    sendSuccess(res, 200, { id: c.id, status: c.status }, 'Complaint updated');
  } catch (err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update complaint'); }
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

app.get('/api/dashboard-stats', (req, res) => {
  try {
    const stats = {
      system: getSystemStats(),
      recentActivity: {
        qmsDocs: qmsDocs.slice(-5).reverse(),
        complaints: welfareComplaints.slice(-5).reverse(),
        applicants: applicantForms.slice(-5).reverse()
      },
      summary: {
        totalDocuments: qmsDocs.length + countFiles('Documents'),
        totalComplaints: welfareComplaints.length,
        totalApplicants: applicantForms.length,
        systemHealth: 'Operational'
      }
    };
    sendSuccess(res, 200, stats, 'Dashboard statistics retrieved');
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
    const { applicantName, location, employerName, agencyName, category, urgency, description } = req.body;

    // Validation
    if (!applicantName || !location || !employerName || !agencyName || !category || !urgency || !description) {
      return sendError(res, 400, 'MISSING_FIELDS', 'All fields are required');
    }

    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    if (!validUrgencies.includes(urgency.toLowerCase())) {
      return sendError(res, 400, 'INVALID_URGENCY', `Urgency must be one of: ${validUrgencies.join(', ')}`);
    }

    const complaint = {
      id: Date.now().toString(),
      applicantName: sanitizeInput(applicantName),
      location: sanitizeInput(location),
      employerName: sanitizeInput(employerName),
      agencyName: sanitizeInput(agencyName),
      category: sanitizeInput(category),
      urgency: urgency.toLowerCase(),
      description: sanitizeInput(description),
      date: new Date().toISOString(),
      status: 'pending'
    };

    welfareComplaints.push(complaint);
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
    const { status, urgency, limit = 100, offset = 0 } = req.query;

    let filtered = welfareComplaints;
    if (status) filtered = filtered.filter(c => c.status === status);
    if (urgency) filtered = filtered.filter(c => c.urgency === urgency.toLowerCase());

    const total = filtered.length;
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    sendSuccess(res, 200, {
      complaints: paginated,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
    }, 'Complaints retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaints');
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

app.get('/api/applicant-form', (req, res) => {
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

// 14. NOTIFICATIONS
app.get('/api/notifications', (req, res) => {
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
app.get('/api/qms-audit-logs', requireRole('admin'), (req, res) => {
  try {
    logAudit('view-audit-logs', {}, req);
    const { limit = 50 } = req.query;
    const logs = auditLogs.slice(-limit).reverse();
    sendSuccess(res, 200, logs, 'Audit logs retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch audit logs');
  }
});

// 16. SOURCING ENDPOINTS

// PUBLIC — Submit job application with CV, photo, passport uploads
app.post('/submit_application', uploadApplication.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'passport', maxCount: 1 }
]), (req, res) => {
  try {
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

// ADMIN — View all received applications
app.get('/api/applications', (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    let results = applicantForms;
    if (status) results = results.filter(a => a.status === status);
    const paginated = results.slice(Number(offset), Number(offset) + Number(limit));
    sendSuccess(res, 200, {
      total: results.length,
      applications: paginated.map(a => ({
        ...a,
        cvUrl: a.files.cv ? `/uploads/applications/${a.files.cv}` : null,
        photoUrl: a.files.photo ? `/uploads/applications/${a.files.photo}` : null,
        passportUrl: a.files.passport ? `/uploads/applications/${a.files.passport}` : null
      }))
    }, 'Applications retrieved');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch applications');
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

// GET sourcing leads
app.get('/api/sourcing-leads', (req, res) => {
  try {
    sendSuccess(res, 200, sourcingLeads, 'Sourcing leads retrieved');
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
app.post('/api/audit-log', (req, res) => {
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
app.post('/api/staff-performance', (req, res) => {
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

// POST add FRA worker
app.post('/api/fra/add-worker', (req, res) => {
  try {
    const { name, position, department } = req.body;
    if (!name) return sendError(res, 400, 'VALIDATION_ERROR', 'Worker name is required');
    const worker = {
      id: 'FRA-' + Date.now(),
      name: sanitizeInput(name),
      position: sanitizeInput(position || ''),
      department: sanitizeInput(department || ''),
      createdAt: new Date().toISOString()
    };
    fraWorkers.push(worker);
    logAudit('fra-add-worker', { id: worker.id, name: worker.name }, req);
    sendSuccess(res, 201, worker, 'FRA worker added');
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Failed to add FRA worker');
  }
});

// 17. ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'File size exceeds 50MB limit');
    }
    return sendError(res, 400, 'UPLOAD_ERROR', err.message);
  }
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
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
});

module.exports = app;

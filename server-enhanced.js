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
  return (req.headers['x-user-role'] || req.query.role || 'viewer').toLowerCase();
}

/**
 * Middleware: Require specific role
 * @param {string} role - Required role
 * @returns {function} Express middleware
 */
function requireRole(role) {
  return (req, res, next) => {
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

if (!fs.existsSync(qmsDocsDir)) fs.mkdirSync(qmsDocsDir, { recursive: true });

let qmsDocs = [];
let welfareComplaints = [];
let applicantForms = [];
let fraWorkers = [];
let auditLogs = [];
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

// 6. MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    sendSuccess(res, 200, {
      message: 'Login successful',
      role: user.role,
      username: user.username,
      ...(user.allowedModules && { allowedModules: user.allowedModules })
    });
  } catch (err) {
    console.error('Login error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

app.get('/logout', (req, res) => {
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

// 15. AUDIT LOGS (Admin only)
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

// 16. ERROR HANDLER
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

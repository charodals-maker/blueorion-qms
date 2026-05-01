// ============================================================================
// BLUEORION QMS SERVER - PROPERLY ORGANIZED
// ============================================================================

// 1. REQUIRE ALL MODULES (MUST BE FIRST)
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

// 3. HELPER FUNCTIONS (BEFORE CONSTANTS THAT USE THEM)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function countFiles(folder) {
  const dirPath = path.join(__dirname, folder);
  if (!fs.existsSync(dirPath)) return 0;
  try {
    return fs.readdirSync(dirPath).length;
  } catch { return 0; }
}

function getUserRole(req) {
  return (req.headers['x-user-role'] || req.query.role || 'viewer').toLowerCase();
}

function requireRole(role) {
  return (req, res, next) => {
    if (getUserRole(req) !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(getUserRole(req))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function requireStaffAuth(req, res, next) { next(); }

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim();
}

function sendSuccess(res, status, data, message) {
  res.status(status || 200).json({ success: true, data: data, message: message || 'Success' });
}

function sendError(res, status, code, message) {
  res.status(status || 500).json({ success: false, error: { code: code, message: message } });
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
  if (a.includes('upload') || a.includes('submit') || a.includes('create') || a.includes('register') || a.includes('applicant')) return 'CREATE';
  if (a.includes('update') || a.includes('edit') || a.includes('status') || a.includes('approve') || a.includes('ofw-status')) return 'UPDATE';
  if (a.includes('delete') || a.includes('remove')) return 'DELETE';
  if (a.includes('export') || a.includes('download')) return 'EXPORT';
  return 'SYSTEM';
}
function logAudit(action, details, req) {
  const rawIp = (req && (req.headers['x-forwarded-for'] || req.ip || '')) || 'unknown';
  const ip = String(rawIp).split(',')[0].trim();
  const user = (req && req.headers && req.headers['x-user'])
    ? req.headers['x-user']
    : ((details && details.username) ? details.username : 'system-anonymous');
  auditLogs.push({
    id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
    timestamp: new Date().toISOString(),
    user,
    action,
    severity: _auditSeverity(action),
    category: _auditCategory(action),
    ip,
    details: details || {}
  });
  if (auditLogs.length > 5000) auditLogs.splice(0, auditLogs.length - 5000);
  // Persist to disk (debounced)
  if (_auditSaveTimer) clearTimeout(_auditSaveTimer);
  _auditSaveTimer = setTimeout(() => {
    try { fs.writeFileSync(path.join(__dirname, 'data', 'audit_logs.json'), JSON.stringify(auditLogs.slice(-1000), null, 2), 'utf8'); } catch(e) {}
    _auditSaveTimer = null;
  }, 2000);
}
let _auditSaveTimer = null;

function addNotification(type, message) {
  notifications.push({
    id: (Date.now() + '-' + Math.floor(Math.random() * 10000)).toString(),
    timestamp: Date.now(),
    type, message,
    read: false
  });
}

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
  } catch (err) {
    console.error('Excel save error:', err);
  }
}

function getSystemStats() {
  return {
    qmsDocsCount: qmsDocs.length,
    welfareComplaintsCount: welfareComplaints.length,
    applicantFormsCount: applicantForms.length,
    documentsFolder: countFiles('Documents'),
    welfareFolder: countFiles('Welfare'),
    vouchersFolder: countFiles('Vouchers'),
    hiredWorkers: 1245,
    unreadNotifications: notifications.filter(n => !n.read).length
  };
}

// 4. GLOBAL CONSTANTS & DATA STORAGE
const qmsFolders = ['Welfare', 'Sourcing', 'Complaints', 'Management', 'Resources', 'Audit', 'Documents', 'Vouchers', 'Profiles', 'Selection', 'Contracts', 'FRA_System'];
const qmsDocsDir = path.join(__dirname, 'uploads', 'qms_docs');
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 10 * 60 * 1000;

if (!fs.existsSync(qmsDocsDir)) fs.mkdirSync(qmsDocsDir, { recursive: true });

// Persist qmsDocs to JSON so data survives server restarts
const QMS_DOCS_FILE = path.join(__dirname, 'data', 'qms_docs_store.json');
function loadQmsDocs() {
  try {
    if (fs.existsSync(QMS_DOCS_FILE)) {
      const raw = fs.readFileSync(QMS_DOCS_FILE, 'utf8');
      return JSON.parse(raw) || [];
    }
  } catch(e) { console.error('loadQmsDocs error:', e.message); }
  return [];
}
function saveQmsDocs() {
  try {
    const dir = path.dirname(QMS_DOCS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(QMS_DOCS_FILE, JSON.stringify(qmsDocs, null, 2), 'utf8');
  } catch(e) { console.error('saveQmsDocs error:', e.message); }
}

let qmsDocs = loadQmsDocs();
let welfareComplaints = [];
let applicantForms = [];
let fraWorkers = [];
let auditLogs = (() => {
  try {
    const f = path.join(__dirname, 'data', 'audit_logs.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')) || [];
  } catch(e) { console.error('loadAuditLogs error:', e.message); }
  return [];
})();
let notifications = [{ id: '0', timestamp: Date.now(), type: 'info', message: 'QMS started', read: false }];
let loginAttempts = {};

// OFW DATA STORES (JSON-persisted)
let ofwWorkers = (() => {
  try {
    const f = path.join(__dirname, 'data', 'ofw_workers.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')) || [];
  } catch(e) { console.error('loadOfwWorkers error:', e.message); }
  return [];
})();
let ofwComplaints = (() => {
  try {
    const f = path.join(__dirname, 'data', 'ofw_complaints.json');
    if (fs.existsSync(f)) {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      return Array.isArray(d) ? d : (Array.isArray(d && d.complaints) ? d.complaints : []);
    }
  } catch(e) { console.error('loadOfwComplaints error:', e.message); }
  return [];
})();
function saveOfwWorkers() {
  try { fs.writeFileSync(path.join(__dirname, 'data', 'ofw_workers.json'), JSON.stringify(ofwWorkers, null, 2), 'utf8'); } catch(e) {}
}
function saveOfwComplaints() {
  try { fs.writeFileSync(path.join(__dirname, 'data', 'ofw_complaints.json'), JSON.stringify(ofwComplaints, null, 2), 'utf8'); } catch(e) {}
}

const users = [
  { username: 'finance.accounting', password: hashPassword('Blue@Accounting2026'), role: 'accounting' },
  { username: 'blueorion.sg', password: hashPassword('Blue@2026!S'), role: 'document_controller' },
  { username: 'charo', password: hashPassword('president2026'), role: 'president' },
  { username: 'president.blueorion', password: hashPassword('Blue@President2026'), role: 'president' },
  { username: 'manager.operations', password: hashPassword('Blue@Manager2026'), role: 'manager' },
  { username: 'blueorion_staff01', password: hashPassword('BlueorionStart2026!'), role: 'encoder' },
  { username: 'welfare.officer', password: hashPassword('Blue@Welfare2026'), role: 'welfare_officer' },
  { username: 'applicant1', password: hashPassword('Applicant@2026'), role: 'applicant', allowedModules: ['complaint-grievance', 'sourcing-selection', 'welfare-monitoring'] },
  { username: 'applicant2', password: hashPassword('Applicant@2026'), role: 'applicant', allowedModules: ['complaint-grievance', 'sourcing-selection', 'welfare-monitoring'] },
];

const SIDEBAR_LINKS = {
  admin: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'QMS Document Center', url: '/views/qms_document_center.html', icon: '📂' },
    { label: 'Welfare Spreadsheet', url: '/views/welfare_spreadsheet.html', icon: '📑' },
    { label: 'Welfare & Monitoring', url: '/welfare_monitoring.html', icon: '🩺' },
    { label: 'Reports', url: '/views/report.html', icon: '📊' },
    { label: 'Vouchers', url: '/views/expense_voucher.html', icon: '💸' },
    { label: 'Sourcing', url: '/views/sourcing_dashboard.html', icon: '🔎' },
    { label: 'Contact', url: '/views/contact_us.html', icon: '📞' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  welfare_officer: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'Welfare & Monitoring', url: '/welfare_monitoring.html', icon: '🩺' },
    { label: 'Welfare Spreadsheet', url: '/views/welfare_spreadsheet.html', icon: '📑' },
    { label: 'Contact', url: '/views/contact_us.html', icon: '📞' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ],
  applicant: [
    { label: 'Dashboard', url: '/views/admin.html', icon: '🏠', highlight: true },
    { label: 'Complaint & Grievance', url: '/welfare_monitoring.html', icon: '🩺' },
    { label: 'Profile', url: '/views/profile.html', icon: '👤' },
    { label: 'Contact', url: '/views/contact_us.html', icon: '📞' },
    { label: 'Logout', url: '/logout', icon: '🔐' }
  ]
};

// 5. MULTER STORAGE
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, qmsDocsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage });

// OFW complaint attachment multer
const ofwComplaintUploadsDir = path.join(__dirname, 'uploads', 'ofw_complaints');
if (!fs.existsSync(ofwComplaintUploadsDir)) fs.mkdirSync(ofwComplaintUploadsDir, { recursive: true });
const ofwComplaintStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ofwComplaintUploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, Date.now() + '-' + safe);
  }
});
const uploadOfwAttachment = multer({
  storage: ofwComplaintStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(pdf|jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// 6. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/blueorion-qms', express.static(path.join(__dirname, 'BLUEORION_QMS')));

// Ensure QMS folders exist
qmsFolders.forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('\u2713 Folder created: ' + folder);
  }
  app.use(`/folders/${folder}`, express.static(dir));
});

// 7. CORE ROUTES
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /'));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://blueorion-qms.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>'));
app.get('/:page.html', (req, res, next) => {
  const page = req.params.page;
  const rootFile = path.join(__dirname, page + '.html');
  if (require('fs').existsSync(rootFile)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(rootFile);
  }
  res.sendFile(path.join(__dirname, 'views', page + '.html'), err => { if(err) next(); });
});

// 8. AUTHENTICATION
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    logAudit('login-fail', { username, reason: 'Missing credentials' }, req);
    return res.status(400).json({ message: 'Username and password required.' });
  }
  
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const key = username + '|' + ip;
  const now = Date.now();
  
  if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lockUntil: 0 };
  if (loginAttempts[key].lockUntil > now) {
    logAudit('login-locked', { username, ip }, req);
    return res.status(429).json({ message: 'Too many attempts. Try later.' });
  }
  
  const user = users.find(u => u.username === username);
  if (!user || user.password !== hashPassword(password)) {
    loginAttempts[key].count++;
    if (loginAttempts[key].count >= MAX_LOGIN_ATTEMPTS) {
      loginAttempts[key].lockUntil = now + LOGIN_LOCK_TIME;
      logAudit('login-lockout', { username, ip }, req);
      return res.status(429).json({ message: 'Account locked. Try again later.' });
    }
    logAudit('login-fail', { username, ip, attempts: loginAttempts[key].count }, req);
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  
  loginAttempts[key] = { count: 0, lockUntil: 0 };
  logAudit('login-success', { username, ip }, req);
  addNotification('info', username + ' logged in');
  
  res.json({ message: 'Login successful', role: user.role, username: user.username, ...(user.allowedModules && { allowedModules: user.allowedModules }) });
});

app.get('/logout', (req, res) => {
  logAudit('logout', {}, req);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.redirect('/login.html');
});

app.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// 9. DASHBOARD & STATS (ENHANCED)
app.get('/api/stats', (req, res) => {
  try {
    res.json(getSystemStats());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
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
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

app.get('/api/check-folder/:folderName', (req, res) => {
  const folderPath = path.join(__dirname, req.params.folderName);
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    res.json({ success: true, folderName: req.params.folderName, fileCount: files.length, files });
  } else {
    res.status(404).json({ success: false, message: 'Folder not found' });
  }
});

app.get('/api/list-files/:folder', (req, res) => {
  const folder = req.params.folder;
  const folderPath = path.join(__dirname, folder);
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    res.json({ success: true, folder, fileCount: files.length, files });
  } else {
    res.status(404).json({ success: false, message: 'Folder not found' });
  }
});

// 10. QMS DOCUMENTS
app.post('/api/qms-documents/upload', requireAnyRole('admin','document_controller','president','manager','accounting'), upload.single('file'), (req, res) => {
  if (!req.file || !req.body.name) return res.status(400).json({ message: 'File and name required.' });
  const now = new Date().toISOString();
  const url = `/uploads/qms_docs/${req.file.filename}`;
  const categories = req.body.categories ? req.body.categories.split(',').map(s => s.trim()).filter(Boolean) : [];
  const tags = req.body.tags ? req.body.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
  
  let doc = qmsDocs.find(d => d.name === req.body.name);
  if (doc) {
    doc.versions = doc.versions || [];
    doc.versions.push({ url: doc.url, dateUploaded: doc.dateUploaded });
    doc.url = url;
    doc.type = req.file.mimetype;
    doc.uploadedBy = req.body.uploadedBy || 'Unknown';
    doc.dateUploaded = now;
    doc.version = (doc.version || 1) + 1;
    doc.approval = { status: 'pending', requestedBy: doc.uploadedBy, dateRequested: now };
    doc.categories = categories;
    doc.tags = tags;
  } else {
    doc = {
      id: Date.now().toString(),
      name: req.body.name,
      type: req.file.mimetype,
      uploadedBy: req.body.uploadedBy || 'Unknown',
      dateUploaded: now,
      url,
      version: 1,
      approval: { status: 'pending', requestedBy: req.body.uploadedBy || 'Unknown', dateRequested: now },
      categories,
      tags,
      versions: []
    };
    qmsDocs.push(doc);
  }
  saveQmsDocs();
  logAudit('upload', { name: doc.name, version: doc.version }, req);
  saveQmsDocs();
  addNotification('qms', 'Document uploaded');
  res.json({ message: 'Document uploaded', doc });
});

app.post('/api/qms-documents/upload/bulk', requireAnyRole('admin','document_controller','president','manager','accounting'), upload.array('files', 20), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ message: 'No files.' });
  const uploaded = [];
  const now = new Date().toISOString();
  req.files.forEach(file => {
    const name = file.originalname.split('.').slice(0, -1).join('.') || file.originalname;
    const url = `/uploads/qms_docs/${file.filename}`;
    let doc = qmsDocs.find(d => d.name === name);
    if (doc) {
      doc.versions = doc.versions || [];
      doc.versions.push({ url: doc.url, dateUploaded: doc.dateUploaded });
      doc.url = url;
      doc.type = file.mimetype;
      doc.uploadedBy = req.body.uploadedBy || 'Unknown';
      doc.dateUploaded = now;
      doc.version = (doc.version || 1) + 1;
    } else {
      doc = { id: Date.now().toString() + Math.random(), name, type: file.mimetype, uploadedBy: req.body.uploadedBy || 'Unknown', dateUploaded: now, url, version: 1, versions: [] };
      qmsDocs.push(doc);
    }
    uploaded.push(doc);
    logAudit('upload', { name: doc.name }, req);
  });
  saveQmsDocs();
  addNotification('qms', 'Bulk upload complete: ' + (uploaded ? uploaded.length : '') + ' docs');
  res.json({ message: 'Bulk upload complete', uploaded });
});

app.get('/api/qms-documents', (req, res) => {
  logAudit('list-documents', { count: qmsDocs.length }, req);
  let docs = qmsDocs;
  const { q, uploader, category, tag } = req.query;
  if (q) docs = docs.filter(d => (d.name || '').toLowerCase().includes(q.toLowerCase()));
  if (uploader) docs = docs.filter(d => (d.uploadedBy || '').toLowerCase().includes(uploader.toLowerCase()));
  if (category) docs = docs.filter(d => (d.categories || []).map(c => c.toLowerCase()).includes(category.toLowerCase()));
  if (tag) docs = docs.filter(d => (d.tags || []).map(t => t.toLowerCase()).includes(tag.toLowerCase()));
  res.json(docs);
});

// Approve a document
app.post('/api/qms-documents/:docName/approve', requireAnyRole('admin','document_controller','president','manager'), (req, res) => {
  const docName = decodeURIComponent(req.params.docName);
  const doc = qmsDocs.find(d => d.name === docName);
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  doc.approval = { status: 'approved', approvedBy: req.body.user || 'Unknown', dateApproved: new Date().toISOString() };
  saveQmsDocs();
  logAudit('approve-document', { name: docName }, req);
  res.json({ message: 'Document approved.', doc });
});

// Reject a document
app.post('/api/qms-documents/:docName/reject', requireAnyRole('admin','document_controller','president','manager'), (req, res) => {
  const docName = decodeURIComponent(req.params.docName);
  const doc = qmsDocs.find(d => d.name === docName);
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  doc.approval = { status: 'rejected', rejectedBy: req.body.user || 'Unknown', dateRejected: new Date().toISOString(), comment: req.body.comment || '' };
  saveQmsDocs();
  logAudit('reject-document', { name: docName }, req);
  res.json({ message: 'Document rejected.', doc });
});

// Get document versions
app.get('/api/qms-documents/:docName/versions', (req, res) => {
  const docName = decodeURIComponent(req.params.docName);
  const doc = qmsDocs.find(d => d.name === docName);
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  const versions = (doc.versions || []).map((v, i) => ({
    version: i + 1,
    url: v.url,
    dateUploaded: v.dateUploaded,
    current: false
  }));
  versions.push({ version: doc.version || versions.length + 1, url: doc.url, dateUploaded: doc.dateUploaded, current: true });
  versions.sort((a, b) => b.version - a.version);
  res.json(versions);
});

app.get('/api/qms-documents/download/all', requireAnyRole('admin','document_controller','president','manager'), (req, res) => {
  logAudit('download-all-docs', {}, req);
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('qms-documents.zip');
  archive.pipe(res);
  qmsDocs.forEach(doc => {
    const filePath = path.join(__dirname, 'uploads', 'qms_docs', path.basename(doc.url));
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: `${doc.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-v${doc.version || 1}.bin` });
    }
  });
  archive.finalize();
});

function _serveAuditLogs(req, res) {
  try {
    const limit  = Math.min(1000, Math.max(1, parseInt(req.query.limit)  || 200));
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const { user, action, severity, category, dateFrom, dateTo, search } = req.query;
    let list = [...auditLogs].reverse();
    if (user)     list = list.filter(l => (l.user || '').toLowerCase().includes(user.toLowerCase()));
    if (action)   list = list.filter(l => (l.action || '').toLowerCase().includes(action.toLowerCase()));
    if (severity) list = list.filter(l => (l.severity || '').toUpperCase() === severity.toUpperCase());
    if (category) list = list.filter(l => (l.category || '').toUpperCase() === category.toUpperCase());
    if (dateFrom) list = list.filter(l => l.timestamp && l.timestamp >= dateFrom);
    if (dateTo)   list = list.filter(l => l.timestamp && l.timestamp <= dateTo + 'T23:59:59Z');
    if (search)   list = list.filter(l => {
      const s = search.toLowerCase();
      return (l.user||'').toLowerCase().includes(s) ||
             (l.action||'').toLowerCase().includes(s) ||
             (l.ip||'').includes(s) ||
             (l.category||'').toLowerCase().includes(s) ||
             JSON.stringify(l.details||{}).toLowerCase().includes(s);
    });
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = list.slice((page - 1) * limit, page * limit);
    // Summary stats
    const bySeverity = { INFO: 0, WARNING: 0, ERROR: 0 };
    list.forEach(l => { if (bySeverity[l.severity] !== undefined) bySeverity[l.severity]++; else bySeverity.INFO++; });
    res.json({
      success: true,
      data: paged,
      pagination: { page, limit, total, totalPages },
      summary: { bySeverity }
    });
  } catch(e) {
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
}

app.get('/api/audit-logs', requireAnyRole('admin','document_controller','president','manager','accounting','encoder','welfare_officer'), _serveAuditLogs);

app.get('/api/qms-audit-logs', requireAnyRole('admin','document_controller','president','manager'), _serveAuditLogs);

// 11. WELFARE COMPLAINTS
app.post('/api/welfare-complaints', (req, res) => {
  const { applicantName, location, employerName, agencyName, category, urgency, description } = req.body;
  if (!applicantName || !location || !employerName || !agencyName || !category || !urgency || !description) {
    return res.status(400).json({ message: 'All fields required.' });
  }
  const complaint = {
    id: Date.now().toString(),
    applicantName, location, employerName, agencyName, category, urgency, description,
    date: new Date().toISOString(),
    status: 'pending'
  };
  welfareComplaints.push(complaint);
  saveToExcel(path.join(__dirname, 'welfare_complaints.xlsx'), complaint, 'Complaints');
  logAudit('complaint-submitted', { applicantName, category, urgency }, req);
  addNotification('welfare', 'Complaint from ' + applicantName);
  res.status(201).json({ message: 'Submitted.', complaint });
});

app.get('/api/welfare-complaints', (req, res) => {
  logAudit('list-complaints', { count: welfareComplaints.length }, req);
  res.json(welfareComplaints);
});

app.post('/api/welfare-complaints/import', (req, res) => {
  const { complaints } = req.body;
  if (!Array.isArray(complaints) || complaints.length === 0) {
    return res.status(400).json({ message: 'No data provided.' });
  }
  for (const c of complaints) {
    welfareComplaints.push({
      id: Date.now().toString() + Math.random(), applicantName: c.applicantName || '', location: c.location || '',
      employerName: c.employerName || '', agencyName: c.agencyName || '', category: c.category || '',
      urgency: c.urgency || '', description: c.description || '', date: c.date || new Date().toISOString(), status: 'pending'
    });
  }
  logAudit('complaints-imported', { count: complaints.length }, req);
  res.json({ message: complaints.length + ' imported.' });
});

// 12. APPLICANT FORMS
app.post('/api/applicant-form', (req, res) => {
  const { fullName, email, contact, position, applicationDate, notes } = req.body;
  if (!fullName || !email || !contact || !position || !applicationDate) {
    return res.status(400).json({ message: 'Required fields missing.' });
  }
  const entry = {
    id: Date.now().toString(),
    fullName, email, contact, position, applicationDate, notes,
    submitted: new Date().toISOString()
  };
  applicantForms.push(entry);
  saveToExcel(path.join(__dirname, 'applicant_forms.xlsx'), entry, 'Applicants');
  logAudit('applicant-submitted', { fullName, position }, req);
  addNotification('applicant', 'Application from ' + fullName);
  res.status(201).json({ message: 'Submitted.', entry });
});

app.get('/api/applicant-form', (req, res) => {
  logAudit('list-applicants', { count: applicantForms.length }, req);
  res.json(applicantForms);
});

// 13. NOTIFICATIONS
app.get('/api/notifications', (req, res) => {
  res.json(notifications.slice(-100).reverse());
});

app.post('/api/notifications/:id/read', (req, res) => {
  const notif = notifications.find(n => n.id === req.params.id);
  if (notif) notif.read = true;
  res.json({ success: !!notif });
});

app.post('/api/notifications/mark-all-read', (req, res) => {
  notifications.forEach(n => n.read = true);
  res.json({ success: true });
});

// 14. SIDEBAR & NAVIGATION
app.get('/api/sidebar-links', (req, res) => {
  const role = getUserRole(req);
  const links = SIDEBAR_LINKS[role] || SIDEBAR_LINKS['admin'];
  res.json({ role, links });
});

// 15. EXPENSES & VOUCHERS
app.post('/api/save-expense', (req, res) => {
  const { category, amount, paymentType, staffName } = req.body;
  const newEntry = {
    date: new Date().toLocaleDateString(),
    category, amount: parseFloat(amount), paymentType, staff: staffName
  };
  try {
    saveToExcel(path.join(__dirname, 'Centralized_Expenses.xlsx'), newEntry, 'Expenses');
    logAudit('expense-saved', { category, amount }, req);
    addNotification('expense', 'Expense: ' + category);
    res.json({ success: true, message: 'Saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

app.post('/api/upload-voucher', (req, res) => {
  const { amount, category, description } = req.body;
  try {
    fs.appendFileSync(path.join(__dirname, 'expenses_log.json'), JSON.stringify({ date: new Date().toISOString(), amount, category, description }) + '\n');
    logAudit('voucher-uploaded', { category, amount }, req);
    addNotification('voucher', 'Voucher: ' + category);
    res.json({ success: true, message: 'Linked!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

// 16. SQL TOOLS (DEMO)
app.post('/api/sqltools/query', (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query.' });
  const lower = query.trim().toLowerCase();
  if (lower === 'select * from welfare_complaints;') return res.json(welfareComplaints);
  if (lower === 'select * from qms_docs;') return res.json(qmsDocs);
  if (lower === 'select * from applicants;') return res.json(applicantForms);
  res.status(400).json({ error: 'Query not supported in demo.' });
});

// 16b. OFW MONITORING SYSTEM

// View routes
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/ofw-monitoring', (req, res) => res.sendFile(path.join(__dirname, 'views', 'ofw_monitoring.html')));
app.get('/ofw-portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ofw_portal.html')));

// Public: Check worker status by passport + name
app.get('/api/ofw/check', (req, res) => {
  try {
    const { passport, name } = req.query;
    if (!passport || !name) return sendError(res, 400, 'VALIDATION_ERROR', 'Passport and name required');
    const w = ofwWorkers.find(x =>
      x.passportNo && x.passportNo.toUpperCase() === passport.toUpperCase() &&
      x.fullName && x.fullName.toLowerCase().includes(name.toLowerCase())
    );
    if (!w) return sendSuccess(res, 200, null, 'Not found');
    const safe = { id: w.id, fullName: w.fullName, country: w.country, employer: w.employer,
      position: w.position, deploymentDate: w.deploymentDate, contractEnd: w.contractEnd, status: w.status };
    sendSuccess(res, 200, safe, 'Worker found');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to check status'); }
});

// GET all OFW workers (admin, paginated + filtered)
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
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = list.slice((page - 1) * limit, page * limit);
    res.json({ success: true, data: paged, pagination: { page, limit, total, totalPages } });
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch workers'); }
});

// GET single OFW worker with complaints
app.get('/api/ofw/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const w = ofwWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const complaints = ofwComplaints.filter(c => c.passportNo === w.passportNo);
    sendSuccess(res, 200, { ...w, complaints, complaintCount: complaints.length }, 'Worker retrieved');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch worker'); }
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
      agentName: sanitizeInput(req.body.agentName || ''),
      notes: sanitizeInput(req.body.notes || ''),
      createdAt: new Date().toISOString()
    };
    ofwWorkers.push(worker);
    saveOfwWorkers();
    logAudit('ofw-worker-registered', { id: worker.id, name: worker.fullName, country: worker.country }, req);
    sendSuccess(res, 201, { id: worker.id }, 'Worker registered');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to register worker'); }
});

// PATCH update OFW worker status
app.patch('/api/ofw/workers/:id/status', requireStaffAuth, (req, res) => {
  try {
    const w = ofwWorkers.find(x => x.id === req.params.id);
    if (!w) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    w.status = sanitizeInput(req.body.status || w.status);
    if (req.body.remarks) w.lastRemark = sanitizeInput(req.body.remarks);
    w.updatedAt = new Date().toISOString();
    saveOfwWorkers();
    logAudit('ofw-status-updated', { id: w.id, status: w.status }, req);
    sendSuccess(res, 200, { id: w.id, status: w.status }, 'Status updated');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update status'); }
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
      'deploymentDate','contractEnd','status','emergencyContact','agentName','salary','notes'];
    editable.forEach(f => {
      if (req.body[f] === undefined) return;
      const raw = String(req.body[f]);
      w[f] = sanitizeInput(f === 'passportNo' ? raw.toUpperCase() : raw);
    });
    w.updatedAt = new Date().toISOString();
    ofwWorkers[idx] = w;
    saveOfwWorkers();
    logAudit('ofw-worker-updated', { id: w.id, name: w.fullName }, req);
    sendSuccess(res, 200, w, 'Worker updated');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update worker'); }
});

// DELETE OFW worker record
app.delete('/api/ofw/workers/:id', requireStaffAuth, (req, res) => {
  try {
    const idx = ofwWorkers.findIndex(x => x.id === req.params.id);
    if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Worker not found');
    const removed = ofwWorkers.splice(idx, 1)[0];
    saveOfwWorkers();
    logAudit('ofw-worker-deleted', { id: removed.id, name: removed.fullName }, req);
    sendSuccess(res, 200, { id: removed.id }, 'Worker record deleted');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to delete worker'); }
});

// GET OFW stats + daily deployment schedule
app.get('/api/ofw/stats', requireStaffAuth, (req, res) => {
  try {
    const byCountry = {};
    ofwWorkers.forEach(w => { byCountry[w.country] = (byCountry[w.country] || 0) + 1; });
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const toStr = d => d.toISOString().slice(0, 10);
    const todayStr     = toStr(nowPH);
    const yesterdayStr = toStr(new Date(nowPH.getTime() - 86400000));
    const tomorrowStr  = toStr(new Date(nowPH.getTime() + 86400000));
    const daily = {};
    ofwWorkers.forEach(w => {
      if (w.deploymentDate) {
        const d = String(w.deploymentDate).slice(0, 10);
        daily[d] = (daily[d] || 0) + 1;
      }
    });
    const schedule = [];
    for (let i = -3; i <= 14; i++) {
      const dt = new Date(nowPH.getTime() + i * 86400000);
      const ds = toStr(dt);
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
      openComplaints: ofwComplaints.filter(c => c.status === 'Open' || c.status === 'Pending').length,
      deployedYesterday: daily[yesterdayStr] || 0,
      deployedToday:     daily[todayStr]     || 0,
      deployedTomorrow:  daily[tomorrowStr]  || 0,
      daily,
      schedule
    }, 'Stats retrieved');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get stats'); }
});

// GET tracker data (public)
app.get('/api/ofw/tracker', (req, res) => {
  try {
    const deployed = ofwWorkers.filter(w => w.status === 'Active');
    sendSuccess(res, 200, {
      data: ofwWorkers,
      deployed,
      stats: {
        total: ofwWorkers.length,
        deployedCount: deployed.length,
        conversionRate: ofwWorkers.length > 0 ? Math.round((deployed.length / ofwWorkers.length) * 100) : 0
      }
    }, 'Tracker data retrieved');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get tracker data'); }
});

// GET all OFW complaints (admin, filtered)
app.get('/api/ofw/complaints', requireStaffAuth, (req, res) => {
  try {
    const { country, status, severity } = req.query;
    let list = [...ofwComplaints].sort((a, b) => new Date(b.dateFiled) - new Date(a.dateFiled));
    if (country)  list = list.filter(c => c.country === country);
    if (status)   list = list.filter(c => c.status === status);
    if (severity) list = list.filter(c => c.severity === severity);
    sendSuccess(res, 200, list, 'Complaints retrieved');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch complaints'); }
});

// Public: Track complaint by ref + passport
app.get('/api/ofw/complaints/track', (req, res) => {
  try {
    const { ref, passport } = req.query;
    if (!ref || !passport) return sendError(res, 400, 'VALIDATION_ERROR', 'Reference and passport required');
    const c = ofwComplaints.find(x =>
      x.refNo && x.refNo.toUpperCase() === ref.toUpperCase() &&
      x.passportNo && x.passportNo.toUpperCase() === passport.toUpperCase()
    );
    if (!c) return sendSuccess(res, 200, null, 'Not found');
    sendSuccess(res, 200, { refNo: c.refNo, category: c.category, severity: c.severity,
      dateFiled: c.dateFiled, status: c.status, adminNotes: c.adminNotes || '' }, 'Found');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to track complaint'); }
});

// POST file complaint (public — worker portal, with optional attachment)
app.post('/api/ofw/complaints', uploadOfwAttachment.single('attachment'), (req, res) => {
  try {
    const { workerName, passportNo, country, category, severity, details } = req.body;
    if (!workerName || !passportNo || !country || !category || !severity || !details)
      return sendError(res, 400, 'VALIDATION_ERROR', 'All required fields must be filled');
    const attachmentUrl = req.file ? '/uploads/ofw_complaints/' + req.file.filename : '';
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
      status: 'Open',
      adminNotes: '',
      dateFiled: new Date().toISOString()
    };
    ofwComplaints.push(complaint);
    saveOfwComplaints();
    addNotification('welfare', 'OFW complaint from ' + complaint.workerName);
    sendSuccess(res, 201, { id: complaint.id, refNo: complaint.refNo, attachmentUrl }, 'Complaint filed');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to file complaint'); }
});

// PATCH update complaint status (admin)
app.patch('/api/ofw/complaints/:id/status', requireStaffAuth, (req, res) => {
  try {
    const c = ofwComplaints.find(x => x.id === req.params.id);
    if (!c) return sendError(res, 404, 'NOT_FOUND', 'Complaint not found');
    c.status = sanitizeInput(req.body.status || c.status);
    if (req.body.adminNotes) c.adminNotes = sanitizeInput(req.body.adminNotes);
    c.updatedAt = new Date().toISOString();
    saveOfwComplaints();
    logAudit('ofw-complaint-updated', { id: c.id, status: c.status }, req);
    sendSuccess(res, 200, { id: c.id, status: c.status }, 'Complaint updated');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to update complaint'); }
});

// GET alerts: expiring contracts + emergencies
app.get('/api/ofw/alerts', requireStaffAuth, (req, res) => {
  try {
    const today = new Date();
    const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const alerts = [];
    ofwWorkers.forEach(w => {
      if (w.contractEnd) {
        const end = new Date(w.contractEnd);
        if (end <= in60days && end >= today) {
          alerts.push({ type: 'contract_expiry', workerId: w.id, workerName: w.fullName,
            country: w.country, contractEnd: w.contractEnd,
            daysLeft: Math.ceil((end - today) / (1000 * 60 * 60 * 24)) });
        } else if (end < today && w.status === 'Active') {
          alerts.push({ type: 'contract_expired', workerId: w.id, workerName: w.fullName,
            country: w.country, contractEnd: w.contractEnd, daysLeft: 0 });
        }
      }
      if (w.status === 'Emergency') {
        alerts.push({ type: 'emergency', workerId: w.id, workerName: w.fullName, country: w.country });
      }
    });
    sendSuccess(res, 200, alerts, alerts.length + ' alert(s) found');
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to get alerts'); }
});

// GET export OFW workers as CSV
app.get('/api/ofw/export', requireStaffAuth, (req, res) => {
  try {
    const headers = ['ID','Full Name','Passport No','DOB','Country','Employer',
      'Position','Salary','Deployment Date','Contract End','Status','Emergency Contact','Agent','Notes'];
    const rows = ofwWorkers.map(w => [
      w.id, w.fullName, w.passportNo, w.dob || '', w.country, w.employer || '',
      w.position || '', w.salary || '', w.deploymentDate || '', w.contractEnd || '',
      w.status || 'Active', w.emergencyContact || '', w.agentName || '',
      (w.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ofw_workers_' + new Date().toISOString().slice(0,10) + '.csv"');
    res.send(csv);
  } catch(err) { sendError(res, 500, 'SERVER_ERROR', 'Failed to export workers'); }
});

// 16b. PHOTO GALLERY API
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});
const galleryMetaFile = path.join(galleryDir, '_meta.json');
function loadGalleryMeta() {
  try { return JSON.parse(fs.readFileSync(galleryMetaFile, 'utf8')); } catch { return []; }
}
function saveGalleryMeta(data) {
  fs.writeFileSync(galleryMetaFile, JSON.stringify(data, null, 2));
}

// List gallery photos
app.get('/api/gallery', (req, res) => {
  const meta = loadGalleryMeta();
  res.json({ success: true, photos: meta });
});

// Upload photo(s)
app.post('/api/gallery/upload', (req, res, next) => {
  galleryUpload.array('photos', 20)(req, res, (err) => {
    if (err) {
      console.error('Gallery upload error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    try {
      const meta = loadGalleryMeta();
      const added = req.files.map(f => ({
        filename: f.filename,
        url: '/uploads/gallery/' + f.filename,
        caption: (req.body.caption || '').trim().substring(0, 3000),
        category: (req.body.category || 'General').substring(0, 50),
        uploadedBy: sanitizeInput(req.body.uploadedBy || 'Staff'),
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

// Delete photo (admin/manager only)
app.delete('/api/gallery/:filename', requireAnyRole('admin', 'president', 'manager'), (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(galleryDir, filename);
  let meta = loadGalleryMeta();
  meta = meta.filter(p => p.filename !== filename);
  saveGalleryMeta(meta);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true, message: 'Photo deleted' });
});

// 17. ERROR HANDLER
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 18. START SERVER
const server = app.listen(PORT, () => {
  console.log(`\n✓ BLUEORION QMS Server: http://localhost:${PORT}`);
  console.log('\u2713 Folders initialized: ' + qmsFolders.length);
  console.log('\u2713 Stats ready\n');
});

module.exports = app;

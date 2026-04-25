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

function logAudit(action, details, req) {
  auditLogs.push({
    timestamp: new Date().toISOString(),
    user: (req && req.headers && req.headers['x-user']) ? req.headers['x-user'] : 'unknown',
    action, details
  });
}

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

let qmsDocs = [];
let welfareComplaints = [];
let applicantForms = [];
let fraWorkers = [];
let auditLogs = [];
let notifications = [{ id: '0', timestamp: Date.now(), type: 'info', message: 'QMS started', read: false }];
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

// 6. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure QMS folders exist
qmsFolders.forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(✓ Folder created:  + folder);
  }
  app.use(\/folders/\\, express.static(dir));
});

// 7. CORE ROUTES
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /'));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(\<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://\/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>\));
app.get('/:page.html', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'views', req.params.page + '.html'), err => { if(err) next(); });
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
app.post('/api/qms-documents/upload', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file || !req.body.name) return res.status(400).json({ message: 'File and name required.' });
  const now = new Date().toISOString();
  const url = \/uploads/qms_docs/\\;
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
  logAudit('upload', { name: doc.name, version: doc.version }, req);
  addNotification('qms', \Document: \\);
  res.json({ message: 'Document uploaded', doc });
});

app.post('/api/qms-documents/upload/bulk', requireRole('admin'), upload.array('files', 20), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ message: 'No files.' });
  const uploaded = [];
  const now = new Date().toISOString();
  req.files.forEach(file => {
    const name = file.originalname.split('.').slice(0, -1).join('.') || file.originalname;
    const url = \/uploads/qms_docs/\\;
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
  addNotification('qms', \Bulk: \ docs\);
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

app.get('/api/qms-documents/download/all', requireRole('admin'), (req, res) => {
  logAudit('download-all-docs', {}, req);
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('qms-documents.zip');
  archive.pipe(res);
  qmsDocs.forEach(doc => {
    const filePath = path.join(__dirname, 'uploads', 'qms_docs', path.basename(doc.url));
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: \\-v\.\\ });
    }
  });
  archive.finalize();
});

app.get('/api/qms-audit-logs', requireRole('admin'), (req, res) => {
  logAudit('view-audit-logs', {}, req);
  try {
    res.json(auditLogs.slice(-50).reverse());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

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
  addNotification('welfare', \Complaint from \\);
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
  res.json({ message: \\ imported.\ });
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
  addNotification('applicant', \Application from \\);
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
    addNotification('expense', \Expense: \\);
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
    addNotification('voucher', \Voucher: \\);
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

// 17. ERROR HANDLER
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 18. START SERVER
const server = app.listen(PORT, () => {
  console.log(\\n✓ BLUEORION QMS Server: http://localhost:\\);
  console.log(\✓ Folders initialized: \\);
  console.log(\✓ Stats: \\n\);
});

module.exports = app;

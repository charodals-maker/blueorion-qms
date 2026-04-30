const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove UTF-8 BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  console.log('Removed UTF-8 BOM');
}

const lines = content.split('\n');

function fixLine(lineNo, newContent) {
  lines[lineNo - 1] = newContent;
  console.log('Fixed line', lineNo);
}

// Line 205: bare checkmark in console.log
if (lines[204] && /console\.log\([\u2713\u2714]/.test(lines[204])) {
  fixLine(205, "    console.log('\u2713 Folder created: ' + folder);");
}

// Line 207: \/folders/\\ -> template literal
if (lines[206] && lines[206].includes('\\/folders/\\\\')) {
  fixLine(207, '  app.use(`/folders/${folder}`, express.static(dir));');
}

// Line 213: sitemap template literal corruption
if (lines[212] && lines[212].includes("send(\\<?xml")) {
  fixLine(213, "app.get('/sitemap.xml', (req, res) => res.type('application/xml').send('<?xml version=\"1.0\" encoding=\"UTF-8\"?>\\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\\n  <url><loc>https://blueorion-qms.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\\n</urlset>'));");
}

// Line 327: \/uploads/qms_docs/\\ -> template literal (single upload)
if (lines[326] && lines[326].includes('\\/uploads/qms_docs/\\\\')) {
  fixLine(327, '  const url = `/uploads/qms_docs/${req.file.filename}`;');
}

// Line 372: \/uploads/qms_docs/\\ -> template literal (bulk upload)
if (lines[371] && lines[371].includes('\\/uploads/qms_docs/\\\\')) {
  fixLine(372, '    const url = `/uploads/qms_docs/${file.filename}`;');
}

// Line 451: archive.file name template literal
if (lines[450] && lines[450].includes('\\\\-v\\.\\\\ ')) {
  fixLine(451, '      archive.file(filePath, { name: `${doc.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-v${doc.version || 1}.bin` });');
}

// Lines 599-601: startup console.log template literals
if (lines[598] && lines[598].includes('\\\\n')) {
  fixLine(599, '  console.log(`\\n\u2713 BLUEORION QMS Server: http://localhost:${PORT}`);');
}
if (lines[599] && lines[599].includes('\\u2713 Folders')) {
  fixLine(600, '  console.log(`\u2713 Folders initialized: ${qmsFolders.length}`);');
}
if (lines[600] && lines[600].includes('\\u2713 Stats')) {
  fixLine(601, '  console.log(`\u2713 Stats: ${qmsDocs.length} docs, ${qmsFolders.length} folders\\n`);');
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('server.js saved.');

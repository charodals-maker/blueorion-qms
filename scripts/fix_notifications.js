const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Fix notification lines - these have bare unquoted arguments due to template literal corruption
// Line 362: addNotification(qms, Document: \); -> proper call
if (lines[361] && lines[361].trim().startsWith('addNotification(qms, Document')) {
  lines[361] = "  addNotification('qms', 'Document uploaded');";
  console.log('Fixed line 362');
}

// Line 390: addNotification(qms, Bulk:  docs); -> proper call
if (lines[389] && lines[389].trim().startsWith('addNotification(qms, Bulk')) {
  lines[389] = "  addNotification('qms', 'Bulk upload complete: ' + (uploaded ? uploaded.length : '') + ' docs');";
  console.log('Fixed line 390');
}

// Also fix any remaining corrupted template literal patterns in console.log at startup
[598, 599, 600].forEach(n => {
  const l = lines[n];
  if (l && l.includes('console.log(\\')) {
    if (n === 598) lines[n] = "  console.log('\\n\\u2713 BLUEORION QMS Server: http://localhost:' + PORT);";
    if (n === 599) lines[n] = "  console.log('\\u2713 Folders initialized: ' + qmsFolders.length);";
    if (n === 600) lines[n] = "  console.log('\\u2713 Stats ready\\n');";
    console.log('Fixed line', n + 1);
  }
});

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done.');

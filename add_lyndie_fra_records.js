const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'data', 'fra_tracker_db.json');
let raw = fs.readFileSync(dbFile, 'utf8');
// Attempt to clean common non-JSON trailing commas/comments
raw = raw.replace(/^\uFEFF/, ''); // remove BOM if present
raw = raw.replace(/\/\*[^]*?\*\//g, ''); // remove block comments
raw = raw.replace(/\/\/.*$/gm, ''); // remove line comments
raw = raw.replace(/,\s*\]/g, ']'); // remove trailing commas before ]
raw = raw.replace(/,\s*\}/g, '}'); // remove trailing commas before }
let db = [];
try {
  db = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse JSON file:', e.message);
  console.error('Aborting script. Please check data/fra_tracker_db.json formatting.');
  process.exit(1);
}

// Remove any existing Lyndie entries to avoid duplicates
db = db.filter(r => !(r.fra && r.fra.toLowerCase().includes('lyndie')));

const total = 54;
const selectedCount = 2;

for (let i = 1; i <= total; i++) {
  const isSelected = i <= selectedCount;
  const applicantName = `LYNDIE_APPLICANT_${String(i).padStart(3,'0')}`;
  const entry = {
    fra: 'Lyndie',
    accreditation: 'N/A',
    applicant: applicantName,
    status: isSelected ? 'selected' : 'assigned',
    selectionDate: isSelected ? new Date().toISOString().slice(0,10) : '',
    agent: 'lyndie',
    remarks: 'Auto-generated for Lyndie FRA tracker'
  };
  db.push(entry);
}

fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
console.log(`Added ${total} Lyndie FRA records to ${dbFile}`);

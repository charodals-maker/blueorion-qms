const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'data', 'fra_tracker_db.json');
let dbRaw = fs.readFileSync(dbFile, 'utf8');
try { dbRaw = dbRaw.replace(/^\uFEFF/, ''); } catch(e) {}
let db = JSON.parse(dbRaw);

const applicants = [
  'ESTELA QUIRANTE',
  'DELIA MERCADO',
  'MERLIZA VARIACION',
  'JUVY GRACE ANESO',
  'CHERRY MAE YBANEZ',
  'SARAH JANE AGOSTO'
];

const fraName = 'MALAYSIA (AGENSI PEKERJAAN)';
const added = [];

applicants.forEach(name => {
  const entry = {
    fra: fraName,
    accreditation: '',
    applicant: name,
    status: 'assigned',
    selectionDate: '',
    agent: 'kristel',
    remarks: 'Assigned to MALAYSIA (AGENSI PEKERJAAN) - added by Kristel'
  };
  db.push(entry);
  added.push(entry);
});

fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
console.log('Added ' + added.length + ' MALAYSIA entries for Kristel to ' + dbFile);
console.log(added.map(a=>a.applicant).join(', '));

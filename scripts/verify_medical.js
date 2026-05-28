const fs = require('fs');
const c = fs.readFileSync('staff_workstation.html', 'utf8');
const checks = [
  ['Search bar', c.includes('id="bio-search"')],
  ['Filter dropdown', c.includes('bio-filter-status')],
  ['Summary row', c.includes('bio-search-summary')],
  ['Excel btn in HTML', c.includes('exportMedicalExcel()')],
  ['Excel fn exists', c.includes('function exportMedicalExcel')],
  ['Color expired row', c.includes('background:#fff1f1')],
  ['Color warning row', c.includes('background:#fffbeb')],
  ['Color green row', c.includes('background:#f0fdf4')],
  ['Expired banner', c.includes('CANNOT BE DEPLOYED')],
  ['NOTIFY NOW label', c.includes('NOTIFY NOW')],
  ['Day(s) OVERDUE', c.includes('OVERDUE')],
  ['Days left label', c.includes('day(s) left')],
  ['ISO CSV export', c.includes('exportMedicalComplianceChecklist')],
];
checks.forEach(([k,v]) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k));

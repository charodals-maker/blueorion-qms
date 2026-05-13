const fs = require('fs');
const c = fs.readFileSync('staff_workstation.html', 'utf8');

function addDaysISO(base, days) {
  if (!base) return '';
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + parseInt(days, 10));
  return d.toISOString().split('T')[0];
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target - t) / 86400000);
}

const today = new Date().toISOString().split('T')[0];

const tests = [
  { label: 'VALID (180 days from today)',     examDate: today,                   validityDays: 180, orNo: 'OR-001' },
  { label: 'WARNING (20 days remaining)',     examDate: addDaysISO(today, -160), validityDays: 180, orNo: 'OR-002' },
  { label: 'HARD-STOP (5 days remaining)',    examDate: addDaysISO(today, -175), validityDays: 180, orNo: 'OR-003' },
  { label: 'EXPIRED (10 days overdue)',       examDate: addDaysISO(today, -190), validityDays: 180, orNo: 'OR-004' },
  { label: 'LOCKED (no O.R. number)',         examDate: today,                   validityDays: 180, orNo: ''       },
];

console.log('\n=== MEDICAL COMPLIANCE LOGIC TEST ===\n');
let pass = 0, fail = 0;

tests.forEach(t => {
  const expiry   = addDaysISO(t.examDate, t.validityDays || 180);
  const remain   = daysUntil(expiry);
  const isExpired = remain !== null && remain < 0;
  const isWarning = remain !== null && remain >= 0 && remain < 30;
  const isGreen   = remain !== null && remain >= 30;
  const missingOR = !t.orNo;

  let indicator, expected;
  if (missingOR)       { indicator = 'LOCKED-NO-OR';    expected = 'LOCKED-NO-OR'; }
  else if (isExpired)  { indicator = 'RED/EXPIRED';     expected = 'RED/EXPIRED'; }
  else if (isWarning)  { indicator = 'YELLOW/WARNING';  expected = 'YELLOW/WARNING'; }
  else if (isGreen)    { indicator = 'GREEN/VALID';     expected = 'GREEN/VALID'; }
  else                 { indicator = 'UNKNOWN';         expected = '???'; }

  const ok = indicator === expected;
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  [' + indicator.padEnd(18) + ']  ' + t.label + '  |  expiry: ' + expiry + '  |  days: ' + remain);
});

console.log('\n--- File feature checks ---');
const feats = [
  ['Search bar',       c.includes('id="bio-search"')],
  ['Filter dropdown',  c.includes('bio-filter-status')],
  ['Summary row',      c.includes('bio-search-summary')],
  ['Excel btn',        c.includes('exportMedicalExcel()')],
  ['Excel fn',         c.includes('function exportMedicalExcel')],
  ['Green row CSS',    c.includes('background:#f0fdf4')],
  ['Yellow row CSS',   c.includes('background:#fffbeb')],
  ['Red row CSS',      c.includes('background:#fff1f1')],
  ['Expired banner',   c.includes('CANNOT BE DEPLOYED')],
  ['NOTIFY NOW',       c.includes('NOTIFY NOW')],
  ['OVERDUE label',    c.includes('OVERDUE')],
  ['ISO CSV export',   c.includes('exportMedicalComplianceChecklist')],
];
feats.forEach(([k, v]) => {
  if (v) pass++; else fail++;
  console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
});

console.log('\n=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===\n');

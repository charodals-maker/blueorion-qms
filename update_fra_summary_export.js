const fs = require('fs');
const path = require('path');

const fraFile = path.join(__dirname, 'data', 'fra_tracker_db.json');
const exportFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');

const fra = JSON.parse(fs.readFileSync(fraFile, 'utf8'));
let exportData = {};
try {
  exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
} catch (e) {
  console.error('Cannot read export file:', e.message);
  process.exit(1);
}

// Compute Lyndie stats
const lyndieRecords = fra.filter(r => (r.fra || '').toLowerCase() === 'lyndie');
const total = lyndieRecords.length;
const selected = lyndieRecords.filter(r => r.status === 'selected').length;
const assigned = lyndieRecords.filter(r => r.status === 'assigned' || r.status === 'selected' || r.status === 'deployed').length;
const available = lyndieRecords.filter(r => r.status === 'available').length;

exportData.fraSummary = exportData.fraSummary || {};
exportData.fraSummary.lyndie = {
  fra: 'Lyndie',
  availableCVs: available,
  assigned: assigned,
  selected: selected,
  totalApplicants: total,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
console.log('Updated export file with Lyndie FRA summary');
console.log(exportData.fraSummary.lyndie);

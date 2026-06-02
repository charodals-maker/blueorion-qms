const fs = require('fs');
const path = require('path');

const fraFile = path.join(__dirname, 'data', 'fra_tracker_db.json');
const exportFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');

const fra = JSON.parse(fs.readFileSync(fraFile, 'utf8'));
let exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

// Compute Kristel stats for MALAYSIA (AGENSI PEKERJAAN)
const fraName = 'MALAYSIA (AGENSI PEKERJAAN)';
const fraRecords = fra.filter(r => (r.fra||'').toUpperCase() === fraName.toUpperCase());
const total = fraRecords.length;
const selected = fraRecords.filter(r => r.status === 'selected').length;
const assigned = fraRecords.filter(r => r.status === 'assigned' || r.status === 'selected' || r.status === 'deployed').length;
const available = fraRecords.filter(r => r.status === 'available').length;

exportData.fraSummary = exportData.fraSummary || {};
exportData.fraSummary.kristel = {
  fra: fraName,
  availableCVs: available,
  assigned: assigned,
  selected: selected,
  totalApplicants: total,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
console.log('Updated export file with Kristel FRA summary');
console.log(exportData.fraSummary.kristel);

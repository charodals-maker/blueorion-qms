const fs = require('fs');
const path = require('path');

const exportFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');
let exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

// Update Kristel (user) FRA summary to requested values
exportData.fraSummary = exportData.fraSummary || {};
exportData.fraSummary.kristel = {
  fra: 'MALAYSIA (AGENSI PEKERJAAN)',
  availableCVs: 0,
  assigned: 35,
  selected: 3,
  totalApplicants: 35,
  updatedAt: new Date().toISOString()
};

// Adjust totalRecords to 52 as requested for uniformity
exportData.summary = exportData.summary || {};
exportData.summary.totalRecords = 52;
exportData.summary.generatedAt = new Date().toISOString();

fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
console.log('Updated export with new kristel summary and totalRecords=52');
console.log(exportData.fraSummary.kristel);

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data.fraSummary) data.fraSummary = {};
if (!data.fraSummary.kristel) data.fraSummary.kristel = {};

data.fraSummary.kristel.fra = 'MALAYSIA (AGENSI PEKERJAAN)';
data.fraSummary.kristel.availableCVs = 0;
data.fraSummary.kristel.assigned = 54;
data.fraSummary.kristel.selected = 3;
data.fraSummary.kristel.totalApplicants = 54;
data.fraSummary.kristel.updatedAt = new Date().toISOString();

data.summary = data.summary || {};
data.summary.totalRecords = 54;
data.summary.generatedAt = new Date().toISOString();

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Hard-saved Kristel dashboard to show 54 total applicants.');

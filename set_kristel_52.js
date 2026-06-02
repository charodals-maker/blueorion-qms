const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.fraSummary = data.fraSummary || {};
data.fraSummary.kristel = data.fraSummary.kristel || {};
data.fraSummary.kristel.fra = 'MALAYSIA (AGENSI PEKERJAAN)';
data.fraSummary.kristel.availableCVs = 0;
data.fraSummary.kristel.assigned = 52;
data.fraSummary.kristel.selected = 3;
data.fraSummary.kristel.totalApplicants = 52;
data.fraSummary.kristel.updatedAt = new Date().toISOString();

data.summary = data.summary || {};
data.summary.totalRecords = 52;
data.summary.generatedAt = new Date().toISOString();

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Updated Kristel stats to 52 and refreshed summary.totalRecords');

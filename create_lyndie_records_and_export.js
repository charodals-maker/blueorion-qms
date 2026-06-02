#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 1. READ EXISTING DATA
// ─────────────────────────────────────────────────────────────────────────────
const dataFile = path.join(__dirname, 'data', 'ws_lifecycle.json');
const rawData = fs.readFileSync(dataFile, 'utf-8');
let data = JSON.parse(rawData);
let records = Array.isArray(data) ? data : (data.records || []);

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  STEP 1: CREATE SAMPLE TEST RECORDS AS LYNDIE                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Get today's date
const today = new Date().toISOString();
const todayDate = today.slice(0, 10);

// Generate next ID
const getNextId = () => {
  const maxId = records.reduce((max, r) => {
    const num = parseInt(r.id.split('-')[2]);
    return num > max ? num : max;
  }, 0);
  return 'LC-' + todayDate.replace(/-/g, '') + '-' + String(maxId + 1).padStart(4, '0');
};

// Test records to create
const testRecords = [
  {
    name: 'Maria Santos',
    position: 'Caregiver',
    destination: 'UAE',
    medicalStatus: 'fit',
    tesdaStatus: 'competent',
    owwaStatus: 'cleared',
    stage: 'flight_ready',
    remarks: 'Test record - High priority deployment'
  },
  {
    name: 'Jennifer Cruz',
    position: 'Household Service Worker',
    destination: 'Saudi Arabia',
    medicalStatus: 'fit',
    tesdaStatus: 'pending',
    owwaStatus: 'pending',
    stage: 'medical',
    remarks: 'Test record - Medical approved, awaiting TESDA'
  },
  {
    name: 'Rosa Villanueva',
    position: 'Cook',
    destination: 'Singapore',
    medicalStatus: 'pending',
    tesdaStatus: 'not_yet_competent',
    owwaStatus: 'pending',
    stage: 'sourcing',
    remarks: 'Test record - New intake, pending all gates'
  },
  {
    name: 'Ana Reyes',
    position: 'Nanny',
    destination: 'Hong Kong',
    medicalStatus: 'fit',
    tesdaStatus: 'competent',
    owwaStatus: 'cleared',
    stage: 'flight_ready',
    remarks: 'Test record - Ready for immediate deployment'
  },
  {
    name: 'Grace Mendoza',
    position: 'Housekeeper',
    destination: 'Qatar',
    medicalStatus: 'conditional',
    tesdaStatus: 'competent',
    owwaStatus: 'pending',
    stage: 'medical',
    remarks: 'Test record - Medical conditional, needs follow-up'
  }
];

// Create records with lyndie as creator
const newRecords = testRecords.map((testRecord, idx) => {
  const deployReady = 
    testRecord.medicalStatus === 'fit' &&
    testRecord.tesdaStatus === 'competent' &&
    testRecord.owwaStatus === 'cleared';

  return {
    id: getNextId(),
    name: testRecord.name,
    passportNo: 'P' + String(Math.floor(Math.random() * 9000000) + 1000000),
    uli: 'ULI-' + todayDate.slice(0, 4) + '-' + String(records.length + idx + 1).padStart(4, '0'),
    position: testRecord.position,
    destination: testRecord.destination,
    applicantId: '',
    stage: testRecord.stage,
    medicalClinic: testRecord.medicalStatus === 'fit' ? 'Metro Medical Clinic' : '',
    medicalDate: testRecord.medicalStatus !== 'pending' ? todayDate : null,
    medicalStatus: testRecord.medicalStatus,
    medicalExpiryDate: testRecord.medicalStatus === 'fit' ? (new Date(new Date(today).setFullYear(new Date(today).getFullYear() + 2))).toISOString().slice(0, 10) : null,
    medicalCertNo: testRecord.medicalStatus !== 'pending' ? 'MC-2026-' + String(Math.random()).slice(2, 8) : '',
    medicalRemarks: 'Created by lyndie test batch',
    tesdaQualification: testRecord.tesdaStatus !== 'pending' ? 'NC II / III' : '',
    tesdaCenter: testRecord.tesdaStatus !== 'pending' ? 'TESDA Batangas' : '',
    tesdaStatus: testRecord.tesdaStatus,
    tesdaCertNo: testRecord.tesdaStatus === 'competent' ? 'TC-2026-' + String(Math.random()).slice(2, 8) : '',
    tesdaAssessmentDate: testRecord.tesdaStatus !== 'pending' ? todayDate : null,
    owwaStatus: testRecord.owwaStatus,
    pdosDate: testRecord.owwaStatus !== 'pending' ? todayDate : null,
    owwaInsurancePolicyNo: testRecord.owwaStatus === 'cleared' ? 'POL-2026-' + String(Math.random()).slice(2, 8) : '',
    oecStatus: testRecord.owwaStatus === 'cleared' ? 'cleared' : '',
    owwaRemarks: 'Created by lyndie test batch',
    remarks: testRecord.remarks,
    createdAt: today,
    updatedAt: today,
    createdBy: 'lyndie',
    lastUpdatedBy: 'lyndie',
    deployReady: deployReady,
    sharedScope: 'all_staff',
    sharedLinkage: {
      mode: 'central_server',
      visibleTo: 'all_staff',
      sharedBy: 'lyndie',
      sharedAt: today,
      source: 'test_batch'
    }
  };
});

console.log('✅ Created ' + newRecords.length + ' test records:\n');
newRecords.forEach((r, idx) => {
  console.log((idx + 1) + '. ' + r.name);
  console.log('   ID: ' + r.id + ' | Position: ' + r.position);
  console.log('   Stage: ' + r.stage + ' | Deploy Ready: ' + r.deployReady);
  console.log('   Medical: ' + r.medicalStatus + ' | TESDA: ' + r.tesdaStatus + ' | OWWA: ' + r.owwaStatus);
  console.log('   Passport: ' + r.passportNo + ' | ULI: ' + r.uli);
  console.log('');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. MERGE RECORDS TO ADMIN DATA
// ─────────────────────────────────────────────────────────────────────────────
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  STEP 2: MERGE RECORDS TO ADMIN DATA                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Merge: add new records to existing records
records = records.concat(newRecords);

// If data was an object with records property, update it
if (typeof data === 'object' && data.records) {
  data.records = records;
} else {
  data = records;
}

// Save merged data back to file
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

console.log('✅ Merged ' + newRecords.length + ' new records with existing data');
console.log('   Old count: ' + (records.length - newRecords.length));
console.log('   New count: ' + records.length);
console.log('   Total added: ' + newRecords.length + '\n');

// Summary after merge
console.log('Summary after merge:');
const byCreator = {};
records.forEach(r => {
  const creator = r.createdBy || 'Unknown';
  byCreator[creator] = (byCreator[creator] || 0) + 1;
});
Object.keys(byCreator).sort().forEach(creator => {
  console.log('  ' + creator + ': ' + byCreator[creator] + ' records');
});

const byStage = {};
records.forEach(r => {
  const stage = r.stage || 'unknown';
  byStage[stage] = (byStage[stage] || 0) + 1;
});
console.log('\nRecords by stage:');
Object.keys(byStage).sort().forEach(stage => {
  console.log('  ' + stage + ': ' + byStage[stage]);
});

const deployReady = records.filter(r => r.deployReady === true).length;
console.log('\nDeploy Ready: ' + deployReady + ' / ' + records.length + '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXPORT FULL ADMIN DASHBOARD DATA
// ─────────────────────────────────────────────────────────────────────────────
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  STEP 3: EXPORT FULL ADMIN DASHBOARD DATA                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Generate detailed admin export with analytics
const adminExport = {
  exportDate: today,
  exportedBy: 'system',
  summary: {
    totalRecords: records.length,
    newRecordsAdded: newRecords.length,
    previousCount: records.length - newRecords.length,
    deployReady: deployReady,
    deploymentRate: ((deployReady / records.length) * 100).toFixed(2) + '%',
    generatedAt: today
  },
  byStage: {},
  byCreator: {},
  byDestination: {},
  recentRecords: [],
  lyndieRecordsToday: [],
  deployReadyList: [],
  alerts: []
};

// Populate stage counts
Object.keys(byStage).forEach(stage => {
  adminExport.byStage[stage] = records.filter(r => r.stage === stage);
});

// Populate creator counts
Object.keys(byCreator).forEach(creator => {
  adminExport.byCreator[creator] = records.filter(r => r.createdBy === creator);
});

// Group by destination
records.forEach(r => {
  const dest = r.destination || 'Unknown';
  if (!adminExport.byDestination[dest]) {
    adminExport.byDestination[dest] = [];
  }
  adminExport.byDestination[dest].push(r);
});

// Get recent records (last 10)
adminExport.recentRecords = records.slice(-10).reverse();

// Get lyndie's records from today
adminExport.lyndieRecordsToday = records.filter(r => 
  r.createdBy === 'lyndie' && r.createdAt.startsWith(todayDate)
);

// Get deploy-ready records
adminExport.deployReadyList = records.filter(r => r.deployReady === true);

// Generate alerts
if (deployReady === 0) {
  adminExport.alerts.push({
    level: 'warning',
    message: 'No deployment-ready applicants. All gates must be clear: Medical=FIT, TESDA=COMPETENT, OWWA=CLEARED'
  });
}

if (adminExport.lyndieRecordsToday.length > 0) {
  adminExport.alerts.push({
    level: 'info',
    message: 'Lyndie created ' + adminExport.lyndieRecordsToday.length + ' record(s) today'
  });
}

// Export to JSON file
const exportFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_' + todayDate.replace(/-/g, '') + '.json');
const exportDir = path.dirname(exportFile);
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

fs.writeFileSync(exportFile, JSON.stringify(adminExport, null, 2));

console.log('✅ Exported admin dashboard data');
console.log('   Location: qms_safe_zone/ADMIN_DASHBOARD_EXPORT_' + todayDate.replace(/-/g, '') + '.json');
console.log('   Size: ' + (fs.statSync(exportFile).size / 1024).toFixed(2) + ' KB\n');

// Also export as CSV for spreadsheet
const csvFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_' + todayDate.replace(/-/g, '') + '.csv');
const csvHeaders = ['ID', 'Name', 'Position', 'Destination', 'Stage', 'Medical', 'TESDA', 'OWWA', 'Deploy Ready', 'Created By', 'Created At'];
const csvRows = records.map(r => [
  r.id,
  r.name,
  r.position || '',
  r.destination || '',
  r.stage || '',
  r.medicalStatus || '',
  r.tesdaStatus || '',
  r.owwaStatus || '',
  r.deployReady ? 'YES' : 'NO',
  r.createdBy || '',
  r.createdAt || ''
]);

const csvContent = csvHeaders.join(',') + '\n' +
  csvRows.map(row => row.map(cell => '"' + (cell || '').replace(/"/g, '""') + '"').join(',')).join('\n');

fs.writeFileSync(csvFile, csvContent);

console.log('✅ Exported as CSV spreadsheet');
console.log('   Location: qms_safe_zone/ADMIN_DASHBOARD_EXPORT_' + todayDate.replace(/-/g, '') + '.csv');
console.log('   Records: ' + csvRows.length + ' rows\n');

// ─────────────────────────────────────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  FINAL ADMIN DASHBOARD REPORT                                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📊 DASHBOARD METRICS:');
console.log('   Total Applicants: ' + records.length);
console.log('   Deploy Ready: ' + deployReady + ' (' + adminExport.summary.deploymentRate + ')');
console.log('   Added Today by Lyndie: ' + adminExport.lyndieRecordsToday.length);
console.log('');

console.log('📍 DISTRIBUTION BY DESTINATION:');
Object.keys(adminExport.byDestination).sort().forEach(dest => {
  const count = adminExport.byDestination[dest].length;
  const percent = ((count / records.length) * 100).toFixed(1);
  console.log('   ' + dest + ': ' + count + ' (' + percent + '%)');
});
console.log('');

console.log('🔧 STAGE BREAKDOWN:');
Object.keys(adminExport.byStage).sort().forEach(stage => {
  const count = adminExport.byStage[stage].length;
  const percent = ((count / records.length) * 100).toFixed(1);
  console.log('   ' + stage + ': ' + count + ' (' + percent + '%)');
});
console.log('');

console.log('👥 TEAM CONTRIBUTION:');
Object.keys(adminExport.byCreator).sort().forEach(creator => {
  const count = adminExport.byCreator[creator].length;
  const percent = ((count / records.length) * 100).toFixed(1);
  const isLyndie = creator === 'lyndie' ? ' ← TODAY' : '';
  console.log('   ' + creator + ': ' + count + ' (' + percent + ')' + isLyndie);
});
console.log('');

if (adminExport.alerts.length > 0) {
  console.log('⚠️  ALERTS:');
  adminExport.alerts.forEach(alert => {
    console.log('   [' + alert.level.toUpperCase() + '] ' + alert.message);
  });
  console.log('');
}

console.log('✅ ALL TASKS COMPLETED:');
console.log('   ✓ Created 5 test records as lyndie');
console.log('   ✓ Merged ' + newRecords.length + ' records to admin data (Total: ' + records.length + ')');
console.log('   ✓ Exported JSON and CSV reports to qms_safe_zone/');
console.log('\n' + '═'.repeat(64) + '\n');

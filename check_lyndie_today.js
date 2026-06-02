#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the lifecycle data file
const dataFile = path.join(__dirname, 'data', 'ws_lifecycle.json');
const rawData = fs.readFileSync(dataFile, 'utf-8');
const data = JSON.parse(rawData);
const records = Array.isArray(data) ? data : (data.records || []);

// Get today's date
const today = new Date().toISOString().slice(0, 10);

// Filter for lyndie's records created today
const lyndieToday = records.filter(r => {
  const createdBy = r.createdBy ? r.createdBy.toLowerCase() : '';
  const createdAt = r.createdAt ? r.createdAt.slice(0, 10) : '';
  return createdBy === 'lyndie' && createdAt === today;
});

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  LYNDIE ENCODED DATA - TODAY  (' + today + ')                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (lyndieToday.length === 0) {
  console.log('⚠️  No records created by lyndie today.\n');
} else {
  console.log('✅ Found ' + lyndieToday.length + ' record(s) created by lyndie today:\n');
  lyndieToday.forEach((r, idx) => {
    console.log((idx + 1) + '. ' + r.name);
    console.log('   ID: ' + r.id);
    console.log('   Position: ' + (r.position || 'N/A'));
    console.log('   Stage: ' + (r.stage || 'N/A'));
    console.log('   Medical: ' + (r.medicalStatus || 'pending') + ' | TESDA: ' + (r.tesdaStatus || 'pending') + ' | OWWA: ' + (r.owwaStatus || 'pending'));
    console.log('   Deploy Ready: ' + (r.deployReady || false));
    console.log('   Created: ' + r.createdAt + '\n');
  });
}

// Show admin merged data (all records summary)
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  ADMIN DATA VIEW - ALL RECORDS  (Merged)                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('Total Records in System: ' + records.length + '\n');

// Group by stage
const byStage = {};
records.forEach(r => {
  const stage = r.stage || 'unknown';
  if (!byStage[stage]) byStage[stage] = [];
  byStage[stage].push(r);
});

console.log('Records by Stage:');
Object.keys(byStage).sort().forEach(stage => {
  console.log('  ' + stage + ': ' + byStage[stage].length);
});

// Count deploy ready
const deployReady = records.filter(r => r.deployReady === true).length;
console.log('\nDeploy Ready: ' + deployReady);

// Group by creator
const byCreator = {};
records.forEach(r => {
  const creator = r.createdBy || 'Unknown';
  if (!byCreator[creator]) byCreator[creator] = [];
  byCreator[creator].push(r);
});

console.log('\nRecords by Creator:');
Object.keys(byCreator).sort().forEach(creator => {
  console.log('  ' + creator + ': ' + byCreator[creator].length);
});

// Recent records
console.log('\n' + '─'.repeat(64));
console.log('Recent 5 Records (Admin Dashboard View):');
console.log('─'.repeat(64) + '\n');

const recent = records.slice(-5).reverse();
recent.forEach((r, idx) => {
  const created = r.createdAt ? r.createdAt.slice(0, 10) : 'N/A';
  const creator = r.createdBy || 'N/A';
  console.log((idx + 1) + '. ' + r.name + ' | ' + r.position + ' → ' + r.destination);
  console.log('   Stage: ' + (r.stage || 'N/A') + ' | Created: ' + created + ' by ' + creator);
  console.log('   Gates: Medical ' + (r.medicalStatus || 'pending') + ' | TESDA ' + (r.tesdaStatus || 'pending') + ' | OWWA ' + (r.owwaStatus || 'pending') + '\n');
});

console.log('═'.repeat(64));
console.log('✅ Data merge check complete\n');

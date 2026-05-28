#!/usr/bin/env node
const fs = require('fs');

console.log('\n📋 COMMISSION MODULE TEST & ENTRY ADDITION\n');

const file = 'staff_workstation.html';
const content = fs.readFileSync(file, 'utf8');

// Test 1: Check for `php` function
if(content.includes('const php = (n)')) {
  console.log('✓ Currency formatting function (php) — FOUND');
} else {
  console.log('✗ Currency formatting function (php) — MISSING');
}

// Test 2: Check for _comStatusBadge
if(content.includes('_comStatusBadge')) {
  console.log('✓ Commission status badge function — FOUND');
} else {
  console.log('✗ Commission status badge function — MISSING');
}

// Test 3: Check for computeCommission
if(content.includes('function computeCommission()')) {
  console.log('✓ Compute commission function — FOUND');
} else {
  console.log('✗ Compute commission function — MISSING');
}

// Test 4: Check for saveCommission
if(content.includes('function saveCommission()')) {
  console.log('✓ Save commission function — FOUND');
} else {
  console.log('✗ Save commission function — MISSING');
}

// Test 5: Check for form elements
const formIds = [
  'com-date', 'com-name', 'com-total', 'com-sss', 
  'com-pagibig', 'com-repat-dh', 'com-repat-skilled', 
  'com-status', 'com-note', 'com-edit-index'
];
const missingIds = formIds.filter(id => !content.includes(`id="${id}"`));
if(missingIds.length === 0) {
  console.log('✓ All form input elements — FOUND');
} else {
  console.log('✗ Missing form elements: ' + missingIds.join(', '));
}

// Test 6: Check commission summary display IDs
const summaryIds = [
  'cs-total', 'cs-sss', 'cs-pagibig', 
  'cs-repat-dh', 'cs-repat-skilled', 'cs-net'
];
const missingSumIds = summaryIds.filter(id => !content.includes(`id="${id}"`));
if(missingSumIds.length === 0) {
  console.log('✓ All summary display elements — FOUND');
} else {
  console.log('✗ Missing summary elements: ' + missingSumIds.join(', '));
}

console.log('\n' + '='.repeat(70));
console.log('📝 HOW TO ADD COMMISSION ENTRY:\n');
console.log('1. Open Staff Workstation:');
console.log('   http://localhost:3000/staff_workstation.html');
console.log('\n2. Click the Commission tab in the sidebar\n');
console.log('3. Fill in the form:');
console.log('   • Date: 05/01/2026');
console.log('   • Staff Name: CHA');
console.log('   • Total Commission: 10000');
console.log('   • SSS: 800');
console.log('   • Pag-IBIG: 0');
console.log('   • Repat Worker DH: 0');
console.log('   • Repat Skilled: 0');
console.log('   • Status: Pending Release');
console.log('   • Note: Optional remarks\n');
console.log('4. Watch the summary update to show NET ₱9,200.00\n');
console.log('5. Click "Save Commission" button\n');
console.log('✓ Entry will appear in the commission register below\n');
console.log('='.repeat(70) + '\n');

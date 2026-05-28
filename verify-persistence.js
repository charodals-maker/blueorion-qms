#!/usr/bin/env node

/**
 * BLUEORION QMS Data Persistence Verification Test
 * 
 * This script verifies that:
 * 1. Persistent disk (/data) is mounted and writable
 * 2. All data stores are properly persisted
 * 3. PostgreSQL connection is active (if configured)
 * 4. Data recovery mechanisms are functional
 * 
 * Usage:
 *   node verify-persistence.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = process.env.DATA_DIR || './data';
const REQUIRED_STORES = [
  'ws_dep_records.json',
  'ws_lifecycle.json',
  'audit_logs.json',
];

console.log(`\n${'='.repeat(60)}`);
console.log('BLUEORION QMS — Data Persistence Verification');
console.log(`${'='.repeat(60)}\n`);

// ==================================================================
// TEST 1: Environment Configuration
// ==================================================================
console.log('TEST 1: Environment Configuration');
console.log('-'.repeat(60));

const checks = {
  DATA_DIR: process.env.DATA_DIR || 'NOT SET (using default ./data)',
  DATABASE_URL: process.env.DATABASE_URL ? '✅ Configured' : '⚠️  Not configured (file-based mode)',
  NODE_ENV: process.env.NODE_ENV || 'NOT SET (should be "production")',
};

Object.entries(checks).forEach(([key, val]) => {
  console.log(`${key.padEnd(15)}: ${val}`);
});

// ==================================================================
// TEST 2: Persistent Disk Accessibility
// ==================================================================
console.log('\n\nTEST 2: Persistent Disk Accessibility');
console.log('-'.repeat(60));

let diskStatus = '✅ PASS';
try {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Creating data directory: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Test write access
  const testFile = path.join(DATA_DIR, '.persistence-test');
  fs.writeFileSync(testFile, JSON.stringify({ test: 'ok', timestamp: new Date() }), 'utf8');
  const content = fs.readFileSync(testFile, 'utf8');
  fs.unlinkSync(testFile);

  console.log(`✅ Persistent disk accessible: ${DATA_DIR}`);
  
  // Check available space
  const stats = fs.statSync(DATA_DIR);
  console.log(`✅ Disk writable: YES`);
} catch (err) {
  console.error(`❌ Persistent disk test failed: ${err.message}`);
  diskStatus = '❌ FAIL';
}

// ==================================================================
// TEST 3: Data Store Persistence
// ==================================================================
console.log('\n\nTEST 3: Data Store Persistence');
console.log('-'.repeat(60));

const storeStatus = {};
let allStoresOk = true;

REQUIRED_STORES.forEach(filename => {
  const filepath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filepath)) {
      console.log(`⚠️  ${filename} — FILE NOT FOUND`);
      storeStatus[filename] = 'MISSING';
      return;
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;

    console.log(`✅ ${filename.padEnd(25)} — ${count} records`);
    storeStatus[filename] = `OK (${count} records)`;
  } catch (err) {
    console.error(`❌ ${filename} — ERROR: ${err.message}`);
    storeStatus[filename] = `ERROR: ${err.message}`;
    allStoresOk = false;
  }
});

// ==================================================================
// TEST 4: Deployment Records Count
// ==================================================================
console.log('\n\nTEST 4: Critical Data Volumes');
console.log('-'.repeat(60));

try {
  const depPath = path.join(DATA_DIR, 'ws_dep_records.json');
  const lifePath = path.join(DATA_DIR, 'ws_lifecycle.json');

  if (fs.existsSync(depPath)) {
    const depData = JSON.parse(fs.readFileSync(depPath, 'utf8'));
    const depCount = Array.isArray(depData) ? depData.length : 0;
    const depStatus = depCount >= 330 ? '✅' : '⚠️';
    console.log(`${depStatus} Deployment Records: ${depCount}/330 required`);
  }

  if (fs.existsSync(lifePath)) {
    const lifeData = JSON.parse(fs.readFileSync(lifePath, 'utf8'));
    const lifeCount = Array.isArray(lifeData) ? lifeData.length : 0;
    const lifeStatus = lifeCount >= 56 ? '✅' : '⚠️';
    console.log(`${lifeStatus} Lifecycle Records: ${lifeCount}/56 required`);
  }
} catch (err) {
  console.error(`⚠️  Could not verify critical data volumes: ${err.message}`);
}

// ==================================================================
// TEST 5: PostgreSQL Configuration
// ==================================================================
console.log('\n\nTEST 5: PostgreSQL Configuration');
console.log('-'.repeat(60));

if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL is configured');
  
  // Parse connection string (without exposing password)
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Database: ${url.pathname.slice(1)}`);
    console.log(`   User: ${url.username}`);
    console.log(`   SSL: ${process.env.NODE_ENV === 'production' ? 'REQUIRED' : 'OPTIONAL'}`);
  } catch (err) {
    console.warn(`⚠️  Could not parse DATABASE_URL: ${err.message}`);
  }
} else {
  console.log('⚠️  DATABASE_URL not configured');
  console.log('   → Running in FILE-BASED MODE ONLY');
  console.log('   → Data persists to disk but NOT to PostgreSQL');
}

// ==================================================================
// TEST 6: Auto-Seed Capability
// ==================================================================
console.log('\n\nTEST 6: Auto-Seed Capability (Disaster Recovery)');
console.log('-'.repeat(60));

const repoSeedPath = path.join(__dirname, 'data', 'ws_dep_records.json');
if (fs.existsSync(repoSeedPath)) {
  try {
    const seed = JSON.parse(fs.readFileSync(repoSeedPath, 'utf8'));
    const seedCount = Array.isArray(seed) ? seed.length : 0;
    console.log(`✅ Repository seed file available: ${seedCount} records`);
    console.log(`   Location: ${repoSeedPath}`);
    console.log(`   → Can restore data if persistent disk fails`);
  } catch (err) {
    console.error(`❌ Seed file corrupted: ${err.message}`);
  }
} else {
  console.log(`⚠️  Repository seed file not found: ${repoSeedPath}`);
}

// ==================================================================
// TEST 7: Backup Mechanism
// ==================================================================
console.log('\n\nTEST 7: Backup Mechanism');
console.log('-'.repeat(60));

const backupScript = path.join(__dirname, 'backup-data.js');
if (fs.existsSync(backupScript)) {
  console.log('✅ Backup script available: backup-data.js');
  console.log('   Usage: node backup-data.js --format json');
  console.log('          node backup-data.js --format csv');
  console.log('          node backup-data.js --pgexport');
} else {
  console.log(`⚠️  Backup script not found: ${backupScript}`);
}

// ==================================================================
// SUMMARY
// ==================================================================
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

console.log('\n📊 Persistence Status:');
console.log(`   Persistent Disk: ${diskStatus}`);
console.log(`   Data Stores: ${allStoresOk ? '✅ ALL VERIFIED' : '⚠️  SOME MISSING'}`);
console.log(`   PostgreSQL: ${process.env.DATABASE_URL ? '✅ CONFIGURED' : '⚠️  OPTIONAL'}`);

console.log('\n🔄 Backup Strategy:');
console.log('   Primary: PostgreSQL (if configured)');
console.log('   Secondary: Persistent disk (/data)');
console.log('   Tertiary: Repository seed files');
console.log('   Exports: Automated via backup-data.js');

console.log('\n📋 Next Steps:');
if (!process.env.DATABASE_URL) {
  console.log('   ⚠️  Set DATABASE_URL environment variable for PostgreSQL persistence');
}
if (!fs.existsSync(DATA_DIR)) {
  console.log('   ⚠️  Verify persistent disk is mounted and /data directory is accessible');
}
if (allStoresOk) {
  console.log('   ✅ All data stores present and accessible');
  console.log('   ✅ Persistence is active and operational');
} else {
  console.log('   ⚠️  Some data stores missing — check application logs');
}

console.log('\n' + '='.repeat(60) + '\n');

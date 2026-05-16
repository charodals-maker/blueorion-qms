#!/usr/bin/env node

/**
 * Backup Script for BLUEORION QMS Data
 * 
 * Purpose: Export all persistent data stores to JSON/CSV for disaster recovery
 * Usage:
 *   node backup-data.js --format json
 *   node backup-data.js --format csv
 *   node backup-data.js --pgexport    # Export directly from PostgreSQL
 * 
 * Output: Creates timestamped backup files in ./exports/
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command-line arguments
const args = process.argv.slice(2);
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';
const pgExport = args.includes('--pgexport');

const BACKUP_DIR = path.join(__dirname, 'exports', 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log(`\n📦 BLUEORION QMS Data Backup Script`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Format: ${format}`);
console.log(`Output: ${BACKUP_DIR}`);
console.log(`Timestamp: ${TIMESTAMP}\n`);

/**
 * Load deployment records from local store
 */
function loadDeploymentRecords() {
  const filePath = path.join(__dirname, 'data', 'ws_dep_records.json');
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  No deployment records found at ${filePath}`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ Loaded ${Array.isArray(data) ? data.length : 0} deployment records`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`❌ Failed to load deployment records: ${err.message}`);
    return [];
  }
}

/**
 * Load lifecycle records from local store
 */
function loadLifecycleRecords() {
  const filePath = path.join(__dirname, 'data', 'ws_lifecycle.json');
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  No lifecycle records found at ${filePath}`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ Loaded ${Array.isArray(data) ? data.length : 0} lifecycle records`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`❌ Failed to load lifecycle records: ${err.message}`);
    return [];
  }
}

/**
 * Convert records to CSV format
 */
function toCSV(records, filename) {
  if (!records || records.length === 0) {
    return '';
  }

  // Get all unique keys from all records
  const keys = {};
  records.forEach(record => {
    Object.keys(record).forEach(k => {
      if (keys[k] === undefined) {
        keys[k] = true;
      }
    });
  });

  const headers = Object.keys(keys).sort();
  const csv = [headers.join(',')];

  records.forEach(record => {
    const row = headers.map(h => {
      const val = record[h];
      if (val === undefined || val === null) return '';
      const str = String(val);
      // Escape CSV special characters
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csv.push(row.join(','));
  });

  return csv.join('\n');
}

/**
 * Export deployment records
 */
function exportDeploymentRecords() {
  const records = loadDeploymentRecords();
  
  if (format === 'json') {
    const filename = `deployment_backup_${TIMESTAMP}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(records, null, 2), 'utf8');
    console.log(`💾 Exported to: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    return filename;
  } else if (format === 'csv') {
    const csv = toCSV(records, 'Deployment Records');
    const filename = `deployment_backup_${TIMESTAMP}.csv`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, csv, 'utf8');
    console.log(`💾 Exported to: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    console.log(`   Records: ${records.length}`);
    return filename;
  }
}

/**
 * Export lifecycle records
 */
function exportLifecycleRecords() {
  const records = loadLifecycleRecords();
  
  if (format === 'json') {
    const filename = `lifecycle_backup_${TIMESTAMP}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(records, null, 2), 'utf8');
    console.log(`💾 Exported to: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    return filename;
  } else if (format === 'csv') {
    const csv = toCSV(records, 'Lifecycle Records');
    const filename = `lifecycle_backup_${TIMESTAMP}.csv`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, csv, 'utf8');
    console.log(`💾 Exported to: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    console.log(`   Records: ${records.length}`);
    return filename;
  }
}

/**
 * Export PostgreSQL data (if available)
 */
async function exportPostgresData() {
  const { Pool } = require('pg');
  const connStr = process.env.DATABASE_URL;
  
  if (!connStr) {
    console.warn('⚠️  DATABASE_URL not set — PostgreSQL export not available');
    return;
  }

  try {
    const pool = new Pool({
      connectionString: connStr,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    console.log('\n🗄️  Exporting from PostgreSQL...');
    const client = await pool.connect();

    // Export kv_stores table
    const result = await client.query('SELECT key, value FROM kv_stores ORDER BY key');
    const backup = {};
    result.rows.forEach(row => {
      backup[row.key] = row.value;
    });

    const filename = `postgres_backup_${TIMESTAMP}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`✅ PostgreSQL data exported: ${filename}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    console.log(`   Stores: ${Object.keys(backup).length}`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error(`❌ PostgreSQL export failed: ${err.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('📥 Exporting deployment records...');
    exportDeploymentRecords();

    console.log('\n📥 Exporting lifecycle records...');
    exportLifecycleRecords();

    if (pgExport) {
      await exportPostgresData();
    }

    console.log(`\n✅ Backup complete!`);
    console.log(`📂 All files saved to: ${BACKUP_DIR}\n`);
  } catch (err) {
    console.error(`\n❌ Backup failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();

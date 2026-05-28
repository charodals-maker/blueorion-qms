#!/usr/bin/env node
/**
 * JSON to PostgreSQL Data Migration Script
 * Migrates BLUEORION QMS data from JSON files to PostgreSQL
 * Phase 2: Database Enhancement
 * 
 * Usage: node scripts/migrate-json-to-db.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const dataDir = path.join(__dirname, '../data');

/**
 * Load JSON file safely
 */
function loadJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️ Error loading ${path.basename(filePath)}:`, error.message);
    return [];
  }
}

/**
 * Migrate users
 */
async function migrateUsers() {
  console.log('\n👤 Migrating users...');
  try {
    // Users stored in memory or JSON - create default admin if needed
    #!/usr/bin/env node

    const { main } = require('./sync-postgres');

    main().catch(error => {
      console.error('[migrate-json-to-db] Failed:', error.message);
      process.exitCode = 1;
    });
    

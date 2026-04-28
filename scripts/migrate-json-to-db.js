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
    const result = await db.query(
      'SELECT COUNT(*) as count FROM users'
    );
    
    if (result.rows[0].count === 0) {
      const crypto = require('crypto');
      const passwordHash = crypto.createHash('sha256')
        .update('Admin@2026!')
        .digest('hex');
      
      await db.query(
        'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)',
        ['admin', passwordHash, 'admin@blueorion.local', 'admin']
      );
      console.log('✅ Created default admin user');
    } else {
      console.log(`✅ Found ${result.rows[0].count} existing users`);
    }
  } catch (error) {
    console.error('❌ User migration failed:', error.message);
    throw error;
  }
}

/**
 * Migrate worker profiles
 */
async function migrateWorkerProfiles() {
  console.log('\n👥 Migrating worker profiles...');
  try {
    const filePath = path.join(dataDir, 'applicant_forms.json');
    const workers = loadJsonFile(filePath);
    
    if (workers.length === 0) {
      console.log('⚠️ No worker data to migrate');
      return;
    }
    
    // Get admin user ID
    const adminResult = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const adminId = adminResult.rows[0]?.id || 1;
    
    for (const worker of workers) {
      try {
        await db.query(
          `INSERT INTO worker_profiles (
            passport_no, full_name, date_of_birth, gender, nationality,
            working_country, working_company, employment_status, salary,
            contact_number, email, address, skills, experience, education,
            compliance_status, created_at, created_by_id, last_edited_by_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (passport_no) DO NOTHING`,
          [
            worker.passportNo || worker.passport_no,
            worker.name || worker.fullName || worker.full_name,
            worker.dateOfBirth || worker.date_of_birth,
            worker.gender,
            worker.nationality,
            worker.workingCountry || worker.working_country,
            worker.workingCompany || worker.working_company,
            worker.employmentStatus || worker.employment_status || 'active',
            worker.salary || 0,
            worker.contactNumber || worker.contact_number,
            worker.email,
            worker.address,
            Array.isArray(worker.skills) ? worker.skills : [worker.skills || ''],
            worker.experience,
            worker.education,
            worker.complianceStatus || worker.compliance_status || 'pending',
            worker.createdAt || new Date().toISOString(),
            adminId,
            adminId
          ]
        );
      } catch (error) {
        console.warn(`⚠️ Error migrating worker ${worker.name}:`, error.message);
      }
    }
    
    const result = await db.query('SELECT COUNT(*) as count FROM worker_profiles');
    console.log(`✅ Migrated ${result.rows[0].count} worker profiles`);
  } catch (error) {
    console.error('❌ Worker migration failed:', error.message);
    throw error;
  }
}

/**
 * Migrate complaints
 */
async function migrateComplaints() {
  console.log('\n🚨 Migrating complaints...');
  try {
    const filePath = path.join(dataDir, 'welfare_complaints.json');
    const complaints = loadJsonFile(filePath);
    
    if (complaints.length === 0) {
      console.log('⚠️ No complaint data to migrate');
      return;
    }
    
    const adminResult = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const adminId = adminResult.rows[0]?.id || 1;
    
    for (const complaint of complaints) {
      try {
        // Find worker by passport
        const workerResult = await db.query(
          'SELECT id FROM worker_profiles WHERE passport_no = $1 LIMIT 1',
          [complaint.workerPassport || complaint.worker_passport]
        );
        
        if (workerResult.rows.length === 0) continue;
        
        await db.query(
          `INSERT INTO complaints (
            worker_id, complaint_type, severity, status, description,
            created_at, resolved_at, resolved_by_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workerResult.rows[0].id,
            complaint.type || complaint.complaint_type || 'general',
            complaint.severity || 'medium',
            complaint.status || 'pending',
            complaint.description || complaint.details || '',
            complaint.createdAt || new Date().toISOString(),
            complaint.resolvedAt || null,
            complaint.resolvedAt ? adminId : null
          ]
        );
      } catch (error) {
        console.warn(`⚠️ Error migrating complaint:`, error.message);
      }
    }
    
    const result = await db.query('SELECT COUNT(*) as count FROM complaints');
    console.log(`✅ Migrated ${result.rows[0].count} complaints`);
  } catch (error) {
    console.error('❌ Complaint migration failed:', error.message);
    throw error;
  }
}

/**
 * Migrate documents
 */
async function migrateDocuments() {
  console.log('\n📄 Migrating documents...');
  try {
    const filePath = path.join(dataDir, 'qms_docs.json');
    const documents = loadJsonFile(filePath);
    
    if (documents.length === 0) {
      console.log('⚠️ No document data to migrate');
      return;
    }
    
    const adminResult = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const adminId = adminResult.rows[0]?.id || 1;
    
    for (const doc of documents) {
      try {
        // Create buffer from content if available
        const content = Buffer.from(doc.content || '', 'utf8');
        
        await db.query(
          `INSERT INTO documents (
            name, category, version, description, content,
            file_size, mime_type, tags, uploaded_by_id, uploaded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (name) DO NOTHING`,
          [
            doc.name,
            doc.category || 'general',
            doc.version || 1,
            doc.description || '',
            content,
            content.length,
            doc.mimeType || 'application/octet-stream',
            doc.tags || [],
            adminId,
            doc.uploadedAt || new Date().toISOString()
          ]
        );
      } catch (error) {
        console.warn(`⚠️ Error migrating document ${doc.name}:`, error.message);
      }
    }
    
    const result = await db.query('SELECT COUNT(*) as count FROM documents');
    console.log(`✅ Migrated ${result.rows[0].count} documents`);
  } catch (error) {
    console.error('❌ Document migration failed:', error.message);
    throw error;
  }
}

/**
 * Migrate expenses
 */
async function migrateExpenses() {
  console.log('\n💰 Migrating expenses...');
  try {
    const filePath = path.join(dataDir, 'staff_work_submissions.json');
    const expenses = loadJsonFile(filePath);
    
    if (expenses.length === 0) {
      console.log('⚠️ No expense data to migrate');
      return;
    }
    
    const adminResult = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const adminId = adminResult.rows[0]?.id || 1;
    
    for (const expense of expenses) {
      try {
        await db.query(
          `INSERT INTO expenses (
            reference_number, category, description, amount, currency,
            status, submitted_by_id, approved_by_id, submitted_at, approved_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (reference_number) DO NOTHING`,
          [
            expense.referenceNo || expense.reference_number || `EXP-${Date.now()}`,
            expense.category || 'other',
            expense.description || '',
            expense.amount || 0,
            'USD',
            expense.status || 'pending',
            adminId,
            expense.status === 'approved' ? adminId : null,
            expense.submittedAt || new Date().toISOString(),
            expense.approvedAt || null
          ]
        );
      } catch (error) {
        console.warn(`⚠️ Error migrating expense:`, error.message);
      }
    }
    
    const result = await db.query('SELECT COUNT(*) as count FROM expenses');
    console.log(`✅ Migrated ${result.rows[0].count} expenses`);
  } catch (error) {
    console.error('❌ Expense migration failed:', error.message);
    throw error;
  }
}

/**
 * Run all migrations
 */
async function runMigrations() {
  console.log('🚀 Starting BLUEORION QMS Data Migration');
  console.log('='.repeat(50));
  
  try {
    // Verify database connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed. Check your .env configuration.');
    }
    console.log('✅ Database connection verified');
    
    // Run migrations in order
    await migrateUsers();
    await migrateWorkerProfiles();
    await migrateComplaints();
    await migrateDocuments();
    await migrateExpenses();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    const workerCount = await db.query('SELECT COUNT(*) as count FROM worker_profiles');
    const complaintCount = await db.query('SELECT COUNT(*) as count FROM complaints');
    const docCount = await db.query('SELECT COUNT(*) as count FROM documents');
    const expenseCount = await db.query('SELECT COUNT(*) as count FROM expenses');
    
    console.log(`  Users: ${userCount.rows[0].count}`);
    console.log(`  Workers: ${workerCount.rows[0].count}`);
    console.log(`  Complaints: ${complaintCount.rows[0].count}`);
    console.log(`  Documents: ${docCount.rows[0].count}`);
    console.log(`  Expenses: ${expenseCount.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check database is running: psql -U postgres');
    console.error('2. Verify .env file has correct DB credentials');
    console.error('3. Ensure database schema is initialized: node config/schema.js');
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };

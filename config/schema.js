/**
 * Database Schema and Migration Setup for BLUEORION QMS
 * PostgreSQL schema definition with indexes and constraints
 * Run this file to initialize the database
 */

const db = require('./database');

const SCHEMA = `
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Worker Profiles Table
CREATE TABLE IF NOT EXISTS worker_profiles (
  id SERIAL PRIMARY KEY,
  passport_no VARCHAR(50) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  nationality VARCHAR(100),
  working_country VARCHAR(100),
  working_company VARCHAR(255),
  employment_status VARCHAR(50),
  salary DECIMAL(12, 2),
  contact_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  skills TEXT[],
  experience TEXT,
  education VARCHAR(255),
  compliance_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id INT REFERENCES users(id),
  last_edited_by_id INT REFERENCES users(id)
);

-- Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  worker_id INT REFERENCES worker_profiles(id) ON DELETE CASCADE,
  complaint_type VARCHAR(100),
  severity VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  description TEXT NOT NULL,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by_id INT REFERENCES users(id)
);

-- Employers / FRA Table
CREATE TABLE IF NOT EXISTS employers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address TEXT,
  license_number VARCHAR(100),
  compliance_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Orders Table
CREATE TABLE IF NOT EXISTS job_orders (
  id SERIAL PRIMARY KEY,
  employer_id INT REFERENCES employers(id) ON DELETE CASCADE,
  position_title VARCHAR(255) NOT NULL,
  description TEXT,
  requirements TEXT,
  salary DECIMAL(12, 2),
  location VARCHAR(255),
  number_of_positions INT,
  status VARCHAR(50) DEFAULT 'open',
  approval_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Assignments
CREATE TABLE IF NOT EXISTS job_assignments (
  id SERIAL PRIMARY KEY,
  job_order_id INT REFERENCES job_orders(id) ON DELETE CASCADE,
  worker_id INT REFERENCES worker_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by_id INT REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  UNIQUE(job_order_id, worker_id)
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  version INT DEFAULT 1,
  description TEXT,
  content BYTEA NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  tags TEXT[],
  uploaded_by_id INT REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT false
);

-- Document Versions (for rollback)
CREATE TABLE IF NOT EXISTS document_versions (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id) ON DELETE CASCADE,
  version INT,
  content BYTEA NOT NULL,
  created_by_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_notes TEXT
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(100),
  record_id INT,
  action VARCHAR(50),
  user_id INT REFERENCES users(id),
  user_role VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_timestamp (created_at DESC)
);

-- Expenses / Vouchers Table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  reference_number VARCHAR(100) UNIQUE,
  category VARCHAR(100),
  description TEXT,
  amount DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending',
  submitted_by_id INT REFERENCES users(id),
  approved_by_id INT REFERENCES users(id),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  receipt_file_id INT REFERENCES documents(id)
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_workers_passport ON worker_profiles(passport_no);
CREATE INDEX IF NOT EXISTS idx_workers_country ON worker_profiles(working_country);
CREATE INDEX IF NOT EXISTS idx_workers_status ON worker_profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_complaints_worker ON complaints(worker_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded ON documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job ON job_assignments(job_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_submitted ON expenses(submitted_at DESC);

-- Composite Indexes for Common Queries
CREATE INDEX IF NOT EXISTS idx_complaints_worker_status ON complaints(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_job_orders_employer_status ON job_orders(employer_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_category_archived ON documents(category, is_archived);
`;

/**
 * Initialize database schema
 */
async function initializeSchema() {
  try {
    console.log('🔧 Initializing BLUEORION database schema...');
    
    // Split schema into individual statements
    const statements = SCHEMA.split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      await db.query(statement);
      console.log('✓', statement.substring(0, 50) + '...');
    }
    
    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Schema initialization failed:', error.message);
    throw error;
  }
}

/**
 * Seed initial data (optional)
 */
async function seedData() {
  try {
    console.log('📊 Seeding initial data...');
    
    // Create default admin user
    const adminExists = await db.query(
      'SELECT id FROM users WHERE username = $1',
      ['admin']
    );
    
    if (adminExists.rows.length === 0) {
      const crypto = require('crypto');
      const passwordHash = crypto.createHash('sha256')
        .update('Admin@2026!')
        .digest('hex');
      
      await db.query(
        'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)',
        ['admin', passwordHash, 'admin@blueorion.local', 'admin']
      );
      console.log('✓ Admin user created (username: admin, password: Admin@2026!)');
    }
    
    console.log('✅ Seeding completed');
  } catch (error) {
    console.error('⚠️  Seeding error:', error.message);
  }
}

/**
 * Run initialization (if called directly)
 */
if (require.main === module) {
  (async () => {
    try {
      await initializeSchema();
      await seedData();
      await db.closePool();
      process.exit(0);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  initializeSchema,
  seedData,
  SCHEMA
};

/**
 * db-schema.js — PostgreSQL Schema Initialization
 *
 * Creates relational tables for BORSC applicant lifecycle tracking,
 * admin access, and sourcing records:
 * 1. applicants (core vault)
 * 2. tesda_records (certifications)
 * 3. owwa_records (membership)
 * 4. medical_records (health clearance)
 * 5. visa_tracking (deployment visa/flights)
 * 6. documents (uploaded files registry)
 * 7. audit_logs (ISO 9001 traceability)
 * 8. admin_users (role-based account registry)
 * 9. sourcing_leads (candidate intake records)
 * 10. sourcing_scorecards (candidate scoring)
 * 11. sourcing_doc_auth (document authenticity checks)
 *
 * Features:
 * - Unique constraints (passport/mobile)
 * - Foreign key relationships
 * - Automatic timestamps (created_at, updated_at)
 * - Status lifecycle tracking
 * - Audit trail for all changes
 */

'use strict';

const { Pool } = require('pg');

class DbSchema {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Initialize all tables. Idempotent — safe to call multiple times.
   */
  async init() {
    if (!this.pool) {
      console.error('[db-schema] Pool not available');
      return false;
    }
    try {
      console.log('[db-schema] Initializing schema...');
      
      // 1. Core Applicant Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS applicants (
          id                SERIAL PRIMARY KEY,
          external_id       TEXT UNIQUE,
          passport_number   TEXT UNIQUE NOT NULL,
          mobile_number     TEXT UNIQUE NOT NULL,
          name              TEXT NOT NULL,
          age               INTEGER,
          address           TEXT,
          email             TEXT,
          source            TEXT DEFAULT 'portal',
          position          TEXT,
          country_interest  TEXT,
          status            TEXT DEFAULT 'new',
          notes             TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT,
          updated_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
        CREATE INDEX IF NOT EXISTS idx_applicants_source ON applicants(source);
      `);

      // 2. TESDA Records Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tesda_records (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          course_name       TEXT NOT NULL,
          ncii_number       TEXT UNIQUE NOT NULL,
          issuance_date     DATE,
          expiry_date       DATE,
          status            TEXT DEFAULT 'valid',
          uploaded_by       TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tesda_applicant ON tesda_records(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_tesda_expiry ON tesda_records(expiry_date);
      `);

      // 3. OWWA Records Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS owwa_records (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          membership_status TEXT DEFAULT 'pending',
          pdos_completed    BOOLEAN DEFAULT FALSE,
          pdos_date         DATE,
          certificate_url   TEXT,
          renewal_due_date  DATE,
          status            TEXT DEFAULT 'pending',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_owwa_applicant ON owwa_records(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_owwa_status ON owwa_records(membership_status);
      `);

      // 4. Medical Records Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS medical_records (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          clinic_name       TEXT,
          referral_date     DATE,
          exam_date         DATE,
          fit_status        TEXT DEFAULT 'pending',
          medical_notes     TEXT,
          follow_up_date    DATE,
          status            TEXT DEFAULT 'pending',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_medical_applicant ON medical_records(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_medical_status ON medical_records(fit_status);
        CREATE INDEX IF NOT EXISTS idx_medical_follow_up ON medical_records(follow_up_date);
      `);

      // 5. Visa/System Code Tracking Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS visa_tracking (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          visa_ref_number   TEXT UNIQUE,
          stamping_date     DATE,
          flight_schedule   TIMESTAMPTZ,
          flight_number     TEXT,
          airline           TEXT,
          seat_number       TEXT,
          departure_date    DATE,
          arrival_date      DATE,
          employer_name     TEXT,
          status            TEXT DEFAULT 'pending',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_visa_applicant ON visa_tracking(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_visa_status ON visa_tracking(status);
        CREATE INDEX IF NOT EXISTS idx_visa_departure ON visa_tracking(departure_date);
      `);

      // 6. Documents Registry Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          document_type     TEXT NOT NULL,
          file_url          TEXT NOT NULL,
          file_name         TEXT,
          file_size_bytes   BIGINT,
          mime_type         TEXT,
          verified          BOOLEAN DEFAULT FALSE,
          verified_by       TEXT,
          verified_at       TIMESTAMPTZ,
          expiry_date       DATE,
          status            TEXT DEFAULT 'pending',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_docs_applicant ON documents(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(document_type);
        CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(status);
      `);

      // 7b. Admin Users Table (role-based account registry)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id                SERIAL PRIMARY KEY,
          username          TEXT UNIQUE NOT NULL,
          email             TEXT UNIQUE,
          password_hash     TEXT NOT NULL,
          role              TEXT NOT NULL DEFAULT 'admin',
          permissions       JSONB NOT NULL DEFAULT '{}'::jsonb,
          last_login        TIMESTAMPTZ,
          is_active         BOOLEAN NOT NULL DEFAULT TRUE,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
        CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
      `);

      // 8. Sourcing Leads Table (candidate intake records)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sourcing_leads (
          id                TEXT PRIMARY KEY,
          candidate_name    TEXT,
          email             TEXT,
          contact_number    TEXT,
          job_interest      TEXT,
          positions         JSONB NOT NULL DEFAULT '[]'::jsonb,
          country           TEXT,
          source            TEXT DEFAULT 'sourcing',
          status            TEXT DEFAULT 'new',
          submitted_at      TIMESTAMPTZ,
          cv_file           TEXT,
          notes             TEXT,
          raw_record        JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT,
          updated_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sourcing_leads_status ON sourcing_leads(status);
        CREATE INDEX IF NOT EXISTS idx_sourcing_leads_source ON sourcing_leads(source);
        CREATE INDEX IF NOT EXISTS idx_sourcing_leads_submitted ON sourcing_leads(submitted_at DESC);
      `);

      // 9. Sourcing Scorecards Table (candidate scoring)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sourcing_scorecards (
          lead_id           TEXT PRIMARY KEY,
          tech              INTEGER,
          exp               INTEGER,
          soft              INTEGER,
          compliance        TEXT,
          total             INTEGER,
          raw_record        JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT,
          updated_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sourcing_scorecards_updated ON sourcing_scorecards(updated_at DESC);
      `);

      // 10. Sourcing Document Authentication Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sourcing_doc_auth (
          lead_id           TEXT PRIMARY KEY,
          passed            BOOLEAN NOT NULL DEFAULT FALSE,
          raw_record        JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by        TEXT,
          updated_by        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sourcing_doc_auth_passed ON sourcing_doc_auth(passed);
        CREATE INDEX IF NOT EXISTS idx_sourcing_doc_auth_updated ON sourcing_doc_auth(updated_at DESC);
      `);

      // 7. Audit Logs Table (ISO 9001 Traceability)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER REFERENCES applicants(id) ON DELETE SET NULL,
          table_name        TEXT NOT NULL,
          operation         TEXT NOT NULL,
          old_values        JSONB,
          new_values        JSONB,
          user_id           TEXT,
          ip_address        TEXT,
          user_agent        TEXT,
          status_before     TEXT,
          status_after      TEXT,
          reason             TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_applicant ON audit_logs(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
      `);

      // 8. System Status Table (for automated alerts)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS system_alerts (
          id                SERIAL PRIMARY KEY,
          applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          alert_type        TEXT NOT NULL,
          alert_title       TEXT NOT NULL,
          alert_message     TEXT,
          severity          TEXT DEFAULT 'warning',
          resolved          BOOLEAN DEFAULT FALSE,
          resolved_at       TIMESTAMPTZ,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_applicant ON system_alerts(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_type ON system_alerts(alert_type);
        CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON system_alerts(resolved);
      `);

      console.log('[db-schema] Schema initialization complete.');
      return true;
    } catch (err) {
      console.error('[db-schema] Error:', err.message);
      return false;
    }
  }

  /**
   * Log an action to audit_logs for ISO 9001 traceability.
   */
  async logAudit(applicantId, tableName, operation, oldValues, newValues, userId, metadata = {}) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO audit_logs 
         (applicant_id, table_name, operation, old_values, new_values, user_id, ip_address, user_agent, reason, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, NOW())`,
        [
          applicantId,
          tableName,
          operation,
          JSON.stringify(oldValues || {}),
          JSON.stringify(newValues || {}),
          userId,
          metadata.ipAddress || 'unknown',
          metadata.userAgent || 'unknown',
          metadata.reason || '',
        ]
      );
    } catch (err) {
      console.error('[db-schema] logAudit error:', err.message);
    }
  }

  /**
   * Create an automated alert when a condition is met.
   */
  async createAlert(applicantId, alertType, alertTitle, alertMessage, severity = 'warning') {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO system_alerts (applicant_id, alert_type, alert_title, alert_message, severity, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [applicantId, alertType, alertTitle, alertMessage, severity]
      );
      console.log(`[db-schema] Alert created: ${alertType} for applicant ${applicantId}`);
    } catch (err) {
      console.error('[db-schema] createAlert error:', err.message);
    }
  }

  /**
   * Resolve an alert.
   */
  async resolveAlert(alertId) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `UPDATE system_alerts SET resolved = TRUE, resolved_at = NOW() WHERE id = $1`,
        [alertId]
      );
    } catch (err) {
      console.error('[db-schema] resolveAlert error:', err.message);
    }
  }

  /**
   * Check and trigger automated alerts based on business rules.
   */
  async checkAndTriggerAlerts() {
    if (!this.pool) return;
    try {
      // Rule 1: Medical pending for > 3 days
      await this.pool.query(`
        INSERT INTO system_alerts (applicant_id, alert_type, alert_title, alert_message, severity)
        SELECT 
          a.id,
          'MEDICAL_OVERDUE',
          'Medical Clearance Overdue',
          'Medical examination has been pending for more than 3 days.',
          'warning'
        FROM applicants a
        JOIN medical_records m ON a.id = m.applicant_id
        WHERE m.fit_status = 'pending' 
          AND m.created_at < NOW() - INTERVAL '3 days'
          AND NOT EXISTS (
            SELECT 1 FROM system_alerts sa 
            WHERE sa.applicant_id = a.id 
              AND sa.alert_type = 'MEDICAL_OVERDUE' 
              AND sa.resolved = FALSE
          )
        ON CONFLICT DO NOTHING;
      `);

      // Rule 2: TESDA expiry within 6 months
      await this.pool.query(`
        INSERT INTO system_alerts (applicant_id, alert_type, alert_title, alert_message, severity)
        SELECT 
          a.id,
          'TESDA_EXPIRING_SOON',
          'TESDA Certificate Expiring Soon',
          'NCII certificate will expire within 6 months.',
          'warning'
        FROM applicants a
        JOIN tesda_records t ON a.id = t.applicant_id
        WHERE t.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '6 months'
          AND t.status = 'valid'
          AND NOT EXISTS (
            SELECT 1 FROM system_alerts sa 
            WHERE sa.applicant_id = a.id 
              AND sa.alert_type = 'TESDA_EXPIRING_SOON' 
              AND sa.resolved = FALSE
          )
        ON CONFLICT DO NOTHING;
      `);

      // Rule 3: Document gap detection
      await this.pool.query(`
        INSERT INTO system_alerts (applicant_id, alert_type, alert_title, alert_message, severity)
        SELECT 
          a.id,
          'DOCUMENT_GAP',
          'Missing Required Document',
          'Applicant is in "Selected" status but missing OWWA record.',
          'error'
        FROM applicants a
        WHERE a.status = 'selected'
          AND NOT EXISTS (
            SELECT 1 FROM owwa_records o WHERE o.applicant_id = a.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM system_alerts sa 
            WHERE sa.applicant_id = a.id 
              AND sa.alert_type = 'DOCUMENT_GAP' 
              AND sa.resolved = FALSE
          )
        ON CONFLICT DO NOTHING;
      `);

      console.log('[db-schema] Automated alerts checked and triggered.');
    } catch (err) {
      console.error('[db-schema] checkAndTriggerAlerts error:', err.message);
    }
  }
}

module.exports = DbSchema;

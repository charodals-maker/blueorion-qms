-- =============================================================================
-- BLUEORION QMS — PostgreSQL Schema Init Script
-- Mirrors modules/db-schema.js exactly.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Run this manually on Render if auto-init via db-schema.js ever fails.
-- =============================================================================

-- 0. KV Store (JSON flat-file mirror used by pg-store.js)
CREATE TABLE IF NOT EXISTS kv_stores (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1. Core Applicants
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

-- 2. TESDA Records
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

-- 3. OWWA Records
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

-- 4. Medical Records
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

-- 5. Visa / Flight Tracking
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

-- 6. Uploaded Documents Registry
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

-- 7. Admin Users (role-based account registry)
-- Populated at startup from the hardcoded users array in server-enhanced.js.
-- Passwords are stored as SHA-256 hex hashes.
CREATE TABLE IF NOT EXISTS admin_users (
  id                SERIAL PRIMARY KEY,
  username          TEXT UNIQUE NOT NULL,
  email             TEXT UNIQUE,          -- NULL allowed; multiple NULLs are fine in Postgres UNIQUE
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

-- 8. Sourcing Leads (candidate intake, synced from sourcing_leads.json)
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

-- 9. Sourcing Scorecards (synced from sourcing_scorecards.json)
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

-- 10. Sourcing Document Authentication (synced from sourcing_doc_auth.json)
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

-- 11. Audit Logs (ISO 9001 traceability)
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
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_applicant ON audit_logs(applicant_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- 12. System Alerts (automated expiry / overdue warnings)
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

-- =============================================================================
-- Verification query — run after applying to confirm all tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
-- Expected: admin_users, applicants, audit_logs, documents, kv_stores,
--           medical_records, owwa_records, sourcing_doc_auth, sourcing_leads,
--           sourcing_scorecards, system_alerts, tesda_records, visa_tracking
-- =============================================================================

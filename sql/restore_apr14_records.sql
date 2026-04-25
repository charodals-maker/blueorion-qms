-- Blueorion QMS Recovery Script
-- Restore active module state and re-link live dashboard records from archive
-- Target recovery window: 2026-04-14 onward

BEGIN;

-- Ensure required tables exist for digital module status and live dashboard linkage.
CREATE TABLE IF NOT EXISTS qms_modules (
    module_id INT PRIMARY KEY,
    module_name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_dashboard (
    voucher_id BIGINT PRIMARY KEY,
    lead_id BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_table (
    id BIGINT PRIMARY KEY,
    lead_id BIGINT,
    date DATE NOT NULL
);

-- Equivalent of SQL_SAFE_UPDATES = 0 in MySQL environments.
-- PostgreSQL does not enforce safe updates by default.

UPDATE qms_modules
SET status = 'ACTIVE', updated_at = NOW()
WHERE module_id BETWEEN 1 AND 12;

-- PostgreSQL-compatible equivalent of:
-- REPLACE INTO live_dashboard (voucher_id, lead_id)
-- SELECT id, lead_id FROM archive_table WHERE date >= '2026-04-14';
INSERT INTO live_dashboard (voucher_id, lead_id, updated_at)
SELECT id, lead_id, NOW()
FROM archive_table
WHERE date >= DATE '2026-04-14'
ON CONFLICT (voucher_id)
DO UPDATE SET
    lead_id = EXCLUDED.lead_id,
    updated_at = NOW();

COMMIT;

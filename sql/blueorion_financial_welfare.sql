-- =============================================================
-- BLUEORION RECRUITMENT SERVICES CORP.
-- Financial, Welfare & Marketing SQL Schema
-- ISO 9001:2015 | DMW Compliant | Port 3000 QMS
-- Generated: April 2026
-- =============================================================

BEGIN;

-- -----------------------------------------------------------
-- TABLE 1: WELFARE & COMPLAINT CASES (System #15)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS welfare_cases (
    case_id       SERIAL PRIMARY KEY,
    case_ref      VARCHAR(20) UNIQUE,                    -- e.g. W-2026-001
    applicant_name VARCHAR(255) NOT NULL,
    home_address  TEXT,
    mobile_number VARCHAR(20),
    fra_partner   VARCHAR(100),                          -- e.g. Can Alriyadh, E Manpower
    country       VARCHAR(50),
    reason_of_complaint TEXT NOT NULL,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    action_taken  TEXT,
    logged_by     VARCHAR(100),
    status        VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','UNDER INVESTIGATION','RESOLVED')),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welfare_fra ON welfare_cases(fra_partner);
CREATE INDEX IF NOT EXISTS idx_welfare_status ON welfare_cases(status);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_welfare_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS welfare_updated ON welfare_cases;
CREATE TRIGGER welfare_updated
    BEFORE UPDATE ON welfare_cases
    FOR EACH ROW EXECUTE FUNCTION update_welfare_timestamp();

-- -----------------------------------------------------------
-- TABLE 2: OFFICE DISBURSEMENTS / EXPENSE VOUCHERS (System #9)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS blueorion_expenses (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(50) NOT NULL
                    CHECK (category IN (
                        'Medical','Deployment','TESDA','Transportation',
                        'Bills','Biometric','Marketing','Cash Advance','Staff Commission'
                    )),
    date_incurred   DATE NOT NULL DEFAULT CURRENT_DATE,
    payee_name      VARCHAR(255),
    particulars     TEXT,
    reference_no    VARCHAR(100),                        -- Voucher No or Receipt No
    agent_id        VARCHAR(20),                         -- e.g. AGENT-01 through AGENT-10
    amount_php      DECIMAL(10,2) NOT NULL CHECK (amount_php >= 0),
    approved_by     VARCHAR(100) DEFAULT 'Charo D. Alaasdi',
    payment_status  VARCHAR(20) DEFAULT 'PAID'
                    CHECK (payment_status IN ('PAID','PENDING','CANCELLED')),
    period          VARCHAR(7),                          -- YYYY-MM e.g. 2026-04
    month_locked    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_category ON blueorion_expenses(category);
CREATE INDEX IF NOT EXISTS idx_expense_period   ON blueorion_expenses(period);
CREATE INDEX IF NOT EXISTS idx_expense_agent    ON blueorion_expenses(agent_id);

-- Audit trail for expenses
CREATE TABLE IF NOT EXISTS blueorion_expenses_audit (
    audit_id    SERIAL PRIMARY KEY,
    expense_id  INT REFERENCES blueorion_expenses(id),
    action_type VARCHAR(10) NOT NULL,
    changed_by  VARCHAR(100),
    changed_at  TIMESTAMP DEFAULT NOW(),
    old_data    JSONB,
    new_data    JSONB
);

CREATE OR REPLACE FUNCTION log_expense_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO blueorion_expenses_audit(expense_id, action_type, changed_by, old_data)
        VALUES (OLD.id, 'DELETE', current_user, to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO blueorion_expenses_audit(expense_id, action_type, changed_by, old_data, new_data)
        VALUES (NEW.id, 'UPDATE', current_user, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO blueorion_expenses_audit(expense_id, action_type, changed_by, new_data)
        VALUES (NEW.id, 'INSERT', current_user, to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expense_audit_trigger ON blueorion_expenses;
CREATE TRIGGER expense_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON blueorion_expenses
    FOR EACH ROW EXECUTE FUNCTION log_expense_audit();

-- -----------------------------------------------------------
-- TABLE 3: PETTY CASH LOG (System #9)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS petty_cash_log (
    id          SERIAL PRIMARY KEY,
    description VARCHAR(255),
    amount_php  DECIMAL(10,2) NOT NULL,
    entry_type  VARCHAR(10) DEFAULT 'DEBIT' CHECK (entry_type IN ('CREDIT','DEBIT')),
    reference_no VARCHAR(100),
    period      VARCHAR(7),
    month_locked BOOLEAN DEFAULT FALSE,
    logged_by   VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- TABLE 4: MARKETING AGENTS (System #2)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_agents (
    id              SERIAL PRIMARY KEY,
    agent_id        VARCHAR(20) UNIQUE NOT NULL,         -- AGENT-01 to AGENT-10
    name            VARCHAR(255) NOT NULL,
    mobile          VARCHAR(20),
    location        VARCHAR(100),
    active_status   BOOLEAN DEFAULT TRUE,
    total_leads     INT DEFAULT 0,
    converted_leads INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- TABLE 5: INTERESTED APPLICANTS POOL (System #2)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS interested_applicants (
    id              SERIAL PRIMARY KEY,
    date_inquiry    DATE DEFAULT CURRENT_DATE,
    full_name       VARCHAR(255) NOT NULL,
    mobile_number   VARCHAR(20),
    location        VARCHAR(100),
    position_applied VARCHAR(50) DEFAULT 'HSW'
                    CHECK (position_applied IN ('HSW','Skilled','Cleaner','Others')),
    source          VARCHAR(50)
                    CHECK (source IN ('Marketing Agent','Social Media','FB Ad','Referral','Walk-in','Others')),
    agent_id        VARCHAR(20) REFERENCES marketing_agents(agent_id),
    is_qualified    BOOLEAN DEFAULT NULL,
    remarks         TEXT,
    follow_up_date  DATE,
    status          VARCHAR(20) DEFAULT 'NEW'
                    CHECK (status IN ('NEW','FOLLOW-UP','CONVERTED','ARCHIVED')),
    converted_to_id INT,                                 -- FK to applicants table when converted
    logged_by       VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interested_status  ON interested_applicants(status);
CREATE INDEX IF NOT EXISTS idx_interested_agent   ON interested_applicants(agent_id);

-- -----------------------------------------------------------
-- TABLE 6: MONTH CLOSE / LOCK (President Authority)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS month_locks (
    id          SERIAL PRIMARY KEY,
    period      VARCHAR(7) UNIQUE NOT NULL,
    locked_at   TIMESTAMP DEFAULT NOW(),
    locked_by   VARCHAR(100),
    total_expenses DECIMAL(12,2)
);

-- -----------------------------------------------------------
-- SUMMARY VIEWS
-- -----------------------------------------------------------

-- Monthly expense totals per category
CREATE OR REPLACE VIEW vw_expense_summary AS
SELECT
    period,
    category,
    SUM(amount_php) AS total_php,
    COUNT(*) AS entry_count
FROM blueorion_expenses
WHERE payment_status != 'CANCELLED'
GROUP BY period, category
ORDER BY period DESC, category;

-- Expense grand total per period with sub-totals
CREATE OR REPLACE VIEW vw_expense_grand_total AS
SELECT
    period,
    SUM(CASE WHEN category IN ('Medical','Biometric','TESDA','Deployment') THEN amount_php ELSE 0 END) AS direct_costs,
    SUM(CASE WHEN category IN ('Bills','Transportation') THEN amount_php ELSE 0 END) AS operating_costs,
    SUM(CASE WHEN category IN ('Marketing','Staff Commission','Cash Advance') THEN amount_php ELSE 0 END) AS incentives,
    SUM(amount_php) AS grand_total
FROM blueorion_expenses
WHERE payment_status != 'CANCELLED'
GROUP BY period
ORDER BY period DESC;

-- Marketing agent leaderboard
CREATE OR REPLACE VIEW vw_agent_leaderboard AS
SELECT
    a.agent_id,
    a.name,
    a.location,
    a.total_leads,
    a.converted_leads,
    CASE WHEN a.total_leads > 0
         THEN ROUND((a.converted_leads::DECIMAL / a.total_leads) * 100, 1)
         ELSE 0 END AS conversion_rate_pct
FROM marketing_agents a
WHERE a.active_status = TRUE
ORDER BY a.converted_leads DESC, a.total_leads DESC;

-- Welfare complaints per FRA partner
CREATE OR REPLACE VIEW vw_welfare_by_fra AS
SELECT
    fra_partner,
    COUNT(*) AS total_cases,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_cases,
    SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_cases
FROM welfare_cases
GROUP BY fra_partner
ORDER BY total_cases DESC;

-- Pipeline overview
CREATE OR REPLACE VIEW vw_pipeline_overview AS
SELECT
    (SELECT COUNT(*) FROM interested_applicants WHERE status NOT IN ('CONVERTED','ARCHIVED')) AS interested_leads,
    (SELECT COUNT(*) FROM interested_applicants WHERE status = 'CONVERTED') AS converted_leads,
    (SELECT COUNT(*) FROM welfare_cases WHERE status = 'OPEN') AS open_complaints;

-- -----------------------------------------------------------
-- CLEAN-START RESET (run only when directed by President)
-- -----------------------------------------------------------
-- TRUNCATE TABLE blueorion_expenses RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE petty_cash_log RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE interested_applicants RESTART IDENTITY CASCADE;
-- DELETE FROM month_locks;
-- Note: welfare_cases should NOT be truncated — keep for ISO traceability.

COMMIT;

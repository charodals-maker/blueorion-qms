-- Blueorion QMS - Recruitment Tracking Schema (PostgreSQL)
-- ISO 9001:2015 focus: controlled changes, traceability, and auditability.

BEGIN;

CREATE TABLE IF NOT EXISTS recruitment_tracking (
	id BIGSERIAL PRIMARY KEY,
	tracking_code VARCHAR(32) NOT NULL UNIQUE,
	candidate_name VARCHAR(150) NOT NULL,
	contact_email VARCHAR(150),
	contact_phone VARCHAR(40),
	source_channel VARCHAR(80) NOT NULL DEFAULT 'walk-in',
	position_applied VARCHAR(120) NOT NULL,
	destination_country VARCHAR(80) NOT NULL,
	applicant_type VARCHAR(40) NOT NULL DEFAULT 'First Timer',
	stage VARCHAR(40) NOT NULL DEFAULT 'screening',
	status VARCHAR(30) NOT NULL DEFAULT 'Applicant',
	compliance_status VARCHAR(30) NOT NULL DEFAULT 'pending',
	screening_score NUMERIC(5,2),
	medical_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
	training_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
	passport_number VARCHAR(40),
	passport_expiry_date DATE,
	date_applied DATE NOT NULL DEFAULT CURRENT_DATE,
	date_selected DATE,
	date_deployed DATE,
	assigned_recruiter VARCHAR(120),
	remarks TEXT,
	created_by VARCHAR(120) NOT NULL,
	updated_by VARCHAR(120),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ck_recruitment_stage CHECK (
		stage IN (
			'screening',
			'initial_interview',
			'final_interview',
			'medical',
			'training',
			'documentation',
			'for_deployment',
			'deployed',
			'closed'
		)
	),
	CONSTRAINT ck_recruitment_status CHECK (
		status IN ('Applicant', 'Selected', 'Deployed', 'Ex-ABW', 'Rejected', 'Withdrawn')
	),
	CONSTRAINT ck_compliance_status CHECK (
		compliance_status IN ('pending', 'in_review', 'compliant', 'non_compliant')
	),
	CONSTRAINT ck_medical_status CHECK (
		medical_status IN ('not_started', 'in_progress', 'fit', 'unfit')
	),
	CONSTRAINT ck_training_status CHECK (
		training_status IN ('not_started', 'enrolled', 'completed', 'failed')
	),
	CONSTRAINT ck_score_range CHECK (
		screening_score IS NULL OR (screening_score >= 0 AND screening_score <= 100)
	)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_tracking_status
	ON recruitment_tracking(status);

CREATE INDEX IF NOT EXISTS idx_recruitment_tracking_stage
	ON recruitment_tracking(stage);

CREATE INDEX IF NOT EXISTS idx_recruitment_tracking_country
	ON recruitment_tracking(destination_country);

CREATE INDEX IF NOT EXISTS idx_recruitment_tracking_applied
	ON recruitment_tracking(date_applied DESC);

CREATE INDEX IF NOT EXISTS idx_recruitment_tracking_recruiter
	ON recruitment_tracking(assigned_recruiter);

CREATE TABLE IF NOT EXISTS recruitment_tracking_audit (
	audit_id BIGSERIAL PRIMARY KEY,
	record_id BIGINT NOT NULL,
	action_type VARCHAR(16) NOT NULL,
	old_data JSONB,
	new_data JSONB,
	changed_by VARCHAR(120),
	changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT fk_recruitment_tracking
		FOREIGN KEY (record_id)
		REFERENCES recruitment_tracking(id)
		ON DELETE CASCADE,
	CONSTRAINT ck_action_type CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_recruitment_audit_record
	ON recruitment_tracking_audit(record_id, changed_at DESC);

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at := NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recruitment_set_updated_at ON recruitment_tracking;
CREATE TRIGGER trg_recruitment_set_updated_at
BEFORE UPDATE ON recruitment_tracking
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE FUNCTION fn_recruitment_tracking_audit()
RETURNS TRIGGER AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO recruitment_tracking_audit (record_id, action_type, old_data, new_data, changed_by)
		VALUES (NEW.id, 'INSERT', NULL, to_jsonb(NEW), NEW.updated_by);
		RETURN NEW;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO recruitment_tracking_audit (record_id, action_type, old_data, new_data, changed_by)
		VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by);
		RETURN NEW;
	ELSIF TG_OP = 'DELETE' THEN
		INSERT INTO recruitment_tracking_audit (record_id, action_type, old_data, new_data, changed_by)
		VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL, OLD.updated_by);
		RETURN OLD;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recruitment_tracking_audit ON recruitment_tracking;
CREATE TRIGGER trg_recruitment_tracking_audit
AFTER INSERT OR UPDATE OR DELETE ON recruitment_tracking
FOR EACH ROW
EXECUTE FUNCTION fn_recruitment_tracking_audit();

CREATE OR REPLACE VIEW vw_recruitment_pipeline_summary AS
SELECT
	destination_country,
	stage,
	status,
	COUNT(*) AS total_candidates
FROM recruitment_tracking
GROUP BY destination_country, stage, status;

COMMIT;

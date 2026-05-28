# SQLTools Setup - Recruitment Tracking (PostgreSQL)

This guide sets up the Recruitment Tracking table directly from VS Code using SQLTools.

## 1) Install extensions in VS Code

Install:
- SQLTools
- SQLTools PostgreSQL/Redshift Driver

## 2) Create a PostgreSQL database

Create a database, for example:
- Database name: `blueorion_qms`

## 3) Configure SQLTools connection

In SQLTools, create a new connection with:
- Driver: PostgreSQL
- Server/Host: localhost
- Port: 5432
- Database: blueorion_qms
- Username: your_postgres_user
- Password: your_postgres_password

## 4) Run schema script

Open [sql/recruitment_tracking_postgres.sql](../sql/recruitment_tracking_postgres.sql), then click:
- `SQLTools: Run Query`

The script creates:
- `recruitment_tracking` table
- `recruitment_tracking_audit` table
- update timestamp trigger
- audit trigger for INSERT/UPDATE/DELETE
- `vw_recruitment_pipeline_summary` view

## 5) Quick verification queries

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('recruitment_tracking', 'recruitment_tracking_audit');
```

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recruitment_tracking'
ORDER BY ordinal_position;
```

```sql
SELECT * FROM vw_recruitment_pipeline_summary;
```

## 6) Test audit trail

```sql
INSERT INTO recruitment_tracking (
  tracking_code,
  candidate_name,
  contact_email,
  source_channel,
  position_applied,
  destination_country,
  created_by,
  updated_by
) VALUES (
  'BOR-REC-2026-0001',
  'Juan Dela Cruz',
  'juan@example.com',
  'facebook',
  'Domestic Helper',
  'Saudi Arabia',
  'recruitment.lead',
  'recruitment.lead'
);
```

```sql
UPDATE recruitment_tracking
SET stage = 'medical', updated_by = 'encoder'
WHERE tracking_code = 'BOR-REC-2026-0001';
```

```sql
SELECT action_type, changed_by, changed_at
FROM recruitment_tracking_audit
WHERE record_id = (
  SELECT id FROM recruitment_tracking WHERE tracking_code = 'BOR-REC-2026-0001'
)
ORDER BY changed_at DESC;
```

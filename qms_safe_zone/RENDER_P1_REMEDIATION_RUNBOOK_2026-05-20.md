# Blueorion QMS - P1 Render Remediation Runbook
Date: 2026-05-20
Severity: P1
Scope: Production persistence + CORS lockout

## Situation Summary
Current runtime logs indicate two production-critical misconfigurations:
1. PostgreSQL is not connected (service is running in local JSON-file mode).
2. CORS_ORIGINS is missing in production, forcing deny-all behavior.

Impact:
- Data-loss risk on restart (ephemeral filesystem).
- Frontend-to-backend calls may be blocked in production.

## Immediate Remediation (Render Dashboard)

1. Provision PostgreSQL
- Render Dashboard -> New -> PostgreSQL
- Name: blueorion-db
- Plan: starter (or free for temporary testing)
- DB Name: blueorion_qms
- User: blueorion_admin

2. Attach Environment Variables to backend service
- Open service: blueorion-qms-server
- Add env var:
  - Key: DATABASE_URL
  - Value source: blueorion-db connection string
- Add env var:
  - Key: CORS_ORIGINS
  - Value: https://your-frontend-domain.com,http://localhost:5173
- Ensure env var:
  - Key: NODE_ENV
  - Value: production

3. Redeploy service
- Trigger manual deploy after saving env vars.
- Wait for boot completion.

## Required Startup Log Outcomes (Pass Criteria)

1. Must NOT appear:
- "DATABASE_URL/POSTGRES_URL not set"
- "PostgreSQL not connected — running in file-based mode"
- "CORS_ORIGINS env not set. Defaulting to deny-all"

2. Must appear:
- PostgreSQL connected startup confirmation
- Health endpoint returns HTTP 200
- CORS allows your production frontend origin

## Validation Checklist (10 minutes)

1. Health check
- GET /api/health
- Expect: status 200 and postgres.connected = true

2. CORS check
- Send request with Origin header set to production frontend domain
- Expect: Access-Control-Allow-Origin echoes that domain

3. Persistence check
- Create one test record in production
- Restart/redeploy service
- Confirm test record still exists

4. Backup path check
- Verify backup path is Linux/persistent runtime path for Render workloads (for example under /var/data/...)
- Avoid machine-local Windows absolute paths.

## Blueprint Example (render.yaml)

```yaml
services:
  - type: web
    name: blueorion-qms-server
    env: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGINS
        value: https://your-frontend-domain.com,http://localhost:5173
      - key: DATABASE_URL
        fromDatabase:
          name: blueorion-db
          property: connectionString

databases:
  - name: blueorion-db
    plan: starter
    databaseName: blueorion_qms
    user: blueorion_admin
```

## Application Code Guardrail

Use runtime-relative paths and avoid hardcoded machine-specific paths.

```js
const path = require('path');
const backupDir = path.join(__dirname, 'data', 'backups');
```

If running on Render with persistent disk, map backup directory to mounted persistent path.

## Leadership Closeout Targets (Today)

1. Engineering Owner
- DB env attached and service redeployed.
- Evidence: startup log excerpt + /api/health output.

2. QA Owner
- CORS validation from production frontend origin completed.
- Evidence: header capture showing allowed origin.

3. QMR/Document Controller
- Evidence archived in qms_safe_zone with timestamp.
- Incident checklist fields signed.

## Blockers to Escalate Immediately

1. No access to backend Render service environment variables.
2. No authority to provision PostgreSQL resource.
3. Unknown production frontend domain for CORS whitelist.

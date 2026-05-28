# CRITICAL PRODUCTION FIX NOW (Render)
Date: 2026-05-19
System: Blueorion QMS Backend
Priority: P1 - Data persistence and CORS hardening

## Current Risk Snapshot
- Live health endpoint currently returning HTTP 503.
- If backend runs without proper DB env vars, file-based mode can lose records on restart.
- Immediate action required in Render dashboard.

## Exact Environment Variables to Set
Backend service: Blueorion QMS Web Service -> Environment

1) DATABASE_URL
- Key: DATABASE_URL
- Value source: Internal Database URL from Render PostgreSQL instance (same region as backend)
- Do not use localhost and do not use external URL if backend is on Render.

2) CORS_ORIGINS
- Key: CORS_ORIGINS
- Value:
  https://blueorion-qms-frontend.onrender.com,https://blueorion-qms-backend.onrender.com
- No wildcard (*) in production.

## Fast Execution Steps (Operator)
1. Open Render -> Backend service -> Environment.
2. Set DATABASE_URL from PostgreSQL Internal Database URL.
3. Set CORS_ORIGINS exactly as listed above.
4. Save changes.
5. Trigger Manual Deploy using Clear build cache and deploy.
6. Open backend Logs and wait for full startup.

## Required Log Evidence (Must See)
- PostgreSQL connected line appears.
- No file-based mode warning appears.
- CORS initialized with allowed origins appears.
- Server running line appears.

## Go/No-Go Validation
- Health endpoint: https://blueorion-qms-backend.onrender.com/api/health returns HTTP 200.
- Login works with document controller account.
- Create one test update and refresh page to confirm persistence.
- No CORS errors in browser console.

## Incident Record
Operator: ____________________
Start time: ____________________
DATABASE_URL set time: ____________________
CORS_ORIGINS set time: ____________________
Deploy start: ____________________
Deploy end: ____________________
Health HTTP 200 confirmed: Yes / No
Persistence smoke test pass: Yes / No
Final status: Contained / Ongoing

## Escalation If Still Failing
- Re-check DB region match (backend and PostgreSQL must match).
- Re-copy Internal Database URL (watch for truncation or hidden character).
- Confirm env vars are on backend service (not frontend service).
- Roll back to last healthy deploy, then re-apply vars and redeploy.

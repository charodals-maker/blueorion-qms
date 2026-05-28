# Blueorion QMS - Render Operator Quick Mode

Date: 2026-05-18
Purpose: Fast, low-error execution for PostgreSQL + CORS go-live fix.

## 60-Second Precheck
- Confirm you are editing the correct Backend service.
- Confirm Frontend live URL is reachable.
- Confirm backend and database region are the same.

## Quick Steps (Minimum Click Path)

### 1) Copy Frontend URL
1. Render Dashboard -> Frontend service.
2. Copy live URL shown under service name.
   - Example: https://blueorion-frontend.onrender.com

### 2) Set CORS on Backend
1. Open QMS Backend service -> Environment.
2. Add variable:
   - Key: CORS_ORIGINS
   - Value: <frontend live URL>
3. If needed, add multiple origins separated by commas.
   - Example: http://localhost:5173,https://blueorion-frontend.onrender.com
4. Click Save changes -> Save, rebuild, and deploy.

### 3) Create PostgreSQL
1. Render Dashboard -> New + -> PostgreSQL.
2. Name: blueorion-qms-db (or approved name).
3. Region: exactly same as backend.
4. Click Create Database.

### 4) Set DATABASE_URL on Backend
1. Open created database -> Connections.
2. Copy Internal Database URL.
3. Open QMS Backend service -> Environment.
4. Add variable:
   - Key: DATABASE_URL
   - Value: <internal database URL>
5. Click Save changes -> Save, rebuild, and deploy.

## Pass/Fail Log Check
Pass when all lines are present in backend logs:
- Confirmed live environment. Initializing services...
- Connected successfully to PostgreSQL database.
- BLUEORION QMS Server running on port 3000
- CORS initialized with allowed origins: <frontend URL>

Fail conditions:
- Any database connection error appears.
- Any CORS rejection appears.
- Backend boots without reporting allowed origins.

## Functional Smoke Test (2 Minutes)
1. Open frontend live URL.
2. Login.
3. Create or update one record.
4. Refresh page.
5. Confirm record still exists.
6. Confirm no browser CORS errors.

## Security Guardrails (Must Pass)
- No wildcard CORS (*).
- Only approved origins in CORS_ORIGINS.
- Use Internal Database URL for Render-hosted backend.
- Do not expose environment secrets in screenshots or shared logs.

## Quick Evidence Capture
- Frontend URL used: ____________________
- CORS_ORIGINS set time: ____________________
- DATABASE_URL set time: ____________________
- Deploy complete time: ____________________
- Log check pass: Yes / No
- Smoke test pass: Yes / No
- Operator initials: ____________________

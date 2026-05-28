# Blueorion QMS - Render Link, Verify, and Secure Checklist

Date: 2026-05-18
Owner: ____________________
Environment: Production / Staging / Local

## Objective
- Fix frontend lockout by setting exact allowed origins.
- Fix data loss by connecting backend to managed PostgreSQL.
- Verify live logs and security posture before sign-off.

## Part 1 - Connect and Verify Frontend URL (CORS)
1. Open Render Dashboard.
2. Open the Frontend service (Web Service or Static Site).
3. Copy the live frontend URL shown under the service name.
   - Example: https://blueorion-frontend.onrender.com
4. Open QMS Backend Server service.
5. Go to Environment.
6. Add environment variable:
   - Key: CORS_ORIGINS
   - Value: <frontend URL copied from Render>
7. If multiple origins are required, use comma-separated values.
   - Example: http://localhost:5173,https://blueorion-frontend.onrender.com
8. Select Save changes and Save, rebuild, and deploy.

Evidence to capture:
- Frontend URL captured: ____________________
- CORS_ORIGINS value set: ____________________
- Includes production URL: Yes / No
- Includes local URL (if needed): Yes / No
- Rebuild and deploy completed: Yes / No

## Part 2 - Connect and Verify PostgreSQL (Database)
1. Open Render Dashboard.
2. Select New +, then PostgreSQL.
3. Create database:
   - Name: blueorion-qms-db (or approved name)
   - Region: exact same region as backend service
4. After provisioning, open Connections on the database page.
5. Copy Internal Database URL for Render-to-Render traffic.
6. Open QMS Backend Server service, then Environment.
7. Add environment variable:
   - Key: DATABASE_URL
   - Value: <internal database URL>
8. Select Save changes and Save, rebuild, and deploy.

Evidence to capture:
- Database name: ____________________
- Region matched backend: Yes / No
- DATABASE_URL set: Yes / No
- Internal URL used (not external): Yes / No
- Rebuild and deploy completed: Yes / No
- Deploy ID or timestamp: ____________________

## Part 3 - Verify Live Logs
Expected success indicators:
- Confirmed live environment. Initializing services...
- Connected successfully to PostgreSQL database.
- BLUEORION QMS Server running on port 3000
- CORS initialized with allowed origins: <frontend URL list>

Evidence to capture:
- PostgreSQL connection success log seen: Yes / No
- CORS allowed origins log seen: Yes / No
- Previous warnings/errors removed: Yes / No
- Log timestamp: ____________________

## Part 4 - Functional Verification
1. Open frontend live URL.
2. Login and complete one workflow action.
3. Create or update at least one record.
4. Refresh and confirm record persists.
5. Check browser console and network tab for CORS/API failures.

Evidence to capture:
- Login successful: Yes / No
- Data persisted after refresh: Yes / No
- API requests from frontend successful: Yes / No
- CORS console errors absent: Yes / No

## Part 5 - Security Checks
- CORS_ORIGINS does not use wildcard (*).
- Only approved origins are listed.
- DATABASE_URL is present only in backend service env vars.
- Internal Database URL is used for Render-hosted backend.
- Environment variable values are not exposed in logs/screenshots.

## Rollback and Safety
- Record previous environment keys before change.
- If deploy fails, restore previous environment values and redeploy.
- Log incident timeline, owner, and remediation actions.

## Final Sign-off
- Engineering sign-off: ____________________
- QA sign-off: ____________________
- Security check sign-off: ____________________
- Ready for inspection statement: ____________________

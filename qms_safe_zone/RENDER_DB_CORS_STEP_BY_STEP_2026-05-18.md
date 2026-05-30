# Blueorion QMS - Render Step-by-Step (DB + CORS)

Date: 2026-05-18
Owner: ____________________
System: Blueorion QMS Backend + Frontend on Render

## Step 1: Provision Database and Copy Connection String
1. In Render Dashboard, click New + and select PostgreSQL.
2. Set Name to blueorion-qms-db.
3. Ensure Region exactly matches the backend server region.
4. Click Create Database.
5. Wait about 1-2 minutes until status changes from Creating to Available.
6. Open Connections section and copy Internal Database URL.

Runbook note:
- Use Internal Database URL because backend is on Render.
- If stored in shared notes, mask password portion before saving.
- This value is used for DATABASE_URL.

Evidence:
- Database created: Yes / No
- Region match confirmed: Yes / No
- Internal URL copied: Yes / No
- Timestamp: ____________________

## Step 2: Gather Frontend URL
1. Return to Render Dashboard.
2. Open Frontend Service (Static Site or Web Service).
3. Copy the live URL shown under the project name.
   - Example: https://blueorion-qms-frontend.onrender.com

Runbook note:
- This value is used for CORS_ORIGINS.

Evidence:
- Frontend URL copied: ____________________
- Timestamp: ____________________

## Step 3: Inject Environment Variables into Backend
1. Open QMS Backend Server in Render.
2. Open Environment tab.
3. Add variable:
   - Key: DATABASE_URL
   - Value: <Internal Database URL from Step 1>
4. Add variable:
   - Key: CORS_ORIGINS
   - Value: <Frontend URL from Step 2>
5. Click Save Changes.

Evidence:
- DATABASE_URL set: Yes / No
- CORS_ORIGINS set: Yes / No
- Save Changes clicked: Yes / No
- Deployment triggered: Yes / No

## Step 4: Verification and Live Log Check
1. Open backend Logs tab after deployment starts.
2. Watch startup sequence and confirm success indicators.

What to look for:
- PostgreSQL active line:
  - Example: [pg-store] Connected to PostgreSQL
  - Or equivalent success line showing file-based mode warning is gone.
- CORS configured line:
  - Example: CORS initialized with allowed origins...

Verification status:
- PostgreSQL success line present: Yes / No
- File-based mode warning absent: Yes / No
- CORS allowed-origins line present: Yes / No
- Any startup errors remaining: Yes / No

## Security and Reliability Checks
- Confirm CORS_ORIGINS is exact frontend URL (no wildcard *).
- Confirm DATABASE_URL is internal Render connection string.
- Do not share raw DATABASE_URL with visible password in screenshots.
- If deploy fails, revert to previous env values and redeploy.

## Final Sign-off
- Engineering: ____________________
- QA: ____________________
- Verified at: ____________________

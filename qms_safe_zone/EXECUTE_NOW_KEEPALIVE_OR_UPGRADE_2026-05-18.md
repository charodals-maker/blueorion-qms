# Execute-Now Decision Sheet (Keep-Alive or Upgrade)

Date: 2026-05-18
System: Blueorion QMS on Render
Critical deadline: Free PostgreSQL expires on 2026-06-17

## Locked Recommendation (Current)
- Backend: stay on Free tier and use keep-alive monitor every 14 minutes.
- Database: upgrade to Starter tier to remove deletion risk.

## Live Execution Status (Current Session)
- Database page confirmed on Render: `blueorion-qms-db`.
- Expiration warning confirmed: 2026-06-17.
- Upgrade prerequisite reached: Stripe `Add Card` modal is open.
- Remaining action to complete DB upgrade:
   1. Enter billing card details in Render modal.
   2. Submit `Add Card`.
   3. Return to `Instance Type` and select `Starter`.
   4. Save changes.

## Decision Target (Today)
Choose one operational path now:
- Path A: Keep backend responsive at no cost with external keep-alive pings.
- Path B: Upgrade Render tiers for native always-on reliability and permanent DB retention.

## Path A - No-Cost Keep-Alive (Backend)
Goal:
- Prevent Free backend sleep mode during active hours.

Steps:
1. Go to https://uptimerobot.com and sign in/create free account.
2. Click Add New Monitor.
3. Set:
   - Monitor Type: HTTPS
   - Friendly Name: Blueorion Backend Keep-Alive
   - URL (or IP): https://blueorion-qms-backend.onrender.com/api/health
   - Monitoring Interval: Every 14 minutes
4. Click Create Monitor.

Success criteria:
- Monitor status is Up.
- Backend first-response delay after idle periods is minimized.

Notes:
- This does not remove database expiration risk.
- This only reduces backend spin-down impact.

## Path B - Render Paid Upgrade (Recommended Before June)
Goal:
- Remove free-tier DB deletion risk and improve backend responsiveness natively.

### B1) Upgrade Database (mandatory before 2026-06-17)
1. Open Render Dashboard.
2. Select database: blueorion-qms-db.
3. Open Settings.
4. Find Instance Type and choose Change Instance Type.
5. Select Starter (or higher) and Save.

Expected outcome:
- Free-tier expiration rule is removed.
- Managed persistence posture is improved.

### B2) Upgrade Backend (optional but recommended)
1. Open Render Dashboard.
2. Select web service: blueorion-qms-backend.
3. Open Settings.
4. Find Instance Type and choose Change Instance Type.
5. Select Starter (or higher) and Save.

Expected outcome:
- Native always-on backend behavior without keep-alive dependency.

## Safety Timeline
- By 2026-06-01: Final decision complete (A temporary or B permanent).
- By 2026-06-10: If choosing B, complete DB upgrade to leave buffer.
- Hard stop 2026-06-17: Free DB expiration date.

## Immediate Next Action
- If minimizing cost now: execute Path A today, then schedule Path B decision before 2026-06-01.
- If prioritizing production safety: execute Path B now for DB first, backend second.

## Operator Note
- Card details are sensitive and must be typed directly by the account owner in the Render billing modal.

## ✅ UPGRADE COMPLETED - 2026-05-18 @ 04:23 UTC

**Database Status:**
- Instance: Basic-256mb (paid tier)
- Status: Available
- Expiration risk: ELIMINATED (June 17 warning removed)
- PostgreSQL version: 18
- Region: Oregon (US West)
- Storage: 1 GB (6.68% used)

**Backend API Status:**
- Health endpoint: https://blueorion-qms-backend.onrender.com/api/health
- Response: 200 OK (health: Operational)
- PostgreSQL connected: true
- Sync status: Connected and syncing
- Last sync: 2026-05-18T04:17:52Z (success)

**System Readiness:**
- QMS database: Fully operational on paid tier
- Data persistence: Permanent (no expiration)
- Automatic backups: Enabled on Basic tier
- Cost: $6.30/month (database + storage)

**Next Actions (Optional):**
1. Consider Path A (keep-alive monitor) for backend if further cost optimization is desired.
2. Ensure regular database backups are verified monthly.
3. Monitor billing dashboard for any unexpected charges.

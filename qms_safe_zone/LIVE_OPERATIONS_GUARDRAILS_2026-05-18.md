# Blueorion QMS Live Operations Guardrails

Date: 2026-05-18
Environment: Render Production

## 1) Spin-Down Risk (Backend Free Tier)
Current state:
- Backend service `blueorion-qms-backend` is on Free tier.
- Render warning is present: free instances spin down after inactivity.

Operational impact:
- After ~15 minutes idle, first request can take ~30-60 seconds during wake-up.

Mitigation options:
- Option A (recommended for business hours reliability): Upgrade backend to Starter tier.
- Option B (no immediate paid upgrade): Keep-alive monitor hitting:
  - https://blueorion-qms-backend.onrender.com/api/health
  - Interval target: every 14 minutes

Verification completed:
- Health endpoint returns `success: true` and `postgres.connected: true`.

## 2) Free PostgreSQL Expiration Risk
Current state:
- Database `blueorion-qms-db` is on Free tier.
- Render shows expiration date: 2026-06-17.

Operational impact:
- Free database is deleted on expiry if not upgraded.

Prevention:
- Upgrade DB instance to paid tier before expiry (suggest latest by 2026-06-10 for safety window).

## 3) Frontend Build Variable Rule (Vite/React)
Current state:
- Frontend service `blueorion-qms-frontend` environment variable key is:
  - `VITE_API_URL` (correct for Vite)

Rule:
- Vite requires `VITE_` prefix.
- Create React App requires `REACT_APP_` prefix.

If frontend cannot call backend:
- Reconfirm framework type and env key naming convention.
- Rebuild frontend after any env variable change.

## Action Checklist
- [ ] Decide backend uptime strategy: Starter tier or keep-alive monitor.
- [ ] If keep-alive selected, configure monitor on `/api/health` every 14 minutes.
- [ ] Upgrade PostgreSQL to paid tier before 2026-06-17.
- [ ] Re-run endpoint smoke test after any plan or env update.

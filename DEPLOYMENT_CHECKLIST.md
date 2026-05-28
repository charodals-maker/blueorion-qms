# QMS Postgres Persistence — Developer Deployment Checklist
**Quick ref for immediate deployment verification**

---

## Pre-Deployment (Local Testing)

- [ ] Run `npm install` (ensure `pg` package is in node_modules)
- [ ] Check `modules/pg-store.js` exists and exports a singleton class
- [ ] Search `server-enhanced.js` for `const pgStore = require('./modules/pg-store')` (line ~19)
- [ ] Search for `async function init()` (line ~7939)
- [ ] Search for `await pgStore.connect()` in the init function
- [ ] Verify `saveStore()` has the `pgStore.save()` call with `.catch()` error handler

---

## Post-Deploy on Render (Immediate)

1. **Push to GitHub**
   ```bash
   git add modules/pg-store.js server-enhanced.js render.yaml
   git commit -m "Add Postgres persistence"
   git push origin main
   ```

2. **Wait for Render auto-deploy** (watch dashboard, 2–5 min)

3. **Check Render Dashboard**
   - [ ] Web service shows **"Live"** (green dot)
   - [ ] Databases section shows `blueorion-qms-db` with **"Available"** status
   - [ ] Environment tab shows `DATABASE_URL` present (gray text: `from blueorion-qms-db`)

---

## Verify in Logs (Most Important)

1. Click **Logs** in Render Dashboard
2. Click **blue Restart** button (top right) to force a fresh startup and see init logs
3. **Search for these three messages** (scroll down, they appear in order):

```
[pg-store] Connected to PostgreSQL — data will persist across restarts.
[startup] Seeding in-memory stores from PostgreSQL…
[startup] Store seeding complete — data loaded from PostgreSQL.
```

| Find | Status | Action |
|---|---|---|
| ✅ All three messages | **PASS** | Postgres is connected and working |
| ❌ See `DATABASE_URL not set` | **FAIL** | Check Environment tab in Render; DATABASE_URL missing |
| ❌ See `Connection failed` | **FAIL** | Render database not created; refresh database tab |
| ❌ See `saveStore error` | **WARN** | Local file cache issue, but Postgres may be OK—check full logs |

---

## Functional Smoke Test (5 min)

1. Go to `https://your-render-url/sourcing-dashboard`
2. Log in as admin (if prompted)
3. Add **5 new dummy applicants** with various job types/countries
4. Open browser DevTools → Network tab → refresh
5. Confirm no errors on `/api/sourcing-leads` call
6. **Go to Render Dashboard → Logs** and search for `async save error` → should find **ZERO** errors

---

## The Hard Test (Persistence Proof)

1. **Add 3 applicants** with clear names like "TEST-001", "TEST-002", "TEST-003"
2. **Click blue Restart** button in Render Dashboard (forces a full restart)
3. **Wait 30 seconds** for service to come back online
4. **Go back to `/sourcing-dashboard`**
5. **Verify all 3 TEST applicants are still there**

✅ **Still there?** Postgres persistence is working.  
❌ **Gone?** Check logs for `[pg-store]` connection errors.

---

## Rollback (If Something Breaks)

If the deployment causes issues:

```bash
git log --oneline | head -5
# Find the commit before Postgres changes
git revert <commit-hash>
# OR
git reset --hard HEAD~1
git push origin main
```

Render will auto-redeploy the old version (no data loss — local JSON files still exist as fallback).

---

## Success Indicators

- [ ] Logs show all three `[pg-store]` messages
- [ ] No `DATABASE_URL not set` warning
- [ ] `/sourcing-dashboard` loads normally
- [ ] Data persists after manual restart
- [ ] No `[pg-store] error` messages (async save errors are logged but non-blocking)

**You're done when:** Developers can safely add applicants and know data won't disappear overnight.

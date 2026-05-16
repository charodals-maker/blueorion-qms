# FOR YOUR DEVELOPER: IMMEDIATE ACTION ITEMS
**Prepared**: May 15, 2026  
**Time to Deploy**: 20 minutes  
**Complexity**: Medium (mostly configuration, code already written)

---

## 🎯 Mission
Stop applicant data from disappearing every 24 hours. Implement permanent storage using PostgreSQL (for data) + Persistent Disk (for files).

---

## ✅ What's Already Done

| Item | Status | What to Do |
|---|---|---|
| **PostgreSQL Code** | ✅ Written in `modules/pg-store.js` | Just deploy |
| **Server Integration** | ✅ Modified in `server-enhanced.js` | Just deploy |
| **render.yaml Config** | ✅ Updated with DB + Disk | Just deploy |
| **Documentation** | ✅ Created for your reference | Read if stuck |

**You do NOT need to write any code.** Just push and deploy.

---

## 🚀 3-Step Deployment

### STEP 1: Push Code (2 minutes)
```bash
cd /path/to/qms-blueorion
git add .
git commit -m "Add PostgreSQL + Persistent Disk for permanent data storage"
git push origin main
```

### STEP 2: Verify Render Dashboard (3 minutes)
1. Go to **dashboard.render.com**
2. Click your **blueorion-qms** project
3. Check **Databases** tab → `blueorion-qms-db` should appear (status: Available)
4. Check **Settings** → **Disks** → `qms-storage` should appear (status: Mounted)
5. Check **Environment** → `DATABASE_URL` should appear (gray: "from blueorion-qms-db")

### STEP 3: Monitor Logs (5 minutes)
1. Click **Logs** tab
2. Click **blue Restart** button (top right) to trigger startup
3. **Look for EXACTLY these 4 messages** (in this order):
   ```
   [pg-store] Connected to PostgreSQL — data will persist across restarts.
   [startup] Seeding in-memory stores from PostgreSQL…
   [startup] Store seeding complete — data loaded from PostgreSQL.
   ```

✅ **If you see all 3** → SUCCESS. Deployment is complete.  
❌ **If you see error** → Go to Troubleshooting section below.

---

## 🧪 Proof It Works (5 minutes)

1. Go to `https://your-render-url/sourcing-dashboard`
2. Add **5 test applicants** (dummy data is fine)
3. Go back to Render Dashboard → **Logs**
4. Click **Restart** button again
5. Go back to `/sourcing-dashboard`
6. **Are all 5 test applicants still there?**
   - ✅ YES → Permanent storage is working
   - ❌ NO → Check logs for `[pg-store]` error messages

---

## ⚠️ Troubleshooting

| Error | Fix |
|---|---|
| `DATABASE_URL not set` in logs | Check Environment tab — is DATABASE_URL listed? If not, click "Refresh" on Databases tab, then Restart web service again. |
| `Connection refused` / `ECONNREFUSED` | Database is initializing. Wait 2 minutes, then Restart web service again. |
| Data still disappears after restart | (1) Check logs for `[pg-store] error`; (2) Verify DATABASE_URL is correctly set; (3) Manual query the Postgres DB to confirm data was actually saved |
| Disk mount fails | Ensure `/opt/render/project/src/data` folder exists in your project. If not, create it and re-deploy. |

---

## 📋 Quick Reference: What Each File Does

- **`modules/pg-store.js`** — New file. Database adapter. Handles all Postgres reads/writes.
- **`server-enhanced.js`** — Modified. Now calls `pgStore.save()` on every `saveStore()`. Also seeds stores from Postgres on startup.
- **`render.yaml`** — Modified. Now provisions a Postgres database + Persistent Disk automatically.

---

## 💡 Pro Tips

1. **First deploy takes longer** (5–10 min) because Render is creating the database. Subsequent restarts are faster.
2. **Logs update in real-time** — you can watch the startup sequence happen.
3. **Non-blocking writes** — Postgres saves happen in the background. Users see zero latency.
4. **Fallback mode** — if Postgres fails to connect, the system still works with local JSON files (not ideal, but it doesn't crash).
5. **Free tier expires** — Render free Postgres expires after 90 days. For production, upgrade to **Starter Plan ($7/mo)**.

---

## 📞 Questions?

- **"Do I need to change the server code?"** No. Everything is already integrated.
- **"Do I need to change any routes?"** No. Everything is transparent.
- **"Will this affect existing data?"** No. Existing JSON data is read on startup and mirrored to Postgres.
- **"What if something breaks?"** You can quickly rollback: `git reset --hard HEAD~1 && git push origin main`

---

## ✨ Timeline

| Time | Action |
|---|---|
| Now | Push code |
| +5 min | Render auto-deploys, databases/disks provisioned |
| +10 min | Check logs for success messages |
| +15 min | Run verification test |
| +20 min | **COMPLETE** — Data is now permanent |

**Total time: 20 minutes from push to permanent storage.**

---

## 🏁 Success Criteria

✅ Logs show all 3 `[pg-store]` messages  
✅ No `DATABASE_URL not set` errors  
✅ Test applicants persist after manual restart  
✅ No `async save error` messages in logs  

**When you see all of these → Your deployment is successful.**

Need help? Check **BOTH_OPTIONS_DEPLOYMENT_GUIDE.md** in the project root for detailed troubleshooting.

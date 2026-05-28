# PROOF OF PERSISTENCE TEST — BORSC QMS Database Validation
**Purpose**: Verify that applicant data survives Render server restarts  
**Time**: 15 minutes  
**Who**: Your developer

---

## 📋 Test Scenario

This test encodes a "Test Applicant" through the 4 pillars (TESDA → OWWA → Medical → Visa), then **restarts the Render server** to prove all data persists.

---

## 🚀 PRE-TEST CHECKLIST

- [ ] PostgreSQL database provisioned in Render (check Databases tab)
- [ ] Persistent Disk mounted to `/opt/render/project/src/data`
- [ ] `DATABASE_URL` environment variable visible in Render Dashboard
- [ ] Server logs show: `[pg-store] Connected to PostgreSQL`
- [ ] Server logs show: `[db-schema] Schema initialization complete`
- [ ] Lifecycle endpoints available (routes show: `applicant-lifecycle`)

---

## 📝 STEP 1: Create Test Applicant

**Via API (Recommended for testing)**:

```bash
# Add a test applicant via direct database insert (for local testing)
# OR use the web form and create manually

curl -X POST http://localhost:3000/api/applicant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "passportNumber": "TEST-PERSIST-001-PASSPORT",
    "mobileNumber": "+63-TEST-001",
    "name": "TEST APPLICANT 001",
    "age": 35,
    "address": "Test Address, PH",
    "email": "test@blueorion.com",
    "source": "qa-test",
    "position": "Welder",
    "countryInterest": "Saudi Arabia"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "externalId": "APP-TEST-001",
    "passportNumber": "TEST-PERSIST-001-PASSPORT",
    ...
  }
}
```

**Note the `id` value** (e.g., `id: 1`) — you'll use this in next steps.

---

## 📑 STEP 2: Add TESDA Record

```bash
APPLICANT_ID=1  # From step 1

curl -X POST http://localhost:3000/api/applicant/$APPLICANT_ID/tesda \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "courseName": "Welder NC III",
    "nciiNumber": "TESDA-WLD-2024-12345",
    "issuanceDate": "2024-01-15",
    "expiryDate": "2026-01-15"
  }'
```

**Expected**: `"status": "valid"`

---

## 📋 STEP 3: Add OWWA Record

```bash
APPLICANT_ID=1

curl -X POST http://localhost:3000/api/applicant/$APPLICANT_ID/owwa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "membershipStatus": "active",
    "pdosCompleted": true,
    "pdosDate": "2024-02-10"
  }'
```

**Expected**: `"status": "active"`

---

## 🏥 STEP 4: Add Medical Record

```bash
APPLICANT_ID=1

curl -X POST http://localhost:3000/api/applicant/$APPLICANT_ID/medical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "clinicName": "Blueorion Medical Center",
    "referralDate": "2024-02-15",
    "examDate": "2024-02-17",
    "fitStatus": "cleared",
    "medicalNotes": "All tests passed. Fit for deployment."
  }'
```

**Expected**: `"fit_status": "cleared"`

---

## ✈️ STEP 5: Add Visa/Deployment Record

```bash
APPLICANT_ID=1

curl -X POST http://localhost:3000/api/applicant/$APPLICANT_ID/visa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "visaRefNumber": "VISA-TEST-2024-001",
    "stampingDate": "2024-02-20",
    "flightNumber": "SV-123",
    "airline": "Saudia Airlines",
    "departureDate": "2024-03-01",
    "arrivalDate": "2024-03-02",
    "employerName": "Test Employer LLC"
  }'
```

**Expected**: `"status": "scheduled"`

---

## 🔍 STEP 6: Retrieve Full Profile

Verify all 4 pillars are saved:

```bash
APPLICANT_ID=1

curl http://localhost:3000/api/applicant/$APPLICANT_ID/full-profile
```

**Expected Response** (should contain all data):
```json
{
  "success": true,
  "data": {
    "applicant": { "id": 1, "name": "TEST APPLICANT 001", ... },
    "tesda": [{ "courseName": "Welder NC III", "nciiNumber": "TESDA-WLD-2024-12345", ... }],
    "owwa": { "membershipStatus": "active", ... },
    "medical": { "fitStatus": "cleared", ... },
    "visa": { "flightNumber": "SV-123", ... },
    "documents": [],
    "activeAlerts": []
  }
}
```

✅ **If you see all 4 pillars, data is in the database.**

---

## 🔄 STEP 7: THE HARD TEST — Server Restart

**This is the proof of persistence:**

1. **Go to Render Dashboard** → Click your `blueorion-qms` service
2. **Click blue "Restart" button** (top right)
3. **Wait 30–40 seconds** for the service to fully restart
4. **Monitor logs** — you should see:
   ```
   [pg-store] Connected to PostgreSQL — data will persist across restarts.
   [startup] Seeding in-memory stores from PostgreSQL…
   [startup] Store seeding complete — data loaded from PostgreSQL.
   ```

---

## ✅ STEP 8: Verify Data Persisted

After restart, run the same query in a **new browser tab** or terminal:

```bash
APPLICANT_ID=1

curl http://localhost:3000/api/applicant/$APPLICANT_ID/full-profile
```

### Check These Points:

| Item | Expected | Result |
|---|---|---|
| **Applicant found** | `"id": 1, "name": "TEST APPLICANT 001"` | ✅ / ❌ |
| **TESDA record** | `"courseName": "Welder NC III"` | ✅ / ❌ |
| **OWWA record** | `"membershipStatus": "active"` | ✅ / ❌ |
| **Medical record** | `"fitStatus": "cleared"` | ✅ / ❌ |
| **Visa record** | `"flightNumber": "SV-123"` | ✅ / ❌ |

**If ALL 5 items show ✅:** **PERSISTENCE TEST PASSED** ✅✅✅

---

## 📊 AUDIT TRAIL VERIFICATION

Verify that ISO 9001 audit logging is working:

```bash
APPLICANT_ID=1

curl http://localhost:3000/api/applicant/$APPLICANT_ID/audit-trail \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected**: A list of all operations (INSERT for each record added) with timestamps and user info.

Example:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "applicant_id": 1,
      "table_name": "visa_tracking",
      "operation": "INSERT",
      "user_id": "admin",
      "created_at": "2024-02-20T10:30:00Z"
    },
    {
      "id": 2,
      "applicant_id": 1,
      "table_name": "medical_records",
      "operation": "INSERT",
      "user_id": "admin",
      "created_at": "2024-02-17T09:15:00Z"
    }
    ...
  ]
}
```

✅ **Audit trail present = ISO 9001 traceability working**

---

## 🚨 ALERTS VERIFICATION

Check if automated alerts are working:

```bash
APPLICANT_ID=1

curl http://localhost:3000/api/applicant/$APPLICANT_ID/alerts
```

**Expected**: Empty or minimal alerts (unless your test data triggers alert conditions).

**Note**: Alerts trigger automatically when:
- Medical status is "pending" for > 3 days
- TESDA certificate expires within 6 months
- Applicant is "selected" but missing OWWA record

---

## ✨ SUCCESS CRITERIA

### ✅ Persistence Test PASSED if:

1. ✅ All 4 pillars data appears after server restart
2. ✅ Audit trail shows all operations with timestamps
3. ✅ No `[pg-store]` error messages in logs
4. ✅ Logs show `[db-schema] Automated alerts checked`
5. ✅ Full profile returns all data consistently

### ❌ Persistence Test FAILED if:

1. ❌ Data disappears after restart
2. ❌ Logs show `DATABASE_URL not set`
3. ❌ Logs show `Connection refused` for Postgres
4. ❌ Applicant cannot be retrieved after restart
5. ❌ Any `[pg-store] error` messages

---

## 🔧 TROUBLESHOOTING

| Problem | Fix |
|---|---|
| 404: Applicant not found after restart | Check logs for DB connection errors; manually query Postgres to confirm data exists |
| Endpoint returns 401 | Ensure `Authorization` header has valid staff token |
| Curl command fails | Make sure server is running on correct port (default: 3000) |
| Data missing but no errors | Check if data was actually inserted before restart (run Step 6 query before restart) |

---

## 📝 DOCUMENTATION

After passing this test, document:

1. **Date tested**: [Date]
2. **Applicant ID**: [ID from Step 1]
3. **Server restart count**: [How many times restarted]
4. **Database**: Postgres (Render managed)
5. **Persistent Disk**: `/opt/render/project/src/data` (10GB)
6. **Result**: ✅ **PASSED — Data persists across restarts**

---

## 🎯 Final Verification Checklist

Before declaring "Proof of Persistence" complete:

- [ ] Test applicant created with all 4 pillars
- [ ] Server restarted successfully
- [ ] All data retrieved correctly after restart
- [ ] Audit trail shows all operations
- [ ] Logs contain no error messages
- [ ] Team has been notified: "QMS data is now permanent"

---

## 💡 What This Proves

✅ **Data is NO LONGER on the ephemeral filesystem**  
✅ **Data PERSISTS in PostgreSQL vault**  
✅ **Automated alerts and lifecycle tracking are working**  
✅ **ISO 9001 audit trails are captured**  
✅ **System is READY for production use**

**Your "Autopilot" QMS is now autopilot-ready.** 🚀

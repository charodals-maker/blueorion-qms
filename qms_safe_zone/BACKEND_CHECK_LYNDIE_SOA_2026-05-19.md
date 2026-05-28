# Backend Check: Lyndie / SOA / Age 23
Date: 2026-05-19

## Result
No visible record found for:
- Lyndie
- SOA
- Rawdah
- age 23 tied to Lyndie/SOA

## What Was Checked

### 1) Backend health
- URL: https://blueorion-qms-backend.onrender.com/api/health
- Status: 200 OK
- Backend operational
- applicantFormsCount: 34

### 2) Candidate lookup endpoints
Tried the following:
- /api/applicants?search=Lyndie -> 401 Unauthorized
- /api/applicants/search?q=Lyndie -> 404 Not Found
- /api/ws/candidates?search=Lyndie -> 401 Unauthorized
- /api/monitoring/records?search=Lyndie -> 404 Not Found
- /api/applicants?search=SOA -> 401 Unauthorized
- /api/applicants?search=Rawdah -> 401 Unauthorized

Conclusion: Detailed applicant data is protected and requires authenticated session.

### 3) Local imported artifacts in qms_safe_zone
Search terms used: Lyndie, SOA, Rawdah
- No matching candidate names in import/evidence files.
- The only age-23 entry in the current import batch is:
  - Maria Altoriva Cabar Perila (HSW)

## Why You Do Not See Ms Lyndie Data
1. The Lyndie/SOA record is not present in the imported batch files currently in this workspace.
2. Backend applicant list endpoints require login/authorization (401), so public checks cannot confirm hidden protected rows.

## Files Referenced
- qms_safe_zone/qms_separated_tracks_import_batch_2026-05-19.json
- qms_safe_zone/SEPARATED_TRACK_IMPORT_EXECUTION_EVIDENCE_2026-05-19.md

## Next Fix Path
To display Ms Lyndie, add/push her exact record (name, age, contact, status, track) via intake endpoint, then run authenticated save/backup sync.
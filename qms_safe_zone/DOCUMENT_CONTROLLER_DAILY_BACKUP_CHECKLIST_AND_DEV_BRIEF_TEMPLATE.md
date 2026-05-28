# BLUEORION QMS
## Document Controller Daily Backup Checklist + Developer Technical Brief Template

Document Code: QMS-DC-DAILY-CHK
Revision: Rev00
Effective Date: ____________________
Prepared By: ____________________
Reviewed By (QMR): ____________________
Approved By (Admin/President): ____________________

---

## A. Ready-to-Print Daily Checklist (Document Controller)

Date: ____________________
Day: ____________________
Branch/Unit: ____________________
Document Controller: ____________________
QMR on Duty: ____________________

### 1) Morning Start-Up (Before Work, 15-20 mins)

[ ] Open daily QMS dashboard and review:
- Urgent NCRs
- Pending worker deployments
- Compliance deadlines due today

[ ] 5-minute huddle completed with QMR.

[ ] Confirm today\'s scheduled audits/process checks.

[ ] Confirm ISO logs are ready for data entry by team:
- Recruitment logs
- Documentation logs
- Deployment tracker logs
- Branch compliance logs

[ ] Confirm all required templates/forms are current revision.

### 2) Human Action -> Digital Log Trigger Map (Must be checked during operations)

Instruction: Check each item as soon as the human action happens and the digital log is updated.

Recruitment & Screening
[ ] Human action: Candidate interview completed -> Digital log updated (Candidate ID, Position, Evaluation Score).
[ ] Human action: Medical result received -> Digital log updated (Medical Status + date received).
[ ] Human action: Mandatory document submitted -> Document checklist updated (complete/incomplete).

Deployment Pipeline
[ ] Human action: Visa approval received -> Deployment tracker updated (Visa Approval Date).
[ ] Human action: Flight schedule confirmed -> Deployment tracker updated (Flight details and departure date).
[ ] Human action: POEA/DMW clearance received -> Clearance status updated in deployment record.

Branch Compliance
[ ] Human action: Branch inspection completed -> Compliance log updated (Location, Date, Auditor, Score).
[ ] Human action: NCR identified -> NCR register entry created immediately.
[ ] Human action: Corrective action assigned -> Action owner and due date logged.

Document Control
[ ] Human action: SOP/process file edited -> New revision created and tagged.
[ ] Human action: New controlled form issued -> Master list updated with revision and effectivity.
[ ] Human action: Old revision replaced -> Prior file moved to Archived/Superseded (not deleted).

### 3) Mid-Day Spot Verification

[ ] Random file spot check completed (1-3 records minimum).

Check all that apply:
[ ] Correct template revision used.
[ ] Required fields are complete.
[ ] File naming convention follows document code/revision.
[ ] Access rights are correct (no unauthorized edits).

Findings / Notes:
____________________________________________________________________
____________________________________________________________________

### 4) Evening Close-Out (After Work, 15-20 mins)

[ ] QMR/Admin approvals for today\'s updates confirmed.

[ ] Save and Backup protocol completed:
- [ ] Physical files secured.
- [ ] Digital QMS folders synced.
- [ ] Recruitment trackers synced.
- [ ] SQL/database backup completed.
- [ ] Cloud backup status verified.

[ ] Archive and supersede controls completed:
- [ ] Updated docs tagged with new revision.
- [ ] Superseded versions moved to archive.
- [ ] No historical records deleted.

[ ] Daily audit trail verification completed:
- [ ] Checked timestamp logs.
- [ ] Checked user ID logs for critical updates.
- [ ] Checked key field-change records.

### 5) Daily QMS Status Log (2-Line End-of-Day Journal)

Date: ____________________
Key Process Completed Today:
____________________________________________________________________

Any NCR Found? [ ] No  [ ] Yes
If Yes, immediate correction:
____________________________________________________________________

Document Control Status:
____________________________________________________________________

Focus for Tomorrow:
____________________________________________________________________

Document Controller Signature: ____________________  Time: __________
QMR Signature: ____________________  Time: __________

---

## B. Pre-Developer Alignment Checklist (Must complete before any change request)

Purpose: Ensure SOPs and real operations match before any developer instruction is issued.

[ ] Current SOPs reviewed against actual workflow:
- Recruitment pipeline
- Deployment tracker flow
- Branch compliance metrics

[ ] Every human action that must trigger a digital log is identified and documented.

[ ] Input fields per process stage are validated with process owners.

[ ] Approval/access matrix is validated with leadership.

[ ] Backup and rollback policy is confirmed.

[ ] Sandbox testing plan is approved (with mock data cases).

Completed by: ____________________
Date: ____________________

---

## C. Version-Controlled Technical Brief Template (Send to Developer)

Project Title: QMS System Integration and Tracker Update
Brief ID: QMS-TECH-BRIEF-__________
Revision: Rev____
Date Issued: ____________________
Target Completion Date: ____________________
Requested By: ____________________
Authorized By: ____________________

### Objective
Align digital database, tracking applications, and cloud folders with updated ISO 9001:2015 QMS standards while preserving complete audit traceability and zero data loss.

### 1) Core System Architecture Updates

| Process Stage | Required Digital Input Fields | Required Automation / Trigger |
|---|---|---|
| Stage 1: Recruitment and Screening | Candidate ID, Position, Evaluation Score, Medical Status | Auto-flag missing mandatory documents |
| Stage 2: Deployment Pipeline | Visa Approval Date, Flight Schedule, POEA/DMW Clearance Status | Auto-alert 48 hours before flight departure |
| Stage 3: Branch Compliance | Branch Location, Inspection Date, Auditor Name, Compliance Score | Auto-generate PDF NCR report if score < 100% |

### 2) Document Control and Versioning Requirements

Version Tagging
- System must auto-append revision tags (example format: SOP-REC-001_Rev01).

Archiving Logic
- On update, previous version must move to Archived/Superseded.
- Apply [SUPERSEDED] watermark.
- Historical records must never be deleted.

Access Control Matrix
- View Only: General Staff
- Edit/Upload: QMR and Document Controller
- Master Approval: Admin/President

### 3) Backup and Security Protocols (Save QMS Logic)

- Configure automatic daily backup at exactly 6:00 PM PHT for:
  - SQL database
  - Worker registries
  - Document uploads
- Enable immutable audit logs containing:
  - Timestamp
  - User ID
  - Field changed
  - Old value/new value

### 4) Mandatory Sandbox Testing (Before Live Deployment)

- Implement in sandbox environment first.
- Run mock scenarios:
  - Mock worker deployment transaction
  - Mock branch inspection checklist with NCR trigger
  - Mock document revision and supersede process
- Confirm no overwrite of existing compliance records.
- Obtain UAT sign-off from QMR and Document Controller.

### 5) Deliverables Required for Review

- Sandbox demo walkthrough (UI and automation triggers)
- Updated data schema diagram (storage and data flow)
- Rollback package (full backup snapshot before production push)
- Deployment checklist with backout steps

### 6) Acceptance Criteria

- All required fields validated and saved correctly.
- All automation triggers fire as specified.
- Revisioning and archiving behavior enforced.
- Access controls enforced by role.
- Backup job runs at 6:00 PM PHT and log is verifiable.
- Audit trail is complete and immutable.
- No historical compliance data loss.

### 7) Sign-Off

Prepared by (Process Owner): ____________________
Checked by (QMR): ____________________
Approved by (Admin/President): ____________________
Developer Acknowledgement: ____________________
Date: ____________________

---

## D. Print Instructions

- Print Section A daily (single sheet or front/back).
- Keep signed copies in controlled records folder.
- Store digital copy in QMS controlled forms directory.
- Review and revise this template quarterly or when process changes occur.

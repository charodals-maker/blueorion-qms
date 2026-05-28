# FRA Rendering Tracking And Communications Standard (QMS)

This standard is for the Document Controller and Recruitment Staff to run a live exclusivity tracker inside QMS.

## 1) Dynamic Tracking Sheet (Internal Dashboard)
Use this structure for every rendered CV record.

Columns:
- Date & Time Sent (Rendered)
- Applicant Name
- Allocated FRA
- Target Expiration
- Current Status
- Action Taken / Remarks

Status guidance:
- 🟢 Active = within 48-hour exclusivity window
- 🟡 Warning = approaching expiration (for example <= 12 hours)
- 🔴 Released = no feedback before expiration, move to open pool / next FRA

Formula tips:
- Target Expiration formula in Excel/Google Sheets: =A2+2
- Remaining hours (optional): =(D2-NOW())*24
- Conditional formatting suggestions:
  - Red when NOW()>D2
  - Yellow when AND(NOW()<=D2,(D2-NOW())<=0.5)
  - Green when (D2-NOW())>0.5

Sample rows:
- May 22, 2026 @ 1:00 PM | Juan Dela Cruz | Rawdah | May 24, 2026 @ 1:00 PM | 🟢 Active (24h left) | Sent via WhatsApp/Email
- May 22, 2026 @ 1:00 PM | Maria Santos | CAN | May 24, 2026 @ 1:00 PM | 🟡 Warning | Sent FRA requested interview
- May 20, 2026 @ 10:00 AM | Arnel Pineda | Al Riyadh | May 22, 2026 @ 10:00 AM | 🔴 RELEASED | No feedback. Transferred to IRC.

## 2) Standardized Communication Templates

### Stage 1: Render Notice (Upon Sending CVs)
Message:
Hi [FRA Name] Team, we have officially rendered [Number] new CVs to your portal/chat for exclusive marketing. Your 48-hour exclusivity window expires on [Insert Date & Time]. Please secure employer feedback before this time.

### Stage 2: Warning Notice (Before Expiration)
Send around 12-24 hours before expiry.
Message:
Hi [FRA Name] Team, this is a reminder that the exclusivity window for [Applicant Name / Batch] will expire on [Insert Date & Time]. Please share employer feedback or interview decision before the deadline to retain priority.

### Stage 3: Release Notice (After Expiration)
Message:
Hi [FRA Name] Team, as no final feedback was received within the 48-hour exclusivity period, [Applicant Name / Batch] has now been released for re-allocation under our standard process. Please coordinate if you need to re-request availability.

## 3) Daily Operating Routine
- On render: log row immediately and send Stage 1.
- Mid-cycle: send Stage 2 for all warning rows.
- At expiry: mark RELEASED and send Stage 3 if no feedback.
- End of day: run Save Backup and hard save snapshot.

## 4) Control Rules
- All times should use one timezone standard (recommended: Asia/Manila).
- Every status change must include Action Taken / Remarks.
- No row should remain blank in Current Status after render.

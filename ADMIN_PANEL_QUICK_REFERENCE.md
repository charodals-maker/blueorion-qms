# 🔐 Admin Panel - Quick Reference

## 🚀 Quick Start

### 1. Access Panel
```
URL: http://localhost:3000/admin-panel
```

### 2. Main Tabs

| Tab | Purpose | Actions |
|-----|---------|---------|
| 📋 Submissions | View & review staff work | View, Approve, Reject |
| 📄 CV Assignment | Assign CVs to FRA | Select FRA + CV, Assign |
| 📊 Audit Log | Track all admin actions | View, Filter, Export |
| 📈 Analytics | Dashboard statistics | View stats, Export reports |

---

## 🔍 FRA List

```
1️⃣  Can Alriyadh
2️⃣  Rawdah Audh
3️⃣  IRC Agency
4️⃣  Service Engineer
5️⃣  Reserve FRA
```

---

## 📊 Submission Status Flow

```
pending
   ↓
under-review (under admin review)
   ├→ approved ✅
   └→ rejected ❌
```

---

## 📄 CV Assignment Status

```
pending (waiting for FRA to review)
   ├→ selected ✅ (chosen applicant)
   ├→ rejected ❌ (not selected)
   └→ interview_scheduled 📅 (next step)
```

---

## 📊 Filter Options

### Submissions Tab
- **Status:** All, Pending, Under Review, Approved, Rejected
- **FRA:** All, Can Alriyadh, Rawdah Audh, IRC Agency, Service Engineer, Reserve FRA
- **Date Range:** Pick any date

### CV Assignment Tab
- **FRA Selection:** Required to assign CV
- **Applicant CV:** Required to assign

### Audit Log Tab
- **Action Type:** Login, View, Approve, Reject, Assign, Export
- **Admin User:** Filter by username
- **Date Range:** Pick any date

---

## 🎯 Common Tasks

### Approve a Submission
1. Go to **📋 Submissions**
2. Click **View** button
3. Write notes (optional)
4. Click **✅ Approve**

### Reject a Submission
1. Go to **📋 Submissions**
2. Click **View** button
3. Write rejection reason
4. Click **❌ Reject**

### Assign CV to FRA
1. Go to **📄 CV Assignment**
2. Select **FRA**
3. Select **Applicant CV**
4. Click **Assign CV to FRA**

### Export Submissions
1. Go to **📈 Analytics**
2. Click **📥 Export All Data as Excel**
3. File downloads automatically

### View Audit Log
1. Go to **📊 Audit Log**
2. Optional: Filter by action, admin, date
3. View all entries with timestamps

---

## 📈 Dashboard Stats

**Shown on Analytics tab:**
- Total Submissions: All submissions count
- Pending Review: Submissions waiting for approval
- Approved: ✅ Total approved submissions
- Rejected: ❌ Total rejected submissions

**FRA Performance:**
- Total Assigned: CVs assigned to FRA
- Selected: ✅ CVs selected by FRA
- Pending: Awaiting FRA decision
- Completion Rate: % of assigned CVs selected

---

## 💾 Export Types

### Excel Exports (3 types)
1. **Submissions Export**
   - All submission data
   - Color-coded by status
   - Includes reviewer notes

2. **CV Assignments Export**
   - Applicant names
   - FRA assigned
   - Assignment dates
   - Current status

3. **Audit Log Export**
   - All admin actions
   - Timestamps
   - Admin usernames
   - Action details

### PDF Reports
- Dashboard summary
- Statistics
- Charts & graphs
- Date range included

---

## 🔐 Security Notes

✅ **All Actions Are Logged**
- Admin username recorded
- Timestamp recorded
- IP address recorded
- Full description saved

✅ **Admin-Only Access**
- Requires authentication
- Role verification needed
- Access denied if not authorized

✅ **Audit Trail**
- Every action tracked
- Exportable for compliance
- Cannot be modified

---

## ⚙️ Status Codes

| Status | Meaning |
|--------|---------|
| ✅ Approved | Ready to proceed |
| ❌ Rejected | Needs revision |
| ⏳ Pending | Awaiting review |
| 🔄 Under Review | Being reviewed |
| 📅 Interview Scheduled | Next step booked |

---

## 📝 Menu Options

### Top Tabs
- 📋 **Submissions** - Main review queue
- 📄 **CV Assignment** - Assign applicants to FRAs
- 📊 **Audit Log** - Track all actions
- 📈 **Analytics** - Dashboard & reports

### Export Buttons
- 📥 **Export All Data as Excel** - All information
- 📄 **Generate PDF Report** - Formatted report
- 📥 **Export Audit Log** - Compliance log

---

## ⏱️ Recommended Workflow

### Daily (Morning)
1. Check **Pending Review** count
2. Process pending submissions
3. Assign CVs if needed
4. End of day: Export audit log

### Weekly
1. Review analytics
2. Check FRA completion rates
3. Export submissions report
4. Review any flagged items

### Monthly
1. Generate compliance report
2. Review audit log for issues
3. Archive old exports
4. Plan for next period

---

## 🆘 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between fields |
| `Enter` | Submit form |
| `Esc` | Close modal/dialog |

---

## 📱 Responsive Design

✅ **Desktop** - Full features (recommended)
✅ **Tablet** - Basic features
✅ **Mobile** - View-only mode recommended

---

## 🔄 Refresh & Updates

- **Auto-refresh:** No (manual refresh)
- **Real-time:** Not enabled
- **Cache:** May need F5 after changes

---

## 📞 Support Contacts

| Issue | Contact |
|-------|---------|
| Access denied | IT Admin |
| Data questions | System Admin |
| Export issues | Tech Support |
| Audit questions | Compliance |

---

## ✅ Pre-Approval Checklist

Before approving a submission:
- [ ] Name and ID verified
- [ ] All required documents attached
- [ ] Information is complete
- [ ] No compliance issues
- [ ] Quality standards met
- [ ] Supervisor approval obtained

---

## 🚨 Alert Indicators

- 🔴 **Red** = Error or rejection
- 🟡 **Yellow** = Pending or warning
- 🟢 **Green** = Approved or success
- 🔵 **Blue** = Under review or info

---

**Last Updated:** May 12, 2026
**Version:** 1.0
**For Admin Use Only** 🔐

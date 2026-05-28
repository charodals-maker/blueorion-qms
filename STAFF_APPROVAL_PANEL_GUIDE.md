# 🔐 Staff Monitoring & Approval Panel - Implementation Guide

## Overview
This admin-only panel provides comprehensive staff work submission tracking, CV assignment management, and full audit logging for the BLUEORION QMS system.

## Features

### 1. **Staff Submissions Tracking**
- View all staff work submissions
- Filter by status (pending, under-review, approved, rejected)
- Filter by FRA (Can Alriyadh, Rawdah Audh, IRC Agency, Service Engineer, Reserve FRA)
- Filter by date range
- Detailed submission review modal
- Admin notes for each submission

### 2. **CV Assignment Management**
- Assign CVs to specific FRAs
- Track assignment history
- View applicant selection status per FRA
- Assignment date tracking

### 3. **Audit Log**
- Complete logging of all admin actions
- Filter by action type (login, view, approve, reject, assign, export)
- Filter by admin user
- Filter by date range
- Timestamps for all entries
- IP address and user agent tracking

### 4. **Analytics Dashboard**
- Total submissions count
- Pending reviews count
- Approved submissions count
- Rejected submissions count
- FRA performance summary
- Completion rates per FRA

### 5. **Export Capabilities**
- Export submissions as Excel (with conditional formatting)
- Export CV assignments as Excel
- Export audit log as Excel
- Export analytics report as PDF

---

## File Structure

```
📦 BLUEORION QMS
├── 📄 staff_approval_panel.html          # Main admin interface
├── 📁 modules/
│   └── 📄 admin_approval_routes.js       # Backend API routes
├── 📁 models/
│   └── 📄 admin_models.js                # Database schemas
├── 📁 logs/
│   └── 📄 admin_audit.log                # Audit log file
└── 📁 exports/                           # Generated Excel files
    ├── submissions_export_*.xlsx
    ├── cv_assignments_*.xlsx
    └── audit_log_*.xlsx
```

---

## Installation

### 1. Install Required Dependencies

```bash
npm install exceljs mongoose
```

### 2. Integrate Backend Routes

Add to your main `server.js`:

```javascript
const adminRoutes = require('./modules/admin_approval_routes');

// Add to your Express app
app.use('/admin', adminRoutes);

// Mount the admin panel
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'staff_approval_panel.html'));
});
```

### 3. Initialize Database Models

```javascript
const { 
    StaffSubmission, 
    CVAssignment, 
    AuditLog, 
    AdminUser, 
    FRAStats 
} = require('./models/admin_models');
```

### 4. Create Required Directories

```bash
mkdir -p logs exports
```

---

## FRA Configuration

The system includes 5 FRA options:

| # | FRA Name | Code |
|---|----------|------|
| 1 | Can Alriyadh | CAN_ALR |
| 2 | Rawdah Audh | RAW_AUD |
| 3 | IRC Agency | IRC_AGN |
| 4 | Service Engineer | SRV_ENG |
| 5 | Reserve FRA | RES_FRA |

---

## API Endpoints

### Submissions

```
GET  /api/admin/submissions              # Get all submissions (with filters)
GET  /api/admin/submissions/:id          # Get submission details
POST /api/admin/submissions/:id/review   # Submit approval/rejection
```

**POST Body Example:**
```json
{
  "status": "approved",
  "notes": "Excellent work. Approved for next stage."
}
```

### CV Assignments

```
POST /api/admin/cv-assignment            # Assign CV to FRA
GET  /api/admin/cv-assignments           # Get all assignments (with filters)
```

**POST Body Example:**
```json
{
  "applicantId": "507f1f77bcf86cd799439011",
  "fraId": 1
}
```

### Audit Log

```
GET /api/admin/audit-log                 # Get audit entries (with filters)
```

### Statistics

```
GET /api/admin/statistics                # Get dashboard statistics
```

### Exports

```
GET /api/admin/export/submissions        # Export submissions as Excel
GET /api/admin/export/cv-assignments     # Export CV assignments as Excel
GET /api/admin/export/audit-log          # Export audit log as Excel
```

---

## Data Models

### StaffSubmission
```javascript
{
  _id: ObjectId,
  staffName: String,
  staffId: ObjectId,
  fraAssigned: Number (1-5),
  submissionType: String,
  submissionDate: Date,
  status: 'pending' | 'under-review' | 'approved' | 'rejected',
  submissionDetails: {
    title: String,
    description: String,
    attachments: [String]
  },
  reviewer: String,
  reviewDate: Date,
  reviewNotes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### CVAssignment
```javascript
{
  _id: ObjectId,
  applicantId: ObjectId,
  applicantName: String,
  cvUrl: String,
  fraAssigned: Number (1-5),
  assignmentDate: Date,
  assignedBy: String,
  status: 'pending' | 'selected' | 'rejected' | 'interview_scheduled',
  selectionDate: Date,
  selectedBy: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### AuditLog
```javascript
{
  _id: ObjectId,
  timestamp: Date,
  adminUser: String,
  action: String,
  details: String,
  submissionId: ObjectId,
  ipAddress: String,
  userAgent: String,
  statusCode: Number
}
```

---

## Usage Guide

### 1. Accessing the Admin Panel

```
http://localhost:3000/admin-panel
```

### 2. Viewing Submissions

1. Navigate to **📋 Submissions** tab
2. Use filters to narrow down results
3. Click "View" button to see details
4. Provide review notes
5. Click "Approve" or "Reject"

### 3. Assigning CVs

1. Navigate to **📄 CV Assignment** tab
2. Select FRA from dropdown
3. Select Applicant CV from dropdown
4. Click "Assign CV to FRA"
5. View assignment history below

### 4. Reviewing Audit Log

1. Navigate to **📊 Audit Log** tab
2. Filter by action type, admin user, or date
3. View all actions with timestamps
4. Export as Excel if needed

### 5. Viewing Analytics

1. Navigate to **📈 Analytics** tab
2. View key statistics
3. See FRA performance summary
4. Export reports as Excel or PDF

---

## Security Features

### Admin Authentication
- Middleware checks for admin role
- Returns 403 Forbidden if not authorized
- Tracks all access attempts

### Full Audit Logging
- Every action is logged with:
  - Timestamp
  - Admin username
  - Action type
  - Details
  - IP address
  - User agent
- Logs stored in `logs/admin_audit.log`

### Role-Based Access Control (RBAC)
```javascript
{
  canApprove: Boolean,
  canReject: Boolean,
  canAssignCV: Boolean,
  canViewAudit: Boolean,
  canExport: Boolean,
  canManageAdmins: Boolean,
  canDeleteSubmissions: Boolean
}
```

### Data Protection
- Sensitive data not exposed in logs
- Passwords stored as hashes
- HTTPS recommended for production
- Session timeout recommended (15 minutes)

---

## Excel Export Format

### Submissions Export
| Column | Type | Notes |
|--------|------|-------|
| Submission ID | Text | Unique identifier |
| Staff Name | Text | Full name |
| FRA | Text | FRA assigned |
| Submission Date | Date | Format: MM/DD/YYYY |
| Status | Text | Color-coded |
| Reviewer | Text | Admin username |
| Review Date | Date | Format: MM/DD/YYYY |
| Notes | Text | Review notes |

**Conditional Formatting:**
- ✅ APPROVED = Green background
- ❌ REJECTED = Red background
- ⏳ PENDING = Yellow background

### CV Assignments Export
| Column | Type | Notes |
|--------|------|-------|
| Applicant Name | Text | Full name |
| FRA | Text | FRA assigned |
| Assignment Date | Date | Format: MM/DD/YYYY |
| Assigned By | Text | Admin username |
| Status | Text | Pending/Selected/Rejected |

### Audit Log Export
| Column | Type | Notes |
|--------|------|-------|
| Timestamp | DateTime | Format: MM/DD/YYYY HH:mm:ss |
| Admin User | Text | Username |
| Action | Text | Action type |
| Details | Text | Full description |
| Submission ID | Text | Related submission |
| IP Address | Text | Source IP |

---

## Troubleshooting

### Q: Export button not working
**A:** Ensure `ExcelJS` is installed and `exports/` directory exists.

### Q: Audit log shows empty
**A:** Check that `logs/` directory exists and has write permissions.

### Q: Admin access denied
**A:** Verify user has `isAdmin: true` and proper role assigned.

### Q: Slow submission queries
**A:** Check database indexes are created properly:
```javascript
staffSubmissionSchema.index({ staffId: 1, fraAssigned: 1 });
staffSubmissionSchema.index({ submissionDate: -1 });
```

---

## Performance Optimization

### Database Indexes
- All fields used in filters have indexes
- Timestamps indexed for range queries
- Admin user indexed for audit queries

### Caching (Optional)
```javascript
// Cache FRA stats every 5 minutes
setInterval(async () => {
    const stats = await StaffSubmission.aggregate([
        { $group: { _id: '$fraAssigned', count: { $sum: 1 } } }
    ]);
    // Update FRAStats collection
}, 5 * 60 * 1000);
```

### Pagination (Recommended for production)
```javascript
const page = req.query.page || 1;
const limit = 20;
const skip = (page - 1) * limit;
const submissions = await StaffSubmission.find()
    .skip(skip)
    .limit(limit);
```

---

## Compliance & Compliance

- ✅ GDPR compliant (audit logging)
- ✅ Data retention policies (configurable)
- ✅ Access control logs
- ✅ Change tracking
- ✅ Export trails

---

## Support & Maintenance

### Regular Tasks
- [ ] Review audit logs weekly
- [ ] Back up database monthly
- [ ] Archive old logs quarterly
- [ ] Audit user permissions monthly
- [ ] Test exports functionality weekly

### Logs Management
```bash
# Archive old logs
mv logs/admin_audit.log logs/admin_audit_$(date +%Y-%m-%d).log
gzip logs/admin_audit_*.log

# Clear old exports (> 30 days)
find exports/ -type f -mtime +30 -delete
```

---

## Integration Checklist

- [ ] Install ExcelJS and Mongoose
- [ ] Copy HTML file to web root
- [ ] Copy backend routes file
- [ ] Copy database models file
- [ ] Add routes to main server.js
- [ ] Create `logs/` and `exports/` directories
- [ ] Set up database collections
- [ ] Create admin user accounts
- [ ] Test all export functions
- [ ] Configure audit logging retention
- [ ] Set up automated backups
- [ ] Document admin procedures
- [ ] Train admin users
- [ ] Set up monitoring alerts

---

## Future Enhancements

- [ ] Real-time notifications for approvals
- [ ] Email notifications to staff
- [ ] Dashboard charts using Chart.js
- [ ] Advanced filtering (multi-select)
- [ ] Bulk operations (approve multiple)
- [ ] Custom report builder
- [ ] 2FA for admin login
- [ ] API rate limiting
- [ ] GraphQL API support
- [ ] Mobile responsive improvements
- [ ] Dark mode support
- [ ] Multi-language support

---

**Last Updated:** May 12, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅

/**
 * Staff Approval Panel - Backend Integration & Excel Export
 * Integrates with BLUEORION QMS for staff monitoring and approval workflows
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Audit logging utility
class AuditLogger {
    static log(adminUser, action, details, submissionId = null) {
        const timestamp = new Date().toISOString();
        const auditEntry = {
            timestamp,
            adminUser,
            action,
            details,
            submissionId,
            ipAddress: this.getClientIP(),
            userAgent: this.getUserAgent()
        };

        // Log to file
        const logPath = path.join(__dirname, '../logs/admin_audit.log');
        fs.appendFileSync(logPath, JSON.stringify(auditEntry) + '\n');

        console.log(`[AUDIT] ${timestamp} - ${adminUser} - ${action} - ${details}`);
        return auditEntry;
    }

    static getClientIP() {
        return '0.0.0.0'; // Replace with req.ip from Express
    }

    static getUserAgent() {
        return 'Mozilla/5.0'; // Replace with req.get('user-agent')
    }
}

// Get all staff submissions for admin review
router.get('/api/admin/submissions', authenticateAdmin, async (req, res) => {
    try {
        const { status, fra, date } = req.query;
        let query = {};

        if (status) query.status = status;
        if (fra) query.fraAssigned = parseInt(fra);
        if (date) query.submissionDate = new Date(date);

        // Query from database
        const submissions = await StaffSubmission.find(query)
            .select('_id staffName fraAssigned submissionDate status reviewer reviewNotes')
            .sort({ submissionDate: -1 });

        AuditLogger.log(req.user.username, 'view_submissions', `Retrieved ${submissions.length} submissions`);

        res.json({
            success: true,
            data: submissions
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific submission details
router.get('/api/admin/submissions/:id', authenticateAdmin, async (req, res) => {
    try {
        const submission = await StaffSubmission.findById(req.params.id);

        if (!submission) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }

        AuditLogger.log(req.user.username, 'view_submission_details', `Viewed submission ${req.params.id}`);

        res.json({ success: true, data: submission });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit admin review (approve/reject)
router.post('/api/admin/submissions/:id/review', authenticateAdmin, async (req, res) => {
    try {
        const { status, notes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const submission = await StaffSubmission.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewer: req.user.username,
                reviewNotes: notes,
                reviewDate: new Date()
            },
            { new: true }
        );

        AuditLogger.log(
            req.user.username,
            status === 'approved' ? 'approve_submission' : 'reject_submission',
            `${status} submission ${req.params.id}. Notes: ${notes}`,
            req.params.id
        );

        res.json({ success: true, data: submission });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Assign CV to FRA
router.post('/api/admin/cv-assignment', authenticateAdmin, async (req, res) => {
    try {
        const { applicantId, fraId } = req.body;

        const assignment = new CVAssignment({
            applicantId,
            fraAssigned: fraId,
            assignedBy: req.user.username,
            assignmentDate: new Date()
        });

        await assignment.save();

        AuditLogger.log(
            req.user.username,
            'assign_cv',
            `Assigned applicant ${applicantId} to FRA ${fraId}`
        );

        res.json({ success: true, data: assignment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get CV assignments
router.get('/api/admin/cv-assignments', authenticateAdmin, async (req, res) => {
    try {
        const { fra } = req.query;
        let query = {};

        if (fra) query.fraAssigned = parseInt(fra);

        const assignments = await CVAssignment.find(query)
            .populate('applicantId', 'name')
            .sort({ assignmentDate: -1 });

        res.json({ success: true, data: assignments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get audit log
router.get('/api/admin/audit-log', authenticateAdmin, async (req, res) => {
    try {
        const { action, admin, date } = req.query;
        let query = {};

        if (action) query.action = action;
        if (admin) query.adminUser = admin;
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.timestamp = { $gte: startDate, $lt: endDate };
        }

        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(1000);

        AuditLogger.log(req.user.username, 'view_audit_log', `Retrieved ${logs.length} audit entries`);

        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export submissions as Excel
router.get('/api/admin/export/submissions', authenticateAdmin, async (req, res) => {
    try {
        const submissions = await StaffSubmission.find()
            .populate('fraAssigned')
            .sort({ submissionDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Submissions');

        // Add headers
        worksheet.columns = [
            { header: 'Submission ID', key: '_id', width: 15 },
            { header: 'Staff Name', key: 'staffName', width: 20 },
            { header: 'FRA', key: 'fraAssigned', width: 20 },
            { header: 'Submission Date', key: 'submissionDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Reviewer', key: 'reviewer', width: 15 },
            { header: 'Review Date', key: 'reviewDate', width: 15 },
            { header: 'Notes', key: 'reviewNotes', width: 30 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };

        // Add data rows
        submissions.forEach(sub => {
            worksheet.addRow({
                _id: sub._id,
                staffName: sub.staffName,
                fraAssigned: sub.fraAssigned.name,
                submissionDate: sub.submissionDate.toLocaleDateString(),
                status: sub.status.toUpperCase(),
                reviewer: sub.reviewer || 'N/A',
                reviewDate: sub.reviewDate ? sub.reviewDate.toLocaleDateString() : 'N/A',
                reviewNotes: sub.reviewNotes || ''
            });
        });

        // Add conditional formatting for status column
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                const statusCell = row.getCell(5);
                if (statusCell.value === 'APPROVED') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
                } else if (statusCell.value === 'REJECTED') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
                } else if (statusCell.value === 'PENDING') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
                }
            }
        });

        // Generate file
        const fileName = `submissions_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        AuditLogger.log(req.user.username, 'export_submissions', `Exported ${submissions.length} submissions to Excel`);

        res.download(filePath, fileName);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export CV assignments as Excel
router.get('/api/admin/export/cv-assignments', authenticateAdmin, async (req, res) => {
    try {
        const assignments = await CVAssignment.find()
            .populate('applicantId', 'name')
            .sort({ assignmentDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CV Assignments');

        worksheet.columns = [
            { header: 'Applicant Name', key: 'applicantName', width: 20 },
            { header: 'FRA', key: 'fraAssigned', width: 20 },
            { header: 'Assignment Date', key: 'assignmentDate', width: 15 },
            { header: 'Assigned By', key: 'assignedBy', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };

        assignments.forEach(assign => {
            worksheet.addRow({
                applicantName: assign.applicantId.name,
                fraAssigned: assign.fraAssigned,
                assignmentDate: assign.assignmentDate.toLocaleDateString(),
                assignedBy: assign.assignedBy,
                status: assign.status || 'Pending'
            });
        });

        const fileName = `cv_assignments_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        AuditLogger.log(req.user.username, 'export_cv_assignments', `Exported ${assignments.length} CV assignments`);

        res.download(filePath, fileName);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export audit log as Excel
router.get('/api/admin/export/audit-log', authenticateAdmin, async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .limit(5000);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Audit Log');

        worksheet.columns = [
            { header: 'Timestamp', key: 'timestamp', width: 20 },
            { header: 'Admin User', key: 'adminUser', width: 15 },
            { header: 'Action', key: 'action', width: 20 },
            { header: 'Details', key: 'details', width: 40 },
            { header: 'Submission ID', key: 'submissionId', width: 15 },
            { header: 'IP Address', key: 'ipAddress', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };

        logs.forEach(log => {
            worksheet.addRow({
                timestamp: new Date(log.timestamp).toLocaleString(),
                adminUser: log.adminUser,
                action: log.action,
                details: log.details,
                submissionId: log.submissionId || 'N/A',
                ipAddress: log.ipAddress
            });
        });

        const fileName = `audit_log_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        AuditLogger.log(req.user.username, 'export_audit_log', `Exported ${logs.length} audit entries`);

        res.download(filePath, fileName);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get FRA statistics
router.get('/api/admin/statistics', authenticateAdmin, async (req, res) => {
    try {
        const totalSubmissions = await StaffSubmission.countDocuments();
        const pending = await StaffSubmission.countDocuments({ status: 'pending' });
        const approved = await StaffSubmission.countDocuments({ status: 'approved' });
        const rejected = await StaffSubmission.countDocuments({ status: 'rejected' });

        const fraStats = [];
        const fraOptions = [
            { id: 1, name: 'Can Alriyadh' },
            { id: 2, name: 'Rawdah Audh' },
            { id: 3, name: 'IRC Agency' },
            { id: 4, name: 'Service Engineer' },
            { id: 5, name: 'Reserve FRA' }
        ];

        for (const fra of fraOptions) {
            const assigned = await StaffSubmission.countDocuments({ fraAssigned: fra.id });
            const selected = await CVAssignment.countDocuments({ fraAssigned: fra.id });
            const pendingFRA = await StaffSubmission.countDocuments({ 
                fraAssigned: fra.id, 
                status: 'pending' 
            });

            fraStats.push({
                name: fra.name,
                assigned,
                selected,
                pending: pendingFRA,
                completionRate: assigned > 0 ? Math.round((selected / assigned) * 100) : 0
            });
        }

        AuditLogger.log(req.user.username, 'view_statistics', 'Viewed dashboard statistics');

        res.json({
            success: true,
            data: {
                totalSubmissions,
                pending,
                approved,
                rejected,
                fraStats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware to authenticate admin
function authenticateAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

module.exports = router;

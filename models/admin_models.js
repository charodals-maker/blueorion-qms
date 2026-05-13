/**
 * Database Models for Staff Approval Panel
 * Mongoose schemas for submissions, CV assignments, and audit logging
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Staff Submission Schema
const staffSubmissionSchema = new Schema({
    staffName: {
        type: String,
        required: true,
        index: true
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: true
    },
    fraAssigned: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
        required: true,
        index: true
    },
    submissionType: {
        type: String,
        enum: ['selection_report', 'performance_evaluation', 'onboarding', 'training', 'other'],
        required: true
    },
    submissionDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'under-review', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    submissionDetails: {
        title: String,
        description: String,
        attachments: [String]
    },
    reviewer: {
        type: String,
        ref: 'Admin'
    },
    reviewDate: Date,
    reviewNotes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// CV Assignment Schema
const cvAssignmentSchema = new Schema({
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant',
        required: true
    },
    applicantName: String,
    cvUrl: String,
    fraAssigned: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
        required: true,
        index: true
    },
    assignmentDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    assignedBy: {
        type: String,
        ref: 'Admin',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'selected', 'rejected', 'interview_scheduled'],
        default: 'pending',
        index: true
    },
    selectionDate: Date,
    selectedBy: String,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Audit Log Schema
const auditLogSchema = new Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    adminUser: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: [
            'login',
            'logout',
            'view_submissions',
            'view_submission_details',
            'approve_submission',
            'reject_submission',
            'assign_cv',
            'view_cv_assignments',
            'export_submissions',
            'export_cv_assignments',
            'export_audit_log',
            'view_audit_log',
            'view_statistics',
            'update_status',
            'delete_submission',
            'access_denied'
        ],
        required: true,
        index: true
    },
    details: {
        type: String,
        required: true
    },
    submissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffSubmission'
    },
    ipAddress: String,
    userAgent: String,
    statusCode: {
        type: Number,
        default: 200
    }
});

// Admin User Schema (for role-based access)
const adminUserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'reviewer'],
        default: 'admin'
    },
    permissions: {
        canApprove: { type: Boolean, default: true },
        canReject: { type: Boolean, default: true },
        canAssignCV: { type: Boolean, default: true },
        canViewAudit: { type: Boolean, default: true },
        canExport: { type: Boolean, default: true },
        canManageAdmins: { type: Boolean, default: false },
        canDeleteSubmissions: { type: Boolean, default: false }
    },
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    createdBy: String
});

// FRA Statistics Schema (for cached analytics)
const fraStatsSchema = new Schema({
    fraId: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
        unique: true
    },
    fraName: String,
    totalAssigned: { type: Number, default: 0 },
    totalSelected: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Create indexes
staffSubmissionSchema.index({ staffId: 1, fraAssigned: 1 });
staffSubmissionSchema.index({ submissionDate: -1 });
cvAssignmentSchema.index({ applicantId: 1, fraAssigned: 1 });
cvAssignmentSchema.index({ assignmentDate: -1 });
auditLogSchema.index({ adminUser: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Export models
const StaffSubmission = mongoose.model('StaffSubmission', staffSubmissionSchema);
const CVAssignment = mongoose.model('CVAssignment', cvAssignmentSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const AdminUser = mongoose.model('AdminUser', adminUserSchema);
const FRAStats = mongoose.model('FRAStats', fraStatsSchema);

module.exports = {
    StaffSubmission,
    CVAssignment,
    AuditLog,
    AdminUser,
    FRAStats
};

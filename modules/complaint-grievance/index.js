// Module: Complaint & Grievance
// Purpose: Log disputes, grievances, and resolution workflows for DMW compliance.
// Supports case tracking, escalation, and compliance reporting.
// Case_ID format: BOR-CAS-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['open', 'under investigation', 'pending resolution', 'resolved', 'closed', 'escalated'];

const VALID_TYPES = [
  'Salary Dispute',
  'Working Condition Violation',
  'Contract Breach',
  'Abuse / Maltreatment',
  'Illegal Dismissal',
  'Non-payment of Benefits',
  'Repatriation Request',
  'Document Withholding',
  'Sexual Harassment',
  'Overwork / Overtime Dispute',
  'Others',
];

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const ESCALATION_BODIES = [
  'Agency Management',
  'DMW (DOLE)',
  'OWWA',
  'POLO / Philippine Embassy',
  'NLRC',
  'Legal Counsel',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateCaseId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-CAS-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCase(data) {
  const errors = [];

  if (!data.complainant || !String(data.complainant).trim()) {
    errors.push('complainant name is required');
  }
  if (!data.description || !String(data.description).trim()) {
    errors.push('description is required');
  }
  if (data.type && !VALID_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (data.severity && !VALID_SEVERITIES.includes(String(data.severity).toLowerCase())) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  if (data.escalated_to && !ESCALATION_BODIES.includes(data.escalated_to)) {
    errors.push(`escalated_to must be one of: ${ESCALATION_BODIES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createCase(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-CAS-')
    ? idOrSequence
    : generateCaseId(Number(idOrSequence) || Date.now());

  return {
    case_id: id,
    complainant: String(data.complainant || '').trim(),
    respondent: String(data.respondent || '').trim(),
    employer: String(data.employer || '').trim(),
    country: String(data.country || '').trim(),
    type: data.type || 'Others',
    description: String(data.description || '').trim(),
    severity: String(data.severity || 'medium').toLowerCase(),
    status: 'open',
    assigned_to: String(data.assigned_to || 'Unassigned').trim(),
    escalated_to: data.escalated_to || null,
    resolution: '',
    dmw_case_ref: String(data.dmw_case_ref || '').trim(),
    attachments: [],
    timeline: [{ event: 'Case opened', by: data.filed_by || 'system', at: now }],
    filed_by: String(data.filed_by || 'system').trim(),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function assignCase(record, assignee) {
  if (!assignee || !String(assignee).trim()) {
    return { success: false, error: 'assignee is required' };
  }
  record.assigned_to = String(assignee).trim();
  record.status = 'under investigation';
  record.timeline.push({ event: `Assigned to ${assignee}`, by: assignee, at: new Date().toISOString() });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function escalateCase(record, body, reason) {
  if (!body || !ESCALATION_BODIES.includes(body)) {
    return { success: false, error: `escalated_to must be one of: ${ESCALATION_BODIES.join(', ')}` };
  }
  record.status = 'escalated';
  record.escalated_to = body;
  const note = reason ? ` — ${String(reason).trim()}` : '';
  record.timeline.push({ event: `Escalated to ${body}${note}`, by: 'system', at: new Date().toISOString() });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function resolveCase(record, resolution, resolvedBy) {
  if (!resolution || !String(resolution).trim()) {
    return { success: false, error: 'resolution text is required' };
  }
  record.status = 'resolved';
  record.resolution = String(resolution).trim();
  record.resolvedAt = new Date().toISOString();
  record.timeline.push({ event: 'Case resolved', by: resolvedBy || 'system', at: record.resolvedAt });
  record.updatedAt = record.resolvedAt;
  return { success: true };
}

function closeCase(record, closedBy) {
  if (record.status !== 'resolved') {
    return { success: false, error: 'Only resolved cases can be closed' };
  }
  record.status = 'closed';
  record.timeline.push({ event: 'Case closed', by: closedBy || 'system', at: new Date().toISOString() });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function updateCaseStatus(record, status, note, updatedBy) {
  const next = String(status || '').toLowerCase();
  if (!VALID_STATUSES.includes(next)) {
    return { success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }
  record.status = next;
  if (note) {
    record.timeline.push({ event: note, by: updatedBy || 'system', at: new Date().toISOString() });
  }
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function daysOpen(record) {
  const start = new Date(record.createdAt);
  const end = (record.status === 'closed' || record.status === 'resolved') && record.resolvedAt
    ? new Date(record.resolvedAt)
    : new Date();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function isOverdue(record, slaByType = {}) {
  if (record.status === 'closed' || record.status === 'resolved') return false;
  const slaDays = slaByType[record.type] || (record.severity === 'critical' ? 3 : record.severity === 'high' ? 7 : 30);
  return daysOpen(record) > slaDays;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(records) {
  const all = records || [];
  const byStatus = {};
  const byType = {};
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  let overdue = 0;
  let resolved = 0;

  VALID_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const r of all) {
    const s = String(r.status || 'open').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const t = r.type || 'Others';
    byType[t] = (byType[t] || 0) + 1;
    const sev = String(r.severity || 'medium').toLowerCase();
    if (bySeverity[sev] !== undefined) bySeverity[sev]++;
    if (s === 'resolved' || s === 'closed') resolved++;
    if (isOverdue(r)) overdue++;
  }

  const resolutionRate = all.length > 0 ? parseFloat(((resolved / all.length) * 100).toFixed(2)) : 100;

  return { total: all.length, byStatus, byType, bySeverity, overdue, resolved, resolutionRate };
}

function filterCases(records, opts = {}) {
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (opts.status) {
    const s = String(opts.status).toLowerCase();
    list = list.filter(r => String(r.status || '').toLowerCase() === s);
  }
  if (opts.severity) {
    const sev = String(opts.severity).toLowerCase();
    list = list.filter(r => String(r.severity || '').toLowerCase() === sev);
  }
  if (opts.type) {
    const t = String(opts.type).toLowerCase();
    list = list.filter(r => String(r.type || '').toLowerCase().includes(t));
  }
  if (opts.assigned_to) {
    const a = String(opts.assigned_to).toLowerCase();
    list = list.filter(r => String(r.assigned_to || '').toLowerCase().includes(a));
  }
  if (opts.complainant) {
    const c = String(opts.complainant).toLowerCase();
    list = list.filter(r => String(r.complainant || '').toLowerCase().includes(c));
  }
  if (opts.overdueOnly) list = list.filter(r => isOverdue(r));

  const lim = parseInt(opts.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);

  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Complaint & Grievance',
  description: 'Log disputes and resolutions with full audit trail for DMW/OWWA compliance.',
  validStatuses: VALID_STATUSES,
  validTypes: VALID_TYPES,
  validSeverities: VALID_SEVERITIES,
  escalationBodies: ESCALATION_BODIES,
  // ID
  generateCaseId,
  // Validation
  validateCase,
  // Record lifecycle
  createCase,
  assignCase,
  escalateCase,
  resolveCase,
  closeCase,
  updateCaseStatus,
  // Computed helpers
  daysOpen,
  isOverdue,
  // Analytics
  summary,
  filterCases,
};

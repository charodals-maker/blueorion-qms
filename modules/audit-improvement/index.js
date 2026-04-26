// Module: Audit & Improvement (System #7)
// Purpose: Track internal audits, nonconformities, and corrective actions.
// Supports ISO 9001 audit checklists, findings, and continuous improvement records.
// Audit_ID format: BOR-AUD-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['open', 'pending verification', 'closed'];

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const SYSTEM_CHOICES = [
  'System #1 – Welfare Monitoring',
  'System #2 – Sourcing & Selection',
  'System #3 – Complaint & Grievance',
  'System #4 – Management & Leadership',
  'System #5 – Resource & Competence',
  'System #6 – Contract & Re-engagement',
  'System #7 – Audit & Improvement',
  'System #8 – Fra System',
  'System #9 – Selection & CV',
  'System #10 – Profile & Contact',
  'System #11 – Document Control',
  'System #12 – Payment & Invoice',
  'System #13 – Deployment',
  'System #14 – Welfare Emergency',
];

/** ISO 9001:2015 internal audit checklist template items */
const ISO_9001_CHECKLIST = [
  { clause: '4.1', title: 'Understanding the organization and its context', category: 'Context' },
  { clause: '4.2', title: 'Understanding needs and expectations of interested parties', category: 'Context' },
  { clause: '4.4', title: 'Quality management system and its processes', category: 'Context' },
  { clause: '5.1', title: 'Leadership and commitment', category: 'Leadership' },
  { clause: '5.2', title: 'Quality policy', category: 'Leadership' },
  { clause: '5.3', title: 'Organizational roles, responsibilities and authorities', category: 'Leadership' },
  { clause: '6.1', title: 'Actions to address risks and opportunities', category: 'Planning' },
  { clause: '6.2', title: 'Quality objectives and planning to achieve them', category: 'Planning' },
  { clause: '7.1', title: 'Resources – General', category: 'Support' },
  { clause: '7.2', title: 'Competence', category: 'Support' },
  { clause: '7.3', title: 'Awareness', category: 'Support' },
  { clause: '7.4', title: 'Communication', category: 'Support' },
  { clause: '7.5', title: 'Documented information', category: 'Support' },
  { clause: '8.1', title: 'Operational planning and control', category: 'Operation' },
  { clause: '8.4', title: 'Control of externally provided processes, products and services', category: 'Operation' },
  { clause: '8.5', title: 'Production and service provision', category: 'Operation' },
  { clause: '9.1', title: 'Monitoring, measurement, analysis and evaluation', category: 'Performance' },
  { clause: '9.2', title: 'Internal audit', category: 'Performance' },
  { clause: '9.3', title: 'Management review', category: 'Performance' },
  { clause: '10.2', title: 'Nonconformity and corrective action', category: 'Improvement' },
  { clause: '10.3', title: 'Continual improvement', category: 'Improvement' },
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

/**
 * Generate a unique Audit ID.
 * generateAuditId(1) → 'BOR-AUD-2026-0001'
 * @param {number} sequence
 * @returns {string}
 */
function generateAuditId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-AUD-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate fields for a new audit record.
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAuditRecord(data) {
  const errors = [];

  if (!data.findings || !String(data.findings).trim()) {
    errors.push('findings is required');
  }

  if (data.system_affected && !SYSTEM_CHOICES.includes(data.system_affected)) {
    errors.push(`system_affected must be one of: ${SYSTEM_CHOICES.join(', ')}`);
  }

  if (data.severity && !VALID_SEVERITIES.includes(String(data.severity).toLowerCase())) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (data.target_closure) {
    const d = new Date(data.target_closure);
    if (isNaN(d.getTime())) errors.push('target_closure must be a valid date');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

/**
 * Build a new audit record object from raw input.
 * @param {object} data
 * @param {string} idOrSequence  Pre-generated ID string or sequence number
 * @returns {object}
 */
function createAuditRecord(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-')
    ? idOrSequence
    : generateAuditId(Number(idOrSequence) || Date.now());

  return {
    audit_id: id,
    system_affected: data.system_affected || '',
    findings: String(data.findings || '').trim(),
    corrective_action: String(data.corrective_action || '').trim(),
    verified_by: String(data.verified_by || '').trim(),
    severity: String(data.severity || 'medium').toLowerCase(),
    status: 'open',
    raised_by: String(data.raised_by || 'system').trim(),
    owner: String(data.owner || data.raised_by || 'Unassigned').trim(),
    target_closure: data.target_closure || null,
    actual_closure: null,
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

/**
 * Apply a corrective action to an existing record.
 * Moves status from 'open' → 'pending verification'.
 * @param {object} record   Mutable record from the data store
 * @param {string} actionText
 * @param {string} [verifiedBy]
 * @returns {{ success: boolean, error?: string }}
 */
function applyCorrectiveAction(record, actionText, verifiedBy) {
  if (!actionText || !String(actionText).trim()) {
    return { success: false, error: 'corrective_action text cannot be empty' };
  }
  if (record.status === 'closed') {
    return { success: false, error: 'Cannot modify a closed record' };
  }
  record.corrective_action = String(actionText).trim();
  if (verifiedBy) record.verified_by = String(verifiedBy).trim();
  record.status = 'pending verification';
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Close a record that has a corrective action on file.
 * @param {object} record
 * @param {string} [verifiedBy]
 * @returns {{ success: boolean, error?: string }}
 */
function closeRecord(record, verifiedBy) {
  if (!record.corrective_action) {
    return { success: false, error: 'Cannot close without a corrective action on record' };
  }
  if (verifiedBy) record.verified_by = String(verifiedBy).trim();
  record.status = 'closed';
  record.actual_closure = new Date().toISOString().split('T')[0];
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Reopen a closed record.
 * @param {object} record
 * @param {string} [reason]
 * @returns {{ success: boolean }}
 */
function reopenRecord(record, reason) {
  record.status = 'open';
  record.actual_closure = null;
  if (reason) record.findings += ` [REOPENED: ${String(reason).trim()}]`;
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Apply a generic status update with an optional note.
 * @param {object} record
 * @param {string} status  Must be in VALID_STATUSES
 * @param {string} [note]
 * @returns {{ success: boolean, error?: string }}
 */
function updateStatus(record, status, note) {
  const next = String(status || '').toLowerCase();
  if (!VALID_STATUSES.includes(next)) {
    return { success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }
  record.status = next;
  if (note) record.notes = String(note).trim();
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

/**
 * Returns true if the target closure date has passed and the record is not closed.
 * @param {object} record
 * @returns {boolean}
 */
function isOverdue(record) {
  if (record.status === 'closed' || !record.target_closure) return false;
  return new Date().toDateString() > new Date(record.target_closure).toDateString() &&
    new Date() > new Date(record.target_closure);
}

/**
 * Number of days the record has been open.
 * @param {object} record
 * @returns {number}
 */
function daysOpen(record) {
  const start = new Date(record.createdAt);
  const end = record.status === 'closed' && record.actual_closure
    ? new Date(record.actual_closure)
    : new Date();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Compute compliance score: percentage of records that are closed.
 * @param {object[]} records
 * @returns {number} 0.0 – 100.0
 */
function complianceScore(records) {
  if (!records || records.length === 0) return 100.0;
  const closed = records.filter(r => r.status === 'closed').length;
  return parseFloat(((closed / records.length) * 100).toFixed(2));
}

/**
 * Summarise audit records for dashboard display.
 * @param {object[]} records
 * @returns {object}
 */
function summary(records) {
  const all = records || [];
  const byStatus = { open: 0, 'pending verification': 0, closed: 0 };
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  const bySystem = {};
  let overdue = 0;

  for (const r of all) {
    const s = String(r.status || '').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;

    const sev = String(r.severity || 'medium').toLowerCase();
    if (bySeverity[sev] !== undefined) bySeverity[sev]++;

    const sys = r.system_affected || 'Unclassified';
    bySystem[sys] = (bySystem[sys] || 0) + 1;

    if (isOverdue(r)) overdue++;
  }

  return {
    total: all.length,
    byStatus,
    bySeverity,
    bySystem,
    overdue,
    complianceScore: complianceScore(all),
  };
}

/**
 * Filter and sort an array of records.
 * @param {object[]} records
 * @param {object}   opts  { status, severity, system, owner, limit }
 * @returns {object[]}
 */
function filterRecords(records, opts = {}) {
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (opts.status) {
    const s = String(opts.status).toLowerCase();
    list = list.filter(r => String(r.status || '').toLowerCase() === s);
  }
  if (opts.severity) {
    const sev = String(opts.severity).toLowerCase();
    list = list.filter(r => String(r.severity || '').toLowerCase() === sev);
  }
  if (opts.system) {
    const sys = String(opts.system).toLowerCase();
    list = list.filter(r => String(r.system_affected || '').toLowerCase().includes(sys));
  }
  if (opts.owner) {
    const o = String(opts.owner).toLowerCase();
    list = list.filter(r => String(r.owner || '').toLowerCase().includes(o));
  }
  if (opts.overdueOnly) {
    list = list.filter(r => isOverdue(r));
  }

  const lim = parseInt(opts.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);

  return list;
}

// ─── ISO 9001 Checklist ───────────────────────────────────────────────────────

/**
 * Return the full ISO 9001:2015 checklist, optionally filtered by category.
 * @param {string} [category]
 * @returns {object[]}
 */
function getChecklist(category) {
  if (!category) return ISO_9001_CHECKLIST;
  const cat = String(category).toLowerCase();
  return ISO_9001_CHECKLIST.filter(c => String(c.category).toLowerCase() === cat);
}

/**
 * Build a new audit session checklist with blank compliance marks.
 * @param {string} [category]
 * @returns {object[]}
 */
function newChecklistSession(category) {
  return getChecklist(category).map(item => ({
    ...item,
    compliant: null,      // true | false | null (not assessed)
    observation: '',
    evidence: '',
  }));
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Audit & Improvement',
  description: 'Track internal audits and corrective actions to support ISO 9001 and DMW requirements.',
  systemChoices: SYSTEM_CHOICES,
  validStatuses: VALID_STATUSES,
  validSeverities: VALID_SEVERITIES,
  // ID
  generateAuditId,
  // Validation
  validateAuditRecord,
  // Record lifecycle
  createAuditRecord,
  applyCorrectiveAction,
  closeRecord,
  reopenRecord,
  updateStatus,
  // Computed helpers
  isOverdue,
  daysOpen,
  // Analytics
  complianceScore,
  summary,
  filterRecords,
  // ISO checklist
  ISO_9001_CHECKLIST,
  getChecklist,
  newChecklistSession,
};

// Module: Document Control
// Purpose: Manage ISO 9001:2015 manuals, policies, government notices, and official correspondence.
// Supports document versioning, approvals, and audit evidence storage.
// Doc_ID format: BOR-DOC-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['draft', 'under review', 'approved', 'superseded', 'archived', 'withdrawn'];

const VALID_CATEGORIES = [
  'QMS Manual',
  'Quality Policy',
  'Procedure',
  'Work Instruction',
  'Form / Template',
  'Government Notice / Circular',
  'DMW / POEA Order',
  'OWWA Memo',
  'ISO 9001 Standard',
  'Employment Contract Template',
  'MOA / MOU',
  'Job Order',
  'Certificate',
  'Correspondence',
  'Others',
];

const VALID_ACCESS_LEVELS = ['public', 'staff', 'manager', 'president', 'restricted'];

const ISO_CLAUSES = [
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3',
  '6.1', '6.2', '6.3',
  '7.1', '7.2', '7.3', '7.4', '7.5',
  '8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7',
  '9.1', '9.2', '9.3',
  '10.1', '10.2', '10.3',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateDocId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-DOC-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateDocument(data) {
  const errors = [];

  if (!data.title || !String(data.title).trim()) errors.push('title is required');
  if (data.category && !VALID_CATEGORIES.includes(data.category)) errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  if (data.status && !VALID_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  if (data.access_level && !VALID_ACCESS_LEVELS.includes(String(data.access_level).toLowerCase())) errors.push(`access_level must be one of: ${VALID_ACCESS_LEVELS.join(', ')}`);
  if (data.effective_date) { const d = new Date(data.effective_date); if (isNaN(d.getTime())) errors.push('effective_date must be a valid date'); }
  if (data.review_date) { const d = new Date(data.review_date); if (isNaN(d.getTime())) errors.push('review_date must be a valid date'); }

  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createDocument(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-DOC-')
    ? idOrSequence
    : generateDocId(Number(idOrSequence) || Date.now());

  return {
    doc_id: id,
    title: String(data.title || '').trim(),
    category: data.category || 'Others',
    version: String(data.version || '1.0').trim(),
    status: 'draft',
    iso_clause: data.iso_clause || null,
    effective_date: data.effective_date || null,
    review_date: data.review_date || null,
    prepared_by: String(data.prepared_by || '').trim(),
    reviewed_by: String(data.reviewed_by || '').trim(),
    approved_by: String(data.approved_by || '').trim(),
    access_level: String(data.access_level || 'staff').toLowerCase(),
    description: String(data.description || '').trim(),
    file_path: data.file_path || null,
    file_name: data.file_name || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    revision_history: [{ version: String(data.version || '1.0'), by: data.prepared_by || 'system', at: now, note: 'Initial draft' }],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function submitForReview(record, reviewedBy) {
  if (record.status !== 'draft') return { success: false, error: 'Only draft documents can be submitted for review' };
  record.status = 'under review';
  record.reviewed_by = reviewedBy || record.reviewed_by;
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function approveDocument(record, approvedBy, effectiveDate) {
  if (record.status !== 'under review') return { success: false, error: 'Only documents under review can be approved' };
  record.status = 'approved';
  record.approved_by = approvedBy || record.approved_by;
  if (effectiveDate) record.effective_date = effectiveDate;
  record.approved_at = new Date().toISOString();
  record.updatedAt = record.approved_at;
  return { success: true };
}

function reviseDocument(record, newVersion, revisedBy, note) {
  if (!newVersion || !String(newVersion).trim()) return { success: false, error: 'newVersion is required' };
  const oldVersion = record.version;
  record.status = 'draft';
  record.version = String(newVersion).trim();
  record.revision_history.push({ version: record.version, by: revisedBy || 'system', at: new Date().toISOString(), note: note || `Revised from v${oldVersion}` });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function archiveDocument(record, archivedBy) {
  record.status = 'archived';
  record.archived_by = archivedBy || 'system';
  record.archived_at = new Date().toISOString();
  record.updatedAt = record.archived_at;
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function isDueForReview(record) {
  if (!record.review_date || record.status === 'archived' || record.status === 'withdrawn') return false;
  return new Date() >= new Date(record.review_date);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(records) {
  const all = records || [];
  const byStatus = {};
  const byCategory = {};
  let dueForReview = 0;

  VALID_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const r of all) {
    const s = String(r.status || 'draft').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const c = r.category || 'Others';
    byCategory[c] = (byCategory[c] || 0) + 1;
    if (isDueForReview(r)) dueForReview++;
  }

  const approvedCount = byStatus['approved'] || 0;
  const approvalRate = all.length > 0 ? parseFloat(((approvedCount / all.length) * 100).toFixed(2)) : 0;

  return { total: all.length, byStatus, byCategory, dueForReview, approvalRate };
}

function filterDocuments(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.category) { const c = String(o.category).toLowerCase(); list = list.filter(r => String(r.category || '').toLowerCase().includes(c)); }
  if (o.title) { const t = String(o.title).toLowerCase(); list = list.filter(r => String(r.title || '').toLowerCase().includes(t)); }
  if (o.access_level) { const a = String(o.access_level).toLowerCase(); list = list.filter(r => String(r.access_level || '').toLowerCase() === a); }
  if (o.dueForReviewOnly) list = list.filter(r => isDueForReview(r));

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Document Control',
  description: 'Manage ISO manuals and government notices with version control and approvals.',
  validStatuses: VALID_STATUSES,
  validCategories: VALID_CATEGORIES,
  validAccessLevels: VALID_ACCESS_LEVELS,
  isoClauses: ISO_CLAUSES,
  generateDocId,
  validateDocument,
  createDocument,
  submitForReview,
  approveDocument,
  reviseDocument,
  archiveDocument,
  isDueForReview,
  summary,
  filterDocuments,
};
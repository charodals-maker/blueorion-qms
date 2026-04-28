// Module: Management & Leadership
// Purpose: Capture executive oversight, decision logs, and agency leadership actions.
// Supports meeting notes, approval workflows, and strategic accountability.
// Decision_ID format: BOR-MGT-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_MEETING_TYPES = [
  'Management Review',
  'Quality Meeting',
  'Operations Briefing',
  'Board Meeting',
  'Emergency Meeting',
  'Staff Meeting',
  'Recruitment Review',
  'Client Meeting',
  'Government / Regulatory',
  'Others',
];

const VALID_DECISION_STATUSES = ['pending', 'approved', 'rejected', 'deferred', 'implemented'];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const LEADERSHIP_ROLES = [
  'President / CEO',
  'QMR (Quality Management Representative)',
  'Operations Manager',
  'Document Controller',
  'DPO (Data Privacy Officer)',
  'Finance / Accounting',
  'Welfare Officer',
  'Recruitment Officer',
  'IT / Admin',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateDecisionId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-MGT-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateMeetingId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-MTG-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateMeeting(data) {
  const errors = [];
  if (!data.title || !String(data.title).trim()) errors.push('title is required');
  if (data.type && !VALID_MEETING_TYPES.includes(data.type)) errors.push(`type must be one of: ${VALID_MEETING_TYPES.join(', ')}`);
  if (data.date) { const d = new Date(data.date); if (isNaN(d.getTime())) errors.push('date must be a valid date'); }
  return { valid: errors.length === 0, errors };
}

function validateDecision(data) {
  const errors = [];
  if (!data.title || !String(data.title).trim()) errors.push('title is required');
  if (!data.description || !String(data.description).trim()) errors.push('description is required');
  if (data.status && !VALID_DECISION_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_DECISION_STATUSES.join(', ')}`);
  if (data.priority && !VALID_PRIORITIES.includes(String(data.priority).toLowerCase())) errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

function createMeeting(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-MTG-')
    ? idOrSequence
    : generateMeetingId(Number(idOrSequence) || Date.now());

  return {
    meeting_id: id,
    title: String(data.title || '').trim(),
    type: data.type || 'Others',
    date: data.date || now.split('T')[0],
    time: data.time || '',
    venue: String(data.venue || '').trim(),
    attendees: Array.isArray(data.attendees) ? data.attendees : [],
    agenda: String(data.agenda || '').trim(),
    minutes: String(data.minutes || '').trim(),
    action_items: [],
    decisions: [],
    presided_by: String(data.presided_by || '').trim(),
    recorded_by: String(data.recorded_by || '').trim(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

function createDecision(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-MGT-')
    ? idOrSequence
    : generateDecisionId(Number(idOrSequence) || Date.now());

  return {
    decision_id: id,
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
    priority: String(data.priority || 'medium').toLowerCase(),
    status: 'pending',
    decided_by: String(data.decided_by || '').trim(),
    assigned_to: String(data.assigned_to || 'Unassigned').trim(),
    due_date: data.due_date || null,
    meeting_id: data.meeting_id || null,
    outcome: '',
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function approveDecision(record, approvedBy, outcome) {
  record.status = 'approved';
  if (approvedBy) record.decided_by = String(approvedBy).trim();
  if (outcome) record.outcome = String(outcome).trim();
  record.approved_at = new Date().toISOString();
  record.updatedAt = record.approved_at;
  return { success: true };
}

function implementDecision(record, notes) {
  if (record.status !== 'approved') return { success: false, error: 'Only approved decisions can be marked as implemented' };
  record.status = 'implemented';
  if (notes) record.outcome = String(notes).trim();
  record.resolvedAt = new Date().toISOString();
  record.updatedAt = record.resolvedAt;
  return { success: true };
}

function addActionItem(meeting, item, assignee, dueDate) {
  if (!item || !String(item).trim()) return { success: false, error: 'item description is required' };
  const action = {
    id: `ACT-${Date.now()}`,
    description: String(item).trim(),
    assignee: assignee || 'Unassigned',
    due_date: dueDate || null,
    done: false,
    addedAt: new Date().toISOString(),
  };
  if (!meeting.action_items) meeting.action_items = [];
  meeting.action_items.push(action);
  meeting.updatedAt = action.addedAt;
  return { success: true, action };
}

function updateDecisionStatus(record, status, note) {
  const next = String(status || '').toLowerCase();
  if (!VALID_DECISION_STATUSES.includes(next)) return { success: false, error: `status must be one of: ${VALID_DECISION_STATUSES.join(', ')}` };
  record.status = next;
  if (note) record.notes = String(note).trim();
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(meetings, decisions) {
  const allMeetings = meetings || [];
  const allDecisions = decisions || [];

  const byMeetingType = {};
  VALID_MEETING_TYPES.forEach(t => { byMeetingType[t] = 0; });
  for (const m of allMeetings) { const t = m.type || 'Others'; if (byMeetingType[t] !== undefined) byMeetingType[t]++; }

  const byDecisionStatus = {};
  VALID_DECISION_STATUSES.forEach(s => { byDecisionStatus[s] = 0; });
  for (const d of allDecisions) { const s = String(d.status || 'pending').toLowerCase(); if (byDecisionStatus[s] !== undefined) byDecisionStatus[s]++; }

  const implementationRate = allDecisions.length > 0
    ? parseFloat((((byDecisionStatus['implemented'] || 0) / allDecisions.length) * 100).toFixed(2))
    : 0;

  const overdueDecisions = allDecisions.filter(d =>
    d.due_date && d.status !== 'implemented' && d.status !== 'rejected' && new Date() > new Date(d.due_date)
  ).length;

  return {
    totalMeetings: allMeetings.length,
    totalDecisions: allDecisions.length,
    byMeetingType,
    byDecisionStatus,
    implementationRate,
    overdueDecisions,
  };
}

function filterDecisions(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.priority) { const p = String(o.priority).toLowerCase(); list = list.filter(r => String(r.priority || '').toLowerCase() === p); }
  if (o.assigned_to) { const a = String(o.assigned_to).toLowerCase(); list = list.filter(r => String(r.assigned_to || '').toLowerCase().includes(a)); }
  if (o.meeting_id) list = list.filter(r => r.meeting_id === o.meeting_id);

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Management & Leadership',
  description: 'Log executive oversight and leadership decisions for agency governance.',
  validMeetingTypes: VALID_MEETING_TYPES,
  validDecisionStatuses: VALID_DECISION_STATUSES,
  validPriorities: VALID_PRIORITIES,
  leadershipRoles: LEADERSHIP_ROLES,
  generateDecisionId,
  generateMeetingId,
  validateMeeting,
  validateDecision,
  createMeeting,
  createDecision,
  approveDecision,
  implementDecision,
  addActionItem,
  updateDecisionStatus,
  summary,
  filterDecisions,
};
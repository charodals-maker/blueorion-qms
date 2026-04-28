// Module: Resource & Competence
// Purpose: Manage staff training, internal resources, and competency records.
// Supports training plans, certifications, and skill inventories.
// Training_ID format: BOR-TRN-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TRAINING_STATUSES = ['planned', 'ongoing', 'completed', 'cancelled'];

const VALID_TRAINING_TYPES = [
  'ISO 9001:2015 Awareness',
  'Internal Quality Audit',
  'DMW / POEA Compliance',
  'OWWA Programs',
  'HR & Recruitment Skills',
  'Data Privacy (RA 10173)',
  'Welfare & Counseling',
  'IT / Digital Tools',
  'Leadership & Management',
  'Anti-Harassment Training',
  'First Aid / Safety',
  'Others',
];

const VALID_COMPETENCE_LEVELS = ['beginner', 'developing', 'proficient', 'advanced', 'expert'];

const VALID_RESOURCE_TYPES = ['equipment', 'software', 'vehicle', 'office supply', 'facility', 'others'];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateTrainingId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-TRN-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateCertId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-CRT-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateTraining(data) {
  const errors = [];
  if (!data.title || !String(data.title).trim()) errors.push('title is required');
  if (data.type && !VALID_TRAINING_TYPES.includes(data.type)) errors.push(`type must be one of: ${VALID_TRAINING_TYPES.join(', ')}`);
  if (data.status && !VALID_TRAINING_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_TRAINING_STATUSES.join(', ')}`);
  if (data.scheduled_date) { const d = new Date(data.scheduled_date); if (isNaN(d.getTime())) errors.push('scheduled_date must be a valid date'); }
  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

function createTraining(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-TRN-')
    ? idOrSequence
    : generateTrainingId(Number(idOrSequence) || Date.now());

  return {
    training_id: id,
    title: String(data.title || '').trim(),
    type: data.type || 'Others',
    description: String(data.description || '').trim(),
    facilitator: String(data.facilitator || '').trim(),
    venue: String(data.venue || 'TBD').trim(),
    scheduled_date: data.scheduled_date || null,
    duration_hours: parseFloat(data.duration_hours) || 0,
    participants: Array.isArray(data.participants) ? data.participants : [],
    max_participants: parseInt(data.max_participants, 10) || 0,
    status: 'planned',
    outcomes: String(data.outcomes || '').trim(),
    cost: parseFloat(data.cost) || 0,
    notes: String(data.notes || '').trim(),
    attachments: [],
    created_by: String(data.created_by || 'system').trim(),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

function createCertificate(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-CRT-')
    ? idOrSequence
    : generateCertId(Number(idOrSequence) || Date.now());

  return {
    cert_id: id,
    staff_id: String(data.staff_id || '').trim(),
    staff_name: String(data.staff_name || '').trim(),
    title: String(data.title || '').trim(),
    issuing_body: String(data.issuing_body || '').trim(),
    issue_date: data.issue_date || null,
    expiry_date: data.expiry_date || null,
    training_id: data.training_id || null,
    competence_level: String(data.competence_level || 'proficient').toLowerCase(),
    file_path: data.file_path || null,
    verified: false,
    verified_by: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function startTraining(record) {
  if (record.status !== 'planned') return { success: false, error: 'Only planned trainings can be started' };
  record.status = 'ongoing';
  record.started_at = new Date().toISOString();
  record.updatedAt = record.started_at;
  return { success: true };
}

function completeTraining(record, outcomes, completedBy) {
  record.status = 'completed';
  if (outcomes) record.outcomes = String(outcomes).trim();
  record.completed_by = completedBy || 'system';
  record.completedAt = new Date().toISOString();
  record.updatedAt = record.completedAt;
  return { success: true };
}

function addParticipant(record, staffId, staffName) {
  if (!staffId) return { success: false, error: 'staffId is required' };
  const exists = record.participants && record.participants.find(p => p.staff_id === staffId);
  if (exists) return { success: false, error: 'Participant already enrolled' };
  if (!record.participants) record.participants = [];
  record.participants.push({ staff_id: String(staffId).trim(), name: String(staffName || '').trim(), enrolled_at: new Date().toISOString(), completed: false });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function verifyCertificate(cert, verifiedBy) {
  cert.verified = true;
  cert.verified_by = verifiedBy || 'system';
  cert.verified_at = new Date().toISOString();
  cert.updatedAt = cert.verified_at;
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function isCertExpired(cert) {
  if (!cert.expiry_date) return false;
  return new Date() > new Date(cert.expiry_date);
}

function daysUntilCertExpiry(cert) {
  if (!cert.expiry_date) return null;
  return Math.floor((new Date(cert.expiry_date).getTime() - Date.now()) / 86400000);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(trainings, certificates) {
  const allT = trainings || [];
  const allC = certificates || [];

  const byStatus = {};
  VALID_TRAINING_STATUSES.forEach(s => { byStatus[s] = 0; });
  for (const t of allT) { const s = String(t.status || 'planned').toLowerCase(); if (byStatus[s] !== undefined) byStatus[s]++; }

  const byType = {};
  for (const t of allT) { const tp = t.type || 'Others'; byType[tp] = (byType[tp] || 0) + 1; }

  const expiredCerts = allC.filter(c => isCertExpired(c)).length;
  const expiringSoon = allC.filter(c => { const d = daysUntilCertExpiry(c); return d !== null && d >= 0 && d <= 30; }).length;
  const totalParticipants = allT.reduce((sum, t) => sum + (Array.isArray(t.participants) ? t.participants.length : 0), 0);

  return { totalTrainings: allT.length, totalCertificates: allC.length, byStatus, byType, expiredCerts, expiringSoon, totalParticipants };
}

function filterTrainings(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.type) { const t = String(o.type).toLowerCase(); list = list.filter(r => String(r.type || '').toLowerCase().includes(t)); }
  if (o.title) { const ti = String(o.title).toLowerCase(); list = list.filter(r => String(r.title || '').toLowerCase().includes(ti)); }

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Resource & Competence',
  description: 'Manage staff training, resource allocation, and competency records.',
  validTrainingStatuses: VALID_TRAINING_STATUSES,
  validTrainingTypes: VALID_TRAINING_TYPES,
  validCompetenceLevels: VALID_COMPETENCE_LEVELS,
  validResourceTypes: VALID_RESOURCE_TYPES,
  generateTrainingId,
  generateCertId,
  validateTraining,
  createTraining,
  createCertificate,
  startTraining,
  completeTraining,
  addParticipant,
  verifyCertificate,
  isCertExpired,
  daysUntilCertExpiry,
  summary,
  filterTrainings,
};
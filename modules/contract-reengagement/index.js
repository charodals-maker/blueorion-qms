// Module: Contract & Re-engagement
// Purpose: Manage completed contracts, renewals, and returnee worker re-engagement.
// Supports contract status, re-deployment eligibility, and returnee tracking.
// Contract_ID format: BOR-CTR-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CONTRACT_STATUSES = ['active', 'completed', 'terminated', 'cancelled', 'under renewal', 'renewed'];

const VALID_REENGAGEMENT_STATUSES = ['returned', 'resting', 'ready for re-deployment', 'under evaluation', 're-deployed', 'not interested', 'blacklisted'];

const VALID_CONTRACT_TYPES = [
  'Standard Employment Contract (SEC)',
  'Unified Employment Contract',
  'Special Employment Contract',
  'Apprenticeship / Training',
  'Seasonal',
  'Fixed-Term',
  'Project-Based',
];

const VALID_TERMINATION_REASONS = [
  'Contract Completion',
  'Mutual Agreement',
  'Employer Termination',
  'Employee Resignation',
  'Medical Repatriation',
  'Disciplinary Action',
  'Force Majeure',
  'Death',
  'Others',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateContractId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-CTR-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateReengagementId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-REG-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateContract(data) {
  const errors = [];
  if (!data.worker_id || !String(data.worker_id).trim()) errors.push('worker_id is required');
  if (!data.worker_name || !String(data.worker_name).trim()) errors.push('worker_name is required');
  if (!data.employer || !String(data.employer).trim()) errors.push('employer is required');
  if (data.type && !VALID_CONTRACT_TYPES.includes(data.type)) errors.push(`type must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`);
  if (data.status && !VALID_CONTRACT_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_CONTRACT_STATUSES.join(', ')}`);
  if (data.start_date) { const d = new Date(data.start_date); if (isNaN(d.getTime())) errors.push('start_date must be a valid date'); }
  if (data.end_date) { const d = new Date(data.end_date); if (isNaN(d.getTime())) errors.push('end_date must be a valid date'); }
  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

function createContract(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-CTR-')
    ? idOrSequence
    : generateContractId(Number(idOrSequence) || Date.now());

  return {
    contract_id: id,
    worker_id: String(data.worker_id || '').trim(),
    worker_name: String(data.worker_name || '').trim(),
    employer: String(data.employer || '').trim(),
    employer_country: String(data.employer_country || '').trim(),
    type: data.type || 'Standard Employment Contract (SEC)',
    job_title: String(data.job_title || '').trim(),
    monthly_salary: parseFloat(data.monthly_salary) || 0,
    salary_currency: String(data.salary_currency || 'USD').trim(),
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    duration_months: parseInt(data.duration_months, 10) || 24,
    status: 'active',
    fra_id: data.fra_id || null,
    oec_number: String(data.oec_number || '').trim(),
    poea_case_number: String(data.poea_case_number || '').trim(),
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    termination_reason: null,
    renewal_count: 0,
    notes: String(data.notes || '').trim(),
    file_path: data.file_path || null,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
    completedAt: null,
  };
}

function createReengagementRecord(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-REG-')
    ? idOrSequence
    : generateReengagementId(Number(idOrSequence) || Date.now());

  return {
    reengagement_id: id,
    worker_id: String(data.worker_id || '').trim(),
    worker_name: String(data.worker_name || '').trim(),
    previous_contract_id: data.previous_contract_id || null,
    return_date: data.return_date || now.split('T')[0],
    reengagement_status: String(data.reengagement_status || 'returned').toLowerCase(),
    eligible_for_redeployment: false,
    eligibility_notes: '',
    previous_employer: String(data.previous_employer || '').trim(),
    previous_country: String(data.previous_country || '').trim(),
    years_experience: parseFloat(data.years_experience) || 0,
    assessment_date: null,
    assessed_by: null,
    new_contract_id: null,
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function completeContract(record, note) {
  if (record.status !== 'active') return { success: false, error: 'Only active contracts can be marked as completed' };
  record.status = 'completed';
  if (note) record.notes = String(note).trim();
  record.completedAt = new Date().toISOString();
  record.updatedAt = record.completedAt;
  return { success: true };
}

function terminateContract(record, reason, terminatedBy) {
  if (record.status !== 'active') return { success: false, error: 'Only active contracts can be terminated' };
  if (!VALID_TERMINATION_REASONS.includes(reason)) return { success: false, error: `reason must be one of: ${VALID_TERMINATION_REASONS.join(', ')}` };
  record.status = 'terminated';
  record.termination_reason = reason;
  record.terminated_by = terminatedBy || 'system';
  record.terminatedAt = new Date().toISOString();
  record.updatedAt = record.terminatedAt;
  return { success: true };
}

function renewContract(record, newEndDate, renewedBy) {
  if (!['active', 'completed'].includes(record.status)) return { success: false, error: 'Only active or completed contracts can be renewed' };
  if (!newEndDate) return { success: false, error: 'newEndDate is required for renewal' };
  record.status = 'renewed';
  record.end_date = newEndDate;
  record.renewal_count = (record.renewal_count || 0) + 1;
  record.renewed_by = renewedBy || 'system';
  record.renewed_at = new Date().toISOString();
  record.updatedAt = record.renewed_at;
  return { success: true };
}

function assessReengagement(record, eligible, notes, assessedBy) {
  record.eligible_for_redeployment = !!eligible;
  record.eligibility_notes = String(notes || '').trim();
  record.assessed_by = assessedBy || 'system';
  record.assessment_date = new Date().toISOString();
  record.reengagement_status = eligible ? 'ready for re-deployment' : 'not interested';
  record.updatedAt = record.assessment_date;
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function daysUntilExpiry(record) {
  if (!record.end_date || record.status !== 'active') return null;
  return Math.floor((new Date(record.end_date).getTime() - Date.now()) / 86400000);
}

function isExpiringSoon(record, daysThreshold) {
  const days = daysUntilExpiry(record);
  return days !== null && days >= 0 && days <= (daysThreshold || 60);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(contracts, reengagements) {
  const allC = contracts || [];
  const allR = reengagements || [];

  const byContractStatus = {};
  VALID_CONTRACT_STATUSES.forEach(s => { byContractStatus[s] = 0; });
  for (const c of allC) { const s = String(c.status || 'active').toLowerCase(); if (byContractStatus[s] !== undefined) byContractStatus[s]++; }

  const byReengagementStatus = {};
  VALID_REENGAGEMENT_STATUSES.forEach(s => { byReengagementStatus[s] = 0; });
  for (const r of allR) { const s = String(r.reengagement_status || 'returned').toLowerCase(); if (byReengagementStatus[s] !== undefined) byReengagementStatus[s]++; }

  const expiringSoon = allC.filter(c => isExpiringSoon(c, 60)).length;
  const renewalCandidates = allR.filter(r => r.eligible_for_redeployment).length;

  return {
    totalContracts: allC.length,
    totalReturnees: allR.length,
    byContractStatus,
    byReengagementStatus,
    expiringSoon,
    renewalCandidates,
  };
}

function filterContracts(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.employer) { const e = String(o.employer).toLowerCase(); list = list.filter(r => String(r.employer || '').toLowerCase().includes(e)); }
  if (o.worker_name) { const n = String(o.worker_name).toLowerCase(); list = list.filter(r => String(r.worker_name || '').toLowerCase().includes(n)); }
  if (o.expiringSoon) list = list.filter(r => isExpiringSoon(r, parseInt(o.expiringSoon, 10) || 60));

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Contract & Re-engagement',
  description: 'Manage finished contracts, renewals, and returning worker placements.',
  validContractStatuses: VALID_CONTRACT_STATUSES,
  validReengagementStatuses: VALID_REENGAGEMENT_STATUSES,
  validContractTypes: VALID_CONTRACT_TYPES,
  validTerminationReasons: VALID_TERMINATION_REASONS,
  generateContractId,
  generateReengagementId,
  validateContract,
  createContract,
  createReengagementRecord,
  completeContract,
  terminateContract,
  renewContract,
  assessReengagement,
  daysUntilExpiry,
  isExpiringSoon,
  summary,
  filterContracts,
};
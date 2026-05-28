// Module: FRA System
// Purpose: Manage Foreign Recruitment Agency partners and job order relationships.
// Supports FRA onboarding, contracts, and compliance tracking.
// FRA_ID format: BOR-FRA-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_FRA_STATUSES = ['active', 'suspended', 'terminated', 'under evaluation', 'blacklisted'];

const VALID_JO_STATUSES = ['open', 'partially filled', 'filled', 'cancelled', 'expired'];

const VALID_PARTNER_COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Hong Kong', 'Singapore', 'Taiwan', 'Japan',
  'South Korea', 'Malaysia', 'Brunei', 'Italy', 'Germany', 'United Kingdom',
  'Canada', 'Australia', 'Others',
];

const COMPLIANCE_REQUIREMENTS = [
  'DMW Accreditation',
  'POA (Power of Attorney)',
  'MOA / MOU Signed',
  'Job Order (JO) Authenticated',
  'Employer / Company Profile',
  'Manpower Request',
  'POEA Approved JO',
  'Embassy Attestation',
  'Insurance Coverage',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateFRAId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-FRA-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateJobOrderId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-JO-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFRA(data) {
  const errors = [];
  if (!data.name || !String(data.name).trim()) errors.push('name is required');
  if (!data.country || !VALID_PARTNER_COUNTRIES.includes(data.country)) errors.push(`country must be one of: ${VALID_PARTNER_COUNTRIES.join(', ')}`);
  if (data.status && !VALID_FRA_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_FRA_STATUSES.join(', ')}`);
  if (data.accreditation_expiry) { const d = new Date(data.accreditation_expiry); if (isNaN(d.getTime())) errors.push('accreditation_expiry must be a valid date'); }
  return { valid: errors.length === 0, errors };
}

function validateJobOrder(data) {
  const errors = [];
  if (!data.fra_id || !String(data.fra_id).trim()) errors.push('fra_id is required');
  if (!data.employer || !String(data.employer).trim()) errors.push('employer is required');
  if (!data.positions || !Array.isArray(data.positions) || data.positions.length === 0) errors.push('positions array is required and must not be empty');
  if (data.status && !VALID_JO_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_JO_STATUSES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

function createFRA(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-FRA-')
    ? idOrSequence
    : generateFRAId(Number(idOrSequence) || Date.now());

  const initCompliance = {};
  COMPLIANCE_REQUIREMENTS.forEach(req => { initCompliance[req] = false; });

  return {
    fra_id: id,
    name: String(data.name || '').trim(),
    country: data.country || 'Others',
    address: String(data.address || '').trim(),
    contact_person: String(data.contact_person || '').trim(),
    contact_number: String(data.contact_number || '').trim(),
    email: String(data.email || '').trim(),
    website: String(data.website || '').trim(),
    dmw_accreditation_no: String(data.dmw_accreditation_no || '').trim(),
    accreditation_expiry: data.accreditation_expiry || null,
    status: 'active',
    compliance: data.compliance || initCompliance,
    active_job_orders: 0,
    total_deployed: 0,
    rating: 0,
    rating_notes: '',
    notes: String(data.notes || '').trim(),
    onboarded_by: String(data.onboarded_by || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function createJobOrder(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-JO-')
    ? idOrSequence
    : generateJobOrderId(Number(idOrSequence) || Date.now());

  const totalSlots = Array.isArray(data.positions)
    ? data.positions.reduce((s, p) => s + (parseInt(p.slots, 10) || 1), 0)
    : 0;

  return {
    jo_id: id,
    fra_id: String(data.fra_id || '').trim(),
    employer: String(data.employer || '').trim(),
    employer_country: String(data.employer_country || '').trim(),
    positions: Array.isArray(data.positions) ? data.positions : [],
    total_slots: totalSlots,
    filled_slots: 0,
    status: 'open',
    validity_date: data.validity_date || null,
    poea_reference: String(data.poea_reference || '').trim(),
    embassy_reference: String(data.embassy_reference || '').trim(),
    salary_range: String(data.salary_range || '').trim(),
    benefits_summary: String(data.benefits_summary || '').trim(),
    deployment_date: data.deployment_date || null,
    assigned_recruiter: String(data.assigned_recruiter || 'Unassigned').trim(),
    candidates: [],
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function updateFRAStatus(record, status, reason, updatedBy) {
  const next = String(status || '').toLowerCase();
  if (!VALID_FRA_STATUSES.includes(next)) return { success: false, error: `status must be one of: ${VALID_FRA_STATUSES.join(', ')}` };
  record.status = next;
  if (reason) record.notes += ` [STATUS: ${next.toUpperCase()} — ${String(reason).trim()}]`;
  if (updatedBy) record.updated_by = String(updatedBy).trim();
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function updateCompliance(fra, requirement, met, verifiedBy) {
  if (!COMPLIANCE_REQUIREMENTS.includes(requirement)) return { success: false, error: `requirement must be one of: ${COMPLIANCE_REQUIREMENTS.join(', ')}` };
  if (!fra.compliance) fra.compliance = {};
  fra.compliance[requirement] = !!met;
  if (verifiedBy) fra.last_verified_by = String(verifiedBy).trim();
  fra.last_compliance_check = new Date().toISOString();
  fra.updatedAt = fra.last_compliance_check;
  return { success: true };
}

function addCandidateToJO(jo, candidateId, candidateName, addedBy) {
  if (!candidateId) return { success: false, error: 'candidateId is required' };
  if (!jo.candidates) jo.candidates = [];
  const exists = jo.candidates.find(c => c.id === candidateId);
  if (exists) return { success: false, error: 'Candidate already in this job order' };
  jo.candidates.push({ id: String(candidateId).trim(), name: String(candidateName || '').trim(), added_by: addedBy || 'system', added_at: new Date().toISOString(), deployment_status: 'pending' });
  jo.updatedAt = new Date().toISOString();
  return { success: true };
}

function updateJOStatus(jo, status, closedBy) {
  const next = String(status || '').toLowerCase();
  if (!VALID_JO_STATUSES.includes(next)) return { success: false, error: `status must be one of: ${VALID_JO_STATUSES.join(', ')}` };
  jo.status = next;
  if (['filled', 'cancelled', 'expired'].includes(next)) { jo.closedAt = new Date().toISOString(); if (closedBy) jo.closed_by = String(closedBy).trim(); }
  jo.updatedAt = new Date().toISOString();
  return { success: true };
}

function rateFRA(fra, rating, notes) {
  if (isNaN(rating) || rating < 0 || rating > 5) return { success: false, error: 'rating must be between 0 and 5' };
  fra.rating = parseFloat(parseFloat(rating).toFixed(1));
  if (notes) fra.rating_notes = String(notes).trim();
  fra.last_rated_at = new Date().toISOString();
  fra.updatedAt = fra.last_rated_at;
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function complianceScore(fra) {
  if (!fra.compliance) return 0;
  const keys = COMPLIANCE_REQUIREMENTS;
  const met = keys.filter(k => fra.compliance[k]).length;
  return parseFloat(((met / keys.length) * 100).toFixed(2));
}

function isAccreditationExpired(fra) {
  if (!fra.accreditation_expiry) return false;
  return new Date() > new Date(fra.accreditation_expiry);
}

function daysUntilAccreditationExpiry(fra) {
  if (!fra.accreditation_expiry) return null;
  return Math.floor((new Date(fra.accreditation_expiry).getTime() - Date.now()) / 86400000);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(fras, jobOrders) {
  const allF = fras || [];
  const allJO = jobOrders || [];

  const byFRAStatus = {};
  VALID_FRA_STATUSES.forEach(s => { byFRAStatus[s] = 0; });
  for (const f of allF) { const s = String(f.status || 'active').toLowerCase(); if (byFRAStatus[s] !== undefined) byFRAStatus[s]++; }

  const byCountry = {};
  for (const f of allF) { const c = f.country || 'Others'; byCountry[c] = (byCountry[c] || 0) + 1; }

  const byJOStatus = {};
  VALID_JO_STATUSES.forEach(s => { byJOStatus[s] = 0; });
  for (const jo of allJO) { const s = String(jo.status || 'open').toLowerCase(); if (byJOStatus[s] !== undefined) byJOStatus[s]++; }

  const openSlots = allJO.filter(jo => jo.status === 'open').reduce((sum, jo) => sum + ((jo.total_slots || 0) - (jo.filled_slots || 0)), 0);
  const accreditationExpired = allF.filter(f => isAccreditationExpired(f)).length;
  const avgRating = allF.length > 0 ? parseFloat((allF.reduce((s, f) => s + (f.rating || 0), 0) / allF.length).toFixed(2)) : 0;

  return {
    totalFRAs: allF.length,
    totalJobOrders: allJO.length,
    byFRAStatus,
    byCountry,
    byJOStatus,
    openSlots,
    accreditationExpired,
    avgRating,
  };
}

function filterFRAs(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.country) { const c = String(o.country).toLowerCase(); list = list.filter(r => String(r.country || '').toLowerCase().includes(c)); }
  if (o.name) { const n = String(o.name).toLowerCase(); list = list.filter(r => String(r.name || '').toLowerCase().includes(n)); }
  if (o.expiredAccreditationOnly) list = list.filter(r => isAccreditationExpired(r));

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

function filterJobOrders(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.fra_id) list = list.filter(r => r.fra_id === o.fra_id);
  if (o.employer) { const e = String(o.employer).toLowerCase(); list = list.filter(r => String(r.employer || '').toLowerCase().includes(e)); }
  if (o.country) { const c = String(o.country).toLowerCase(); list = list.filter(r => String(r.employer_country || '').toLowerCase().includes(c)); }

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'FRA System',
  description: 'Manage FRA partners, job orders, and compliance for international recruitment.',
  validFRAStatuses: VALID_FRA_STATUSES,
  validJOStatuses: VALID_JO_STATUSES,
  validPartnerCountries: VALID_PARTNER_COUNTRIES,
  complianceRequirements: COMPLIANCE_REQUIREMENTS,
  generateFRAId,
  generateJobOrderId,
  validateFRA,
  validateJobOrder,
  createFRA,
  createJobOrder,
  updateFRAStatus,
  updateCompliance,
  addCandidateToJO,
  updateJOStatus,
  rateFRA,
  complianceScore,
  isAccreditationExpired,
  daysUntilAccreditationExpiry,
  summary,
  filterFRAs,
  filterJobOrders,
};
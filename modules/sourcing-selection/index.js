// Module: Sourcing & Selection
// Purpose: Manage recruitment ads, applicant sourcing, CV sorting, and candidate matching.
// Supports candidate pipelines, job posting, and CV evaluation.
// Lead_ID format: BOR-SRC-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'rejected'];

const VALID_SOURCING_CHANNELS = [
  'Facebook Ad',
  'Job Fair',
  'Referral',
  'Walk-in',
  'Online Portal (JobStreet, Indeed, etc.)',
  'Agency Partner',
  'Government (PESO, DMW)',
  'Barangay Posting',
  'SMS Blast',
  'Others',
];

const VALID_JOB_CATEGORIES = [
  'Household Service Worker (HSW)',
  'Caregiver',
  'Factory Worker',
  'Construction / Laborer',
  'Driver',
  'Cleaner / Janitor',
  'Cook',
  'Security Guard',
  'Nurse / Medical Staff',
  'IT / Technical',
  'Others',
];

const VALID_CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'closed'];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateLeadId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-SRC-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateCampaignId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-CAM-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateLead(data) {
  const errors = [];
  if (!data.name || !String(data.name).trim()) errors.push('name is required');
  if (data.channel && !VALID_SOURCING_CHANNELS.includes(data.channel)) errors.push(`channel must be one of: ${VALID_SOURCING_CHANNELS.join(', ')}`);
  if (data.job_category && !VALID_JOB_CATEGORIES.includes(data.job_category)) errors.push(`job_category must be one of: ${VALID_JOB_CATEGORIES.join(', ')}`);
  if (data.status && !VALID_LEAD_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

function validateCampaign(data) {
  const errors = [];
  if (!data.title || !String(data.title).trim()) errors.push('title is required');
  if (!data.channel || !VALID_SOURCING_CHANNELS.includes(data.channel)) errors.push(`channel must be one of: ${VALID_SOURCING_CHANNELS.join(', ')}`);
  if (data.status && !VALID_CAMPAIGN_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_CAMPAIGN_STATUSES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

// ─── Record Builders ──────────────────────────────────────────────────────────

function createLead(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-SRC-')
    ? idOrSequence
    : generateLeadId(Number(idOrSequence) || Date.now());

  return {
    lead_id: id,
    name: String(data.name || '').trim(),
    contact_number: String(data.contact_number || '').trim(),
    email: String(data.email || '').trim(),
    address: String(data.address || '').trim(),
    channel: data.channel || 'Others',
    job_category: data.job_category || 'Others',
    target_country: String(data.target_country || '').trim(),
    campaign_id: data.campaign_id || null,
    status: 'new',
    assigned_recruiter: String(data.assigned_recruiter || 'Unassigned').trim(),
    notes: String(data.notes || '').trim(),
    qualification_score: 0,
    converted_to_applicant: false,
    applicant_id: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createCampaign(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-CAM-')
    ? idOrSequence
    : generateCampaignId(Number(idOrSequence) || Date.now());

  return {
    campaign_id: id,
    title: String(data.title || '').trim(),
    channel: data.channel || 'Others',
    target_count: parseInt(data.target_count, 10) || 0,
    budget: parseFloat(data.budget) || 0,
    job_category: data.job_category || 'Others',
    target_country: String(data.target_country || '').trim(),
    start_date: data.start_date || now.split('T')[0],
    end_date: data.end_date || null,
    status: 'draft',
    leads_count: 0,
    converted_count: 0,
    created_by: String(data.created_by || 'system').trim(),
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function qualifyLead(record, score, notes, qualifiedBy) {
  if (score !== undefined && (isNaN(score) || score < 0 || score > 100)) {
    return { success: false, error: 'score must be between 0 and 100' };
  }
  record.status = 'qualified';
  if (score !== undefined) record.qualification_score = parseInt(score, 10);
  if (notes) record.notes = String(notes).trim();
  record.qualified_by = qualifiedBy || 'system';
  record.qualified_at = new Date().toISOString();
  record.updatedAt = record.qualified_at;
  return { success: true };
}

function convertLead(record, applicantId) {
  if (!applicantId) return { success: false, error: 'applicant_id is required to convert a lead' };
  record.status = 'converted';
  record.converted_to_applicant = true;
  record.applicant_id = String(applicantId).trim();
  record.converted_at = new Date().toISOString();
  record.updatedAt = record.converted_at;
  return { success: true };
}

function rejectLead(record, reason, rejectedBy) {
  record.status = 'rejected';
  if (reason) record.notes += ` [REJECTED: ${String(reason).trim()}]`;
  record.rejected_by = rejectedBy || 'system';
  record.rejected_at = new Date().toISOString();
  record.updatedAt = record.rejected_at;
  return { success: true };
}

function updateLeadStatus(record, status, notes) {
  const next = String(status || '').toLowerCase();
  if (!VALID_LEAD_STATUSES.includes(next)) {
    return { success: false, error: `status must be one of: ${VALID_LEAD_STATUSES.join(', ')}` };
  }
  record.status = next;
  if (notes) record.notes = String(notes).trim();
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(leads, campaigns) {
  const all = leads || [];
  const byStatus = {};
  const byChannel = {};
  const byJobCategory = {};
  let converted = 0;

  VALID_LEAD_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const l of all) {
    const s = String(l.status || 'new').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const ch = l.channel || 'Others';
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    const jc = l.job_category || 'Others';
    byJobCategory[jc] = (byJobCategory[jc] || 0) + 1;
    if (l.converted_to_applicant) converted++;
  }

  const conversionRate = all.length > 0 ? parseFloat(((converted / all.length) * 100).toFixed(2)) : 0;

  return {
    total: all.length,
    byStatus,
    byChannel,
    byJobCategory,
    converted,
    conversionRate,
    activeCampaigns: (campaigns || []).filter(c => c.status === 'active').length,
  };
}

function filterLeads(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.channel) { const c = String(o.channel).toLowerCase(); list = list.filter(r => String(r.channel || '').toLowerCase().includes(c)); }
  if (o.job_category) { const jc = String(o.job_category).toLowerCase(); list = list.filter(r => String(r.job_category || '').toLowerCase().includes(jc)); }
  if (o.recruiter) { const rec = String(o.recruiter).toLowerCase(); list = list.filter(r => String(r.assigned_recruiter || '').toLowerCase().includes(rec)); }
  if (o.name) { const n = String(o.name).toLowerCase(); list = list.filter(r => String(r.name || '').toLowerCase().includes(n)); }
  if (o.campaign_id) { list = list.filter(r => r.campaign_id === o.campaign_id); }

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Sourcing & Selection',
  description: 'Manage CVs, recruitment ads, and candidate selection for job orders.',
  validLeadStatuses: VALID_LEAD_STATUSES,
  validSourcingChannels: VALID_SOURCING_CHANNELS,
  validJobCategories: VALID_JOB_CATEGORIES,
  validCampaignStatuses: VALID_CAMPAIGN_STATUSES,
  generateLeadId,
  generateCampaignId,
  validateLead,
  validateCampaign,
  createLead,
  createCampaign,
  qualifyLead,
  convertLead,
  rejectLead,
  updateLeadStatus,
  summary,
  filterLeads,
};

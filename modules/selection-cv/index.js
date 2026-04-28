// Module: Selection & CV
// Purpose: Manage candidate evaluation, CV shortlisting, and job matching.
// Supports ranking, interview scheduling, and job order assignment.
// Evaluation_ID format: BOR-SEL-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_EVALUATION_STATUSES = ['pending', 'shortlisted', 'for interview', 'interviewed', 'endorsed', 'deployed', 'rejected', 'withdrew'];

const VALID_INTERVIEW_OUTCOMES = ['passed', 'failed', 'deferred', 'no_show'];

const VALID_SCREENING_CRITERIA = [
  'Complete Documents',
  'Passport Validity',
  'Work Experience Match',
  'Age Requirement',
  'Medical Fitness',
  'PDOS Completion',
  'Employer Approval',
  'Language Proficiency',
  'Skills Assessment',
];

const EVALUATION_STAGES = ['initial_screening', 'document_check', 'employer_interview', 'medical_exam', 'final_selection', 'deployment_processing'];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateEvalId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-SEL-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Scoring Helper ───────────────────────────────────────────────────────────

const CRITERIA_WEIGHTS = {
  'Complete Documents': 15,
  'Passport Validity': 10,
  'Work Experience Match': 25,
  'Age Requirement': 10,
  'Medical Fitness': 15,
  'PDOS Completion': 5,
  'Employer Approval': 10,
  'Language Proficiency': 5,
  'Skills Assessment': 5,
};

function computeScore(criteriaResults) {
  if (!criteriaResults || typeof criteriaResults !== 'object') return 0;
  let total = 0;
  for (const [criterion, passed] of Object.entries(criteriaResults)) {
    if (passed && CRITERIA_WEIGHTS[criterion]) total += CRITERIA_WEIGHTS[criterion];
  }
  return Math.min(100, total);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEvaluation(data) {
  const errors = [];
  if (!data.applicant_id || !String(data.applicant_id).trim()) errors.push('applicant_id is required');
  if (!data.applicant_name || !String(data.applicant_name).trim()) errors.push('applicant_name is required');
  if (!data.job_order_id || !String(data.job_order_id).trim()) errors.push('job_order_id is required');
  if (data.status && !VALID_EVALUATION_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_EVALUATION_STATUSES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createEvaluation(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-SEL-')
    ? idOrSequence
    : generateEvalId(Number(idOrSequence) || Date.now());

  const criteriaResults = data.criteria_results || {};

  return {
    eval_id: id,
    applicant_id: String(data.applicant_id || '').trim(),
    applicant_name: String(data.applicant_name || '').trim(),
    job_order_id: String(data.job_order_id || '').trim(),
    job_title: String(data.job_title || '').trim(),
    employer: String(data.employer || '').trim(),
    country: String(data.country || '').trim(),
    status: 'pending',
    stage: 'initial_screening',
    score: computeScore(criteriaResults),
    criteria_results: criteriaResults,
    interview_date: data.interview_date || null,
    interview_outcome: null,
    interview_notes: '',
    employer_feedback: '',
    medical_status: String(data.medical_status || 'pending').toLowerCase(),
    recommended: false,
    recommended_by: null,
    evaluated_by: String(data.evaluated_by || 'system').trim(),
    cv_url: data.cv_url || null,
    notes: String(data.notes || '').trim(),
    timeline: [{ stage: 'initial_screening', event: 'Evaluation created', by: data.evaluated_by || 'system', at: now }],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function shortlist(record, shortlistedBy) {
  if (record.status !== 'pending') return { success: false, error: 'Only pending evaluations can be shortlisted' };
  record.status = 'shortlisted';
  record.stage = 'document_check';
  record.shortlisted_by = shortlistedBy || 'system';
  record.shortlisted_at = new Date().toISOString();
  record.timeline.push({ stage: record.stage, event: 'Candidate shortlisted', by: shortlistedBy || 'system', at: record.shortlisted_at });
  record.updatedAt = record.shortlisted_at;
  return { success: true };
}

function scheduleInterview(record, interviewDate, notes, scheduledBy) {
  if (!interviewDate) return { success: false, error: 'interviewDate is required' };
  record.status = 'for interview';
  record.stage = 'employer_interview';
  record.interview_date = interviewDate;
  if (notes) record.interview_notes = String(notes).trim();
  record.timeline.push({ stage: record.stage, event: `Interview scheduled for ${interviewDate}`, by: scheduledBy || 'system', at: new Date().toISOString() });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function recordInterview(record, outcome, feedback, conductedBy) {
  if (!VALID_INTERVIEW_OUTCOMES.includes(outcome)) return { success: false, error: `outcome must be one of: ${VALID_INTERVIEW_OUTCOMES.join(', ')}` };
  record.status = outcome === 'passed' ? 'interviewed' : (outcome === 'no_show' ? 'for interview' : 'rejected');
  record.interview_outcome = outcome;
  if (feedback) record.employer_feedback = String(feedback).trim();
  const now = new Date().toISOString();
  record.interview_conducted_at = now;
  record.timeline.push({ stage: record.stage, event: `Interview ${outcome}`, by: conductedBy || 'system', at: now });
  record.updatedAt = now;
  return { success: true };
}

function endorseCandidate(record, endorsedBy, notes) {
  if (!['interviewed', 'shortlisted'].includes(record.status)) return { success: false, error: 'Candidate must be interviewed or shortlisted to endorse' };
  record.status = 'endorsed';
  record.stage = 'final_selection';
  record.recommended = true;
  record.recommended_by = endorsedBy || 'system';
  if (notes) record.notes = String(notes).trim();
  record.endorsed_at = new Date().toISOString();
  record.timeline.push({ stage: record.stage, event: 'Candidate endorsed', by: endorsedBy || 'system', at: record.endorsed_at });
  record.updatedAt = record.endorsed_at;
  return { success: true };
}

function rejectCandidate(record, reason, rejectedBy) {
  record.status = 'rejected';
  if (reason) record.notes += ` [REJECTED: ${String(reason).trim()}]`;
  record.rejected_at = new Date().toISOString();
  record.timeline.push({ stage: record.stage, event: `Rejected: ${reason || 'unspecified'}`, by: rejectedBy || 'system', at: record.rejected_at });
  record.updatedAt = record.rejected_at;
  return { success: true };
}

function updateCriteria(record, criteriaResults) {
  if (typeof criteriaResults !== 'object') return { success: false, error: 'criteriaResults must be an object' };
  record.criteria_results = { ...record.criteria_results, ...criteriaResults };
  record.score = computeScore(record.criteria_results);
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(evaluations) {
  const all = evaluations || [];
  const byStatus = {};
  const byJobTitle = {};
  const byCountry = {};
  let endorsed = 0;
  let deployed = 0;

  VALID_EVALUATION_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const e of all) {
    const s = String(e.status || 'pending').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const jt = e.job_title || 'Others';
    byJobTitle[jt] = (byJobTitle[jt] || 0) + 1;
    const c = e.country || 'Others';
    byCountry[c] = (byCountry[c] || 0) + 1;
    if (e.recommended) endorsed++;
    if (s === 'deployed') deployed++;
  }

  const avgScore = all.length > 0 ? parseFloat((all.reduce((sum, e) => sum + (e.score || 0), 0) / all.length).toFixed(2)) : 0;

  return { total: all.length, byStatus, byJobTitle, byCountry, endorsed, deployed, avgScore };
}

function filterEvaluations(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.job_order_id) list = list.filter(r => r.job_order_id === o.job_order_id);
  if (o.applicant_name) { const n = String(o.applicant_name).toLowerCase(); list = list.filter(r => String(r.applicant_name || '').toLowerCase().includes(n)); }
  if (o.recommendedOnly) list = list.filter(r => r.recommended);
  if (o.country) { const c = String(o.country).toLowerCase(); list = list.filter(r => String(r.country || '').toLowerCase().includes(c)); }

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Selection & CV',
  description: 'Manage candidate CVs and selection workflows for job order matching.',
  validEvaluationStatuses: VALID_EVALUATION_STATUSES,
  validInterviewOutcomes: VALID_INTERVIEW_OUTCOMES,
  validScreeningCriteria: VALID_SCREENING_CRITERIA,
  evaluationStages: EVALUATION_STAGES,
  criteriaWeights: CRITERIA_WEIGHTS,
  generateEvalId,
  computeScore,
  validateEvaluation,
  createEvaluation,
  shortlist,
  scheduleInterview,
  recordInterview,
  endorseCandidate,
  rejectCandidate,
  updateCriteria,
  summary,
  filterEvaluations,
};
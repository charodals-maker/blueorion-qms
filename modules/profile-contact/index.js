// Module: Profile & Contact
// Purpose: Store master applicant and candidate records with contact details.
// Supports centralized candidate search, passport and visa data, and communication history.
// Profile_ID format: BOR-PRF-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PROFILE_STATUSES = ['active', 'deployed', 'returnee', 'blacklisted', 'inactive', 'applicant'];

const VALID_CIVIL_STATUSES = ['single', 'married', 'widowed', 'separated', 'annulled'];

const VALID_EDUCATIONAL_ATTAINMENTS = [
  'Elementary Graduate',
  'High School Graduate',
  'Vocational / TESDA',
  'College Undergraduate',
  'College Graduate',
  'Post-Graduate',
];

const VALID_DOCUMENT_TYPES = [
  'Passport',
  'NBI Clearance',
  'Police Clearance',
  'Birth Certificate',
  'Marriage Certificate',
  'PDOS Certificate',
  'OEC (Overseas Employment Certificate)',
  'Medical Certificate',
  'Employment Contract',
  'Visa',
  'COE (Certificate of Employment)',
  'Others',
];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateProfileId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-PRF-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateProfile(data) {
  const errors = [];
  if (!data.first_name || !String(data.first_name).trim()) errors.push('first_name is required');
  if (!data.last_name || !String(data.last_name).trim()) errors.push('last_name is required');
  if (!data.passport_no || !String(data.passport_no).trim()) errors.push('passport_no is required');
  if (data.status && !VALID_PROFILE_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_PROFILE_STATUSES.join(', ')}`);
  if (data.civil_status && !VALID_CIVIL_STATUSES.includes(String(data.civil_status).toLowerCase())) errors.push(`civil_status must be one of: ${VALID_CIVIL_STATUSES.join(', ')}`);
  if (data.passport_expiry) { const d = new Date(data.passport_expiry); if (isNaN(d.getTime())) errors.push('passport_expiry must be a valid date'); }
  if (data.date_of_birth) { const d = new Date(data.date_of_birth); if (isNaN(d.getTime())) errors.push('date_of_birth must be a valid date'); }
  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createProfile(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-PRF-')
    ? idOrSequence
    : generateProfileId(Number(idOrSequence) || Date.now());

  const fullName = `${String(data.first_name || '').trim()} ${String(data.middle_name || '').trim()} ${String(data.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();

  return {
    profile_id: id,
    first_name: String(data.first_name || '').trim(),
    middle_name: String(data.middle_name || '').trim(),
    last_name: String(data.last_name || '').trim(),
    full_name: fullName,
    date_of_birth: data.date_of_birth || null,
    place_of_birth: String(data.place_of_birth || '').trim(),
    nationality: String(data.nationality || 'Filipino').trim(),
    civil_status: String(data.civil_status || 'single').toLowerCase(),
    educational_attainment: data.educational_attainment || 'College Graduate',
    address: String(data.address || '').trim(),
    city: String(data.city || '').trim(),
    province: String(data.province || '').trim(),
    contact_number: String(data.contact_number || '').trim(),
    email: String(data.email || '').trim(),
    emergency_contact: String(data.emergency_contact || '').trim(),
    emergency_contact_number: String(data.emergency_contact_number || '').trim(),
    passport_no: String(data.passport_no || '').trim(),
    passport_expiry: data.passport_expiry || null,
    visa_type: String(data.visa_type || '').trim(),
    job_title: String(data.job_title || '').trim(),
    skills: Array.isArray(data.skills) ? data.skills : [],
    work_experience_years: parseInt(data.work_experience_years, 10) || 0,
    status: String(data.status || 'applicant').toLowerCase(),
    documents: [],
    communication_log: [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: String(data.notes || '').trim(),
    photo_url: data.photo_url || null,
    cv_url: data.cv_url || null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function updateProfileStatus(record, status, note, updatedBy) {
  const next = String(status || '').toLowerCase();
  if (!VALID_PROFILE_STATUSES.includes(next)) return { success: false, error: `status must be one of: ${VALID_PROFILE_STATUSES.join(', ')}` };
  const prev = record.status;
  record.status = next;
  record.communication_log.push({ event: `Status changed from ${prev} to ${next}`, by: updatedBy || 'system', note: note || '', at: new Date().toISOString() });
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

function addDocument(record, docType, fileName, filePath, uploadedBy) {
  if (!VALID_DOCUMENT_TYPES.includes(docType)) return { success: false, error: `docType must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}` };
  const doc = { type: docType, file_name: String(fileName || '').trim(), file_path: filePath || null, uploaded_by: uploadedBy || 'system', uploaded_at: new Date().toISOString() };
  if (!record.documents) record.documents = [];
  record.documents.push(doc);
  record.updatedAt = doc.uploaded_at;
  return { success: true, doc };
}

function logCommunication(record, event, note, by) {
  if (!event || !String(event).trim()) return { success: false, error: 'event is required' };
  const entry = { event: String(event).trim(), note: String(note || '').trim(), by: by || 'system', at: new Date().toISOString() };
  if (!record.communication_log) record.communication_log = [];
  record.communication_log.push(entry);
  record.updatedAt = entry.at;
  return { success: true, entry };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function age(record) {
  if (!record.date_of_birth) return null;
  const dob = new Date(record.date_of_birth);
  if (isNaN(dob.getTime())) return null;
  return Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function isPassportExpiringSoon(record, daysThreshold) {
  if (!record.passport_expiry) return false;
  const days = Math.floor((new Date(record.passport_expiry).getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= (daysThreshold || 90);
}

function isPassportExpired(record) {
  if (!record.passport_expiry) return false;
  return new Date() > new Date(record.passport_expiry);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(records) {
  const all = records || [];
  const byStatus = {};
  const byJobTitle = {};
  let passportExpired = 0;
  let passportExpiringSoon = 0;

  VALID_PROFILE_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const r of all) {
    const s = String(r.status || 'applicant').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const jt = r.job_title || 'Unspecified';
    byJobTitle[jt] = (byJobTitle[jt] || 0) + 1;
    if (isPassportExpired(r)) passportExpired++;
    else if (isPassportExpiringSoon(r, 90)) passportExpiringSoon++;
  }

  return { total: all.length, byStatus, byJobTitle, passportExpired, passportExpiringSoon };
}

function searchProfiles(records, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return records || [];
  return (records || []).filter(r =>
    String(r.full_name || '').toLowerCase().includes(q) ||
    String(r.passport_no || '').toLowerCase().includes(q) ||
    String(r.contact_number || '').toLowerCase().includes(q) ||
    String(r.email || '').toLowerCase().includes(q) ||
    String(r.job_title || '').toLowerCase().includes(q)
  );
}

function filterProfiles(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.job_title) { const jt = String(o.job_title).toLowerCase(); list = list.filter(r => String(r.job_title || '').toLowerCase().includes(jt)); }
  if (o.city) { const c = String(o.city).toLowerCase(); list = list.filter(r => String(r.city || '').toLowerCase().includes(c)); }
  if (o.passportExpiredOnly) list = list.filter(r => isPassportExpired(r));
  if (o.passportExpiringSoon) list = list.filter(r => isPassportExpiringSoon(r, parseInt(o.passportExpiringSoon, 10) || 90));
  if (o.q) list = searchProfiles(list, o.q);

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Profile & Contact',
  description: 'Store worker profiles and contact details for applicant management.',
  validProfileStatuses: VALID_PROFILE_STATUSES,
  validCivilStatuses: VALID_CIVIL_STATUSES,
  validEducationalAttainments: VALID_EDUCATIONAL_ATTAINMENTS,
  validDocumentTypes: VALID_DOCUMENT_TYPES,
  generateProfileId,
  validateProfile,
  createProfile,
  updateProfileStatus,
  addDocument,
  logCommunication,
  age,
  isPassportExpiringSoon,
  isPassportExpired,
  summary,
  searchProfiles,
  filterProfiles,
};
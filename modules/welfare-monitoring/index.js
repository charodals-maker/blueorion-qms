// Module: Welfare & Monitoring
// Purpose: Track worker status abroad and communication logs.
// Supports deployed worker check-ins, status history, and compliance notifications.
// Worker_ID format: BOR-WKR-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['active', 'inactive', 'distressed', 'repatriated', 'hospitalized', 'missing', 'deceased'];

const VALID_COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Israel', 'Hong Kong', 'Singapore', 'Taiwan', 'Japan',
  'South Korea', 'Malaysia', 'Brunei', 'Italy', 'United Kingdom', 'Canada', 'Others',
];

const ALERT_TYPES = [
  'missed_checkin',
  'distress_signal',
  'emergency',
  'medical',
  'document_expiry',
  'contract_ending',
];

const CHECKIN_INTERVAL_DAYS = 30; // Standard DMW-required interval

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateWorkerId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-WKR-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateLogId() {
  return `LOG-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateWorker(data) {
  const errors = [];

  if (!data.name || !String(data.name).trim()) {
    errors.push('name is required');
  }
  if (!data.passport_no || !String(data.passport_no).trim()) {
    errors.push('passport_no is required');
  }
  if (data.status && !VALID_STATUSES.includes(String(data.status).toLowerCase())) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (data.contract_end) {
    const d = new Date(data.contract_end);
    if (isNaN(d.getTime())) errors.push('contract_end must be a valid date');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createWorkerRecord(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-WKR-')
    ? idOrSequence
    : generateWorkerId(Number(idOrSequence) || Date.now());

  return {
    worker_id: id,
    name: String(data.name || '').trim(),
    passport_no: String(data.passport_no || '').trim(),
    nationality: String(data.nationality || 'Filipino').trim(),
    country: String(data.country || '').trim(),
    employer: String(data.employer || '').trim(),
    job_title: String(data.job_title || '').trim(),
    contract_start: data.contract_start || null,
    contract_end: data.contract_end || null,
    contact_number: String(data.contact_number || '').trim(),
    emergency_contact: String(data.emergency_contact || '').trim(),
    emergency_contact_number: String(data.emergency_contact_number || '').trim(),
    status: String(data.status || 'active').toLowerCase(),
    welfare_officer: String(data.welfare_officer || 'Unassigned').trim(),
    last_checkin: data.last_checkin || null,
    alerts: [],
    notes: String(data.notes || '').trim(),
    enrolledAt: now,
    updatedAt: now,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function recordCheckin(record, notes, checkedBy) {
  const now = new Date().toISOString();
  record.last_checkin = now;
  if (record.status === 'inactive') record.status = 'active';
  if (notes) record.notes = String(notes).trim();
  record.updatedAt = now;
  return {
    success: true,
    log: {
      id: generateLogId(),
      worker_id: record.worker_id,
      name: record.name,
      event: 'check-in',
      notes: notes || '',
      by: checkedBy || 'self',
      at: now,
    },
  };
}

function raiseAlert(record, alertType, message, raisedBy) {
  if (!ALERT_TYPES.includes(alertType)) {
    return { success: false, error: `alertType must be one of: ${ALERT_TYPES.join(', ')}` };
  }
  const now = new Date().toISOString();
  const alert = {
    id: generateLogId(),
    type: alertType,
    message: String(message || '').trim(),
    raisedBy: raisedBy || 'system',
    raisedAt: now,
    resolved: false,
    resolvedAt: null,
  };

  if (!record.alerts) record.alerts = [];
  record.alerts.push(alert);

  if (['emergency', 'distress_signal'].includes(alertType)) {
    record.status = 'distressed';
  }
  record.updatedAt = now;
  return { success: true, alert };
}

function resolveAlert(record, alertId, resolvedBy) {
  if (!record.alerts) return { success: false, error: 'No alerts found' };
  const alert = record.alerts.find(a => a.id === alertId);
  if (!alert) return { success: false, error: 'Alert not found' };
  alert.resolved = true;
  alert.resolvedAt = new Date().toISOString();
  alert.resolvedBy = resolvedBy || 'system';
  record.updatedAt = alert.resolvedAt;
  return { success: true };
}

function updateWorkerStatus(record, status, updatedBy) {
  const next = String(status || '').toLowerCase();
  if (!VALID_STATUSES.includes(next)) {
    return { success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }
  record.status = next;
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Computed Properties ──────────────────────────────────────────────────────

function daysSinceCheckin(record) {
  if (!record.last_checkin) return null;
  const diff = Date.now() - new Date(record.last_checkin).getTime();
  return Math.floor(diff / 86400000);
}

function isMissedCheckin(record) {
  if (record.status === 'repatriated' || record.status === 'deceased') return false;
  const days = daysSinceCheckin(record);
  if (days === null) return true; // Never checked in
  return days > CHECKIN_INTERVAL_DAYS;
}

function daysUntilContractEnd(record) {
  if (!record.contract_end) return null;
  const diff = new Date(record.contract_end).getTime() - Date.now();
  return Math.floor(diff / 86400000);
}

function hasActiveAlerts(record) {
  return Array.isArray(record.alerts) && record.alerts.some(a => !a.resolved);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(records) {
  const all = records || [];
  const byStatus = {};
  const byCountry = {};
  let missedCheckin = 0;
  let contractsEndingSoon = 0;
  let withAlerts = 0;

  VALID_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const r of all) {
    const s = String(r.status || 'active').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;

    const c = r.country || 'Others';
    byCountry[c] = (byCountry[c] || 0) + 1;

    if (isMissedCheckin(r)) missedCheckin++;

    const daysLeft = daysUntilContractEnd(r);
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 60) contractsEndingSoon++;

    if (hasActiveAlerts(r)) withAlerts++;
  }

  return { total: all.length, byStatus, byCountry, missedCheckin, contractsEndingSoon, withAlerts };
}

function filterWorkers(records, opts = {}) {
  let list = [...(records || [])].sort((a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0));

  if (opts.status) {
    const s = String(opts.status).toLowerCase();
    list = list.filter(r => String(r.status || '').toLowerCase() === s);
  }
  if (opts.country) {
    const c = String(opts.country).toLowerCase();
    list = list.filter(r => String(r.country || '').toLowerCase().includes(c));
  }
  if (opts.name) {
    const n = String(opts.name).toLowerCase();
    list = list.filter(r => String(r.name || '').toLowerCase().includes(n));
  }
  if (opts.missedCheckinOnly) list = list.filter(r => isMissedCheckin(r));
  if (opts.withAlertsOnly) list = list.filter(r => hasActiveAlerts(r));

  const lim = parseInt(opts.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);

  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Welfare & Monitoring',
  description: 'Track worker status abroad and communication logs for deployed workers.',
  validStatuses: VALID_STATUSES,
  validCountries: VALID_COUNTRIES,
  alertTypes: ALERT_TYPES,
  checkinIntervalDays: CHECKIN_INTERVAL_DAYS,
  // ID
  generateWorkerId,
  generateLogId,
  // Validation
  validateWorker,
  // Record lifecycle
  createWorkerRecord,
  recordCheckin,
  raiseAlert,
  resolveAlert,
  updateWorkerStatus,
  // Computed helpers
  daysSinceCheckin,
  isMissedCheckin,
  daysUntilContractEnd,
  hasActiveAlerts,
  // Analytics
  summary,
  filterWorkers,
};

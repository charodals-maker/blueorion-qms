// Module: Payment & Voucher
// Purpose: Record recruitment expenses, invoices, and voucher approvals.
// Voucher_ID format: BOR-VCH-YYYY-XXXX

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_VOUCHER_STATUSES = ['draft', 'submitted', 'under review', 'approved', 'paid', 'rejected', 'cancelled'];

const VALID_EXPENSE_CATEGORIES = [
  'Recruitment Advertising',
  'Job Fair Attendance',
  'Medical / PDOS Fee',
  'Documentation / Visa',
  'Training / Seminar',
  'Transportation',
  'Accommodation',
  'Communication',
  'Office Supplies',
  'Equipment / IT',
  'Government Fees (DMW, OWWA, etc.)',
  'Legal / Notarial',
  'Bank Charges',
  'Salary / Payroll',
  'Others',
];

const VALID_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'GCash', 'Maya', 'Check', 'Others'];

const VALID_CURRENCIES = ['PHP', 'USD', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'SGD', 'HKD', 'JPY'];

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateVoucherId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-VCH-${year}-${String(sequence).padStart(4, '0')}`;
}

function generateInvoiceId(sequence) {
  const year = new Date().getFullYear();
  return `BOR-INV-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateVoucher(data) {
  const errors = [];
  if (!data.payee || !String(data.payee).trim()) errors.push('payee is required');
  if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) errors.push('amount must be a positive number');
  if (data.category && !VALID_EXPENSE_CATEGORIES.includes(data.category)) errors.push(`category must be one of: ${VALID_EXPENSE_CATEGORIES.join(', ')}`);
  if (data.payment_method && !VALID_PAYMENT_METHODS.includes(data.payment_method)) errors.push(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  if (data.currency && !VALID_CURRENCIES.includes(data.currency)) errors.push(`currency must be one of: ${VALID_CURRENCIES.join(', ')}`);
  if (data.status && !VALID_VOUCHER_STATUSES.includes(String(data.status).toLowerCase())) errors.push(`status must be one of: ${VALID_VOUCHER_STATUSES.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

// ─── Record Builder ───────────────────────────────────────────────────────────

function createVoucher(data, idOrSequence) {
  const now = new Date().toISOString();
  const id = typeof idOrSequence === 'string' && idOrSequence.startsWith('BOR-VCH-')
    ? idOrSequence
    : generateVoucherId(Number(idOrSequence) || Date.now());

  return {
    voucher_id: id,
    payee: String(data.payee || '').trim(),
    description: String(data.description || '').trim(),
    category: data.category || 'Others',
    amount: parseFloat(data.amount) || 0,
    currency: data.currency || 'PHP',
    payment_method: data.payment_method || 'Cash',
    payment_date: data.payment_date || null,
    reference_no: String(data.reference_no || '').trim(),
    status: 'draft',
    submitted_by: String(data.submitted_by || '').trim(),
    reviewed_by: '',
    approved_by: '',
    rejection_reason: '',
    attachments: [],
    line_items: Array.isArray(data.line_items) ? data.line_items : [],
    notes: String(data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
}

// ─── State Transitions ────────────────────────────────────────────────────────

function submitVoucher(record, submittedBy) {
  if (record.status !== 'draft') return { success: false, error: 'Only draft vouchers can be submitted' };
  record.status = 'submitted';
  if (submittedBy) record.submitted_by = String(submittedBy).trim();
  record.submitted_at = new Date().toISOString();
  record.updatedAt = record.submitted_at;
  return { success: true };
}

function approveVoucher(record, approvedBy) {
  if (!['submitted', 'under review'].includes(record.status)) return { success: false, error: 'Voucher must be submitted or under review to approve' };
  record.status = 'approved';
  record.approved_by = String(approvedBy || '').trim();
  record.approved_at = new Date().toISOString();
  record.updatedAt = record.approved_at;
  return { success: true };
}

function rejectVoucher(record, rejectedBy, reason) {
  record.status = 'rejected';
  record.reviewed_by = String(rejectedBy || '').trim();
  record.rejection_reason = String(reason || '').trim();
  record.rejected_at = new Date().toISOString();
  record.updatedAt = record.rejected_at;
  return { success: true };
}

function markPaid(record, paymentDate, referenceNo, paidBy) {
  if (record.status !== 'approved') return { success: false, error: 'Only approved vouchers can be marked as paid' };
  record.status = 'paid';
  record.payment_date = paymentDate || new Date().toISOString().split('T')[0];
  if (referenceNo) record.reference_no = String(referenceNo).trim();
  if (paidBy) record.paid_by = String(paidBy).trim();
  record.paidAt = new Date().toISOString();
  record.updatedAt = record.paidAt;
  return { success: true };
}

function updateVoucherStatus(record, status, note) {
  const next = String(status || '').toLowerCase();
  if (!VALID_VOUCHER_STATUSES.includes(next)) return { success: false, error: `status must be one of: ${VALID_VOUCHER_STATUSES.join(', ')}` };
  record.status = next;
  if (note) record.notes = String(note).trim();
  record.updatedAt = new Date().toISOString();
  return { success: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function summary(vouchers) {
  const all = vouchers || [];
  const byStatus = {};
  const byCategory = {};
  let totalPaid = 0;
  let totalPending = 0;

  VALID_VOUCHER_STATUSES.forEach(s => { byStatus[s] = 0; });

  for (const v of all) {
    const s = String(v.status || 'draft').toLowerCase();
    if (byStatus[s] !== undefined) byStatus[s]++;
    const c = v.category || 'Others';
    byCategory[c] = (byCategory[c] || 0) + 1;
    const amt = parseFloat(v.amount) || 0;
    if (v.status === 'paid') totalPaid += amt;
    if (['submitted', 'under review', 'approved'].includes(v.status)) totalPending += amt;
  }

  return {
    total: all.length,
    byStatus,
    byCategory,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    totalPending: parseFloat(totalPending.toFixed(2)),
  };
}

function filterVouchers(records, opts) {
  const o = opts || {};
  let list = [...(records || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (o.status) { const s = String(o.status).toLowerCase(); list = list.filter(r => String(r.status || '').toLowerCase() === s); }
  if (o.category) { const c = String(o.category).toLowerCase(); list = list.filter(r => String(r.category || '').toLowerCase().includes(c)); }
  if (o.payee) { const p = String(o.payee).toLowerCase(); list = list.filter(r => String(r.payee || '').toLowerCase().includes(p)); }
  if (o.submitted_by) { const sb = String(o.submitted_by).toLowerCase(); list = list.filter(r => String(r.submitted_by || '').toLowerCase().includes(sb)); }
  if (o.from_date) { const fd = new Date(o.from_date); list = list.filter(r => new Date(r.createdAt) >= fd); }
  if (o.to_date) { const td = new Date(o.to_date); list = list.filter(r => new Date(r.createdAt) <= td); }

  const lim = parseInt(o.limit, 10);
  if (!isNaN(lim) && lim > 0) list = list.slice(0, lim);
  return list;
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'Payment & Voucher',
  description: 'Record recruitment-related payments and vouchers for financial tracking.',
  validVoucherStatuses: VALID_VOUCHER_STATUSES,
  validExpenseCategories: VALID_EXPENSE_CATEGORIES,
  validPaymentMethods: VALID_PAYMENT_METHODS,
  validCurrencies: VALID_CURRENCIES,
  generateVoucherId,
  generateInvoiceId,
  validateVoucher,
  createVoucher,
  submitVoucher,
  approveVoucher,
  rejectVoucher,
  markPaid,
  updateVoucherStatus,
  summary,
  filterVouchers,
};
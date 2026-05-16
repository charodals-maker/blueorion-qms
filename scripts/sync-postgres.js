#!/usr/bin/env node
/**
 * Sync local JSON stores and structured admin/sourcing data into PostgreSQL.
 *
 * Usage:
 *   node scripts/sync-postgres.js
 *   npm run sync:postgres
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pgStore = require('../modules/pg-store');

const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function permissionsForRole(role) {
  const normalized = String(role || '').toLowerCase();
  const base = {
    canApprove: false,
    canReject: false,
    canAssignCV: false,
    canViewAudit: true,
    canExport: false,
    canManageAdmins: false,
    canDeleteSubmissions: false,
  };

  if (['president', 'admin'].includes(normalized)) {
    return {
      canApprove: true,
      canReject: true,
      canAssignCV: true,
      canViewAudit: true,
      canExport: true,
      canManageAdmins: true,
      canDeleteSubmissions: true,
    };
  }

  if (normalized === 'qmr') {
    return { ...base, canApprove: true, canReject: true, canAssignCV: true, canExport: true };
  }

  if (['manager', 'document_controller', 'accounting'].includes(normalized)) {
    return { ...base, canAssignCV: true, canExport: true };
  }

  return base;
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[sync-postgres] Skipping ${path.basename(filePath)}: ${error.message}`);
    return fallback;
  }
}

function listTopLevelJsonFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(name => name.toLowerCase().endsWith('.json'))
      .map(name => path.join(dirPath, name));
  } catch {
    return [];
  }
}

async function syncKvStores() {
  const jsonFiles = listTopLevelJsonFiles(dataDir);
  let saved = 0;

  for (const filePath of jsonFiles) {
    const filename = path.basename(filePath);
    const data = loadJson(filePath, null);
    if (data === null) continue;
    await pgStore.save(filename, data);
    saved += 1;
  }

  return saved;
}

async function syncAdminUsers() {
  const users = [
    { username: 'admin', password: hashPassword('Blue@Admin2026!Secure'), role: 'admin' },
    { username: 'finance.accounting', password: hashPassword('Blue@Accounting2026'), role: 'accounting' },
    { username: 'blueorion.sg', password: hashPassword('Blue@2026!S'), role: 'document_controller' },
    { username: 'charo', password: hashPassword('president2026'), role: 'president' },
    { username: 'president.blueorion', password: hashPassword('Blue@President2026'), role: 'president' },
    { username: 'manager.operations', password: hashPassword('Blue@Manager2026'), role: 'manager' },
    { username: 'blueorion_staff01', password: hashPassword('BS2026!'), role: 'encoder' },
    { username: 'staff1', password: hashPassword('BlueStaff1!'), role: 'encoder' },
    { username: 'staff2', password: hashPassword('BlueStaff2!'), role: 'encoder' },
    { username: 'staff3', password: hashPassword('BlueStaff3!'), role: 'encoder' },
    { username: 'staff4', password: hashPassword('BlueStaff4!'), role: 'encoder' },
    { username: 'staff5', password: hashPassword('BlueStaff5!'), role: 'encoder' },
    { username: 'rendel', password: hashPassword('BlueRendel2026!'), role: 'document_controller' },
    { username: 'welfare.officer', password: hashPassword('Blue@Welfare2026'), role: 'welfare_officer' },
    { username: 'lyndie', password: hashPassword('Blue@QMR2026'), role: 'qmr' },
    { username: 'lyndie.jamias', password: hashPassword('Blue@QMR2026'), role: 'qmr' },
    { username: 'genevieve', password: hashPassword('Blue@DocCtrl2026'), role: 'document_controller' },
    { username: 'genevieve.caro', password: hashPassword('Blue@DocCtrl2026'), role: 'document_controller' },
    { username: 'emmanuel', password: hashPassword('Blue@DPO2026'), role: 'dpo' },
    { username: 'eman', password: hashPassword('Blue@DPO2026'), role: 'dpo' },
    { username: 'jenny', password: hashPassword('BlueJenny2026!'), role: 'encoder' },
    { username: 'shekai', password: hashPassword('BlueShekai2026!'), role: 'encoder' },
    { username: 'applicant1', password: hashPassword('Applicant@2026'), role: 'applicant', allowedModules: ['complaint-grievance', 'sourcing-selection', 'welfare-monitoring'] },
  ];

  let synced = 0;
  for (const user of users) {
    await pgStore.query(
      `INSERT INTO admin_users (
         username, email, password_hash, role, permissions, is_active, created_by, last_login
       ) VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, $6, $7)
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         permissions = EXCLUDED.permissions,
         is_active = TRUE,
         created_by = EXCLUDED.created_by,
         last_login = EXCLUDED.last_login`,
      [
        user.username,
        null,
        user.password,
        user.role,
        JSON.stringify(permissionsForRole(user.role)),
        'sync-postgres',
        null,
      ]
    );
    synced += 1;
  }
  return synced;
}

async function syncSourcingTables() {
  const leads = loadJson(path.join(dataDir, 'sourcing_leads.json'), []);
  const scorecards = loadJson(path.join(dataDir, 'sourcing_scorecards.json'), {});
  const docAuth = loadJson(path.join(dataDir, 'sourcing_doc_auth.json'), {});

  let leadCount = 0;
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = String(lead?.id || lead?._id || '').trim();
    if (!id) continue;

    await pgStore.query(
      `INSERT INTO sourcing_leads (
         id, candidate_name, email, contact_number, job_interest, positions, country,
         source, status, submitted_at, cv_file, notes, raw_record, created_by, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, NOW())
       ON CONFLICT (id) DO UPDATE SET
         candidate_name = EXCLUDED.candidate_name,
         email = EXCLUDED.email,
         contact_number = EXCLUDED.contact_number,
         job_interest = EXCLUDED.job_interest,
         positions = EXCLUDED.positions,
         country = EXCLUDED.country,
         source = EXCLUDED.source,
         status = EXCLUDED.status,
         submitted_at = EXCLUDED.submitted_at,
         cv_file = EXCLUDED.cv_file,
         notes = EXCLUDED.notes,
         raw_record = EXCLUDED.raw_record,
         created_by = COALESCE(EXCLUDED.created_by, created_by),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        id,
        String(lead.candidateName || lead.name || '').trim() || null,
        String(lead.email || '').trim() || null,
        String(lead.contactNumber || '').trim() || null,
        String(lead.jobInterest || '').trim() || null,
        JSON.stringify(Array.isArray(lead.positions) ? lead.positions : []),
        String(lead.country || '').trim() || null,
        String(lead.source || 'sourcing').trim() || 'sourcing',
        String(lead.status || 'new').trim() || 'new',
        lead.submittedAt || lead.createdAt || null,
        String(lead.cvFile || '').trim() || null,
        String(lead.notes || '').trim() || null,
        JSON.stringify(lead || {}),
        String(lead.createdBy || lead.created_by || 'sync-postgres').trim() || 'sync-postgres',
        String(lead.updatedBy || lead.updated_by || lead.createdBy || lead.created_by || 'sync-postgres').trim() || 'sync-postgres',
      ]
    );
    leadCount += 1;
  }

  let scorecardCount = 0;
  for (const [leadId, scorecard] of Object.entries(scorecards || {})) {
    const total = [scorecard?.tech, scorecard?.exp, scorecard?.soft]
      .map(v => Number(v))
      .every(v => Number.isFinite(v))
      ? Number(scorecard.tech) + Number(scorecard.exp) + Number(scorecard.soft)
      : null;

    await pgStore.query(
      `INSERT INTO sourcing_scorecards (
         lead_id, tech, exp, soft, compliance, total, raw_record, created_by, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW())
       ON CONFLICT (lead_id) DO UPDATE SET
         tech = EXCLUDED.tech,
         exp = EXCLUDED.exp,
         soft = EXCLUDED.soft,
         compliance = EXCLUDED.compliance,
         total = EXCLUDED.total,
         raw_record = EXCLUDED.raw_record,
         created_by = COALESCE(EXCLUDED.created_by, created_by),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        String(leadId || '').trim(),
        Number(scorecard?.tech) || null,
        Number(scorecard?.exp) || null,
        Number(scorecard?.soft) || null,
        String(scorecard?.compliance || '').trim() || null,
        total,
        JSON.stringify(scorecard || {}),
        String(scorecard?.createdBy || scorecard?.updatedBy || 'sync-postgres').trim() || 'sync-postgres',
        String(scorecard?.updatedBy || scorecard?.createdBy || 'sync-postgres').trim() || 'sync-postgres',
      ]
    );
    scorecardCount += 1;
  }

  let docAuthCount = 0;
  for (const [leadId, value] of Object.entries(docAuth || {})) {
    await pgStore.query(
      `INSERT INTO sourcing_doc_auth (
         lead_id, passed, raw_record, created_by, updated_by, updated_at
       ) VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
       ON CONFLICT (lead_id) DO UPDATE SET
         passed = EXCLUDED.passed,
         raw_record = EXCLUDED.raw_record,
         created_by = COALESCE(EXCLUDED.created_by, created_by),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        String(leadId || '').trim(),
        !!value?.passed,
        JSON.stringify(value || {}),
        String(value?.createdBy || value?.updatedBy || 'sync-postgres').trim() || 'sync-postgres',
        String(value?.updatedBy || value?.createdBy || 'sync-postgres').trim() || 'sync-postgres',
      ]
    );
    docAuthCount += 1;
  }

  return { leadCount, scorecardCount, docAuthCount };
}

async function main() {
  console.log('[sync-postgres] Connecting to PostgreSQL...');
  const connected = await pgStore.connect();
  if (!connected || !pgStore.ready) {
    console.error('[sync-postgres] DATABASE_URL is missing or the connection failed.');
    process.exitCode = 1;
    return;
  }

  console.log('[sync-postgres] Syncing flat-file stores into kv_stores...');
  const kvCount = await syncKvStores();

  console.log('[sync-postgres] Syncing admin account registry...');
  const adminCount = await syncAdminUsers();

  console.log('[sync-postgres] Syncing sourcing records...');
  const sourcingCounts = await syncSourcingTables();

  console.log('[sync-postgres] Sync complete.');
  console.log(`  - kv_stores files synced: ${kvCount}`);
  console.log(`  - admin accounts synced: ${adminCount}`);
  console.log(`  - sourcing leads synced: ${sourcingCounts.leadCount}`);
  console.log(`  - scorecards synced: ${sourcingCounts.scorecardCount}`);
  console.log(`  - document auth checks synced: ${sourcingCounts.docAuthCount}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[sync-postgres] Failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
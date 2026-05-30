# Save and Backup System Status - Implementation Package
Date: 2026-05-19
Priority: High
Owner: QMR + Document Controller + Engineering

## 0) Scope and Current Constraint
This workspace currently contains only QMS runbooks and evidence files, not the application source code.
Because source files are not mounted here, direct UI/backend code edits cannot be applied in this environment.
This package provides exact implementation logic for immediate developer application in the real repository.

## 1) Feature Objective
Add a high-visibility manual button to the top header of four dashboard families:
- Management and Audit
- Contracts and Selection
- Sourcing and Profiles
- FRA System and Welfare

Button label:
Save and Backup System Status

On click, system must perform:
- Action A: Commit pending updates from current screen to PostgreSQL (pg-store).
- Action B: Trigger lifecycle-backup to write manual JSON snapshot.

Manual snapshot target:
- Directory: /var/data/backups/
- Filename format: manual_snapshot_YYYY-MM-DD_HHMM.json
  - Example: manual_snapshot_2026-05-19_1430.json

Success message:
- "✓ QMS Status Secured. Manual backup snapshot written successfully to persistent storage."

## 2) Backend Contract (Required)

### 2.1 New endpoint
Method: POST
Path: /api/system/manual-save-backup
Auth: Roles allowed = qmr, document_controller, admin

Request body:
```json
{
  "module": "management_audit",
  "screen": "audit_checklist",
  "savePayload": {
    "...": "current form payload"
  },
  "reason": "Manual compliance freeze"
}
```

Response (success):
```json
{
  "success": true,
  "message": "QMS Status Secured. Manual backup snapshot written successfully to persistent storage.",
  "data": {
    "dbCommit": "ok",
    "snapshotPath": "/var/data/backups/manual_snapshot_2026-05-19_1430.json",
    "snapshotFile": "manual_snapshot_2026-05-19_1430.json",
    "module": "management_audit",
    "timestamp": "2026-05-19T06:30:00.000Z"
  }
}
```

Response (failure):
```json
{
  "success": false,
  "message": "Manual save and backup failed",
  "error": "detailed reason"
}
```

### 2.2 Server-side flow
1. Validate role and request fields.
2. Start DB transaction.
3. Apply module-specific save handler (write pending form updates to pg-store).
4. Commit transaction.
5. Build snapshot filename:
   - Use server local time intended for operations (PHT if required by policy).
   - Pattern manual_snapshot_YYYY-MM-DD_HHMM.json
6. Invoke lifecycle-backup writer with explicit manual mode.
7. Force output path to /var/data/backups/.
8. Write immutable audit log entry with:
   - userId
   - role
   - module
   - snapshot path
   - timestamp
   - outcome
9. Return success payload.

### 2.3 Idempotency and lock
To avoid rapid double-click duplicates:
- Add per-user 10-second lock key for this endpoint.
- If lock active, return HTTP 429 with message "Backup already in progress".

### 2.4 Pseudocode (Express style)
```javascript
router.post('/api/system/manual-save-backup', requireAuth, requireRole(['qmr','document_controller','admin']), async (req, res) => {
  const { module, screen, savePayload, reason } = req.body || {};
  const user = req.user;

  if (!module || !savePayload) {
    return res.status(400).json({ success: false, message: 'Missing module or savePayload' });
  }

  const lockKey = `manual_backup:${user.id}`;
  if (!(await backupLock.acquire(lockKey, 10000))) {
    return res.status(429).json({ success: false, message: 'Backup already in progress' });
  }

  let tx;
  try {
    tx = await pgStore.beginTransaction();

    await saveModuleState({ module, screen, payload: savePayload, user, tx });
    await pgStore.commit(tx);

    const now = new Date();
    const file = formatManualSnapshotName(now); // manual_snapshot_YYYY-MM-DD_HHMM.json
    const outPath = `/var/data/backups/${file}`;

    await lifecycleBackup.writeManualSnapshot({ module, userId: user.id, reason, outPath });

    await auditLog.write({
      event: 'manual_save_backup',
      userId: user.id,
      role: user.role,
      module,
      snapshotPath: outPath,
      outcome: 'success',
      timestamp: now.toISOString()
    });

    return res.json({
      success: true,
      message: 'QMS Status Secured. Manual backup snapshot written successfully to persistent storage.',
      data: {
        dbCommit: 'ok',
        snapshotPath: outPath,
        snapshotFile: file,
        module,
        timestamp: now.toISOString()
      }
    });
  } catch (err) {
    if (tx) await pgStore.rollback(tx);
    await auditLog.write({
      event: 'manual_save_backup',
      userId: user?.id,
      role: user?.role,
      module,
      outcome: 'failed',
      error: String(err)
    });
    return res.status(500).json({ success: false, message: 'Manual save and backup failed', error: String(err.message || err) });
  } finally {
    await backupLock.release(lockKey);
  }
});
```

## 3) Frontend Integration Pattern

### 3.1 Header button placement
Insert the same CTA in each target dashboard header section, right-aligned, high contrast.

Accessibility attributes:
- type="button"
- aria-label="Save and Backup System Status"
- disabled during request

### 3.2 Click handler behavior
1. Disable button and show spinner state "Securing...".
2. Execute existing screen save routine (current form flush).
3. POST /api/system/manual-save-backup with module + current payload.
4. On success, show green toast with exact success message.
5. On failure, show red toast with operator-friendly error and preserve unsaved form state.
6. Re-enable button.

### 3.3 Frontend pseudocode
```javascript
async function onSaveBackupClick(context) {
  const btn = context.button;
  try {
    btn.disabled = true;
    setButtonText(btn, 'Securing...');

    const payload = await flushCurrentScreenToPayload(context); // Action A prep

    const res = await fetch('/api/system/manual-save-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: context.module,
        screen: context.screen,
        savePayload: payload,
        reason: 'Manual compliance freeze'
      })
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Manual backup failed');

    showToast('success', '✓ QMS Status Secured. Manual backup snapshot written successfully to persistent storage.');
    showSubnote(`Snapshot: ${json.data.snapshotFile}`);
  } catch (e) {
    showToast('error', `Manual save and backup failed: ${e.message}`);
  } finally {
    btn.disabled = false;
    setButtonText(btn, 'Save and Backup System Status');
  }
}
```

## 4) Module Map (UI wiring)
Use these internal module keys in request body:
- Management and Audit -> management_audit
- Contracts and Selection -> contracts_selection
- Sourcing and Profiles -> sourcing_profiles
- FRA System and Welfare -> fra_welfare

## 5) File System and Ops Rules
- Ensure /var/data/backups exists on startup; create if missing.
- Do not write manual snapshots to local Windows paths.
- Keep ownership and permissions writable by app runtime user.
- Keep automated nightly backups unchanged; this is an additional on-demand snapshot path.

## 6) Sandbox Test Script (must pass before production)

Test case 1: Success path
- Open each of the four dashboard families.
- Change one non-critical field.
- Click Save and Backup System Status.
- Expected: success toast appears and response includes snapshotPath under /var/data/backups/.

Test case 2: DB commit verification
- Refresh page and verify edited field persisted in PostgreSQL.

Test case 3: Snapshot verification
- Check Render logs for line:
  [lifecycle-backup] manual backup written: /var/data/backups/manual_snapshot_YYYY-MM-DD_HHMM.json

Test case 4: Rapid click protection
- Double click button quickly.
- Expected: only one snapshot written; second request returns controlled message.

Test case 5: Role enforcement
- Log in as view-only staff.
- Expected: button hidden or disabled, API returns 403 if called directly.

## 7) Acceptance Criteria
- Button visible on all four target dashboard families.
- Action A commits current screen pending updates to pg-store.
- Action B writes manual snapshot to /var/data/backups/ with required naming format.
- Success toast text matches required copy exactly.
- Audit entry created for each attempt (success/fail).
- Sandbox tests pass before production rollout.

## 8) Release Checklist
- [ ] Feature branch merged after code review.
- [ ] Sandbox UAT approved by Document Controller and QMR.
- [ ] Production deploy completed.
- [ ] Post-deploy log verification completed.
- [ ] One manual backup executed in production and archived as evidence.

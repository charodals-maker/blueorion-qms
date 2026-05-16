/**
 * applicant-lifecycle.js — BORSC Applicant Lifecycle Tracking API
 *
 * Provides endpoints and helpers for tracking applicants through the 4 pillars:
 * 1. TESDA certifications
 * 2. OWWA membership
 * 3. Medical clearance
 * 4. Visa/System Code tracking
 *
 * All operations are logged to audit_logs for ISO 9001 traceability.
 */

'use strict';

module.exports = function setupApplicantLifecycle(app, pgStore, { requireStaffAuth }) {
  const schema = pgStore.getSchema();
  
  if (!schema) {
    console.warn('[applicant-lifecycle] Database schema not available — skipping lifecycle endpoints.');
    return;
  }

  // ═════════════════════════════════════════════════════════════════
  // PILLAR 1: TESDA CERTIFICATION TRACKING
  // ═════════════════════════════════════════════════════════════════

  app.post('/api/applicant/:applicantId/tesda', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const { courseName, nciiNumber, issuanceDate, expiryDate } = req.body;

      const result = await pgStore.query(
        `INSERT INTO tesda_records (applicant_id, course_name, ncii_number, issuance_date, expiry_date, status, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, 'valid', $6)
         RETURNING *`,
        [applicantId, courseName, nciiNumber, issuanceDate, expiryDate, req.user?.username || 'system']
      );

      await schema.logAudit(
        applicantId,
        'tesda_records',
        'INSERT',
        null,
        result.rows[0],
        req.user?.username,
        { reason: 'Added TESDA certification' }
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[applicant-lifecycle] POST /tesda error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applicant/:applicantId/tesda', async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        'SELECT * FROM tesda_records WHERE applicant_id = $1 ORDER BY created_at DESC',
        [applicantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // PILLAR 2: OWWA MEMBERSHIP TRACKING
  // ═════════════════════════════════════════════════════════════════

  app.post('/api/applicant/:applicantId/owwa', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const { membershipStatus, pdosCompleted, pdosDate, certificateUrl } = req.body;

      const result = await pgStore.query(
        `INSERT INTO owwa_records (applicant_id, membership_status, pdos_completed, pdos_date, certificate_url, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $2, $6)
         RETURNING *`,
        [applicantId, membershipStatus, pdosCompleted, pdosDate, certificateUrl, req.user?.username || 'system']
      );

      await schema.logAudit(
        applicantId,
        'owwa_records',
        'INSERT',
        null,
        result.rows[0],
        req.user?.username,
        { reason: 'Added OWWA membership record' }
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[applicant-lifecycle] POST /owwa error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applicant/:applicantId/owwa', async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        'SELECT * FROM owwa_records WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [applicantId]
      );
      res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // PILLAR 3: MEDICAL CLEARANCE TRACKING
  // ═════════════════════════════════════════════════════════════════

  app.post('/api/applicant/:applicantId/medical', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const { clinicName, referralDate, examDate, fitStatus, medicalNotes, followUpDate } = req.body;

      const result = await pgStore.query(
        `INSERT INTO medical_records (applicant_id, clinic_name, referral_date, exam_date, fit_status, medical_notes, follow_up_date, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $8)
         RETURNING *`,
        [applicantId, clinicName, referralDate, examDate, fitStatus, medicalNotes, followUpDate, req.user?.username || 'system']
      );

      await schema.logAudit(
        applicantId,
        'medical_records',
        'INSERT',
        null,
        result.rows[0],
        req.user?.username,
        { reason: `Medical status: ${fitStatus}` }
      );

      // If medical is pending for more than 3 days, an alert will be auto-created
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[applicant-lifecycle] POST /medical error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applicant/:applicantId/medical', async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        'SELECT * FROM medical_records WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [applicantId]
      );
      res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/applicant/:applicantId/medical-status', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const fitStatusRaw = String(req.body?.fitStatus || '').trim().toLowerCase();
      const medicalNotes = String(req.body?.medicalNotes || '').trim();
      const allowed = ['pending', 'fit', 'cleared', 'unfit', 'for follow-up'];

      if (!fitStatusRaw || !allowed.includes(fitStatusRaw)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid fitStatus. Allowed: pending, fit, cleared, unfit, for follow-up',
        });
      }

      const latestRes = await pgStore.query(
        'SELECT * FROM medical_records WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [applicantId]
      );

      const fitStatus = fitStatusRaw;
      const updatedBy = req.user?.username || 'system';

      if (latestRes.rows.length) {
        const previous = latestRes.rows[0];
        const updatedRes = await pgStore.query(
          `UPDATE medical_records
           SET fit_status = $1,
               status = $1,
               medical_notes = CASE WHEN $2 = '' THEN medical_notes ELSE $2 END,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [fitStatus, medicalNotes, previous.id]
        );

        await schema.logAudit(
          applicantId,
          'medical_records',
          'UPDATE',
          previous,
          updatedRes.rows[0],
          updatedBy,
          { reason: `Quick medical status update: ${previous.fit_status || 'unknown'} -> ${fitStatus}` }
        );

        return res.json({ success: true, data: updatedRes.rows[0] });
      }

      const insertedRes = await pgStore.query(
        `INSERT INTO medical_records (applicant_id, fit_status, status, medical_notes, created_by)
         VALUES ($1, $2, $2, $3, $4)
         RETURNING *`,
        [applicantId, fitStatus, medicalNotes, updatedBy]
      );

      await schema.logAudit(
        applicantId,
        'medical_records',
        'INSERT',
        null,
        insertedRes.rows[0],
        updatedBy,
        { reason: `Quick medical status update: created initial status ${fitStatus}` }
      );

      return res.json({ success: true, data: insertedRes.rows[0] });
    } catch (err) {
      console.error('[applicant-lifecycle] PATCH /medical-status error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // PILLAR 4: VISA & DEPLOYMENT TRACKING
  // ═════════════════════════════════════════════════════════════════

  app.post('/api/applicant/:applicantId/visa', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const { visaRefNumber, stampingDate, flightNumber, airline, departureDate, arrivalDate, employerName } = req.body;

      const result = await pgStore.query(
        `INSERT INTO visa_tracking (applicant_id, visa_ref_number, stamping_date, flight_number, airline, departure_date, arrival_date, employer_name, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)
         RETURNING *`,
        [applicantId, visaRefNumber, stampingDate, flightNumber, airline, departureDate, arrivalDate, employerName, req.user?.username || 'system']
      );

      await schema.logAudit(
        applicantId,
        'visa_tracking',
        'INSERT',
        null,
        result.rows[0],
        req.user?.username,
        { reason: `Visa scheduled — Flight ${flightNumber}, departure ${departureDate}` }
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[applicant-lifecycle] POST /visa error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applicant/:applicantId/visa', async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        'SELECT * FROM visa_tracking WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [applicantId]
      );
      res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // FULL APPLICANT LIFECYCLE VIEW
  // ═════════════════════════════════════════════════════════════════

  app.get('/api/applicant/:applicantId/full-profile', async (req, res) => {
    try {
      const { applicantId } = req.params;

      // Get all 4 pillars in parallel
      const [appRes, tesRes, owRes, medRes, visRes, docRes, alertRes] = await Promise.all([
        pgStore.query('SELECT * FROM applicants WHERE id = $1', [applicantId]),
        pgStore.query('SELECT * FROM tesda_records WHERE applicant_id = $1 ORDER BY created_at DESC', [applicantId]),
        pgStore.query('SELECT * FROM owwa_records WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1', [applicantId]),
        pgStore.query('SELECT * FROM medical_records WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1', [applicantId]),
        pgStore.query('SELECT * FROM visa_tracking WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1', [applicantId]),
        pgStore.query('SELECT * FROM documents WHERE applicant_id = $1 ORDER BY created_at DESC', [applicantId]),
        pgStore.query('SELECT * FROM system_alerts WHERE applicant_id = $1 AND resolved = FALSE ORDER BY created_at DESC', [applicantId]),
      ]);

      if (!appRes.rows.length) {
        return res.status(404).json({ success: false, error: 'Applicant not found' });
      }

      res.json({
        success: true,
        data: {
          applicant: appRes.rows[0],
          tesda: tesRes.rows,
          owwa: owRes.rows[0] || null,
          medical: medRes.rows[0] || null,
          visa: visRes.rows[0] || null,
          documents: docRes.rows,
          activeAlerts: alertRes.rows,
        },
      });
    } catch (err) {
      console.error('[applicant-lifecycle] GET /full-profile error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // AUDIT TRAIL & ALERTS
  // ═════════════════════════════════════════════════════════════════

  app.get('/api/applicant/:applicantId/audit-trail', requireStaffAuth, async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        `SELECT * FROM audit_logs WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [applicantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/applicant/:applicantId/alerts', async (req, res) => {
    try {
      const { applicantId } = req.params;
      const result = await pgStore.query(
        `SELECT * FROM system_alerts WHERE applicant_id = $1 ORDER BY created_at DESC`,
        [applicantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/alert/:alertId/resolve', requireStaffAuth, async (req, res) => {
    try {
      const { alertId } = req.params;
      await schema.resolveAlert(alertId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log('[applicant-lifecycle] Lifecycle tracking endpoints registered.');
};

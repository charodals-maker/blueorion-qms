// Admin Monitoring Panel - End-to-End Test
const http = require('http');
const ADMIN_DELETE_CODE = process.env.ADMIN_DELETE_SECRET_CODE || '027679';

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) { r.write(body); }
    r.end();
  });
}

function post(path, body, cookie) {
  const json = JSON.stringify(body);
  return req({
    hostname: 'localhost', port: 3000, path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json), ...(cookie ? { Cookie: cookie } : {}) }
  }, json);
}

function get(path, cookie) {
  return req({
    hostname: 'localhost', port: 3000, path, method: 'GET',
    headers: { ...(cookie ? { Cookie: cookie } : {}) }
  });
}

function del(path, cookie, extraHeaders = {}) {
  return req({
    hostname: 'localhost', port: 3000, path, method: 'DELETE',
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }
  });
}

function getCookie(res) {
  const raw = res.headers['set-cookie'] || [];
  return raw.map(c => c.split(';')[0]).join('; ');
}

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { console.log(`  ✅ PASS: ${label}`); pass++; }
  else { console.log(`  ❌ FAIL: ${label} — ${detail}`); fail++; }
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  BLUEORION Admin Monitoring Panel — Test Suite');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 1. LOGIN AS PRESIDENT ──────────────────────────────────────────────────
  console.log('[ 1 ] Login Tests');
  const r1 = await post('/api/login', { username: 'charo', password: 'president2026' });
  check('President login 200', r1.status === 200, `got ${r1.status}`);
  check('President role = president', r1.body.data?.role === 'president', r1.body.data?.role);
  const adminCookie = getCookie(r1);
  check('Session cookie set', adminCookie.includes('blueorion_session'), adminCookie);

  const r1b = await post('/api/login', { username: 'blueorion_staff01', password: 'BlueorionStart2026!' });
  check('Staff login 200', r1b.status === 200, `got ${r1b.status}`);
  const staffCookie = getCookie(r1b);

  // ── 2. ADMIN API ACCESS ────────────────────────────────────────────────────
  console.log('\n[ 2 ] Admin API Access');
  const r2 = await get('/api/admin/monitoring-summary', adminCookie);
  check('Admin can GET /monitoring-summary', r2.status === 200, `got ${r2.status}`);
  check('Summary has pending field', typeof r2.body.data?.pending === 'number', JSON.stringify(r2.body.data));

  const r3 = await get('/api/admin/staff-submissions', adminCookie);
  check('Admin can GET /staff-submissions', r3.status === 200, `got ${r3.status}`);
  check('Submissions is array', Array.isArray(r3.body.data), typeof r3.body.data);
  const initialCount = r3.body.data.length;

  const r4 = await get('/api/admin/staff-activity', adminCookie);
  check('Admin can GET /staff-activity', r4.status === 200, `got ${r4.status}`);

  const r5 = await get('/api/audit-logs?limit=5', adminCookie);
  check('Admin can GET /audit-logs', r5.status === 200, `got ${r5.status}`);
  check('Audit logs is array', Array.isArray(r5.body.data), typeof r5.body.data);

  // ── 3. ACCESS CONTROL ──────────────────────────────────────────────────────
  console.log('\n[ 3 ] Access Control');
  const r6 = await get('/api/admin/staff-submissions', staffCookie);
  check('Staff BLOCKED from /staff-submissions (403)', r6.status === 403, `got ${r6.status}`);

  const r6b = await get('/api/admin/monitoring-summary', staffCookie);
  check('Staff BLOCKED from /monitoring-summary (403)', r6b.status === 403, `got ${r6b.status}`);

  const r6c = await get('/api/admin/staff-submissions'); // no cookie
  check('Unauthenticated BLOCKED (401)', r6c.status === 401, `got ${r6c.status}`);

  // ── 4. STAFF SUBMIT WORK ───────────────────────────────────────────────────
  console.log('\n[ 4 ] Staff Submit Work');
  const workPayload = {
    title: 'CV Processing - Test Entry',
    module: 'Recruitment',
    description: 'Processed and reviewed 8 new applicant CVs. Verified POEA docs and scheduled interviews for next week.'
  };
  const r7 = await post('/api/staff/submit-work', workPayload, staffCookie);
  check('Staff can POST /submit-work (201)', r7.status === 201, `got ${r7.status}`);
  check('Submission id starts with WRK-', r7.body.data?.id?.startsWith('WRK-'), r7.body.data?.id);
  check('Submission status = pending', r7.body.data?.status === 'pending', r7.body.data?.status);
  check('Submission staff = blueorion_staff01', r7.body.data?.staff === 'blueorion_staff01', r7.body.data?.staff);
  const submissionId = r7.body.data?.id;

  // Staff sees own submission
  const r8 = await get('/api/staff/my-submissions', staffCookie);
  check('Staff can GET /my-submissions', r8.status === 200, `got ${r8.status}`);
  check('Own submission appears in list', r8.body.data?.some(s => s.id === submissionId), 'not found');

  // ── 5. ADMIN SEES NEW SUBMISSION ───────────────────────────────────────────
  console.log('\n[ 5 ] Admin Reviews Submission');
  const r9 = await get('/api/admin/staff-submissions', adminCookie);
  check('Admin sees new submission', r9.body.data?.length > initialCount, `count: ${r9.body.data?.length}`);

  // Filter by status
  const r9b = await get('/api/admin/staff-submissions?status=pending', adminCookie);
  check('Filter by status=pending works', r9b.body.data?.every(s => s.status === 'pending'), 'non-pending found');

  // Filter by staff
  const r9c = await get('/api/admin/staff-submissions?staff=blueorion', adminCookie);
  check('Filter by staff name works', r9c.body.data?.length > 0, '0 results');

  // ── 6. APPROVE SUBMISSION ──────────────────────────────────────────────────
  console.log('\n[ 6 ] Approve / Reject');
  const r10 = await post(`/api/admin/review-submission/${submissionId}`, { status: 'approved', adminNote: 'Great work! All documents verified.' }, adminCookie);
  check('Admin can approve submission (200)', r10.status === 200, `got ${r10.status}`);
  check('Status updated to approved', r10.body.data?.status === 'approved', r10.body.data?.status);
  check('reviewedBy = charo', r10.body.data?.reviewedBy === 'charo', r10.body.data?.reviewedBy);
  check('adminNote saved', r10.body.data?.adminNote?.includes('Great work'), r10.body.data?.adminNote);

  // Submit another and reject
  const r11 = await post('/api/staff/submit-work', { title: 'Second test', module: 'Welfare', description: 'Follow up on OFW welfare case #123' }, staffCookie);
  const id2 = r11.body.data?.id;
  const r12 = await post(`/api/admin/review-submission/${id2}`, { status: 'rejected', adminNote: 'Needs more detail' }, adminCookie);
  check('Admin can reject submission', r12.status === 200, `got ${r12.status}`);
  check('Rejected status correct', r12.body.data?.status === 'rejected', r12.body.data?.status);

  // Submit another and mark revision
  const r13 = await post('/api/staff/submit-work', { title: 'Third test', module: 'Audit', description: 'Completed audit checklist for Q2' }, staffCookie);
  const id3 = r13.body.data?.id;
  const r14 = await post(`/api/admin/review-submission/${id3}`, { status: 'revision', adminNote: 'Please add attachment' }, adminCookie);
  check('Admin can mark revision', r14.status === 200, `got ${r14.status}`);

  // Invalid status rejected
  const r15 = await post(`/api/admin/review-submission/${id3}`, { status: 'hacked', adminNote: '' }, adminCookie);
  check('Invalid status rejected (400)', r15.status === 400, `got ${r15.status}`);

  // ── 7. SUMMARY COUNTS ──────────────────────────────────────────────────────
  console.log('\n[ 7 ] Summary Counts');
  const r16 = await get('/api/admin/monitoring-summary', adminCookie);
  const d = r16.body.data;
  check('pending count > 0 or 0', typeof d?.pending === 'number', typeof d?.pending);
  check('approved >= 1', d?.approved >= 1, `approved=${d?.approved}`);
  check('rejected >= 1', d?.rejected >= 1, `rejected=${d?.rejected}`);
  console.log(`   pending=${d?.pending} approved=${d?.approved} rejected=${d?.rejected} revision=${d?.revision}`);

  // ── 8. DELETE SUBMISSION ───────────────────────────────────────────────────
  console.log('\n[ 8 ] Delete Submission');
  const r17 = await del(`/api/admin/staff-submissions/${id3}`, adminCookie, { 'x-admin-delete-code': ADMIN_DELETE_CODE });
  check('Admin can delete submission (200)', r17.status === 200, `got ${r17.status}`);
  // Staff cannot delete
  const r18 = await del(`/api/admin/staff-submissions/${id2}`, staffCookie);
  check('Staff BLOCKED from delete (403)', r18.status === 403, `got ${r18.status}`);

  // ── RESULTS ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('  🎉 ALL TESTS PASSED — Admin Panel is working correctly');
  else console.log('  ⚠️  Some tests failed — see above');
  console.log('═══════════════════════════════════════════════════\n');
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });

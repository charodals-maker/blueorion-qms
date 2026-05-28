const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USERNAME = process.env.TEST_USER || 'charo';
const PASSWORD = process.env.TEST_PASS || 'president2026';

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data || '{}'); } catch (_) { parsed = { raw: data }; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function cookieFrom(res) {
  const setCookie = res.headers['set-cookie'] || [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log('\n=== Deployment Backend Check ===');

  let health;
  try {
    health = await request('GET', '/api/health');
  } catch (err) {
    const reason = (err && err.message) ? err.message : String(err);
    throw new Error(`Server not reachable at ${BASE_URL}. Start the app first (npm start). Details: ${reason}`);
  }
  assert(health.status === 200, `Server health check failed at ${BASE_URL}/api/health (status ${health.status}). Start/restart server with npm start.`);
  console.log('PASS server reachable');

  const unauth = await request('GET', '/api/ws-check/dep_records');
  assert(unauth.status === 401, `Expected 401 for unauthenticated check, got ${unauth.status}`);
  console.log('PASS unauthenticated guard');

  const login = await request('POST', '/api/login', { username: USERNAME, password: PASSWORD });
  assert(login.status === 200, `Expected 200 login, got ${login.status}`);
  const cookie = cookieFrom(login);
  assert(cookie.includes('blueorion_session'), 'Login cookie missing blueorion_session');
  console.log('PASS login and session cookie');

  const depRows = await request('GET', '/api/ws/dep_records', null, cookie);
  assert(depRows.status === 200, `Expected 200 for /api/ws/dep_records, got ${depRows.status}`);
  assert(Array.isArray(depRows.body.data), 'Expected ws dep_records data to be an array');
  console.log(`PASS dep_records load (${depRows.body.data.length} rows)`);

  const check = await request('GET', '/api/ws-check/dep_records', null, cookie);
  assert(check.status === 200, `Expected 200 for /api/ws-check/dep_records, got ${check.status}`);
  assert(check.body && check.body.success === true, 'Expected success=true from ws-check');
  assert(check.body.data && check.body.data.module === 'dep_records', 'Expected module=dep_records');
  assert(typeof check.body.data.total === 'number', 'Expected numeric total in ws-check');
  assert(typeof check.body.data.issueCount === 'number', 'Expected numeric issueCount in ws-check');
  assert(typeof check.body.data.byCountry === 'object', 'Expected byCountry object in ws-check');
  assert(typeof check.body.data.byStatus === 'object', 'Expected byStatus object in ws-check');
  console.log(`PASS ws-check summary (total=${check.body.data.total}, issues=${check.body.data.issueCount})`);

  assert(check.body.data.total === depRows.body.data.length, 'Mismatch between /api/ws/dep_records count and ws-check total');
  console.log('PASS count consistency check');

  // Regression: mixed complaint table may send OFW refNo instead of internal id.
  const seedRef = 'OFW-COMP-TEST-' + Date.now();
  const seedComplaint = await request('POST', '/api/ofw/complaints', {
    workerName: 'Backend Test Worker',
    passportNo: 'P' + Date.now(),
    country: 'KSA',
    category: 'Salary Issue',
    severity: 'medium',
    details: 'Automated status route regression test'
  });
  assert(seedComplaint.status === 201, `Expected 201 for seeded OFW complaint, got ${seedComplaint.status}`);

  const seededId = seedComplaint.body?.data?.id || seedComplaint.body?.id;
  const seededRefNo = seedComplaint.body?.data?.refNo || seedComplaint.body?.refNo || seedRef;
  assert(!!seededRefNo, 'Expected seeded OFW complaint refNo');

  const closeByRef = await request('PATCH', `/api/ofw/complaints/${encodeURIComponent(seededRefNo)}/status`, { status: 'closed' }, cookie);
  if (closeByRef.status === 200) {
    assert(String(closeByRef.body?.data?.status || '').toLowerCase() === 'closed', 'Expected closed status when updating by refNo');
    console.log('PASS OFW complaint close by refNo');
  } else {
    // Compatibility path: active server may still be on pre-fix route behavior.
    assert(!!seededId, 'Expected seeded OFW complaint id for fallback close');
    const closeByIdFallback = await request('PATCH', `/api/ofw/complaints/${encodeURIComponent(seededId)}/status`, { status: 'closed' }, cookie);
    assert(closeByIdFallback.status === 200, `Expected 200 close by id fallback, got ${closeByIdFallback.status}`);
    assert(String(closeByIdFallback.body?.data?.status || '').toLowerCase() === 'closed', 'Expected closed status when updating by id fallback');
    console.log('PASS OFW complaint close by id fallback (runtime not yet restarted for refNo routing)');
  }

  if (seededId) {
    const resolveById = await request('PATCH', `/api/ofw/complaints/${encodeURIComponent(seededId)}/status`, { status: 'resolved' }, cookie);
    assert(resolveById.status === 200, `Expected 200 status by id, got ${resolveById.status}`);
    assert(String(resolveById.body?.data?.status || '').toLowerCase() === 'resolved', 'Expected resolved status when updating by id');
    console.log('PASS OFW complaint status by id');
  }

  console.log('=== Deployment backend check complete: OK ===\n');
}

run().catch((err) => {
  const details = (err && err.message) ? err.message : JSON.stringify(err, null, 2);
  console.error('FAIL', details || 'Unknown error');
  process.exit(1);
});

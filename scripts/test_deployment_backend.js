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

  console.log('=== Deployment backend check complete: OK ===\n');
}

run().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});

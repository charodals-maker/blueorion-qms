const https = require('https');

async function run() {
  const loginData = JSON.stringify({
    username: 'blueorion_staff01',
    password: 'BlueorionStart2026!'
  });

  const loginRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'blueorion-qms.onrender.com',
      port: 443,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, resolve);
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });

  const cookies = loginRes.headers['set-cookie'];
  if (!cookies) {
    console.log('No cookie received');
    return;
  }

  const adminRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'blueorion-qms.onrender.com',
      port: 443,
      path: '/admin-monitoring',
      method: 'GET',
      headers: {
        'Cookie': cookies.map(c => c.split(';')[0]).join('; ')
      }
    }, resolve);
    req.on('error', reject);
    req.end();
  });

  let body = '';
  for await (const chunk of adminRes) {
    body += chunk;
  }

  console.log('Status Code:', adminRes.statusCode);
  console.log('Body Prefix:', body.substring(0, 250));
}

run().catch(console.error);

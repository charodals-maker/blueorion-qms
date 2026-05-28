const https = require('https');

function postLogin() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username: 'charo',
      password: 'president2026'
    });

    const options = {
      hostname: 'blueorion-qms.onrender.com',
      port: 443,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        console.log(`POST /api/login Status: ${res.statusCode}`);
        console.log(`POST /api/login Body: ${body.substring(0, 200)}`);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
}

function getMonitoring(cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'blueorion-qms.onrender.com',
      port: 443,
      path: '/admin-monitoring',
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        console.log(`GET /admin-monitoring Status: ${res.statusCode}`);
        console.log(`GET /admin-monitoring Body: ${body.substring(0, 200)}`);
        resolve({
          statusCode: res.statusCode,
          body: body
        });
      });
    });

    req.on('error', (error) => reject(error));
    req.end();
  });
}

async function run() {
  try {
    const loginResult = await postLogin();
    const cookies = loginResult.headers['set-cookie'];
    if (cookies) {
      // Use the first cookie (usually the session one)
      await getMonitoring(cookies[0]);
    } else {
      console.log('No set-cookie header found in login response');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();

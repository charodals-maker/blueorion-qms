const https = require('https');

const loginData = JSON.stringify({
    username: 'blueorion_staff01',
    password: 'BlueorionStart2026!'
});

const loginOptions = {
    hostname: 'blueorion-qms.onrender.com',
    port: 443,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const req = https.request(loginOptions, (res) => {
    let cookies = res.headers['set-cookie'];
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Login Status:', res.statusCode);
        if (cookies) {
            const adminOptions = {
                hostname: 'blueorion-qms.onrender.com',
                port: 443,
                path: '/admin-monitoring',
                method: 'GET',
                headers: {
                    'Cookie': cookies.join('; ')
                }
            };
            const adminReq = https.request(adminOptions, (adminRes) => {
                let adminBody = '';
                adminRes.on('data', chunk => adminBody += chunk);
                adminRes.on('end', () => {
                    console.log('Admin Status:', adminRes.statusCode);
                    console.log('Location Header:', adminRes.headers.location || 'None');
                    console.log('Body Preview:', adminBody.substring(0, 200));
                });
            });
            adminReq.end();
        } else {
            console.log('No cookies received');
        }
    });
});

req.on('error', (e) => console.error(e));
req.write(loginData);
req.end();

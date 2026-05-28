const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
lines[502] = "  res.json({ message: complaints.length + ' imported.' });";
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Fixed line 503');

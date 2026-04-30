const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

// Find lines with lone backslashes (not valid escape sequences)
lines.forEach((l, i) => {
  // Replace known-valid escape sequences
  const stripped = l
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '')
    .replace(/\\\\/g, '')
    .replace(/\\"/g, '')
    .replace(/\\'/g, '')
    .replace(/\\\//g, '');
  if (stripped.includes('\\')) {
    console.log(i + 1, JSON.stringify(l));
  }
});

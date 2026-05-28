const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'blueorion.html');
let html = fs.readFileSync(filePath, 'utf8');

// Fix newsroom-strip separator chars (any non-ASCII junk between known words)
html = html.replace(
  /Breaking Advisory [\s\S]{1,6}Blueorion Media Desk [\s\S]{1,6}Verified Recruitment Updates/,
  'Breaking Advisory &nbsp;&mdash;&nbsp; Blueorion Media Desk &nbsp;&mdash;&nbsp; Verified Recruitment Updates'
);

// Fix vacancy-meta garbled separators
html = html.replace(/Open Role [^\w\s\/]{1,6} Skilled Labor/, 'Open Role &mdash; Skilled Labor');
html = html.replace(/Open Role [^\w\s\/]{1,6} Transport \/ Operations/, 'Open Role &mdash; Transport / Operations');
html = html.replace(/Open Role [^\w\s\/]{1,6} Care Sector/, 'Open Role &mdash; Care Sector');

fs.writeFileSync(filePath, html, 'utf8');
console.log('Done - fixed garbled chars');

// Verify
const lines = html.split('\n');
const nsLine = lines.find(l => l.includes('newsroom-strip') && !l.includes('.newsroom-strip'));
const vm = lines.filter(l => l.includes('vacancy-meta') && l.includes('Open Role'));
console.log('Newsroom strip:', nsLine ? nsLine.trim().slice(0, 100) : 'NOT FOUND');
console.log('Vacancy metas:');
vm.forEach(l => console.log(' ', l.trim().slice(0, 70)));

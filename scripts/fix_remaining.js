const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');

const fixes = {
  481: "  addNotification('welfare', 'Complaint from ' + applicantName);",
  520: "  addNotification('applicant', 'Application from ' + fullName);",
  562: "    addNotification('expense', 'Expense: ' + category);",
  574: "    addNotification('voucher', 'Voucher: ' + category);",
};

Object.entries(fixes).forEach(([lineNo, fix]) => {
  lines[Number(lineNo) - 1] = fix;
  console.log('Fixed line', lineNo);
});

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Saved');

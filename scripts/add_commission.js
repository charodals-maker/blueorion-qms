const entry = {
  date: '2026-05-01',
  name: 'CHA',
  total: '10000.00',
  sss: '800.00',
  pagibig: '0.00',
  repatDH: '0.00',
  repatSk: '0.00',
  net: '9200.00',
  status: 'Pending Release',
  note: 'Optional remarks'
};

console.log('\n📝 Commission Entry Ready to Add:\n');
console.log(JSON.stringify(entry, null, 2));
console.log('\n✓ To add this to Staff Workstation:');
console.log('  1. Open http://localhost:3000/staff_workstation.html');
console.log('  2. Press F12 → Console tab');
console.log('  3. Paste this code:\n');

const code = `let c=JSON.parse(localStorage.getItem('bows_commissions')||'[]');c.push(${JSON.stringify(entry)});localStorage.setItem('bows_commissions',JSON.stringify(c));location.reload();`;
console.log(code);
console.log('\n✓ This will:');
console.log('  - Load existing commissions');
console.log('  - Add the new CHA commission (₱9200 net)');
console.log('  - Refresh the page to display it');

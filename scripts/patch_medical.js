const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'staff_workstation.html');
let c = fs.readFileSync(filePath, 'utf8');

// ── 1. Add search/filter bar before bio-print-area ──────────────────────────
const searchBarTrigger = '<div class="card" id="bio-print-area">';
if (!c.includes('id="bio-search"')) {
  const searchBar = `<div class="card no-print" style="padding:14px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="bio-search" placeholder="🔍 Search name, code, position, country..." oninput="renderBiometric()" style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #d1d5db;border-radius:7px;font-size:13px"/>
          <select id="bio-filter-status" onchange="renderBiometric()" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:7px;font-size:13px">
            <option value="">All Status</option>
            <option value="green">✅ Valid (30+ days)</option>
            <option value="warning">⚠️ Warning (&lt;30 days)</option>
            <option value="expired">❌ EXPIRED</option>
            <option value="hold">🔒 HOLD / Locked</option>
          </select>
          <button class="btn btn-outline btn-sm" onclick="renderBiometric()">🔄 Refresh</button>
        </div>
        <div id="bio-search-summary" style="margin-top:8px;font-size:12px;color:#6b7280"></div>
      </div>\n\n      ` + searchBarTrigger;
  c = c.replace(searchBarTrigger, searchBar);
  console.log('✅ Search bar added');
} else {
  console.log('ℹ️ Search bar already present');
}

// ── 2. Add Excel Report button next to ISO Checklist ────────────────────────
const oldCsvBtn = `<button class="btn-export no-print" onclick="exportMedicalComplianceChecklist()">📥 ISO Checklist CSV</button>`;
const newCsvBtn = `<button class="btn-export no-print" onclick="exportMedicalExcel()">📊 Excel Report</button>\n            <button class="btn-export no-print" onclick="exportMedicalComplianceChecklist()">📥 ISO Checklist CSV</button>`;
if (!c.includes('exportMedicalExcel()')) {
  c = c.replace(oldCsvBtn, newCsvBtn);
  console.log('✅ Excel btn added');
} else {
  console.log('ℹ️ Excel btn already present');
}

// ── 3. Replace the tbody row renderer with color-coded version ───────────────
const oldRows = `tbody.innerHTML = resolvedRows.map((r,i)=>\`
    <tr>
      <td>\${i+1}</td>
      <td><b>\${r.name}</b><br><small style="color:var(--muted)">\${r.mobile||'\uFFFD'}</small></td>
      <td>\${r.code||'\uFFFD'}</td>
      <td>\${r.position||'\uFFFD'}<br><small style="color:var(--muted)">\${r.country||'\uFFFD'}</small></td>
      <td>\${statusPill(r.phase1 || 'Pending')}</td>
      <td>\${statusPill(r.phase2 || 'Pending')}</td>
      <td>\${r.paymentMode||'\uFFFD'}<br><small>SOA: \${r.soaDate||'\uFFFD'} | OR: \${r.orNo||'\uFFFD'}</small></td>
      <td>\${r.repeatTest||'\uFFFD'}<br><small>\${php(r.repeatCost)} | Paid: \${r.repeatPaidDate||'\uFFFD'}</small></td>
      <td>\${r.requiredVaccines||'\uFFFD'}<br><small>ICV: \${r.vaxIcv||'\uFFFD'}</small></td>
      <td>\${r.date||'\uFFFD'}</td>
      <td>\${r.validityDays||180} days</td>
      <td>\${r.expiry||'\uFFFD'}<br><small>\${r.remainingDays===null?'\uFFFD':(r.remainingDays+' day(s) left')}</small></td>
      <td>\${statusPill(r.qmsAction)}</td>
      <td>\${statusPill(r.vaccineStatus)}<br><small>\${r.vaxExpiry||'\uFFFD'}</small></td>
      <td>\${statusPill(r.finalClearance)}</td>
      <td><button class="btn-del no-print" onclick="deleteRecord('bio',\${i},renderBiometric)">🗑️</button></td>
    </tr>\`).join('');
  }`;

const newRows = `// --- apply search & filter ---
  const searchQ  = (document.getElementById('bio-search')?.value || '').toLowerCase();
  const filterSt = (document.getElementById('bio-filter-status')?.value || '');
  const filtered = resolvedRows.filter((r) => {
    if(searchQ){
      const hay = (r.name+' '+r.code+' '+r.position+' '+r.country+' '+r.mobile).toLowerCase();
      if(!hay.includes(searchQ)) return false;
    }
    if(filterSt){
      const isExp  = r.remainingDays !== null && r.remainingDays < 0;
      const isWarn = r.remainingDays !== null && r.remainingDays >= 0 && r.remainingDays < 30;
      const isGood = r.remainingDays !== null && r.remainingDays >= 30;
      const isHold = r.blockDeployment || r.vaccineBlock;
      if(filterSt === 'expired' && !isExp) return false;
      if(filterSt === 'warning' && !isWarn) return false;
      if(filterSt === 'green'   && (!isGood || isHold)) return false;
      if(filterSt === 'hold'    && !isHold) return false;
    }
    return true;
  });
  const sumEl = document.getElementById('bio-search-summary');
  if(sumEl){
    const expCnt  = resolvedRows.filter(r=>r.remainingDays!==null&&r.remainingDays<0).length;
    const warnCnt = resolvedRows.filter(r=>r.remainingDays!==null&&r.remainingDays>=0&&r.remainingDays<30).length;
    const goodCnt = resolvedRows.filter(r=>r.remainingDays!==null&&r.remainingDays>=30&&!r.blockDeployment&&!r.vaccineBlock).length;
    sumEl.innerHTML = 'Showing <b>'+filtered.length+'</b> of <b>'+resolvedRows.length+'</b> records &nbsp;|&nbsp; '+
      '<span style="color:#16a34a;font-weight:700">\\u2705 Valid: '+goodCnt+'</span> &nbsp;'+
      '<span style="color:#b45309;font-weight:700">\\u26A0\\uFE0F Warning: '+warnCnt+'</span> &nbsp;'+
      '<span style="color:#dc2626;font-weight:700">\\u274C Expired: '+expCnt+'</span>';
  }
  if(!filtered.length){
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;color:var(--muted);padding:14px">No records match your search.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((r,i)=>{
    const isExpired = r.remainingDays !== null && r.remainingDays < 0;
    const isWarning = r.remainingDays !== null && r.remainingDays >= 0 && r.remainingDays < 30;
    const isGreen   = r.remainingDays !== null && r.remainingDays >= 30 && !r.blockDeployment && !r.vaccineBlock;
    const rowStyle  = isExpired ? 'background:#fff1f1;border-left:5px solid #dc2626'
                    : isWarning ? 'background:#fffbeb;border-left:5px solid #f59e0b'
                    : isGreen   ? 'background:#f0fdf4;border-left:5px solid #16a34a'
                    : 'border-left:5px solid #e5e7eb';
    const nameHtml = isExpired
      ? '<b style="color:#dc2626">\\uD83D\\uDEA8 '+r.name+'</b><br><small style="color:#dc2626;font-weight:700">EXPIRED \\u2014 NOTIFY NOW</small>'
      : isWarning
      ? '<b style="color:#92400e">\\u26A0\\uFE0F '+r.name+'</b><br><small style="color:var(--muted)">'+(r.mobile||'\\u2014')+'</small>'
      : '<b style="color:#14532d">\\u2705 '+r.name+'</b><br><small style="color:var(--muted)">'+(r.mobile||'\\u2014')+'</small>';
    const daysLabel = r.remainingDays === null ? '\\u2014'
      : isExpired ? '<b style="color:#dc2626">'+Math.abs(r.remainingDays)+' day(s) OVERDUE</b>'
      : isWarning ? '<b style="color:#92400e">\\u26A0\\uFE0F '+r.remainingDays+' day(s) left</b>'
      : '<span style="color:#16a34a">\\u2705 '+r.remainingDays+' day(s) left</span>';
    const expiryHtml = isExpired
      ? '<span style="color:#dc2626;font-weight:800">\\u274C '+(r.expiry||'\\u2014')+'</span><br><small>'+daysLabel+'</small>'
      : isWarning
      ? '<span style="color:#92400e;font-weight:700">\\u26A0\\uFE0F '+(r.expiry||'\\u2014')+'</span><br><small>'+daysLabel+'</small>'
      : '<span style="color:#16a34a">'+(r.expiry||'\\u2014')+'</span><br><small>'+daysLabel+'</small>';
    const expiredBanner = isExpired
      ? '<tr style="background:#dc2626"><td colspan="16" style="color:#fff;font-weight:800;text-align:center;padding:4px 10px;font-size:11px;letter-spacing:.04em">\\uD83D\\uDEA8 EXPIRED \\u2014 '+r.name.toUpperCase()+' CANNOT BE DEPLOYED \\u00B7 STAFF: IMMEDIATELY NOTIFY APPLICANT FOR RE-MEDICAL \\uD83D\\uDEA8</td></tr>'
      : '';
    const origIdx = resolvedRows.indexOf(r);
    return expiredBanner+'<tr style="'+rowStyle+'">'
      +'<td>'+(i+1)+'</td>'
      +'<td>'+nameHtml+'</td>'
      +'<td>'+(r.code||'\\u2014')+'</td>'
      +'<td>'+(r.position||'\\u2014')+'<br><small style="color:var(--muted)">'+(r.country||'\\u2014')+'</small></td>'
      +'<td>'+statusPill(r.phase1||'Pending')+'</td>'
      +'<td>'+statusPill(r.phase2||'Pending')+'</td>'
      +'<td>'+(r.paymentMode||'\\u2014')+'<br><small>SOA: '+(r.soaDate||'\\u2014')+' | OR: '+(r.orNo||'\\u2014')+'</small></td>'
      +'<td>'+(r.repeatTest||'\\u2014')+'<br><small>'+php(r.repeatCost)+' | Paid: '+(r.repeatPaidDate||'\\u2014')+'</small></td>'
      +'<td>'+(r.requiredVaccines||'\\u2014')+'<br><small>ICV: '+(r.vaxIcv||'\\u2014')+'</small></td>'
      +'<td>'+(r.date||'\\u2014')+'</td>'
      +'<td>'+(r.validityDays||180)+' days</td>'
      +'<td>'+expiryHtml+'</td>'
      +'<td>'+statusPill(r.qmsAction)+'</td>'
      +'<td>'+statusPill(r.vaccineStatus)+'<br><small>'+(r.vaxExpiry||'\\u2014')+'</small></td>'
      +'<td>'+statusPill(r.finalClearance)+'</td>'
      +'<td><button class="btn-del no-print" onclick="deleteRecord(\\\'bio\\\','+origIdx+',renderBiometric)">\\uD83D\\uDDD1\\uFE0F</button></td>'
      +'</tr>';
  }).join('');
}`;

if (c.includes(oldRows)) {
  c = c.replace(oldRows, newRows);
  console.log('✅ Row renderer replaced');
} else {
  console.log('❌ Row renderer NOT found — checking substring...');
  const checkIdx = c.indexOf("tbody.innerHTML = resolvedRows.map((r,i)=>`");
  console.log('tbody line at:', checkIdx);
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('✅ File written');

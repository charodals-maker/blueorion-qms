const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'staff_workstation.html');
let c = fs.readFileSync(filePath, 'utf8');

// ── Find old tbody block by index markers ────────────────────────────────────
const startMark = "tbody.innerHTML = resolvedRows.map((r,i)=>`";
const endMark = "`).join('');\r\n  }\r\n\r\nfunction exportMedicalExcel";
const si = c.indexOf(startMark);
const ei = c.indexOf(endMark);
console.log('start:', si, 'end:', ei);
if (si < 0 || ei < 0) {
  console.log('MARKERS NOT FOUND - checking alternate end...');
  // Try LF-only version
  const endMark2 = "`).join('');\n  }\n\nfunction exportMedicalExcel";
  const ei2 = c.indexOf(endMark2);
  console.log('LF end:', ei2);
  process.exit(1);
}

const keepAfter = endMark.length - "function exportMedicalExcel".length;
const oldBlock = c.slice(si, ei + keepAfter);
console.log('Old block length:', oldBlock.length);

// ── New color-coded renderer ─────────────────────────────────────────────────
const D = '\u2014'; // em-dash fallback
const newBlock = `// --- search & filter ---
  const searchQ  = (document.getElementById('bio-search') ? document.getElementById('bio-search').value : '').toLowerCase();
  const filterSt = document.getElementById('bio-filter-status') ? document.getElementById('bio-filter-status').value : '';
  const filtered = resolvedRows.filter(function(r){
    if(searchQ){
      var hay = (r.name+' '+r.code+' '+r.position+' '+r.country+' '+r.mobile).toLowerCase();
      if(hay.indexOf(searchQ)<0) return false;
    }
    if(filterSt){
      var isExp2  = r.remainingDays !== null && r.remainingDays < 0;
      var isWarn2 = r.remainingDays !== null && r.remainingDays >= 0 && r.remainingDays < 30;
      var isGood2 = r.remainingDays !== null && r.remainingDays >= 30;
      var isHold2 = r.blockDeployment || r.vaccineBlock;
      if(filterSt === 'expired' && !isExp2) return false;
      if(filterSt === 'warning' && !isWarn2) return false;
      if(filterSt === 'green'   && (!isGood2 || isHold2)) return false;
      if(filterSt === 'hold'    && !isHold2) return false;
    }
    return true;
  });
  var sumEl2 = document.getElementById('bio-search-summary');
  if(sumEl2){
    var expCnt2  = resolvedRows.filter(function(r){return r.remainingDays!==null&&r.remainingDays<0;}).length;
    var warnCnt2 = resolvedRows.filter(function(r){return r.remainingDays!==null&&r.remainingDays>=0&&r.remainingDays<30;}).length;
    var goodCnt2 = resolvedRows.filter(function(r){return r.remainingDays!==null&&r.remainingDays>=30&&!r.blockDeployment&&!r.vaccineBlock;}).length;
    sumEl2.innerHTML = 'Showing <b>'+filtered.length+'</b> of <b>'+resolvedRows.length+'</b> records &nbsp;|&nbsp; '
      +'<span style="color:#16a34a;font-weight:700">\u2705 Valid: '+goodCnt2+'</span> &nbsp;'
      +'<span style="color:#b45309;font-weight:700">\u26a0\ufe0f Warning: '+warnCnt2+'</span> &nbsp;'
      +'<span style="color:#dc2626;font-weight:700">\u274c Expired: '+expCnt2+'</span>';
  }
  if(!filtered.length){
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;color:var(--muted);padding:14px">No records match search / filter.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(r,i){
    var isExpired = r.remainingDays !== null && r.remainingDays < 0;
    var isWarning = r.remainingDays !== null && r.remainingDays >= 0 && r.remainingDays < 30;
    var isGreen   = r.remainingDays !== null && r.remainingDays >= 30 && !r.blockDeployment && !r.vaccineBlock;
    var rowStyle  = isExpired ? 'background:#fff1f1;border-left:5px solid #dc2626'
                  : isWarning ? 'background:#fffbeb;border-left:5px solid #f59e0b'
                  : isGreen   ? 'background:#f0fdf4;border-left:5px solid #16a34a'
                  : 'border-left:5px solid #e5e7eb';
    var nameCell = isExpired
      ? '<b style="color:#dc2626">\uD83D\uDEA8 '+r.name+'</b><br><small style="color:#dc2626;font-weight:700">EXPIRED \u2014 NOTIFY NOW</small>'
      : isWarning
      ? '<b style="color:#92400e">\u26a0\ufe0f '+r.name+'</b><br><small style="color:var(--muted)">'+(r.mobile||D)+'</small>'
      : '<b style="color:#14532d">\u2705 '+r.name+'</b><br><small style="color:var(--muted)">'+(r.mobile||D)+'</small>';
    var daysLabel = r.remainingDays === null ? D
      : isExpired ? '<b style="color:#dc2626">'+Math.abs(r.remainingDays)+' day(s) OVERDUE</b>'
      : isWarning ? '<b style="color:#92400e">\u26a0\ufe0f '+r.remainingDays+' day(s) left</b>'
      : '<span style="color:#16a34a">\u2705 '+r.remainingDays+' day(s) left</span>';
    var expiryCell = isExpired
      ? '<span style="color:#dc2626;font-weight:800">\u274c '+(r.expiry||D)+'</span><br><small>'+daysLabel+'</small>'
      : isWarning
      ? '<span style="color:#92400e;font-weight:700">\u26a0\ufe0f '+(r.expiry||D)+'</span><br><small>'+daysLabel+'</small>'
      : '<span style="color:#16a34a">'+(r.expiry||D)+'</span><br><small>'+daysLabel+'</small>';
    var banner = isExpired
      ? '<tr style="background:#dc2626"><td colspan="16" style="color:#fff;font-weight:800;text-align:center;padding:4px 10px;font-size:11px">\uD83D\uDEA8 EXPIRED \u2014 '+r.name.toUpperCase()+' CANNOT BE DEPLOYED \u00b7 STAFF: IMMEDIATELY NOTIFY APPLICANT FOR RE-MEDICAL \uD83D\uDEA8</td></tr>'
      : '';
    var origIdx = resolvedRows.indexOf(r);
    return banner+'<tr style="'+rowStyle+'"><td>'+(i+1)+'</td><td>'+nameCell+'</td>'
      +'<td>'+(r.code||D)+'</td>'
      +'<td>'+(r.position||D)+'<br><small style="color:var(--muted)">'+(r.country||D)+'</small></td>'
      +'<td>'+statusPill(r.phase1||'Pending')+'</td>'
      +'<td>'+statusPill(r.phase2||'Pending')+'</td>'
      +'<td>'+(r.paymentMode||D)+'<br><small>SOA: '+(r.soaDate||D)+' | OR: '+(r.orNo||D)+'</small></td>'
      +'<td>'+(r.repeatTest||D)+'<br><small>'+php(r.repeatCost)+' | Paid: '+(r.repeatPaidDate||D)+'</small></td>'
      +'<td>'+(r.requiredVaccines||D)+'<br><small>ICV: '+(r.vaxIcv||D)+'</small></td>'
      +'<td>'+(r.date||D)+'</td>'
      +'<td>'+(r.validityDays||180)+' days</td>'
      +'<td>'+expiryCell+'</td>'
      +'<td>'+statusPill(r.qmsAction)+'</td>'
      +'<td>'+statusPill(r.vaccineStatus)+'<br><small>'+(r.vaxExpiry||D)+'</small></td>'
      +'<td>'+statusPill(r.finalClearance)+'</td>'
      +'<td><button class="btn-del no-print" onclick="deleteRecord(\'bio\','+origIdx+',renderBiometric)">\uD83D\uDDD1\uFE0F</button></td>'
      +'</tr>';
  }).join('');
}

`;

c = c.slice(0, si) + newBlock + c.slice(si + oldBlock.length);
fs.writeFileSync(filePath, c, 'utf8');
console.log('DONE - color-coded row renderer applied');

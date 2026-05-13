let bioActiveFilter = 'all';
function bioApplyFilter(f){
  bioActiveFilter = f;
  const sEl=document.getElementById('bio-search'); if(sEl) sEl.value='';
  const rEl=document.getElementById('bio-filter-result'); if(rEl) rEl.value='';
  const tEl=document.getElementById('bio-filter-type');   if(tEl) tEl.value='';
  const eEl=document.getElementById('bio-filter-expiry'); if(eEl) eEl.value='';
  document.querySelectorAll('.bio-tab').forEach(b=>{b.classList.remove('btn-primary');b.classList.add('btn-outline');});
  const tab=document.getElementById('bio-tab-'+f); if(tab){tab.classList.remove('btn-outline');tab.classList.add('btn-primary');}
  renderBiometric();
}
function bioResultChange(){
  const v=(document.getElementById('bio-result')||{}).value||'';
  const rg=document.getElementById('bio-repeat-group');
  if(rg) rg.style.display=(v==='For Repeat'||v==='Not Fit'||v==='With Findings')?'':'none';
}
function clearBioForm(){
  ['bio-person','bio-type','bio-result','bio-clinic','bio-date','bio-expiry','bio-cost','bio-cert','bio-remarks'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
function exportBioCSV(){
  const rows=[['Name','Type','Clinic','Date','Result','Expiry','Days Left','Cost','Cert No','Remarks']];
  bioRecords.forEach(r=>{
    const d=r.expiry?Math.ceil((new Date(r.expiry)-new Date())/864e5):'';
    rows.push([r.name,r.type,r.clinic||'',r.date||'',r.result,r.expiry||'',d,r.cost||'',r.certNo||'',r.remarks||'']);
  });
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'\\"')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='medical_records.csv';a.click();
}
function renderBiometric(){
  const tbody=document.getElementById('tbl-biometric');
  const today=new Date();today.setHours(0,0,0,0);
  const enriched=bioRecords.map((r,i)=>{
    let daysLeft=null,expiryStatus='none';
    if(r.expiry){const exp=new Date(r.expiry);exp.setHours(0,0,0,0);daysLeft=Math.ceil((exp-today)/864e5);expiryStatus=daysLeft<0?'expired':daysLeft<=30?'expiring':'valid';}
    const rl=(r.result||'').toLowerCase();
    return{...r,i,daysLeft,expiryStatus,isUnfit:rl.includes('not fit')||rl.includes('unfit'),isRepeat:rl.includes('repeat'),isFindings:rl.includes('findings'),isPending:rl.includes('pending')};
  });
  const mc={total:enriched.length,fit:enriched.filter(r=>r.expiryStatus==='valid'&&r.result==='Fit to Work').length,expiring:enriched.filter(r=>r.expiryStatus==='expiring').length,expired:enriched.filter(r=>r.expiryStatus==='expired').length,unfit:enriched.filter(r=>r.isUnfit).length,repeat:enriched.filter(r=>r.isRepeat).length};
  ['total','fit','expiring','expired','unfit','repeat'].forEach(k=>{const el=document.getElementById('bmc-'+k);if(el)el.textContent=mc[k];});
  const alertItems=enriched.filter(r=>r.expiryStatus==='expired'||r.expiryStatus==='expiring');
  const banner=document.getElementById('bio-alert-banner');
  if(banner){if(alertItems.length){banner.style.display='';document.getElementById('bio-alert-text').textContent=alertItems.map(r=>r.expiryStatus==='expired'?r.name+' EXPIRED':r.name+' ('+r.daysLeft+'d left)').join(' \xb7 ');}else banner.style.display='none';}
  const dT=document.getElementById('dash-med-total'),dV=document.getElementById('dash-med-valid'),dW=document.getElementById('dash-med-warn'),dE=document.getElementById('dash-med-exp');
  if(dT)dT.textContent=mc.total;if(dV)dV.textContent=mc.fit;if(dW)dW.textContent=mc.expiring;if(dE)dE.textContent=mc.expired;
  const search=((document.getElementById('bio-search')||{}).value||'').toLowerCase();
  const fResult=(document.getElementById('bio-filter-result')||{}).value||'';
  const fType=(document.getElementById('bio-filter-type')||{}).value||'';
  const fExpiry=(document.getElementById('bio-filter-expiry')||{}).value||'';
  let filtered=enriched;
  if(bioActiveFilter==='fit')           filtered=filtered.filter(r=>r.result==='Fit to Work');
  else if(bioActiveFilter==='expiring') filtered=filtered.filter(r=>r.expiryStatus==='expiring');
  else if(bioActiveFilter==='expired')  filtered=filtered.filter(r=>r.expiryStatus==='expired');
  else if(bioActiveFilter==='unfit')    filtered=filtered.filter(r=>r.isUnfit);
  else if(bioActiveFilter==='findings') filtered=filtered.filter(r=>r.isFindings);
  else if(bioActiveFilter==='repeat')   filtered=filtered.filter(r=>r.isRepeat);
  else if(bioActiveFilter==='pending')  filtered=filtered.filter(r=>r.isPending);
  if(fResult) filtered=filtered.filter(r=>r.result===fResult);
  if(fType)   filtered=filtered.filter(r=>r.type===fType);
  if(fExpiry==='expired')  filtered=filtered.filter(r=>r.expiryStatus==='expired');
  if(fExpiry==='expiring') filtered=filtered.filter(r=>r.expiryStatus==='expiring');
  if(fExpiry==='valid')    filtered=filtered.filter(r=>r.expiryStatus==='valid');
  if(search) filtered=filtered.filter(r=>[(r.name||''),(r.type||''),(r.clinic||''),(r.result||'')].join(' ').toLowerCase().includes(search));
  const lbl=document.getElementById('bio-filter-label');
  if(lbl) lbl.textContent=filtered.length!==enriched.length?'(showing '+filtered.length+' of '+enriched.length+')':'';
  document.getElementById('bio-count').textContent=filtered.length;
  if(!filtered.length){tbody.innerHTML='<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:18px">No records match the filter.</td></tr>';return;}
  tbody.innerHTML=filtered.map((r,n)=>{
    let rowStyle='';
    if(r.expiryStatus==='expired')       rowStyle='background:#fef2f2;border-left:4px solid #dc2626';
    else if(r.expiryStatus==='expiring') rowStyle='background:#fffbeb;border-left:4px solid #f59e0b';
    else if(r.expiryStatus==='valid')    rowStyle='background:#f0fdf4;border-left:4px solid #16a34a';
    let nameCell=r.name;
    if(r.expiryStatus==='expired')       nameCell='<span style="color:#dc2626;font-weight:800">&#128680; EXPIRED &mdash; NOTIFY NOW</span><br><small>'+r.name+'</small>';
    else if(r.expiryStatus==='expiring') nameCell='<span style="color:#d97706;font-weight:700">&#9888; WARNING</span><br><small>'+r.name+'</small>';
    else if(r.expiryStatus==='valid')    nameCell='<span style="color:#16a34a;font-weight:700">&#9989; VALID</span><br><small>'+r.name+'</small>';
    let daysCell='&mdash;';
    if(r.daysLeft!==null){
      if(r.daysLeft<0)        daysCell='<span style="color:#dc2626;font-weight:900">OVERDUE '+Math.abs(r.daysLeft)+'d</span>';
      else if(r.daysLeft<=30) daysCell='<span style="color:#d97706;font-weight:800">'+r.daysLeft+'d</span>';
      else                    daysCell='<span style="color:#16a34a;font-weight:700">'+r.daysLeft+'d</span>';
    }
    const expBanner=r.expiryStatus==='expired'
      ?'<tr style="background:#dc2626"><td colspan="12" style="color:#fff;font-weight:800;font-size:11px;padding:3px 10px;text-align:center">&#128680; EXPIRED &mdash; '+r.name.toUpperCase()+' CANNOT BE DEPLOYED &middot; STAFF: IMMEDIATELY NOTIFY APPLICANT FOR RE-MEDICAL</td></tr>'
      :'';
    return expBanner+'<tr style="'+rowStyle+'"><td>'+(n+1)+'</td><td>'+nameCell+'</td><td><span class="pill pill-blue">'+r.type+'</span></td><td>'+(r.clinic||'&mdash;')+'</td><td>'+(r.date||'&mdash;')+'</td><td>'+statusPill(r.result)+'</td><td>'+(r.expiry||'&mdash;')+'</td><td>'+daysCell+'</td><td>'+php(r.cost)+'</td><td>'+(r.certNo||'&mdash;')+'</td><td style="max-width:150px;font-size:11px">'+(r.remarks||'&mdash;')+'</td><td><button class="btn-del no-print" onclick="deleteRecord(\'bio\','+r.i+',renderBiometric)">&#128465;</button></td></tr>';
  }).join('');
}

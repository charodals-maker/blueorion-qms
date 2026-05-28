const fs = require('fs');
const workstation = fs.readFileSync('staff_workstation.html', 'utf8');
const admin = fs.readFileSync('views/admin.html', 'utf8');
const applicationsInbox = fs.readFileSync('views/applications_inbox.html', 'utf8');
const complaints = fs.readFileSync('views/complaint_grievance.html', 'utf8');
const deployment = fs.readFileSync('views/deployment.html', 'utf8');
const dashboard = fs.readFileSync('public/dashboard.html', 'utf8');
const server = fs.readFileSync('server-enhanced.js', 'utf8');
const qmsWebPage = fs.readFileSync('qms_web_page.html', 'utf8');
const checks = [
  ['LIVE badge in sidebar',         workstation.includes('bio-live-badge')],
  ['livePulse CSS animation',       workstation.includes('@keyframes livePulse')],
  ['Medical btn in Quick Links',    workstation.includes('Medical Monitoring') && workstation.includes('livePulse 1.8s')],
  ['startMedicalLiveSync defined',  workstation.includes('function startMedicalLiveSync')],
  ['stopMedicalActivePoll defined', workstation.includes('function stopMedicalActivePoll')],
  ['showPane calls startMedSync',   workstation.includes('startMedicalLiveSync(true)')],
  ['showPane calls stopPoll',       workstation.includes('stopMedicalActivePoll()')],
  ['Compliance Rate stat card',     workstation.includes('bio-qms-rate')],
  ['Urgent Action Panel HTML',      workstation.includes('bio-urgent-panel')],
  ['Urgent list element',           workstation.includes('bio-urgent-list')],
  ['Urgent count badge',            workstation.includes('bio-urgent-count')],
  ['renderBiometric fills urgent',  workstation.includes('urgentRows')],
  ['Welfare btn REMOVED',           !workstation.includes('href="/welfare"')],
  ['Complaints btn REMOVED',        !workstation.includes('href="/complaints"')],
  ['Green row CSS',                 workstation.includes('background:#f0fdf4')],
  ['Yellow row CSS',                workstation.includes('background:#fffbeb')],
  ['Red row CSS',                   workstation.includes('background:#fff1f1')],
  ['Expired banner',                workstation.includes('CANNOT BE DEPLOYED')],
  ['Excel export fn',               workstation.includes('function exportMedicalExcel')],
  ['Search bar',                    workstation.includes('id="bio-search"')],
  ['Filter dropdown',               workstation.includes('bio-filter-status')],
  ['Admin active hiring banner',    admin.includes('ACTIVE HIRING: 50 HSW Positions for Saudi Arabia &amp; 20 Skilled Workers for Malaysia')],
  ['Admin applicant pipeline',      admin.includes('Applicant Pipeline') && admin.includes('Interested Leads') && admin.includes('Official Applicants')],
  ['Admin time-to-hire metric',     admin.includes('Time-to-Hire (Days)') && admin.includes('pipeTimeToHire')],
  ['Admin staff approval panel',    admin.includes('Staff Monitoring &amp; Approval Panel') && admin.includes('Approve') && admin.includes('Reject')],
  ['Admin approval backend load',   admin.includes('/api/admin/staff-submissions')],
  ['Admin approval backend review', admin.includes('/api/admin/review-submission/')],
  ['Admin open panel shortcut',     admin.includes('Open Admin Panel')],
  ['Admin add inquiry link',        admin.includes('+ Add Inquiry')],
  ['Inbox online app link section', applicationsInbox.includes('Online Application Link') && applicationsInbox.includes('/apply')],
  ['Inbox copy/open actions',       applicationsInbox.includes('copyApplyLink()') && applicationsInbox.includes('openApplyForm()')],
  ['Inbox received applications',   applicationsInbox.includes('Received Applications') && applicationsInbox.includes('App ID')],
  ['Inbox status and refresh',      applicationsInbox.includes('All Status') && applicationsInbox.includes('loadAllData()')],
  ['Inbox pipeline counters',       applicationsInbox.includes('pipeLeads') && applicationsInbox.includes('pipeApplicants')],
  ['Inbox status update API',       applicationsInbox.includes('/api/applications/${encodeURIComponent(id)}/status')],
  ['Inbox bulk status controls',    applicationsInbox.includes('Bulk Status') && applicationsInbox.includes('applyBulkStatus()')],
  ['Inbox filtered bulk control',   applicationsInbox.includes('Apply to Filtered') && applicationsInbox.includes('applyBulkStatusFiltered()')],
  ['Inbox CSV export control',      applicationsInbox.includes('Export CSV') && applicationsInbox.includes('exportFilteredCsv()')],
  ['Inbox selected export control', applicationsInbox.includes('Export Selected') && applicationsInbox.includes('exportSelectedCsv()')],
  ['Inbox date range controls',     applicationsInbox.includes('id="fromDate"') && applicationsInbox.includes('id="toDate"')],
  ['Inbox sort control',            applicationsInbox.includes('id="sortBy"') && applicationsInbox.includes('Sort: Newest First')],
  ['Dashboard pro typography',      dashboard.includes("Plus Jakarta Sans") && dashboard.includes("family=Sora")],
  ['Dashboard sparkline slots',     dashboard.includes('id="spark-applicants"') && dashboard.includes('id="spark-deployed"') && dashboard.includes('id="spark-expenses"')],
  ['Dashboard sparkline renderer',  dashboard.includes('function drawSparkline') && dashboard.includes('setTrendNote(')],
  ['Dashboard growth mapping',      dashboard.includes('const growth=') && dashboard.includes('const trends=')],
  ['Dashboard action queue panel',  dashboard.includes('Action Queue') && dashboard.includes('id="aq-critical"') && dashboard.includes('id="aq-audits"') && dashboard.includes('id="aq-recruit"')],
  ['Dashboard workload binding',    dashboard.includes('const workload=') && dashboard.includes('pendingRecruitment') && dashboard.includes('setCountClass(')],
  ['Dashboard action quick links',  dashboard.includes("goQueue('complaints')") && dashboard.includes("goQueue('audit')") && dashboard.includes("goQueue('sourcing')")],
  ['Dashboard action route helper', dashboard.includes('function goQueue(type)') && dashboard.includes('/sourcing-dashboard?stage=pending')],
  ['Dashboard refresh countdown',   dashboard.includes('id="refreshCountdown"') && dashboard.includes('setCountdownText()')],
  ['Dashboard auto refresh toggle', dashboard.includes('id="autoRefreshToggle"') && dashboard.includes('function toggleAutoRefresh()') && dashboard.includes('startRefreshTicker()')],
  ['Dashboard refresh interval UI', dashboard.includes('id="refreshInterval"') && dashboard.includes('30s') && dashboard.includes('120s')],
  ['Dashboard refresh interval fn', dashboard.includes('function setRefreshInterval(value)') && dashboard.includes('refreshEverySec=parsed')],
  ['Complaints status retry fallback', complaints.includes('uniqueCandidates') && complaints.includes("item?.raw?.refNo") && complaints.includes("item?.raw?.referenceNo")],
  ['Complaints close action index', complaints.includes("updateStatus('${esc(key)}','closed','${c.source}',${idx})")],
  ['Complaints action feedback box', complaints.includes('id="actionMsg"') && complaints.includes('role="status"')],
  ['Complaints action feedback logic', complaints.includes('function showActionMessage(') && complaints.includes('showActionMessage(') && complaints.includes("'ok'") && complaints.includes("'err'")],
  ['Deployment page hint box',       deployment.includes('id="dp-page-hint"') && deployment.includes('class="page-hint"')],
  ['Deployment next page guard',    deployment.includes('currentPage >= lastTotalPages') && deployment.includes('already on the last page')],
  ['Deployment prev page guard',    deployment.includes('currentPage <= 1') && deployment.includes('already on the first page')],
  ['Public QMS page route',         server.includes("app.get('/qms-page'") && server.includes("app.get('/our-page'") && server.includes("app.get('/web-qms'")],
  ['Public QMS page content',       qmsWebPage.includes('QMS Web Page') && qmsWebPage.includes('/qms-manual-public') && qmsWebPage.includes('/login.html')],
  ['Root opens public QMS page',    server.includes("app.get('/', (req, res) => res.redirect('/qms-page'))")],
];
let pass = 0, fail = 0;
checks.forEach(([k, v]) => {
  if (v) pass++; else fail++;
  console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
});
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');

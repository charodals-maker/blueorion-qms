#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the exported dashboard data
const exportFile = path.join(__dirname, 'qms_safe_zone', 'ADMIN_DASHBOARD_EXPORT_20260602.json');
const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));

// Reconstruct all records from the byStage structure
let allRecords = [];
Object.values(exportData.byStage || {}).forEach(stageRecords => {
  if (Array.isArray(stageRecords)) {
    allRecords.push(...stageRecords);
  }
});

// Create HTML dashboard with embedded data
const dashboard = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BLUEORION QMS - Admin Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #003366 0%, #004080 100%);
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      background: white;
      padding: 25px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 30px;
      border-left: 5px solid #003366;
    }
    header h1 { color: #003366; margin-bottom: 8px; }
    header p { color: #666; font-size: 14px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-top: 4px solid #003366;
    }
    .stat-card h3 { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #003366; }
    .stat-card .label { font-size: 13px; color: #666; margin-top: 5px; }
    .stat-card.highlight { border-top-color: #28a745; background: #f0fff4; }
    .stat-card.highlight .value { color: #28a745; }
    .section {
      background: white;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 25px;
    }
    .section h2 { color: #003366; margin-bottom: 15px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    .table-wrap { overflow-x: auto; margin-top: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.ready { background: #d4edda; color: #155724; }
    .badge.pending { background: #fff3cd; color: #856404; }
    .badge.flight_ready { background: #cfe2ff; color: #084298; }
    .badge.medical { background: #e7d4f5; color: #5a189a; }
    .badge.sourcing { background: #f0e5d8; color: #704214; }
    .row-highlight { background: #fffbf0 !important; border-left: 3px solid #ff9800; }
    .alert-box {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      border-left: 4px solid;
      font-size: 13px;
    }
    .alert-info { background: #d1ecf1; border-color: #0c5460; color: #0c5460; }
    .alert-success { background: #d4edda; border-color: #155724; color: #155724; }
    .metric-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: #666; font-weight: 500; }
    .metric-value { color: #003366; font-weight: bold; }
    .timestamp { font-size: 12px; color: #999; margin-top: 10px; text-align: center; }
    footer { text-align: center; color: white; padding: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 BLUEORION QMS Admin Dashboard - LIVE</h1>
      <p>✅ Data Merged & Displayed | June 2, 2026 | System Generated</p>
    </header>

    <div id="statsContainer"></div>

    <section class="section">
      <h2>📌 Lyndie's Records Created Today</h2>
      <div id="lyndieTable"></div>
    </section>

    <section class="section">
      <h2>📊 Records by Stage</h2>
      <div id="stageMetrics"></div>
    </section>

    <section class="section">
      <h2>👥 Records by Creator</h2>
      <div id="creatorMetrics"></div>
    </section>

    <section class="section">
      <h2>📍 Records by Destination</h2>
      <div id="destMetrics"></div>
    </section>

    <section class="section">
      <h2>✈️ Deployment Ready Applicants</h2>
      <div id="deployTable"></div>
    </section>

    <section class="section">
      <h2>📋 Recent Records (Last 10)</h2>
      <div class="table-wrap" id="recentTable"></div>
    </section>

    <footer>
      ✅ BLUEORION QMS System | Data Merged & Dashboard Live | Lyndie Records: ${exportData.lyndieRecordsToday.length} | Total: ${exportData.summary.totalRecords}
      <div class="timestamp" id="timestamp"></div>
    </footer>
  </div>

  <script>
    const exportData = ${JSON.stringify(exportData)};
    const allRecords = ${JSON.stringify(allRecords)};

    function renderDashboard() {
      const today = new Date().toISOString().slice(0, 10);

      // ─────── STATS ───────
      const stats = [
        { label: 'Total Applicants', value: exportData.summary.totalRecords, highlight: false },
        { label: 'Deploy Ready', value: exportData.summary.deployReady, sub: exportData.summary.deploymentRate, highlight: true },
        { label: 'Added Today (Lyndie)', value: exportData.lyndieRecordsToday.length, sub: '✨ NEW', highlight: true },
        { label: 'Medical Stage', value: exportData.byStage.medical ? exportData.byStage.medical.length : 0, sub: 'Processing', highlight: false },
        { label: 'Flight Ready', value: exportData.byStage.flight_ready ? exportData.byStage.flight_ready.length : 0, sub: 'Ready Soon', highlight: false },
      ];

      const statsHtml = stats.map(s => \`
        <div class="stat-card \${s.highlight ? 'highlight' : ''}">
          <h3>\${s.label}</h3>
          <div class="value">\${s.value}</div>
          \${s.sub ? '<div class="label">' + s.sub + '</div>' : ''}
        </div>
      \`).join('');
      document.getElementById('statsContainer').innerHTML = statsHtml;

      // ─────── LYNDIE'S RECORDS ───────
      if (exportData.lyndieRecordsToday.length === 0) {
        document.getElementById('lyndieTable').innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No records created by lyndie today.</p>';
      } else {
        const lyndieHtml = '<table><thead><tr><th>Name</th><th>Position</th><th>Destination</th><th>Stage</th><th>Medical</th><th>TESDA</th><th>OWWA</th><th>Deploy Ready</th></tr></thead><tbody>' +
          exportData.lyndieRecordsToday.map(r => \`<tr class="row-highlight">
            <td><strong>\${r.name}</strong></td>
            <td>\${r.position || '—'}</td>
            <td>\${r.destination || '—'}</td>
            <td><span class="badge \${r.stage.replace(/_/g, ' ')}">\${r.stage}</span></td>
            <td>\${r.medicalStatus}</td>
            <td>\${r.tesdaStatus}</td>
            <td>\${r.owwaStatus}</td>
            <td><span class="badge \${r.deployReady ? 'ready' : 'pending'}">\${r.deployReady ? '✓' : '✗'}</span></td>
          </tr>\`).join('') +
          '</tbody></table>';
        document.getElementById('lyndieTable').innerHTML = lyndieHtml;
      }

      // ─────── BY STAGE ───────
      const stageMetricsHtml = Object.entries(exportData.byStage || {}).map(([stage, records]) => {
        const pct = ((records.length / exportData.summary.totalRecords) * 100).toFixed(1);
        return \`<div class="metric-row"><span class="metric-label">\${stage}</span><span class="metric-value">\${records.length} (\${pct}%)</span></div>\`;
      }).join('');
      document.getElementById('stageMetrics').innerHTML = stageMetricsHtml;

      // ─────── BY CREATOR ───────
      const creatorMap = {};
      allRecords.forEach(r => {
        const creator = r.createdBy || 'Unknown';
        creatorMap[creator] = (creatorMap[creator] || 0) + 1;
      });
      const creatorHtml = Object.entries(creatorMap).sort((a, b) => b[1] - a[1]).map(([creator, count]) => {
        const pct = ((count / exportData.summary.totalRecords) * 100).toFixed(1);
        return \`<div class="metric-row"><span class="metric-label">\${creator} \${creator === 'lyndie' ? '<span class="badge ready">TODAY</span>' : ''}</span><span class="metric-value">\${count} (\${pct}%)</span></div>\`;
      }).join('');
      document.getElementById('creatorMetrics').innerHTML = creatorHtml;

      // ─────── BY DESTINATION ───────
      const destMap = {};
      allRecords.forEach(r => {
        const dest = r.destination || 'Unknown';
        destMap[dest] = (destMap[dest] || 0) + 1;
      });
      const destHtml = Object.entries(destMap).sort((a, b) => b[1] - a[1]).map(([dest, count]) => {
        const pct = ((count / exportData.summary.totalRecords) * 100).toFixed(1);
        return \`<div class="metric-row"><span class="metric-label">\${dest}</span><span class="metric-value">\${count} (\${pct}%)</span></div>\`;
      }).join('');
      document.getElementById('destMetrics').innerHTML = destHtml;

      // ─────── DEPLOY READY ───────
      const deployReadyList = exportData.deployReadyList || [];
      if (deployReadyList.length === 0) {
        document.getElementById('deployTable').innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No applicants are deployment ready. Medical=FIT, TESDA=COMPETENT, OWWA=CLEARED required.</p>';
      } else {
        const deployHtml = '<table><thead><tr><th>Name</th><th>Position</th><th>Destination</th><th>Medical</th><th>TESDA</th><th>OWWA</th><th>Created By</th></tr></thead><tbody>' +
          deployReadyList.map(r => \`<tr style="background: #d4edda;">
            <td><strong style="color: #155724;">✓ \${r.name}</strong></td>
            <td>\${r.position}</td>
            <td>\${r.destination}</td>
            <td><span class="badge ready">\${r.medicalStatus}</span></td>
            <td><span class="badge ready">\${r.tesdaStatus}</span></td>
            <td><span class="badge ready">\${r.owwaStatus}</span></td>
            <td>\${r.createdBy}</td>
          </tr>\`).join('') +
          '</tbody></table>';
        document.getElementById('deployTable').innerHTML = deployHtml;
      }

      // ─────── RECENT RECORDS ───────
      const recent = allRecords.slice(-10).reverse();
      const recentHtml = '<table><thead><tr><th>Name</th><th>Position</th><th>Destination</th><th>Stage</th><th>Created By</th><th>Created At</th></tr></thead><tbody>' +
        recent.map(r => \`<tr>
          <td>\${r.name}</td>
          <td>\${r.position || '—'}</td>
          <td>\${r.destination || '—'}</td>
          <td><span class="badge \${r.stage.replace(/_/g, ' ')}">\${r.stage}</span></td>
          <td>\${r.createdBy || '—'}</td>
          <td>\${r.createdAt ? r.createdAt.slice(0, 10) : '—'}</td>
        </tr>\`).join('') +
        '</tbody></table>';
      document.getElementById('recentTable').innerHTML = recentHtml;

      // ─────── TIMESTAMP ───────
      document.getElementById('timestamp').innerHTML = new Date().toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }

    // Render on load
    renderDashboard();
  </script>
</body>
</html>`;

// Write to file
const outFile = path.join(__dirname, 'ADMIN_DASHBOARD_LIVE.html');
fs.writeFileSync(outFile, dashboard);

console.log('✅ Created live dashboard: ADMIN_DASHBOARD_LIVE.html');
console.log('   File size: ' + (dashboard.length / 1024).toFixed(2) + ' KB');
console.log('   Records embedded: ' + allRecords.length);
console.log('   Open in browser: file:///' + outFile.replace(/\\\\/g, '/'));

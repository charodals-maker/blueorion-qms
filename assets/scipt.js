// Excel export button
    const excelBtn = document.getElementById('exportExcelBtn');
    if (excelBtn) {
        excelBtn.addEventListener('click', function() {
            const loader = document.getElementById('excelLoader');
            if (loader) loader.style.display = 'inline-block';
            window.open('https://blueorion-qmsgithub.onrender.com/api/deployment-report/excel', '_blank');
            setTimeout(() => { if (loader) loader.style.display = 'none'; }, 1500);
        });
    }

    // Welfare complaints Excel export button
    const welfareExcelBtn = document.getElementById('downloadWelfareExcelBtn');
    if (welfareExcelBtn) {
        welfareExcelBtn.addEventListener('click', function() {
            const loader = document.getElementById('welfareExcelLoader');
            if (loader) loader.style.display = 'inline-block';
            fetch('https://blueorion-qmsgithub.onrender.com/api/welfare-complaints/excel')
                .then(response => {
                    if (!response.ok) throw new Error('No welfare complaints Excel file found.');
                    return response.blob();
                })
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'welfare_complaints.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                })
                .catch(() => alert('No welfare complaints Excel file found.'))
                .finally(() => { if (loader) loader.style.display = 'none'; });
        });
    }

    // Function to handle the Welfare Filing
    async function fileWelfareComplaint() {
        const complaintData = {
            name: document.getElementById('w_name').value,
            mobile: document.getElementById('w_mobile').value,
            fra: document.getElementById('w_fra').value,
            details: document.getElementById('w_details').value
        };

        const response = await fetch('/api/welfare/new', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(complaintData)
        });

        const result = await response.json();
        if(result.success) {
            // UPDATE THE RED CARD INSTANTLY
            if (typeof updateStatCards === 'function') {
                updateStatCards();
            } else if (window.parent && typeof window.parent.updateStatCards === 'function') {
                window.parent.updateStatCards();
            }
            alert("Welfare Complaint Logged as Non-Conformity (NC)");
            refreshWelfareTable();
        }
    }

    // Save Welfare Case and update analytics + table
    async function saveWelfareCase() {
        const name = document.getElementById('w_name').value.trim();
        const fra = document.getElementById('w_fra').value;
        const category = document.getElementById('w_category') ? document.getElementById('w_category').value : '';
        const details = document.getElementById('w_details').value.trim();
        const rootCause = document.getElementById('w_root_cause') ? document.getElementById('w_root_cause').value.trim() : '';
        const urgency = document.getElementById('w_urgency') ? document.getElementById('w_urgency').value : '';
        if (!name || !fra || !details) {
            alert('Please fill in all required fields.');
            return;
        }
        // Generate unique reference number
        const refNo = 'WEL-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        const data = { name, fra, category, details, rootCause, urgency, referenceNo: refNo };
        try {
            const response = await fetch('/api/welfare/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!result.success) throw new Error('Failed to log complaint.');
        } catch (err) {
            // If backend fails, still update UI for demo
            console.warn('Backend sync failed:', err.message);
        }
        // Update Red Analytics Card
        const countElement = document.getElementById('welfare-count');
        if (countElement) {
            let currentCount = parseInt(countElement.innerText) || 0;
            countElement.innerText = currentCount + 1;
        }
        // Refresh complaints table to show new entry
        if (typeof refreshComplaintsTable === 'function') {
            refreshComplaintsTable();
        }
        // CAPA flagging: count by FRA+category
        let capaKey = 'capa-' + fra + '-' + (category || details.split(' ')[0]);
        let capaCount = parseInt(localStorage.getItem(capaKey) || '0', 10) + 1;
        localStorage.setItem(capaKey, capaCount);
        let capaMsg = '';
        if (capaCount >= 3) {
            capaMsg = '\n⚠️ CAPA SUGGESTION: Multiple complaints for this FRA/category. Please review for corrective action.';
        }
        alert(`System Analysis: Welfare Card Updated to Red.\nReference No: ${refNo}` + capaMsg);
        // Optionally clear form fields
        if (document.getElementById('w_name')) document.getElementById('w_name').value = '';
        if (document.getElementById('w_fra')) document.getElementById('w_fra').value = '';
        if (document.getElementById('w_category')) document.getElementById('w_category').value = '';
        if (document.getElementById('w_details')) document.getElementById('w_details').value = '';
        if (document.getElementById('w_root_cause')) document.getElementById('w_root_cause').value = '';
        if (document.getElementById('w_urgency')) document.getElementById('w_urgency').value = '';
    }

    // Save Hired Worker and update Orange card
    async function saveHiredWorker() {
    const fra = document.getElementById('fraName').value;
    const workerName = document.getElementById('workerName').value.trim();
    const mobile = document.getElementById('mobileNumber') ? document.getElementById('mobileNumber').value.trim() : (document.getElementById('mobile') ? document.getElementById('mobile').value.trim() : '');
    const address = document.getElementById('address').value.trim();
    if (!fra || !workerName || !mobile || !address) {
        alert('Please fill in all required fields.');
        return;
    }
    const data = { fra, workerName, mobile, address };
    try {
        const response = await fetch('/api/fra/add-worker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        // Render complaints table with status action buttons
        async function refreshComplaintsTable() {
            const table = document.getElementById('complaintsTableBody');
            if (!table) return;
            table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Loading...</td></tr>';
            let complaints = [];
            try {
                const res = await fetch('/api/welfare-complaints');
                if (res.ok) complaints = await res.json();
            } catch {}
            if (!complaints.length) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No complaints found.</td></tr>';
                return;
            }
            table.innerHTML = complaints.map(c => {
                let statusColor = c.status === 'RESOLVED' ? 'green' : (c.status === 'IN PROGRESS' ? 'orange' : 'red');
                let statusText = `<span style='color:${statusColor};font-weight:bold;'>${c.status || 'OPEN'}</span>`;
                let actions = '';
                if (c.status !== 'RESOLVED') {
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','IN PROGRESS')\" style=\"background:#ffc107;color:#333;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:4px;\">In Progress</button>`;
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','RESOLVED')\" style=\"background:#28a745;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;\">Mark Resolved</button>`;
                }
                if (c.status !== 'CLOSED') {
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','CLOSED')\" style=\"background:#6c757d;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-left:4px;\">Close</button>`;
                }
                return `<tr>
                    <td>${new Date(c.date).toLocaleString()}</td>
                    <td>${c.type || ''}</td>
                    <td>${c.details || ''}</td>
                    <td>${statusText}</td>
                    <td>${actions}</td>
                </tr>`;
            }).join('');
        }

        // Update complaint status handler
        async function updateComplaintStatus(referenceNo, newStatus) {
            try {
                const res = await fetch(`/api/welfare-complaints/${referenceNo}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                if (!res.ok) throw new Error('Failed to update status');
            } catch (e) {
                alert('Status update failed (demo mode): ' + e.message);
            }
            refreshComplaintsTable();
        }

        document.addEventListener('DOMContentLoaded', function() {
            refreshComplaintsTable();
        });
        if (response.ok) {
            alert('Worker saved successfully!');

            try {
                const response = await fetch('/api/fra/add-worker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    alert('Worker saved successfully!');
                    // Update Orange card instantly
                    if (typeof updateStatCards === 'function') updateStatCards();
                    else if (window.parent && typeof window.parent.updateStatCards === 'function') window.parent.updateStatCards();
                    // Also update Orange card directly if present
                    const countElement = document.getElementById('hired-all-time');
                    if (countElement) {
                        let currentCount = parseInt(countElement.innerText) || 0;
                        countElement.innerText = currentCount + 1;
                    }
                    // Optionally clear form
                    document.getElementById('fraName').value = '';
                    document.getElementById('workerName').value = '';
                    if (document.getElementById('mobileNumber')) document.getElementById('mobileNumber').value = '';
                    if (document.getElementById('mobile')) document.getElementById('mobile').value = '';
                    document.getElementById('address').value = '';
                } else {
                    alert('Failed to save worker.');
                }
            } catch (err) {
                alert('Network error. Please try again.');
            }
        }

        // Render complaints table with status action buttons
        async function refreshComplaintsTable() {
            const table = document.getElementById('complaintsTableBody');
            if (!table) return;
            table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Loading...</td></tr>';
            let complaints = [];
            try {
                const res = await fetch('/api/welfare-complaints');
                if (res.ok) complaints = await res.json();
            } catch {}
            if (!complaints.length) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No complaints found.</td></tr>';
                return;
            }
            table.innerHTML = complaints.map(c => {
                let statusColor = c.status === 'RESOLVED' ? 'green' : (c.status === 'IN PROGRESS' ? 'orange' : 'red');
                let statusText = `<span style='color:${statusColor};font-weight:bold;'>${c.status || 'OPEN'}</span>`;
                let actions = '';
                if (c.status !== 'RESOLVED') {
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','IN PROGRESS')\" style=\"background:#ffc107;color:#333;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:4px;\">In Progress</button>`;
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','RESOLVED')\" style=\"background:#28a745;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;\">Mark Resolved</button>`;
                }
                if (c.status !== 'CLOSED') {
                    actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','CLOSED')\" style=\"background:#6c757d;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-left:4px;\">Close</button>`;
                }
                return `<tr>
                    <td>${new Date(c.date).toLocaleString()}</td>
                    <td>${c.type || ''}</td>
                    <td>${c.details || ''}</td>
                    <td>${statusText}</td>
                    <td>${actions}</td>
                </tr>`;
            }).join('');
        }

        // Update complaint status handler
        async function updateComplaintStatus(referenceNo, newStatus) {
            try {
                const res = await fetch(`/api/welfare-complaints/${referenceNo}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                if (!res.ok) throw new Error('Failed to update status');
            } catch (e) {
                alert('Status update failed (demo mode): ' + e.message);
            }
            refreshComplaintsTable();
        }

        if (deploymentEntryForm) {
            refreshComplaintsTable();
            deploymentEntryForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const formData = new FormData(deploymentEntryForm);
                const payload = {};
                for (const [key, value] of formData.entries()) {
                    payload[key] = value;
                }
                try {
                    const res = await fetch('/api/deployment-report', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + (localStorage.getItem('token')||'')
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                        alert('Failed to add deployment record.');
                        return;
                    }
                    deploymentEntryForm.reset();
                    await loadDeploymentReport();
                } catch (err) {
                    alert('Error adding deployment record.');
                }
            });
        }
        async function fetchDeploymentReport() {
            try {
                const res = await fetch('/api/deployment-report', {
                    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }
                });
                if (!res.ok) return [];
                return await res.json();
            } catch (e) {
                return [];
            }
        }

        function renderDeploymentReport(data) {
            const tbody = document.getElementById('deploymentReportBody');
            if (!tbody) return;
            if (!Array.isArray(data) || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No deployment records found.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(row => `
                <tr>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.name || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.contact || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.address || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.position || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.company || row.fra || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.agency || ''}</td>
                    <td style="padding:8px 10px;border:1px solid #c9dbf5;">${row.dateDeployed ? new Date(row.dateDeployed).toLocaleDateString() : ''}</td>
                </tr>
            `).join('');
        }

        async function loadDeploymentReport() {
            const data = await fetchDeploymentReport();
            renderDeploymentReport(data);
        }

        const downloadDeploymentReportBtn = document.getElementById('downloadDeploymentReportBtn');
        if (downloadDeploymentReportBtn) {
            downloadDeploymentReportBtn.addEventListener('click', function() {
                const loader = document.getElementById('csvLoader');
                if (loader) loader.style.display = 'inline-block';
                window.open('https://blueorion-qmsgithub.onrender.com/api/deployment-report/csv', '_blank');
                setTimeout(() => { if (loader) loader.style.display = 'none'; }, 1500);
            });
        }

        // Load deployment report on page load
        loadDeploymentReport();
        // --- Export ISO 9001 Audit Trail (.csv) ---
        const exportIsoBtn = document.getElementById('exportIsoAuditBtn');
        if (exportIsoBtn) {
            exportIsoBtn.addEventListener('click', async function() {
                try {
                    const res = await fetch('/api/export-iso-audit', {
                        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }
                    });
                    if (!res.ok) {
                        alert('Failed to export ISO 9001 Audit Trail.');
                        return;
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'ISO9001_AuditTrail.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (e) {
                    alert('Error exporting ISO 9001 Audit Trail.');
                }
            });
        }

        // --- Open SQLTools Editor ---
        const openSqlBtn = document.getElementById('openSqlToolsBtn');
        if (openSqlBtn) {
            openSqlBtn.addEventListener('click', function() {
                window.location.href = '/views/sqltools_editor.html';
            });
        }
        window.loadApplicantIntake = async function() {
            const tbody = document.getElementById('applicantTableBody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999;">Loading applicants...</td></tr>';
            let applicants = [];
            try {
                const res = await fetch('/api/sourcing-leads', {
                    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }
                });
                if (res.ok) {
                    applicants = await res.json();
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;color:#c00;">Failed to load applicants.</td></tr>';
                    return;
                }
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;color:#c00;">Error loading applicants.</td></tr>';
                return;
            }
            if (!Array.isArray(applicants) || applicants.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;color:#999;">No applicants found.</td></tr>';
                return;
            }
            tbody.innerHTML = applicants.map(app => {
                const photoUrl = app.documents?.photoPath || '';
                const cvUrl = app.documents?.cvPath || '';
                const passportUrl = app.documents?.passportPath || '';
                return `<tr>
                    <td style="text-align:center;vertical-align:middle;">
                        ${photoUrl ? `<img src="${photoUrl}" alt="Photo" style="width:48px;height:48px;object-fit:cover;border-radius:50%;border:1px solid #ccc;">` : ''}
                    </td>
                    <td style="vertical-align:middle;">
                        <div style="font-weight:600;">${app.candidateName||''}</div>
                        <div style="font-size:12px;color:#555;">${app.email||''}<br>${app.phone||app.contactNumber||''}</div>
                    </td>
                    <td style="vertical-align:middle;">${app.preferredCountry||''}</td>
                    <td style="vertical-align:middle;">${app.positions||app.jobInterest||''}</td>
                    <td style="text-align:center;vertical-align:middle;">
                        ${cvUrl ? `<button onclick="window.previewDocument('${cvUrl}','CV for ${app.candidateName||''}')" style="background:#003366;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:13px;">📄 View CV</button>` : ''}
                        ${passportUrl ? `<button onclick="window.previewDocument('${passportUrl}','Passport for ${app.candidateName||''}')" style="background:#6c757d;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:13px;margin-left:4px;">🛂 Passport</button>` : ''}
                    </td>
                    <td style="text-align:center;vertical-align:middle;">${app.status||''}</td>
                    <td style="text-align:center;vertical-align:middle;">
                        <button onclick="window.approveApplicant('${app.id}')" style="background:#28a745;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:13px;margin-bottom:4px;">APPROVE</button><br>
                        <button onclick="window.rejectApplicant('${app.id}')" style="background:#dc3545;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:13px;">REJECT</button>
                    </td>
                </tr>`;
            }).join('');
        };

        window.previewDocument = function(url, title) {
            const modal = document.getElementById('documentViewerModal');
            const content = document.getElementById('documentContent');
            const docTitle = document.getElementById('documentTitle');
            if (!modal || !content || !docTitle) return;
            docTitle.textContent = title || 'Document Preview';
            if (url.endsWith('.pdf')) {
                content.innerHTML = `<iframe src="${url}" style="width:100%;height:70vh;border:none;"></iframe>`;
            } else {
                content.innerHTML = `<img src="${url}" alt="Document" style="max-width:100%;max-height:70vh;border-radius:8px;">`;
            }
            modal.style.display = 'flex';
        };

        window.closeDocumentViewer = function() {
            const modal = document.getElementById('documentViewerModal');
            if (modal) modal.style.display = 'none';
        };

        window.approveApplicant = async function(applicantId) {
            if (!confirm('Approve this applicant?')) return;
            try {
                const res = await fetch(`/api/lead-approve/${applicantId}`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }
                });
                if (res.ok) {
                    alert('Applicant approved!');
                    window.loadApplicantIntake();
                } else {
                    alert('Failed to approve applicant.');
                }
            } catch (e) {
                alert('Error approving applicant.');
            }
        };

        window.rejectApplicant = async function(applicantId) {
            if (!confirm('Reject this applicant?')) return;
            try {
                const res = await fetch(`/api/lead-reject/${applicantId}`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }
                });
                if (res.ok) {
                    alert('Applicant rejected.');
                    window.loadApplicantIntake();
                } else {
                    alert('Failed to reject applicant.');
                }
            } catch (e) {
                alert('Error rejecting applicant.');
            }
        };

        // Auto-load applicants if on admin page
        if (window.location.pathname.includes('/admin')) {
            window.loadApplicantIntake();
        }
        const signupForm = document.getElementById('signupForm');
        const loginForm = document.getElementById('loginForm');

        async function postJson(url, body) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return response;
        }

        if (signupForm) {
            signupForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const usernameEl = document.getElementById('username');
                const username = usernameEl ? usernameEl.value : undefined;
                const fra = document.getElementById('fraName').value;
                const workerName = document.getElementById('workerName').value.trim();
                const mobile = document.getElementById('mobileNumber') ? document.getElementById('mobileNumber').value.trim() : (document.getElementById('mobile') ? document.getElementById('mobile').value.trim() : '');
                const address = document.getElementById('address').value.trim();
                if (!fra || !workerName || !mobile || !address) {
                    alert('Please fill in all required fields.');
                    return;
                }
                const data = { fra, workerName, mobile, address };
                try {
                    const response = await fetch('/api/fra/add-worker', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (response.ok) {
                        alert('Worker saved successfully!');
                        // Update Orange card instantly
                        if (typeof updateStatCards === 'function') updateStatCards();
                        else if (window.parent && typeof window.parent.updateStatCards === 'function') window.parent.updateStatCards();
                        // Also update Orange card directly if present
                        const countElement = document.getElementById('hired-all-time');
                        if (countElement) {
                            let currentCount = parseInt(countElement.innerText) || 0;
                            countElement.innerText = currentCount + 1;
                        }
                        // Optionally clear form
                        document.getElementById('fraName').value = '';
                        document.getElementById('workerName').value = '';
                        if (document.getElementById('mobileNumber')) document.getElementById('mobileNumber').value = '';
                        if (document.getElementById('mobile')) document.getElementById('mobile').value = '';
                        document.getElementById('address').value = '';
                    } else {
                        alert('Failed to save worker.');
                    }
                } catch (err) {
                    alert('Network error. Please try again.');
                }
            }

            // Render complaints table with status action buttons
            async function refreshComplaintsTable() {
                const table = document.getElementById('complaintsTableBody');
                if (!table) return;
                table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Loading...</td></tr>';
                let complaints = [];
                try {
                    const res = await fetch('/api/welfare-complaints');
                    if (res.ok) complaints = await res.json();
                } catch {}
                if (!complaints.length) {
                    table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No complaints found.</td></tr>';
                    return;
                }
                table.innerHTML = complaints.map(c => {
                    let statusColor = c.status === 'RESOLVED' ? 'green' : (c.status === 'IN PROGRESS' ? 'orange' : 'red');
                    let statusText = `<span style='color:${statusColor};font-weight:bold;'>${c.status || 'OPEN'}</span>`;
                    let actions = '';
                    if (c.status !== 'RESOLVED') {
                        actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','IN PROGRESS')\" style=\"background:#ffc107;color:#333;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:4px;\">In Progress</button>`;
                        actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','RESOLVED')\" style=\"background:#28a745;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;\">Mark Resolved</button>`;
                    }
                    if (c.status !== 'CLOSED') {
                        actions += `<button onclick=\"updateComplaintStatus('${c.referenceNo}','CLOSED')\" style=\"background:#6c757d;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-left:4px;\">Close</button>`;
                    }
                    return `<tr>
                        <td>${new Date(c.date).toLocaleString()}</td>
                        <td>${c.type || ''}</td>
                        <td>${c.details || ''}</td>
                        <td>${statusText}</td>
                        <td>${actions}</td>
                    </tr>`;
                }).join('');
            }

            // Update complaint status handler
            async function updateComplaintStatus(referenceNo, newStatus) {
                try {
                    const res = await fetch(`/api/welfare-complaints/${referenceNo}/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                    if (!res.ok) throw new Error('Failed to update status');
                } catch (e) {
                    alert('Status update failed (demo mode): ' + e.message);
                }
                refreshComplaintsTable();
            }

            if (!response.ok) {
                refreshComplaintsTable();
            });
                const message = await response.text();
                alert('Unable to load profiles: ' + message);
                return [];
            }
            return response.json();
        }

        function getPermissionProfile() {
            try {
                const parsed = JSON.parse(localStorage.getItem('permissionProfile') || '{}');
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            } catch (error) {
                // Ignore invalid JSON and fall back to role-based defaults.
            }
            return {};
        }

        function resolveRoleFromName(userName) {
            const normalized = String(userName || '').toLowerCase();
            const userRoles = {
                charo: 'ADMIN',
                lyndie: 'MANAGER',
                jenny: 'STAFF_FINANCE',
                geneve: 'STAFF_DOCU',
                genevieve: 'STAFF_DOCU'
            };

            for (const key of Object.keys(userRoles)) {
                if (normalized.includes(key)) {
                    return userRoles[key];
                }
            }

            return localStorage.getItem('customRole') || 'STAFF';
        }

        function setDashboardPermissions(userName) {
            const profile = getPermissionProfile();
            const role = resolveRoleFromName(userName);
            const canDelete = Boolean(profile.canDeleteRecords || role === 'ADMIN');
            const canEditBank = Boolean(profile.canEditBankDetails || role === 'ADMIN');
            const canExportIso = Boolean(profile.canExportIsoAudits || role === 'ADMIN');
            const canViewPresidentConsole = Boolean(profile.canViewPresidentConsole || role === 'ADMIN');

            if (!canDelete) {
                document.querySelectorAll('.btn-delete').forEach(el => {
                    el.style.display = 'none';
                });
            }

            if (!canEditBank) {
                document.querySelectorAll('.bank-settings').forEach(el => {
                    el.style.display = 'none';
                });
            }

            if (role === 'STAFF_FINANCE') {
                const recruitmentModule = document.querySelector('#recruitment-module');
                if (recruitmentModule) {
                    recruitmentModule.style.display = 'none';
                }
            }

            const exportBtn = document.getElementById('exportIsoAuditBtn');
            if (exportBtn && !canExportIso) {
                exportBtn.style.display = 'none';
            }

            const downloadReportBtn = document.getElementById('downloadReportBtn');
            if (downloadReportBtn && !canExportIso) {
                downloadReportBtn.style.display = 'none';
            }

            const presidentPanel = document.getElementById('presidentOverridePanel');
            if (presidentPanel) {
                presidentPanel.style.display = canViewPresidentConsole ? 'block' : 'none';
            }
        }

        async function loadPresidentAuditConsole() {
            const panel = document.getElementById('presidentOverridePanel');
            const tbody = document.getElementById('presidentAuditTbody');
            if (!panel || panel.style.display === 'none' || !tbody) {
                return;
            }

            try {
                const response = await fetch('/api/audit-logs', {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    }
                });

                if (!response.ok) {
                    return;
                }

                const logs = await response.json();
                if (!Array.isArray(logs) || logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4">No audit logs found.</td></tr>';
                    return;
                }

                tbody.innerHTML = logs.slice(0, 12).map(log => {
                    const ts = log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A';
                    const user = (log.userId && (log.userId.name || log.userId.email)) || log.userRole || 'System';
                    const action = log.action || 'N/A';
                    const recordId = log.recordId || '-';
                    return `<tr><td>${ts}</td><td>${user}</td><td>${action}</td><td>${recordId}</td></tr>`;
                }).join('');
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="4">Unable to load audit logs.</td></tr>';
            }
        }

        function attachPresidentLockdownHandler() {
            const button = document.getElementById('presidentLockdownBtn');
            if (!button) {
                return;
            }

            button.addEventListener('click', async function() {
                const presidentPassword = prompt('President password required to continue:');
                if (!presidentPassword) {
                    return;
                }

                try {
                    const response = await fetch('/api/security/wipe-lock', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('token'),
                            'x-president-password': presidentPassword
                        },
                        body: JSON.stringify({ presidentPassword })
                    });

                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.message || 'Action failed');
                    }

                    alert(payload.message || 'System lockdown enabled.');
                    await loadPresidentAuditConsole();
                } catch (error) {
                    alert('Security action denied: ' + error.message);
                }
            });
        }

        function renderProfiles(profiles) {
            const container = document.getElementById('searchResults');
            if (!container) return;
            if (!profiles || profiles.length === 0) {
                container.innerHTML = '<p>No profiles found.</p>';
                return;
            }
            const rows = profiles.map(profile => {
                return `
                    <tr>
                        <td>${profile.fullName || ''}</td>
                        <td>${profile.passportNumber || ''}</td>
                        <td>${profile.jobCategory || ''}</td>
                        <td>${profile.deploymentStatus || ''}</td>
                        <td>${profile.email || ''}</td>
                        <td>${profile.contactNumber || ''}</td>
                        <td>${profile.status || ''}</td>
                        <td>${profile.lastContactDate ? new Date(profile.lastContactDate).toLocaleDateString() : ''}</td>
                    </tr>`;
            }).join('');
            container.innerHTML = `
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Passport</th>
                            <th>Job Category</th>
                            <th>Status</th>
                            <th>Email</th>
                            <th>Contact</th>
                            <th>Recruitment Status</th>
                            <th>Last Contact</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }

        function showRestrictedMessage() {
            let overlay = document.getElementById('restrictedMessage');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'restrictedMessage';
                overlay.style.display = 'none';
                overlay.style.position = 'fixed';
                overlay.style.inset = '0';
                overlay.style.background = 'rgba(0, 0, 0, 0.75)';
                overlay.style.color = 'white';
                overlay.style.zIndex = '10000';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.textAlign = 'center';
                overlay.style.padding = '24px';
                overlay.innerHTML = `
                    <div style="max-width: 460px; background: #1f2937; padding: 32px; border-radius: 16px; box-shadow: 0 14px 40px rgba(0,0,0,0.35);">
                        <div style="font-size: 50px; margin-bottom: 14px;">🚫</div>
                        <h2 style="color: #c0392b; margin-bottom: 12px;">Access Restricted</h2>
                        <p style="margin: 0 0 18px; color: #f3f4f6; line-height: 1.6;">This module is reserved for the <strong>Office of the President</strong>.</p>
                        <p style="margin: 0 0 24px; color: #d1d5db;">Please contact the Administrator if you require authorization.</p>
                        <button onclick="hideMessage()" style="background:#003366; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">Back to Dashboard</button>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        }

        function hideMessage() {
            const overlay = document.getElementById('restrictedMessage');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }

        function openSystem(systemId) {
            // This is a placeholder for actual system navigation.
            alert(`Opening System ${systemId}.`);
        }

        function accessSystem(systemId) {
            const userRole = localStorage.getItem('role') || 'guest';
            const normalizedRole = userRole.toLowerCase();
            let allowedModules = [];

            try {
                allowedModules = JSON.parse(localStorage.getItem('allowedModules') || '[]');
            } catch (error) {
                allowedModules = [];
            }

            if (normalizedRole === 'president' || allowedModules === 'all') {
                openSystem(systemId);
                return;
            }

            if (Array.isArray(allowedModules) && allowedModules.includes(systemId)) {
                openSystem(systemId);
                return;
            }

            showRestrictedMessage();
        }

        function attachSystemAccessHandlers() {
            document.querySelectorAll('.nav-links a[data-system-id]').forEach(link => {
                const systemId = parseInt(link.dataset.systemId, 10);
                if (!isNaN(systemId)) {
                    link.addEventListener('click', function(event) {
                        event.preventDefault();
                        accessSystem(systemId);
                    });
                }
            });
        }

        function hoursPassed(timestamp) {
            const started = new Date(timestamp).getTime();
            const now = Date.now();
            if (Number.isNaN(started)) {
                return 0;
            }
            return (now - started) / (1000 * 60 * 60);
        }

        function notifyPresident(message) {
            // Placeholder notification hook for President dashboard alerts.
            alert(message);
        }

        function runWelfareAlerts(cases) {
            if (!Array.isArray(cases)) {
                return;
            }

            cases.forEach(caseItem => {
                if (caseItem.status === 'Open' && hoursPassed(caseItem.created_at) > 48) {
                    notifyPresident('URGENT: Case ' + caseItem.id + ' requires immediate attention!');
                }
            });
        }

        async function generatePdfReport(profiles) {
            if (!profiles || profiles.length === 0) {
                alert('No worker profiles available for report generation.');
                return;
            }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const now = new Date();

            doc.setFontSize(18);
            doc.text('Blueorion Recruitment Services Corp', 14, 20);
            doc.setFontSize(12);
            doc.text('DMW Compliance Summary Report', 14, 28);
            doc.setFontSize(10);
            doc.text(`Report generated: ${now.toLocaleString()}`, 14, 34);
            doc.setFontSize(9);
            doc.text('This report includes worker profiles, deployment status, and last contact details.', 14, 40);

            let y = 50;
            const rowHeight = 8;
            const header = ['Name', 'Passport', 'Category', 'Status', 'Last Contact'];
            doc.setFontSize(9);
            doc.text(header.join(' | '), 14, y);
            y += rowHeight;

            profiles.forEach((profile, index) => {
                const line = [
                    profile.fullName || '',
                    profile.passportNumber || '',
                    profile.jobCategory || '',
                    profile.deploymentStatus || '',
                    profile.lastContactDate ? new Date(profile.lastContactDate).toLocaleDateString() : 'N/A'
                ].join(' | ');
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 14, y);
                y += rowHeight;
            });

            if (y > 250) {
                doc.addPage();
                y = 20;
            }
            doc.setFontSize(10);
            doc.text('Prepared by:', 14, y + 20);
            doc.text('President, Blueorion Recruitment Services Corp', 14, y + 28);
            doc.text('______________________________', 14, y + 32);

            doc.save(`Blueorion_DMW_Report_${now.toISOString().slice(0, 10)}.pdf`);
        }

        async function loadDefaultProfiles() {
            const profiles = await fetchWorkerProfiles();
            renderProfiles(profiles);
            const alerts = await fetchDocumentAlerts();
            renderDocumentAlerts(alerts);
        }

        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const passportNumber = document.getElementById('passportNumber').value;
                const jobCategory = document.getElementById('jobCategory').value;
                const status = document.getElementById('status').value;
                const filters = {};
                if (passportNumber) filters.passportNumber = passportNumber;
                if (jobCategory) filters.jobCategory = jobCategory;
                if (status) filters.status = status;
                const profiles = await fetchWorkerProfiles(filters);
                renderProfiles(profiles);
            });

            const clearBtn = document.getElementById('clearSearch');
            clearBtn.addEventListener('click', async function() {
                searchForm.reset();
                const profiles = await fetchWorkerProfiles();
                renderProfiles(profiles);
            });

            const redAlertBtn = document.getElementById('redAlertBtn');
            if (redAlertBtn) {
                redAlertBtn.addEventListener('click', async function() {
                    const profiles = await fetchWorkerProfiles({ redAlert: 'true' });
                    renderProfiles(profiles);
                });
            }

            const downloadReportBtn = document.getElementById('downloadReportBtn');
            if (downloadReportBtn) {
                downloadReportBtn.addEventListener('click', async function() {
                    const profiles = await fetchWorkerProfiles();
                    await generatePdfReport(profiles);
                });
            }

            const activeUserName = localStorage.getItem('userName') || localStorage.getItem('username') || '';
            setDashboardPermissions(activeUserName);
            attachPresidentLockdownHandler();
            loadPresidentAuditConsole();

            loadDefaultProfiles();
        }

        const token = localStorage.getItem('token');
        if ((window.location.pathname.includes('/admin') || window.location.pathname.includes('/applicant')) && !token) {
            window.location.href = '/login.html';
        }
        attachSystemAccessHandlers();
    });
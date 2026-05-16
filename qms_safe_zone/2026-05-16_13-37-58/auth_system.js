/**
 * ============================================================================
 * BLUEORION RECRUITMENT SERVICES CORP.
 * Authentication & Access Control System (System #6 - QMS Security)
 * ============================================================================
 * 
 * Role-Based Access Control (RBAC) Matrix:
 * - President (Charo Dailo Alaasdi): Full system access (all 17 systems)
 * - QMR (Lyndie B. Jamias): Systems 1, 5, 7, 8 (oversight, resource, audit, docs)
 * - Document Controller (Genevieve B. Caro): Systems 2, 8, 10, 11 (sourcing, docs, profiles, selection)
 * - DPO (Emmanuel Carbonilla): Systems 1, 6, 16 (executive, security, compliance)
 * - Recruitment Officers: Systems 2, 10, 11 (sourcing, profiles, selection)
 * - Welfare Officers: Systems 1, 3, 15 (executive, complaints, welfare)
 * - Accounting: Systems 8, 9, 13 (documents, payments, benefits)
 * 
 * ============================================================================
 */

// Role Definition Matrix
const roleAccessMatrix = {
    president: {
        label: '👑 President',
        allowedSystems: 'all',
        permissions: ['create', 'read', 'update', 'delete', 'approve', 'audit'],
        title: 'Charo Dailo Alaasdi',
        department: 'Executive',
        description: 'Full system access and QMS oversight'
    },

    manager: {
        label: '🧭 Operations Manager',
        allowedSystems: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 14, 15, 16, 17],
        permissions: ['read', 'create', 'update', 'approve', 'audit'],
        title: 'Operations Manager',
        department: 'Operations',
        description: 'Operations oversight without finance access',
        restrictedSystems: [8, 9, 13],
        hideButtons: ['release-payment']
    },
    
    qmr: {
        label: '🛡️ Quality Management Rep',
        allowedSystems: [1, 5, 7, 8, 12],
        permissions: ['read', 'update', 'audit', 'approve'],
        title: 'Lyndie B. Jamias',
        department: 'QMS & Compliance',
        description: 'QMS oversight, audits, document control liaison, training',
        restrictedSystems: [9, 13, 14, 15, 16, 17],
        hideButtons: ['delete-worker', 'release-payment', 'issue-oec']
    },
    
    document_controller: {
        label: '📂 Document Controller',
        allowedSystems: [2, 8, 10, 11],
        permissions: ['read', 'create', 'update'],
        title: 'Genevieve B. Caro',
        department: 'Document Control & Data Entry',
        description: 'Data entry, document verification, record management',
        restrictedSystems: [1, 3, 4, 6, 7, 9, 12, 13, 14, 15, 16, 17],
        hideButtons: ['approve-deployment', 'release-payment', 'issue_oec', 'delete-profile']
    },
    
    dpo: {
        label: '🔒 Data Protection Officer',
        allowedSystems: [1, 6, 16],
        permissions: ['read', 'audit', 'approve'],
        title: 'Emmanuel Carbonilla',
        department: 'Data Privacy & Security',
        description: 'Privacy compliance, access control, breach response',
        restrictedSystems: [2, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 17],
        hideButtons: ['create-lead', 'edit-deployment', 'issue_voucher']
    },
    
    recruitment_lead: {
        label: '👤 Recruitment Officer',
        allowedSystems: [2, 10, 11],
        permissions: ['read', 'create', 'update'],
        title: 'Staff Member',
        department: 'Recruitment Operations',
        description: 'Sourcing, profile management, selection',
        restrictedSystems: [1, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17]
    },
    
    encoder: {
        label: '👤 Data Encoder',
        allowedSystems: [2, 10, 11],
        permissions: ['read', 'create', 'update'],
        title: 'Staff Member',
        department: 'Data Operations',
        description: 'Data entry and record management',
        restrictedSystems: [1, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17]
    },
    
    welfare_officer: {
        label: '👥 Welfare Officer',
        allowedSystems: [1, 3, 15],
        permissions: ['read', 'create', 'update'],
        title: 'Staff Member',
        department: 'Worker Welfare',
        description: 'Welfare monitoring, complaints, quick-checks',
        restrictedSystems: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17]
    },
    
    accounting: {
        label: '💰 Accounting Staff',
        allowedSystems: [8, 9, 13],
        permissions: ['read', 'create', 'update'],
        title: 'Staff Member',
        department: 'Finance & Accounting',
        description: 'Payment processing, invoicing, benefits',
        restrictedSystems: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 14, 15, 16, 17]
    },

    staff: {
        label: '👤 Staff',
        allowedSystems: [2, 10, 11],
        permissions: ['read', 'create', 'update'],
        title: 'Staff Member',
        department: 'Operations',
        description: 'Standard operational access',
        restrictedSystems: [1, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17]
    }
};

// System Names for Display
const systemNames = {
    1: 'Executive Dashboard',
    2: 'Sourcing & Intake (System #2)',
    3: 'Complaints & Grievances',
    4: 'Contract & Re-engagement',
    5: 'Resource & Competence (Org Chart)',
    6: 'QMS Security & Audit Logs',
    7: 'Audit & Improvement',
    8: 'Document Control & Records',
    9: 'Payment & Vouchers',
    10: 'Profiles & Bio-Data',
    11: 'Selection & CV',
    12: 'Interview & Assessment',
    13: 'Benefits & Allowances',
    14: 'Deployment Flight Board',
    15: 'Welfare Monitoring & Quick-Checks',
    16: 'Compliance & Insurance',
    17: 'Deployment History & KPIs'
};

function normalizeStoredRole() {
    const roleRaw = String(
        localStorage.getItem('role') ||
        localStorage.getItem('currentUserRole') ||
        localStorage.getItem('userRole') ||
        'guest'
    ).trim();

    const lower = roleRaw.toLowerCase();
    if (lower === 'president') return 'president';
    if (lower === 'admin') return 'manager';
    if (lower === 'manager') return 'manager';
    if (lower === 'staff') return 'staff';
    if (lower === 'recruitment officer') return 'recruitment_lead';
    if (lower === 'recruitment_lead') return 'recruitment_lead';
    if (lower === 'document controller' || lower === 'document_controller') return 'document_controller';
    if (lower === 'welfare lo' || lower === 'welfare_lo' || lower === 'welfare officer' || lower === 'welfare_officer') return 'welfare_officer';
    if (lower === 'accountant') return 'accounting';
    return lower;
}

function applyEmergencyPresidentOverrideIfPresent() {
    const roleRaw = String(
        localStorage.getItem('userRole') ||
        localStorage.getItem('currentUserRole') ||
        localStorage.getItem('role') ||
        ''
    ).trim().toLowerCase();

    if (roleRaw !== 'president') {
        return false;
    }

    localStorage.setItem('role', 'president');
    if (!localStorage.getItem('username')) {
        localStorage.setItem('username', localStorage.getItem('userName') || 'Charo D. Alaasdi');
    }

    return true;
}

/**
 * Initialize authentication on page load
 * Retrieves user role from localStorage and applies access restrictions
 */
function initializeAuthentication() {
    applyEmergencyPresidentOverrideIfPresent();

    const hasToken = Boolean(localStorage.getItem('token'));
    const hasRole = Boolean(localStorage.getItem('role'));
    const onProtectedPage = window.location.pathname.includes('/admin') || window.location.pathname.includes('/dashboard');
    if (!hasToken && !hasRole && onProtectedPage) {
        window.location.href = '/login.html';
        return;
    }

    const userRole = normalizeStoredRole();
    const userName = localStorage.getItem('username') || localStorage.getItem('userName') || 'Guest User';
    
    // Apply role-based access control
    applyAccessControl(userRole);
    
    // Display user info
    displayUserInfo(userRole, userName);
    
    // Log authentication event
    logAuthenticationEvent(userRole, 'LOGIN', 'Session initialized');
    
    console.log(`✅ Authentication initialized for role: ${userRole}`);

    // If an access overlay exists from a previous restricted state, clear it for President.
    if (userRole === 'president') {
        clearRestrictedOverlay();
    }
}

function clearRestrictedOverlay() {
    const overlays = document.querySelectorAll('.restricted-container, .access-denied-overlay');
    overlays.forEach(el => {
        el.style.display = 'none';
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });

    // Match the user's emergency snippet behavior for existing layouts.
    const restrictedMessage = document.querySelector('.restricted-container');
    if (restrictedMessage) {
        restrictedMessage.style.display = 'none';
    }

    const mainDashboard = document.querySelector('.main-dashboard');
    if (mainDashboard) {
        mainDashboard.style.display = 'block';
    }
}

// EMERGENCY OVERRIDE - DELETE AFTER TESTING
window.presidentialOverride = function presidentialOverride() {
    console.log('Blueorion President Auth Initiated...');
    localStorage.setItem('userRole', 'President');
    localStorage.setItem('userName', 'Charo D. Alaasdi');
    localStorage.setItem('currentUserRole', 'President');
    localStorage.setItem('role', 'president');
    localStorage.setItem('username', 'Charo D. Alaasdi');
    clearRestrictedOverlay();
    applyAccessControl('president');
};

/**
 * Core Access Control Function
 * Hides/shows modules based on user role
 * Called on page load and after login
 */
function applyAccessControl(userRole) {
    const roleConfig = roleAccessMatrix[userRole];
    
    if (!roleConfig) {
        console.warn(`⚠️ Unknown role: ${userRole}. Restricting access.`);
        restrictAllModules();
        return;
    }
    
    const allowedSystems = roleConfig.allowedSystems;
    const restrictedButtons = roleConfig.hideButtons || [];
    
    // Hide/show navigation links based on allowed systems
    document.querySelectorAll('.nav-links a').forEach(link => {
        const systemId = parseInt(link.dataset.systemId, 10);
        
        if (allowedSystems === 'all' || allowedSystems.includes(systemId)) {
            link.style.display = 'block';
            link.classList.remove('restricted');
        } else {
            link.style.display = 'none';
            link.classList.add('restricted');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showAccessDeniedAlert(userRole, systemId);
            });
        }
    });
    
    // Hide restricted action buttons
    restrictedButtons.forEach(btnClass => {
        document.querySelectorAll(`.${btnClass}`).forEach(btn => {
            btn.style.display = 'none';
            btn.classList.add('restricted-button');
        });
    });
    
    // Hide executive-only modules
    const executiveModules = document.querySelectorAll('.executive-only');
    executiveModules.forEach(el => {
        if (userRole === 'president' || userRole === 'admin') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    });
    
    // Apply role-specific restrictions
    applyRoleSpecificRestrictions(userRole, roleConfig);
    
    console.log(`✅ Access control applied for role: ${roleConfig.label}`);
}

/**
 * Apply role-specific UI modifications
 * For example: hide certain columns, disable certain fields, etc.
 */
function applyRoleSpecificRestrictions(userRole, roleConfig) {
    switch(userRole) {
        case 'qmr':
            // QMR can see performance metrics but not financials
            hideElements('.payment-summary, .invoice-grid');
            showElements('.performance-table, .audit-log-viewer, .training-mode');
            disableEditing('.worker-details input:not(.read-only)');
            break;

        case 'manager':
            // Managers can run operations and audits but no finance release actions.
            hideElements('.payment-board, .invoice-grid');
            showElements('.performance-table, .audit-log-viewer, .deployment-board, .welfare-board');
            break;
            
        case 'document_controller':
            // Document Controller can only edit documents and profiles
            hideElements('.deployment-board, .welfare-board, .payment-board');
            showElements('.document-upload, .approval-queue, .version-control');
            disableEditing('.performance-table, .welfare-cases');
            break;
            
        case 'dpo':
            // DPO sees only privacy-related data
            hideElements('.worker-contact-details, .deployment-history');
            showElements('.access-audit-log, .breach-report, .privacy-policy');
            disableEditing('.application-forms, .payment-records');
            break;
            
        case 'recruitment_lead':
        case 'encoder':
        case 'staff':
            // Encoders work on sourcing and data entry
            hideElements('.executive-only, .audit-controls, .payment-board');
            showElements('.application-queue, .selection-table, .profile-form');
            break;
            
        case 'welfare_officer':
            // Welfare officers only see welfare cases
            hideElements('.sourcing-board, .document-board, .payment-board');
            showElements('.welfare-board, .quick-check-panel, .case-log');
            break;
            
        case 'accounting':
            // Accountants see financials only
            hideElements('.sourcing-board, .welfare-board, .deployment-board');
            showElements('.payment-board, .invoice-grid, .benefits-summary');
            break;
            
        default:
            restrictAllModules();
    }
}

/**
 * Utility: Hide HTML elements by selector
 */
function hideElements(selectors) {
    const selectorArray = selectors.split(',').map(s => s.trim());
    selectorArray.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
            el.classList.add('access-restricted');
        });
    });
}

/**
 * Utility: Show HTML elements by selector
 */
function showElements(selectors) {
    const selectorArray = selectors.split(',').map(s => s.trim());
    selectorArray.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = '';
            el.classList.remove('access-restricted');
        });
    });
}

/**
 * Utility: Disable editing for sensitive elements
 */
function disableEditing(selectors) {
    const selectorArray = selectors.split(',').map(s => s.trim());
    selectorArray.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.disabled = true;
            el.classList.add('read-only');
            el.style.opacity = '0.6';
            el.style.cursor = 'not-allowed';
        });
    });
}

/**
 * Restrict all modules (for invalid/guest users)
 */
function restrictAllModules() {
    const onProtectedPage = window.location.pathname.includes('/admin') || window.location.pathname.includes('/dashboard');
    if (onProtectedPage) {
        window.location.href = '/login.html';
        return;
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.style.display = 'none';
    });
    
    document.querySelectorAll('[class*="board"], [class*="grid"]').forEach(el => {
        el.style.Display = 'none';
    });
    
    showAccessDeniedMessage('Guest User', 'Please log in with valid credentials.');
}

/**
 * Display user information in the header
 */
function displayUserInfo(userRole, userName) {
    const roleConfig = roleAccessMatrix[userRole];
    const roleBadge = document.getElementById('roleBadge');
    
    if (roleBadge && roleConfig) {
        roleBadge.innerHTML = `
            <strong>${roleConfig.label}</strong><br>
            <small>${roleConfig.title}</small><br>
            <small style="font-size: 11px; opacity: 0.8;">${roleConfig.department}</small>
        `;
        roleBadge.classList.add(`role-${userRole}`);
    }
    
    // Update welcome message if available
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) {
        welcomeMsg.textContent = `Welcome, ${userName}!`;
    }
}

/**
 * Show alert when access is denied
 */
function showAccessDeniedAlert(userRole, systemId) {
    const systemName = systemNames[systemId] || `System ${systemId}`;
    const roleConfig = roleAccessMatrix[userRole];
    
    alert(
        `🔒 ACCESS DENIED\n\n` +
        `Your role (${roleConfig.label}) does not have access to:\n${systemName}\n\n` +
        `Allowed systems: ${roleConfig.allowedSystems === 'all' ? 'All Systems' : roleConfig.allowedSystems.join(', ')}\n\n` +
        `Contact your QMR (Lyndie B. Jamias) or President for access requests.`
    );
    
    logSecurityEvent('ACCESS_DENIED', userRole, systemId, systemName);
}

/**
 * Show full-page access denied message
 */
function showAccessDeniedMessage(userRole, message) {
    const container = document.body;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    
    overlay.innerHTML = `
        <div style="
            background: white;
            padding: 40px;
            border-radius: 12px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
            <h1 style="color: #dc2626; margin-bottom: 16px;">🔒 Access Denied</h1>
            <p style="color: #666; margin-bottom: 20px;">${message}</p>
            <p style="color: #999; font-size: 14px;">
                Role: <strong>${userRole}</strong><br>
                Time: ${new Date().toLocaleString()}
            </p>
            <button onclick="window.location.href='/login.html'" style="
                background: #003366;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                margin-top: 20px;
            ">Return to Login</button>
        </div>
    `;
    
    container.appendChild(overlay);
}

/**
 * Validate if user has permission for specific action
 */
function hasPermission(userRole, permission) {
    const roleConfig = roleAccessMatrix[userRole];
    if (!roleConfig) return false;
    return roleConfig.permissions.includes(permission);
}

/**
 * Check if user can access specific system
 */
function hasSystemAccess(userRole, systemId) {
    const roleConfig = roleAccessMatrix[userRole];
    if (!roleConfig) return false;
    
    if (roleConfig.allowedSystems === 'all') return true;
    return roleConfig.allowedSystems.includes(systemId);
}

/**
 * Log authentication events for audit trail (System #7)
 */
function logAuthenticationEvent(userRole, eventType, details) {
    const event = {
        timestamp: new Date().toISOString(),
        userRole: userRole,
        eventType: eventType,
        details: details,
        ipAddress: 'browser-session',
        userAgent: navigator.userAgent.substring(0, 100)
    };
    
    // Store in localStorage (temporary audit)
    const auditLog = JSON.parse(localStorage.getItem('authAuditLog') || '[]');
    auditLog.push(event);
    
    // Keep only last 100 events
    if (auditLog.length > 100) {
        auditLog.shift();
    }
    
    localStorage.setItem('authAuditLog', JSON.stringify(auditLog));
    
    console.log(`📋 Auth Event: ${eventType} | Role: ${userRole} | ${details}`);
}

/**
 * Log security events for data privacy (System #6)
 */
function logSecurityEvent(eventType, userRole, systemId, systemName) {
    const event = {
        timestamp: new Date().toISOString(),
        eventType: eventType,
        userRole: userRole,
        systemId: systemId,
        systemName: systemName,
        severity: eventType === 'ACCESS_DENIED' ? 'WARNING' : 'INFO'
    };
    
    const securityLog = JSON.parse(localStorage.getItem('securityEventLog') || '[]');
    securityLog.push(event);
    
    if (securityLog.length > 200) {
        securityLog.shift();
    }
    
    localStorage.setItem('securityEventLog', JSON.stringify(securityLog));
    
    console.log(`🔐 Security Event: ${eventType} | ${userRole} attempted access to ${systemName}`);
}

/**
 * Get user's role profile
 */
function getUserRoleProfile(userRole) {
    return roleAccessMatrix[userRole] || null;
}

/**
 * Get all systems user has access to
 */
function getUserAccessibleSystems(userRole) {
    const roleConfig = roleAccessMatrix[userRole];
    if (!roleConfig) return [];
    
    if (roleConfig.allowedSystems === 'all') {
        return Object.keys(systemNames).map(Number);
    }
    
    return roleConfig.allowedSystems;
}

/**
 * Generate access report for audit
 */
function generateAccessReport(userRole) {
    const roleConfig = roleAccessMatrix[userRole];
    const accessibleSystems = getUserAccessibleSystems(userRole);
    const report = {
        userRole: userRole,
        roleLabel: roleConfig ? roleConfig.label : 'Unknown',
        title: roleConfig ? roleConfig.title : 'N/A',
        department: roleConfig ? roleConfig.department : 'N/A',
        permissions: roleConfig ? roleConfig.permissions : [],
        accessibleSystems: accessibleSystems.map(id => ({
            id: id,
            name: systemNames[id]
        })),
        restrictedSystems: roleConfig ? roleConfig.restrictedSystems || [] : [],
        generatedAt: new Date().toISOString()
    };
    
    return report;
}

/**
 * Logout user and clear session
 */
function logoutUser() {
    const userRole = localStorage.getItem('role');
    logAuthenticationEvent(userRole, 'LOGOUT', 'User session ended');
    
    // Clear sensitive data
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('allowedModules');
    
    // Redirect to login
    window.location.href = '/login.html';
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthentication);
} else {
    initializeAuthentication();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        roleAccessMatrix,
        systemNames,
        applyAccessControl,
        hasPermission,
        hasSystemAccess,
        getUserRoleProfile,
        getUserAccessibleSystems,
        generateAccessReport,
        logoutUser
    };
}

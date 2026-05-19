(function () {
  const MODULE_BY_PATH = {
    '/management': 'management_audit',
    '/contracts': 'contracts_selection',
    '/deployment': 'contracts_selection',
    '/sourcing': 'sourcing_profiles',
    '/sourcing-dashboard': 'sourcing_profiles',
    '/welfare': 'fra_welfare',
    '/fra-admin': 'fra_welfare'
  };

  function detectModule() {
    if (window.__manualBackupModule) return String(window.__manualBackupModule);
    const p = String(location.pathname || '').toLowerCase();
    for (const [prefix, key] of Object.entries(MODULE_BY_PATH)) {
      if (p.startsWith(prefix)) return key;
    }
    return 'management_audit';
  }

  function detectScreen() {
    if (window.__manualBackupScreen) return String(window.__manualBackupScreen);
    return String(location.pathname || '/').replace(/\//g, '_').replace(/^_+/, '') || 'dashboard';
  }

  function ensureStyles() {
    if (document.getElementById('qms-manual-backup-style')) return;
    const style = document.createElement('style');
    style.id = 'qms-manual-backup-style';
    style.textContent = [
      '.qms-save-backup-btn {',
      '  background: linear-gradient(135deg,#065f46,#16a34a);',
      '  color: #fff;',
      '  border: 1px solid rgba(255,255,255,.25);',
      '  border-radius: 8px;',
      '  padding: 8px 14px;',
      '  font-size: 12px;',
      '  font-weight: 800;',
      '  cursor: pointer;',
      '  box-shadow: 0 3px 12px rgba(0,0,0,.18);',
      '}',
      '.qms-save-backup-btn:hover { filter: brightness(1.05); }',
      '.qms-save-backup-btn:disabled { opacity: .65; cursor: wait; }',
      '.qms-save-backup-toast {',
      '  position: fixed;',
      '  right: 20px;',
      '  bottom: 20px;',
      '  z-index: 100000;',
      '  background: #16a34a;',
      '  color: #fff;',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  border-radius: 10px;',
      '  padding: 12px 16px;',
      '  box-shadow: 0 10px 24px rgba(0,0,0,.24);',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function showToast(message, isError) {
    const node = document.createElement('div');
    node.className = 'qms-save-backup-toast';
    if (isError) node.style.background = '#b91c1c';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(function () { node.remove(); }, 3800);
  }

  function getHostContainer() {
    const selectors = [
      '.topbar-right',
      '.topbar-links',
      '.topbar',
      '.hero-top',
      '.board-top',
      '.system-header'
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function collectFormPayload() {
    const out = {};
    const nodes = document.querySelectorAll('input[id], select[id], textarea[id]');
    nodes.forEach(function (el) {
      const tag = (el.tagName || '').toLowerCase();
      const type = String(el.type || '').toLowerCase();
      if (type === 'password' || type === 'file') return;
      const id = el.id;
      if (!id) return;
      if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        out[id] = !!el.checked;
      } else {
        out[id] = el.value;
      }
    });
    return out;
  }

  async function runBeforeHook() {
    if (typeof window.beforeManualSaveBackup !== 'function') {
      return null;
    }
    try {
      return await window.beforeManualSaveBackup();
    } catch (_) {
      return null;
    }
  }

  async function triggerManualSaveBackup(btn) {
    const moduleKey = detectModule();
    const screenKey = detectScreen();

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Securing...';

    try {
      const hookPayload = await runBeforeHook();
      const payload = {
        module: moduleKey,
        screen: screenKey,
        reason: 'Manual compliance freeze',
        savePayload: hookPayload || collectFormPayload()
      };

      const res = await fetch('/api/system/manual-save-backup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = (json && json.error && json.error.message) || (json && json.message) || 'Manual save and backup failed.';
        throw new Error(msg);
      }
      const successMsg = '✓ QMS Status Secured. Manual backup snapshot written successfully to persistent storage.';
      if (typeof window.showToast === 'function') {
        try { window.showToast(successMsg, 'success'); } catch (_) { showToast(successMsg, false); }
      } else if (typeof window.toast === 'function') {
        try { window.toast(successMsg, 'success'); } catch (_) { showToast(successMsg, false); }
      } else {
        showToast(successMsg, false);
      }
    } catch (error) {
      showToast('Manual save and backup failed: ' + error.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  function mountButton() {
    ensureStyles();
    const host = getHostContainer();
    if (!host) return;
    if (document.getElementById('qmsManualSaveBackupButton')) return;

    const btn = document.createElement('button');
    btn.id = 'qmsManualSaveBackupButton';
    btn.className = 'qms-save-backup-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Save and Backup System Status');
    btn.textContent = 'Save and Backup System Status';
    btn.addEventListener('click', function () { triggerManualSaveBackup(btn); });

    host.appendChild(btn);
    window.triggerManualSaveBackup = function () { return triggerManualSaveBackup(btn); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountButton);
  } else {
    mountButton();
  }
})();

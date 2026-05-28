(function () {
  'use strict';

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function createToastContainer() {
    var existing = qs('[data-bo-toast-root]');
    if (existing) return existing;

    var root = document.createElement('div');
    root.setAttribute('data-bo-toast-root', 'true');
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
    root.style.zIndex = '9999';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '8px';
    document.body.appendChild(root);
    return root;
  }

  function showToast(message, type) {
    if (!message) return;
    var root = createToastContainer();
    var toast = document.createElement('div');
    var background = '#0b5ed7';

    if (type === 'error') background = '#b02a37';
    if (type === 'warning') background = '#9a6700';
    if (type === 'success') background = '#146c43';

    toast.textContent = message;
    toast.style.background = background;
    toast.style.color = '#fff';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.maxWidth = '340px';
    toast.style.animation = 'fadeIn 180ms ease-out';
    root.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 180ms ease';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 180);
    }, 2800);
  }

  function normalizeHealthText(healthValue) {
    var value = String(healthValue || '').toLowerCase();
    if (value.indexOf('operational') !== -1) return { text: 'System Operational', className: '' };
    if (value.indexOf('warning') !== -1) return { text: 'System Warning', className: 'warn' };
    if (value.indexOf('degraded') !== -1) return { text: 'System Degraded', className: 'bad' };
    return { text: 'System Online', className: '' };
  }

  async function injectSystemHealthChip() {
    var host = qs('.header-bar') || qs('.main-header') || qs('.dashboard-header');
    if (!host || qs('.system-health-chip', host)) return;

    try {
      var response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) return;
      var payload = await response.json();
      var status = normalizeHealthText(payload && payload.data ? payload.data.health : '');

      var chip = document.createElement('span');
      chip.className = 'system-health-chip' + (status.className ? ' ' + status.className : '');
      chip.textContent = status.text;
      chip.title = 'Live status from /api/health';

      host.appendChild(chip);
    } catch (error) {
      // Silent by design. UI still functions if health endpoint is unavailable.
    }
  }

  function renderPasswordHint(passwordInput) {
    var hint = document.createElement('div');
    hint.id = 'signupPasswordHint';
    hint.style.fontSize = '12px';
    hint.style.fontWeight = '600';
    hint.style.marginTop = '6px';
    hint.style.color = '#5f6f82';
    passwordInput.parentNode.appendChild(hint);

    function updateHint() {
      var value = passwordInput.value || '';
      var score = 0;
      if (value.length >= 8) score += 1;
      if (/[A-Z]/.test(value)) score += 1;
      if (/[0-9]/.test(value)) score += 1;
      if (/[^a-zA-Z0-9]/.test(value)) score += 1;

      if (score <= 1) {
        hint.textContent = 'Password strength: Weak';
        hint.style.color = '#b02a37';
      } else if (score <= 3) {
        hint.textContent = 'Password strength: Moderate';
        hint.style.color = '#9a6700';
      } else {
        hint.textContent = 'Password strength: Strong';
        hint.style.color = '#146c43';
      }
    }

    passwordInput.addEventListener('input', updateHint);
    updateHint();
  }

  function wireSignupForm() {
    var form = qs('#signupForm');
    if (!form) return;

    var passwordInput = qs('#password', form);
    if (passwordInput && !qs('#signupPasswordHint', form)) {
      renderPasswordHint(passwordInput);
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var username = (qs('#username', form) || {}).value || '';
      var name = (qs('#name', form) || {}).value || '';
      var email = (qs('#email', form) || {}).value || '';
      var password = (qs('#password', form) || {}).value || '';
      var role = (qs('#role', form) || {}).value || 'applicant';

      if (username.trim().length < 3) {
        showToast('Username must be at least 3 characters.', 'warning');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        showToast('Please enter a valid email address.', 'warning');
        return;
      }
      if (password.length < 8) {
        showToast('Password must be at least 8 characters.', 'warning');
        return;
      }

      var endpoint = form.getAttribute('data-endpoint') || '/api/signup';
      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), name: name.trim(), email: email.trim(), password: password, role: role })
        });

        if (response.status === 404) {
          showToast('Signup API is not enabled yet. Contact admin.', 'error');
          return;
        }

        var body = await response.json().catch(function () { return {}; });
        if (!response.ok) {
          showToast((body && body.error && body.error.message) || body.message || 'Signup failed.', 'error');
          return;
        }

        showToast('Account created. Redirecting to login...', 'success');
        setTimeout(function () {
          window.location.href = '/login.html';
        }, 700);
      } catch (error) {
        showToast('Network error while submitting signup.', 'error');
      }
    });
  }

  function wireApplicantAnchors() {
    if (!qs('h1') || document.title.toLowerCase().indexOf('applicant') === -1) return;

    var anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach(function (anchor) {
      anchor.addEventListener('click', function (event) {
        event.preventDefault();
        showToast('This module is coming soon in your applicant workspace.', 'warning');
      });
    });
  }

  function ensureFadeAnimation() {
    if (qs('#bo-fade-style')) return;
    var style = document.createElement('style');
    style.id = 'bo-fade-style';
    style.textContent = '@keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }';
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureFadeAnimation();
    wireSignupForm();
    wireApplicantAnchors();
    injectSystemHealthChip();
  });

  window.BLUEORION_UI = {
    showToast: showToast,
    injectSystemHealthChip: injectSystemHealthChip
  };
})();

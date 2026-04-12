const CONFIG = {
  API_BASE: 'http://localhost:8080',
  MOCK_BASE: 'http://localhost:3000',
  USE_MOCK: true,
  UI_ONLY: true
};

const UNIT_MAP = {
  LengthUnit: ['FEET', 'INCHES', 'YARD'],
  WeightUnit: ['GRAM', 'KILOGRAM', 'TONNE'],
  VolumeUnit: ['MILLILITER', 'LITER', 'KILOLITER', 'GALLON'],
  TemperatureUnit: ['CELSIUS', 'FAHRENHEIT', 'KELVIN']
};

const OP_KEYS = ['COMPARE', 'ADD', 'SUBTRACT', 'DIVIDE', 'CONVERT'];

const OP_UI = {
  compare: { api: 'compare', id: 'COMPARE', icon: '', label: 'Compare' },
  add: { api: 'add', id: 'ADD', icon: '', label: 'Add' },
  subtract: { api: 'subtract', id: 'SUBTRACT', icon: '', label: 'Subtract' },
  divide: { api: 'divide', id: 'DIVIDE', icon: '', label: 'Divide' },
  convert: { api: 'convert', id: 'CONVERT', icon: '', label: 'Convert' }
};

const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
const MOCK_STORE_KEY = 'qm_mock_store';
const THEME_VERSION_KEY = 'qm_theme_version';
const THEME_VERSION = '2';

const Theme = {
  init() {
    const savedVersion = localStorage.getItem(THEME_VERSION_KEY);
    if (savedVersion !== THEME_VERSION) {
      localStorage.setItem('qm_theme', 'light');
      localStorage.setItem(THEME_VERSION_KEY, THEME_VERSION);
    }

    const saved = localStorage.getItem('qm_theme');
    const mode = saved === 'dark' ? 'dark' : 'light';
    this.apply(mode);
  },
  apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('qm_theme', next);
    this.apply(next);
    this.refreshButtons();
  },
  iconSvg() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    if (current === 'dark') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.2 14.3A8.3 8.3 0 1 1 9.7 3.8a7.4 7.4 0 0 0 10.5 10.5z"></path></svg>';
  },
  refreshButtons() {
    document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      btn.classList.add('theme-icon-btn');
      btn.innerHTML = Theme.iconSvg();
      btn.setAttribute('aria-label', current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('title', current === 'dark' ? 'Light mode' : 'Dark mode');
    });
  }
};

const Auth = {
  save(data, remember = true) {
    const serialized = JSON.stringify(data);
    if (remember) {
      localStorage.setItem('qm_auth', serialized);
      sessionStorage.removeItem('qm_auth');
    } else {
      sessionStorage.setItem('qm_auth', serialized);
      localStorage.removeItem('qm_auth');
    }
  },
  get() {
    try {
      const fromSession = sessionStorage.getItem('qm_auth');
      if (fromSession) return JSON.parse(fromSession);
      return JSON.parse(localStorage.getItem('qm_auth') || 'null');
    } catch (e) {
      return null;
    }
  },
  token() {
    return this.get()?.token || null;
  },
  user() {
    return this.get() || null;
  },
  isLoggedIn() {
    return Boolean(this.token());
  },
  isAdmin() {
    const roles = this.user()?.roles || [];
    return roles.includes('ROLE_ADMIN') || roles.includes('ADMIN');
  },
  logout(redirect = 'index.html') {
    localStorage.removeItem('qm_auth');
    sessionStorage.removeItem('qm_auth');
    window.location.href = redirect;
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },
  requireAdmin() {
    if (!this.isAdmin()) {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }
};

const API = {
  base() {
    const rawBase = CONFIG.USE_MOCK ? CONFIG.MOCK_BASE : CONFIG.API_BASE;
    try {
      const baseUrl = new URL(rawBase);
      const isLocalPage = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isLocalApi = ['localhost', '127.0.0.1'].includes(baseUrl.hostname);

      // Keep local dev host consistent (localhost vs 127.0.0.1) to avoid avoidable CORS mismatches.
      if (isLocalPage && isLocalApi) {
        baseUrl.hostname = window.location.hostname;
      }

      return baseUrl.toString().replace(/\/$/, '');
    } catch (e) {
      return rawBase;
    }
  },
  async call(path, method = 'GET', body) {
    if (CONFIG.UI_ONLY) {
      return MockAPI.call(path, method, body);
    }

    const token = Auth.token();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`
    };

    let response;
    try {
      response = await fetch(`${this.base()}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (error) {
      const apiOrigin = new URL(this.base()).origin;
      const pageOrigin = window.location.origin;
      if (apiOrigin !== pageOrigin) {
        throw new Error(
          `Network/CORS error. You are running the UI on ${pageOrigin} but API is ${apiOrigin}. Open the app from http://localhost:8080/index.html or enable CORS in Spring Boot.`
        );
      }
      throw new Error('Unable to reach backend. Make sure Spring Boot is running on http://localhost:8080.');
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (response.status === 401) {
      Auth.logout();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.errorMessage ||
        data?.error ||
        `Request failed (${response.status}).`;
      throw new Error(message);
    }

    return data;
  }
};

const MockAPI = {
  seed() {
    return {
      nextUserId: 2,
      nextMeasurementId: 17,
      users: [
        {
          id: 1,
          username: 'admin',
          email: 'admin@quantimeasure.app',
          fullName: 'Alicia Admin',
          provider: 'LOCAL',
          roles: ['ROLE_ADMIN', 'ROLE_USER'],
          createdAt: '2026-01-08T09:15:00',
          password: 'Admin@123'
        }
      ],
      measurements: [
        {
          id: 11,
          thisValue: 3,
          thisUnit: 'FEET',
          thisMeasurementType: 'LengthUnit',
          thatValue: 36,
          thatUnit: 'INCHES',
          thatMeasurementType: 'LengthUnit',
          operation: 'COMPARE',
          resultValue: 'true',
          resultUnit: '',
          errorMessage: null,
          error: false,
          createdAt: '2026-03-25T10:00:00'
        },
        {
          id: 12,
          thisValue: 2,
          thisUnit: 'KILOGRAM',
          thisMeasurementType: 'WeightUnit',
          thatValue: 500,
          thatUnit: 'GRAM',
          thatMeasurementType: 'WeightUnit',
          operation: 'ADD',
          resultValue: '2.5',
          resultUnit: 'KILOGRAM',
          errorMessage: null,
          error: false,
          createdAt: '2026-03-25T10:30:00'
        },
        {
          id: 13,
          thisValue: 9,
          thisUnit: 'LITER',
          thisMeasurementType: 'VolumeUnit',
          thatValue: 0,
          thatUnit: 'LITER',
          thatMeasurementType: 'VolumeUnit',
          operation: 'DIVIDE',
          resultValue: '',
          resultUnit: '',
          errorMessage: 'Cannot divide by zero',
          error: true,
          createdAt: '2026-03-30T09:01:00'
        }
      ]
    };
  },
  read() {
    try {
      const raw = localStorage.getItem(MOCK_STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // Fall through to reseed.
    }
    const seeded = this.seed();
    this.write(seeded);
    return seeded;
  },
  write(data) {
    localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(data));
  },
  authFromUser(user) {
    return {
      token: `mock-token-${user.id}-${Date.now()}`,
      type: 'Bearer',
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles || ['ROLE_USER'],
      provider: user.provider || 'LOCAL',
      createdAt: user.createdAt
    };
  },
  convertToBase(type, value, unit) {
    const v = Number(value);
    if (type === 'LengthUnit') {
      if (unit === 'FEET') return v * 12;
      if (unit === 'YARD') return v * 36;
      return v;
    }
    if (type === 'WeightUnit') {
      if (unit === 'KILOGRAM') return v * 1000;
      if (unit === 'TONNE') return v * 1000000;
      return v;
    }
    if (type === 'VolumeUnit') {
      if (unit === 'LITER') return v * 1000;
      if (unit === 'KILOLITER') return v * 1000000;
      if (unit === 'GALLON') return v * 3785.41;
      return v;
    }
    if (type === 'TemperatureUnit') {
      if (unit === 'FAHRENHEIT') return ((v - 32) * 5) / 9;
      if (unit === 'KELVIN') return v - 273.15;
      return v;
    }
    return v;
  },
  convertFromBase(type, value, unit) {
    const v = Number(value);
    if (type === 'LengthUnit') {
      if (unit === 'FEET') return v / 12;
      if (unit === 'YARD') return v / 36;
      return v;
    }
    if (type === 'WeightUnit') {
      if (unit === 'KILOGRAM') return v / 1000;
      if (unit === 'TONNE') return v / 1000000;
      return v;
    }
    if (type === 'VolumeUnit') {
      if (unit === 'LITER') return v / 1000;
      if (unit === 'KILOLITER') return v / 1000000;
      if (unit === 'GALLON') return v / 3785.41;
      return v;
    }
    if (type === 'TemperatureUnit') {
      if (unit === 'FAHRENHEIT') return (v * 9) / 5 + 32;
      if (unit === 'KELVIN') return v + 273.15;
      return v;
    }
    return v;
  },
  quantityResult(op, body) {
    const q1 = body?.thisQuantityDTO || {};
    const q2 = body?.thatQuantityDTO || {};
    const sameType = q1.measurementType && q1.measurementType === q2.measurementType;
    const b1 = this.convertToBase(q1.measurementType, q1.value, q1.unit);
    const b2 = this.convertToBase(q2.measurementType, q2.value, q2.unit);
    let resultValue = '';
    let resultUnit = q2.unit || q1.unit || '';
    let error = false;
    let errorMessage = null;

    if (!sameType) {
      error = true;
      errorMessage = 'Measurement types must match.';
    } else if (op === 'DIVIDE' && Number(b2) === 0) {
      error = true;
      errorMessage = 'Cannot divide by zero';
    } else if (op === 'COMPARE') {
      resultValue = String(Math.abs(b1 - b2) < 1e-9);
      resultUnit = '';
    } else if (op === 'ADD') {
      resultValue = String(this.convertFromBase(q1.measurementType, b1 + b2, q1.unit));
      resultUnit = q1.unit;
    } else if (op === 'SUBTRACT') {
      resultValue = String(this.convertFromBase(q1.measurementType, b1 - b2, q1.unit));
      resultUnit = q1.unit;
    } else if (op === 'DIVIDE') {
      resultValue = String(b1 / b2);
      resultUnit = '';
    } else if (op === 'CONVERT') {
      resultValue = String(this.convertFromBase(q1.measurementType, b1, q2.unit));
      resultUnit = q2.unit;
    }

    return { resultValue, resultUnit, error, errorMessage };
  },
  async call(path, method = 'GET', body) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    const verb = String(method || 'GET').toUpperCase();
    const store = this.read();

    if (verb === 'POST' && path === '/auth/register') {
      const email = String(body?.email || '').trim().toLowerCase();
      if (!email || !body?.password) throw new Error('Email and password are required.');
      const exists = store.users.some((u) => u.email.toLowerCase() === email);
      if (exists) throw new Error('User already exists with this email.');

      const user = {
        id: store.nextUserId++,
        username: body.username || email.split('@')[0],
        email,
        fullName: body.fullName || (body.username || email.split('@')[0]),
        provider: 'LOCAL',
        roles: ['ROLE_USER'],
        createdAt: new Date().toISOString(),
        password: body.password
      };
      store.users.push(user);
      this.write(store);
      return this.authFromUser(user);
    }

    if (verb === 'POST' && path === '/auth/login') {
      const email = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');
      const user = store.users.find((u) => u.email.toLowerCase() === email && u.password === password);
      if (!user) throw new Error('Invalid email or password.');
      return this.authFromUser(user);
    }

    if (verb === 'GET' && path === '/users/me') {
      const auth = Auth.user();
      if (!auth?.id) throw new Error('Not authenticated.');
      const user = store.users.find((u) => u.id === auth.id);
      if (!user) throw new Error('User not found.');
      const { password, ...safe } = user;
      return safe;
    }

    if (verb === 'GET' && path === '/users/all') {
      if (!Auth.isAdmin()) throw new Error('Access denied (403)');
      return store.users.map((u) => {
        const { password, ...safe } = u;
        return safe;
      });
    }

    if (verb === 'POST' && /^\/api\/v1\/quantities\/(compare|add|subtract|divide|convert)$/.test(path)) {
      const op = path.split('/').pop().toUpperCase();
      const q1 = body?.thisQuantityDTO || {};
      const q2 = body?.thatQuantityDTO || {};
      const calc = this.quantityResult(op, body);
      const rec = {
        id: store.nextMeasurementId++,
        thisValue: Number(q1.value),
        thisUnit: q1.unit,
        thisMeasurementType: q1.measurementType,
        thatValue: Number(q2.value),
        thatUnit: q2.unit,
        thatMeasurementType: q2.measurementType,
        operation: op,
        resultValue: calc.resultValue,
        resultUnit: calc.resultUnit,
        errorMessage: calc.errorMessage,
        error: calc.error,
        createdAt: new Date().toISOString()
      };
      store.measurements.push(rec);
      this.write(store);
      return rec;
    }

    if (verb === 'GET' && /^\/api\/v1\/quantities\/history\/operation\/[A-Z_]+$/.test(path)) {
      const op = path.split('/').pop();
      return store.measurements.filter((m) => m.operation === op);
    }

    if (verb === 'GET' && path === '/api/v1/quantities/history/errored') {
      return store.measurements.filter((m) => m.error);
    }

    if (verb === 'GET' && /^\/api\/v1\/quantities\/count\/[A-Z_]+$/.test(path)) {
      const op = path.split('/').pop();
      return store.measurements.filter((m) => m.operation === op).length;
    }

    throw new Error(`Mock endpoint not implemented: ${verb} ${path}`);
  }
};

const Toast = {
  ensureStack() {
    let stack = document.getElementById('toastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.id = 'toastStack';
      document.body.appendChild(stack);
    }
    return stack;
  },
  show(message, type = 'info') {
    const stack = this.ensureStack();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div>${message}</div><button aria-label="Close">x</button>`;
    stack.appendChild(toast);

    const close = () => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 240);
    };

    toast.querySelector('button').addEventListener('click', close);
    setTimeout(close, 3500);
  }
};

const Utils = {
  fillSelect(el, options, selected) {
    if (!el) return;
    el.innerHTML = options
      .map((opt) => `<option value="${opt}" ${opt === selected ? 'selected' : ''}>${opt}</option>`)
      .join('');
  },
  bindTypeUnitPair(typeSelId, unitSelId) {
    const typeSel = document.getElementById(typeSelId);
    const unitSel = document.getElementById(unitSelId);
    if (!typeSel || !unitSel) return;

    const sync = () => {
      const current = unitSel.value;
      const units = UNIT_MAP[typeSel.value] || [];
      Utils.fillSelect(unitSel, units, units.includes(current) ? current : units[0]);
    };

    typeSel.addEventListener('change', sync);
    sync();
  },
  fmtDate(str) {
    if (!str) return '-';
    const date = new Date(str);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  },
  async copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.textContent = old;
        }, 1500);
      }
      Toast.show('Copied to clipboard.', 'success');
    } catch (e) {
      Toast.show('Clipboard copy failed.', 'error');
    }
  },
  animateNum(el, target, duration = 900) {
    if (!el) return;
    const end = Number(target || 0);
    const startAt = performance.now();
    const step = (now) => {
      const t = Math.min((now - startAt) / duration, 1);
      el.textContent = Math.round(end * t).toString();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  buildInput(v1, u1, t1, v2, u2, t2) {
    return {
      thisQuantityDTO: {
        value: Number(v1),
        unit: u1,
        measurementType: t1
      },
      thatQuantityDTO: {
        value: Number(v2),
        unit: u2,
        measurementType: t2
      }
    };
  },
  formatResult(result, opId) {
    if (!result) return '--';
    if (result.error) return result.errorMessage || 'Operation failed.';

    if (opId === 'COMPARE') {
      return String(result.resultValue || '').toUpperCase() === 'TRUE' ? 'EQUAL' : 'NOT EQUAL';
    }

    const unit = result.resultUnit ? ` ${result.resultUnit}` : '';
    return `${result.resultValue}${unit}`;
  },
  parseOAuthToken() {
    const search = new URLSearchParams(window.location.search);
    const token = search.get('token');
    if (!token) return;

    const authData = {
      token,
      username: search.get('username') || 'oauth-user',
      email: search.get('email') || '',
      fullName: search.get('fullName') || 'OAuth User',
      roles: search.get('roles') ? search.get('roles').split(',') : ['ROLE_USER']
    };
    Auth.save(authData);
    window.location.href = 'dashboard.html';
  }
};

function setButtonLoading(btn, loading, text = '') {
  if (!btn) return;
  if (loading) {
    btn.dataset.prevText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.prevText || text || 'Submit';
  }
}

function deriveIdentityFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || 'user';
  const safeUsername = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user';
  return {
    username: safeUsername,
    fullName: safeUsername
  };
}

function showAppShell() {
  document.getElementById('authShell')?.classList.add('hidden');
  document.getElementById('appShell')?.classList.remove('hidden');
  document.getElementById('themeFloatBtn')?.classList.add('hidden');
}

function showAuthShell() {
  document.getElementById('authShell')?.classList.remove('hidden');
  document.getElementById('appShell')?.classList.add('hidden');
  document.getElementById('themeFloatBtn')?.classList.remove('hidden');
}

function showSuccessPopup(options, onClose) {
  const popup = document.getElementById('successPopup');
  const title = document.getElementById('successTitle');
  const text = document.getElementById('successText');
  const okBtn = document.getElementById('successOkBtn');
  if (!popup || !title || !text || !okBtn) return onClose?.();

  title.textContent = options?.title || 'Done';
  text.textContent = options?.message || 'Completed successfully.';
  okBtn.textContent = options?.buttonText || 'Continue';
  popup.classList.remove('hidden');
  popup.style.display = 'grid';

  const close = () => {
    popup.classList.add('hidden');
    popup.style.display = 'none';
    okBtn.removeEventListener('click', close);
    onClose?.();
  };

  okBtn.addEventListener('click', close);
}

function enforceBackendOrigin() {
  if (CONFIG.USE_MOCK || CONFIG.UI_ONLY) return false;

  try {
    const apiUrl = new URL(API.base());
    const pageUrl = new URL(window.location.href);
    const localHosts = ['localhost', '127.0.0.1'];
    const isLocalPage = localHosts.includes(pageUrl.hostname);
    const isLocalApi = localHosts.includes(apiUrl.hostname);

    if (!isLocalPage || !isLocalApi) return false;

    const targetOrigin = `${pageUrl.protocol}//${pageUrl.hostname}:${apiUrl.port}`;
    if (pageUrl.origin === targetOrigin) return false;

    const target = `${targetOrigin}${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`;
    window.location.replace(target);
    return true;
  } catch (e) {
    return false;
  }
}

function renderNavbar(active) {
  const mount = document.getElementById('navbarMount');
  if (!mount) return;

  const user = Auth.user() || {};
  const username = user.username || 'user';
  const initial = username.charAt(0).toUpperCase();

  const links = [
    { href: 'operations.html', key: 'operations', label: 'Operations' }
  ];

  if (Auth.isAdmin()) {
    links.push({ href: 'admin.html', key: 'admin', label: 'Admin' });
  }

  mount.innerHTML = `
    <nav class="navbar">
      <div class="navbar-inner">
        <a class="brand" href="dashboard.html">
          <span class="brand-mark">Q</span>
          <span class="brand-text">Quantity Measurement App</span>
        </a>
        <div class="nav-links">
          ${links
            .map(
              (l) =>
                `<a class="nav-link ${active === l.key ? 'active' : ''}" href="${l.href}">${l.label}</a>`
            )
            .join('')}
        </div>
        <div class="nav-actions">
          <button data-theme-btn class="btn btn-ghost" id="navThemeBtn" aria-label="Toggle theme" title="Toggle theme"></button>
          <div class="avatar" title="${username}">${initial}</div>
          <button class="btn btn-danger" id="logoutBtn">Logout</button>
        </div>
      </div>
    </nav>
  `;

  document.getElementById('navThemeBtn')?.addEventListener('click', () => Theme.toggle());
  document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
}

function operationBadge(op) {
  const kind = op?.toLowerCase();
  if (kind === 'compare') return 'badge-blue';
  if (kind === 'add' || kind === 'convert') return 'badge-accent';
  if (kind === 'subtract') return 'badge-warning';
  if (kind === 'divide') return 'badge-success';
  return 'badge-error';
}

function renderHistoryItem(rec) {
  const result = rec.error ? rec.errorMessage : `${rec.resultValue}${rec.resultUnit ? ` ${rec.resultUnit}` : ''}`;
  return `
    <div class="card" style="padding:0.85rem; margin-bottom:0.65rem; ${rec.error ? 'border-color: rgba(240,64,64,0.45);' : ''}">
      <div style="display:flex; justify-content:space-between; gap:0.6rem; align-items:center;">
        <span class="badge ${operationBadge(rec.operation)}">${rec.operation}</span>
        <span class="muted mono">${Utils.fmtDate(rec.createdAt)}</span>
      </div>
      <div class="mono" style="margin-top:0.55rem; font-size:0.84rem; color:var(--text2);">
        ${rec.thisValue} ${rec.thisUnit} -> ${rec.thatValue} ${rec.thatUnit}
      </div>
      <div class="mono" style="margin-top:0.2rem; font-weight:700; ${rec.error ? 'color:var(--error);' : 'color:var(--text);'}">
        ${result}
      </div>
    </div>
  `;
}

async function fetchAllOperationHistory() {
  const paths = OP_KEYS.map((op) => `/api/v1/quantities/history/operation/${op}`);
  const grouped = await Promise.all(paths.map((p) => API.call(p)));
  return grouped.flat();
}

async function initIndex() {
  Theme.init();
  Theme.refreshButtons();
  Utils.parseOAuthToken();

  if (Auth.isLoggedIn()) {
    showAppShell();
    await initOperations();
    return;
  }

  showAuthShell();

  document.getElementById('themeFloatBtn')?.addEventListener('click', () => Theme.toggle());

  const signInTab = document.getElementById('signInTab');
  const registerTab = document.getElementById('registerTab');
  const signInForm = document.getElementById('signInForm');
  const registerForm = document.getElementById('registerForm');

  const setTab = (name) => {
    const signIn = name === 'signin';
    signInTab.classList.toggle('active', signIn);
    registerTab.classList.toggle('active', !signIn);
    signInForm.classList.toggle('hidden', !signIn);
    registerForm.classList.toggle('hidden', signIn);
  };

  signInTab.addEventListener('click', () => setTab('signin'));
  registerTab.addEventListener('click', () => setTab('register'));

  document.getElementById('googleBtn')?.addEventListener('click', () => {
    if (CONFIG.UI_ONLY) {
      Toast.show('Google sign-in is disabled in UI-only mode.', 'info');
      return;
    }
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  });

  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('signInError');
    const btn = document.getElementById('signInSubmit');
    err.textContent = '';

    const form = new FormData(signInForm);
    const remember = Boolean(form.get('rememberMe'));
    const payload = {
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || '')
    };

    try {
      setButtonLoading(btn, true, 'Signing In...');
      const data = await API.call('/auth/login', 'POST', payload);
      Auth.save(data, remember);
      showSuccessPopup(
        {
          title: 'Welcome back',
          message: 'You are signed in and ready to start measuring.',
          buttonText: 'Open Operations'
        },
        async () => {
        showAppShell();
        await initOperations();
        }
      );
    } catch (error) {
      err.textContent = error.message;
    } finally {
      setButtonLoading(btn, false, 'Sign In');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('registerError');
    const btn = document.getElementById('registerSubmit');
    err.textContent = '';

    const form = new FormData(registerForm);
    const email = String(form.get('email') || '').trim();
    const enteredName = String(form.get('fullName') || '').trim();
    const identity = deriveIdentityFromEmail(email);
    const payload = {
      fullName: enteredName || identity.fullName,
      username: identity.username,
      email,
      password: String(form.get('password') || '')
    };

    try {
      setButtonLoading(btn, true, 'Creating...');
      const data = await API.call('/auth/register', 'POST', payload);
      Auth.save(data, true);
      showSuccessPopup(
        {
          title: 'Account created',
          message: 'Your account has been set up successfully.',
          buttonText: 'Start Measuring'
        },
        async () => {
        showAppShell();
        await initOperations();
        }
      );
    } catch (error) {
      err.textContent = error.message;
    } finally {
      setButtonLoading(btn, false, 'Register');
    }
  });
}

async function initDashboard() {
  if (!Auth.requireAuth()) return;
  Theme.init();
  renderNavbar('dashboard');
  Theme.refreshButtons();

  const user = Auth.user() || {};
  document.getElementById('welcomeText').textContent = `Welcome back, ${user.username || 'Scientist'}`;

  try {
    const [compare, add, subtract, divide, convert] = await Promise.all(
      OP_KEYS.map((op) => API.call(`/api/v1/quantities/history/operation/${op}`))
    );

    const all = [...compare, ...add, ...subtract, ...divide, ...convert].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    Utils.animateNum(document.getElementById('statTotal'), all.length);
    Utils.animateNum(document.getElementById('statCompare'), compare.length);
    Utils.animateNum(document.getElementById('statAdd'), add.length);
    Utils.animateNum(document.getElementById('statError'), all.filter((r) => r.error).length);

    const recent = all.slice(0, 8);
    const recentWrap = document.getElementById('recentList');
    recentWrap.innerHTML = recent.length
      ? recent.map((rec) => renderHistoryItem(rec)).join('')
      : '<p class="muted">No recent operations yet.</p>';
  } catch (error) {
    Toast.show(error.message, 'error');
  }
}

function setOperationTab(tab, animate = false) {
  document.querySelectorAll('.tab-btn[data-op]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.op === tab);
  });

  const convert = tab === 'convert';
  const secondValueWrap = document.getElementById('secondValueWrap');
  const secondValue = document.getElementById('secondValue');
  const form = document.getElementById('opForm');
  secondValueWrap.classList.toggle('hidden', convert);
  secondValue.required = !convert;

  document.getElementById('leftTitle').textContent = convert ? 'From Quantity' : 'First Quantity';
  document.getElementById('rightTitle').textContent = convert ? 'To Quantity' : 'Second Quantity';

  if (animate && form) {
    form.classList.remove('op-switch');
    void form.offsetWidth;
    form.classList.add('op-switch');
    setTimeout(() => form.classList.remove('op-switch'), 320);
  }
}

async function loadMiniHistory(opUpper) {
  const mini = document.getElementById('miniHistoryList');
  if (!mini) return;

  try {
    const rows = await API.call(`/api/v1/quantities/history/operation/${opUpper}`);
    mini.innerHTML = rows.length
      ? rows
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map((r) => renderHistoryItem(r))
          .join('')
      : '<p class="muted">No history for this operation yet.</p>';
  } catch (e) {
    mini.innerHTML = '<p class="muted">History unavailable.</p>';
  }
}

async function initOperations() {
  if (!Auth.requireAuth()) return;
  Theme.init();
  renderNavbar('operations');
  Theme.refreshButtons();

  const user = Auth.user() || {};
  const displayName = user.fullName || user.username || 'User';
  const welcomeEl = document.getElementById('welcomeText');
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome ${displayName}`;
  }

  if (window.__qmOpsInitialized) return;
  window.__qmOpsInitialized = true;

  const typeOptions = Object.keys(UNIT_MAP);
  Utils.fillSelect(document.getElementById('firstType'), typeOptions, 'LengthUnit');
  Utils.fillSelect(document.getElementById('secondType'), typeOptions, 'LengthUnit');
  Utils.bindTypeUnitPair('firstType', 'firstUnit');
  Utils.bindTypeUnitPair('secondType', 'secondUnit');

  const params = new URLSearchParams(window.location.search);
  const wanted = (params.get('op') || 'compare').toLowerCase();
  let currentTab = OP_UI[wanted] ? wanted : 'compare';
  setOperationTab(currentTab);

  document.querySelectorAll('.tab-btn[data-op]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      currentTab = btn.dataset.op;
      setOperationTab(currentTab, true);
    });
  });

  const form = document.getElementById('opForm');
  const resultBox = document.getElementById('resultBox');
  const resultValue = document.getElementById('resultValue');
  const resultMeta = document.getElementById('resultMeta');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('calculateBtn');
    const firstValue = document.getElementById('firstValue').value;
    const firstUnit = document.getElementById('firstUnit').value;
    const firstType = document.getElementById('firstType').value;

    const secondValInput = document.getElementById('secondValue');
    const secondValue = currentTab === 'convert' ? 0 : secondValInput.value;
    const secondUnit = document.getElementById('secondUnit').value;
    const secondType = document.getElementById('secondType').value;

    const payload = Utils.buildInput(firstValue, firstUnit, firstType, secondValue, secondUnit, secondType);

    try {
      setButtonLoading(btn, true, 'Calculating...');
      const endpoint = `/api/v1/quantities/${OP_UI[currentTab].api}`;
      const response = await API.call(endpoint, 'POST', payload);

      resultBox.className = `result-box show ${response.error ? 'error' : 'success'}`;
      resultValue.textContent = Utils.formatResult(response, OP_UI[currentTab].id);
      resultMeta.textContent = `${response.thisValue} ${response.thisUnit} (${response.thisMeasurementType}) -> ${response.thatValue} ${response.thatUnit} (${response.thatMeasurementType})`;

      Toast.show(response.error ? response.errorMessage || 'Operation returned an error.' : 'Operation complete.', response.error ? 'error' : 'success');
    } catch (error) {
      resultBox.className = 'result-box show error';
      resultValue.textContent = 'ERROR';
      resultMeta.textContent = error.message;
      Toast.show(error.message, 'error');
    } finally {
      setButtonLoading(btn, false, 'Calculate');
    }
  });

}

async function initHistory() {
  if (!Auth.requireAuth()) return;
  Theme.init();
  renderNavbar('history');
  Theme.refreshButtons();

  const chips = document.querySelectorAll('.chip[data-filter]');
  const search = document.getElementById('historySearch');
  let selected = 'ALL';
  let allRows = [];

  const render = () => {
    const text = (search.value || '').toLowerCase().trim();

    const filtered = allRows.filter((row) => {
      const byFilter =
        selected === 'ALL'
          ? true
          : selected === 'ERRORS'
          ? row.error
          : row.operation === selected;

      const searchBlob = `${row.operation} ${row.thisUnit} ${row.thatUnit} ${row.thisMeasurementType} ${row.thatMeasurementType}`.toLowerCase();
      return byFilter && (!text || searchBlob.includes(text));
    });

    const tableBody = document.getElementById('historyRows');
    tableBody.innerHTML = filtered.length
      ? filtered
          .map(
            (r) => `
          <tr class="${r.error ? 'error-row' : ''}">
            <td><span class="badge ${operationBadge(r.operation)}">${r.operation}</span></td>
            <td class="mono">${r.thisValue} ${r.thisUnit} | ${r.thatValue} ${r.thatUnit}</td>
            <td class="mono">${r.error ? r.errorMessage : `${r.resultValue}${r.resultUnit ? ` ${r.resultUnit}` : ''}`}</td>
            <td>${r.error ? '<span class="badge badge-error">Error</span>' : '<span class="badge badge-success">OK</span>'}</td>
            <td class="muted mono">${Utils.fmtDate(r.createdAt)}</td>
          </tr>
        `
          )
          .join('')
      : '<tr><td colspan="5" class="center muted">No operations match your filter.</td></tr>';

    document.getElementById('historyFooter').textContent = `Showing ${filtered.length} of ${allRows.length} operations`;
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selected = chip.dataset.filter;
      chips.forEach((c) => c.classList.toggle('active', c === chip));
      render();
    });
  });

  search.addEventListener('input', render);

  try {
    const [all, errored] = await Promise.all([
      fetchAllOperationHistory(),
      API.call('/api/v1/quantities/history/errored')
    ]);

    const erroredIds = new Set((errored || []).map((e) => e.id));
    allRows = all.map((row) => ({ ...row, error: row.error || erroredIds.has(row.id) }));
    allRows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('historySubtitle').textContent = `${allRows.length} total operations`;
    render();
  } catch (error) {
    Toast.show(error.message, 'error');
  }
}

async function initProfile() {
  if (!Auth.requireAuth()) return;
  Theme.init();
  renderNavbar('profile');
  Theme.refreshButtons();

  try {
    const user = await API.call('/users/me');
    const merged = { ...(Auth.user() || {}), ...user };
    Auth.save(merged);

    const username = user.username || 'user';
    document.getElementById('profileAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = user.fullName || username;
    document.getElementById('profileHandle').textContent = `@${username}`;

    const badgeWrap = document.getElementById('profileBadges');
    const provider = String(user.provider || 'LOCAL').toUpperCase();
    const providerText = provider.includes('GOOGLE') ? 'Google' : 'Local';
    const roleBadges = (user.roles || []).map((r) => `<span class="badge badge-accent">${r}</span>`).join(' ');
    badgeWrap.innerHTML = `${roleBadges} <span class="badge badge-blue">${providerText}</span>`;

    document.getElementById('detailEmail').textContent = user.email || '-';
    document.getElementById('detailUsername').textContent = user.username || '-';
    document.getElementById('detailProvider').textContent = provider;
    document.getElementById('detailCreated').textContent = Utils.fmtDate(user.createdAt);
    document.getElementById('detailStatus').textContent = 'Active';
  } catch (error) {
    Toast.show(error.message, 'error');
  }

  document.getElementById('profileLogout')?.addEventListener('click', () => Auth.logout());
}

async function initAdmin() {
  if (!Auth.requireAuth()) return;
  if (!Auth.isAdmin()) {
    window.location.href = 'dashboard.html';
    return;
  }

  Theme.init();
  renderNavbar('admin');
  Theme.refreshButtons();

  const body = document.getElementById('adminRows');
  const denied = document.getElementById('adminDenied');

  try {
    const users = await API.call('/users/all');
    Utils.animateNum(document.getElementById('adminTotal'), users.length);

    body.innerHTML = users
      .map((u, i) => {
        const roles = (u.roles || []).map((r) => `<span class="badge badge-accent">${r}</span>`).join(' ');
        const provider = String(u.provider || 'LOCAL').toUpperCase();
        const providerBadge = provider.includes('GOOGLE')
          ? '<span class="badge badge-blue">Google</span>'
          : '<span class="badge badge-warning">Local</span>';
        return `
          <tr>
            <td class="mono">${i + 1}</td>
            <td>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <span class="mini-avatar">${(u.username || 'u').charAt(0).toUpperCase()}</span>
                <div>
                  <div>${u.fullName || u.username || '-'}</div>
                  <div class="muted mono">@${u.username || '-'}</div>
                </div>
              </div>
            </td>
            <td>${u.email || '-'}</td>
            <td>${providerBadge}</td>
            <td>${roles || '-'}</td>
            <td class="muted mono">${Utils.fmtDate(u.createdAt)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    if (error.message.includes('403') || error.message.toLowerCase().includes('access denied')) {
      denied.classList.remove('hidden');
      denied.textContent = 'Access denied.';
    } else {
      Toast.show(error.message, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (enforceBackendOrigin()) return;

  if (pageName !== 'index.html') {
    window.location.href = 'index.html';
    return;
  }

  try {
    if (pageName === 'index.html') return await initIndex();
  } catch (e) {
    Toast.show(e.message || 'Unexpected error', 'error');
  }
});

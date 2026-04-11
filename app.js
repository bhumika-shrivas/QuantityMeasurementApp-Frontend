const STORAGE_KEYS = {
  users: 'quantity-measurement-app-users',
  session: 'quantity-measurement-app-session',
  theme: 'quantity-measurement-app-theme',
};

const state = {
  mode: 'login',
  theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light',
  users: loadUsers(),
  session: loadSession(),
};

const elements = {
  themeToggle: document.getElementById('themeToggle'),
  authForm: document.getElementById('authForm'),
  authTitle: document.getElementById('authTitle'),
  loginTab: document.getElementById('loginTab'),
  signupTab: document.getElementById('signupTab'),
  nameLabel: document.getElementById('nameLabel'),
  nameField: document.getElementById('nameField'),
  passwordField: document.getElementById('passwordField'),
  confirmGroup: document.getElementById('confirmGroup'),
  confirmField: document.getElementById('confirmField'),
  signupExtras: document.getElementById('signupExtras'),
  loginExtras: document.getElementById('loginExtras'),
  rememberField: document.getElementById('rememberField'),
  termsField: document.getElementById('termsField'),
  submitButton: document.getElementById('submitButton'),
  togglePassword: document.getElementById('togglePassword'),
  forgotPassword: document.getElementById('forgotPassword'),
  nameError: document.getElementById('nameError'),
  passwordError: document.getElementById('passwordError'),
  confirmError: document.getElementById('confirmError'),
  termsError: document.getElementById('termsError'),
  toast: document.getElementById('toast'),
  helpPopup: document.getElementById('helpPopup'),
  closeHelp: document.getElementById('closeHelp'),
};

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
  } catch {
    return [];
  }
}

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session) || 'null')
      || JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  } catch {
    return null;
  }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(state.users));
}

function saveSession(session, persist) {
  sessionStorage.removeItem(STORAGE_KEYS.session);
  localStorage.removeItem(STORAGE_KEYS.session);

  if (!session) {
    state.session = null;
    return;
  }

  state.session = session;
  const targetStorage = persist ? localStorage : sessionStorage;
  targetStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function setMode(mode) {
  state.mode = mode;
  const isLogin = mode === 'login';

  elements.loginTab.classList.toggle('is-active', isLogin);
  elements.signupTab.classList.toggle('is-active', !isLogin);
  elements.loginTab.setAttribute('aria-selected', String(isLogin));
  elements.signupTab.setAttribute('aria-selected', String(!isLogin));
  elements.authTitle.textContent = isLogin ? 'Welcome back' : 'Create your account';
  elements.nameLabel.textContent = 'Email';
  elements.nameField.placeholder = 'you@example.com';
  elements.submitButton.textContent = isLogin ? 'Login' : 'Sign Up';
  elements.confirmGroup.classList.toggle('is-hidden', isLogin);
  elements.signupExtras.classList.toggle('is-hidden', isLogin);
  elements.loginExtras.classList.toggle('is-hidden', !isLogin);
  clearErrors();
  elements.authForm.reset();
}

function clearErrors() {
  [elements.nameError, elements.passwordError, elements.confirmError, elements.termsError].forEach((node) => {
    node.textContent = '';
    node.parentElement.classList.remove('invalid');
  });
}

function openAuth(mode) {
  setMode(mode);
  elements.nameField.focus();
}

function closeAuth() {
  elements.nameField.blur();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('is-hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.add('is-hidden'), 2600);
}

function validatePasswordStrength(password) {
  const issues = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('one uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('one lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('one number');
  return issues;
}

function findUserByIdentifier(identifier) {
  const normalized = identifier.trim().toLowerCase();
  return state.users.find((user) => user.email.toLowerCase() === normalized);
}

function handleLogin() {
  const identifier = elements.nameField.value.trim();
  const password = elements.passwordField.value;
  let valid = true;

  if (!identifier) {
    elements.nameError.textContent = 'Enter your email address.';
    elements.nameField.parentElement.classList.add('invalid');
    valid = false;
  }

  if (!password) {
    elements.passwordError.textContent = 'Enter your password.';
    elements.passwordField.parentElement.classList.add('invalid');
    valid = false;
  }

  if (!valid) {
    return;
  }

  const user = findUserByIdentifier(identifier);
  if (!user || user.password !== password) {
    elements.passwordError.textContent = 'Invalid login details.';
    elements.passwordField.parentElement.classList.add('invalid');
    return;
  }

  saveSession({ email: user.email }, elements.rememberField.checked);
  showToast('Login successful.');
}

function handleSignup() {
  const email = elements.nameField.value.trim();
  const password = elements.passwordField.value;
  const confirmPassword = elements.confirmField.value;
  let valid = true;

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    elements.nameError.textContent = 'Enter a valid email address.';
    elements.nameField.parentElement.classList.add('invalid');
    valid = false;
  }

  const passwordIssues = validatePasswordStrength(password);
  if (passwordIssues.length) {
    elements.passwordError.textContent = `Password needs ${passwordIssues.join(', ')}.`;
    elements.passwordField.parentElement.classList.add('invalid');
    valid = false;
  }

  if (password !== confirmPassword) {
    elements.confirmError.textContent = 'Passwords do not match.';
    elements.confirmField.parentElement.classList.add('invalid');
    valid = false;
  }

  if (!elements.termsField.checked) {
    elements.termsError.textContent = 'Please accept the terms to continue.';
    elements.termsField.closest('.form-row').classList.add('invalid');
    valid = false;
  }

  if (findUserByIdentifier(email)) {
    elements.nameError.textContent = 'An account already exists with this email.';
    elements.nameField.parentElement.classList.add('invalid');
    valid = false;
  }

  if (!valid) {
    return;
  }

  const user = { email, password };
  state.users.push(user);
  saveUsers();
  saveSession({ email }, false);
  showToast('Account created successfully.');
}

setTheme(state.theme);

elements.themeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

openAuth('login');
elements.loginTab.addEventListener('click', () => setMode('login'));
elements.signupTab.addEventListener('click', () => setMode('signup'));

elements.authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors();
  if (state.mode === 'login') {
    handleLogin();
  } else {
    handleSignup();
  }
});

elements.togglePassword.addEventListener('click', () => {
  const isHidden = elements.passwordField.type === 'password';
  elements.passwordField.type = isHidden ? 'text' : 'password';
  elements.togglePassword.textContent = isHidden ? 'Hide' : 'Show';
});

elements.forgotPassword.addEventListener('click', () => {
  elements.helpPopup.classList.remove('is-hidden');
});

elements.closeHelp.addEventListener('click', () => {
  elements.helpPopup.classList.add('is-hidden');
});

elements.helpPopup.addEventListener('click', (event) => {
  if (event.target === elements.helpPopup) {
    elements.helpPopup.classList.add('is-hidden');
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    elements.helpPopup.classList.add('is-hidden');
  }
});

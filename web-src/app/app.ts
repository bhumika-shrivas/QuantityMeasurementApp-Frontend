import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

type MeasurementType = 'LengthUnit' | 'WeightUnit' | 'VolumeUnit' | 'TemperatureUnit';
type Operation = 'compare' | 'add' | 'subtract' | 'divide' | 'convert';
type ThemeMode = 'light' | 'dark';

interface AuthSession {
  token: string;
  id: number;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  provider?: string;
  createdAt?: string;
}

interface UserRecord {
  id: number;
  username: string;
  email: string;
  fullName: string;
  provider: string;
  roles: string[];
  createdAt: string;
  password: string;
}

interface MeasurementRecord {
  id: number;
  thisValue: number;
  thisUnit: string;
  thisMeasurementType: MeasurementType;
  thatValue: number;
  thatUnit: string;
  thatMeasurementType: MeasurementType;
  operation: string;
  resultValue: string;
  resultUnit: string;
  errorMessage: string | null;
  error: boolean;
  createdAt: string;
}

interface MockStore {
  nextUserId: number;
  nextMeasurementId: number;
  users: UserRecord[];
  measurements: MeasurementRecord[];
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  out: boolean;
}

const UNIT_MAP: Record<MeasurementType, string[]> = {
  LengthUnit: ['FEET', 'INCHES', 'YARD'],
  WeightUnit: ['GRAM', 'KILOGRAM', 'TONNE'],
  VolumeUnit: ['MILLILITER', 'LITER', 'KILOLITER', 'GALLON'],
  TemperatureUnit: ['CELSIUS', 'FAHRENHEIT', 'KELVIN']
};

const OP_META: Record<Operation, { api: string; id: string; label: string }> = {
  compare: { api: 'compare', id: 'COMPARE', label: 'Compare' },
  add: { api: 'add', id: 'ADD', label: 'Add' },
  subtract: { api: 'subtract', id: 'SUBTRACT', label: 'Subtract' },
  divide: { api: 'divide', id: 'DIVIDE', label: 'Divide' },
  convert: { api: 'convert', id: 'CONVERT', label: 'Convert' }
};

const MOCK_STORE_KEY = 'qm_mock_store';
const AUTH_STORAGE_KEY = 'qm_auth';
const THEME_KEY = 'qm_theme';
const THEME_VERSION_KEY = 'qm_theme_version';
const THEME_VERSION = '2';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  readonly OP_UI = OP_META;

  themeMode: ThemeMode = 'light';
  isLoggedIn = false;
  authTab: 'signin' | 'register' = 'signin';

  signInModel = {
    email: '',
    password: '',
    rememberMe: true
  };

  registerModel = {
    fullName: '',
    email: '',
    password: ''
  };

  signInError = '';
  registerError = '';

  signInLoading = false;
  registerLoading = false;
  calculateLoading = false;

  operationTabs: Operation[] = ['compare', 'add', 'subtract', 'divide', 'convert'];
  activeOperation: Operation = 'compare';

  measurementTypes = Object.keys(UNIT_MAP) as MeasurementType[];
  firstType: MeasurementType = 'LengthUnit';
  secondType: MeasurementType = 'LengthUnit';
  firstUnits = UNIT_MAP.LengthUnit;
  secondUnits = UNIT_MAP.LengthUnit;

  firstValue: number | null = null;
  firstUnit = this.firstUnits[0];

  secondValue: number | null = null;
  secondUnit = this.secondUnits[0];

  resultVisible = false;
  resultValue = '--';
  resultMeta = '';
  resultIsError = false;

  popupVisible = false;
  popupTitle = 'Done';
  popupMessage = 'Completed successfully.';
  popupButton = 'Continue';
  private popupAfterClose: (() => void) | null = null;

  toasts: ToastItem[] = [];
  private toastCounter = 0;

  currentUser: AuthSession | null = null;

  ngOnInit(): void {
    this.initTheme();
    this.currentUser = this.getAuth();
    this.isLoggedIn = Boolean(this.currentUser?.token);

    this.syncUnits();
    this.seedStore();

    if (this.isLoggedIn) {
      this.addToast('Welcome back.', 'success');
    }
  }

  setAuthTab(tab: 'signin' | 'register'): void {
    this.authTab = tab;
    this.signInError = '';
    this.registerError = '';
  }

  toggleTheme(): void {
    this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, this.themeMode);
    this.applyTheme();
  }

  get currentUsername(): string {
    return this.currentUser?.username || 'user';
  }

  get currentInitial(): string {
    return this.currentUsername.charAt(0).toUpperCase();
  }

  get welcomeText(): string {
    const fullName = this.currentUser?.fullName || this.currentUser?.username || 'User';
    return `Welcome ${fullName}`;
  }

  get isConvert(): boolean {
    return this.activeOperation === 'convert';
  }

  onFirstTypeChange(): void {
    this.firstUnits = UNIT_MAP[this.firstType];
    if (!this.firstUnits.includes(this.firstUnit)) {
      this.firstUnit = this.firstUnits[0];
    }
  }

  onSecondTypeChange(): void {
    this.secondUnits = UNIT_MAP[this.secondType];
    if (!this.secondUnits.includes(this.secondUnit)) {
      this.secondUnit = this.secondUnits[0];
    }
  }

  setOperation(op: Operation): void {
    this.activeOperation = op;
    if (op === 'convert') {
      this.secondValue = null;
    }
  }

  async signIn(): Promise<void> {
    this.signInError = '';
    this.signInLoading = true;

    try {
      const session = this.loginUser(this.signInModel.email.trim(), this.signInModel.password);
      this.saveAuth(session, this.signInModel.rememberMe);
      this.currentUser = session;
      this.showSuccessPopup(
        'Welcome back',
        'You are signed in and ready to start measuring.',
        'Open Operations',
        () => {
          this.isLoggedIn = true;
          this.addToast('Sign in successful.', 'success');
        }
      );
    } catch (error) {
      this.signInError = this.errorMessage(error);
    } finally {
      this.signInLoading = false;
    }
  }

  async register(): Promise<void> {
    this.registerError = '';
    this.registerLoading = true;

    try {
      const session = this.registerUser(this.registerModel.fullName, this.registerModel.email.trim(), this.registerModel.password);
      this.saveAuth(session, true);
      this.currentUser = session;
      this.showSuccessPopup(
        'Account created',
        'Your account has been set up successfully.',
        'Start Measuring',
        () => {
          this.isLoggedIn = true;
          this.addToast('Registration successful.', 'success');
        }
      );
    } catch (error) {
      this.registerError = this.errorMessage(error);
    } finally {
      this.registerLoading = false;
    }
  }

  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    this.currentUser = null;
    this.isLoggedIn = false;
    this.authTab = 'signin';
    this.signInModel.password = '';
    this.addToast('Logged out.', 'info');
  }

  async submitOperation(): Promise<void> {
    this.calculateLoading = true;

    try {
      if (this.firstValue === null || Number.isNaN(Number(this.firstValue))) {
        throw new Error('Enter a valid first value.');
      }

      if (!this.isConvert && (this.secondValue === null || Number.isNaN(Number(this.secondValue)))) {
        throw new Error('Enter a valid second value.');
      }

      const rec = this.calculateAndStore();
      this.resultVisible = true;
      this.resultIsError = rec.error;
      this.resultValue = this.formatResult(rec, OP_META[this.activeOperation].id);
      this.resultMeta = `${rec.thisValue} ${rec.thisUnit} (${rec.thisMeasurementType}) -> ${rec.thatValue} ${rec.thatUnit} (${rec.thatMeasurementType})`;
      this.addToast(rec.error ? rec.errorMessage || 'Operation returned an error.' : 'Operation complete.', rec.error ? 'error' : 'success');
    } catch (error) {
      this.resultVisible = true;
      this.resultIsError = true;
      this.resultValue = 'ERROR';
      this.resultMeta = this.errorMessage(error);
      this.addToast(this.resultMeta, 'error');
    } finally {
      this.calculateLoading = false;
    }
  }

  closePopup(): void {
    this.popupVisible = false;
    const run = this.popupAfterClose;
    this.popupAfterClose = null;
    if (run) run();
  }

  closeToast(id: number): void {
    const match = this.toasts.find((t) => t.id === id);
    if (!match) return;
    match.out = true;
    window.setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 220);
  }

  private initTheme(): void {
    const savedVersion = localStorage.getItem(THEME_VERSION_KEY);
    if (savedVersion !== THEME_VERSION) {
      localStorage.setItem(THEME_KEY, 'light');
      localStorage.setItem(THEME_VERSION_KEY, THEME_VERSION);
    }

    const saved = localStorage.getItem(THEME_KEY);
    this.themeMode = saved === 'dark' ? 'dark' : 'light';
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.themeMode);
  }

  private syncUnits(): void {
    this.onFirstTypeChange();
    this.onSecondTypeChange();
  }

  private getAuth(): AuthSession | null {
    try {
      const fromSession = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (fromSession) return JSON.parse(fromSession) as AuthSession;
      const fromLocal = localStorage.getItem(AUTH_STORAGE_KEY);
      return fromLocal ? (JSON.parse(fromLocal) as AuthSession) : null;
    } catch {
      return null;
    }
  }

  private saveAuth(session: AuthSession, remember: boolean): void {
    const serialized = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  private seedStore(): void {
    if (localStorage.getItem(MOCK_STORE_KEY)) return;

    const seed: MockStore = {
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
      measurements: []
    };

    localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(seed));
  }

  private readStore(): MockStore {
    const raw = localStorage.getItem(MOCK_STORE_KEY);
    if (!raw) {
      this.seedStore();
      return this.readStore();
    }

    return JSON.parse(raw) as MockStore;
  }

  private writeStore(store: MockStore): void {
    localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(store));
  }

  private loginUser(email: string, password: string): AuthSession {
    if (!email || !password) throw new Error('Email and password are required.');

    const store = this.readStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) throw new Error('Invalid email or password.');

    return this.authFromUser(user);
  }

  private registerUser(fullName: string, email: string, password: string): AuthSession {
    if (!email || !password) throw new Error('Email and password are required.');

    const store = this.readStore();
    const exists = store.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) throw new Error('User already exists with this email.');

    const username = this.deriveUsername(email);
    const user: UserRecord = {
      id: store.nextUserId++,
      username,
      email: email.toLowerCase(),
      fullName: fullName.trim() || username,
      provider: 'LOCAL',
      roles: ['ROLE_USER'],
      createdAt: new Date().toISOString(),
      password
    };

    store.users.push(user);
    this.writeStore(store);
    return this.authFromUser(user);
  }

  private deriveUsername(email: string): string {
    const local = String(email).split('@')[0] || 'user';
    return local.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user';
  }

  private authFromUser(user: UserRecord): AuthSession {
    return {
      token: `mock-token-${user.id}-${Date.now()}`,
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      provider: user.provider,
      createdAt: user.createdAt
    };
  }

  private calculateAndStore(): MeasurementRecord {
    const store = this.readStore();

    const q1Value = Number(this.firstValue);
    const q2Value = this.isConvert ? 0 : Number(this.secondValue);

    const base1 = this.convertToBase(this.firstType, q1Value, this.firstUnit);
    const base2 = this.convertToBase(this.secondType, q2Value, this.secondUnit);

    const sameType = this.firstType === this.secondType;
    let resultValue = '';
    let resultUnit = this.secondUnit;
    let error = false;
    let errorMessage: string | null = null;

    const opId = OP_META[this.activeOperation].id;

    if (!sameType) {
      error = true;
      errorMessage = 'Measurement types must match.';
    } else if (opId === 'DIVIDE' && Number(base2) === 0) {
      error = true;
      errorMessage = 'Cannot divide by zero';
    } else if (opId === 'COMPARE') {
      resultValue = String(Math.abs(base1 - base2) < 1e-9);
      resultUnit = '';
    } else if (opId === 'ADD') {
      resultValue = String(this.convertFromBase(this.firstType, base1 + base2, this.firstUnit));
      resultUnit = this.firstUnit;
    } else if (opId === 'SUBTRACT') {
      resultValue = String(this.convertFromBase(this.firstType, base1 - base2, this.firstUnit));
      resultUnit = this.firstUnit;
    } else if (opId === 'DIVIDE') {
      resultValue = String(base1 / base2);
      resultUnit = '';
    } else if (opId === 'CONVERT') {
      resultValue = String(this.convertFromBase(this.firstType, base1, this.secondUnit));
      resultUnit = this.secondUnit;
    }

    const rec: MeasurementRecord = {
      id: store.nextMeasurementId++,
      thisValue: q1Value,
      thisUnit: this.firstUnit,
      thisMeasurementType: this.firstType,
      thatValue: q2Value,
      thatUnit: this.secondUnit,
      thatMeasurementType: this.secondType,
      operation: opId,
      resultValue,
      resultUnit,
      errorMessage,
      error,
      createdAt: new Date().toISOString()
    };

    store.measurements.push(rec);
    this.writeStore(store);
    return rec;
  }

  private convertToBase(type: MeasurementType, value: number, unit: string): number {
    if (type === 'LengthUnit') {
      if (unit === 'FEET') return value * 12;
      if (unit === 'YARD') return value * 36;
      return value;
    }

    if (type === 'WeightUnit') {
      if (unit === 'KILOGRAM') return value * 1000;
      if (unit === 'TONNE') return value * 1000000;
      return value;
    }

    if (type === 'VolumeUnit') {
      if (unit === 'LITER') return value * 1000;
      if (unit === 'KILOLITER') return value * 1000000;
      if (unit === 'GALLON') return value * 3785.41;
      return value;
    }

    if (unit === 'FAHRENHEIT') return ((value - 32) * 5) / 9;
    if (unit === 'KELVIN') return value - 273.15;
    return value;
  }

  private convertFromBase(type: MeasurementType, value: number, unit: string): number {
    if (type === 'LengthUnit') {
      if (unit === 'FEET') return value / 12;
      if (unit === 'YARD') return value / 36;
      return value;
    }

    if (type === 'WeightUnit') {
      if (unit === 'KILOGRAM') return value / 1000;
      if (unit === 'TONNE') return value / 1000000;
      return value;
    }

    if (type === 'VolumeUnit') {
      if (unit === 'LITER') return value / 1000;
      if (unit === 'KILOLITER') return value / 1000000;
      if (unit === 'GALLON') return value / 3785.41;
      return value;
    }

    if (unit === 'FAHRENHEIT') return (value * 9) / 5 + 32;
    if (unit === 'KELVIN') return value + 273.15;
    return value;
  }

  private formatResult(result: MeasurementRecord, opId: string): string {
    if (result.error) return result.errorMessage || 'Operation failed.';

    if (opId === 'COMPARE') {
      return String(result.resultValue).toUpperCase() === 'TRUE' ? 'EQUAL' : 'NOT EQUAL';
    }

    const unit = result.resultUnit ? ` ${result.resultUnit}` : '';
    return `${result.resultValue}${unit}`;
  }

  private showSuccessPopup(title: string, message: string, buttonText: string, onClose: () => void): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupButton = buttonText;
    this.popupVisible = true;
    this.popupAfterClose = onClose;
  }

  addToast(message: string, type: ToastItem['type']): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type, out: false });

    window.setTimeout(() => {
      this.closeToast(id);
    }, 3500);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unexpected error.';
  }
}

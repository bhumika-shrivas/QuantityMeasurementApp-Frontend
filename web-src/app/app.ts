import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackendApiService, type AuthSession as ApiAuthSession, type QuantityInputDTO, type QuantityMeasurementDTO, type UserRecord as ApiUserRecord } from './backend-api.service';

type MeasurementType = 'LengthUnit' | 'WeightUnit' | 'VolumeUnit' | 'TemperatureUnit';
type Operation = 'compare' | 'add' | 'subtract' | 'divide' | 'convert';
type ThemeMode = 'light' | 'dark';
type AppSection = 'operations' | 'history' | 'users';

interface AuthSession {
  token: string;
  type?: string;
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
  password?: string;
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
  private readonly api = inject(BackendApiService);

  themeMode: ThemeMode = 'light';
  isLoggedIn = false;
  activeSection: AppSection = 'operations';
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
  historyFilter: 'ALL' | 'ERRORS' | 'COMPARE' | 'ADD' | 'SUBTRACT' | 'DIVIDE' | 'CONVERT' = 'ALL';
  historySearch = '';
  historyRows: MeasurementRecord[] = [];
  users: Omit<UserRecord, 'password'>[] = [];

  async ngOnInit(): Promise<void> {
    this.initTheme();
    this.currentUser = this.api.getAuth();
    this.isLoggedIn = Boolean(this.currentUser?.token);

    this.syncUnits();

    if (this.isLoggedIn) {
      await this.bootstrapAuthenticatedState();
      this.addToast('Welcome back.', 'success');
    }
  }

  setSection(section: AppSection): void {
    this.activeSection = section;
    void this.refreshAppData();
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

  get isAdmin(): boolean {
    const roles = this.currentUser?.roles || [];
    return roles.includes('ROLE_ADMIN') || roles.includes('ADMIN');
  }

  get totalOperations(): number {
    return this.historyRows.length;
  }

  get totalErrors(): number {
    return this.historyRows.filter((row) => row.error).length;
  }

  get recentOperations(): MeasurementRecord[] {
    return this.historyRows.slice(0, 5);
  }

  get filteredHistoryRows(): MeasurementRecord[] {
    const searchText = this.historySearch.toLowerCase().trim();
    return this.historyRows.filter((row) => {
      const byFilter =
        this.historyFilter === 'ALL'
          ? true
          : this.historyFilter === 'ERRORS'
            ? row.error
            : row.operation === this.historyFilter;

      if (!byFilter) return false;
      if (!searchText) return true;

      const blob = `${row.operation} ${row.thisUnit} ${row.thatUnit} ${row.thisMeasurementType} ${row.thatMeasurementType}`.toLowerCase();
      return blob.includes(searchText);
    });
  }

  get usersForList(): Omit<UserRecord, 'password'>[] {
    if (this.isAdmin) return this.users;
    const currentId = this.currentUser?.id;
    return this.users.filter((user) => user.id === currentId);
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
      const session = await this.api.login({
        email: this.signInModel.email.trim(),
        password: this.signInModel.password
      });
      this.api.saveAuth(session as ApiAuthSession, this.signInModel.rememberMe);
      this.currentUser = session;
      this.showSuccessPopup(
        'Welcome back',
        'You are signed in and ready to start measuring.',
        'Open Operations',
        () => {
          this.isLoggedIn = true;
          this.activeSection = 'operations';
          void this.bootstrapAuthenticatedState();
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
      const email = this.registerModel.email.trim();
      const username = this.deriveUsername(email);
      const session = await this.api.register({
        fullName: this.registerModel.fullName.trim() || username,
        username,
        email,
        password: this.registerModel.password
      });
      this.api.saveAuth(session as ApiAuthSession, true);
      this.currentUser = session;
      this.showSuccessPopup(
        'Account created',
        'Your account has been set up successfully.',
        'Start Measuring',
        () => {
          this.isLoggedIn = true;
          this.activeSection = 'operations';
          void this.bootstrapAuthenticatedState();
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
    this.api.clearAuth();
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

      const payload = this.buildQuantityInput();
      const rec = await this.api.calculate(this.activeOperation, payload);
      this.resultVisible = true;
      this.resultIsError = rec.error;
      this.resultValue = this.formatResult(rec, OP_META[this.activeOperation].id);
      this.resultMeta = `${rec.thisValue} ${rec.thisUnit} (${rec.thisMeasurementType}) -> ${rec.thatValue} ${rec.thatUnit} (${rec.thatMeasurementType})`;
      await this.refreshAppData();
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

  private async bootstrapAuthenticatedState(): Promise<void> {
    if (!this.currentUser) return;

    try {
      const profile = await this.api.me();
      this.currentUser = {
        ...this.currentUser,
        id: profile.id,
        username: profile.username,
        email: profile.email,
        fullName: profile.fullName,
        roles: profile.roles.map((role) => (typeof role === 'string' ? role : role.name)),
        provider: profile.provider,
        createdAt: profile.createdAt
      };

      const stored = this.api.getAuth();
      if (stored) {
        this.api.saveAuth({ ...stored, ...this.currentUser }, Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY)));
      }

      await this.refreshAppData();
    } catch (error) {
      this.addToast(this.errorMessage(error), 'error');
      this.logout();
    }
  }

  private async refreshAppData(): Promise<void> {
    if (!this.currentUser) return;

    try {
      const opRows = await Promise.all(this.operationTabs.map((operation) => this.api.operationHistory(operation)));
      const errored = await this.api.erroredHistory();
      const erroredIds = new Set(errored.map((row) => row.id));

      this.historyRows = opRows
        .flat()
        .map((row) => ({
          ...row,
          error: row.error || erroredIds.has(row.id)
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (this.isAdmin) {
        const users = await this.api.allUsers();
        this.users = users
          .map((user) => this.normalizeUser(user))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        const profile = await this.api.me();
        this.users = [this.normalizeUser(profile)];
      }
    } catch (error) {
      this.addToast(this.errorMessage(error), 'error');
    }
  }

  private deriveUsername(email: string): string {
    const local = String(email).split('@')[0] || 'user';
    return local.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user';
  }

  private buildQuantityInput(): QuantityInputDTO {
    const firstValue = Number(this.firstValue);
    const secondValue = this.isConvert ? Number(this.firstValue ?? 0) : Number(this.secondValue);

    return {
      thisQuantityDTO: {
        value: firstValue,
        unit: this.firstUnit,
        measurementType: this.firstType
      },
      thatQuantityDTO: {
        value: secondValue,
        unit: this.secondUnit,
        measurementType: this.secondType
      },
      targetUnit: this.isConvert ? this.secondUnit : undefined
    };
  }

  private normalizeUser(user: ApiUserRecord): Omit<UserRecord, 'password'> {
    const roles = (user.roles || []).map((role) => (typeof role === 'string' ? role : role.name));
    const provider = String(user.provider || 'LOCAL').toUpperCase();

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      provider,
      roles,
      createdAt: user.createdAt || new Date().toISOString()
    };
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

  historyResult(row: MeasurementRecord): string {
    if (row.error) return row.errorMessage || 'Operation failed.';
    if (row.operation === 'COMPARE') {
      return String(row.resultValue).toUpperCase() === 'TRUE' ? 'EQUAL' : 'NOT EQUAL';
    }

    const unit = row.resultUnit ? ` ${row.resultUnit}` : '';
    return `${row.resultValue}${unit}`;
  }

  operationBadgeClass(operation: string): string {
    if (operation === 'COMPARE') return 'badge-blue';
    if (operation === 'ADD' || operation === 'CONVERT') return 'badge-accent';
    if (operation === 'SUBTRACT') return 'badge-warning';
    if (operation === 'DIVIDE') return 'badge-success';
    return 'badge-error';
  }

  formatDate(value: string): string {
    if (!value) return '-';
    const parsed = new Date(value);
    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString()}`;
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

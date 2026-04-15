import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

type MeasurementType = 'LengthUnit' | 'WeightUnit' | 'VolumeUnit' | 'TemperatureUnit';
type Operation = 'compare' | 'add' | 'subtract' | 'divide' | 'convert';

export interface AuthSession {
  token: string;
  type: string;
  id: number;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  username: string;
  fullName: string;
}

export interface QuantityDTO {
  value: number;
  unit: string;
  measurementType: MeasurementType;
}

export interface QuantityInputDTO {
  thisQuantityDTO: QuantityDTO;
  thatQuantityDTO?: QuantityDTO;
  targetUnit?: string;
}

export interface QuantityMeasurementDTO {
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

export interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  email: string;
  password?: string;
  provider: string;
  providerId?: string;
  enabled?: boolean;
  roles: Array<{ id?: number; name: 'ROLE_USER' | 'ROLE_ADMIN' } | string>;
  createdAt: string;
  updatedAt?: string;
}

interface ApiErrorBody {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
}

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly baseUrl = 'http://localhost:8080';
  private readonly authKey = 'qm_auth';
  private readonly sessionAuthKey = 'qm_auth';

  constructor(private readonly http: HttpClient) {}

  async register(payload: RegisterRequest): Promise<AuthSession> {
    return this.request<AuthSession>('POST', '/auth/register', payload);
  }

  async login(payload: LoginRequest): Promise<AuthSession> {
    return this.request<AuthSession>('POST', '/auth/login', payload);
  }

  async me(): Promise<UserRecord> {
    return this.request<UserRecord>('GET', '/users/me');
  }

  async allUsers(): Promise<UserRecord[]> {
    return this.request<UserRecord[]>('GET', '/users/all');
  }

  async operationHistory(operation: Operation): Promise<QuantityMeasurementDTO[]> {
    return this.request<QuantityMeasurementDTO[]>('GET', `/api/v1/quantities/history/operation/${operation.toUpperCase()}`);
  }

  async historyByType(measurementType: MeasurementType): Promise<QuantityMeasurementDTO[]> {
    return this.request<QuantityMeasurementDTO[]>('GET', `/api/v1/quantities/history/type/${measurementType}`);
  }

  async erroredHistory(): Promise<QuantityMeasurementDTO[]> {
    return this.request<QuantityMeasurementDTO[]>('GET', '/api/v1/quantities/history/errored');
  }

  async operationCount(operation: Operation): Promise<number> {
    return this.request<number>('GET', `/api/v1/quantities/count/${operation.toUpperCase()}`);
  }

  async calculate(operation: Operation, payload: QuantityInputDTO): Promise<QuantityMeasurementDTO> {
    return this.request<QuantityMeasurementDTO>('POST', `/api/v1/quantities/${operation}`, payload);
  }

  saveAuth(session: AuthSession, remember: boolean): void {
    const serialized = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(this.authKey, serialized);
      sessionStorage.removeItem(this.sessionAuthKey);
      return;
    }

    sessionStorage.setItem(this.sessionAuthKey, serialized);
    localStorage.removeItem(this.authKey);
  }

  getAuth(): AuthSession | null {
    try {
      const fromSession = sessionStorage.getItem(this.sessionAuthKey);
      if (fromSession) return JSON.parse(fromSession) as AuthSession;
      const fromLocal = localStorage.getItem(this.authKey);
      return fromLocal ? (JSON.parse(fromLocal) as AuthSession) : null;
    } catch {
      return null;
    }
  }

  clearAuth(): void {
    localStorage.removeItem(this.authKey);
    sessionStorage.removeItem(this.sessionAuthKey);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = this.buildHeaders();
    const options = {
      headers,
      body: body ?? undefined,
      responseType: 'json' as const,
      observe: 'body' as const
    };

    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.baseUrl}${path}`, options));
    } catch (error) {
      throw new Error(this.readErrorMessage(error));
    }
  }

  private buildHeaders(): HttpHeaders {
    const session = this.getAuth();
    const token = session?.token || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    });
  }

  private readErrorMessage(error: unknown): string {
    const response = error as { status?: number; error?: ApiErrorBody | string; message?: string };
    const body = response?.error;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (body && typeof body === 'object') {
      if (body.message) return body.message;
      if (body.error) return body.error;
    }

    if (response?.message) return response.message;
    if (response?.status === 0) return 'Unable to reach backend. Make sure Spring Boot is running on http://localhost:8080.';

    return 'Request failed.';
  }
}

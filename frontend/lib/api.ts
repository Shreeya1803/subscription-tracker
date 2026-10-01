import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const ACCESS_KEY = 'st_access_token';
const REFRESH_KEY = 'st_refresh_token';

// ---------- token storage (SecureStore on device, AsyncStorage fallback on web) ----------
const store = {
  get: (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v),
  del: (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

export async function saveTokens(accessToken: string, refreshToken: string) {
  await store.set(ACCESS_KEY, accessToken);
  await store.set(REFRESH_KEY, refreshToken);
}
export async function clearTokens() {
  await store.del(ACCESS_KEY);
  await store.del(REFRESH_KEY);
}
export async function hasStoredSession() {
  return Boolean(await store.get(REFRESH_KEY));
}

// ---------- errors ----------
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Nest returns { statusCode, message: string | string[], error }
function extractMessage(body: any, fallback: string) {
  const m = body?.message;
  if (Array.isArray(m)) return m.join('\n');
  if (typeof m === 'string') return m;
  return fallback;
}

// ---------- session-lost hook (AuthContext registers this) ----------
let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(fn: (() => void) | null) {
  onSessionLost = fn;
}

// ---------- refresh (single-flight so parallel 401s trigger only one refresh) ----------
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refreshToken = await store.get(REFRESH_KEY);
        if (!refreshToken) return false;
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        await saveTokens(data.accessToken, data.refreshToken); // backend rotates both
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

// ---------- core request ----------
type Options = { method?: string; body?: unknown; auth?: boolean };

export async function request<T = unknown>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await store.get(ACCESS_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${BASE_URL}. Check your connection and API URL.`);
  }

  if (res.status === 401 && auth && !retried) {
    if (await refreshTokens()) return request<T>(path, opts, true);
    await clearTokens();
    onSessionLost?.();
    throw new ApiError(401, 'Your session expired. Please sign in again.');
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) throw new ApiError(res.status, extractMessage(data, `Request failed (${res.status})`));
  if (data === null && res.status !== 204) {
    throw new ApiError(
      res.status,
      `The server at ${BASE_URL} didn't return valid API data. Check EXPO_PUBLIC_API_URL: it must point to the Nest API (port 3000), not Metro (8081).`,
    );
  }
  return data as T;
}

export const API_BASE_URL = BASE_URL;

// ---------- typed endpoints ----------
export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  defaultCurrency: string;
  premiumStatus: 'free' | 'monthly' | 'annual' | 'lifetime';
};
export type AuthResponse = { user: ApiUser; accessToken: string; refreshToken: string };

export type ApiSubscription = {
  id: string;
  name: string;
  amount: string | number; // Prisma Decimal arrives as a string
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  customCycleDays: number | null;
  nextRenewal: string; // ISO datetime
  category: 'entertainment' | 'utilities' | 'work' | 'health' | 'other';
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  lastUsedDate: string | null;
  status: 'active' | 'paused' | 'canceled';
  notes: string | null;
  createdAt: string;
};

export type ApiDashboardSummary = {
  monthlyTotal: number;
  annualTotal: number;
  mixedCurrencies: boolean;
  currencies: string[];
  upcomingRenewals: ApiSubscription[];
  totalMonthlySaved: number;
};

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  signup: (body: { email: string; password: string; displayName: string; defaultCurrency: string }) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body, auth: false }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      auth: false,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

export const userApi = {
  me: () => request<ApiUser>('/user/me'),
  export: () => request<unknown>('/user/export'),
  remove: () => request<{ message: string }>('/user', { method: 'DELETE' }),
};

export const subscriptionsApi = {
  list: () => request<ApiSubscription[]>('/subscriptions'),
  create: (body: Record<string, unknown>) => request<ApiSubscription>('/subscriptions', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) =>
    request<ApiSubscription>(`/subscriptions/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<{ message: string }>(`/subscriptions/${id}`, { method: 'DELETE' }),
  cancel: (id: string) => request<ApiSubscription>(`/subscriptions/${id}/cancel`, { method: 'POST' }),
};

export const dashboardApi = {
  summary: () => request<ApiDashboardSummary>('/dashboard/summary'),
};

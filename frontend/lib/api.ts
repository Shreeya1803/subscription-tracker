/**
 * Data layer. Same exports and shapes the screens used with the NestJS API, now implemented
 * with Supabase: tables through PostgREST (protected by Row Level Security), app logic through
 * database functions (supabase.rpc) and server-only actions through Edge Functions.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase, SUPABASE_PROJECT_URL } from '@/lib/supabase';

// ---------- errors ----------
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const OFFLINE_MESSAGE = "Can't reach the server. Check your internet connection and try again.";

/** Turns a Supabase error into an ApiError with the same status codes the NestJS API used. */
function toApiError(error: { message?: string; code?: string; status?: number } | PostgrestError, status?: number): ApiError {
  const message = error.message ?? 'Something went wrong.';
  const code = (error as { code?: string }).code;
  const httpStatus = status ?? (error as { status?: number }).status ?? 0;
  if (httpStatus === 0 || /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return new ApiError(0, OFFLINE_MESSAGE, code);
  }
  if (code === 'PGRST116') return new ApiError(404, 'Not found', code); // .single() matched no row
  if (code === '23514') return new ApiError(400, 'Some details are invalid. Please check the form and try again.', code);
  if (httpStatus === 401 || code === 'PGRST301' || code === 'PGRST303') {
    return new ApiError(401, 'Your session expired. Please sign in again.', code);
  }
  return new ApiError(httpStatus, message, code);
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError(401, 'Your session expired. Please sign in again.');
  return id;
}

export const API_BASE_URL = SUPABASE_PROJECT_URL;

// ---------- types (unchanged for the screens) ----------
export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  defaultCurrency: string;
  premiumStatus: 'free' | 'monthly' | 'annual' | 'lifetime';
  premiumExpiresAt?: string | null;
};

export type ApiSubscription = {
  id: string;
  name: string;
  amount: string | number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  customCycleDays: number | null;
  nextRenewal: string; // YYYY-MM-DD
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

// ---------- row mapping (database snake_case <-> app camelCase) ----------
type UserRow = {
  id: string;
  email: string;
  display_name: string;
  default_currency: string;
  premium_status: ApiUser['premiumStatus'];
  premium_expires_at: string | null;
};
const USER_COLUMNS = 'id, email, display_name, default_currency, premium_status, premium_expires_at';

const userFromRow = (r: UserRow): ApiUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  defaultCurrency: r.default_currency,
  premiumStatus: r.premium_status,
  premiumExpiresAt: r.premium_expires_at,
});

type SubscriptionRow = {
  id: string;
  name: string;
  amount: number | string;
  currency: string;
  billing_cycle: ApiSubscription['billingCycle'];
  custom_cycle_days: number | null;
  next_renewal: string;
  category: ApiSubscription['category'];
  reminder_enabled: boolean;
  reminder_days_before: number;
  last_used_date: string | null;
  status: ApiSubscription['status'];
  notes: string | null;
  created_at: string;
};

const subscriptionFromRow = (r: SubscriptionRow): ApiSubscription => ({
  id: r.id,
  name: r.name,
  amount: r.amount,
  currency: r.currency,
  billingCycle: r.billing_cycle,
  customCycleDays: r.custom_cycle_days,
  nextRenewal: r.next_renewal,
  category: r.category,
  reminderEnabled: r.reminder_enabled,
  reminderDaysBefore: r.reminder_days_before,
  lastUsedDate: r.last_used_date,
  status: r.status,
  notes: r.notes,
  createdAt: r.created_at,
});

// Request bodies come from lib/mappers.ts in camelCase; the table uses snake_case.
const SUBSCRIPTION_FIELDS: Record<string, string> = {
  name: 'name',
  amount: 'amount',
  currency: 'currency',
  billingCycle: 'billing_cycle',
  customCycleDays: 'custom_cycle_days',
  nextRenewal: 'next_renewal',
  category: 'category',
  reminderEnabled: 'reminder_enabled',
  reminderDaysBefore: 'reminder_days_before',
  notes: 'notes',
};
function subscriptionToRow(body: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const column = SUBSCRIPTION_FIELDS[key];
    if (column) row[column] = value;
  }
  return row;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
function camelizeDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [camel(k), camelizeDeep(v)]));
  }
  return value;
}

// ---------- auth ----------
export const authApi = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed') {
        throw new ApiError(403, 'Please confirm your email first. We have sent you a new code.', 'EMAIL_NOT_CONFIRMED');
      }
      if (error.code === 'invalid_credentials') throw new ApiError(401, 'Incorrect email or password.', error.code);
      throw toApiError(error);
    }
    return data.session;
  },

  /** Creates the account; Supabase emails a 6-digit code. Returns true when that code still has to be entered. */
  signup: async (body: { email: string; password: string; displayName: string; defaultCurrency: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { display_name: body.displayName, default_currency: body.defaultCurrency } },
    });
    if (error) {
      if (error.code === 'weak_password') throw new ApiError(400, 'Choose a stronger password (at least 8 characters).', error.code);
      throw toApiError(error);
    }
    // Supabase does not reveal whether an email is already registered: an existing, confirmed address
    // comes back with no identities and no email is sent.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new ApiError(409, 'An account with this email already exists. Sign in, or reset your password.', 'EMAIL_TAKEN');
    }
    return !data.session;
  },

  verifySignupCode: async (email: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) {
      if (error.code === 'otp_expired') throw new ApiError(400, 'That code is wrong or has expired. Check the email or send a new code.', error.code);
      throw toApiError(error);
    }
    return data.session;
  },

  resendSignupCode: async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      if (error.code === 'over_email_send_rate_limit') throw new ApiError(429, 'Please wait a minute before asking for another code.', error.code);
      throw toApiError(error);
    }
  },

  /** Always succeeds for a well-formed email, whether or not an account exists (no account enumeration). */
  forgotPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      if (error.code === 'over_email_send_rate_limit') throw new ApiError(429, 'Please wait a minute before asking for another code.', error.code);
      throw toApiError(error);
    }
    return { message: 'If an account exists for this email, a code has been sent.' };
  },

  /** Checks the emailed code, then sets the new password. Leaves the user signed in. */
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) {
      if (error.code === 'otp_expired') throw new ApiError(400, 'That code is wrong or has expired. Check the email or send a new code.', error.code);
      throw toApiError(error);
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      if (updateError.code === 'same_password') throw new ApiError(400, 'Choose a password different from your old one.', updateError.code);
      if (updateError.code === 'weak_password') throw new ApiError(400, 'Choose a stronger password (at least 8 characters).', updateError.code);
      throw toApiError(updateError);
    }
    return { message: 'Password updated' };
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new ApiError(401, 'Your session expired. Please sign in again.');
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (checkError) throw new ApiError(401, 'Your current password is incorrect.', checkError.code);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw toApiError(error);
    return { message: 'Password changed' };
  },

  logout: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },
};

// ---------- user ----------
export const userApi = {
  me: async (): Promise<ApiUser> => {
    const id = await currentUserId();
    const { data, error, status } = await supabase.from('users').select(USER_COLUMNS).eq('id', id).single();
    if (error) throw toApiError(error, status);
    return userFromRow(data as UserRow);
  },

  export: async () => {
    const { data, error, status } = await supabase.rpc('export_my_data');
    if (error) throw toApiError(error, status);
    return camelizeDeep(data);
  },

  /** Deletes the account and all its data (Edge Function: needs the server-side key). */
  remove: async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new ApiError((error as { context?: { status?: number } }).context?.status ?? 0, 'Could not delete your account. Please try again.');
    return { message: 'Account deleted' };
  },
};

// ---------- subscriptions ----------
const SUBSCRIPTION_COLUMNS =
  'id, name, amount, currency, billing_cycle, custom_cycle_days, next_renewal, category, reminder_enabled, reminder_days_before, last_used_date, status, notes, created_at';

export const subscriptionsApi = {
  /** The user's own subscriptions, newest first (household-shared ones from others are not included). */
  list: async (): Promise<ApiSubscription[]> => {
    const id = await currentUserId();
    const { data, error, status } = await supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, status);
    return (data as SubscriptionRow[]).map(subscriptionFromRow);
  },

  /** Rejected with status 403 when a free user already has 3 active subscriptions. */
  create: async (body: Record<string, unknown>): Promise<ApiSubscription> => {
    const { data, error, status } = await supabase
      .from('subscriptions')
      .insert(subscriptionToRow(body))
      .select(SUBSCRIPTION_COLUMNS)
      .single();
    if (error) throw toApiError(error, status);
    return subscriptionFromRow(data as SubscriptionRow);
  },

  update: async (id: string, body: Record<string, unknown>): Promise<ApiSubscription> => {
    const { data, error, status } = await supabase
      .from('subscriptions')
      .update(subscriptionToRow(body))
      .eq('id', id)
      .select(SUBSCRIPTION_COLUMNS)
      .single();
    if (error) throw toApiError(error, status);
    return subscriptionFromRow(data as SubscriptionRow);
  },

  remove: async (id: string) => {
    const { data, error, status } = await supabase.from('subscriptions').delete().eq('id', id).select('id');
    if (error) throw toApiError(error, status);
    if (!data?.length) throw new ApiError(404, 'Subscription not found');
    return { message: 'Subscription deleted' };
  },

  cancel: async (id: string): Promise<ApiSubscription> => {
    const { data, error, status } = await supabase.rpc('cancel_subscription', { p_subscription_id: id });
    if (error) throw toApiError(error, status);
    return subscriptionFromRow(data as SubscriptionRow);
  },

  markUsed: async (id: string): Promise<ApiSubscription> => {
    const { data, error, status } = await supabase.rpc('mark_subscription_used', { p_subscription_id: id });
    if (error) throw toApiError(error, status);
    return subscriptionFromRow(data as SubscriptionRow);
  },
};

// ---------- billing ----------
export const billingApi = {
  /** Asks the server to check RevenueCat now (right after a purchase or restore). Edge Function. */
  sync: async () => {
    const { data, error } = await supabase.functions.invoke('billing-sync', { method: 'POST' });
    if (error) throw new ApiError((error as { context?: { status?: number } }).context?.status ?? 0, 'Could not check your purchase.');
    return data as { premiumStatus: ApiUser['premiumStatus']; premiumExpiresAt: string | null; synced: boolean };
  },
};

// ---------- dashboard ----------
type SummaryRow = {
  monthly_total: number | string;
  annual_total: number | string;
  mixed_currencies: boolean;
  currencies: string[];
  upcoming_renewals: SubscriptionRow[];
  total_monthly_saved: number | string;
};

export const dashboardApi = {
  summary: async (): Promise<ApiDashboardSummary> => {
    const { data, error, status } = await supabase.rpc('dashboard_summary');
    if (error) throw toApiError(error, status);
    const s = data as SummaryRow;
    return {
      monthlyTotal: Number(s.monthly_total),
      annualTotal: Number(s.annual_total),
      mixedCurrencies: s.mixed_currencies,
      currencies: s.currencies ?? [],
      upcomingRenewals: (s.upcoming_renewals ?? []).map(subscriptionFromRow),
      totalMonthlySaved: Number(s.total_monthly_saved),
    };
  },
};
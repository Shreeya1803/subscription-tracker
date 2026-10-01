import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { ApiDashboardSummary, dashboardApi, subscriptionsApi } from '@/lib/api';
import { fromApi, toApiBody, toApiPatch } from '@/lib/mappers';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type Category = 'entertainment' | 'utilities' | 'work' | 'health' | 'other';
export type SubscriptionStatus = 'active' | 'paused' | 'canceled';

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  customCycleDays?: number;
  nextRenewal: string; // YYYY-MM-DD
  category: Category;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  lastUsedDate?: string;
  status: SubscriptionStatus;
  notes?: string;
  createdAt: string;
};

/** Fields the user can set. Status/id/createdAt are server-controlled and never sent. */
export type SubscriptionInput = Pick<
  Subscription,
  'name' | 'amount' | 'currency' | 'billingCycle' | 'customCycleDays' | 'nextRenewal' | 'category' | 'reminderEnabled' | 'reminderDaysBefore' | 'notes'
>;

export type Summary = Pick<
  ApiDashboardSummary,
  'monthlyTotal' | 'annualTotal' | 'mixedCurrencies' | 'currencies' | 'totalMonthlySaved'
>;

type SubscriptionContextValue = {
  subscriptions: Subscription[];
  summary: Summary | null;
  hydrated: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  addSubscription: (input: SubscriptionInput) => Promise<void>;
  updateSubscription: (id: string, input: SubscriptionInput) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  cancelSubscription: (id: string) => Promise<void>;
  monthlyEquivalent: (subscription: Subscription) => number;
};

const CACHE_KEY = 'st_cached_subscriptions';
const DAY_MS = 24 * 60 * 60 * 1000;

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Mirrors backend normalizeToMonthly (weekly 52/12, custom 30.44/days).
function normalizeToMonthly(amount: number, cycle: BillingCycle, customCycleDays?: number) {
  if (cycle === 'custom') {
    return customCycleDays && customCycleDays > 0 ? amount * (30.44 / customCycleDays) : 0;
  }
  const factors = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 } as const;
  return amount * factors[cycle];
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([subscriptionsApi.list(), dashboardApi.summary()]);
      const mapped = list.map(fromApi);
      setSubscriptions(mapped);
      setSummary({
        monthlyTotal: sum.monthlyTotal,
        annualTotal: sum.annualTotal,
        mixedCurrencies: sum.mixedCurrencies,
        currencies: sum.currencies,
        totalMonthlySaved: sum.totalMonthlySaved,
      });
      setLoadError(null);
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mapped)); // offline read access (NFR-5)
    } catch (e: any) {
      if (e?.status === 401) return; // session handler will sign the user out
      setLoadError(e?.message ?? 'Could not load your subscriptions.');
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) setSubscriptions(JSON.parse(cached) as Subscription[]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') {
      setHydrated(false);
      void refresh();
    } else if (status === 'signedOut') {
      setSubscriptions([]);
      setSummary(null);
      setHydrated(false);
    }
  }, [status, refresh]);

  const addSubscription = useCallback(
    async (input: SubscriptionInput) => {
      await subscriptionsApi.create(toApiBody(input)); // throws ApiError (e.g. 403 free-tier limit)
      await refresh();
    },
    [refresh],
  );

  const updateSubscription = useCallback(
    async (id: string, input: SubscriptionInput) => {
      const prev = subscriptions.find((s) => s.id === id);
      if (!prev) return;
      const patch = toApiPatch(prev, input);
      if (Object.keys(patch).length > 0) await subscriptionsApi.update(id, patch);
      await refresh();
    },
    [refresh, subscriptions],
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      await subscriptionsApi.remove(id);
      await refresh();
    },
    [refresh],
  );

  const cancelSubscription = useCallback(
    async (id: string) => {
      await subscriptionsApi.cancel(id); // also creates the saved_event on the server
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      subscriptions,
      summary,
      hydrated,
      loadError,
      refresh,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      cancelSubscription,
      monthlyEquivalent: (s: Subscription) => normalizeToMonthly(s.amount, s.billingCycle, s.customCycleDays),
    }),
    [subscriptions, summary, hydrated, loadError, refresh, addSubscription, updateSubscription, deleteSubscription, cancelSubscription],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptions() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptions must be used inside SubscriptionProvider');
  }
  return context;
}

export function getDaysUntil(dateString: string) {
  const target = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function formatRenewal(dateString: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateString}T12:00:00`));
}

export function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
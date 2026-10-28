import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiUser, authApi, userApi } from '@/lib/api';
import { identifyPurchaser, resetPurchaser } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type SignupInput = { displayName: string; email: string; password: string; defaultCurrency: string };

type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  login: (email: string, password: string) => Promise<void>;
  /** Creates the account and emails a 6-digit code. Resolves to the email the code was sent to. */
  signup: (input: SignupInput) => Promise<string>;
  verifySignupCode: (email: string, code: string) => Promise<void>;
  resendSignupCode: (email: string) => Promise<void>;
  /** Emails a 6-digit reset code (same response whether or not the account exists). */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Checks the reset code, sets the new password and signs the user in. */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const CACHED_USER_KEY = 'st_cached_user';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);
  // While a multi-step auth action runs (e.g. reset: verify code, then set password), Supabase
  // already reports "signed in" after the first step. We only switch screens when the action finishes.
  const busy = useRef(false);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus('signedOut');
  }, []);

  const enterApp = useCallback(async () => {
    const me = await userApi.me();
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
    setUser(me);
    setStatus('signedIn');
    void identifyPurchaser(me.id).catch(() => {});
  }, []);

  const wipeLocal = useCallback(async () => {
    await resetPurchaser();
    await authApi.logout().catch(() => {});
    await AsyncStorage.multiRemove([CACHED_USER_KEY, 'st_cached_subscriptions']);
    endSession();
  }, [endSession]);

  // Restore the session on launch (Supabase keeps it in secure storage and refreshes it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) return endSession();
      try {
        await enterApp();
      } catch (e: any) {
        // Offline at launch: keep the session and show the last known account.
        if (e?.status === 0) {
          const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
          if (cached) {
            const cachedUser = JSON.parse(cached) as ApiUser;
            setUser(cachedUser);
            setStatus('signedIn');
            void identifyPurchaser(cachedUser.id).catch(() => {});
            return;
          }
        }
        await wipeLocal();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endSession, enterApp, wipeLocal]);

  // Session ended elsewhere (refresh token revoked, account deleted, signed out on another screen).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !busy.current) endSession();
    });
    return () => data.subscription.unsubscribe();
  }, [endSession]);

  /** Runs an auth action, then opens the app once it has fully completed. */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      busy.current = true;
      try {
        await action();
        await enterApp();
      } finally {
        busy.current = false;
      }
    },
    [enterApp],
  );

  const login = useCallback(
    (email: string, password: string) => run(() => authApi.login(email.trim().toLowerCase(), password)),
    [run],
  );

  const signup = useCallback(async (input: SignupInput) => {
    const email = input.email.trim().toLowerCase();
    await authApi.signup({
      displayName: input.displayName.trim(),
      email,
      password: input.password,
      defaultCurrency: input.defaultCurrency.trim().toUpperCase(),
    });
    return email;
  }, []);

  const verifySignupCode = useCallback(
    (email: string, code: string) => run(() => authApi.verifySignupCode(email.trim().toLowerCase(), code.trim())),
    [run],
  );

  const resendSignupCode = useCallback((email: string) => authApi.resendSignupCode(email.trim().toLowerCase()), []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authApi.forgotPassword(email.trim().toLowerCase());
  }, []);

  const resetPassword = useCallback(
    (email: string, code: string, newPassword: string) =>
      run(() => authApi.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword)),
    [run],
  );

  const logout = wipeLocal;

  // Re-read the account (plan, name...) from the server. Errors are ignored: the cached user stays.
  const refreshUser = useCallback(async () => {
    try {
      const me = await userApi.me();
      setUser(me);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
    } catch {
      /* offline or session ended: keep what we have */
    }
  }, []);

  // A plan can change while the app is in the background (purchase, renewal, cancellation).
  useEffect(() => {
    if (status !== 'signedIn') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUser();
    });
    return () => sub.remove();
  }, [status, refreshUser]);

  const deleteAccount = useCallback(async () => {
    await userApi.remove();
    await wipeLocal();
  }, [wipeLocal]);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      signup,
      verifySignupCode,
      resendSignupCode,
      requestPasswordReset,
      resetPassword,
      logout,
      deleteAccount,
      refreshUser,
    }),
    [status, user, login, signup, verifySignupCode, resendSignupCode, requestPasswordReset, resetPassword, logout, deleteAccount, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
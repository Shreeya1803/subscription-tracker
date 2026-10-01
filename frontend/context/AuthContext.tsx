import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiUser,
  authApi,
  clearTokens,
  hasStoredSession,
  saveTokens,
  setSessionLostHandler,
  userApi,
} from '@/lib/api';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { displayName: string; email: string; password: string; defaultCurrency: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Restore session on launch (the API client refreshes the access token automatically if needed).
  useEffect(() => {
    setSessionLostHandler(endSession);
    (async () => {
      try {
        if (!(await hasStoredSession())) return endSession();
        const me = await userApi.me();
        setUser(me);
        setStatus('signedIn');
      } catch (e: any) {
        // Offline at launch: keep the session if tokens exist but the server is unreachable.
        if (e?.status === 0) {
          const cached = await AsyncStorage.getItem('st_cached_user');
          if (cached) {
            setUser(JSON.parse(cached));
            return setStatus('signedIn');
          }
        }
        await clearTokens();
        endSession();
      }
    })();
    return () => setSessionLostHandler(null);
  }, [endSession]);

  const finishAuth = useCallback(async (res: { user: ApiUser; accessToken: string; refreshToken: string }) => {
    await saveTokens(res.accessToken, res.refreshToken);
    await AsyncStorage.setItem('st_cached_user', JSON.stringify(res.user));
    setUser(res.user);
    setStatus('signedIn');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => finishAuth(await authApi.login(email.trim(), password)),
    [finishAuth],
  );

  const signup = useCallback(
    async (input: { displayName: string; email: string; password: string; defaultCurrency: string }) =>
      finishAuth(
        await authApi.signup({
          displayName: input.displayName.trim(),
          email: input.email.trim(),
          password: input.password,
          defaultCurrency: input.defaultCurrency.trim().toUpperCase(),
        }),
      ),
    [finishAuth],
  );

  const wipeLocal = useCallback(async () => {
    await clearTokens();
    await AsyncStorage.multiRemove(['st_cached_user', 'st_cached_subscriptions']);
    endSession();
  }, [endSession]);

  const logout = wipeLocal;

  const deleteAccount = useCallback(async () => {
    await userApi.remove();
    await wipeLocal();
  }, [wipeLocal]);

  const value = useMemo(
    () => ({ status, user, login, signup, logout, deleteAccount }),
    [status, user, login, signup, logout, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

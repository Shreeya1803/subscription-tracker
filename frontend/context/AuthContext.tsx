import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  ApiUser,
  authApi,
  clearTokens,
  hasStoredSession,
  saveTokens,
  setSessionLostHandler,
  userApi,
} from '@/lib/api';
import { identifyPurchaser, resetPurchaser } from '@/lib/purchases';


type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { displayName: string; email: string; password: string; defaultCurrency: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
                   void identifyPurchaser(me.id).catch(() => {});
      } catch (e: any) {
        // Offline at launch: keep the session if tokens exist but the server is unreachable.
        if (e?.status === 0) {
          const cached = await AsyncStorage.getItem('st_cached_user');
          if (cached) {
                          const cachedUser = JSON.parse(cached) as ApiUser;
               setUser(cachedUser);
               void identifyPurchaser(cachedUser.id).catch(() => {});
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
           void identifyPurchaser(res.user.id).catch(() => {});
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
           await resetPurchaser();
    await clearTokens();
    await AsyncStorage.multiRemove(['st_cached_user', 'st_cached_subscriptions']);
    endSession();
  }, [endSession]);

  const logout = wipeLocal;
     // Re-read the account (plan, name...) from the server. Errors are ignored: the cached user stays.
   const refreshUser = useCallback(async () => {
     try {
       const me = await userApi.me();
       setUser(me);
       await AsyncStorage.setItem('st_cached_user', JSON.stringify(me));
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
    () => ({ status, user, login, signup, logout, deleteAccount,refreshUser  }),
    [status, user, login, signup, logout, deleteAccount,refreshUser ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

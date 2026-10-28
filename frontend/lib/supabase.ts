import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
// The publishable (anon) key is meant to ship inside the app. Never put the secret/service_role key here.
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set: the app cannot reach Supabase.');
}

/**
 * Session storage in the device Keychain/Keystore (expo-secure-store).
 * A Supabase session is larger than SecureStore's ~2 KB per value, so it is split into chunks.
 * Web has no SecureStore and falls back to AsyncStorage.
 */
const CHUNK = 1800;
const chunkCountKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

const secureChunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(chunkCountKey(key)));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // incomplete write: treat as signed out
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const oldCount = Number(await SecureStore.getItemAsync(chunkCountKey(key))) || 0;
    const count = Math.ceil(value.length / CHUNK) || 1;
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(chunkCountKey(key), String(count));
    for (let i = count; i < oldCount; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  },
  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(chunkCountKey(key))) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(chunkCountKey(key));
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : secureChunkedStorage,
    storageKey: 'st_supabase_auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground (Supabase's recommended setup for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { CurrencyField } from '@/components/CurrencyPicker';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { guessCurrency } from '@/lib/currencies';

export default function SignupScreen() {
  const colors = useColors();
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState(guessCurrency);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !email.trim()) return setError('Enter your name and email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    try {
      const sentTo = await signup({ displayName, email, password, defaultCurrency: currency });
      router.push({ pathname: '/verify-email', params: { email: sentTo } });
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Takes a minute. No bank login or card details needed.">
      <AuthField label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" autoComplete="name" />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <AuthField label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <CurrencyField label="Your currency" value={currency} onChange={setCurrency} />
      <ErrorNote message={error} />
      <PrimaryButton label={busy ? 'Creating…' : 'Create account'} icon="user-plus" onPress={() => void submit()} disabled={busy} />
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>I already have an account</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
});
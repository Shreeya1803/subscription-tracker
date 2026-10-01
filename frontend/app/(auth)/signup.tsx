import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function SignupScreen() {
  const colors = useColors();
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !email.trim()) return setError('Enter your name and email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setError('Currency must be a 3-letter code, e.g. USD or EUR.');
    setBusy(true);
    setError('');
    try {
      await signup({ displayName, email, password, defaultCurrency: currency });
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="No bank connection needed. Just track what you pay for.">
      <AuthField label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" autoComplete="name" />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <AuthField label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <AuthField label="Default currency" value={currency} onChangeText={(v) => setCurrency(v.toUpperCase())} maxLength={3} autoCapitalize="characters" />
      <ErrorNote message={error} />
      <PrimaryButton label={busy ? 'Creating…' : 'Create account'} icon="user-plus" onPress={() => void submit()} disabled={busy} />
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>I already have an account</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
});

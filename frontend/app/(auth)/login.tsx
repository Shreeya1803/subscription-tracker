import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your subscriptions.">
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorNote message={error} />
      <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} icon="log-in" onPress={() => void submit()} disabled={busy} />
      <View style={styles.links}>
        <Link href="/forgot-password" style={[styles.link, { color: colors.accentForeground }]}>Forgot password?</Link>
        <Link href="/signup" style={[styles.link, { color: colors.accentForeground }]}>Create an account</Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: 14, marginTop: 6 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

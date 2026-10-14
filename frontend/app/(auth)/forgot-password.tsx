import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { authApi } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

// Step 1: enter your email. Step 2: "check your email". The email contains a link that opens a secure
// page (served by the API) where the user chooses a new password, then returns here to sign in.
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If an account exists for ${email.trim()}, we've sent a link to reset your password. It is valid for 1 hour.`}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Open the link on this phone, choose a new password, then come back and sign in. Can't find it? Check your spam folder.
        </Text>
        <PrimaryButton label={busy ? 'Sending…' : 'Send again'} icon="mail" disabled={busy} onPress={() => void send()} />
        <ErrorNote message={error} />
        <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a link to choose a new password.">
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <ErrorNote message={error} />
      <PrimaryButton label={busy ? 'Sending…' : 'Send reset link'} icon="mail" disabled={busy} onPress={() => void send()} />
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
});
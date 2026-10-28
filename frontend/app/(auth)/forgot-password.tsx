import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

// Step 1: enter your email. Step 2: enter the 6-digit code from the email and a new password.
// A correct code sets the new password and signs the user in.
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const { requestPasswordReset, resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from the email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError('');
    try {
      await resetPassword(email, code, password);
    } catch (e: any) {
      setError(e?.message ?? 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Enter your code"
        subtitle={`If an account exists for ${email.trim()}, we've sent a 6-digit code. It expires after 1 hour.`}
      >
        <AuthField
          label="Code"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
        />
        <AuthField label="New password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <AuthField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        <ErrorNote message={error} />
        <PrimaryButton label={busy ? 'Saving…' : 'Set new password'} icon="lock" disabled={busy} onPress={() => void reset()} />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Can't find the email? Check your spam folder.</Text>
        <Pressable onPress={() => void send()} disabled={busy} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.accentForeground }]}>Send a new code</Text>
        </Pressable>
        <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a code to choose a new password.">
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <ErrorNote message={error} />
      <PrimaryButton label={busy ? 'Sending…' : 'Send code'} icon="mail" disabled={busy} onPress={() => void send()} />
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
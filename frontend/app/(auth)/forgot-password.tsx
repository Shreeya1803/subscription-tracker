import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { authApi } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

// Step 1: request a reset link. Step 2: paste the token from the email and set a new password.
// (The backend currently only logs the email; the token is in the API console until an email provider is wired in.)
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 3) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
      </AuthShell>
    );
  }

  if (step === 2) {
    return (
      <AuthShell title="Set a new password" subtitle="Paste the reset token from your email, then choose a new password.">
        <AuthField label="Reset token" value={token} onChangeText={setToken} />
        <AuthField label="New password (8+ characters)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <ErrorNote message={error} />
        <PrimaryButton
          label={busy ? 'Saving…' : 'Update password'}
          icon="check"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
              await authApi.resetPassword(token.trim(), newPassword);
              setStep(3);
            })
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <ErrorNote message={error} />
      <PrimaryButton
        label={busy ? 'Sending…' : 'Send reset link'}
        icon="mail"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            await authApi.forgotPassword(email.trim());
            setStep(2);
          })
        }
      />
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>If an account exists for that email, a link will arrive shortly.</Text>
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
});

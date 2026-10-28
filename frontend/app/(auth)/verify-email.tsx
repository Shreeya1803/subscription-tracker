import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthField, AuthShell, ErrorNote } from '@/components/AuthUI';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const RESEND_WAIT_SECONDS = 60;

// After sign-up (or signing in to an unconfirmed account): enter the 6-digit code from the email.
// A correct code confirms the email and opens the app.
export default function VerifyEmailScreen() {
  const colors = useColors();
  const { verifySignupCode, resendSignupCode } = useAuth();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from the email.');
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await verifySignupCode(email, code);
    } catch (e: any) {
      setError(e?.message ?? 'Could not confirm your email.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await resendSignupCode(email);
      setInfo('A new code is on its way.');
      setWait(RESEND_WAIT_SECONDS);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send a new code.');
    }
  };

  return (
    <AuthShell title="Check your email" subtitle={`We sent a 6-digit code to ${email}. Enter it below to confirm your email.`}>
      <AuthField
        label="Code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
      />
      <ErrorNote message={error} />
      {info ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{info}</Text> : null}
      <PrimaryButton label={busy ? 'Confirming…' : 'Confirm email'} icon="check" onPress={() => void submit()} disabled={busy} />
      <Pressable onPress={() => void resend()} disabled={wait > 0} accessibilityRole="button">
        <Text style={[styles.link, { color: wait > 0 ? colors.mutedForeground : colors.accentForeground }]}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>Can't find it? Check your spam folder. The code expires after 1 hour.</Text>
      <Link href="/login" style={[styles.link, { color: colors.accentForeground }]}>Back to sign in</Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
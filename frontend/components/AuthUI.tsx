import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppMark } from '@/components/SubscriptionUI';
import { useColors } from '@/hooks/useColors';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <KeyboardAwareScrollViewCompat
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <AppMark size={48} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      <View style={styles.form}>{children}</View>
    </KeyboardAwareScrollViewCompat>
  );
}

export function AuthField({ label, ...props }: { label: string } & TextInputProps) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={label}
        autoCapitalize="none"
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        {...props}
      />
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  const colors = useColors();
  if (!message) return null;
  return (
    <View style={[styles.errorBox, { backgroundColor: colors.warningSoft }]}>
      <Feather name="alert-circle" size={16} color={colors.warning} />
      <Text style={[styles.errorText, { color: colors.accentForeground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 90, paddingBottom: 50, gap: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.6, marginTop: 14 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  form: { gap: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, fontFamily: 'Inter_400Regular', fontSize: 15 },
  errorBox: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
});

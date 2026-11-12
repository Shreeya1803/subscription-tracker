import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppMark } from '@/components/SubscriptionUI';
import { useColors } from '@/hooks/useColors';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollViewCompat
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.topBar}>
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      <AppMark size={48} dock />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      <View style={styles.form}>{children}</View>
    </KeyboardAwareScrollViewCompat>
  );
}

export function AuthField({ label, secureTextEntry, ...props }: { label: string } & TextInputProps) {
  const colors = useColors();
  // Password fields get an eye button to show or hide what was typed.
  const [visible, setVisible] = useState(false);
  const isPassword = !!secureTextEntry;
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={isPassword ? false : undefined}
          secureTextEntry={isPassword && !visible}
          style={[styles.input, { color: colors.foreground }]}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.eye}
          >
            <Feather name={visible ? 'eye-off' : 'eye'} size={19} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
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
  content: { paddingHorizontal: 22, paddingBottom: 50, gap: 8 },
  topBar: { height: 40, marginBottom: 22, justifyContent: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.6, marginTop: 14 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  form: { gap: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  inputWrap: { minHeight: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 15, fontFamily: 'Inter_400Regular', fontSize: 15 },
  eye: { width: 46, height: 50, alignItems: 'center', justifyContent: 'center' },
  errorBox: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
});

import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';
import { exportAccountPdf, ExportData } from '@/lib/exportPdf';
import { formatMoney, useSubscriptions } from '@/context/SubscriptionContext';
import { AppMark, SectionHeading } from '@/components/SubscriptionUI';

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  destructive = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.72 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.settingsIcon, { backgroundColor: destructive ? colors.warningSoft : colors.secondary }]}>
        <Feather name={icon} size={17} color={destructive ? colors.warning : colors.secondaryForeground} />
      </View>
      <View style={styles.settingsCopy}>
        <Text style={[styles.settingsTitle, { color: destructive ? colors.destructive : colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.settingsSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <Feather name="chevron-right" size={17} color={colors.mutedForeground} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subscriptions, summary } = useSubscriptions();
  const { user, logout, deleteAccount } = useAuth();
  const currency = user?.defaultCurrency ?? 'USD';
  const active = subscriptions.filter((item) => item.status === 'active');
  const monthly = summary?.monthlyTotal ?? 0;
  const planLabel = user?.premiumStatus && user.premiumStatus !== 'free' ? `Premium (${user.premiumStatus})` : 'Free plan';

  const exportJson = async () => {
    try {
      const data = await userApi.export(); // GET /user/export
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'Subscription Tracker data export' });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    }
  };

  const exportPdf = async () => {
    try {
      const data = (await userApi.export()) as ExportData;
      await exportAccountPdf(data);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    }
  };

  const exportData = () => {
    Alert.alert('Export my data', 'Choose a format.', [
      { text: 'PDF report', onPress: () => void exportPdf() },
      { text: 'JSON (raw data)', onPress: () => void exportJson() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void logout() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete your account?', 'This permanently deletes your account and all subscription data from our servers. This cannot be undone.', [
      { text: 'Keep account', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (e: any) {
            Alert.alert('Could not delete account', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandLine}>
          <AppMark size={38} />
          <View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR MONEY, CLEARER</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          </View>
        </View>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.profileInitial, { color: colors.accentForeground }]}>{(user?.displayName?.[0] ?? 'Y').toUpperCase()}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: colors.primaryForeground }]}>{user?.displayName ?? 'Your account'}</Text>
          <Text style={[styles.profileMeta, { color: colors.navySoft }]}>{planLabel} · {active.length} active services</Text>
        </View>
        </View>

      <View style={styles.section}>
        <SectionHeading title="Preferences" />
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="sliders"
            title="Reminders"
            subtitle="Set reminders per subscription when you add or edit it"
            onPress={() => router.push('/(tabs)/subscriptions')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Your plan" />
        <View style={[styles.planCard, { backgroundColor: colors.successSoft }]}>
          <View style={[styles.planIcon, { backgroundColor: colors.success }]}>
            <Feather name="trending-down" size={19} color={colors.card} />
          </View>
          <View style={styles.planCopy}>
            <Text style={[styles.planTitle, { color: colors.secondaryForeground }]}>Make every charge count</Text>
            <Text style={[styles.planText, { color: colors.secondaryForeground }]}>
              You’re tracking {formatMoney(monthly, currency)} in monthly commitments. Premium insights are coming soon.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Privacy & data" />
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow icon="shield" title="Privacy first" subtitle="No bank connection or inbox scanning" />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow icon="download" title="Export my data" subtitle="Download a PDF report or raw JSON copy" onPress={() => void exportData()} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow icon="log-out" title="Sign out" onPress={confirmSignOut} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow icon="trash-2" title="Delete account" subtitle="Permanently remove your account and data" onPress={confirmDelete} destructive />
        </View>
      </View>

      <Text style={[styles.versionText, { color: colors.mutedForeground }]}>Subscription Tracker · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 21 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.6 },
  profileCard: { marginHorizontal: 20, borderRadius: 23, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  profileCopy: { flex: 1, gap: 4 },
  profileName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  profileMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  section: { marginTop: 28, paddingHorizontal: 20 },
  settingsCard: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 15 },
  settingsRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsCopy: { flex: 1, gap: 3 },
  settingsTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingsSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  planCard: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  planCopy: { flex: 1, gap: 5 },
  planTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  planText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, opacity: 0.8 },
  versionText: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 30 },
});
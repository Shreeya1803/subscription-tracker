import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { formatMoney, formatRenewal, getDaysUntil, useSubscriptions } from '@/context/SubscriptionContext';
import { categoryIcons, categoryLabels, PrimaryButton } from '@/components/SubscriptionUI';

export default function SubscriptionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { subscriptions, deleteSubscription, cancelSubscription, monthlyEquivalent } = useSubscriptions();
  const subscription = subscriptions.find((item) => item.id === id);

  if (!subscription) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Feather name="search" size={26} color={colors.mutedForeground} />
        <Text style={[styles.missingTitle, { color: colors.foreground }]}>Service not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.accentForeground }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const days = getDaysUntil(subscription.nextRenewal);
  const remove = () => {
    Alert.alert('Delete this service?', 'This removes it from your tracker.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubscription(subscription.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const cancel = () => {
    Alert.alert('Mark as canceled?', 'It will stay in your history but stop counting toward your active spend.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Mark canceled',
        onPress: async () => {
          try {
            await cancelSubscription(subscription.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backButton}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]}>Service details</Text>
        <Pressable onPress={() => router.push(`/add?id=${subscription.id}`)} accessibilityLabel="Edit service" style={styles.backButton}>
          <Feather name="edit-2" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={[styles.detailHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.detailIcon, { backgroundColor: colors.navySoft }]}>
          <Feather name={categoryIcons[subscription.category]} size={28} color={colors.primary} />
        </View>
        <Text style={[styles.detailName, { color: colors.foreground }]}>{subscription.name}</Text>
        <Text style={[styles.detailCategory, { color: colors.mutedForeground }]}>{categoryLabels[subscription.category]}</Text>
        <Text style={[styles.detailAmount, { color: colors.foreground }]}>{formatMoney(subscription.amount, subscription.currency)}</Text>
        <Text style={[styles.detailCycle, { color: colors.mutedForeground }]}>{subscription.billingCycle === 'custom' ? `every ${subscription.customCycleDays ?? '?'} days` : `per ${subscription.billingCycle.replace('ly', '')}`}</Text>
      </View>

      <View style={[styles.renewalBanner, { backgroundColor: days <= 7 ? colors.warningSoft : colors.secondary }]}>
        <View style={[styles.renewalIcon, { backgroundColor: days <= 7 ? colors.warning : colors.success }]}>
          <Feather name="calendar" size={17} color={colors.primaryForeground} />
        </View>
        <View style={styles.renewalCopy}>
          <Text style={[styles.renewalTitle, { color: colors.foreground }]}>
            {days === 0 ? 'Renews today' : days === 1 ? 'Renews tomorrow' : days > 0 ? `Renews in ${days} days` : 'Renewal date passed'}
          </Text>
          <Text style={[styles.renewalText, { color: colors.mutedForeground }]}>{formatRenewal(subscription.nextRenewal)} · {subscription.reminderEnabled ? 'Reminder on' : 'Reminder off'}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoCell label="Monthly equivalent" value={formatMoney(monthlyEquivalent(subscription), subscription.currency)} colors={colors} />
        <InfoCell label="Annual estimate" value={formatMoney(monthlyEquivalent(subscription) * 12, subscription.currency)} colors={colors} />
      </View>

      {subscription.notes ? (
        <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>NOTES</Text>
          <Text style={[styles.notesText, { color: colors.foreground }]}>{subscription.notes}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label="Edit service" icon="edit-2" onPress={() => router.push(`/add?id=${subscription.id}`)} />
        {subscription.status === 'active' ? (
          <Pressable onPress={cancel} style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Feather name="slash" size={17} color={colors.mutedForeground} />
            <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>Mark as canceled</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={remove} style={({ pressed }) => [styles.deleteAction, pressed && { opacity: 0.7 }]}>
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete from tracker</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoCell({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 20, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  detailHero: { marginHorizontal: 20, marginTop: 18, borderRadius: 25, borderWidth: 1, alignItems: 'center', padding: 24 },
  detailIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  detailName: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  detailCategory: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 5 },
  detailAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, marginTop: 20, letterSpacing: -0.7 },
  detailCycle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  renewalBanner: { marginHorizontal: 20, marginTop: 14, padding: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  renewalIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  renewalCopy: { flex: 1, gap: 3 },
  renewalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  renewalText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  infoGrid: { marginHorizontal: 20, marginTop: 14, flexDirection: 'row', gap: 10 },
  infoCell: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 7 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  infoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  notesCard: { marginHorizontal: 20, marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 15, gap: 8 },
  notesLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2 },
  notesText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  actions: { marginHorizontal: 20, marginTop: 28, gap: 11 },
  secondaryAction: { minHeight: 53, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  deleteAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  deleteText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatRenewal, getDaysUntil, useSubscriptions } from '@/context/SubscriptionContext';
import { AppMark, EmptyState, IconButton, SectionHeading, SubscriptionRow, categoryIcons, categoryLabels } from '@/components/SubscriptionUI';

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subscriptions, summary, hydrated, loadError, monthlyEquivalent } = useSubscriptions();
  const { user } = useAuth();
  const currency = user?.defaultCurrency ?? 'USD';
  const active = subscriptions.filter((item) => item.status === 'active');
  // Totals come from the backend (/dashboard/summary); fall back to local math only while it loads.
  const monthly = summary?.monthlyTotal ?? active.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const annual = summary?.annualTotal ?? monthly * 12;
  const upcoming = active
    .filter((item) => {
      const days = getDaysUntil(item.nextRenewal);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => getDaysUntil(a.nextRenewal) - getDaysUntil(b.nextRenewal));
  const categories = (Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>)
    .map((category) => ({
      category,
      amount: active.filter((item) => item.category === category).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxCategory = categories[0]?.amount ?? 1;

  if (!hydrated) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

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
            <Text style={[styles.greeting, { color: colors.foreground }]}>Hi{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</Text>
          </View>
        </View>
        <IconButton icon="bell" label="Reminders" onPress={() => router.push('/(tabs)/settings')} />
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
        <View style={styles.heroOrbOne} />
        <View style={styles.heroOrbTwo} />
        <View style={styles.heroTopLine}>
          <Text style={[styles.heroLabel, { color: colors.navySoft }]}>MONTHLY COMMITMENTS</Text>
          <View style={styles.privacyBadge}>
            <Feather name="lock" size={12} color={colors.navySoft} />
            <Text style={[styles.privacyText, { color: colors.navySoft }]}>Private</Text>
          </View>
        </View>
        <Text style={[styles.heroAmount, { color: colors.primaryForeground }]}>{formatMoney(monthly, currency)}</Text>
        <Text style={[styles.heroSubtext, { color: colors.navySoft }]}>{formatMoney(annual, currency)} estimated per year{summary?.mixedCurrencies ? ' · mixed currencies' : ''}</Text>
        <View style={styles.heroFooter}>
          <View>
            <Text style={[styles.heroFooterLabel, { color: colors.navySoft }]}>ACTIVE SERVICES</Text>
            <Text style={[styles.heroFooterValue, { color: colors.primaryForeground }]}>{active.length}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View>
            <Text style={[styles.heroFooterLabel, { color: colors.navySoft }]}>NEXT 30 DAYS</Text>
            <Text style={[styles.heroFooterValue, { color: colors.primaryForeground }]}>{upcoming.length}</Text>
          </View>
        </View>
      </View>

      {loadError ? (
        <View style={[styles.privacyNote, { backgroundColor: colors.warningSoft, marginTop: 14 }]}>
          <Feather name="wifi-off" size={17} color={colors.warning} />
          <Text style={[styles.privacyNoteText, { color: colors.accentForeground }]}>{loadError} Showing your last saved data.</Text>
        </View>
      ) : null}
      {summary && summary.totalMonthlySaved > 0 ? (
        <View style={[styles.privacyNote, { backgroundColor: colors.successSoft, marginTop: 14 }]}>
          <Feather name="trending-down" size={17} color={colors.success} />
          <Text style={[styles.privacyNoteText, { color: colors.secondaryForeground }]}>You're saving {formatMoney(summary.totalMonthlySaved, currency)} per month from canceled services.</Text>
        </View>
      ) : null}

      <Pressable
        testID="add-subscription"
        onPress={() => router.push('/add')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addPrompt, { backgroundColor: colors.accent, borderColor: colors.warning }, pressed && { opacity: 0.8 }]}
      >
        <View style={[styles.addPromptIcon, { backgroundColor: colors.warning }]}>
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </View>
        <View style={styles.addPromptCopy}>
          <Text style={[styles.addPromptTitle, { color: colors.accentForeground }]}>Track another subscription</Text>
          <Text style={[styles.addPromptText, { color: colors.accentForeground }]}>Add it manually in under a minute.</Text>
        </View>
        <Feather name="arrow-up-right" size={19} color={colors.accentForeground} />
      </Pressable>

      <View style={styles.section}>
        <SectionHeading title="Coming up" action={upcoming.length ? 'See all' : undefined} onAction={() => router.push('/(tabs)/subscriptions')} />
        {upcoming.length ? (
          <View style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {upcoming.slice(0, 3).map((item) => {
              const days = getDaysUntil(item.nextRenewal);
              return (
                <Pressable key={item.id} onPress={() => router.push(`/subscription/${item.id}`)} style={({ pressed }) => [styles.upcomingRow, pressed && { opacity: 0.72 }]}>
                  <View style={[styles.dateTile, { backgroundColor: days <= 7 ? colors.warningSoft : colors.secondary }]}>
                    <Text style={[styles.dateDay, { color: days <= 7 ? colors.warning : colors.secondaryForeground }]}>{new Date(`${item.nextRenewal}T12:00:00`).getDate()}</Text>
                    <Text style={[styles.dateMonth, { color: days <= 7 ? colors.warning : colors.secondaryForeground }]}>{new Date(`${item.nextRenewal}T12:00:00`).toLocaleString('en', { month: 'short' }).toUpperCase()}</Text>
                  </View>
                  <View style={styles.upcomingCopy}>
                    <Text style={[styles.upcomingName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.upcomingMeta, { color: colors.mutedForeground }]}>
                      {days === 0 ? 'Renews today' : days === 1 ? 'Renews tomorrow' : `In ${days} days`} · {formatMoney(item.amount, item.currency)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="calendar" title="Nothing due soon" message="Your next renewal will show here when it is within 30 days." />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading title="Where it goes" action="Details" onAction={() => router.push('/(tabs)/subscriptions')} />
        <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {categories.length ? categories.map(({ category, amount }) => (
            <View key={category} style={styles.categoryRow}>
              <View style={styles.categoryLabel}>
                <View style={[styles.categoryDot, { backgroundColor: category === 'entertainment' ? colors.tint : category === 'work' ? colors.primary : colors.success }]} />
                <Feather name={categoryIcons[category]} size={15} color={colors.mutedForeground} />
                <Text style={[styles.categoryText, { color: colors.foreground }]}>{categoryLabels[category]}</Text>
              </View>
              <View style={styles.categoryMetric}>
                <View style={[styles.categoryTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.categoryBar, { width: `${Math.max(8, (amount / maxCategory) * 100)}%`, backgroundColor: category === 'entertainment' ? colors.tint : category === 'work' ? colors.primary : colors.success }]} />
                </View>
                <Text style={[styles.categoryAmount, { color: colors.foreground }]}>{formatMoney(amount, currency)}</Text>
              </View>
            </View>
          )) : (
            <Text style={[styles.noCategoryText, { color: colors.mutedForeground }]}>Add subscriptions to see your spend mix.</Text>
          )}
        </View>
      </View>

      {active.length ? (
        <View style={styles.section}>
          <SectionHeading title="Your services" action="Manage" onAction={() => router.push('/(tabs)/subscriptions')} />
          {active.slice(0, 3).map((item) => (
            <SubscriptionRow key={item.id} subscription={item} onPress={() => router.push(`/subscription/${item.id}`)} compact />
          ))}
        </View>
      ) : null}

      <View style={[styles.privacyNote, { backgroundColor: colors.successSoft }]}>
        <Feather name="shield" size={17} color={colors.success} />
        <Text style={[styles.privacyNoteText, { color: colors.secondaryForeground }]}>Your data is tied to your account. No bank connection required.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, marginBottom: 3 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4 },
  heroCard: { marginHorizontal: 20, borderRadius: 26, padding: 22, minHeight: 222, overflow: 'hidden' },
  heroOrbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 100, right: -88, top: -80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroOrbTwo: { position: 'absolute', width: 240, height: 240, borderRadius: 140, left: -165, bottom: -190, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 },
  privacyBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  privacyText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  heroAmount: { fontFamily: 'Inter_700Bold', fontSize: 42, letterSpacing: -1, marginTop: 17 },
  heroSubtext: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22 },
  heroFooterLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.8 },
  heroFooterValue: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 2 },
  heroDivider: { width: 1, height: 29, backgroundColor: 'rgba(255,255,255,0.2)' },
  addPrompt: { marginHorizontal: 20, marginTop: 14, padding: 13, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  addPromptIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addPromptCopy: { flex: 1 },
  addPromptTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  addPromptText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2, opacity: 0.75 },
  section: { marginTop: 28, paddingHorizontal: 20 },
  upcomingCard: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 15 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e4e1da' },
  dateTile: { width: 45, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  dateMonth: { fontFamily: 'Inter_600SemiBold', fontSize: 9, marginTop: 1, letterSpacing: 0.4 },
  upcomingCopy: { flex: 1, gap: 4 },
  upcomingName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  upcomingMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  breakdownCard: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 17 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  categoryDot: { width: 6, height: 6, borderRadius: 6 },
  categoryText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  categoryMetric: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1.25 },
  categoryTrack: { height: 6, flex: 1, borderRadius: 8, overflow: 'hidden' },
  categoryBar: { height: 6, borderRadius: 8 },
  categoryAmount: { width: 48, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noCategoryText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  privacyNote: { marginHorizontal: 20, marginTop: 27, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  privacyNoteText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, lineHeight: 18 },
});

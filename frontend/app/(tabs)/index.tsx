import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark, IconButton, categoryColor, categoryLabels } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { Category, formatMoney, getDaysUntil, Subscription, useSubscriptions } from '@/context/SubscriptionContext';
import { useAddSubscription } from '@/hooks/useAddSubscription';
import { useColors } from '@/hooks/useColors';

type Colors = ReturnType<typeof useColors>;

const POPULAR: Array<{ name: string; category: Category; icon: keyof typeof Feather.glyphMap }> = [
  { name: 'Netflix', category: 'entertainment', icon: 'film' },
  { name: 'Spotify', category: 'entertainment', icon: 'music' },
  { name: 'YouTube Premium', category: 'entertainment', icon: 'youtube' },
  { name: 'Amazon Prime', category: 'entertainment', icon: 'package' },
  { name: 'iCloud+', category: 'utilities', icon: 'cloud' },
  { name: 'Gym', category: 'health', icon: 'activity' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { subscriptions, summary, hydrated, loadError, monthlyEquivalent } = useSubscriptions();
  const { user } = useAuth();
  const { openAdd } = useAddSubscription();
  const currency = user?.defaultCurrency ?? 'USD';
  const active = subscriptions.filter((item) => item.status === 'active');
  // Totals come from the backend (dashboard_summary); fall back to local math only while it loads.
  const monthly = summary?.monthlyTotal ?? active.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const annual = summary?.annualTotal ?? monthly * 12;
  const upcoming = active
    .filter((item) => {
      const days = getDaysUntil(item.nextRenewal);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => getDaysUntil(a.nextRenewal) - getDaysUntil(b.nextRenewal));
  const categories = (Object.keys(categoryLabels) as Category[])
    .map((category) => ({
      category,
      amount: active.filter((item) => item.category === category).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  // Small phones show two upcoming renewals so the whole overview fits without scrolling.
  const upcomingRows = height < 800 ? 2 : 3;
  const firstName = user?.displayName?.trim().split(' ')[0];

  if (!hydrated) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: 18, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandLine}>
          <AppMark size={36} />
          <View>
            <Text style={[styles.greeting, { color: colors.foreground }]} numberOfLines={1}>
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>
        <IconButton icon="bell" label="Reminders" onPress={() => router.push('/(tabs)/settings')} />
      </View>

      <SpendCard
        colors={colors}
        monthly={formatMoney(monthly, currency)}
        annual={formatMoney(annual, currency)}
        activeCount={active.length}
        upcoming={upcoming}
        mixed={!!summary?.mixedCurrencies}
        saved={summary && summary.totalMonthlySaved > 0 ? formatMoney(summary.totalMonthlySaved, currency) : null}
      />

      {loadError ? (
        <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
          <Feather name="wifi-off" size={16} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.accentForeground }]}>{loadError} Showing your last saved data.</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <QuickAction colors={colors} icon="plus" label="Add" primary onPress={openAdd} />
        <QuickAction colors={colors} icon="list" label="All" onPress={() => router.push('/(tabs)/subscriptions')} />
        <QuickAction colors={colors} icon="bell" label="Reminders" onPress={() => router.push('/(tabs)/settings')} />
        <QuickAction colors={colors} icon="star" label="Premium" onPress={() => router.push('/upgrade')} />
      </View>

      {active.length === 0 ? (
        <GetStarted colors={colors} />
      ) : (
        <>
          <View>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Coming up</Text>
              <Pressable onPress={() => router.push('/(tabs)/subscriptions')} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.sectionAction, { color: colors.accentForeground }]}>See all</Text>
              </Pressable>
            </View>
            <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {upcoming.length ? (
                upcoming.slice(0, upcomingRows).map((item, index) => (
                  <UpcomingRow key={item.id} item={item} colors={colors} divider={index > 0} />
                ))
              ) : (
                <View style={styles.quietRow}>
                  <Feather name="check-circle" size={17} color={colors.success} />
                  <Text style={[styles.quietText, { color: colors.mutedForeground }]}>Nothing renews in the next 30 days.</Text>
                </View>
              )}
            </View>
          </View>

          {categories.length ? <SpendMix colors={colors} categories={categories} total={categories.reduce((s, c) => s + c.amount, 0)} /> : null}
        </>
      )}
    </ScrollView>
  );
}

/** The headline card: what you pay each month, and a 30-day track of the renewals ahead. */
function SpendCard({
  colors,
  monthly,
  annual,
  activeCount,
  upcoming,
  mixed,
  saved,
}: {
  colors: Colors;
  monthly: string;
  annual: string;
  activeCount: number;
  upcoming: Subscription[];
  mixed: boolean;
  saved: string | null;
}) {
  const { brand } = colors;
  const end = new Date(Date.now() + 30 * 86400000);
  return (
    <View style={[styles.spendCard, { backgroundColor: brand.ink }]}>
      <View style={[styles.glow, { borderColor: brand.inkLine }]} />
      <View style={styles.spendTop}>
        <Text style={[styles.spendLabel, { color: brand.mist }]} numberOfLines={1}>You pay each month</Text>
        <View style={[styles.privatePill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Feather name="lock" size={11} color={brand.mist} />
          <Text style={[styles.privateText, { color: brand.mist }]}>Only you</Text>
        </View>
      </View>
      <Text style={[styles.spendAmount, { color: brand.white }]} adjustsFontSizeToFit numberOfLines={1}>{monthly}</Text>
      <Text style={[styles.spendSub, { color: brand.mist }]} numberOfLines={2}>
        {annual} a year across {activeCount} {activeCount === 1 ? 'service' : 'services'}
        {mixed ? ' (mixed currencies)' : ''}
      </Text>
      {saved ? (
        <View style={styles.savedLine}>
          <Feather name="trending-down" size={13} color={brand.green} />
          <Text style={[styles.savedText, { color: brand.green }]}>Saving {saved} a month from cancelled services</Text>
        </View>
      ) : null}

      <View style={styles.track}>
        <View style={styles.trackHead}>
          <Text style={[styles.trackLabel, { color: brand.mist }]}>Next 30 days</Text>
          <Text style={[styles.trackCount, { color: brand.white }]}>
            {upcoming.length === 0 ? 'No renewals' : `${upcoming.length} ${upcoming.length === 1 ? 'renewal' : 'renewals'}`}
          </Text>
        </View>
        <View style={[styles.trackLine, { backgroundColor: brand.inkLine }]}>
          {upcoming.map((item) => {
            const days = getDaysUntil(item.nextRenewal);
            return (
              <View
                key={item.id}
                style={[
                  styles.trackDot,
                  { left: `${(days / 30) * 100}%`, backgroundColor: days <= 7 ? brand.gold : brand.mist, borderColor: brand.ink },
                ]}
              />
            );
          })}
          <View style={[styles.todayTick, { backgroundColor: brand.gold }]} />
        </View>
        <View style={styles.trackEnds}>
          <Text style={[styles.trackEnd, { color: brand.mist }]}>Today</Text>
          <Text style={[styles.trackEnd, { color: brand.mist }]}>{end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
        </View>
      </View>
    </View>
  );
}

function QuickAction({
  colors,
  icon,
  label,
  onPress,
  primary = false,
}: {
  colors: Colors;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label === 'All' ? 'All subscriptions' : label === 'Add' ? 'Add subscription' : label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
    >
      <View
        style={[
          styles.actionIcon,
          primary
            ? { backgroundColor: colors.brand.gold }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Feather name={icon} size={20} color={primary ? colors.brand.ink : colors.foreground} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

function UpcomingRow({ item, colors, divider }: { item: Subscription; colors: Colors; divider: boolean }) {
  const days = getDaysUntil(item.nextRenewal);
  const soon = days <= 7;
  const date = new Date(`${item.nextRenewal}T12:00:00`);
  return (
    <Pressable
      onPress={() => router.push(`/subscription/${item.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.upRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.dateTile, { backgroundColor: soon ? colors.warningSoft : colors.muted }]}>
        <Text style={[styles.dateDay, { color: soon ? colors.warning : colors.foreground }]}>{date.getDate()}</Text>
        <Text style={[styles.dateMonth, { color: soon ? colors.warning : colors.mutedForeground }]}>{date.toLocaleString('en', { month: 'short' })}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.upName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.upMeta, { color: soon ? colors.warning : colors.mutedForeground }]} numberOfLines={1}>
          {days === 0 ? 'Renews today' : days === 1 ? 'Renews tomorrow' : `Renews in ${days} days`}
        </Text>
      </View>
      <Text style={[styles.upAmount, { color: colors.foreground }]} numberOfLines={1}>{formatMoney(item.amount, item.currency)}</Text>
    </Pressable>
  );
}

/** One bar split by category, so the spending mix fits in a single line. */
function SpendMix({ colors, categories, total }: { colors: Colors; categories: Array<{ category: Category; amount: number }>; total: number }) {
  return (
    <Pressable onPress={() => router.push('/(tabs)/subscriptions')} accessibilityRole="button" accessibilityLabel="Spending by category">
      <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>Where it goes</Text>
      <View style={[styles.mixBar, { backgroundColor: colors.muted }]}>
        {categories.map(({ category, amount }) => (
          <View key={category} style={{ flex: amount / total, backgroundColor: categoryColor(colors, category) }} />
        ))}
      </View>
      <View style={styles.legend}>
        {categories.map(({ category, amount }) => (
          <View key={category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: categoryColor(colors, category) }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              {categoryLabels[category]} {Math.round((amount / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** First run: suggest common services so the first entry takes one tap. */
function GetStarted({ colors }: { colors: Colors }) {
  return (
    <View style={[styles.panel, styles.startPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.startTitle, { color: colors.foreground }]}>Add your first subscription</Text>
      <Text style={[styles.startBody, { color: colors.mutedForeground }]}>
        Tap one you pay for, or add your own. You can set a reminder before it renews.
      </Text>
      <View style={styles.chips}>
        {POPULAR.map((p) => (
          <Pressable
            key={p.name}
            onPress={() => router.push({ pathname: '/add', params: { name: p.name, category: p.category } })}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name}`}
            style={({ pressed }) => [styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <Feather name={p.icon} size={14} color={colors.accentForeground} />
            <Text style={[styles.chipText, { color: colors.foreground }]}>{p.name}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push('/add')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.chip, { backgroundColor: colors.accent, borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
        >
          <Feather name="plus" size={14} color={colors.accentForeground} />
          <Text style={[styles.chipText, { color: colors.accentForeground }]}>Something else</Text>
        </Pressable>
      </View>
      <View style={[styles.privacyLine, { borderTopColor: colors.border }]}>
        <Feather name="shield" size={14} color={colors.success} />
        <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>No bank login or card details needed.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.4 },
  date: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  spendCard: { borderRadius: 26, padding: 20, paddingBottom: 16, overflow: 'hidden' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -120, top: -150, borderWidth: 36 },
  spendTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spendLabel: { flexShrink: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  privateText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  spendAmount: { fontFamily: 'Inter_700Bold', fontSize: 38, letterSpacing: -1.2, marginTop: 6, fontVariant: ['tabular-nums'] },
  spendSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  savedLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  savedText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  track: { marginTop: 18 },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  trackLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  trackCount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  trackLine: { height: 4, borderRadius: 2, justifyContent: 'center' },
  trackDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginLeft: -6, top: -4 },
  todayTick: { position: 'absolute', left: 0, width: 3, height: 12, borderRadius: 2, top: -4 },
  trackEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  trackEnd: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  banner: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bannerText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: 6, flex: 1, paddingHorizontal: 2 },
  actionIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, letterSpacing: -0.2 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  panel: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dateTile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 17 },
  dateMonth: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  upName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  upMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  upAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 14, fontVariant: ['tabular-nums'] },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 16 },
  quietText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  mixBar: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  startPanel: { padding: 16, paddingHorizontal: 16 },
  startTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  startBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  privacyLine: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
  privacyText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});

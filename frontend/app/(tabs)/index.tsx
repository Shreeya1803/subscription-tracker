import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTour, TourStep, tourDoneKey } from '@/components/AppTour';
import { IconButton, ServiceLogo, categoryColor, categoryLabels } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { Category, formatMoney, getDaysUntil, Subscription, useSubscriptions } from '@/context/SubscriptionContext';
import { useAddSubscription } from '@/hooks/useAddSubscription';
import { useColors } from '@/hooks/useColors';
import { FREE_ACTIVE_LIMIT } from '@/lib/plan';

type Colors = ReturnType<typeof useColors>;

const POPULAR: Array<{ name: string; category: Category }> = [
  { name: 'Netflix', category: 'entertainment' },
  { name: 'Spotify', category: 'entertainment' },
  { name: 'YouTube Premium', category: 'entertainment' },
  { name: 'Amazon Prime', category: 'entertainment' },
  { name: 'iCloud+', category: 'utilities' },
  { name: 'Disney+', category: 'entertainment' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'GOOD MORNING';
  if (hour < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
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
  // Smaller phones show fewer rows so the whole overview fits without scrolling.
  const compact = height < 800;
  const upcomingRows = compact ? 2 : 3;
  const categoryRows = 2; // the two biggest categories, as in the design

  // ----- guided tour (first visit, or replayed from Settings) -----
  const scrollRef = useRef<ScrollView>(null);
  const bellRef = useRef<View>(null);
  const cardRef = useRef<View>(null);
  const upcomingRef = useRef<View>(null);
  const mixRef = useRef<View>(null);
  const addRef = useRef<View>(null);
  // Where each highlighted section sits in the scroll view (the bell is in the header, at the top).
  const offsets = useRef<Record<string, number>>({ bell: 0, card: 0 });
  const [touring, setTouring] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!hydrated || !user) return;
      let cancelled = false;
      AsyncStorage.getItem(tourDoneKey(user.id))
        .then((done) => {
          if (!cancelled && !done) setTimeout(() => setTouring(true), 450);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [hydrated, user]),
  );

  const finishTour = () => {
    setTouring(false);
    if (user) AsyncStorage.setItem(tourDoneKey(user.id), '1').catch(() => {});
  };

  const steps: TourStep[] = [
    {
      key: 'welcome',
      title: 'Welcome to your dashboard',
      body: 'Here’s a quick tour of what you see on this screen. It takes less than a minute.',
    },
    {
      key: 'card',
      target: cardRef,
      title: 'Your monthly commitment',
      body: 'Everything you pay, worked out as a monthly amount, with an estimate for the whole year. Below it: how many services are active and how many payments are due in the next 30 days.',
    },
    {
      key: 'upcoming',
      target: upcomingRef,
      title: 'Coming up',
      body: 'Your next renewals, soonest first. Tap one to see its details, edit it or mark it as cancelled.',
    },
    ...(categories.length
      ? [
          {
            key: 'mix',
            target: mixRef,
            title: 'Where it goes',
            body: 'How your monthly spending splits across categories such as entertainment, utilities and work.',
          } as TourStep,
        ]
      : []),
    {
      key: 'add',
      target: addRef,
      title: 'Add a subscription',
      body: `Tap here, or the + on the Subscriptions tab, to track a new service. Pick a popular one or type your own. The free plan includes ${FREE_ACTIVE_LIMIT} subscriptions.`,
    },
    {
      key: 'bell',
      target: bellRef,
      title: 'Renewal reminders',
      body: 'Get a notification before a payment is taken, so you can keep the service or cancel in time. You choose how many days ahead for each subscription.',
    },
    {
      key: 'tabs',
      bottomBar: true,
      title: 'Find your way around',
      body: 'Subscriptions lists everything you track, with search and sorting. Settings has reminders, Premium, data export and your account.',
    },
    {
      key: 'done',
      title: 'You’re all set',
      body: active.length ? 'You can replay this tour any time from Settings.' : 'Start by adding your first subscription. You can replay this tour any time from Settings.',
      finishLabel: active.length ? 'Done' : 'Add my first subscription',
    },
  ];

  const beforeStep = async (step: TourStep) => {
    const y = offsets.current[step.key];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: y === 0 ? 0 : Math.max(0, y - 120), animated: true });
    await new Promise((r) => setTimeout(r, 280));
  };
  const keep = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    offsets.current[key] = e.nativeEvent.layout.y;
  };

  if (!hydrated) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  const onCard = colors.primaryForeground;
  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 96, paddingHorizontal: 18, gap: compact ? 12 : 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]} numberOfLines={1}>
              {greeting()}
              {user?.displayName ? `, ${user.displayName.trim().split(' ')[0].toUpperCase()}` : ''}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>Your subscriptions</Text>
          </View>
          <View ref={bellRef} collapsable={false}>
            <IconButton icon="bell" label="Reminders" onPress={() => router.push('/(tabs)/settings')} />
          </View>
        </View>

        {/* Monthly commitment */}
        <View ref={cardRef} collapsable={false} onLayout={keep('card')} style={[styles.card, { backgroundColor: colors.primary }]}>
          <Text style={[styles.cardLabel, { color: onCard }]} numberOfLines={1}>MONTHLY COMMITMENT</Text>
          <Text style={[styles.cardAmount, { color: onCard }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(monthly, currency)}
          </Text>
          <Text style={[styles.cardSub, { color: onCard }]} numberOfLines={2}>
            {formatMoney(annual, currency)} estimated per year{summary?.mixedCurrencies ? ' (mixed currencies)' : ''}
          </Text>
          <View style={[styles.cardDivider, { backgroundColor: onCard }]} />
          <View style={styles.cardStats}>
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatLabel, { color: onCard }]} numberOfLines={1}>ACTIVE SERVICES</Text>
              <Text style={[styles.cardStatValue, { color: onCard }]} numberOfLines={1}>{active.length}</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatLabel, { color: onCard }]} numberOfLines={1}>NEXT 30 DAYS</Text>
              <Text style={[styles.cardStatValue, { color: onCard }]} numberOfLines={1}>
                {upcoming.length} {upcoming.length === 1 ? 'payment' : 'payments'}
              </Text>
            </View>
          </View>
        </View>

        {loadError ? (
          <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
            <Feather name="wifi-off" size={16} color={colors.warning} />
            <Text style={[styles.bannerText, { color: colors.accentForeground }]}>{loadError} Showing your last saved data.</Text>
          </View>
        ) : null}

        {/* Coming up */}
        <View ref={upcomingRef} collapsable={false} onLayout={keep('upcoming')}>
          <SectionHead title="Coming up" action="See all" colors={colors} />
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {active.length === 0 ? (
              <GetStarted colors={colors} />
            ) : upcoming.length ? (
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

        {/* Where it goes */}
        {categories.length ? (
          <View ref={mixRef} collapsable={false} onLayout={keep('mix')}>
            <SectionHead title="Where it goes" action="Details" colors={colors} />
            <View style={[styles.panel, styles.mixPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {categories.slice(0, categoryRows).map(({ category, amount }) => (
                <View key={category} style={styles.mixRow}>
                  <View style={styles.mixLine}>
                    <Text style={[styles.mixName, { color: colors.foreground }]} numberOfLines={1}>{categoryLabels[category]}</Text>
                    <Text style={[styles.mixAmount, { color: colors.foreground }]} numberOfLines={1}>{formatMoney(amount, currency)}</Text>
                  </View>
                  <View style={[styles.mixTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.mixBar,
                        { width: `${Math.max(6, (amount / categories[0].amount) * 100)}%`, backgroundColor: categoryColor(colors, category) },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View ref={addRef} collapsable={false} onLayout={keep('add')}>
          <Pressable
            testID="add-subscription"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openAdd();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.brand.gold }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
          >
            <Feather name="plus" size={20} color={colors.brand.ink} />
            <Text style={[styles.addText, { color: colors.brand.ink }]}>Add subscription</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppTour
        visible={touring}
        steps={steps}
        beforeStep={beforeStep}
        onSkip={finishTour}
        onFinish={() => {
          finishTour();
          if (!active.length) openAdd();
        }}
      />
    </>
  );
}

function SectionHead({ title, action, colors }: { title: string; action: string; colors: Colors }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <Pressable onPress={() => router.push('/(tabs)/subscriptions')} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.sectionAction, { color: colors.brand.gold }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

function UpcomingRow({ item, colors, divider }: { item: Subscription; colors: Colors; divider: boolean }) {
  const compactLogo = useWindowDimensions().height < 800;
  const days = getDaysUntil(item.nextRenewal);
  const date = new Date(`${item.nextRenewal}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return (
    <Pressable
      onPress={() => router.push(`/subscription/${item.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.upRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
    >
      <ServiceLogo name={item.name} size={compactLogo ? 40 : 44} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[styles.upName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.upMeta, { color: days <= 3 ? colors.warning : colors.mutedForeground }]} numberOfLines={1}>
          {date} · {when}
        </Text>
      </View>
      <Text style={[styles.upAmount, { color: colors.foreground }]} numberOfLines={1}>{formatMoney(item.amount, item.currency)}</Text>
    </Pressable>
  );
}

/** First run: popular services, so the first entry takes one tap. */
function GetStarted({ colors }: { colors: Colors }) {
  return (
    <View style={{ paddingVertical: 14 }}>
      <Text style={[styles.startTitle, { color: colors.foreground }]}>Add your first subscription</Text>
      <Text style={[styles.startBody, { color: colors.mutedForeground }]}>Tap one you pay for, or add your own.</Text>
      <View style={styles.chips}>
        {POPULAR.map((p) => (
          <Pressable
            key={p.name}
            onPress={() => router.push({ pathname: '/add', params: { name: p.name, category: p.category } })}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name}`}
            style={({ pressed }) => [styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <ServiceLogo name={p.name} size={22} />
            <Text style={[styles.chipText, { color: colors.foreground }]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: 0.6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.5, marginTop: 2 },
  card: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 18 },
  cardLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: 0.6, opacity: 0.75 },
  cardAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -0.8, marginTop: 10, fontVariant: ['tabular-nums'] },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 6, opacity: 0.75 },
  cardDivider: { height: StyleSheet.hairlineWidth, opacity: 0.25, marginVertical: 14 },
  cardStats: { flexDirection: 'row', gap: 12 },
  cardStat: { flex: 1, gap: 6 },
  cardStatLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.5, opacity: 0.75 },
  cardStatValue: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  banner: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bannerText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 19, letterSpacing: -0.3 },
  sectionAction: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  panel: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  upName: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  upMeta: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  upAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 16, fontVariant: ['tabular-nums'] },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 18 },
  quietText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  mixPanel: { paddingVertical: 13, gap: 12 },
  mixRow: { gap: 9 },
  mixLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  mixName: { flexShrink: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  mixAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15, fontVariant: ['tabular-nums'] },
  mixTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  mixBar: { height: 8, borderRadius: 4 },
  addButton: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  startTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  startBody: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 6, paddingRight: 11, paddingVertical: 6, borderRadius: 13, borderWidth: 1 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});

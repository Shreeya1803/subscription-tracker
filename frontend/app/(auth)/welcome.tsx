import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMark } from '@/components/SubscriptionUI';
import { useColors } from '@/hooks/useColors';
import { APP_NAME } from '@/lib/brand';
import { findCurrency, guessCurrency } from '@/lib/currencies';

type Brand = ReturnType<typeof useColors>['brand'];

// The first screen people see before they have an account: what the app does, in three steps.
export default function WelcomeScreen() {
  const { brand } = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const pager = useRef<ScrollView>(null);
  const symbol = currencySymbol(guessCurrency());

  const slides = [
    {
      title: 'Every subscription in one place',
      body: 'Streaming, gym, phone, cloud storage. Add what you pay for and see your monthly and yearly total at a glance.',
      art: <SpendArt brand={brand} symbol={symbol} />,
    },
    {
      title: 'Hear about renewals before you pay',
      body: 'Choose how many days ahead you want a reminder, so you can keep a service or cancel it in time.',
      art: <ReminderArt brand={brand} symbol={symbol} />,
    },
    {
      title: 'Private by design',
      body: 'No bank login and no card details. You decide what to track, and you can export or delete it any time.',
      art: <PrivacyArt brand={brand} />,
    },
  ];
  const last = page === slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };
  const goTo = (index: number) => pager.current?.scrollTo({ x: index * width, animated: true });

  return (
    <View style={[styles.screen, { backgroundColor: brand.ink, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <AppMark size={30} />
          <Text style={[styles.brandName, { color: brand.white }]}>{APP_NAME}</Text>
        </View>
        {!last ? (
          <Pressable onPress={() => goTo(slides.length - 1)} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.skip, { color: brand.mist }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width, height: pagerHeight || undefined }]}>
            <View style={styles.artArea}>{slide.art}</View>
            <Text style={[styles.title, { color: brand.white }]}>{slide.title}</Text>
            <Text style={[styles.body, { color: brand.mist }]}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Step ${page + 1} of ${slides.length}`}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, { backgroundColor: i === page ? brand.gold : brand.inkLine, width: i === page ? 22 : 7 }]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (last) router.push('/signup');
            else goTo(page + 1);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: brand.gold }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryText, { color: brand.ink }]}>{last ? 'Create free account' : 'Next'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={[styles.secondaryText, { color: brand.white }]}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function currencySymbol(code: string) {
  try {
    const part = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? findCurrency(code)?.code ?? '$';
  } catch {
    return '$';
  }
}

/** Slide 1: a small stack of services adding up to a monthly total. */
function SpendArt({ brand, symbol }: { brand: Brand; symbol: string }) {
  const rows: Array<{ icon: keyof typeof Feather.glyphMap; name: string; amount: string }> = [
    { icon: 'play-circle', name: 'Streaming', amount: '15.99' },
    { icon: 'music', name: 'Music', amount: '11.99' },
    { icon: 'cloud', name: 'Cloud storage', amount: '4.49' },
  ];
  return (
    <View style={[styles.card, { backgroundColor: brand.inkRaised, borderColor: brand.inkLine }]}>
      {rows.map((row) => (
        <View key={row.name} style={styles.artRow}>
          <View style={[styles.artIcon, { backgroundColor: brand.goldSoft }]}>
            <Feather name={row.icon} size={16} color={brand.gold} />
          </View>
          <Text style={[styles.artName, { color: brand.white }]}>{row.name}</Text>
          <Text style={[styles.artAmount, { color: brand.mist }]}>{symbol}{row.amount}</Text>
        </View>
      ))}
      <View style={[styles.artTotal, { borderTopColor: brand.inkLine }]}>
        <Text style={[styles.artTotalLabel, { color: brand.mist }]}>Each month</Text>
        <Text style={[styles.artTotalValue, { color: brand.gold }]}>{symbol}32.47</Text>
      </View>
    </View>
  );
}

/** Slide 2: the reminder people receive, as it looks on the lock screen. */
function ReminderArt({ brand, symbol }: { brand: Brand; symbol: string }) {
  return (
    <View style={{ width: '100%', gap: 12 }}>
      <View style={[styles.notice, { backgroundColor: brand.white }]}>
        <View style={[styles.noticeIcon, { backgroundColor: brand.ink }]}>
          <Feather name="bell" size={15} color={brand.gold} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.noticeTitle, { color: brand.ink }]}>Streaming renews tomorrow</Text>
          <Text style={[styles.noticeBody, { color: '#4A5573' }]}>{symbol}15.99 on 12 Dec. Tap to review or cancel.</Text>
        </View>
      </View>
      <View style={[styles.notice, styles.noticeBehind, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
        <View style={[styles.noticeIcon, { backgroundColor: brand.ink }]}>
          <Feather name="bell" size={15} color={brand.gold} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.noticeTitle, { color: brand.ink }]}>Gym renews in 3 days</Text>
          <Text style={[styles.noticeBody, { color: '#4A5573' }]}>{symbol}29.00 on 14 Dec.</Text>
        </View>
      </View>
    </View>
  );
}

/** Slide 3: what the app never asks for. */
function PrivacyArt({ brand }: { brand: Brand }) {
  const points = ['No bank login', 'No card details', 'Export or delete any time'];
  return (
    <View style={[styles.card, { backgroundColor: brand.inkRaised, borderColor: brand.inkLine, alignItems: 'center' }]}>
      <View style={[styles.shield, { backgroundColor: brand.goldSoft }]}>
        <Feather name="shield" size={30} color={brand.gold} />
      </View>
      <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 6 }}>
        {points.map((point) => (
          <View key={point} style={styles.point}>
            <Feather name="check-circle" size={17} color={brand.green} />
            <Text style={[styles.pointText, { color: brand.white }]}>{point}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 24, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, letterSpacing: -0.2 },
  skip: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  pager: { flex: 1 },
  slide: { paddingHorizontal: 28, justifyContent: 'center' },
  artArea: { minHeight: 250, alignItems: 'center', justifyContent: 'center', marginBottom: 34 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 360 },
  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: 28, marginBottom: 22 },
  dot: { height: 7, borderRadius: 4 },
  actions: { paddingHorizontal: 24, gap: 6 },
  primary: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  card: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 18, gap: 14 },
  artRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  artIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  artName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15 },
  artAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15, fontVariant: ['tabular-nums'] },
  artTotal: { borderTopWidth: 1, paddingTop: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  artTotalLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  artTotalValue: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  notice: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  noticeBehind: { marginHorizontal: 14, opacity: 0.9 },
  noticeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  noticeBody: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  shield: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
});

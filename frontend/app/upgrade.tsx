import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useColors } from '@/hooks/useColors';
import { billingApi } from '@/lib/api';
import { FREE_ACTIVE_LIMIT, LEGAL, MANAGE_SUBSCRIPTION_URL, PLANS, PlanId } from '@/lib/plan';
import {
  isAlreadyPurchased,
  isUserCancelled,
  loadStorePlans,
  purchasePackage,
  purchasesAvailable,
  restorePurchases,
  StorePlan,
} from '@/lib/purchases';

const benefits: { icon: keyof typeof Feather.glyphMap; title: string; text: string; soon?: boolean }[] = [
  { icon: 'layers', title: 'Unlimited subscriptions', text: 'Track everything you pay for, with no cap.' },
  { icon: 'trending-up', title: 'Spending trends', text: 'See how your spending changes over time.', soon: true },
  { icon: 'eye-off', title: 'Unused-service alerts', text: 'Spot subscriptions you have stopped using.', soon: true },
];

const periodLabel: Record<PlanId, string> = { monthly: '/month', annual: '/year', lifetime: ' one-time' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function UpgradeScreen() {
  const colors = useColors();
  const { user, refreshUser } = useAuth();
  const { subscriptions } = useSubscriptions();
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const isPremium = !!user && user.premiumStatus !== 'free';

  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [loading, setLoading] = useState(purchasesAvailable);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  // Pick up a plan change made elsewhere (for example after a purchase on another device).
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const load = useCallback(async () => {
    if (!purchasesAvailable) return;
    setLoading(true);
    setLoadError('');
    try {
      const list = await loadStorePlans();
      setPlans(list);
      if (list.length && !list.some((p) => p.id === 'annual')) setSelected(list[0].id);
      if (!list.length) setLoadError('No plans are available right now. Please try again later.');
    } catch {
      setLoadError(`Couldn't load prices from ${store}. Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  /** After the store confirms, ask our backend to check RevenueCat until Premium is active. */
  const activate = async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const result = await billingApi.sync();
        if (result.premiumStatus !== 'free') {
          await refreshUser();
          return true;
        }
      } catch {
        /* keep trying: the webhook may still be on its way */
      }
      await sleep(2000);
    }
    await refreshUser();
    return false;
  };

  const finish = (activated: boolean) => {
    if (activated) {
      Alert.alert('Welcome to Premium', 'You can now track unlimited subscriptions.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert(
        'Purchase received',
        'Premium is being activated and can take a minute. Pull to refresh or reopen the app if it does not appear.',
      );
    }
  };

  const buy = async () => {
    if (!purchasesAvailable) return comingSoon();
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setBusy('purchase');
    try {
      await purchasePackage(plan.pkg);
      finish(await activate());
    } catch (e: any) {
      if (isUserCancelled(e)) return;
      if (isAlreadyPurchased(e)) {
        Alert.alert('Already purchased', 'This account already owns this plan. Tap "Restore purchases" to unlock it.');
        return;
      }
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!purchasesAvailable) return comingSoon();
    setBusy('restore');
    try {
      const info = await restorePurchases();
      if (Object.keys(info.entitlements.active).length === 0) {
        Alert.alert('Nothing to restore', `No previous Premium purchase was found for this ${store} account.`);
        return;
      }
      finish(await activate());
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // Shown when purchases are not configured (no RevenueCat key, or running on web).
  const comingSoon = () =>
    Alert.alert(
      'Premium is coming soon',
      `Purchases through ${store} will be available when the app launches. Your ${FREE_ACTIVE_LIMIT} free subscriptions keep working.`,
    );

  const openManage = () => void Linking.openURL(Platform.OS === 'ios' ? MANAGE_SUBSCRIPTION_URL.ios : MANAGE_SUBSCRIPTION_URL.android);

  const expiry = user?.premiumExpiresAt
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(user.premiumExpiresAt))
    : null;

  // Prices from the store when available; otherwise the plain plan list.
  const cards = purchasesAvailable
    ? plans.map((p) => ({ ...PLANS.find((x) => x.id === p.id)!, store: p }))
    : PLANS.map((p) => ({ ...p, store: undefined as StorePlan | undefined }));
  const selectedHasStore = !purchasesAvailable || plans.some((p) => p.id === selected);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PREMIUM</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{isPremium ? 'You are on Premium' : 'Track without limits'}</Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.closeButton}>
          <Feather name="x" size={21} color={colors.foreground} />
        </Pressable>
      </View>

      {isPremium ? (
        <>
          <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={[styles.bannerText, { color: colors.secondaryForeground }]}>
              {user!.premiumStatus === 'lifetime'
                ? 'You have lifetime access. Track as many subscriptions as you like.'
                : `Your ${user!.premiumStatus} plan is active${expiry ? ` until ${expiry}` : ''}. It renews automatically unless you cancel.`}
            </Text>
          </View>
          {user!.premiumStatus !== 'lifetime' ? (
            <Pressable onPress={openManage} accessibilityRole="link" style={styles.restore}>
              <Text style={[styles.restoreText, { color: colors.accentForeground }]}>Manage or cancel in {store}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
            <Feather name="info" size={18} color={colors.warning} />
            <Text style={[styles.bannerText, { color: colors.accentForeground }]}>
              You are tracking {Math.min(activeCount, FREE_ACTIVE_LIMIT)} of {FREE_ACTIVE_LIMIT} free subscriptions. Upgrade to add more.
            </Text>
          </View>

          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <View style={[styles.benefitIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={b.icon} size={18} color={colors.secondaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.benefitTitleRow}>
                    <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{b.title}</Text>
                    {b.soon ? (
                      <View style={[styles.pill, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.pillText, { color: colors.accentForeground }]}>Coming soon</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.benefitText, { color: colors.mutedForeground }]}>{b.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.benefitText, { color: colors.mutedForeground }]}>Loading prices…</Text>
            </View>
          ) : loadError ? (
            <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
              <Feather name="wifi-off" size={18} color={colors.warning} />
              <Text style={[styles.bannerText, { color: colors.accentForeground }]}>{loadError}</Text>
              <Pressable onPress={() => void load()} accessibilityRole="button">
                <Text style={[styles.restoreText, { color: colors.accentForeground }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.plans}>
              {cards.map((p) => {
                const isSelected = selected === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${p.title} plan${p.store ? `, ${p.store.price}${periodLabel[p.id]}` : ''}`}
                    style={[
                      styles.planCard,
                      { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border, borderWidth: isSelected ? 2 : 1 },
                    ]}
                  >
                    <Feather name={isSelected ? 'check-circle' : 'circle'} size={20} color={isSelected ? colors.primary : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.benefitTitleRow}>
                        <Text style={[styles.planTitle, { color: colors.foreground }]}>{p.title}</Text>
                        {p.store?.savePercent ? (
                          <View style={[styles.pill, { backgroundColor: colors.successSoft }]}>
                            <Text style={[styles.pillText, { color: colors.success }]}>Save {p.store.savePercent}%</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.planBlurb, { color: colors.mutedForeground }]}>
                        {p.store?.perMonth ? `${p.store.perMonth} · ` : ''}
                        {p.blurb}
                      </Text>
                    </View>
                    {p.store ? (
                      <View style={styles.priceCol}>
                        <Text style={[styles.price, { color: colors.foreground }]}>{p.store.price}</Text>
                        <Text style={[styles.period, { color: colors.mutedForeground }]}>{periodLabel[p.id].trim()}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <PrimaryButton
            label={busy === 'purchase' ? 'Processing…' : 'Upgrade to Premium'}
            icon="star"
            onPress={() => void buy()}
            disabled={!!busy || loading || (purchasesAvailable && (!!loadError || !selectedHasStore))}
          />

          <Pressable onPress={() => void restore()} disabled={!!busy} accessibilityRole="button" style={styles.restore}>
            <Text style={[styles.restoreText, { color: colors.accentForeground }]}>
              {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Payment is charged to your {store} account. Monthly and annual plans renew automatically at the same price
            until you cancel in your {store} account settings, at least 24 hours before the renewal date. Lifetime is a
            single payment.
          </Text>

          {LEGAL.termsUrl || LEGAL.privacyUrl ? (
            <View style={styles.legalRow}>
              {LEGAL.termsUrl ? (
                <Text onPress={() => void Linking.openURL(LEGAL.termsUrl)} style={[styles.legalLink, { color: colors.accentForeground }]}>
                  Terms of Use
                </Text>
              ) : null}
              {LEGAL.privacyUrl ? (
                <Text onPress={() => void Linking.openURL(LEGAL.privacyUrl)} style={[styles.legalLink, { color: colors.accentForeground }]}>
                  Privacy Policy
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 70, gap: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.6 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  benefits: { gap: 14, marginTop: 2 },
  benefitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  benefitIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  benefitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  benefitTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  benefitText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  plans: { gap: 10 },
  planCard: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  planBlurb: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  period: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  restore: { alignItems: 'center', paddingVertical: 6 },
  restoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  footnote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legalLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
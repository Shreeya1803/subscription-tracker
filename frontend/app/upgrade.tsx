import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/SubscriptionUI';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useColors } from '@/hooks/useColors';
import { FREE_ACTIVE_LIMIT, PLANS, PlanId } from '@/lib/plan';

const benefits: { icon: keyof typeof Feather.glyphMap; title: string; text: string; soon?: boolean }[] = [
  { icon: 'layers', title: 'Unlimited subscriptions', text: 'Track everything you pay for, with no cap.' },
  { icon: 'trending-up', title: 'Spending trends', text: 'See how your spending changes over time.', soon: true },
  { icon: 'eye-off', title: 'Unused-service alerts', text: 'Spot subscriptions you have stopped using.', soon: true },
];

export default function UpgradeScreen() {
  const colors = useColors();
  const { user, refreshUser } = useAuth();
  const { subscriptions } = useSubscriptions();
  const [plan, setPlan] = useState<PlanId>('annual');
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const isPremium = !!user && user.premiumStatus !== 'free';

  // Pick up a plan change made elsewhere (for example after a purchase on another device).
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Placeholder until the store purchase flow is connected.
  const comingSoon = () =>
    Alert.alert(
      'Premium is coming soon',
      `Purchases through the ${store} will be available when the app launches. Your ${FREE_ACTIVE_LIMIT} free subscriptions keep working.`,
    );

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
        <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={[styles.bannerText, { color: colors.secondaryForeground }]}>
            Your account already has Premium. Close this screen and tap Add again.
          </Text>
        </View>
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
                      <View style={[styles.soonPill, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.soonText, { color: colors.accentForeground }]}>Coming soon</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.benefitText, { color: colors.mutedForeground }]}>{b.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.plans}>
            {PLANS.map((p) => {
              const selected = plan === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlan(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${p.title} plan`}
                  style={[
                    styles.planCard,
                    { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 },
                  ]}
                >
                  <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? colors.primary : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: colors.foreground }]}>{p.title}</Text>
                    <Text style={[styles.planBlurb, { color: colors.mutedForeground }]}>{p.blurb}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton label="Upgrade to Premium" icon="star" onPress={comingSoon} />

          <Pressable onPress={comingSoon} accessibilityRole="button" style={styles.restore}>
            <Text style={[styles.restoreText, { color: colors.accentForeground }]}>Restore purchases</Text>
          </Pressable>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Prices are shown by the {store} at checkout. Payment and subscription management are handled by the {store}.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
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
  soonPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  soonText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  plans: { gap: 10 },
  planCard: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  planBlurb: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  restore: { alignItems: 'center', paddingVertical: 6 },
  restoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  footnote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
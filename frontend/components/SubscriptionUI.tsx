import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  Category,
  formatMoney,
  formatRenewal,
  getDaysUntil,
  Subscription,
} from '@/context/SubscriptionContext';

export const categoryLabels: Record<Category, string> = {
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  work: 'Work',
  health: 'Health',
  other: 'Other',
};

export const categoryIcons: Record<Category, keyof typeof Feather.glyphMap> = {
  entertainment: 'play-circle',
  utilities: 'home',
  work: 'briefcase',
  health: 'heart',
  other: 'grid',
};

export function AppMark({ size = 42 }: { size?: number }) {
  const colors = useColors();
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 3, backgroundColor: colors.primary }]}>
      <View style={[styles.markRing, { width: size * 0.56, height: size * 0.56, borderRadius: size, borderColor: colors.tint }]} />
      <Feather name="check" size={size * 0.36} color={colors.success} strokeWidth={3} />
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'muted',
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  tone?: 'muted' | 'primary';
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`icon-button-${label.toLowerCase().replace(/\s/g, '-')}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: tone === 'primary' ? colors.primary : colors.card },
        pressed && styles.pressed,
      ]}
    >
      <Feather
        name={icon}
        size={19}
        color={tone === 'primary' ? colors.primaryForeground : colors.foreground}
      />
    </Pressable>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={[styles.sectionAction, { color: colors.accentForeground }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SubscriptionRow({
  subscription,
  onPress,
  compact = false,
}: {
  subscription: Subscription;
  onPress: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const days = getDaysUntil(subscription.nextRenewal);
  const icon = categoryIcons[subscription.category];
  const isSoon = days >= 0 && days <= 7;
  return (
    <Pressable
      onPress={onPress}
      testID={`subscription-row-${subscription.id}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.subscriptionRow,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.compactRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.serviceIcon, { backgroundColor: colors.navySoft }]}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.subscriptionInfo}>
        <View style={styles.rowTopLine}>
          <Text numberOfLines={1} style={[styles.subscriptionName, { color: colors.foreground }]}>
            {subscription.name}
          </Text>
          <Text style={[styles.subscriptionAmount, { color: colors.foreground }]}>
            {formatMoney(subscription.amount, subscription.currency)}
          </Text>
        </View>
        <View style={styles.rowBottomLine}>
          <Text style={[styles.subscriptionMeta, { color: colors.mutedForeground }]}>
            {categoryLabels[subscription.category]} · {subscription.billingCycle}
          </Text>
          {!compact ? (
            <Text style={[styles.subscriptionMeta, { color: isSoon ? colors.warning : colors.mutedForeground }]}>
              {days < 0 ? 'Past due' : days === 0 ? 'Renews today' : `Renews ${formatRenewal(subscription.nextRenewal)}`}
            </Text>
          ) : null}
        </View>
      </View>
      {!compact ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search subscriptions',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.searchField, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={18} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.searchInput, { color: colors.foreground }]}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search">
          <Feather name="x-circle" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.primary },
        disabled && { opacity: 0.45 },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Feather name={icon} size={18} color={colors.primaryForeground} /> : null}
      <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'inbox',
  action,
}: {
  title: string;
  message: string;
  icon?: keyof typeof Feather.glyphMap;
  action?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={24} color={colors.secondaryForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>{message}</Text>
      {action}
    </View>
  );
}

export function LoadingState() {
  const colors = useColors();
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={colors.tint} />
      <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your subscriptions…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 0 },
  markRing: { position: 'absolute', borderWidth: 3 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  subscriptionRow: { minHeight: 76, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  compactRow: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, marginBottom: 2 },
  serviceIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  subscriptionInfo: { flex: 1, gap: 7 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowBottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subscriptionName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 },
  subscriptionAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  subscriptionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, textTransform: 'capitalize' },
  searchField: { minHeight: 50, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  primaryButton: { minHeight: 54, paddingHorizontal: 20, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  emptyState: { minHeight: 220, borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, textAlign: 'center' },
  emptyMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
});
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { serviceLogoUrl, tileColor } from '@/lib/serviceLogos';
import { isDockOpen, reportDock } from '@/lib/splashDock';
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

/** One colour per category, used for icons, the spending bar and its legend. */
export function categoryColor(colors: ReturnType<typeof useColors>, category: Category) {
  const map: Record<Category, string> = {
    entertainment: colors.brand.gold,
    utilities: '#5B8DEF',
    work: colors.isDark ? '#C9D3EA' : colors.brand.ink,
    health: colors.brand.green,
    other: '#9AA3B5',
  };
  return map[category];
}

/** Short renewal label that always fits: "Today", "Tomorrow", "In 3 days" or "14 Nov". */
export function renewalLabel(nextRenewal: string) {
  const days = getDaysUntil(nextRenewal);
  if (days < 0) return 'Past due';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  return formatRenewal(nextRenewal);
}

/** The service's own icon when we know it (Netflix, Spotify…), otherwise a coloured letter tile. */
export function ServiceLogo({ name, size = 42 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = serviceLogoUrl(name);
  const radius = Math.round(size * 0.3);
  if (url && !failed) {
    return (
      <View style={[styles.logoWrap, { width: size, height: size, borderRadius: radius }]}>
        <Image
          source={{ uri: url }}
          style={{ width: size * 0.62, height: size * 0.62 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  return (
    <View style={[styles.logoWrap, { width: size, height: size, borderRadius: radius, backgroundColor: tileColor(name) }]}>
      <Text style={[styles.logoLetter, { fontSize: size * 0.42 }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

/** The Subscript logo (navy tile with the calendar and arrows). `dock` marks the first screen's logo for the launch animation. */
export function AppMark({ size = 42, dock = false }: { size?: number; dock?: boolean }) {
  const ref = useRef<View>(null);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={
        dock && isDockOpen()
          ? () => ref.current?.measureInWindow((x, y, width, height) => reportDock({ x, y, width, height }))
          : undefined
      }
      style={{ width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden' }}
      accessibilityRole="image"
      accessibilityLabel="Subscript"
    >
      <RNImage source={require('@/assets/images/logo-mark.png')} style={{ width: size, height: size }} />
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
  const isSoon = days >= 0 && days <= 7;
  const cycle = subscription.billingCycle === 'custom' ? `Every ${subscription.customCycleDays ?? '?'} days` : subscription.billingCycle;
  return (
    <Pressable
      onPress={onPress}
      testID={`subscription-row-${subscription.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${subscription.name}, ${formatMoney(subscription.amount, subscription.currency)} ${cycle}, renews ${renewalLabel(subscription.nextRenewal)}`}
      style={({ pressed }) => [
        styles.subscriptionRow,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.compactRow,
        pressed && styles.pressed,
      ]}
    >
      <ServiceLogo name={subscription.name} size={42} />
      {/* Left side shrinks (and truncates) first, so the amount and date never leave the card. */}
      <View style={styles.rowLeft}>
        <Text numberOfLines={1} style={[styles.subscriptionName, { color: colors.foreground }]}>
          {subscription.name}
        </Text>
        <Text numberOfLines={1} style={[styles.subscriptionMeta, { color: colors.mutedForeground }]}>
          <Text style={styles.capitalize}>{cycle}</Text> · {categoryLabels[subscription.category]}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text numberOfLines={1} style={[styles.subscriptionAmount, { color: colors.foreground }]}>
          {formatMoney(subscription.amount, subscription.currency)}
        </Text>
        {!compact ? (
          <Text numberOfLines={1} style={[styles.subscriptionMeta, { color: isSoon || days < 0 ? colors.warning : colors.mutedForeground }]}>
            {renewalLabel(subscription.nextRenewal)}
          </Text>
        ) : null}
      </View>
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
  logoWrap: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoLetter: { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  subscriptionRow: { minHeight: 68, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  compactRow: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, marginBottom: 2 },
  serviceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowLeft: { flex: 1, minWidth: 0, gap: 4 },
  rowRight: { flexShrink: 0, maxWidth: '46%', alignItems: 'flex-end', gap: 4 },
  subscriptionName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  subscriptionAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15, fontVariant: ['tabular-nums'] },
  subscriptionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  capitalize: { textTransform: 'capitalize' },
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
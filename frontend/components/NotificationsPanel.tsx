import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceLogo } from '@/components/SubscriptionUI';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useColors } from '@/hooks/useColors';
import { AppNotification, notificationsApi } from '@/lib/api';

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Panel that slides in from the right with the reminders this account has received.
 * Opening it marks them as read. Reminder settings themselves stay in Settings.
 */
export function NotificationsPanel({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.88, 380);
  const slide = useRef(new Animated.Value(panelWidth)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const { subscriptions } = useSubscriptions();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(visible);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await notificationsApi.list();
      setItems(list);
      if (list.some((n) => !n.readAt)) {
        await notificationsApi.markAllRead().catch(() => {});
        onChanged();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your notifications.');
    } finally {
      setLoading(false);
    }
  }, [onChanged]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(panelWidth);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      void load();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slide, { toValue: panelWidth, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const clear = async () => {
    try {
      await notificationsApi.clearAll();
      setItems([]);
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'Could not clear your notifications.');
    }
  };

  const open = (n: AppNotification) => {
    const exists = n.subscriptionId && subscriptions.some((s) => s.id === n.subscriptionId);
    onClose();
    if (exists) setTimeout(() => router.push(`/subscription/${n.subscriptionId}`), 240);
  };

  if (!mounted) return null;
  const nameFor = (n: AppNotification) => subscriptions.find((s) => s.id === n.subscriptionId)?.name ?? n.title.split(' renews')[0];

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close notifications" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          { width: panelWidth, backgroundColor: colors.background, borderColor: colors.border, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateX: slide }] },
        ]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole="header">Notifications</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Renewal reminders from the last 90 days</Text>

        {loading && !items.length ? (
          <View style={styles.center}><ActivityIndicator color={colors.brand.gold} /></View>
        ) : error ? (
          <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
            <Feather name="wifi-off" size={16} color={colors.warning} />
            <Text style={[styles.noteText, { color: colors.accentForeground }]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 10, flexGrow: 1 }}
            ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="bell" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications yet</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  When a subscription is about to renew, your reminder will also appear here.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body} ${timeAgo(item.sentAt)}`}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              >
                <ServiceLogo name={nameFor(item)} size={38} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                    {!item.readAt ? <View style={[styles.dot, { backgroundColor: colors.brand.gold }]} /> : null}
                  </View>
                  <Text style={[styles.itemBody, { color: colors.mutedForeground }]} numberOfLines={2}>{item.body}</Text>
                  <Text style={[styles.itemTime, { color: colors.mutedForeground }]}>{timeAgo(item.sentAt)}</Text>
                </View>
              </Pressable>
            )}
          />
        )}

        <View style={[styles.foot, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/(tabs)/settings'), 240);
            }}
            accessibilityRole="button"
            style={styles.footBtn}
          >
            <Feather name="settings" size={15} color={colors.accentForeground} />
            <Text style={[styles.footText, { color: colors.accentForeground }]}>Reminder settings</Text>
          </Pressable>
          {items.length ? (
            <Pressable onPress={() => void clear()} accessibilityRole="button" style={styles.footBtn}>
              <Text style={[styles.footText, { color: colors.mutedForeground }]}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(3, 9, 22, 0.5)' },
  panel: { position: 'absolute', top: 0, bottom: 0, right: 0, borderLeftWidth: 1, paddingHorizontal: 18, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 14, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  noteText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  sep: { height: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
  itemBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  itemTime: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  footText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAddSubscription } from '@/hooks/useAddSubscription';
import { Category, formatMoney, getDaysUntil, useSubscriptions } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import {
  EmptyState,
  FilterChip,
  IconButton,
  SearchField,
  SubscriptionRow,
  categoryLabels,
} from '@/components/SubscriptionUI';

type SortMode = 'renewal' | 'cost' | 'name';

export default function SubscriptionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subscriptions, hydrated, summary, monthlyEquivalent } = useSubscriptions();
  const { user } = useAuth();
  const { openAdd } = useAddSubscription();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('renewal');

  const visibleSubscriptions = useMemo(() => {
    const filtered = subscriptions.filter((item) => {
      const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase().trim());
      const matchesCategory = category === 'all' || item.category === category;
      return matchesQuery && matchesCategory && item.status !== 'canceled';
    });
    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'cost') return b.amount - a.amount;
      return getDaysUntil(a.nextRenewal) - getDaysUntil(b.nextRenewal);
    });
  }, [category, query, sort, subscriptions]);

  const active = subscriptions.filter((item) => item.status === 'active');
  const monthly = summary?.monthlyTotal ?? active.reduce((sum, item) => sum + monthlyEquivalent(item), 0);

  if (!hydrated) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>Subscriptions</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {active.length === 0
              ? 'Nothing tracked yet'
              : `${active.length} active, ${formatMoney(monthly, user?.defaultCurrency ?? 'USD')} a month`}
          </Text>
        </View>
        <IconButton icon="plus" tone="primary" label="Add subscription" onPress={openAdd} />
      </View>
      <View style={styles.searchWrap}>
        <SearchField value={query} onChangeText={setQuery} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label="All" selected={category === 'all'} onPress={() => setCategory('all')} />
          {(Object.keys(categoryLabels) as Category[]).map((item) => (
            <FilterChip
              key={item}
              label={categoryLabels[item]}
              selected={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]} numberOfLines={1}>
            {visibleSubscriptions.length} {visibleSubscriptions.length === 1 ? 'service' : 'services'}
          </Text>
          <View style={[styles.segment, { backgroundColor: colors.muted }]} accessibilityRole="tablist">
            {(['renewal', 'cost', 'name'] as SortMode[]).map((item) => {
              const on = sort === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSort(item)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Sort by ${item === 'renewal' ? 'next renewal' : item === 'cost' ? 'cost' : 'name'}`}
                  style={[styles.segmentItem, on && { backgroundColor: colors.card }]}
                >
                  <Text style={[styles.sortText, { color: on ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                    {item === 'renewal' ? 'Next up' : item === 'cost' ? 'Cost' : 'A–Z'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <FlatList
        data={visibleSubscriptions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        renderItem={({ item }) => (
          <SubscriptionRow subscription={item} onPress={() => router.push(`/subscription/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={query || category !== 'all' ? 'search' : 'plus-circle'}
            title={query || category !== 'all' ? 'No matches found' : 'Start your list'}
            message={query || category !== 'all' ? 'Try another search or category.' : 'Add the recurring services you want to keep an eye on.'}
            action={!query && category === 'all' ? (
              <Pressable onPress={openAdd} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
                <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>Add first subscription</Text>
              </Pressable>
            ) : undefined}
          />
        }
        scrollEnabled={visibleSubscriptions.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  searchWrap: { paddingHorizontal: 20 },
  filterRow: { gap: 8, paddingVertical: 10 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 8 },
  resultCount: { flexShrink: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  segmentItem: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 },
  sortText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  listContent: { paddingHorizontal: 20, paddingTop: 6, flexGrow: 1 },
  emptyAction: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, marginTop: 7 },
  emptyActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
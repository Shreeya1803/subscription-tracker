import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Category, getDaysUntil, useSubscriptions } from '@/context/SubscriptionContext';
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
  const { subscriptions, hydrated } = useSubscriptions();
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

  if (!hydrated) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR MONEY, CLEARER</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Subscriptions</Text>
        </View>
        <IconButton icon="plus" tone="primary" label="Add subscription" onPress={() => router.push('/add')} />
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
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {visibleSubscriptions.length} {visibleSubscriptions.length === 1 ? 'service' : 'services'}
          </Text>
          <View style={styles.sortOptions}>
            {(['renewal', 'cost', 'name'] as SortMode[]).map((item) => (
              <Pressable key={item} onPress={() => setSort(item)} accessibilityRole="button">
                <Text style={[styles.sortText, { color: sort === item ? colors.accentForeground : colors.mutedForeground }]}>
                  {item === 'renewal' ? 'Next up' : item === 'cost' ? 'Cost' : 'A–Z'}
                </Text>
              </Pressable>
            ))}
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
              <Pressable onPress={() => router.push('/add')} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
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
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.6 },
  searchWrap: { paddingHorizontal: 20 },
  filterRow: { gap: 8, paddingVertical: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 8 },
  resultCount: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sortOptions: { flexDirection: 'row', gap: 13 },
  sortText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  listContent: { paddingHorizontal: 20, paddingTop: 6, flexGrow: 1 },
  emptyAction: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, marginTop: 7 },
  emptyActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
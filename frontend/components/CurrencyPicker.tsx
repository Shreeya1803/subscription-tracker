import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CURRENCIES, findCurrency } from '@/lib/currencies';

/** A list of currencies to choose from, shown as a sheet. */
export function CurrencySheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close currency list" />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Choose a currency</Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by country or code"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.foreground }]}
            accessibilityLabel="Search currencies"
          />
        </View>
        <FlatList
          data={results}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedForeground }]}>No currency matches “{query}”.</Text>}
          renderItem={({ item }) => {
            const selected = item.code === value;
            return (
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  onSelect(item.code);
                  close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: selected ? colors.accent : 'transparent' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.optionCode, { color: colors.mutedForeground }]}>{item.code}</Text>
                </View>
                {selected ? <Feather name="check" size={19} color={colors.accentForeground} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/** Form field that shows the chosen currency and opens the list when tapped. */
export function CurrencyField({ label, value, onChange }: { label: string; value: string; onChange: (code: string) => void }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const current = findCurrency(value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.name ?? value}. Tap to change.`}
        style={({ pressed }) => [styles.field, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.flag}>{current?.flag ?? '💱'}</Text>
        <Text style={[styles.fieldText, { color: colors.foreground }]} numberOfLines={1}>
          {current ? `${current.name} (${current.code})` : value}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>
      <CurrencySheet visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 12, 24, 0.45)' },
  sheet: { maxHeight: '82%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  search: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 10 },
  list: { marginTop: 10 },
  option: { minHeight: 56, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 22 },
  optionCopy: { flex: 1, gap: 2 },
  optionName: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  optionCode: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  field: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
});

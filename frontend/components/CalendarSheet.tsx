import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** YYYY-MM-DD for a local date (no time-zone shift). */
export function toIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date from YYYY-MM-DD (falls back to today if the text is not a date). */
export function fromIsoDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** e.g. "Sat, 14 Nov 2026" */
export function formatLongDate(value: string) {
  return fromIsoDate(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** A month calendar shown as a sheet. Calls onSelect with YYYY-MM-DD. */
export function CalendarSheet({
  visible,
  value,
  title = 'Choose a date',
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  title?: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const selected = fromIsoDate(value);
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const todayIso = toIsoDate(new Date());

  // Each time the sheet opens, show the month of the chosen date.
  useEffect(() => {
    if (visible) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const pick = (iso: string) => {
    void Haptics.selectionAsync();
    onSelect(iso);
    onClose();
  };
  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const inDays = (n: number) => toIsoDate(new Date(Date.now() + n * 86400000));
  const inMonths = (n: number) => {
    const d = new Date();
    return toIsoDate(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()));
  };
  const shortcuts = [
    { label: 'Today', iso: todayIso },
    { label: 'In a week', iso: inDays(7) },
    { label: 'In a month', iso: inMonths(1) },
    { label: 'In a year', iso: inMonths(12) },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close calendar" />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.shortcuts}>
          {shortcuts.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => pick(s.iso)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.shortcut, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.shortcutText, { color: colors.foreground }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} style={[styles.navButton, { borderColor: colors.border }]}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} style={[styles.navButton, { borderColor: colors.border }]}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.week}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={[styles.weekday, { color: colors.mutedForeground }]}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.cell} />;
              const iso = toIsoDate(day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <Pressable
                  key={di}
                  onPress={() => pick(iso)}
                  accessibilityRole="button"
                  accessibilityLabel={day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  accessibilityState={{ selected: isSelected }}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && { backgroundColor: colors.brand.gold },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.brand.gold },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: isSelected ? colors.brand.ink : colors.foreground }, isSelected && styles.daySelected]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 12, 24, 0.45)' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  shortcut: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  shortcutText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 12, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  daySelected: { fontFamily: 'Inter_700Bold' },
});

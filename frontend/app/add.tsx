import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { BillingCycle, Category, SubscriptionInput, useSubscriptions } from '@/context/SubscriptionContext';
import { PrimaryButton, categoryIcons, categoryLabels } from '@/components/SubscriptionUI';

const cycles: BillingCycle[] = ['monthly', 'yearly', 'weekly', 'quarterly'];
const reminderChoices = [1, 3, 7, 14];

export default function AddSubscriptionScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { subscriptions, addSubscription, updateSubscription } = useSubscriptions();
  const editing = useMemo(() => subscriptions.find((item) => item.id === params.id), [params.id, subscriptions]);
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : '');
  const [cycle, setCycle] = useState<BillingCycle>(editing?.billingCycle ?? 'monthly');
  const [renewal, setRenewal] = useState(editing?.nextRenewal ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [category, setCategory] = useState<Category>(editing?.category ?? 'entertainment');
  const [reminder, setReminder] = useState(editing?.reminderEnabled ?? true);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [reminderDays, setReminderDays] = useState(editing?.reminderDaysBefore ?? 3);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const currency = editing?.currency ?? user?.defaultCurrency ?? 'USD';

  const save = async () => {
    const parsedAmount = Number.parseFloat(amount);
    if (!name.trim()) {
      setError('Add a name so you can spot this service later.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(renewal)) {
      setError('Use a date in YYYY-MM-DD format.');
      return;
    }
    const values: SubscriptionInput = {
      name: name.trim(),
      amount: parsedAmount,
      currency,
      billingCycle: cycle,
      customCycleDays: cycle === 'custom' ? editing?.customCycleDays : undefined,
      nextRenewal: renewal,
      category,
      reminderEnabled: reminder,
      reminderDaysBefore: reminderDays,
      notes: notes.trim() || undefined,
    };
    setSaving(true);
    setError('');
    try {
      if (editing) await updateSubscription(editing.id, values);
      else await addSubscription(values);
    } catch (e: any) {
      // e.g. 403 "Free tier is limited to 3 active subscriptions..." comes straight from the backend
      setError(e?.message ?? 'Could not save. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAwareScrollViewCompat
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>MANUAL ENTRY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{editing ? 'Edit service' : 'Add a service'}</Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.closeButton}>
          <Feather name="x" size={21} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.form}>
        <FieldLabel label="Service name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Streamline"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          autoFocus={!editing}
          accessibilityLabel="Service name"
        />

        <FieldLabel label="How much?" />
        <View style={styles.amountRow}>
          <View style={[styles.currencyBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.currencyText, { color: colors.secondaryForeground }]}>{currency}</Text>
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            accessibilityLabel="Subscription amount"
          />
        </View>

        <FieldLabel label="Billing cycle" />
        <View style={styles.optionGrid}>
          {cycles.map((item) => (
            <OptionButton key={item} label={item} selected={cycle === item} onPress={() => setCycle(item)} colors={colors} />
          ))}
        </View>

        <FieldLabel label="Next renewal" />
        <View style={[styles.dateInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={17} color={colors.mutedForeground} />
          <TextInput
            value={renewal}
            onChangeText={setRenewal}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.dateInput, { color: colors.foreground }]}
            accessibilityLabel="Next renewal date"
          />
        </View>

        <FieldLabel label="Category" />
        <View style={styles.categoryGrid}>
          {(Object.keys(categoryLabels) as Category[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.categoryOption,
                { backgroundColor: category === item ? colors.primary : colors.card, borderColor: category === item ? colors.primary : colors.border },
              ]}
              accessibilityRole="button"
            >
              <Feather name={categoryIcons[item]} size={16} color={category === item ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.categoryOptionText, { color: category === item ? colors.primaryForeground : colors.foreground }]}>
                {categoryLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        <FieldLabel label="Renewal reminder" />
        <Pressable
          onPress={() => setReminder((value) => !value)}
          style={[styles.reminderRow, { backgroundColor: reminder ? colors.warningSoft : colors.card, borderColor: reminder ? colors.warning : colors.border }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminder }}
        >
          <View style={[styles.reminderIcon, { backgroundColor: reminder ? colors.warning : colors.muted }]}>
            <Feather name="bell" size={16} color={reminder ? colors.primaryForeground : colors.mutedForeground} />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.reminderTitle, { color: colors.foreground }]}>Remind me before renewal</Text>
            <Text style={[styles.reminderSubtext, { color: colors.mutedForeground }]}>{reminder ? `${reminderDays} day${reminderDays === 1 ? '' : 's'} before` : 'Off'}</Text>
          </View>
          <View style={[styles.toggle, { backgroundColor: reminder ? colors.warning : colors.muted }]}>
            <View style={[styles.toggleThumb, { backgroundColor: colors.card, alignSelf: reminder ? 'flex-end' : 'flex-start' }]} />
          </View>
        </Pressable>

        {reminder ? (
          <View style={styles.optionGrid}>
            {reminderChoices.map((d) => (
              <OptionButton key={d} label={`${d}d`} selected={reminderDays === d} onPress={() => setReminderDays(d)} colors={colors} />
            ))}
          </View>
        ) : null}

        <FieldLabel label="Notes (optional)" />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Family plan, work expense…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Notes"
        />

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.warningSoft }]}>
            <Feather name="alert-circle" size={16} color={colors.warning} />
            <Text style={[styles.errorText, { color: colors.accentForeground }]}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton label={saving ? 'Saving…' : editing ? 'Save changes' : 'Add subscription'} icon="check" disabled={saving} onPress={() => void save()} />
        <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
          Synced to your account. No bank connection needed.
        </Text>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

function FieldLabel({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>;
}

function OptionButton({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cycleOption, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
    >
      <Text style={[styles.cycleText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.6 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 10 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 9 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, fontFamily: 'Inter_400Regular', fontSize: 15 },
  amountRow: { flexDirection: 'row', gap: 8 },
  currencyBox: { minHeight: 52, borderRadius: 16, borderWidth: 1, width: 74, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  amountInput: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  optionGrid: { flexDirection: 'row', gap: 7 },
  cycleOption: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cycleText: { fontFamily: 'Inter_500Medium', fontSize: 11, textTransform: 'capitalize' },
  dateInputWrap: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateInput: { flex: 1, minHeight: 50, fontFamily: 'Inter_400Regular', fontSize: 15 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: { minHeight: 42, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryOptionText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  reminderRow: { minHeight: 67, borderRadius: 18, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1, gap: 2 },
  reminderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  reminderSubtext: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  toggle: { width: 38, height: 22, borderRadius: 15, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 16, height: 16, borderRadius: 10 },
  notesInput: { minHeight: 84, borderRadius: 16, borderWidth: 1, padding: 15, fontFamily: 'Inter_400Regular', fontSize: 14 },
  errorBox: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
  privacyText: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 2 },
});
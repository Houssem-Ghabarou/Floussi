import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { newId } from '@/data/repository';
import { EXPENSE_CATEGORIES } from '@/domain/categories';
import { WEEKDAY_SHORT } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount, sanitizeAmountInput } from '@/domain/money';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  haptics,
  MoneyLine,
  SheetScreen,
  TextField,
} from '@/ui/components';
import { confirmDestructive, useUnsavedChanges } from '@/ui/dialog-store';
import { Space } from '@/ui/theme';
import { showToast } from '@/ui/toast';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const ROUTINE_PRESETS = [
  { name: 'Workday', emoji: '☀️', weekdays: [1, 2, 3, 4, 5] },
  { name: 'Weekend', emoji: '🏖️', weekdays: [0, 6] },
  { name: 'Gym day', emoji: '🏋️', weekdays: [] },
  { name: 'Study day', emoji: '🎓', weekdays: [] },
];

const ITEM_SUGGESTIONS = [
  { name: 'Coffee', category: 'coffee' },
  { name: 'Breakfast', category: 'food' },
  { name: 'Lunch', category: 'food' },
  { name: 'Transport', category: 'transport' },
  { name: 'Snacks', category: 'food' },
  { name: 'Groceries', category: 'groceries' },
];

interface DraftItem {
  id: string;
  name: string;
  amountText: string;
  category: string;
}

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const saveRoutine = useApp((state) => state.saveRoutine);
  const deleteRoutine = useApp((state) => state.deleteRoutine);

  const existing = financial?.data.routines.find((routine) => routine.id === id);
  const isFirstRoutine = (financial?.data.routines.length ?? 0) === 0;

  const [name, setName] = useState(existing?.name ?? (isFirstRoutine ? 'Workday' : ''));
  const [emoji, setEmoji] = useState(existing?.emoji ?? (isFirstRoutine ? '☀️' : '📋'));
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? (isFirstRoutine ? [1, 2, 3, 4, 5] : []));
  const [items, setItems] = useState<DraftItem[]>(() =>
    existing && financial
      ? existing.items.map((item) => ({ ...item, amountText: amountToInput(item.amount, financial.currency) }))
      : [],
  );

  const hasChanges = useUnsavedChanges({ name, emoji, weekdays, items });

  if (!financial) return null;
  const { currency, data } = financial;

  const parsedItems = items.flatMap((item) => {
    const amount = parseAmount(item.amountText, currency);
    return amount && item.name.trim() ? [{ id: item.id, name: item.name.trim(), amount, category: item.category }] : [];
  });
  const total = parsedItems.reduce((sum, item) => sum + item.amount, 0);
  const valid = name.trim().length > 0 && parsedItems.length > 0;

  const movedDays = weekdays
    .map((day) => ({ day, owner: data.routines.find((routine) => routine.id !== existing?.id && routine.weekdays.includes(day)) }))
    .filter((entry) => entry.owner);

  const toggleDay = (day: number) =>
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  const updateItem = (itemId: string, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));

  const save = () => {
    if (!valid) return;
    saveRoutine({
      id: existing?.id ?? newId(),
      name: name.trim(),
      emoji,
      weekdays,
      items: parsedItems,
      enabled: true,
    });
    haptics.success();
    router.back();
    showToast(`${emoji} ${name.trim()} saved · normal total ${formatMoney(total, currency)}`);
  };

  const remove = () => {
    if (!existing) return;
    confirmDestructive({
      title: `Delete ${existing.name}?`,
      message: "Its days go back to no routine. Your recorded expenses aren't affected.",
      onConfirm: () => {
        deleteRoutine(existing.id);
        router.back();
      },
    });
  };

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={existing ? 'Edit routine' : 'New routine'}
      footer={<Button label="Save routine" onPress={save} disabled={!valid} />}>
      <AppText tone="secondary">
        Describe what a normal day usually costs. It's an expectation, not an expense: nothing is subtracted until you
        record it.
      </AppText>

      {!existing ? (
        <ChipGroup>
          {ROUTINE_PRESETS.map((preset) => (
            <Chip
              key={preset.name}
              emoji={preset.emoji}
              label={preset.name}
              selected={name === preset.name}
              onPress={() => {
                setName(preset.name);
                setEmoji(preset.emoji);
                setWeekdays(preset.weekdays);
              }}
            />
          ))}
        </ChipGroup>
      ) : null}

      <Field label="Name">
        <TextField value={name} onChangeText={setName} placeholder="Workday" />
      </Field>

      <Field
        label="Days"
        hint={
          movedDays.length
            ? `${movedDays.map((entry) => `${WEEKDAY_SHORT[entry.day]} (from ${entry.owner!.name})`).join(', ')} will move to this routine.`
            : 'Each day of the week belongs to one routine.'
        }>
        <ChipGroup>
          {WEEK_ORDER.map((day) => (
            <Chip key={day} label={WEEKDAY_SHORT[day]} selected={weekdays.includes(day)} onPress={() => toggleDay(day)} />
          ))}
        </ChipGroup>
      </Field>

      <Field label="What it usually costs">
        <ChipGroup>
          {ITEM_SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion.name}
              label={`+ ${suggestion.name}`}
              onPress={() =>
                setItems((current) => [...current, { id: newId(), name: suggestion.name, amountText: '', category: suggestion.category }])
              }
            />
          ))}
          <Chip
            label="+ Other"
            onPress={() => setItems((current) => [...current, { id: newId(), name: '', amountText: '', category: 'other' }])}
          />
        </ChipGroup>
        {items.map((item) => (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <TextField
                value={item.name}
                onChangeText={(text) => updateItem(item.id, { name: text })}
                placeholder="Item"
                style={styles.itemName}
              />
              <TextField
                value={item.amountText}
                onChangeText={(text) => updateItem(item.id, { amountText: sanitizeAmountInput(text, currency) })}
                placeholder={currency.label}
                keyboardType="decimal-pad"
                style={styles.itemAmount}
              />
              <Pressable
                hitSlop={10}
                accessibilityLabel={`Remove ${item.name || 'item'}`}
                onPress={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}>
                <AppText variant="heading" tone="muted">
                  ✕
                </AppText>
              </Pressable>
            </View>
            <View style={styles.emojiRow}>
              {EXPENSE_CATEGORIES.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityLabel={category.label}
                  accessibilityState={{ selected: item.category === category.id }}
                  onPress={() => updateItem(item.id, { category: category.id })}
                  style={[styles.emojiButton, item.category === category.id && styles.emojiSelected]}>
                  <AppText>{category.emoji}</AppText>
                </Pressable>
              ))}
            </View>
          </Card>
        ))}
      </Field>

      <Card>
        <MoneyLine label="Normal total" value={formatMoney(total, currency)} strong />
      </Card>

      {existing ? (
        <Card>
          <Button label="Delete routine" variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  itemCard: { gap: Space.sm, padding: Space.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  itemName: { flex: 1 },
  itemAmount: { width: 96, textAlign: 'right' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  emojiButton: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, opacity: 0.45 },
  emojiSelected: { opacity: 1, transform: [{ scale: 1.15 }] },
});

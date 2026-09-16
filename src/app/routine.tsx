import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { newId } from '@/data/repository';
import { expenseCategories } from '@/domain/categories';
import { weekdayShortName } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount, sanitizeAmountInput } from '@/domain/money';
import { t, type TranslationKey } from '@/i18n';
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

const ROUTINE_PRESETS: { name: TranslationKey; emoji: string; weekdays: number[] }[] = [
  { name: 'routineForm.presetWorkday', emoji: '☀️', weekdays: [1, 2, 3, 4, 5] },
  { name: 'routineForm.presetWeekend', emoji: '🏖️', weekdays: [0, 6] },
  { name: 'routineForm.presetGym', emoji: '🏋️', weekdays: [] },
  { name: 'routineForm.presetStudy', emoji: '🎓', weekdays: [] },
];

const ITEM_SUGGESTIONS: { name: TranslationKey; category: string }[] = [
  { name: 'routineForm.itemCoffee', category: 'coffee' },
  { name: 'routineForm.itemBreakfast', category: 'food' },
  { name: 'routineForm.itemLunch', category: 'food' },
  { name: 'routineForm.itemTransport', category: 'transport' },
  { name: 'routineForm.itemSnacks', category: 'food' },
  { name: 'routineForm.itemGroceries', category: 'groceries' },
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

  const [name, setName] = useState(existing?.name ?? (isFirstRoutine ? t('routineForm.presetWorkday') : ''));
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
    showToast(
      t('routineForm.saved', { emoji, name: name.trim(), amount: formatMoney(total, currency) }),
    );
  };

  const remove = () => {
    if (!existing) return;
    confirmDestructive({
      title: t('routineForm.deleteTitle', { name: existing.name }),
      message: t('routineForm.deleteMessage'),
      onConfirm: () => {
        deleteRoutine(existing.id);
        router.back();
      },
    });
  };

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={t(existing ? 'routineForm.editTitle' : 'routineForm.newTitle')}
      footer={<Button label={t('routineForm.save')} onPress={save} disabled={!valid} />}>
      <AppText tone="secondary">{t('routineForm.intro')}</AppText>

      {!existing ? (
        <ChipGroup>
          {ROUTINE_PRESETS.map((preset) => (
            <Chip
              key={preset.name}
              emoji={preset.emoji}
              label={t(preset.name)}
              selected={name === t(preset.name)}
              onPress={() => {
                setName(t(preset.name));
                setEmoji(preset.emoji);
                setWeekdays(preset.weekdays);
              }}
            />
          ))}
        </ChipGroup>
      ) : null}

      <Field label={t('common.name')}>
        <TextField value={name} onChangeText={setName} placeholder={t('routineForm.presetWorkday')} />
      </Field>

      <Field
        label={t('routineForm.days')}
        hint={
          movedDays.length
            ? t('routineForm.daysMoveHint', {
                days: movedDays
                  .map((entry) =>
                    t('routineForm.dayOwner', {
                      day: weekdayShortName(entry.day),
                      routine: entry.owner!.name,
                    }),
                  )
                  .join(', '),
              })
            : t('routineForm.daysHint')
        }>
        <ChipGroup>
          {WEEK_ORDER.map((day) => (
            <Chip
              key={day}
              label={weekdayShortName(day)}
              selected={weekdays.includes(day)}
              onPress={() => toggleDay(day)}
            />
          ))}
        </ChipGroup>
      </Field>

      <Field label={t('routineForm.costs')}>
        <ChipGroup>
          {ITEM_SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion.name}
              label={t('routineForm.addItem', { name: t(suggestion.name) })}
              onPress={() =>
                setItems((current) => [
                  ...current,
                  { id: newId(), name: t(suggestion.name), amountText: '', category: suggestion.category },
                ])
              }
            />
          ))}
          <Chip
            label={t('routineForm.other')}
            onPress={() => setItems((current) => [...current, { id: newId(), name: '', amountText: '', category: 'other' }])}
          />
        </ChipGroup>
        {items.map((item) => (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <TextField
                value={item.name}
                onChangeText={(text) => updateItem(item.id, { name: text })}
                placeholder={t('routineForm.itemPlaceholder')}
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
                accessibilityLabel={t('routineForm.removeItem', { name: item.name || t('routineForm.item') })}
                onPress={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}>
                <AppText variant="heading" tone="muted">
                  ✕
                </AppText>
              </Pressable>
            </View>
            <View style={styles.emojiRow}>
              {expenseCategories().map((category) => (
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
        <MoneyLine label={t('routineForm.normalTotal')} value={formatMoney(total, currency)} strong />
      </Card>

      {existing ? (
        <Card>
          <Button label={t('routineForm.delete')} variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  itemCard: { gap: Space.sm, padding: Space.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  itemName: { flex: 1 },
  // React Native has no logical 'end' for text, so the side follows the writing direction.
  itemAmount: { width: 96, textAlign: I18nManager.isRTL ? 'left' : 'right' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  emojiButton: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, opacity: 0.45 },
  emojiSelected: { opacity: 1, transform: [{ scale: 1.15 }] },
});

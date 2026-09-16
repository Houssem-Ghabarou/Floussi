import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { expenseCategories, expenseCategory } from '@/domain/categories';
import { addDays, type LocalDate } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { t } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  haptics,
  SheetScreen,
  TextField,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { confirmDestructive, useUnsavedChanges } from '@/ui/dialog-store';
import { showToast } from '@/ui/toast';

export default function ExpenseScreen() {
  const params = useLocalSearchParams<{ id?: string; amount?: string; past?: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const addTransaction = useApp((state) => state.addTransaction);
  const updateTransaction = useApp((state) => state.updateTransaction);
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const restoreTransaction = useApp((state) => state.restoreTransaction);

  const existing = financial?.data.transactions.find((t) => t.id === params.id && t.kind === 'expense');
  const openingDate = financial?.data.settings.openingDate;
  const today = financial?.today ?? '';

  const [amountText, setAmountText] = useState(() =>
    existing && financial ? amountToInput(existing.amount, financial.currency) : (params.amount ?? ''),
  );
  const [category, setCategory] = useState<string | null>(existing?.category ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState<LocalDate>(
    () => existing?.date ?? (params.past && openingDate ? addDays(openingDate, -1) : today),
  );

  const hasChanges = useUnsavedChanges({ amountText, category, note, date });

  if (!financial) return null;
  const { currency, status, data } = financial;
  const amount = parseAmount(amountText, currency);
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const beforeTracking = date < data.settings.openingDate;

  const save = () => {
    if (!amount || !category) return;
    const fields = { amount: -amount, category, note: note.trim() || null, date };
    haptics.success();
    router.back();
    if (existing) {
      updateTransaction({ ...existing, ...fields });
      showToast(t('expense.updated'));
      return;
    }
    const transaction = addTransaction({ kind: 'expense', ...fields });
    showToast(
      t('expense.added', { emoji: expenseCategory(category).emoji, amount: formatMoney(amount, currency) }),
      {
        label: t('common.undo'),
        onPress: () => deleteTransaction(transaction.id),
      },
    );
  };

  const remove = () => {
    if (!existing) return;
    confirmDestructive({
      title: t('expense.deleteTitle'),
      message: t('common.deleteTxMessage', {
        amount: formatMoney(existing.amount, currency, { signed: true }),
      }),
      onConfirm: () => {
        router.back();
        const removed = deleteTransaction(existing.id);
        if (removed) {
          showToast(t('expense.deleted'), { label: t('common.undo'), onPress: () => restoreTransaction(removed) });
        }
      },
    });
  };

  let preview: string | null = null;
  if (beforeTracking) {
    preview = t('expense.beforeTracking');
  } else if (amount && !existing && date === financial.today) {
    const after = status.remainingToday - amount;
    preview =
      after >= 0
        ? t('expense.leftToday', { before: m(status.remainingToday), after: m(after) })
        : t('expense.pastPace', { amount: m(-after) });
  }

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={t(existing ? 'expense.editTitle' : params.past ? 'expense.earlierTitle' : 'expense.addTitle')}
      footer={
        <Button
          label={t(existing ? 'common.saveChanges' : 'expense.save')}
          onPress={save}
          disabled={!amount || !category}
        />
      }>
      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus={!existing} prefix="−" />
      {preview ? (
        <AppText variant="small" tone="secondary">
          {preview}
        </AppText>
      ) : null}

      <Field label={t('expense.category')}>
        <ChipGroup>
          {expenseCategories().map((item) => (
            <Chip
              key={item.id}
              emoji={item.emoji}
              label={item.label}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </ChipGroup>
      </Field>

      <Field label={t('common.noteOptional')}>
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder={t('expense.notePlaceholder')}
          returnKeyType="done"
        />
      </Field>

      <Field label={t('common.date')}>
        <DateChoice
          value={date}
          onChange={setDate}
          maxDate={financial.today}
          options={[
            { label: t('common.todayLabel'), date: financial.today },
            { label: t('common.yesterdayLabel'), date: addDays(financial.today, -1) },
          ]}
        />
      </Field>

      {existing ? (
        <Card>
          <Button label={t('expense.delete')} variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { EXPENSE_CATEGORIES, expenseCategory } from '@/domain/categories';
import { addDays, type LocalDate } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
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
      showToast('Expense updated');
      return;
    }
    const transaction = addTransaction({ kind: 'expense', ...fields });
    showToast(`${expenseCategory(category).emoji} ${formatMoney(amount, currency)} added`, {
      label: 'Undo',
      onPress: () => deleteTransaction(transaction.id),
    });
  };

  const remove = () => {
    if (!existing) return;
    confirmDestructive({
      title: 'Delete this expense?',
      message: `${formatMoney(existing.amount, currency, { signed: true })} will be removed from your balance and history. You can undo right after.`,
      onConfirm: () => {
        router.back();
        const removed = deleteTransaction(existing.id);
        if (removed) showToast('Expense deleted', { label: 'Undo', onPress: () => restoreTransaction(removed) });
      },
    });
  };

  let preview: string | null = null;
  if (beforeTracking) {
    preview = "Before you started tracking: it's kept for your monthly picture and won't change your balance.";
  } else if (amount && !existing && date === financial.today) {
    const after = status.remainingToday - amount;
    preview =
      after >= 0
        ? `Left today: ${m(status.remainingToday)} → ${m(after)}`
        : `This goes ${m(-after)} past today's pace. The coming days will adjust.`;
  }

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={existing ? 'Edit expense' : params.past ? 'Earlier expense' : 'Add expense'}
      footer={<Button label={existing ? 'Save changes' : 'Save expense'} onPress={save} disabled={!amount || !category} />}>
      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus={!existing} prefix="−" />
      {preview ? (
        <AppText variant="small" tone="secondary">
          {preview}
        </AppText>
      ) : null}

      <Field label="Category">
        <ChipGroup>
          {EXPENSE_CATEGORIES.map((item) => (
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

      <Field label="Note (optional)">
        <TextField value={note} onChangeText={setNote} placeholder="Lunch with Sami" returnKeyType="done" />
      </Field>

      <Field label="Date">
        <DateChoice
          value={date}
          onChange={setDate}
          maxDate={financial.today}
          options={[
            { label: 'Today', date: financial.today },
            { label: 'Yesterday', date: addDays(financial.today, -1) },
          ]}
        />
      </Field>

      {existing ? (
        <Card>
          <Button label="Delete expense" variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

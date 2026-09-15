import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { INCOME_SOURCES, incomeSource } from '@/domain/categories';
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
  MoneyLine,
  SheetScreen,
  TextField,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { confirmDestructive, useUnsavedChanges } from '@/ui/dialog-store';
import { showToast } from '@/ui/toast';

const SAVE_OPTIONS = [
  { percent: 0, label: 'Use it this cycle' },
  { percent: 50, label: 'Save half' },
  { percent: 100, label: 'Save it all' },
];

export default function IncomeScreen() {
  const params = useLocalSearchParams<{ id?: string; cycleIncome?: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const addTransaction = useApp((state) => state.addTransaction);
  const updateTransaction = useApp((state) => state.updateTransaction);
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const restoreTransaction = useApp((state) => state.restoreTransaction);
  const updateCycle = useApp((state) => state.updateCycle);

  const existing = financial?.data.transactions.find((t) => t.id === params.id && t.kind === 'income');
  const isCycleIncome = params.cycleIncome === '1';

  const [amountText, setAmountText] = useState(() =>
    existing && financial ? amountToInput(existing.amount, financial.currency) : '',
  );
  const [source, setSource] = useState<string | null>(existing?.category ?? (isCycleIncome ? 'salary' : null));
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState<LocalDate>(existing?.date ?? financial?.today ?? '');
  const [savePercent, setSavePercent] = useState(financial?.data.settings.unexpectedIncomeSavePercent ?? 0);
  const [startNewCycle, setStartNewCycle] = useState(isCycleIncome);

  const hasChanges = useUnsavedChanges({ amountText, source, note, date, savePercent, startNewCycle });

  if (!financial) return null;
  const { currency, status, data, today } = financial;
  const amount = parseAmount(amountText, currency);
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });

  const offerNewCycle = !existing && status.daysUntilIncome <= 5;
  const offerSplit = !existing && !startNewCycle;
  const saved = amount && offerSplit ? Math.round((amount * savePercent) / 100) : 0;
  const counts = date >= data.settings.openingDate;
  const paceAfter =
    amount && counts
      ? Math.max(0, Math.floor((status.flexibleStartOfDay + amount - saved) / status.daysRemaining))
      : status.dailyAllowance;

  const save = () => {
    if (!amount || !source) return;
    const fields = { amount, category: source, note: note.trim() || null, date };
    haptics.success();

    if (existing) {
      updateTransaction({ ...existing, ...fields });
      router.back();
      showToast('Income updated');
      return;
    }

    const previousTarget = data.cycle.savingsTarget;
    const transaction = addTransaction({ kind: 'income', ...fields });
    if (saved > 0) updateCycle({ savingsTarget: previousTarget + saved });

    if (startNewCycle) {
      router.replace({ pathname: '/cycle-end', params: { incomeId: transaction.id } });
      return;
    }

    router.back();
    showToast(
      counts
        ? `You added ${m(amount)}. Your safe pace went from ${m(status.dailyAllowance)} to ${m(paceAfter)}/day.`
        : `${m(amount)} added to your history.`,
      {
        label: 'Undo',
        onPress: () => {
          deleteTransaction(transaction.id);
          if (saved > 0) updateCycle({ savingsTarget: previousTarget });
        },
      },
    );
  };

  const remove = () => {
    if (!existing) return;
    confirmDestructive({
      title: 'Delete this income?',
      message: `${formatMoney(existing.amount, currency, { signed: true })} will be removed from your balance and history. You can undo right after.`,
      onConfirm: () => {
        router.back();
        const removed = deleteTransaction(existing.id);
        if (removed) showToast('Income deleted', { label: 'Undo', onPress: () => restoreTransaction(removed) });
      },
    });
  };

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={existing ? 'Edit income' : isCycleIncome ? `Your ${data.cycle.incomeLabel.toLowerCase()} arrived` : 'Add money'}
      footer={
        <Button
          label={existing ? 'Save changes' : startNewCycle ? 'Add and review my cycle' : 'Add money'}
          onPress={save}
          disabled={!amount || !source}
        />
      }>
      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus={!existing} prefix="+" />

      <Field label="Source">
        <ChipGroup>
          {INCOME_SOURCES.map((item) => (
            <Chip
              key={item.id}
              emoji={item.emoji}
              label={item.label}
              selected={source === item.id}
              onPress={() => setSource(item.id)}
            />
          ))}
        </ChipGroup>
      </Field>

      {offerNewCycle ? (
        <Field label="Your cycle" hint="Closes this cycle with a summary and starts a new plan. Routines and rules carry over.">
          <ChipGroup>
            <Chip
              emoji="🔁"
              label={`This is my ${data.cycle.incomeLabel.toLowerCase()}, start a new cycle`}
              selected={startNewCycle}
              onPress={() => setStartNewCycle((value) => !value)}
            />
          </ChipGroup>
        </Field>
      ) : null}

      {offerSplit ? (
        <Field label="What do you want to do with it?">
          <ChipGroup>
            {SAVE_OPTIONS.map((option) => (
              <Chip
                key={option.percent}
                label={option.label}
                selected={savePercent === option.percent}
                onPress={() => setSavePercent(option.percent)}
              />
            ))}
          </ChipGroup>
        </Field>
      ) : null}

      {amount && !existing && !startNewCycle ? (
        <Card>
          {saved > 0 ? <MoneyLine label="Protected as savings" value={m(saved)} /> : null}
          <MoneyLine label="Safe pace" value={`${m(status.dailyAllowance)} → ${m(paceAfter)}/day`} strong />
          {!counts ? (
            <AppText variant="caption" tone="muted">
              This is before you started tracking, so it only appears in your history.
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Field label="Note (optional)">
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder={source ? incomeSource(source).label : 'Where it came from'}
        />
      </Field>

      <Field label="Date">
        <DateChoice
          value={date}
          onChange={setDate}
          maxDate={today}
          options={[
            { label: 'Today', date: today },
            { label: 'Yesterday', date: addDays(today, -1) },
          ]}
        />
      </Field>

      {existing ? (
        <Card>
          <Button label="Delete income" variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

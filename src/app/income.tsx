import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { incomeSources, incomeSource } from '@/domain/categories';
import { addDays, type LocalDate } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { t, type TranslationKey } from '@/i18n';
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

const SAVE_OPTIONS: { percent: number; label: TranslationKey }[] = [
  { percent: 0, label: 'incomeScreen.useIt' },
  { percent: 50, label: 'incomeScreen.saveHalf' },
  { percent: 100, label: 'incomeScreen.saveAll' },
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
  const incomeName = data.cycle.incomeLabel.toLowerCase();

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
      showToast(t('incomeScreen.updated'));
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
        ? t('incomeScreen.addedToast', {
            amount: m(amount),
            before: m(status.dailyAllowance),
            after: m(paceAfter),
          })
        : t('incomeScreen.addedHistory', { amount: m(amount) }),
      {
        label: t('common.undo'),
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
      title: t('incomeScreen.deleteTitle'),
      message: t('common.deleteTxMessage', {
        amount: formatMoney(existing.amount, currency, { signed: true }),
      }),
      onConfirm: () => {
        router.back();
        const removed = deleteTransaction(existing.id);
        if (removed) {
          showToast(t('incomeScreen.deleted'), {
            label: t('common.undo'),
            onPress: () => restoreTransaction(removed),
          });
        }
      },
    });
  };

  return (
    <SheetScreen
      confirmClose={hasChanges}
      title={
        existing
          ? t('incomeScreen.editTitle')
          : isCycleIncome
            ? t('incomeScreen.arrivedTitle', { income: incomeName })
            : t('incomeScreen.addTitle')
      }
      footer={
        <Button
          label={t(
            existing ? 'common.saveChanges' : startNewCycle ? 'incomeScreen.addAndReview' : 'incomeScreen.addTitle',
          )}
          onPress={save}
          disabled={!amount || !source}
        />
      }>
      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus={!existing} prefix="+" />

      <Field label={t('incomeScreen.source')}>
        <ChipGroup>
          {incomeSources().map((item) => (
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
        <Field label={t('incomeScreen.cycle')} hint={t('incomeScreen.cycleHint')}>
          <ChipGroup>
            <Chip
              emoji="🔁"
              label={t('incomeScreen.startNewCycle', { income: incomeName })}
              selected={startNewCycle}
              onPress={() => setStartNewCycle((value) => !value)}
            />
          </ChipGroup>
        </Field>
      ) : null}

      {offerSplit ? (
        <Field label={t('incomeScreen.whatToDo')}>
          <ChipGroup>
            {SAVE_OPTIONS.map((option) => (
              <Chip
                key={option.percent}
                label={t(option.label)}
                selected={savePercent === option.percent}
                onPress={() => setSavePercent(option.percent)}
              />
            ))}
          </ChipGroup>
        </Field>
      ) : null}

      {amount && !existing && !startNewCycle ? (
        <Card>
          {saved > 0 ? <MoneyLine label={t('incomeScreen.protectedAsSavings')} value={m(saved)} /> : null}
          <MoneyLine
            label={t('common.safePace')}
            value={t('common.paceShift', { before: m(status.dailyAllowance), after: m(paceAfter) })}
            strong
          />
          {!counts ? (
            <AppText variant="caption" tone="muted">
              {t('incomeScreen.beforeTracking')}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Field label={t('common.noteOptional')}>
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder={source ? incomeSource(source).label : t('incomeScreen.wherePlaceholder')}
        />
      </Field>

      <Field label={t('common.date')}>
        <DateChoice
          value={date}
          onChange={setDate}
          maxDate={today}
          options={[
            { label: t('common.todayLabel'), date: today },
            { label: t('common.yesterdayLabel'), date: addDays(today, -1) },
          ]}
        />
      </Field>

      {existing ? (
        <Card>
          <Button label={t('incomeScreen.delete')} variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}

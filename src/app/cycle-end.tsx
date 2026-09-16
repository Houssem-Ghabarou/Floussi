import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { billOccurrences } from '@/domain/bills';
import { cycleStart, suggestNextIncomeDate, type CycleBoundary } from '@/domain/cycle';
import { addDays, formatShortDate, type LocalDate } from '@/domain/dates';
import { summarizeCycle } from '@/domain/insights';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { t } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  AppText,
  Button,
  Card,
  Field,
  haptics,
  MoneyLine,
  SectionTitle,
  SheetScreen,
} from '@/ui/components';
import { CycleMoneyCard } from '@/ui/cycle-money-card';
import { DateChoice } from '@/ui/date-picker';
import { showToast } from '@/ui/toast';

export default function CycleEndScreen() {
  const { incomeId } = useLocalSearchParams<{ incomeId?: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const startNextCycle = useApp((state) => state.startNextCycle);

  const cycle = financial?.data.cycle;
  const today = financial?.today ?? '';
  const [nextIncomeDate, setNextIncomeDate] = useState<LocalDate>(() =>
    cycle ? suggestNextIncomeDate(cycle.nextIncomeDate, cycle.frequency, today) : today,
  );
  const [expectedText, setExpectedText] = useState(() =>
    cycle?.expectedIncome && financial ? amountToInput(cycle.expectedIncome, financial.currency) : '',
  );
  const [savingsText, setSavingsText] = useState(() =>
    cycle && financial ? amountToInput(cycle.savingsTarget, financial.currency) : '',
  );

  if (!financial || !cycle) return null;
  const { currency, data } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const incomeName = cycle.incomeLabel.toLowerCase();

  // The income that ends this cycle starts the next one; everything recorded before it stays here.
  const income = data.transactions.find((t) => t.id === incomeId && t.kind === 'income');
  const end: CycleBoundary = income
    ? { date: income.date, at: income.createdAt }
    : { date: addDays(today, 1), at: null };
  const lastDay = income ? income.date : today;

  const summary = summarizeCycle({
    settings: data.settings,
    transactions: data.transactions,
    routines: data.routines,
    start: cycleStart(cycle),
    end,
  });
  const unpaid = billOccurrences(data.bills, data.transactions, cycle.startDate, addDays(lastDay, -1)).filter(
    (occurrence) => !occurrence.paid && occurrence.bill.recurring,
  );

  const start = () => {
    startNextCycle(
      {
        nextIncomeDate,
        expectedIncome: parseAmount(expectedText, currency),
        incomeLabel: cycle.incomeLabel,
        frequency: cycle.frequency,
        savingsTarget: parseAmount(savingsText, currency) ?? 0,
      },
      income ? { date: income.date, at: income.createdAt } : { date: today, at: Date.now() },
    );
    haptics.success();
    if (router.canGoBack()) router.back();
    else router.replace('/');
    showToast(t('cycleEnd.started'));
  };

  return (
    <SheetScreen
      title={t('cycleEnd.title')}
      footer={<Button label={t('cycleEnd.start')} onPress={start} disabled={nextIncomeDate <= today} />}>
      <AppText variant="title">
        {lastDay > cycle.startDate
          ? t('cycleEnd.range', { from: formatShortDate(cycle.startDate), to: formatShortDate(lastDay) })
          : formatShortDate(cycle.startDate)}
      </AppText>

      <CycleMoneyCard summary={summary} currency={currency} endLabel={t('cycleEnd.finishedWith')} />
      <AppText variant="caption" tone="muted">
        {income
          ? t('cycleEnd.countedIncome', {
              income: incomeName,
              amount: formatMoney(income.amount, currency),
            })
          : t('cycleEnd.countedNow')}
      </AppText>

      {summary.expectedDailyAverage !== null ? (
        <>
          <SectionTitle title={t('cycleEnd.normalDay')} />
          <Card>
            <MoneyLine
              label={t('cycleEnd.expected')}
              value={t('common.perDay', { amount: m(summary.expectedDailyAverage) })}
            />
            <MoneyLine
              label={t('cycleEnd.actual')}
              value={t('common.perDay', { amount: m(summary.dailyAverage) })}
              strong
            />
          </Card>
        </>
      ) : null}

      {summary.biggest ? (
        <>
          <SectionTitle title={t('cycleEnd.biggest')} />
          <Card>
            <MoneyLine
              label={`${summary.biggest.category.emoji} ${summary.biggest.category.label}`}
              value={m(summary.biggest.actual)}
              strong
            />
            {summary.mostOverRoutine ? (
              <AppText tone="secondary">
                {t('cycleEnd.overRoutine', {
                  amount: m(summary.mostOverRoutine.trackedActual - summary.mostOverRoutine.expected),
                  category: summary.mostOverRoutine.category.label.toLowerCase(),
                })}
              </AppText>
            ) : null}
          </Card>
        </>
      ) : null}

      {unpaid.length > 0 ? (
        <Card>
          <AppText variant="bodyStrong">{t('cycleEnd.stillUnpaid')}</AppText>
          <AppText tone="secondary">
            {t('cycleEnd.unpaidNote', {
              bills: unpaid
                .map((occurrence) =>
                  t('cycleEnd.unpaidItem', {
                    name: occurrence.bill.name,
                    date: formatShortDate(occurrence.dueDate),
                  }),
                )
                .join(', '),
            })}
          </AppText>
        </Card>
      ) : null}

      <SectionTitle title={t('cycleEnd.nextCycle')} />
      <Field label={t('cycleEnd.nextExpectedOn', { income: incomeName })}>
        <DateChoice
          value={nextIncomeDate}
          onChange={setNextIncomeDate}
          minDate={addDays(today, 1)}
          options={[
            {
              label: t('cycleEnd.suggested'),
              date: suggestNextIncomeDate(cycle.nextIncomeDate, cycle.frequency, today),
            },
          ]}
        />
      </Field>
      <Field label={t('cycleEnd.expectedAmount')}>
        <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
      </Field>
      <Field label={t('cycleEnd.savingsNext')}>
        <AmountField value={savingsText} onChangeText={setSavingsText} currency={currency} size="medium" />
      </Field>
    </SheetScreen>
  );
}

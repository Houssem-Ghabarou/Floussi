import { useRouter } from 'expo-router';
import { useState } from 'react';

import { suggestNextIncomeDate } from '@/domain/cycle';
import { addDays, formatShortDate, type LocalDate } from '@/domain/dates';
import { billOccurrences } from '@/domain/bills';
import { summarizeCycle } from '@/domain/insights';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  AppText,
  Button,
  Card,
  Divider,
  Field,
  haptics,
  MoneyLine,
  SectionTitle,
  SheetScreen,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { showToast } from '@/ui/toast';

export default function CycleEndScreen() {
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

  const summary = summarizeCycle({
    settings: data.settings,
    transactions: data.transactions,
    routines: data.routines,
    startDate: cycle.startDate,
    endDateExclusive: today,
  });
  const unpaid = billOccurrences(data.bills, data.transactions, cycle.startDate, addDays(today, -1)).filter(
    (occurrence) => !occurrence.paid && occurrence.bill.recurring,
  );

  const start = () => {
    startNextCycle({
      nextIncomeDate,
      expectedIncome: parseAmount(expectedText, currency),
      incomeLabel: cycle.incomeLabel,
      frequency: cycle.frequency,
      savingsTarget: parseAmount(savingsText, currency) ?? 0,
    });
    haptics.success();
    if (router.canGoBack()) router.back();
    else router.replace('/');
    showToast('New cycle started. Your routines and rules came with you.');
  };

  return (
    <SheetScreen
      title="Your cycle"
      footer={<Button label="Start next cycle" onPress={start} disabled={nextIncomeDate <= today} />}>
      <AppText variant="title">
        {formatShortDate(cycle.startDate)} – {formatShortDate(addDays(today, -1))}
      </AppText>

      <Card>
        <MoneyLine label="Started with" value={m(summary.startingBalance)} />
        <MoneyLine label="Income" value={m(summary.income)} />
        <MoneyLine label="Spent" value={m(summary.spending + summary.billsPaid)} />
        <MoneyLine label="Moved to savings" value={m(summary.savedMoved)} />
        <Divider />
        <MoneyLine label="Finished with" value={m(summary.endingBalance)} strong />
      </Card>

      {summary.expectedDailyAverage !== null ? (
        <>
          <SectionTitle title="Your normal day" />
          <Card>
            <MoneyLine label="Expected" value={`${m(summary.expectedDailyAverage)}/day`} />
            <MoneyLine label="Actual" value={`${m(summary.dailyAverage)}/day`} strong />
          </Card>
        </>
      ) : null}

      {summary.biggest ? (
        <>
          <SectionTitle title="Biggest category" />
          <Card>
            <MoneyLine
              label={`${summary.biggest.category.emoji} ${summary.biggest.category.label}`}
              value={m(summary.biggest.actual)}
              strong
            />
            {summary.mostOverRoutine ? (
              <AppText tone="secondary">
                You spent {m(summary.mostOverRoutine.trackedActual - summary.mostOverRoutine.expected)} more on{' '}
                {summary.mostOverRoutine.category.label.toLowerCase()} than your routine predicted.
              </AppText>
            ) : null}
          </Card>
        </>
      ) : null}

      {unpaid.length > 0 ? (
        <Card>
          <AppText variant="bodyStrong">Still unpaid from this cycle</AppText>
          <AppText tone="secondary">
            {unpaid.map((occurrence) => `${occurrence.bill.name} (${formatShortDate(occurrence.dueDate)})`).join(', ')}.
            They stay protected as overdue in your next cycle until you mark them paid in Plan.
          </AppText>
        </Card>
      ) : null}

      <SectionTitle title="Next cycle" />
      <Field label={`Next ${cycle.incomeLabel.toLowerCase()} expected on`}>
        <DateChoice
          value={nextIncomeDate}
          onChange={setNextIncomeDate}
          minDate={addDays(today, 1)}
          options={[{ label: 'Suggested', date: suggestNextIncomeDate(cycle.nextIncomeDate, cycle.frequency, today) }]}
        />
      </Field>
      <Field label="Expected amount (optional)">
        <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
      </Field>
      <Field label="🐷 Savings for next cycle">
        <AmountField value={savingsText} onChangeText={setSavingsText} currency={currency} size="medium" />
      </Field>
    </SheetScreen>
  );
}

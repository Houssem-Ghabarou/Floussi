import { useRouter } from 'expo-router';
import { useState } from 'react';

import { INCOME_SOURCES } from '@/domain/categories';
import { FREQUENCY_LABELS } from '@/domain/cycle';
import { addDays, dateInMonth, splitDate, type LocalDate } from '@/domain/dates';
import { calculateFinancialStatus } from '@/domain/engine';
import { amountToInput, formatMoney, parseAmount } from '@/domain/money';
import type { IncomeFrequency } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  haptics,
  MoneyLine,
  SheetScreen,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { showToast } from '@/ui/toast';

export default function PaydayScreen() {
  const router = useRouter();
  const financial = useFinancial();
  const updateCycle = useApp((state) => state.updateCycle);

  const cycle = financial?.data.cycle;
  const [date, setDate] = useState<LocalDate>(cycle?.nextIncomeDate ?? '');
  const [frequency, setFrequency] = useState<IncomeFrequency>(cycle?.frequency ?? 'monthly');
  const [label, setLabel] = useState(cycle?.incomeLabel ?? 'Salary');
  const [expectedText, setExpectedText] = useState(() =>
    cycle?.expectedIncome && financial ? amountToInput(cycle.expectedIncome, financial.currency) : '',
  );

  if (!financial) return null;
  const { currency, input, status, today } = financial;
  const [year, month] = splitDate(today);
  const preview = calculateFinancialStatus({ ...input, nextIncomeDate: date });

  const save = () => {
    updateCycle({
      nextIncomeDate: date,
      frequency,
      incomeLabel: frequency === 'irregular' ? 'Next money' : label,
      expectedIncome: parseAmount(expectedText, currency),
    });
    haptics.success();
    router.back();
    showToast('Next income updated');
  };

  return (
    <SheetScreen title="Next income" footer={<Button label="Save" onPress={save} disabled={date < today} />}>
      <Field label="Frequency">
        <ChipGroup>
          {(Object.keys(FREQUENCY_LABELS) as IncomeFrequency[]).map((value) => (
            <Chip key={value} label={FREQUENCY_LABELS[value]} selected={frequency === value} onPress={() => setFrequency(value)} />
          ))}
        </ChipGroup>
      </Field>

      {frequency !== 'irregular' ? (
        <Field label="Income">
          <ChipGroup>
            {INCOME_SOURCES.slice(0, 3).map((source) => (
              <Chip
                key={source.id}
                emoji={source.emoji}
                label={source.label}
                selected={label === source.label}
                onPress={() => setLabel(source.label)}
              />
            ))}
          </ChipGroup>
        </Field>
      ) : null}

      <Field label={frequency === 'irregular' ? 'Make my money last until' : 'Expected on'}>
        <DateChoice
          value={date}
          onChange={setDate}
          minDate={today}
          options={[
            { label: 'Tomorrow', date: addDays(today, 1) },
            { label: 'In 1 week', date: addDays(today, 7) },
            { label: 'End of month', date: dateInMonth(year, month, 31) },
          ]}
        />
      </Field>

      {frequency !== 'irregular' ? (
        <Field label="About how much? (optional)">
          <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
        </Field>
      ) : null}

      <Card>
        <MoneyLine
          label="Safe pace"
          value={`${formatMoney(status.dailyAllowance, currency, { whole: true })} → ${formatMoney(preview.dailyAllowance, currency, { whole: true })}/day`}
          strong
        />
      </Card>

      <Button
        label="My income already arrived"
        variant="ghost"
        onPress={() => router.replace({ pathname: '/income', params: { cycleIncome: '1' } })}
      />
    </SheetScreen>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { incomeSources } from '@/domain/categories';
import { FREQUENCIES, frequencyLabel } from '@/domain/cycle';
import { addDays, dateInMonth, splitDate, type LocalDate } from '@/domain/dates';
import { calculateFinancialStatus } from '@/domain/engine';
import { amountToInput, formatMoney, parseAmount } from '@/domain/money';
import type { IncomeFrequency } from '@/domain/types';
import { t } from '@/i18n';
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
  const [label, setLabel] = useState(cycle?.incomeLabel ?? t('income.salary'));
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
      incomeLabel: frequency === 'irregular' ? t('income.nextMoney') : label,
      expectedIncome: parseAmount(expectedText, currency),
    });
    haptics.success();
    router.back();
    showToast(t('payday.updated'));
  };

  return (
    <SheetScreen
      title={t('payday.title')}
      footer={<Button label={t('common.save')} onPress={save} disabled={date < today} />}>
      <Field label={t('payday.frequency')}>
        <ChipGroup>
          {FREQUENCIES.map((value) => (
            <Chip key={value} label={frequencyLabel(value)} selected={frequency === value} onPress={() => setFrequency(value)} />
          ))}
        </ChipGroup>
      </Field>

      {frequency !== 'irregular' ? (
        <Field label={t('payday.income')}>
          <ChipGroup>
            {incomeSources().slice(0, 3).map((source) => (
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

      <Field label={t(frequency === 'irregular' ? 'payday.lastUntil' : 'payday.expectedOn')}>
        <DateChoice
          value={date}
          onChange={setDate}
          minDate={today}
          options={[
            { label: t('common.tomorrow'), date: addDays(today, 1) },
            { label: t('common.inOneWeek'), date: addDays(today, 7) },
            { label: t('common.endOfMonth'), date: dateInMonth(year, month, 31) },
          ]}
        />
      </Field>

      {frequency !== 'irregular' ? (
        <Field label={t('payday.expectedAmount')}>
          <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
        </Field>
      ) : null}

      <Card>
        <MoneyLine
          label={t('common.safePace')}
          value={t('common.paceShift', {
            before: formatMoney(status.dailyAllowance, currency, { whole: true }),
            after: formatMoney(preview.dailyAllowance, currency, { whole: true }),
          })}
          strong
        />
      </Card>

      <Button
        label={t('payday.alreadyArrived')}
        variant="ghost"
        onPress={() => router.replace({ pathname: '/income', params: { cycleIncome: '1' } })}
      />
    </SheetScreen>
  );
}

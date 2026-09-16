import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { addDays, formatShortDate, type LocalDate } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount } from '@/domain/money';
import { t } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { AmountField, AppText, Button, Card, Field, haptics, SheetScreen } from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { showToast } from '@/ui/toast';

export default function PayBillScreen() {
  const { billId, dueDate } = useLocalSearchParams<{ billId: string; dueDate: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const payBill = useApp((state) => state.payBill);
  const deleteTransaction = useApp((state) => state.deleteTransaction);

  const bill = financial?.data.bills.find((candidate) => candidate.id === billId);
  const [amountText, setAmountText] = useState(() =>
    bill && financial ? amountToInput(bill.amount, financial.currency) : '',
  );
  const [date, setDate] = useState<LocalDate>(financial?.today ?? '');

  if (!financial || !bill) return null;
  const { currency, today, data } = financial;
  const amount = parseAmount(amountText, currency);
  const difference = amount === null ? 0 : amount - bill.amount;
  const overdue = dueDate < today;
  const countsToBalance = date >= data.settings.openingDate;

  let explanation: string;
  if (!countsToBalance) {
    explanation = t('payBill.beforeTracking', { amount: formatMoney(bill.amount, currency) });
  } else if (difference === 0) {
    explanation = t('payBill.same');
  } else if (difference > 0) {
    explanation = t('payBill.more', { amount: formatMoney(difference, currency) });
  } else {
    explanation = t('payBill.less', { amount: formatMoney(-difference, currency) });
  }

  const dateOptions = [
    { label: t('common.todayLabel'), date: today },
    { label: t('common.yesterdayLabel'), date: addDays(today, -1) },
  ];
  if (overdue && dueDate < addDays(today, -1)) {
    dateOptions.push({ label: t('payBill.onDate', { date: formatShortDate(dueDate) }), date: dueDate });
  }

  const save = () => {
    if (!amount) return;
    const payment = payBill({ billId: bill.id, dueDate, amount, date });
    haptics.success();
    router.back();
    showToast(t('payBill.paid', { emoji: bill.emoji, name: bill.name }), {
      label: t('common.undo'),
      onPress: () => deleteTransaction(payment.id),
    });
  };

  return (
    <SheetScreen
      title={t('payBill.title', { name: bill.name })}
      footer={<Button label={t('payBill.markPaid')} onPress={save} disabled={!amount} />}>
      <AppText variant="title">
        {bill.emoji} {bill.name}
      </AppText>
      <AppText tone="secondary">
        {bill.recurring || bill.dueDate
          ? t(overdue ? 'payBill.wasDue' : 'payBill.due', { date: formatShortDate(dueDate) })
          : ''}
        {t('payBill.adjust')}
      </AppText>

      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} />

      <Card>
        <AppText tone="secondary">{explanation}</AppText>
      </Card>

      <Field label={t('payBill.paidOn')}>
        <DateChoice value={date} onChange={setDate} maxDate={today} options={dateOptions} />
      </Field>
    </SheetScreen>
  );
}

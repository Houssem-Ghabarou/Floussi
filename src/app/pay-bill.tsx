import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { addDays, formatShortDate, type LocalDate } from '@/domain/dates';
import { amountToInput, formatMoney, parseAmount } from '@/domain/money';
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
    explanation = `Paid before you started tracking: your balance already includes it, so the ${formatMoney(bill.amount, currency)} set aside goes back to your flexible money.`;
  } else if (difference === 0) {
    explanation = "This money was already protected, so your safe pace won't change.";
  } else if (difference > 0) {
    explanation = `That's ${formatMoney(difference, currency)} more than planned. Your pace will adjust a little.`;
  } else {
    explanation = `That's ${formatMoney(-difference, currency)} less than planned. The difference goes back to your flexible money.`;
  }

  const dateOptions = [
    { label: 'Today', date: today },
    { label: 'Yesterday', date: addDays(today, -1) },
  ];
  if (overdue && dueDate < addDays(today, -1)) {
    dateOptions.push({ label: `On ${formatShortDate(dueDate)}`, date: dueDate });
  }

  const save = () => {
    if (!amount) return;
    const payment = payBill({ billId: bill.id, dueDate, amount, date });
    haptics.success();
    router.back();
    showToast(`${bill.emoji} ${bill.name} paid`, { label: 'Undo', onPress: () => deleteTransaction(payment.id) });
  };

  return (
    <SheetScreen title={`Pay ${bill.name}`} footer={<Button label="Mark as paid" onPress={save} disabled={!amount} />}>
      <AppText variant="title">
        {bill.emoji} {bill.name}
      </AppText>
      <AppText tone="secondary">
        {bill.recurring || bill.dueDate
          ? `${overdue ? 'Was due' : 'Due'} ${formatShortDate(dueDate)}. `
          : ''}
        Adjust the amount if the real bill was different.
      </AppText>

      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} />

      <Card>
        <AppText tone="secondary">{explanation}</AppText>
      </Card>

      <Field label="Paid on">
        <DateChoice value={date} onChange={setDate} maxDate={today} options={dateOptions} />
      </Field>
    </SheetScreen>
  );
}

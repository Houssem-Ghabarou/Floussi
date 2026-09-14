import { useRouter } from 'expo-router';
import { useState } from 'react';

import { amountToInput, formatMoney, parseAmount } from '@/domain/money';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { AmountField, AppText, Button, Card, haptics, MoneyLine, SheetScreen } from '@/ui/components';
import { showToast } from '@/ui/toast';

export default function BalanceScreen() {
  const router = useRouter();
  const financial = useFinancial();
  const reconcileBalance = useApp((state) => state.reconcileBalance);
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const [amountText, setAmountText] = useState(() =>
    financial ? amountToInput(financial.status.balance, financial.currency) : '',
  );

  if (!financial) return null;
  const { currency, status } = financial;
  const actual = parseAmount(amountText, currency);
  const difference = actual === null ? 0 : actual - status.balance;

  const save = () => {
    if (actual === null) return;
    const adjustment = reconcileBalance(actual);
    haptics.success();
    router.back();
    if (adjustment) {
      showToast('Balance updated', { label: 'Undo', onPress: () => deleteTransaction(adjustment.id) });
    }
  };

  return (
    <SheetScreen
      title="Update balance"
      footer={<Button label={difference === 0 ? 'Done' : 'Update balance'} onPress={save} disabled={actual === null} />}>
      <AppText variant="title">What does your account show?</AppText>
      <AppText tone="secondary">
        Manual tracking drifts: a forgotten taxi, cash given to family. Enter what you really have and we'll record the
        difference so your plan matches reality.
      </AppText>

      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus />

      <Card>
        <MoneyLine label="Floussi thought you had" value={formatMoney(status.balance, currency)} />
        {difference < 0 ? (
          <AppText tone="secondary">
            {formatMoney(-difference, currency)} will be recorded as untracked spending. It won't count against your
            daily pace.
          </AppText>
        ) : difference > 0 ? (
          <AppText tone="secondary">
            {formatMoney(difference, currency)} more than expected. It will be recorded as a balance correction.
          </AppText>
        ) : (
          <AppText tone="secondary">That matches. Nothing to change.</AppText>
        )}
      </Card>
    </SheetScreen>
  );
}

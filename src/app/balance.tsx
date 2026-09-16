import { useRouter } from 'expo-router';
import { useState } from 'react';

import { statusLabel } from '@/domain/advice';
import { calculateFinancialStatus } from '@/domain/engine';
import { amountToInput, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { t } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { AmountField, AppText, Button, Card, haptics, MoneyLine, SheetScreen, StatusPill } from '@/ui/components';
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
  const { currency, status, input } = financial;
  const actual = parseAmount(amountText, currency);
  const difference = actual === null ? 0 : actual - status.balance;
  const pace = (value: Minor) => t('common.perDay', { amount: formatMoney(value, currency, { whole: true }) });

  // The same calculation the plan will run once the correction is recorded.
  const preview =
    actual === null || difference === 0
      ? null
      : calculateFinancialStatus({
          ...input,
          balance: actual,
          recentBalanceCorrections: input.recentBalanceCorrections + difference,
        });

  const save = () => {
    if (actual === null) return;
    const adjustment = reconcileBalance(actual);
    haptics.success();
    router.back();
    if (adjustment && preview) {
      showToast(t('balance.updated', { pace: pace(preview.dailyAllowance) }), {
        label: t('common.undo'),
        onPress: () => deleteTransaction(adjustment.id),
      });
    }
  };

  return (
    <SheetScreen
      title={t('balance.title')}
      footer={
        <Button
          label={t(difference === 0 ? 'common.done' : 'balance.update')}
          onPress={save}
          disabled={actual === null}
        />
      }>
      <AppText variant="title">{t('balance.question')}</AppText>
      <AppText tone="secondary">{t('balance.intro')}</AppText>

      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus />

      <Card>
        <MoneyLine label={t('balance.thought')} value={formatMoney(status.balance, currency)} />
        {difference < 0 ? (
          <AppText tone="secondary">{t('balance.less', { amount: formatMoney(-difference, currency) })}</AppText>
        ) : difference > 0 ? (
          <AppText tone="secondary">{t('balance.more', { amount: formatMoney(difference, currency) })}</AppText>
        ) : (
          <AppText tone="secondary">{t('balance.match')}</AppText>
        )}
        {preview ? (
          <>
            <MoneyLine
              label={t('common.safePace')}
              value={`${pace(status.dailyAllowance)} → ${pace(preview.dailyAllowance)}`}
              strong
            />
            <StatusPill level={preview.riskLevel} label={statusLabel(preview.reason)} />
          </>
        ) : null}
      </Card>
    </SheetScreen>
  );
}

import type { CycleSummary } from '@/domain/insights';
import { formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';
import { t } from '@/i18n';

import { AppText, Card, Divider, MoneyLine } from './components';
import { usePalette } from './theme';

/** Started with → money in and out → end balance. Exact amounts, so the lines always add up. */
export function CycleMoneyCard({
  summary,
  currency,
  endLabel,
}: {
  summary: CycleSummary;
  currency: CurrencyInfo;
  endLabel: string;
}) {
  const palette = usePalette();
  const m = (value: Minor) => formatMoney(value, currency);
  const signed = (value: Minor) => formatMoney(value, currency, { signed: true });

  return (
    <Card>
      <MoneyLine label={t('cycleCard.startedWith')} value={m(summary.startingBalance)} />
      {summary.income !== 0 ? (
        <MoneyLine label={t('cycleCard.income')} value={signed(summary.income)} color={palette.income} />
      ) : null}
      <MoneyLine label={t('cycleCard.spending')} value={signed(-summary.spending)} />
      {summary.billsPaid !== 0 ? (
        <MoneyLine label={t('cycleCard.billsPaid')} value={signed(-summary.billsPaid)} />
      ) : null}
      {summary.savedMoved !== 0 ? (
        <MoneyLine label={t('cycleCard.movedToSavings')} value={signed(-summary.savedMoved)} />
      ) : null}
      {summary.adjustments !== 0 ? (
        <MoneyLine label={t('cycleCard.corrections')} value={signed(summary.adjustments)} />
      ) : null}
      <Divider />
      <MoneyLine label={endLabel} value={m(summary.endingBalance)} strong />
      {summary.historicalSpending > 0 ? (
        <AppText variant="caption" tone="muted">
          {t('cycleCard.historical', { amount: m(summary.historicalSpending) })}
        </AppText>
      ) : null}
    </Card>
  );
}

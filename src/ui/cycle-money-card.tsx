import type { CycleSummary } from '@/domain/insights';
import { formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';

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
      <MoneyLine label="Started with" value={m(summary.startingBalance)} />
      {summary.income !== 0 ? <MoneyLine label="Income" value={signed(summary.income)} color={palette.income} /> : null}
      <MoneyLine label="Spending" value={signed(-summary.spending)} />
      {summary.billsPaid !== 0 ? <MoneyLine label="Bills paid" value={signed(-summary.billsPaid)} /> : null}
      {summary.savedMoved !== 0 ? <MoneyLine label="Moved to savings" value={signed(-summary.savedMoved)} /> : null}
      {summary.adjustments !== 0 ? (
        <MoneyLine label="Balance corrections" value={signed(summary.adjustments)} />
      ) : null}
      <Divider />
      <MoneyLine label={endLabel} value={m(summary.endingBalance)} strong />
      {summary.historicalSpending > 0 ? (
        <AppText variant="caption" tone="muted">
          Not included above: {m(summary.historicalSpending)} spent before you started tracking. Your starting balance
          already reflects it.
        </AppText>
      ) : null}
    </Card>
  );
}

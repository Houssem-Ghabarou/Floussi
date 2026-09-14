import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { addDays, daysBetween, formatShortDate } from '@/domain/dates';
import { summarizeCycle } from '@/domain/insights';
import { formatMoney, type Minor } from '@/domain/money';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { AppText, Card, Divider, ListRow, MoneyLine, ProgressBar, Screen, SectionTitle } from '@/ui/components';
import { Space, usePalette } from '@/ui/theme';

export default function InsightsScreen() {
  const financial = useFinancial();
  const cycles = useApp((state) => state.cycles);
  const router = useRouter();
  const palette = usePalette();

  if (!financial) return null;
  const { data, today, status, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const mSigned = (value: Minor) => formatMoney(value, currency, { whole: true, signed: true });

  const { cycle, settings, transactions, routines } = data;
  const summary = summarizeCycle({
    settings,
    transactions,
    routines,
    startDate: cycle.startDate,
    endDateExclusive: addDays(today, 1),
  });
  const totalOut = summary.spending + summary.historicalSpending + summary.billsPaid;
  const cycleLength = Math.max(1, daysBetween(cycle.startDate, cycle.nextIncomeDate));
  const dayOfCycle = Math.min(cycleLength, daysBetween(cycle.startDate, today) + 1);

  let outlook: string;
  if (status.projectedEndFlexible === null) {
    outlook = `${status.riskLevel === 'watch' || status.riskLevel === 'at_risk' ? 'Keep an eye on your pace.' : "So far, you're within your plan."} After a few more days of logging, we'll forecast where you'll land.`;
  } else if (status.projectedEndFlexible >= 0) {
    outlook = `At your current pace, you'll reach your next income with about ${m(status.projectedEndFlexible)} of flexible money to spare.`;
  } else {
    outlook = `At your current pace, you may use about ${m(-status.projectedEndFlexible)} more than your flexible money before your next income. Keeping days around ${m(status.upcomingDailyPace)} closes the gap.`;
  }

  const comparisons = summary.categories.filter((insight) => insight.expected > 0);
  const closedCycles = [...cycles]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((item, index, sorted) => ({ cycle: item, end: sorted[index + 1]?.startDate ?? addDays(today, 1) }))
    .filter(({ cycle: item }) => item.closedAt !== null)
    .reverse();

  return (
    <Screen>
      <View>
        <AppText variant="title">Insights</AppText>
        <AppText tone="secondary">
          This cycle · {formatShortDate(cycle.startDate)} – {formatShortDate(cycle.nextIncomeDate)} · day {dayOfCycle} of{' '}
          {cycleLength}
        </AppText>
      </View>

      <Card>
        <AppText variant="heading">You've spent {m(summary.spending)} so far</AppText>
        <AppText tone="secondary">{outlook}</AppText>
      </Card>

      <SectionTitle title="Your money this cycle" />
      <Card>
        <MoneyLine label="Started with" value={m(summary.startingBalance)} />
        {summary.income > 0 ? <MoneyLine label="Income" value={mSigned(summary.income)} color={palette.income} /> : null}
        <MoneyLine label="Spending" value={m(-summary.spending)} />
        {summary.billsPaid > 0 ? <MoneyLine label="Bills paid" value={m(-summary.billsPaid)} /> : null}
        {summary.savedMoved > 0 ? <MoneyLine label="Moved to savings" value={m(-summary.savedMoved)} /> : null}
        {summary.adjustments !== 0 ? (
          <MoneyLine label="Balance corrections" value={mSigned(summary.adjustments)} />
        ) : null}
        <Divider />
        <MoneyLine label="Now" value={m(summary.endingBalance)} strong />
        {summary.historicalSpending > 0 ? (
          <AppText variant="caption" tone="muted">
            Plus {m(summary.historicalSpending)} spent before you started tracking (already reflected in your starting
            balance).
          </AppText>
        ) : null}
      </Card>

      <SectionTitle title="Where your money went" />
      <Card>
        {summary.categories.length === 0 ? (
          <AppText tone="secondary">Log a few expenses and you'll see where your money goes.</AppText>
        ) : (
          summary.categories
            .filter((insight) => insight.actual > 0)
            .map((insight) => (
              <View key={insight.category.id} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <AppText variant="bodyStrong">
                    {insight.category.emoji} {insight.category.label}
                  </AppText>
                  <AppText variant="bodyStrong">{m(insight.actual)}</AppText>
                </View>
                <ProgressBar progress={totalOut > 0 ? insight.actual / totalOut : 0} color={palette.brand} />
              </View>
            ))
        )}
      </Card>

      <SectionTitle title="Actual vs. your routine" />
      {comparisons.length === 0 ? (
        <Card onPress={() => router.push('/routine')}>
          <AppText tone="secondary">
            Add a routine to see how real life compares with your normal day.
          </AppText>
        </Card>
      ) : (
        <Card>
          {summary.expectedDailyAverage !== null ? (
            <>
              <MoneyLine label="Normal day (routine)" value={`${m(summary.expectedDailyAverage)}/day`} />
              <MoneyLine label="Your actual average" value={`${m(summary.dailyAverage)}/day`} strong />
              <Divider />
            </>
          ) : null}
          {comparisons.map((insight) => {
            const difference = insight.trackedActual - insight.expected;
            return (
              <View key={insight.category.id} style={styles.comparison}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {insight.category.emoji} {insight.category.label}
                </AppText>
                <AppText variant="small" tone="secondary">
                  {m(insight.trackedActual)} of {m(insight.expected)}
                </AppText>
                <AppText
                  variant="small"
                  color={difference > 0 ? palette.watch : palette.income}
                  style={styles.difference}>
                  {mSigned(difference)}
                </AppText>
              </View>
            );
          })}
          {summary.mostOverRoutine ? (
            <AppText tone="secondary">
              You spent {m(summary.mostOverRoutine.trackedActual - summary.mostOverRoutine.expected)} more on{' '}
              {summary.mostOverRoutine.category.label.toLowerCase()} than your routine predicted.
            </AppText>
          ) : null}
        </Card>
      )}

      {closedCycles.length > 0 ? (
        <>
          <SectionTitle title="Past cycles" />
          <Card>
            {closedCycles.map(({ cycle: item, end }) => {
              const past = summarizeCycle({
                settings,
                transactions,
                routines,
                startDate: item.startDate,
                endDateExclusive: end,
              });
              return (
                <ListRow
                  key={item.id}
                  emoji="📅"
                  title={`${formatShortDate(item.startDate)} – ${formatShortDate(addDays(end, -1))}`}
                  subtitle={`Spent ${m(past.spending + past.billsPaid)} · income ${m(past.income)}`}
                  value={m(past.endingBalance)}
                />
              );
            })}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  categoryRow: { gap: Space.xs },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  difference: { minWidth: 64, textAlign: 'right', fontWeight: '700' },
});

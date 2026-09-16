import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { statusLabel } from '@/domain/advice';
import { billsCategory, expenseCategory } from '@/domain/categories';
import { cycleStart, isBeforeBoundary, type CycleBoundary } from '@/domain/cycle';
import { addDays, daysBetween, formatMonthYear, formatShortDate } from '@/domain/dates';
import { summarizeCycle, type CategoryInsight } from '@/domain/insights';
import { formatAmount, formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';
import { t, tn } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { TabScreen } from '@/ui/app-header';
import {
  AppText,
  Badge,
  Button,
  Callout,
  Card,
  Divider,
  IconCircle,
  LegendDot,
  ListRow,
  SectionTitle,
  SegmentBar,
  StatusPill,
} from '@/ui/components';
import { CycleMoneyCard } from '@/ui/cycle-money-card';
import { Icon, type IconName } from '@/ui/icon';
import { Radius, Space, usePalette } from '@/ui/theme';

export default function MonthScreen() {
  const financial = useFinancial();
  const cycles = useApp((state) => state.cycles);
  const router = useRouter();
  const palette = usePalette();
  /** 0 = the current cycle, 1 = the one before… */
  const [offset, setOffset] = useState(0);

  if (!financial) return null;
  const { data, today, status, currency } = financial;
  const { settings, transactions, routines } = data;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const signed = (value: Minor) => formatMoney(value, currency, { whole: true, signed: true });

  const sorted = [...cycles].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || (a.startedAt ?? 0) - (b.startedAt ?? 0),
  );
  const periods = sorted.map((item, index) => ({
    cycle: item,
    end: (sorted[index + 1] ? cycleStart(sorted[index + 1]) : { date: addDays(today, 1), at: null }) as CycleBoundary,
  }));
  const index = Math.max(0, periods.length - 1 - offset);
  const period = periods[index];
  if (!period) return null;

  const { cycle, end } = period;
  const isCurrent = cycle.id === data.cycle.id;
  const start = cycleStart(cycle);
  const summary = summarizeCycle({ settings, transactions, routines, start, end });
  const lastDay = end.at === null ? addDays(end.date, -1) : end.date;
  const finalDay = isCurrent ? cycle.nextIncomeDate : lastDay;
  const cycleLength = Math.max(1, daysBetween(cycle.startDate, isCurrent ? cycle.nextIncomeDate : addDays(lastDay, 1)));
  const dayOfCycle = Math.min(cycleLength, daysBetween(cycle.startDate, today) + 1);
  const spent = summary.spending + summary.billsPaid;
  const totalOut = summary.spending + summary.historicalSpending + summary.billsPaid;

  const segments = isCurrent
    ? [
        { label: t('month.segment.protected'), value: status.protectedTotal, color: palette.inverse },
        { label: t('month.segment.spent'), value: spent, color: palette.brand },
        { label: t('month.segment.flexible'), value: Math.max(0, status.flexibleNow), color: palette.accent },
      ]
    : [
        { label: t('month.segment.spent'), value: spent, color: palette.brand },
        { label: t('month.segment.saved'), value: summary.savedMoved, color: palette.inverse },
        { label: t('month.segment.left'), value: Math.max(0, summary.endingBalance), color: palette.accent },
      ];
  const segmentTotal = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const share = (value: Minor) => (segmentTotal > 0 ? Math.round((Math.max(0, value) / segmentTotal) * 100) : 0);

  const entryCounts = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== 'expense' && t.kind !== 'bill_payment') continue;
    if (!isBeforeBoundary(t, end) || (t.countsToBalance && isBeforeBoundary(t, start))) continue;
    const id = t.kind === 'expense' ? expenseCategory(t.category).id : billsCategory().id;
    entryCounts.set(id, (entryCounts.get(id) ?? 0) + 1);
  }

  let outlook: string;
  if (!isCurrent) {
    outlook = t('month.recap', {
      spent: m(spent),
      days: tn('count.days', summary.trackedDays),
      average: m(summary.dailyAverage),
      ending: m(summary.endingBalance),
    });
  } else if (status.projectedEndFlexible === null) {
    outlook = t('month.outlookSoon', {
      lead: t(
        status.riskLevel === 'watch' || status.riskLevel === 'at_risk'
          ? 'month.outlookSoonWatch'
          : 'month.outlookSoonFine',
      ),
    });
  } else if (status.projectedEndFlexible >= 0) {
    outlook = t('month.outlookSpare', { amount: m(status.projectedEndFlexible) });
  } else {
    outlook = t('month.outlookShort', {
      amount: m(-status.projectedEndFlexible),
      pace: m(status.upcomingDailyPace),
    });
  }

  const comparisons = summary.categories.filter((insight) => insight.expected > 0);
  const active = summary.categories.filter((insight) => insight.actual > 0);

  return (
    <TabScreen section={t('nav.month')}>
      <View style={styles.selector}>
        <RoundButton
          icon="chevronLeft"
          label={t('month.previousCycle')}
          disabled={index === 0}
          onPress={() => setOffset(offset + 1)}
        />
        <View style={styles.flex}>
          <AppText variant="title" style={styles.center}>
            {formatMonthYear(cycle.startDate)}
          </AppText>
          <AppText variant="caption" tone="secondary" style={styles.center}>
            {t('month.cycleRange', { from: formatShortDate(cycle.startDate), to: formatShortDate(finalDay) })}
          </AppText>
        </View>
        <RoundButton
          icon="chevronRight"
          label={t('month.nextCycle')}
          disabled={offset === 0}
          onPress={() => setOffset(offset - 1)}
        />
      </View>

      <View style={[styles.pace, { backgroundColor: palette.surfaceLow }]}>
        <View style={styles.inline}>
          <View style={[styles.dot, { backgroundColor: isCurrent ? palette.brand : palette.textMuted }]} />
          <AppText variant="caption" style={styles.strong}>
            {isCurrent
              ? t('month.dayOf', { day: dayOfCycle, length: cycleLength })
              : t('month.closedCycle', { days: tn('count.days', cycleLength) })}
          </AppText>
        </View>
        {isCurrent ? (
          <AppText variant="caption" tone="secondary">
            {status.incomeDue ? t('today.incomeDue') : tn('month.daysLeft', status.daysUntilIncome)}
          </AppText>
        ) : null}
      </View>

      <Card>
        <View style={styles.spaceBetween}>
          <AppText variant="label" tone="secondary">
            {t('month.cashFlow')}
          </AppText>
          {isCurrent ? (
            <StatusPill level={status.riskLevel} label={statusLabel(status.reason)} />
          ) : (
            <Badge label={t('month.closed')} />
          )}
        </View>
        <View>
          <AppText variant="small" tone="secondary">
            {t(isCurrent ? 'month.remainingFlexible' : 'month.finishedWith')}
          </AppText>
          <View style={styles.baseline}>
            <AppText variant="display" color={isCurrent && status.flexibleNow < 0 ? palette.danger : undefined}>
              {formatAmount(isCurrent ? status.flexibleNow : summary.endingBalance, currency, { whole: true })}
            </AppText>
            <AppText variant="bodyStrong" tone="secondary">
              {currency.label}
            </AppText>
          </View>
        </View>
        <SegmentBar segments={segments} />
        <View style={styles.legendRow}>
          {segments.map((segment) => (
            <LegendDot
              key={segment.label}
              color={segment.color}
              label={t('month.legend', { label: segment.label, percent: share(segment.value) })}
            />
          ))}
        </View>
        <View style={styles.metrics}>
          <Metric
            label={t('month.metric.income')}
            value={signed(summary.income)}
            caption={currency.label}
            color={palette.income}
          />
          {isCurrent ? (
            <Metric
              label={t('month.metric.protected')}
              value={signed(-status.protectedTotal)}
              caption={t('month.metric.billsSavings')}
            />
          ) : (
            <Metric label={t('month.metric.saved')} value={signed(-summary.savedMoved)} caption={currency.label} />
          )}
          <Metric
            label={t('month.metric.spent')}
            value={signed(-spent)}
            caption={isCurrent ? t('month.metric.soFar') : currency.label}
            color={palette.accentText}
          />
        </View>
        {isCurrent ? (
          <AppText variant="caption" tone="muted">
            {t('month.protectedDetail', {
              bills: m(status.billsProtected),
              savings: m(status.savingsReserve),
              buffer: m(status.minimumBalance),
            })}
          </AppText>
        ) : null}
      </Card>

      <Callout
        icon="insights"
        iconColor={palette.onBrandSoft}
        iconBackground={palette.brandSoft}
        title={t(isCurrent ? 'month.paceInsight' : 'month.cycleRecap')}>
        <AppText variant="small" tone="secondary">
          {outlook}
        </AppText>
        {summary.mostOverRoutine ? (
          <AppText variant="small" tone="secondary">
            {t('month.mostOver', {
              amount: m(summary.mostOverRoutine.trackedActual - summary.mostOverRoutine.expected),
              category: summary.mostOverRoutine.category.label.toLocaleLowerCase(),
            })}
          </AppText>
        ) : null}
      </Callout>

      <SectionTitle title={t('month.moneyFlow')} subtitle={t('month.moneyFlowSubtitle')} />
      <CycleMoneyCard
        summary={summary}
        currency={currency}
        endLabel={t(isCurrent ? 'month.now' : 'month.finishedWith')}
      />

      <SectionTitle
        title={t('month.routineVsActual')}
        subtitle={
          summary.expectedDailyAverage !== null
            ? t('month.routineVsActualSubtitle', {
                actual: m(summary.dailyAverage),
                expected: m(summary.expectedDailyAverage),
              })
            : t('month.routineVsActualEmpty')
        }
      />
      {comparisons.length === 0 ? (
        <Callout
          icon="routine"
          title={t('month.addRoutineTitle')}
          background={palette.surface}
          onPress={() => router.push('/routine')}>
          <AppText variant="small" tone="secondary">
            {t('month.addRoutineBody')}
          </AppText>
        </Callout>
      ) : (
        comparisons.map((insight) => <ComparisonCard key={insight.category.id} insight={insight} currency={currency} />)
      )}

      <SectionTitle
        title={t('month.whereMoneyWent')}
        subtitle={t('month.categoriesActive', { categories: tn('count.categories', active.length) })}
      />
      <Card style={styles.listCard}>
        {active.length === 0 ? (
          <AppText variant="small" tone="secondary">
            {t('month.noSpending')}
          </AppText>
        ) : (
          active.map((insight, position) => {
            const count = entryCounts.get(insight.category.id) ?? 0;
            return (
              <Fragment key={insight.category.id}>
                {position > 0 ? <Divider /> : null}
                <ListRow
                  emoji={insight.category.emoji}
                  tileColor={palette.surfaceLow}
                  title={insight.category.label}
                  subtitle={count > 0 ? tn('count.entries', count) : t('month.history')}
                  value={m(insight.actual)}
                  valueCaption={t('month.shareOfSpent', {
                    percent: totalOut > 0 ? ((insight.actual / totalOut) * 100).toFixed(1) : '0',
                  })}
                />
              </Fragment>
            );
          })
        )}
      </Card>

      {isCurrent ? (
        <Card style={styles.projection}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{t('month.projection')}</AppText>
            <AppText variant="small" tone="secondary">
              {status.projectedEndFlexible === null
                ? t('month.projectionSoon')
                : status.projectedEndFlexible >= 0
                  ? t('month.projectedSurplus', { amount: signed(status.projectedEndFlexible) })
                  : t('month.projectedShortfall', { amount: m(-status.projectedEndFlexible) })}
            </AppText>
          </View>
          <Button
            label={t('month.adjustRoutine')}
            variant="secondary"
            compact
            onPress={() => router.push('/routines')}
          />
        </Card>
      ) : null}
    </TabScreen>
  );
}

function RoundButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: palette.surfaceMuted, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
      ]}>
      <Icon name={icon} size={22} color={palette.text} />
    </Pressable>
  );
}

function Metric({ label, value, caption, color }: { label: string; value: string; caption: string; color?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.metric, { backgroundColor: palette.surfaceLow }]}>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="number" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {caption}
      </AppText>
    </View>
  );
}

function ComparisonCard({ insight, currency }: { insight: CategoryInsight; currency: CurrencyInfo }) {
  const palette = usePalette();
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const actual = insight.trackedActual;
  const { expected } = insight;
  const difference = actual - expected;
  const over = difference > 0;
  const scale = Math.max(actual, expected, 1);
  const percent = expected > 0 ? Math.round((actual / expected) * 100) : 0;

  return (
    <Card>
      <View style={styles.comparisonTop}>
        <IconCircle emoji={insight.category.emoji} size={40} background={palette.surfaceMuted} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{insight.category.label}</AppText>
          <AppText variant="caption" tone="muted">
            {t('month.baseline', { amount: m(expected) })}
          </AppText>
        </View>
        <View style={styles.alignEnd}>
          <AppText variant="number">{m(actual)}</AppText>
          <AppText variant="caption" tone="muted">
            {t('month.spentLabel')}
          </AppText>
        </View>
      </View>
      <View style={[styles.compareTrack, { backgroundColor: palette.surfaceMuted }]}>
        <View
          style={[
            styles.compareFill,
            { width: `${(actual / scale) * 100}%`, backgroundColor: over ? palette.accent : palette.brand },
          ]}
        />
        {over ? (
          <View style={[styles.marker, { left: `${(expected / scale) * 100}%`, backgroundColor: palette.inverse }]} />
        ) : null}
      </View>
      <View style={styles.spaceBetween}>
        <Badge
          icon={over ? 'trendingUp' : 'trendingDown'}
          label={
            difference === 0
              ? t('month.onRoutine')
              : over
                ? t('month.higherThanRoutine', { amount: m(difference) })
                : t('month.underRoutine', { amount: m(-difference) })
          }
          color={over ? palette.accentText : palette.onBrandSoft}
          background={over ? palette.accentSoft : palette.comfortableSoft}
        />
        <AppText variant="caption" tone="muted">
          {t('month.percentOfExpected', { percent })}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  strong: { fontWeight: '600' },
  alignEnd: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs },
  selector: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Space.sm },
  metrics: { flexDirection: 'row', gap: Space.sm },
  metric: { flex: 1, borderRadius: Radius.xs, padding: Space.sm, gap: 2 },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
  comparisonTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  compareTrack: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  compareFill: { height: '100%', borderRadius: Radius.pill },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  projection: { flexDirection: 'row', alignItems: 'center' },
});

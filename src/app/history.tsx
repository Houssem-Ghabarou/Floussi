import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dateInMonth, formatShortDate, splitDate, type LocalDate } from '@/domain/dates';
import {
  ALL_HISTORY,
  isFiltered,
  summarizeRange,
  totalsByDay,
  type Direction,
  type HistoryFilter,
} from '@/domain/history';
import { formatMoney, type Minor } from '@/domain/money';
import { t, tn } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import { AppText, Button, Card, Divider, MoneyLine, Segmented, SheetScreen } from '@/ui/components';
import { HistoryCalendar, type DayRange } from '@/ui/history-calendar';
import { Space } from '@/ui/theme';

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const router = useRouter();
  const financial = useFinancial();

  const [month, setMonth] = useState<LocalDate>(params.month ?? financial?.today ?? '');
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [direction, setDirection] = useState<Direction>('all');
  const [billsOnly, setBillsOnly] = useState(false);
  const [range, setRange] = useState<DayRange | null>(null);

  if (!financial) return null;
  const { data, today, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });

  const filter: HistoryFilter = { direction, billsOnly };
  const filtered = isFiltered(filter);
  const totals = totalsByDay(data.transactions, filter);

  // The month in view, for the totals line under the grid. `dateInMonth` clamps to the real last day.
  const [visibleYear, visibleMonth] = splitDate(month);
  const visible = summarizeRange(
    data.transactions,
    dateInMonth(visibleYear, visibleMonth, 1),
    dateInMonth(visibleYear, visibleMonth, 31),
    filter,
  );
  const summary = range?.to ? summarizeRange(data.transactions, range.from, range.to, filter) : null;

  const selectDay = (date: LocalDate) => {
    if (mode === 'day') {
      router.push({ pathname: '/day', params: { date } });
      return;
    }
    // First tap starts the range, second finishes it, a third starts over.
    setRange((current) => (!current || current.to ? { from: date, to: null } : { from: current.from, to: date }));
  };

  return (
    <SheetScreen title={t('history.section')} closeLabel={t('common.close')}>
      <AppText variant="small" tone="secondary">
        {t('history.subtitle')}
      </AppText>

      <Segmented
        options={[
          { value: 'day', label: t('history.modeDay') },
          { value: 'range', label: t('history.modeRange') },
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setRange(null);
        }}
      />

      <Card>
        <HistoryCalendar
          month={month}
          onMonthChange={setMonth}
          totals={totals}
          today={today}
          selected={null}
          range={mode === 'range' ? range : null}
          onSelectDay={selectDay}
        />

        <Divider />

        <AppText variant="small" tone="secondary">
          {visible.count === 0
            ? t(filtered ? 'history.emptyFiltered' : 'history.empty')
            : t('history.monthTotals', { out: m(visible.out), in: m(visible.in) })}
        </AppText>
      </Card>

      <Segmented
        options={[
          { value: 'all', label: t('activity.all') },
          { value: 'out', label: t('activity.out') },
          { value: 'in', label: t('activity.in') },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <Button
        label={t('history.billsOnly')}
        icon="receipt"
        variant={billsOnly ? 'primary' : 'secondary'}
        compact
        onPress={() => setBillsOnly(!billsOnly)}
      />

      {mode === 'range' ? (
        summary ? (
          <Card style={styles.summary}>
            <MoneyLine
              label={t('history.rangeTitle', {
                from: formatShortDate(summary.from),
                to: formatShortDate(summary.to),
              })}
              value={m(summary.out)}
              strong
            />
            <AppText variant="caption" tone="muted">
              {[
                t('history.rangeDays', { days: tn('count.days', summary.days) }),
                t('history.dailyAverage', { amount: m(summary.dailyAverage) }),
                tn('count.entries', summary.count),
              ].join(' · ')}
            </AppText>
            {summary.busiest ? (
              <MoneyLine
                label={`${t('history.busiest')} · ${formatShortDate(summary.busiest.date)}`}
                value={m(summary.busiest.out)}
              />
            ) : null}
            {summary.categories.length > 0 ? (
              <>
                <Divider />
                <AppText variant="label" tone="secondary">
                  {t('history.topCategories')}
                </AppText>
                {summary.categories.slice(0, 5).map((entry) => (
                  <MoneyLine
                    key={entry.category.id}
                    label={`${entry.category.emoji} ${entry.category.label}`}
                    value={m(entry.amount)}
                  />
                ))}
              </>
            ) : null}
            <Button label={t('history.clearRange')} variant="secondary" compact onPress={() => setRange(null)} />
          </Card>
        ) : (
          <View style={styles.hint}>
            <AppText variant="caption" tone="muted">
              {t('history.rangeHint')}
            </AppText>
          </View>
        )
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: Space.sm },
  hint: { alignItems: 'center' },
});

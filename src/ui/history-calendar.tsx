/** A month grid where each day is shaded by how much it matched the active filter. */
import { Pressable, StyleSheet, View } from 'react-native';

import {
  addMonths,
  dateInMonth,
  daysInMonth,
  formatLongDate,
  formatMonthYear,
  splitDate,
  weekday,
  weekdayShortName,
  type LocalDate,
} from '@/domain/dates';
import type { DayTotals } from '@/domain/history';
import { t } from '@/i18n';

import { AppText, haptics } from './components';
import { Icon } from './icon';
import { Radius, Space, usePalette } from './theme';

/** Alpha steps for the four shading levels, lightest first. */
const SHADES = ['26', '4D', '80', 'CC'];

export interface DayRange {
  from: LocalDate;
  /** Null while the first day is chosen and the second is still pending. */
  to: LocalDate | null;
}

function shadeFor(amount: number, busiest: number): string | null {
  if (amount <= 0 || busiest <= 0) return null;
  const step = Math.ceil((amount / busiest) * SHADES.length);
  return SHADES[Math.min(SHADES.length, Math.max(1, step)) - 1];
}

function inRange(date: LocalDate, range: DayRange | null): boolean {
  if (!range) return false;
  const to = range.to ?? range.from;
  const from = range.from <= to ? range.from : to;
  const end = range.from <= to ? to : range.from;
  return date >= from && date <= end;
}

export function HistoryCalendar({
  month,
  onMonthChange,
  totals,
  today,
  selected,
  range,
  onSelectDay,
}: {
  /** Any date inside the month to show. */
  month: LocalDate;
  onMonthChange: (month: LocalDate) => void;
  totals: Map<LocalDate, DayTotals>;
  today: LocalDate;
  selected: LocalDate | null;
  range: DayRange | null;
  onSelectDay: (date: LocalDate) => void;
}) {
  const palette = usePalette();
  const [year, monthNumber] = splitDate(month);

  const firstDay = dateInMonth(year, monthNumber, 1);
  const days = Array.from({ length: daysInMonth(year, monthNumber) }, (_, index) =>
    dateInMonth(year, monthNumber, index + 1),
  );
  const cells: (LocalDate | null)[] = [...Array.from({ length: weekday(firstDay) }, () => null), ...days];

  // Shading is relative to the heaviest day in view, so every month uses the full scale.
  const busiest = days.reduce((most, date) => Math.max(most, totals.get(date)?.out ?? 0), 0);
  const canGoForward = dateInMonth(year, monthNumber + 1, 1) <= today;

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable
          onPress={() => onMonthChange(addMonths(firstDay, -1, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('datePicker.previousMonth')}>
          <Icon name="chevronLeft" size={22} color={palette.text} />
        </Pressable>
        <AppText variant="bodyStrong">{formatMonthYear(firstDay)}</AppText>
        <Pressable
          onPress={() => onMonthChange(addMonths(firstDay, 1, 1))}
          hitSlop={12}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoForward }}
          accessibilityLabel={t('datePicker.nextMonth')}>
          <Icon name="chevronRight" size={22} color={canGoForward ? palette.text : palette.textMuted} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {Array.from({ length: 7 }, (_, index) => (
          <View key={`weekday-${index}`} style={styles.cell}>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {weekdayShortName(index)}
            </AppText>
          </View>
        ))}
        {cells.map((date, index) => {
          if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
          const day = totals.get(date);
          const future = date > today;
          const shade = shadeFor(day?.out ?? 0, busiest);
          const chosen = selected === date || inRange(date, range);
          const incomeOnly = !shade && (day?.in ?? 0) > 0;

          return (
            <Pressable
              key={date}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={formatLongDate(date)}
              accessibilityState={{ selected: chosen, disabled: future }}
              onPress={() => {
                haptics.tap();
                onSelectDay(date);
              }}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  shade ? { backgroundColor: `${palette.brand}${shade}` } : null,
                  chosen ? { backgroundColor: palette.brandDeep } : null,
                  date === today && !chosen ? { borderWidth: 1.5, borderColor: palette.brand } : null,
                ]}>
                <AppText
                  variant="small"
                  color={chosen ? '#FFFFFF' : future ? palette.textMuted : palette.text}
                  style={{ fontWeight: chosen || date === today ? '700' : '500', opacity: future ? 0.4 : 1 }}>
                  {splitDate(date)[2]}
                </AppText>
              </View>
              {incomeOnly ? <View style={[styles.incomeDot, { backgroundColor: palette.income }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: Space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  incomeDot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 2.5 },
});

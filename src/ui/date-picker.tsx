import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  dateInMonth,
  daysInMonth,
  formatLongDate,
  MONTH_NAMES,
  splitDate,
  weekday,
  type LocalDate,
} from '@/domain/dates';

import { AppText, Chip, ChipGroup, haptics } from './components';
import { Radius, Space, usePalette } from './theme';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarPicker({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  minDate?: LocalDate;
  maxDate?: LocalDate;
}) {
  const palette = usePalette();
  const [year, month] = splitDate(value);
  const [view, setView] = useState({ year, month });

  const firstDay = dateInMonth(view.year, view.month, 1);
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: weekday(firstDay) }, () => null),
    ...Array.from({ length: daysInMonth(view.year, view.month) }, (_, index) =>
      dateInMonth(view.year, view.month, index + 1),
    ),
  ];

  const shiftMonth = (delta: number) => {
    const [nextYear, nextMonth] = splitDate(dateInMonth(view.year, view.month + delta, 1));
    setView({ year: nextYear, month: nextMonth });
  };

  return (
    <View style={[styles.calendar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12} accessibilityLabel="Previous month">
          <AppText variant="heading" tone="brand">
            ‹
          </AppText>
        </Pressable>
        <AppText variant="bodyStrong">
          {MONTH_NAMES[view.month - 1]} {view.year}
        </AppText>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12} accessibilityLabel="Next month">
          <AppText variant="heading" tone="brand">
            ›
          </AppText>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={`w${index}`} style={styles.cell}>
            <AppText variant="caption" tone="muted">
              {initial}
            </AppText>
          </View>
        ))}
        {cells.map((date, index) => {
          if (!date) return <View key={`e${index}`} style={styles.cell} />;
          const disabled = (minDate !== undefined && date < minDate) || (maxDate !== undefined && date > maxDate);
          const selected = date === value;
          return (
            <Pressable
              key={date}
              disabled={disabled}
              accessibilityLabel={formatLongDate(date)}
              accessibilityState={{ selected, disabled }}
              onPress={() => {
                haptics.tap();
                onChange(date);
              }}
              style={styles.cell}>
              <View style={[styles.day, selected && { backgroundColor: palette.brand }]}>
                <AppText
                  variant="small"
                  color={selected ? palette.brandText : disabled ? palette.textMuted : palette.text}
                  style={{ fontWeight: selected ? '700' : '500', opacity: disabled ? 0.5 : 1 }}>
                  {splitDate(date)[2]}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Quick date chips with an optional full calendar. */
export function DateChoice({
  value,
  onChange,
  options,
  minDate,
  maxDate,
}: {
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  options: { label: string; date: LocalDate }[];
  minDate?: LocalDate;
  maxDate?: LocalDate;
}) {
  const matchesOption = options.some((option) => option.date === value);
  const [showCalendar, setShowCalendar] = useState(!matchesOption);

  return (
    <View style={{ gap: Space.md }}>
      <ChipGroup>
        {options.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={!showCalendar && option.date === value}
            onPress={() => {
              setShowCalendar(false);
              onChange(option.date);
            }}
          />
        ))}
        <Chip label="Pick a date" emoji="📅" selected={showCalendar} onPress={() => setShowCalendar(true)} />
      </ChipGroup>
      {showCalendar ? (
        <CalendarPicker value={value} onChange={onChange} minDate={minDate} maxDate={maxDate} />
      ) : null}
      <AppText variant="small" tone="secondary">
        {formatLongDate(value)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, padding: Space.md, gap: Space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

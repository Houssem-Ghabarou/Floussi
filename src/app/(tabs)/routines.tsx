import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { expenseCategory } from '@/domain/categories';
import { weekdayName, weekdayShortName } from '@/domain/dates';
import { formatAmount, formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';
import { routineByWeekday, routineTotal } from '@/domain/routines';
import type { Routine } from '@/domain/types';
import { t, tn } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import { TabScreen } from '@/ui/app-header';
import {
  AppText,
  Badge,
  Button,
  Callout,
  Card,
  IconCircle,
  LegendDot,
  PageIntro,
  SegmentBar,
} from '@/ui/components';
import { Radius, Space, usePalette } from '@/ui/theme';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Monday – Friday", "Saturday & Sunday", "Mon, Wed, Fri"… in the chosen language. */
function describeDays(weekdays: number[]): string {
  const ordered = WEEK_ORDER.filter((day) => weekdays.includes(day));
  if (ordered.length === 0) return t('routines.noDays');
  if (ordered.length === 7) return t('routines.everyDay');
  if (ordered.length === 1) return t('routines.activeOn', { day: weekdayName(ordered[0]) });
  if (ordered.length === 2) {
    return t('routines.activeTwo', { first: weekdayName(ordered[0]), second: weekdayName(ordered[1]) });
  }
  const positions = ordered.map((day) => WEEK_ORDER.indexOf(day));
  const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
  if (contiguous) {
    return t('routines.activeRange', {
      from: weekdayName(ordered[0]),
      to: weekdayName(ordered[ordered.length - 1]),
    });
  }
  return t('routines.activeList', { days: ordered.map((day) => weekdayShortName(day)).join(', ') });
}

export default function RoutinesScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();

  if (!financial) return null;
  const { data, status, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });

  const byWeekday = routineByWeekday(data.routines);
  const weeklyAverage = Math.round(byWeekday.reduce((sum, amount) => sum + amount, 0) / 7);
  const cushion = status.dailyAllowance - weeklyAverage;

  return (
    <TabScreen section={t('nav.routine')}>
      <PageIntro
        title={t('routines.title')}
        subtitle={t('routines.subtitle')}
        icon="rules"
        iconLabel={t('routines.settings')}
        onIconPress={() => router.push('/protections')}
      />

      <Callout
        icon="lightbulb"
        iconColor={palette.accentText}
        iconBackground={palette.accentSoft}
        title={t('routines.explainerTitle')}>
        <AppText variant="small" tone="secondary">
          {t('routines.explainerBody')}
        </AppText>
      </Callout>

      {data.routines.length === 0 ? (
        <Card style={styles.empty}>
          <AppText style={styles.emptyEmoji}>☀️</AppText>
          <AppText variant="heading">{t('routines.emptyTitle')}</AppText>
          <AppText variant="small" tone="secondary" style={styles.center}>
            {t('routines.emptyBody')}
          </AppText>
        </Card>
      ) : (
        data.routines.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            currency={currency}
            onPress={() => router.push({ pathname: '/routine', params: { id: routine.id } })}
          />
        ))
      )}

      <Button label={t('routines.add')} icon="add" onPress={() => router.push('/routine')} />

      {weeklyAverage > 0 ? (
        <View style={[styles.horizon, { backgroundColor: palette.surfaceMuted }]}>
          <View style={styles.inline}>
            <IconCircle icon="insights" size={28} color={palette.brandText} background={palette.brand} />
            <AppText variant="label" tone="brand">
              {t('routines.horizon')}
            </AppText>
          </View>
          <AppText>
            {cushion >= 0
              ? t('routines.horizonCushion', {
                  average: m(weeklyAverage),
                  pace: m(status.dailyAllowance),
                  cushion: m(cushion),
                })
              : t('routines.horizonOver', {
                  average: m(weeklyAverage),
                  pace: m(status.dailyAllowance),
                  over: m(-cushion),
                })}
          </AppText>
          <SegmentBar
            height={8}
            track={palette.surfaceHighest}
            segments={[
              { value: Math.min(weeklyAverage, status.dailyAllowance), color: palette.brandDeep },
              { value: Math.max(0, cushion), color: '#93D4B5' },
              { value: Math.max(0, -cushion), color: palette.accent },
            ]}
          />
          <View style={styles.spaceBetween}>
            <LegendDot
              color={palette.brandDeep}
              label={t('routines.legendRoutine', { amount: m(weeklyAverage) })}
              textColor={palette.text}
            />
            {cushion >= 0 ? (
              <LegendDot
                color="#93D4B5"
                label={t('routines.legendCushion', { amount: m(cushion) })}
                textColor={palette.text}
              />
            ) : (
              <LegendDot
                color={palette.accent}
                label={t('routines.legendOver', { amount: m(-cushion) })}
                textColor={palette.text}
              />
            )}
          </View>
        </View>
      ) : null}

      <Callout
        icon="restart"
        title={t('routines.seasonalTitle')}
        background={palette.surface}
        onPress={() => router.push('/routine')}>
        <AppText variant="small" tone="secondary">
          {t('routines.seasonalBody')}
        </AppText>
      </Callout>
    </TabScreen>
  );
}

function RoutineCard({ routine, currency, onPress }: { routine: Routine; currency: CurrencyInfo; onPress: () => void }) {
  const palette = usePalette();
  const days = routine.weekdays.length;

  return (
    <Card>
      <View style={styles.cardTop}>
        <AppText style={styles.routineEmoji}>{routine.emoji}</AppText>
        <View style={styles.flex}>
          <AppText variant="heading">{routine.name}</AppText>
          <AppText variant="caption" tone="muted">
            {describeDays(routine.weekdays)}
          </AppText>
        </View>
        {days > 0 ? (
          <Badge
            label={t('routines.active', { days: tn('count.daysPerWeek', days) })}
            dot
            color={palette.onBrandSoft}
            background={palette.comfortableSoft}
          />
        ) : (
          <Badge label={t('routines.noDaysBadge')} color={palette.accentText} background={palette.accentSoft} />
        )}
      </View>

      <View style={[styles.expected, { backgroundColor: palette.surfaceLow }]}>
        <AppText variant="small" tone="secondary">
          {t('routines.dailyExpected')}
        </AppText>
        <View style={styles.baseline}>
          <AppText variant="display">{formatAmount(routineTotal(routine), currency, { whole: true })}</AppText>
          <AppText variant="bodyStrong" tone="secondary">
            {currency.label}
          </AppText>
        </View>
      </View>

      {routine.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <IconCircle emoji={expenseCategory(item.category).emoji} size={32} background={palette.surfaceMuted} />
          <AppText style={styles.flex}>{item.name}</AppText>
          <AppText variant="number">{formatMoney(item.amount, currency)}</AppText>
        </View>
      ))}

      <View style={styles.actions}>
        <Button label={t('routines.tune')} icon="edit" variant="secondary" compact onPress={onPress} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm, flexWrap: 'wrap' },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs },
  empty: { alignItems: 'center', gap: Space.sm, paddingVertical: Space.xl },
  emptyEmoji: { fontSize: 40, lineHeight: 50 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  routineEmoji: { fontSize: 26, lineHeight: 32 },
  expected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  horizon: { borderRadius: Radius.md, padding: Space.lg, gap: Space.md },
});

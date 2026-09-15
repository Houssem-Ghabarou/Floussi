import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { expenseCategory } from '@/domain/categories';
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/domain/dates';
import { formatAmount, formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';
import { routineByWeekday, routineTotal } from '@/domain/routines';
import type { Routine } from '@/domain/types';
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

/** "Monday – Friday", "Saturday & Sunday", "Mon, Wed, Fri"… */
function describeDays(weekdays: number[]): string {
  const ordered = WEEK_ORDER.filter((day) => weekdays.includes(day));
  if (ordered.length === 0) return 'No days assigned yet';
  if (ordered.length === 7) return 'Active every day';
  if (ordered.length === 1) return `Active on ${WEEKDAY_NAMES[ordered[0]]}`;
  const positions = ordered.map((day) => WEEK_ORDER.indexOf(day));
  const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
  if (ordered.length === 2) return `Active ${WEEKDAY_NAMES[ordered[0]]} & ${WEEKDAY_NAMES[ordered[1]]}`;
  if (contiguous) return `Active ${WEEKDAY_NAMES[ordered[0]]} – ${WEEKDAY_NAMES[ordered[ordered.length - 1]]}`;
  return `Active ${ordered.map((day) => WEEKDAY_SHORT[day]).join(', ')}`;
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
    <TabScreen section="Routine">
      <PageIntro
        title="My spending routines"
        subtitle="Patterns shaping your normal day"
        icon="rules"
        iconLabel="Normal day settings"
        onIconPress={() => router.push('/protections')}
      />

      <Callout
        icon="lightbulb"
        iconColor={palette.accentText}
        iconBackground={palette.accentSoft}
        title="Predictive, not transactional">
        <AppText variant="small" tone="secondary">
          Routines are your typical spending patterns, not automatic deductions. They set a realistic normal day and
          let you log expenses in one tap.
        </AppText>
      </Callout>

      {data.routines.length === 0 ? (
        <Card style={styles.empty}>
          <AppText style={styles.emptyEmoji}>☀️</AppText>
          <AppText variant="heading">What does a normal day cost you?</AppText>
          <AppText variant="small" tone="secondary" style={styles.center}>
            Start with a workday: coffee, lunch, transport… Add a weekend or gym day later.
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

      <Button label="Add routine" icon="add" onPress={() => router.push('/routine')} />

      {weeklyAverage > 0 ? (
        <View style={[styles.horizon, { backgroundColor: palette.surfaceMuted }]}>
          <View style={styles.inline}>
            <IconCircle icon="insights" size={28} color={palette.brandText} background={palette.brand} />
            <AppText variant="label" tone="brand">
              Coach horizon
            </AppText>
          </View>
          <AppText>
            Your routines average{' '}
            <AppText style={styles.strong}>~{m(weeklyAverage)}</AppText>/day. Compared to your{' '}
            <AppText style={styles.strong}>{m(status.dailyAllowance)}</AppText> safe pace,{' '}
            {cushion >= 0 ? (
              <>
                you keep <AppText tone="brand" style={styles.strong}>~{m(cushion)}/day</AppText> of cushion.
              </>
            ) : (
              <>
                they cost <AppText tone="accent" style={styles.strong}>~{m(-cushion)}/day</AppText> more than you can
                safely spend.
              </>
            )}
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
            <LegendDot color={palette.brandDeep} label={`${m(weeklyAverage)} routine`} textColor={palette.text} />
            {cushion >= 0 ? (
              <LegendDot color="#93D4B5" label={`+${m(cushion)} cushion`} textColor={palette.text} />
            ) : (
              <LegendDot color={palette.accent} label={`${m(-cushion)} over pace`} textColor={palette.text} />
            )}
          </View>
        </View>
      ) : null}

      <Callout
        icon="restart"
        title="Need a seasonal reset?"
        background={palette.surface}
        onPress={() => router.push('/routine')}>
        <AppText variant="small" tone="secondary">
          Create a routine for holidays or Ramadan, then give it the days it covers.
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
          <Badge label={`Active · ${days}d/wk`} dot color={palette.onBrandSoft} background={palette.comfortableSoft} />
        ) : (
          <Badge label="No days" color={palette.accentText} background={palette.accentSoft} />
        )}
      </View>

      <View style={[styles.expected, { backgroundColor: palette.surfaceLow }]}>
        <AppText variant="small" tone="secondary">
          Daily expected
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
        <Button label="Tune details" icon="edit" variant="secondary" compact onPress={onPress} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  strong: { fontWeight: '700' },
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

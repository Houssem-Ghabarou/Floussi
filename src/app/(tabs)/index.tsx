import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { STATUS_LABELS } from '@/domain/advice';
import { expenseCategory } from '@/domain/categories';
import { addDays, daysBetween, formatDaysFromNow, formatLongDate, formatShortDate, weekday } from '@/domain/dates';
import { cycleBillOccurrences } from '@/domain/derive';
import { formatAmount, formatMoney, type CurrencyInfo, type Minor } from '@/domain/money';
import { routineForWeekday } from '@/domain/routines';
import type { RoutineItem } from '@/domain/types';
import { useNotificationAccess } from '@/platform/use-notification-access';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { TabScreen } from '@/ui/app-header';
import {
  AppText,
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  ChipGroup,
  Divider,
  haptics,
  IconCircle,
  LegendDot,
  ListRow,
  ProgressBar,
  SectionTitle,
  SegmentBar,
  StatusPill,
} from '@/ui/components';
import { Icon } from '@/ui/icon';
import { CardShadow, Radius, riskColors, Space, usePalette } from '@/ui/theme';
import { showToast } from '@/ui/toast';
import { TransactionRow } from '@/ui/transaction-row';

const NORMAL_DAY_CAPTION = { routines: 'From routines', custom: 'Your estimate', default: 'Default' } as const;

export default function TodayScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();
  const addTransaction = useApp((state) => state.addTransaction);
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const updateCycle = useApp((state) => state.updateCycle);
  const updateSettings = useApp((state) => state.updateSettings);
  const { access, request } = useNotificationAccess();

  if (!financial) return null;
  const { data, today, status, advice, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const colors = riskColors(palette, status.riskLevel);

  const todays = data.transactions
    .filter((t) => t.date === today)
    .sort((a, b) => b.createdAt - a.createdAt);
  const expenseCount = todays.filter((t) => t.kind === 'expense').length;
  const routine = routineForWeekday(data.routines, weekday(today));
  const billsSoon = cycleBillOccurrences(data, today).filter(
    (occurrence) => !occurrence.paid && daysBetween(today, occurrence.dueDate) <= 7,
  );
  const hasSpentToday = status.spentToday > 0;
  const overToday = status.remainingToday < 0;
  const heroValue = hasSpentToday ? Math.max(0, status.remainingToday) : status.dailyAllowance;
  const flexible = Math.max(0, status.flexibleNow);
  // Asked once, after onboarding, and never while the system can no longer show its prompt.
  const askReminders = !data.settings.remindersAsked && access !== null && !access.granted && access.canAskAgain;
  const showPastSpendingPrompt =
    daysBetween(data.settings.openingDate, today) <= 7 &&
    !data.transactions.some((t) => !t.countsToBalance);

  const quickAdd = (item: RoutineItem) => {
    const transaction = addTransaction({
      kind: 'expense',
      amount: -item.amount,
      category: item.category,
      note: item.name,
      date: today,
    });
    haptics.success();
    showToast(`${item.name} · ${formatMoney(item.amount, currency)} added`, {
      label: 'Undo',
      onPress: () => deleteTransaction(transaction.id),
    });
  };

  return (
    <TabScreen section="Today">
      <View style={styles.greeting}>
        <View style={styles.flex}>
          <AppText variant="label" tone="secondary">
            {formatLongDate(today)}
          </AppText>
          <AppText variant="title">{m(status.balance)} available</AppText>
        </View>
        <Pressable onPress={() => router.push('/payday')} accessibilityRole="button" hitSlop={8}>
          <Badge
            icon="event"
            label={
              status.incomeDue
                ? 'Income due'
                : `${status.daysUntilIncome} ${status.daysUntilIncome === 1 ? 'day' : 'days'} to payday`
            }
          />
        </Pressable>
      </View>

      {status.incomeDue ? (
        <Card tint={palette.surfaceLow}>
          <View style={styles.inline}>
            <IconCircle icon="payments" size={36} color={palette.brand} background={palette.surface} />
            <AppText variant="heading" style={styles.flex}>
              Is your {data.cycle.incomeLabel.toLowerCase()} here?
            </AppText>
          </View>
          <AppText variant="small" tone="secondary">
            It was expected {formatDaysFromNow(data.cycle.nextIncomeDate, today)}. Once it arrives, we'll wrap up this
            cycle and start the next one.
          </AppText>
          <View style={styles.buttonRow}>
            <Button
              label="Yes, add it"
              compact
              style={styles.flex}
              onPress={() => router.push({ pathname: '/income', params: { cycleIncome: '1' } })}
            />
            <Button
              label="Not yet"
              variant="secondary"
              compact
              style={styles.flex}
              onPress={() => {
                updateCycle({ nextIncomeDate: addDays(today, 1) });
                showToast("OK, we'll check again tomorrow.");
              }}
            />
          </View>
        </Card>
      ) : null}

      <Card
        onPress={() => router.push('/breakdown')}
        accessibilityLabel="See how your safe amount is calculated"
        style={styles.hero}>
        <View style={[styles.glow, { backgroundColor: colors.bg }]} />
        <View style={styles.spaceBetween}>
          <StatusPill level={status.riskLevel} label={STATUS_LABELS[status.reason]} />
          <AppText variant="caption" tone="secondary">
            Payday: {formatShortDate(data.cycle.nextIncomeDate)}
          </AppText>
        </View>
        <View>
          <AppText variant="label" tone="secondary">
            {hasSpentToday ? 'Left to spend today' : 'Safe to spend today'}
          </AppText>
          <View style={styles.baseline}>
            <AppText variant="hero">{formatAmount(heroValue, currency, { whole: true })}</AppText>
            <AppText variant="heading" tone="secondary">
              {currency.label}
            </AppText>
          </View>
        </View>
        <View style={styles.gauge}>
          <ProgressBar
            progress={status.dailyAllowance > 0 ? status.spentToday / status.dailyAllowance : hasSpentToday ? 1 : 0}
            color={overToday ? palette.danger : colors.fg}
          />
          <View style={styles.spaceBetween}>
            <AppText variant="caption" tone="secondary">
              Spent:{' '}
              <AppText variant="caption" style={styles.strong}>
                {m(status.spentToday)}
              </AppText>
            </AppText>
            <AppText variant="caption" tone="secondary">
              {overToday ? 'Over by: ' : 'Remaining: '}
              <AppText variant="caption" color={overToday ? palette.danger : colors.fg} style={styles.strong}>
                {m(Math.abs(status.remainingToday))}
              </AppText>
            </AppText>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <Button label="Add expense" icon="add" style={styles.flex} onPress={() => router.push('/expense')} />
          <Button
            label="What if?"
            icon="help"
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push('/what-if')}
          />
        </View>
        <Button label="Money received" icon="payments" variant="ghost" compact onPress={() => router.push('/income')} />
      </Card>

      <Callout icon="eco" title="Coach perspective" onPress={() => router.push('/breakdown')}>
        <AppText variant="small" tone="secondary">
          <AppText variant="small" style={styles.strong}>
            {advice.title}.{' '}
          </AppText>
          {advice.detail}
          {advice.suggestion ? ` ${advice.suggestion}` : ''}
        </AppText>
      </Callout>

      {askReminders ? (
        <Card tint={palette.surfaceLow}>
          <View style={styles.inline}>
            <IconCircle icon="bell" size={36} color={palette.brand} background={palette.surface} />
            <AppText variant="bodyStrong" style={styles.flex}>
              Want a heads-up before bills are due?
            </AppText>
          </View>
          <AppText variant="small" tone="secondary">
            Flousey can remind you the day before a bill, on payday, and when you haven't checked in for a few days.
            You can change this anytime in Rules.
          </AppText>
          <View style={styles.buttonRow}>
            <Button
              label="Turn on reminders"
              compact
              style={styles.flex}
              onPress={async () => {
                updateSettings({ remindersAsked: true });
                const granted = await request();
                showToast(granted ? 'Reminders are on' : 'You can turn reminders on anytime in Rules');
              }}
            />
            <Button
              label="Not now"
              variant="secondary"
              compact
              style={styles.flex}
              onPress={() => updateSettings({ remindersAsked: true })}
            />
          </View>
        </Card>
      ) : null}

      <Card onPress={() => router.push('/breakdown')} accessibilityLabel="See how your money is split">
        <View style={styles.spaceBetween}>
          <View style={styles.inline}>
            <Icon name="donut" size={20} color={palette.text} />
            <AppText variant="heading">Cycle allocation</AppText>
          </View>
          <AppText variant="small" tone="secondary">
            {m(status.balance)} total
          </AppText>
        </View>
        <SegmentBar
          segments={[
            { value: status.protectedTotal, color: palette.inverse },
            { value: flexible, color: palette.brand },
          ]}
        />
        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: palette.surfaceLow }]}>
            <LegendDot color={palette.inverse} label="Protected" textColor={palette.textSecondary} />
            <TileAmount value={status.protectedTotal} currency={currency} />
            <AppText variant="caption" tone="secondary">
              • Bills: {m(status.billsProtected)}
            </AppText>
            <AppText variant="caption" tone="secondary">
              • Savings: {m(status.savingsReserve)}
            </AppText>
            <AppText variant="caption" tone="secondary">
              • Buffer: {m(status.minimumBalance)}
            </AppText>
          </View>
          <View style={[styles.tile, { backgroundColor: palette.comfortableSoft }]}>
            <LegendDot color={palette.brand} label="Flexible" textColor={palette.textSecondary} />
            <TileAmount
              value={status.flexibleNow}
              currency={currency}
              color={status.flexibleNow < 0 ? palette.danger : undefined}
            />
            <AppText variant="caption" tone="secondary">
              • {status.daysRemaining} {status.daysRemaining === 1 ? 'day' : 'days'} left
            </AppText>
            <AppText variant="caption" tone="secondary">
              • ~{m(status.upcomingDailyPace)}/day after today
            </AppText>
            <AppText variant="caption" tone="brand" style={styles.strong}>
              Unspent money spreads out
            </AppText>
          </View>
        </View>
      </Card>

      <View style={styles.stats}>
        <StatTile
          label="Normal day"
          value={m(status.normalDay)}
          caption={NORMAL_DAY_CAPTION[status.normalDaySource]}
          onPress={() => router.push(status.normalDaySource === 'routines' ? '/routines' : '/protections')}
        />
        <StatTile
          label="Spent today"
          value={m(status.spentToday)}
          caption={`${expenseCount} ${expenseCount === 1 ? 'entry' : 'entries'}`}
          onPress={() => router.push('/activity')}
        />
        <StatTile
          label="Safe room"
          value={formatMoney(status.remainingToday, currency, { whole: true, signed: true })}
          valueColor={overToday ? palette.danger : palette.brand}
          caption="Until midnight"
          captionColor={palette.textMuted}
          onPress={() => router.push('/breakdown')}
        />
      </View>

      {billsSoon.length > 0 ? (
        <>
          <SectionTitle
            title="Bills coming up"
            count={billsSoon.length}
            action={{ label: 'All bills', onPress: () => router.push('/rules') }}
          />
          <Card style={styles.listCard}>
            {billsSoon.map((occurrence, index) => (
              <Fragment key={`${occurrence.bill.id}-${occurrence.dueDate}`}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  emoji={occurrence.bill.emoji}
                  title={occurrence.bill.name}
                  subtitle={
                    occurrence.dueDate < today
                      ? `Overdue since ${formatShortDate(occurrence.dueDate)} · still protected`
                      : `Due ${formatDaysFromNow(occurrence.dueDate, today)} · already protected`
                  }
                  value={formatMoney(occurrence.bill.amount, currency)}
                  valueCaption="Tap to pay"
                  onPress={() =>
                    router.push({
                      pathname: '/pay-bill',
                      params: { billId: occurrence.bill.id, dueDate: occurrence.dueDate },
                    })
                  }
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {routine && routine.items.length > 0 ? (
        <Card>
          <View style={styles.spaceBetween}>
            <View style={styles.inline}>
              <AppText style={styles.emoji}>{routine.emoji}</AppText>
              <AppText variant="bodyStrong">Quick add · {routine.name}</AppText>
            </View>
            <Pressable onPress={() => router.push('/routines')} hitSlop={8} accessibilityRole="button">
              <AppText variant="small" tone="brand" style={styles.strong}>
                Edit
              </AppText>
            </Pressable>
          </View>
          <AppText variant="small" tone="secondary">
            Tap when it actually happens. Nothing is added automatically.
          </AppText>
          <ChipGroup>
            {routine.items.map((item) => (
              <Chip
                key={item.id}
                emoji={expenseCategory(item.category).emoji}
                label={`${item.name} ${formatAmount(item.amount, currency)}`}
                onPress={() => quickAdd(item)}
              />
            ))}
          </ChipGroup>
        </Card>
      ) : data.routines.length === 0 ? (
        <Callout
          icon="routine"
          title="What does a normal day cost you?"
          background={palette.surface}
          onPress={() => router.push('/routine')}>
          <AppText variant="small" tone="secondary">
            Add your routine (coffee, lunch, transport…) to compare your plan with real life and log expenses in one
            tap.
          </AppText>
        </Callout>
      ) : null}

      <SectionTitle
        title="Today's expenses"
        count={todays.length}
        action={{ label: 'View all', onPress: () => router.push('/activity') }}
      />
      <Card style={styles.listCard}>
        {todays.length === 0 ? (
          <AppText variant="small" tone="secondary">
            Nothing logged yet today. Add expenses as they happen. It only takes a few seconds.
          </AppText>
        ) : (
          todays.map((transaction, index) => (
            <Fragment key={transaction.id}>
              {index > 0 ? <Divider /> : null}
              <TransactionRow transaction={transaction} bills={data.bills} currency={currency} />
            </Fragment>
          ))
        )}
      </Card>

      {showPastSpendingPrompt ? (
        <Callout
          icon="receipt"
          title="Spent money earlier this month?"
          onPress={() => router.push({ pathname: '/expense', params: { past: '1' } })}>
          <AppText variant="small" tone="secondary">
            Add it to see where your money went. It won't change your balance or your safe pace.
          </AppText>
        </Callout>
      ) : null}

      <View style={[styles.footerNote, { backgroundColor: palette.surfaceLow }]}>
        <Icon name="bedtime" size={16} color={palette.textSecondary} />
        <AppText variant="small" tone="secondary" style={styles.flex}>
          Unspent money spreads over your coming days automatically.
        </AppText>
      </View>
    </TabScreen>
  );
}

function TileAmount({ value, currency, color }: { value: Minor; currency: CurrencyInfo; color?: string }) {
  return (
    <View style={styles.baseline}>
      <AppText variant="heading" color={color} style={styles.tileValue}>
        {formatAmount(value, currency, { whole: true })}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {currency.label}
      </AppText>
    </View>
  );
}

function StatTile({
  label,
  value,
  caption,
  valueColor,
  captionColor,
  onPress,
}: {
  label: string;
  value: string;
  caption: string;
  valueColor?: string;
  captionColor?: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.stat, { backgroundColor: palette.surface }, CardShadow, pressed && styles.pressed]}>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="number" color={valueColor} numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="caption" color={captionColor ?? palette.brand} numberOfLines={1}>
        {caption}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  pressed: { opacity: 0.85 },
  emoji: { fontSize: 18 },
  greeting: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs },
  hero: { overflow: 'hidden', gap: Space.md },
  glow: { position: 'absolute', top: -56, right: -56, width: 160, height: 160, borderRadius: 80, opacity: 0.7 },
  gauge: { gap: 6 },
  buttonRow: { flexDirection: 'row', gap: Space.sm },
  tiles: { flexDirection: 'row', gap: Space.sm },
  tile: { flex: 1, borderRadius: Radius.xs, padding: Space.md, gap: 2 },
  tileValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', gap: Space.sm },
  stat: { flex: 1, borderRadius: Radius.md, paddingVertical: Space.md, paddingHorizontal: Space.sm, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 17, lineHeight: 22 },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderRadius: Radius.md, padding: Space.md },
});

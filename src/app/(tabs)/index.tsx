import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { expenseCategory } from '@/domain/categories';
import { addDays, daysBetween, formatDaysFromNow, formatLongDate, formatShortDate, weekday } from '@/domain/dates';
import { cycleBillOccurrences } from '@/domain/derive';
import { formatAmount, formatMoney, type Minor } from '@/domain/money';
import { routineForWeekday } from '@/domain/routines';
import type { RoutineItem } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  haptics,
  ListRow,
  ProgressBar,
  Screen,
  SectionTitle,
  StatusPill,
} from '@/ui/components';
import { Radius, riskColors, Space, usePalette } from '@/ui/theme';
import { showToast } from '@/ui/toast';
import { TransactionRow } from '@/ui/transaction-row';

export default function TodayScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();
  const addTransaction = useApp((state) => state.addTransaction);
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const updateCycle = useApp((state) => state.updateCycle);

  if (!financial) return null;
  const { data, today, status, advice, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const colors = riskColors(palette, status.riskLevel);

  const todays = data.transactions
    .filter((t) => t.date === today)
    .sort((a, b) => b.createdAt - a.createdAt);
  const routine = routineForWeekday(data.routines, weekday(today));
  const billsSoon = cycleBillOccurrences(data, today).filter(
    (occurrence) => !occurrence.paid && daysBetween(today, occurrence.dueDate) <= 7,
  );
  const hasSpentToday = status.spentToday > 0;
  const overToday = status.remainingToday < 0;
  const heroValue = hasSpentToday ? Math.max(0, status.remainingToday) : status.dailyAllowance;
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
    <Screen>
      <View>
        <AppText variant="label" tone="secondary">
          {formatLongDate(today)}
        </AppText>
        <AppText variant="title">Today</AppText>
      </View>

      {status.incomeDue ? (
        <Card tint={palette.brandSoft}>
          <AppText variant="heading">💰 Is your {data.cycle.incomeLabel.toLowerCase()} here?</AppText>
          <AppText tone="secondary">
            It was expected {formatDaysFromNow(data.cycle.nextIncomeDate, today)}. Once it arrives, we'll wrap up
            this cycle and start the next one.
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
        tint={colors.bg}
        onPress={() => router.push('/breakdown')}
        accessibilityLabel="See how your safe amount is calculated"
        style={styles.hero}>
        <AppText variant="label" color={colors.fg}>
          {hasSpentToday ? 'Left to spend today' : 'Safe to spend today'}
        </AppText>
        <View style={styles.heroNumber}>
          <AppText variant="hero">{formatAmount(heroValue, currency, { whole: true })}</AppText>
          <AppText variant="heading" tone="secondary">
            {currency.label}
          </AppText>
        </View>
        {hasSpentToday ? (
          <View style={styles.progress}>
            <ProgressBar
              progress={status.dailyAllowance > 0 ? status.spentToday / status.dailyAllowance : 1}
              color={overToday ? palette.watch : colors.fg}
            />
            <AppText variant="small" tone="secondary">
              {overToday
                ? `${m(-status.remainingToday)} past today's ${m(status.dailyAllowance)}`
                : `Spent ${m(status.spentToday)} of ${m(status.dailyAllowance)} today`}
            </AppText>
          </View>
        ) : null}
        <StatusPill level={status.riskLevel} />
        <View style={styles.advice}>
          <AppText variant="bodyStrong">{advice.title}</AppText>
          <AppText tone="secondary">{advice.detail}</AppText>
          {advice.suggestion ? <AppText tone="secondary">{advice.suggestion}</AppText> : null}
        </View>
        <AppText variant="caption" tone="muted">
          Tap to see how this is calculated
        </AppText>
      </Card>

      <View style={styles.buttonRow}>
        <Button label="Expense" icon="−" style={styles.flex} onPress={() => router.push('/expense')} />
        <Button label="Money" icon="+" variant="secondary" style={styles.flex} onPress={() => router.push('/income')} />
        <Button label="What if?" variant="secondary" style={styles.flex} onPress={() => router.push('/what-if')} />
      </View>

      <View style={styles.stats}>
        <Stat
          value={status.incomeDue ? 'Now' : String(status.daysUntilIncome)}
          label={status.incomeDue ? 'income expected' : status.daysUntilIncome === 1 ? 'day until income' : 'days until income'}
          onPress={() => router.push('/payday')}
        />
        <Stat
          value={formatAmount(status.balance, currency, { whole: true })}
          label={`${currency.label} in account`}
          onPress={() => router.push('/balance')}
        />
        <Stat
          value={status.hasRoutines ? formatAmount(status.expectedToday, currency, { whole: true }) : '—'}
          label="normal day"
          onPress={() => router.push(status.hasRoutines ? '/plan' : '/routine')}
        />
      </View>

      {billsSoon.length > 0 ? (
        <>
          <SectionTitle title="Bills coming up" />
          <Card>
            {billsSoon.map((occurrence) => (
              <ListRow
                key={`${occurrence.bill.id}-${occurrence.dueDate}`}
                emoji={occurrence.bill.emoji}
                title={occurrence.bill.name}
                subtitle={
                  occurrence.dueDate < today
                    ? `Overdue since ${formatShortDate(occurrence.dueDate)} · still protected`
                    : `Due ${formatDaysFromNow(occurrence.dueDate, today)} · already protected`
                }
                value={formatMoney(occurrence.bill.amount, currency)}
                onPress={() =>
                  router.push({
                    pathname: '/pay-bill',
                    params: { billId: occurrence.bill.id, dueDate: occurrence.dueDate },
                  })
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {routine && routine.items.length > 0 ? (
        <>
          <SectionTitle title={`${routine.emoji} Your ${routine.name.toLowerCase()}`} />
          <Card>
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
        </>
      ) : data.routines.length === 0 ? (
        <Card onPress={() => router.push('/routine')}>
          <AppText variant="bodyStrong">☀️ What does a normal day cost you?</AppText>
          <AppText tone="secondary">
            Add your routine (coffee, lunch, transport…) to compare your plan with real life and log expenses in one
            tap.
          </AppText>
        </Card>
      ) : null}

      <SectionTitle
        title="Logged today"
        action={todays.length > 0 ? { label: 'All activity', onPress: () => router.push('/activity') } : undefined}
      />
      <Card>
        {todays.length === 0 ? (
          <AppText tone="secondary">
            Nothing logged yet today. Add expenses as they happen. It only takes a few seconds.
          </AppText>
        ) : (
          todays.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} bills={data.bills} currency={currency} />
          ))
        )}
      </Card>

      {showPastSpendingPrompt ? (
        <Card onPress={() => router.push({ pathname: '/expense', params: { past: '1' } })}>
          <AppText variant="bodyStrong">🧾 Spent money earlier this month?</AppText>
          <AppText tone="secondary">
            Add it to see where your money went. It won't change your balance or your safe pace.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.stat,
        { backgroundColor: palette.surface, borderColor: palette.border },
        pressed && { opacity: 0.8 },
      ]}>
      <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: Space.md, paddingVertical: Space.xl },
  heroNumber: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm },
  progress: { gap: Space.sm },
  advice: { gap: Space.xs },
  buttonRow: { flexDirection: 'row', gap: Space.sm },
  stats: { flexDirection: 'row', gap: Space.sm },
  stat: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.md,
    gap: 2,
  },
  statValue: { fontVariant: ['tabular-nums'] },
});

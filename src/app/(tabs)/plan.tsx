import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { nextDueAfter } from '@/domain/bills';
import { FREQUENCY_LABELS } from '@/domain/cycle';
import { formatDaysFromNow, formatShortDate, WEEKDAY_SHORT } from '@/domain/dates';
import { cycleBillOccurrences, savingsMovedInCycle } from '@/domain/derive';
import { formatMoney, type Minor } from '@/domain/money';
import { routineTotal } from '@/domain/routines';
import type { Bill } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { AppText, Button, Card, ListRow, MoneyLine, Screen, SectionTitle } from '@/ui/components';
import { Space } from '@/ui/theme';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function PlanScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const resetAll = useApp((state) => state.resetAll);

  if (!financial) return null;
  const { data, today, status, currency } = financial;
  const { cycle, settings, bills, routines, transactions } = data;
  const m = (value: Minor) => formatMoney(value, currency);

  const occurrences = cycleBillOccurrences(data, today);
  const otherBills = bills.filter(
    (bill) => !bill.archived && !occurrences.some((occurrence) => occurrence.bill.id === bill.id),
  );
  const moved = savingsMovedInCycle(cycle, transactions);
  const laterBillSubtitle = (bill: Bill) => {
    const next = nextDueAfter(bill, cycle.nextIncomeDate);
    return next ? `Next due ${formatShortDate(next)}, after your income · not protected yet` : 'No upcoming due date';
  };

  const confirmReset = () =>
    Alert.alert('Erase all data?', 'This removes your plan, bills, routines and history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: resetAll },
    ]);

  return (
    <Screen>
      <View>
        <AppText variant="title">Plan</AppText>
        <AppText tone="secondary">Everything that shapes your safe pace.</AppText>
      </View>

      <SectionTitle title="Next income" />
      <Card>
        <ListRow
          emoji="💼"
          title={`${cycle.incomeLabel} · ${formatShortDate(cycle.nextIncomeDate)}`}
          subtitle={[
            FREQUENCY_LABELS[cycle.frequency],
            cycle.expectedIncome ? `about ${m(cycle.expectedIncome)}` : null,
            formatDaysFromNow(cycle.nextIncomeDate, today),
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push('/payday')}
        />
        <Button
          label="My income arrived"
          variant="secondary"
          compact
          onPress={() => router.push({ pathname: '/income', params: { cycleIncome: '1' } })}
        />
      </Card>

      <SectionTitle title="Balance" />
      <Card>
        <ListRow
          emoji="🏦"
          title="In your account"
          subtitle="Tap to match what your bank or wallet shows"
          value={m(status.balance)}
          onPress={() => router.push('/balance')}
        />
      </Card>

      <SectionTitle title="Bills this cycle" action={{ label: 'Add', onPress: () => router.push('/bill') }} />
      <Card>
        {occurrences.length === 0 ? (
          <AppText tone="secondary">No bills due before your next income.</AppText>
        ) : (
          occurrences.map((occurrence) => (
            <ListRow
              key={`${occurrence.bill.id}-${occurrence.dueDate}`}
              emoji={occurrence.paid ? '✅' : occurrence.bill.emoji}
              title={occurrence.bill.name}
              subtitle={
                occurrence.paid
                  ? `Paid ${m(occurrence.paidAmount)} · was due ${formatShortDate(occurrence.dueDate)}`
                  : occurrence.dueDate < today
                    ? `⚠️ Overdue since ${formatShortDate(occurrence.dueDate)} · protected`
                    : `${occurrence.bill.recurring || occurrence.bill.dueDate ? `Due ${formatShortDate(occurrence.dueDate)}` : 'Before your next income'} · protected`
              }
              value={occurrence.paid ? undefined : m(occurrence.bill.amount)}
              onPress={() => router.push({ pathname: '/bill', params: { id: occurrence.bill.id } })}
              right={
                occurrence.paid ? undefined : (
                  <Button
                    label="Pay"
                    compact
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/pay-bill',
                        params: { billId: occurrence.bill.id, dueDate: occurrence.dueDate },
                      })
                    }
                  />
                )
              }
            />
          ))
        )}
        {otherBills.map((bill) => (
          <ListRow
            key={bill.id}
            emoji={bill.emoji}
            title={bill.name}
            subtitle={laterBillSubtitle(bill)}
            value={m(bill.amount)}
            onPress={() => router.push({ pathname: '/bill', params: { id: bill.id } })}
          />
        ))}
        {occurrences.length > 0 ? (
          <AppText variant="caption" tone="muted">
            Unpaid bills stay protected until you tap Pay. Tap a bill to edit it.
          </AppText>
        ) : null}
      </Card>

      <SectionTitle title="Protections" action={{ label: 'Edit', onPress: () => router.push('/protections') }} />
      <Card onPress={() => router.push('/protections')}>
        <MoneyLine
          label="🐷 Savings this cycle"
          value={moved > 0 ? `${m(cycle.savingsTarget)} (${m(moved)} moved)` : m(cycle.savingsTarget)}
        />
        <MoneyLine label="🛟 Minimum balance" value={m(settings.minimumBalance)} />
        <MoneyLine
          label="🎁 Unexpected income"
          value={
            settings.unexpectedIncomeSavePercent === 0
              ? 'Use it'
              : `Save ${settings.unexpectedIncomeSavePercent}%`
          }
        />
        <MoneyLine label="🔄 Unspent money" value="Spreads over coming days" />
      </Card>

      <SectionTitle title="Routines" action={{ label: 'Add', onPress: () => router.push('/routine') }} />
      <Card>
        {routines.length === 0 ? (
          <AppText tone="secondary">
            Routines describe a normal day. They're expectations, never automatic expenses.
          </AppText>
        ) : (
          routines.map((routine) => (
            <ListRow
              key={routine.id}
              emoji={routine.emoji}
              title={routine.name}
              subtitle={
                routine.weekdays.length
                  ? WEEK_ORDER.filter((day) => routine.weekdays.includes(day))
                      .map((day) => WEEKDAY_SHORT[day])
                      .join(' ')
                  : 'No days assigned'
              }
              value={m(routineTotal(routine))}
              onPress={() => router.push({ pathname: '/routine', params: { id: routine.id } })}
            />
          ))
        )}
      </Card>

      <SectionTitle title="App" />
      <Card style={{ gap: Space.md }}>
        <MoneyLine label="Currency" value={currency.code} />
        <AppText variant="caption" tone="muted">
          Your data stays on this device. Nothing is sent anywhere.
        </AppText>
        <Button label="Erase all data" variant="danger" compact onPress={confirmReset} />
      </Card>
    </Screen>
  );
}

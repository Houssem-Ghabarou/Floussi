import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { nextDueAfter } from '@/domain/bills';
import { FREQUENCY_LABELS } from '@/domain/cycle';
import { formatDaysFromNow, formatShortDate } from '@/domain/dates';
import { cycleBillOccurrences, savingsMovedInCycle } from '@/domain/derive';
import { formatMoney, type Minor } from '@/domain/money';
import type { Bill } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { TabScreen } from '@/ui/app-header';
import {
  AppText,
  Button,
  Card,
  Divider,
  IconCircle,
  ListRow,
  MoneyLine,
  PageIntro,
  SectionTitle,
} from '@/ui/components';
import { confirmDestructive } from '@/ui/dialog-store';
import { Space, usePalette } from '@/ui/theme';
import { useBackupActions } from '@/ui/use-backup';

const NORMAL_DAY_SOURCE = {
  routines: 'From your routines',
  custom: 'Your estimate',
  default: 'Currency default · tap to set yours',
} as const;

export default function RulesScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();
  const resetAll = useApp((state) => state.resetAll);
  const { share, restore } = useBackupActions();

  if (!financial) return null;
  const { data, today, status, currency } = financial;
  const { cycle, settings, bills, transactions } = data;
  const m = (value: Minor) => formatMoney(value, currency);

  const occurrences = cycleBillOccurrences(data, today);
  const otherBills = bills.filter(
    (bill) => !bill.archived && !occurrences.some((occurrence) => occurrence.bill.id === bill.id),
  );
  const unpaidCount = occurrences.filter((occurrence) => !occurrence.paid).length;
  const moved = savingsMovedInCycle(cycle, transactions);
  const laterBillSubtitle = (bill: Bill) => {
    const next = nextDueAfter(bill, cycle.nextIncomeDate);
    return next ? `Next due ${formatShortDate(next)}, after your income · not protected yet` : 'No upcoming due date';
  };

  const confirmReset = () =>
    confirmDestructive({
      icon: 'warning',
      title: 'Erase all data?',
      message:
        'This removes your plan, bills, routines and history from this device. It cannot be undone, so export a backup first if you want to keep them.',
      confirmLabel: 'Erase everything',
      cancelLabel: 'Cancel',
      onConfirm: resetAll,
    });

  return (
    <TabScreen section="Rules">
      <PageIntro title="Plan rules" subtitle="Everything that shapes your safe pace." />

      <SectionTitle title="Next income" />
      <Card>
        <ListRow
          icon="event"
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
          icon="payments"
          variant="secondary"
          compact
          onPress={() => router.push({ pathname: '/income', params: { cycleIncome: '1' } })}
        />
      </Card>

      <SectionTitle title="Balance" />
      <Card>
        <ListRow
          icon="wallet"
          title="In your account"
          subtitle="Tap to match what your bank or wallet shows"
          value={m(status.balance)}
          onPress={() => router.push('/balance')}
        />
      </Card>

      <SectionTitle
        title="Bills this cycle"
        count={unpaidCount}
        action={{ label: 'Add', onPress: () => router.push('/bill') }}
      />
      <Card style={styles.listCard}>
        {occurrences.length === 0 && otherBills.length === 0 ? (
          <AppText variant="small" tone="secondary">
            No bills due before your next income.
          </AppText>
        ) : null}
        {occurrences.map((occurrence, index) => (
          <Fragment key={`${occurrence.bill.id}-${occurrence.dueDate}`}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              emoji={occurrence.paid ? undefined : occurrence.bill.emoji}
              icon={occurrence.paid ? 'checkCircle' : undefined}
              tileColor={
                occurrence.paid
                  ? palette.comfortableSoft
                  : occurrence.dueDate < today
                    ? palette.atRiskSoft
                    : undefined
              }
              title={occurrence.bill.name}
              subtitle={
                occurrence.paid
                  ? `Paid ${m(occurrence.paidAmount)} · was due ${formatShortDate(occurrence.dueDate)}`
                  : occurrence.dueDate < today
                    ? `Overdue since ${formatShortDate(occurrence.dueDate)} · protected`
                    : `${occurrence.bill.recurring || occurrence.bill.dueDate ? `Due ${formatShortDate(occurrence.dueDate)}` : 'Before your next income'} · protected`
              }
              value={occurrence.paid ? undefined : m(occurrence.bill.amount)}
              onPress={() => router.push({ pathname: '/bill', params: { id: occurrence.bill.id } })}
              right={
                occurrence.paid ? undefined : (
                  <Button
                    label="Pay"
                    compact
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
          </Fragment>
        ))}
        {otherBills.map((bill, index) => (
          <Fragment key={bill.id}>
            {occurrences.length + index > 0 ? <Divider /> : null}
            <ListRow
              emoji={bill.emoji}
              title={bill.name}
              subtitle={laterBillSubtitle(bill)}
              value={m(bill.amount)}
              onPress={() => router.push({ pathname: '/bill', params: { id: bill.id } })}
            />
          </Fragment>
        ))}
        {occurrences.length > 0 ? (
          <AppText variant="caption" tone="muted">
            Unpaid bills stay protected until you tap Pay. Tap a bill to edit it.
          </AppText>
        ) : null}
      </Card>

      <SectionTitle title="Protections" action={{ label: 'Edit', onPress: () => router.push('/protections') }} />
      <Card style={styles.listCard} onPress={() => router.push('/protections')}>
        <ListRow
          icon="savings"
          title="Savings this cycle"
          subtitle={moved > 0 ? `${m(moved)} already moved` : 'Kept aside until you move it'}
          value={m(cycle.savingsTarget)}
        />
        <Divider />
        <ListRow
          icon="shield"
          title="Minimum balance"
          subtitle="A cushion you never go below"
          value={m(settings.minimumBalance)}
        />
        <Divider />
        <ListRow
          icon="routine"
          title="Normal day"
          subtitle={NORMAL_DAY_SOURCE[status.normalDaySource]}
          value={formatMoney(status.normalDay, currency, { whole: true })}
        />
        <Divider />
        <ListRow
          icon="bolt"
          title="Unexpected income"
          subtitle="Money beyond your regular income"
          value={
            settings.unexpectedIncomeSavePercent === 0 ? 'Use it' : `Save ${settings.unexpectedIncomeSavePercent}%`
          }
        />
        <Divider />
        <ListRow icon="restart" title="Unspent money" subtitle="Spreads over the coming days" />
      </Card>

      <SectionTitle title="Backup" />
      <Card>
        <View style={styles.inline}>
          <IconCircle icon="backup" size={40} color={palette.brand} />
          <AppText variant="small" tone="secondary" style={styles.flex}>
            Your data lives only on this phone. Export a backup regularly and keep it somewhere safe (Drive, email…).
          </AppText>
        </View>
        <View style={styles.buttonRow}>
          <Button label="Export" icon="upload" variant="secondary" compact style={styles.flex} onPress={share} />
          <Button label="Restore" icon="download" variant="secondary" compact style={styles.flex} onPress={restore} />
        </View>
      </Card>

      <SectionTitle title="App" />
      <Card>
        <MoneyLine label="Currency" value={currency.code} />
        <AppText variant="caption" tone="muted">
          Your data stays on this device. Nothing is sent anywhere.
        </AppText>
        <Button label="Erase all data" variant="danger" compact onPress={confirmReset} />
      </Card>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  buttonRow: { flexDirection: 'row', gap: Space.sm },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
});

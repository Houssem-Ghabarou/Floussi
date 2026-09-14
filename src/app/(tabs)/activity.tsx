import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatRelativeDay, type LocalDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types';
import { useFinancial } from '@/store/use-financial';
import { AppText, Card, Screen, Segmented } from '@/ui/components';
import { Space } from '@/ui/theme';
import { TransactionRow } from '@/ui/transaction-row';

type Filter = 'all' | 'spending' | 'income';

export default function ActivityScreen() {
  const financial = useFinancial();
  const [filter, setFilter] = useState<Filter>('all');

  if (!financial) return null;
  const { data, today, currency } = financial;

  const visible = data.transactions
    .filter((t) => filter === 'all' || (filter === 'income' ? t.amount > 0 : t.amount < 0))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const groups: { date: LocalDate; items: Transaction[]; spent: number }[] = [];
  for (const transaction of visible) {
    let group = groups.at(-1);
    if (!group || group.date !== transaction.date) {
      group = { date: transaction.date, items: [], spent: 0 };
      groups.push(group);
    }
    group.items.push(transaction);
    if (transaction.kind === 'expense') group.spent -= transaction.amount;
  }

  return (
    <Screen>
      <AppText variant="title">Activity</AppText>
      <Segmented
        options={[
          { value: 'all', label: 'All' },
          { value: 'spending', label: 'Money out' },
          { value: 'income', label: 'Money in' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {groups.length === 0 ? (
        <Card>
          <AppText tone="secondary">
            Nothing here yet. Your expenses, income and bill payments will show up here.
          </AppText>
        </Card>
      ) : (
        groups.map((group) => (
          <View key={group.date} style={styles.group}>
            <View style={styles.groupHeader}>
              <AppText variant="label" tone="secondary">
                {formatRelativeDay(group.date, today)}
              </AppText>
              {group.spent > 0 ? (
                <AppText variant="caption" tone="muted">
                  Spent {formatMoney(group.spent, currency)}
                </AppText>
              ) : null}
            </View>
            <Card>
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  bills={data.bills}
                  currency={currency}
                />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Space.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

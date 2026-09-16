import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatRelativeDay, type LocalDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import { AppText, Card, Divider, Segmented, SheetScreen } from '@/ui/components';
import { Space } from '@/ui/theme';
import { TransactionRow } from '@/ui/transaction-row';

type Filter = 'all' | 'spending' | 'income';

export default function ActivityScreen() {
  const financial = useFinancial();
  const [filter, setFilter] = useState<Filter>('all');

  if (!financial) return null;
  const { data, today, currency } = financial;

  const visible = data.transactions
    .filter((transaction) => filter === 'all' || (filter === 'income' ? transaction.amount > 0 : transaction.amount < 0))
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
    <SheetScreen title={t('activity.title')} closeLabel={t('common.close')}>
      <Segmented
        options={[
          { value: 'all', label: t('activity.all') },
          { value: 'spending', label: t('activity.out') },
          { value: 'income', label: t('activity.in') },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {groups.length === 0 ? (
        <Card>
          <AppText variant="small" tone="secondary">
            {t('activity.empty')}
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
                  {t('activity.spent', { amount: formatMoney(group.spent, currency) })}
                </AppText>
              ) : null}
            </View>
            <Card style={styles.listCard}>
              {group.items.map((transaction, index) => (
                <Fragment key={transaction.id}>
                  {index > 0 ? <Divider /> : null}
                  <TransactionRow transaction={transaction} bills={data.bills} currency={currency} />
                </Fragment>
              ))}
            </Card>
          </View>
        ))
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Space.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
});

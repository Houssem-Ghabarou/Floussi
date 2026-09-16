import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDays, formatLongDate, weekday, type LocalDate } from '@/domain/dates';
import { transactionsOn } from '@/domain/history';
import { formatMoney, type Minor } from '@/domain/money';
import { routineForWeekday, routineTotal } from '@/domain/routines';
import { t } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import { AppText, Button, Card, Divider, MoneyLine, SheetScreen } from '@/ui/components';
import { Space } from '@/ui/theme';
import { TransactionRow } from '@/ui/transaction-row';

export default function DayScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const financial = useFinancial();
  const [date, setDate] = useState<LocalDate>(params.date ?? financial?.today ?? '');

  if (!financial) return null;
  const { data, today, currency } = financial;
  const m = (value: Minor) => formatMoney(value, currency);

  const entries = transactionsOn(data.transactions, date);
  const moneyIn = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const moneyOut = entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum - entry.amount, 0);
  // Routines describe everyday spending, so bills and transfers stay out of the comparison.
  const spent = entries
    .filter((entry) => entry.kind === 'expense')
    .reduce((sum, entry) => sum - entry.amount, 0);

  const routine = routineForWeekday(data.routines, weekday(date));
  const expected = routine ? routineTotal(routine) : null;
  const difference = expected === null ? 0 : spent - expected;

  return (
    <SheetScreen title={formatLongDate(date)} closeLabel={t('common.close')}>
      <View style={styles.nav}>
        <Button
          label={t('day.previous')}
          icon="chevronLeft"
          variant="secondary"
          compact
          style={styles.flex}
          onPress={() => setDate(addDays(date, -1))}
        />
        <Button
          label={t('day.next')}
          iconRight="chevronRight"
          variant="secondary"
          compact
          style={styles.flex}
          disabled={date >= today}
          onPress={() => setDate(addDays(date, 1))}
        />
      </View>

      <Card>
        <MoneyLine label={t('day.out')} value={m(moneyOut)} strong />
        {moneyIn > 0 ? <MoneyLine label={t('day.in')} value={m(moneyIn)} /> : null}
        {expected !== null ? (
          <>
            <Divider />
            <MoneyLine label={`${routine?.emoji ?? ''} ${t('day.routineExpected')}`.trim()} value={m(expected)} />
            <AppText variant="caption" tone="muted">
              {difference === 0
                ? t('month.onRoutine')
                : difference > 0
                  ? t('day.overRoutine', { amount: m(difference) })
                  : t('day.underRoutine', { amount: m(-difference) })}
            </AppText>
          </>
        ) : (
          <AppText variant="caption" tone="muted">
            {t('day.noRoutine')}
          </AppText>
        )}
      </Card>

      {entries.length === 0 ? (
        <Card>
          <AppText variant="small" tone="secondary">
            {t('day.nothing')}
          </AppText>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {entries.map((transaction, index) => (
            <Fragment key={transaction.id}>
              {index > 0 ? <Divider /> : null}
              <TransactionRow transaction={transaction} bills={data.bills} currency={currency} />
            </Fragment>
          ))}
        </Card>
      )}

      <Button
        label={t('nav.addExpense')}
        icon="add"
        variant="secondary"
        onPress={() => router.push('/expense')}
      />
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: 'row', gap: Space.sm },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
});

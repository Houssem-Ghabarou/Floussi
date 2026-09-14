import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { describeTransaction, expenseCategory, incomeSource } from '@/domain/categories';
import { formatAmount, formatMoney, type CurrencyInfo } from '@/domain/money';
import type { Bill, Transaction } from '@/domain/types';
import { useApp } from '@/store/app-store';

import { ListRow } from './components';
import { usePalette } from './theme';
import { showToast } from './toast';

export function TransactionRow({
  transaction,
  bills,
  currency,
}: {
  transaction: Transaction;
  bills: Bill[];
  currency: CurrencyInfo;
}) {
  const router = useRouter();
  const palette = usePalette();
  const deleteTransaction = useApp((state) => state.deleteTransaction);
  const restoreTransaction = useApp((state) => state.restoreTransaction);
  const { emoji, title } = describeTransaction(transaction, bills);

  let subtitle: string | undefined;
  if (!transaction.countsToBalance) subtitle = 'Before you started tracking · history only';
  else if (transaction.note && transaction.kind === 'expense') subtitle = expenseCategory(transaction.category).label;
  else if (transaction.note && transaction.kind === 'income') subtitle = incomeSource(transaction.category).label;

  const onPress = () => {
    if (transaction.kind === 'expense') {
      router.push({ pathname: '/expense', params: { id: transaction.id } });
    } else if (transaction.kind === 'income') {
      router.push({ pathname: '/income', params: { id: transaction.id } });
    } else {
      Alert.alert(title, formatMoney(transaction.amount, currency, { signed: true }), [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const removed = deleteTransaction(transaction.id);
            if (removed) showToast('Deleted', { label: 'Undo', onPress: () => restoreTransaction(removed) });
          },
        },
      ]);
    }
  };

  return (
    <ListRow
      emoji={emoji}
      title={title}
      subtitle={subtitle}
      value={formatAmount(transaction.amount, currency, { signed: true })}
      valueColor={transaction.amount > 0 ? palette.income : undefined}
      onPress={onPress}
    />
  );
}

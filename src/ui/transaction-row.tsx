import { useRouter } from 'expo-router';

import { describeTransaction, expenseCategory, incomeSource } from '@/domain/categories';
import { formatTime } from '@/domain/dates';
import { formatAmount, formatMoney, type CurrencyInfo } from '@/domain/money';
import type { Bill, Transaction } from '@/domain/types';
import { useApp } from '@/store/app-store';

import { ListRow } from './components';
import { confirmDestructive } from './dialog-store';
import { usePalette } from './theme';
import { showToast } from './toast';

const KIND_CAPTION: Partial<Record<Transaction['kind'], string>> = {
  bill_payment: 'Bill',
  savings_transfer: 'Savings',
  adjustment: 'Correction',
};

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

  let subtitle: string;
  if (!transaction.countsToBalance) {
    subtitle = 'Before tracking · history only';
  } else {
    const time = transaction.createdAt > 0 ? formatTime(transaction.createdAt) : null;
    const label =
      transaction.kind === 'expense'
        ? expenseCategory(transaction.category).label
        : transaction.kind === 'income'
          ? incomeSource(transaction.category).label
          : null;
    subtitle = [time, label].filter(Boolean).join(' · ');
  }

  const tileColor =
    transaction.kind === 'expense'
      ? `${palette.accentSoft}99`
      : transaction.kind === 'income'
        ? palette.comfortableSoft
        : palette.surfaceMuted;

  const onPress = () => {
    if (transaction.kind === 'expense') {
      router.push({ pathname: '/expense', params: { id: transaction.id } });
    } else if (transaction.kind === 'income') {
      router.push({ pathname: '/income', params: { id: transaction.id } });
    } else {
      confirmDestructive({
        title: `Delete “${title}”?`,
        message: `${formatMoney(transaction.amount, currency, { signed: true })} will be removed from your history. You can undo right after.`,
        onConfirm: () => {
          const removed = deleteTransaction(transaction.id);
          if (removed) showToast('Deleted', { label: 'Undo', onPress: () => restoreTransaction(removed) });
        },
      });
    }
  };

  return (
    <ListRow
      emoji={emoji}
      tileColor={tileColor}
      title={title}
      subtitle={subtitle || undefined}
      value={`${formatAmount(transaction.amount, currency, { signed: true })} ${currency.label}`}
      valueColor={transaction.amount > 0 ? palette.income : undefined}
      valueCaption={KIND_CAPTION[transaction.kind]}
      onPress={onPress}
    />
  );
}

import { useRouter } from 'expo-router';

import { describeTransaction, expenseCategory, incomeSource } from '@/domain/categories';
import { formatTime } from '@/domain/dates';
import { formatAmount, formatMoney, type CurrencyInfo } from '@/domain/money';
import type { Bill, Transaction } from '@/domain/types';
import { t, type TranslationKey } from '@/i18n';
import { useApp } from '@/store/app-store';

import { ListRow } from './components';
import { confirmDestructive } from './dialog-store';
import { usePalette } from './theme';
import { showToast } from './toast';

const KIND_TAG: Partial<Record<Transaction['kind'], TranslationKey>> = {
  bill_payment: 'transaction.tag.bill',
  savings_transfer: 'transaction.tag.savings',
  adjustment: 'transaction.tag.correction',
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
    subtitle = t('transaction.beforeTracking');
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

  const tag = KIND_TAG[transaction.kind];
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
        title: t('transaction.deleteTitle', { title }),
        message: t('transaction.deleteMessage', {
          amount: formatMoney(transaction.amount, currency, { signed: true }),
        }),
        onConfirm: () => {
          const removed = deleteTransaction(transaction.id);
          if (removed) {
            showToast(t('transaction.deleted'), {
              label: t('common.undo'),
              onPress: () => restoreTransaction(removed),
            });
          }
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
      valueCaption={tag ? t(tag) : undefined}
      onPress={onPress}
    />
  );
}

import type { Bill, Transaction } from './types';

export interface CategoryInfo {
  id: string;
  label: string;
  emoji: string;
}

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  { id: 'food', label: 'Food', emoji: '🍔' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'fun', label: 'Fun', emoji: '🎮' },
  { id: 'health', label: 'Health', emoji: '💊' },
  { id: 'gym', label: 'Gym', emoji: '🏋️' },
  { id: 'household', label: 'Household', emoji: '🏠' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export const INCOME_SOURCES: CategoryInfo[] = [
  { id: 'salary', label: 'Salary', emoji: '💼' },
  { id: 'freelance', label: 'Freelance', emoji: '💻' },
  { id: 'side_job', label: 'Side job', emoji: '🧰' },
  { id: 'sold', label: 'Sold something', emoji: '🏷️' },
  { id: 'gift', label: 'Gift', emoji: '🎁' },
  { id: 'bonus', label: 'Bonus', emoji: '🎉' },
  { id: 'paid_back', label: 'Paid back', emoji: '↩️' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export const BILL_PRESETS: CategoryInfo[] = [
  { id: 'rent', label: 'Rent', emoji: '🏠' },
  { id: 'electricity', label: 'Electricity', emoji: '💡' },
  { id: 'water', label: 'Water', emoji: '💧' },
  { id: 'internet', label: 'Internet', emoji: '🌐' },
  { id: 'phone', label: 'Phone', emoji: '📱' },
  { id: 'subscriptions', label: 'Subscriptions', emoji: '📺' },
  { id: 'loan', label: 'Loan', emoji: '🏦' },
  { id: 'school', label: 'School', emoji: '🎒' },
  { id: 'other', label: 'Other', emoji: '🧾' },
];

export const BILLS_CATEGORY: CategoryInfo = { id: 'bills', label: 'Bills', emoji: '🧾' };

const FALLBACK: CategoryInfo = { id: 'other', label: 'Other', emoji: '✨' };

export function expenseCategory(id: string | null): CategoryInfo {
  return EXPENSE_CATEGORIES.find((category) => category.id === id) ?? FALLBACK;
}

export function incomeSource(id: string | null): CategoryInfo {
  return INCOME_SOURCES.find((source) => source.id === id) ?? FALLBACK;
}

/** Emoji and title used to show a transaction in lists. */
export function describeTransaction(
  transaction: Transaction,
  bills: Bill[],
): { emoji: string; title: string } {
  switch (transaction.kind) {
    case 'expense': {
      const category = expenseCategory(transaction.category);
      return { emoji: category.emoji, title: transaction.note || category.label };
    }
    case 'income': {
      const source = incomeSource(transaction.category);
      return { emoji: source.emoji, title: transaction.note || source.label };
    }
    case 'bill_payment': {
      const bill = bills.find((candidate) => candidate.id === transaction.billId);
      return { emoji: bill?.emoji ?? BILLS_CATEGORY.emoji, title: bill?.name ?? 'Bill payment' };
    }
    case 'savings_transfer':
      return { emoji: '🐷', title: transaction.note || 'Moved to savings' };
    case 'adjustment':
      return {
        emoji: '⚖️',
        title: transaction.amount < 0 ? 'Untracked spending' : 'Balance correction',
      };
  }
}

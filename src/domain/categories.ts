/** Categories keep stable ids; their names come from the chosen language. */
import { t, type TranslationKey } from '@/i18n';

import type { Bill, Transaction } from './types';

export interface CategoryInfo {
  id: string;
  label: string;
  emoji: string;
}

const EXPENSE_EMOJI: Record<string, string> = {
  food: '🍔',
  coffee: '☕',
  groceries: '🛒',
  transport: '🚕',
  shopping: '🛍️',
  fun: '🎮',
  health: '💊',
  gym: '🏋️',
  household: '🏠',
  other: '✨',
};

const INCOME_EMOJI: Record<string, string> = {
  salary: '💼',
  freelance: '💻',
  side_job: '🧰',
  sold: '🏷️',
  gift: '🎁',
  bonus: '🎉',
  paid_back: '↩️',
  other: '✨',
};

const BILL_EMOJI: Record<string, string> = {
  rent: '🏠',
  electricity: '💡',
  water: '💧',
  internet: '🌐',
  phone: '📱',
  subscriptions: '📺',
  loan: '🏦',
  school: '🎒',
  other: '🧾',
};

const named = (id: string, emoji: string, prefix: string): CategoryInfo => ({
  id,
  emoji,
  label: t(`${prefix}.${id}` as TranslationKey),
});

const list = (emojis: Record<string, string>, prefix: string): CategoryInfo[] =>
  Object.entries(emojis).map(([id, emoji]) => named(id, emoji, prefix));

export function expenseCategories(): CategoryInfo[] {
  return list(EXPENSE_EMOJI, 'category');
}

export function incomeSources(): CategoryInfo[] {
  return list(INCOME_EMOJI, 'income');
}

export function billPresets(): CategoryInfo[] {
  return list(BILL_EMOJI, 'bill');
}

export function billsCategory(): CategoryInfo {
  return { id: 'bills', emoji: '🧾', label: t('category.bills') };
}

const fallback = (prefix: string): CategoryInfo => named('other', '✨', prefix);

export function expenseCategory(id: string | null): CategoryInfo {
  return id && EXPENSE_EMOJI[id] ? named(id, EXPENSE_EMOJI[id], 'category') : fallback('category');
}

export function incomeSource(id: string | null): CategoryInfo {
  return id && INCOME_EMOJI[id] ? named(id, INCOME_EMOJI[id], 'income') : fallback('income');
}

/** Emoji and title used to show a transaction in lists. */
export function describeTransaction(transaction: Transaction, bills: Bill[]): { emoji: string; title: string } {
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
      return { emoji: bill?.emoji ?? '🧾', title: bill?.name ?? t('transaction.billPayment') };
    }
    case 'savings_transfer':
      return { emoji: '🐷', title: transaction.note || t('transaction.movedToSavings') };
    case 'adjustment':
      return {
        emoji: '⚖️',
        title: transaction.amount < 0 ? t('transaction.untrackedSpending') : t('transaction.balanceCorrection'),
      };
  }
}

import { t, type TranslationKey } from '@/i18n';

import { addDays, addMonths, type LocalDate } from './dates';
import type { Cycle, IncomeFrequency, Transaction } from './types';

/** The moment that separates two cycles. */
export interface CycleBoundary {
  date: LocalDate;
  /** On `date`, transactions recorded before this timestamp fall before the boundary. Null: none do. */
  at: number | null;
}

export function cycleStart(cycle: Cycle): CycleBoundary {
  return { date: cycle.startDate, at: cycle.startedAt };
}

export function isBeforeBoundary(transaction: Pick<Transaction, 'date' | 'createdAt'>, boundary: CycleBoundary): boolean {
  return (
    transaction.date < boundary.date ||
    (transaction.date === boundary.date && boundary.at !== null && transaction.createdAt < boundary.at)
  );
}

export const FREQUENCIES: IncomeFrequency[] = ['monthly', 'biweekly', 'weekly', 'irregular'];

export function frequencyLabel(frequency: IncomeFrequency): string {
  return t(`frequency.${frequency}` as TranslationKey);
}

/** Suggests the income date after `previous`, always later than `today`. */
export function suggestNextIncomeDate(
  previous: LocalDate,
  frequency: IncomeFrequency,
  today: LocalDate,
): LocalDate {
  if (frequency === 'irregular') return addDays(today, 30);

  let next = previous;
  for (let step = 1; next <= today && step < 120; step++) {
    next =
      frequency === 'monthly'
        ? addMonths(previous, step)
        : addDays(previous, (frequency === 'biweekly' ? 14 : 7) * step);
  }
  return next;
}

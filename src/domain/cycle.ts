import { addDays, addMonths, type LocalDate } from './dates';
import type { IncomeFrequency } from './types';

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  monthly: 'Every month',
  biweekly: 'Every 2 weeks',
  weekly: 'Every week',
  irregular: 'No fixed income',
};

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

/** "Where did my money go?" — cycle summaries and actual vs expected. */
import { BILLS_CATEGORY, expenseCategory, type CategoryInfo } from './categories';
import { eachDay, maxDate, weekday, type LocalDate } from './dates';
import type { Minor } from './money';
import { routineForWeekday } from './routines';
import type { Routine, Settings, Transaction } from './types';

export interface CategoryInsight {
  category: CategoryInfo;
  /** All spending in the period, including history entered after the fact. */
  actual: Minor;
  /** Spending on tracked days only — comparable with `expected`. */
  trackedActual: Minor;
  expected: Minor;
}

export interface CycleSummary {
  startDate: LocalDate;
  endDateExclusive: LocalDate;
  trackedDays: number;
  startingBalance: Minor;
  endingBalance: Minor;
  income: Minor;
  spending: Minor;
  historicalSpending: Minor;
  billsPaid: Minor;
  savedMoved: Minor;
  adjustments: Minor;
  categories: CategoryInsight[];
  biggest: CategoryInsight | null;
  mostOverRoutine: CategoryInsight | null;
  dailyAverage: Minor;
  expectedDailyAverage: Minor | null;
}

interface SummaryParams {
  settings: Settings;
  transactions: Transaction[];
  routines: Routine[];
  startDate: LocalDate;
  endDateExclusive: LocalDate;
}

export function summarizeCycle({
  settings,
  transactions,
  routines,
  startDate,
  endDateExclusive,
}: SummaryParams): CycleSummary {
  const trackingStart = maxDate(startDate, settings.openingDate);
  const trackedDates = trackingStart < endDateExclusive ? eachDay(trackingStart, endDateExclusive) : [];
  const trackedDays = Math.max(1, trackedDates.length);

  const byCategory = new Map<string, CategoryInsight>();
  const entry = (category: CategoryInfo) => {
    let insight = byCategory.get(category.id);
    if (!insight) {
      insight = { category, actual: 0, trackedActual: 0, expected: 0 };
      byCategory.set(category.id, insight);
    }
    return insight;
  };

  let startingBalance = settings.openingBalance;
  let endingBalance = settings.openingBalance;
  let income = 0;
  let spending = 0;
  let historicalSpending = 0;
  let billsPaid = 0;
  let savedMoved = 0;
  let adjustments = 0;

  for (const t of transactions) {
    if (t.countsToBalance) {
      if (t.date < startDate) startingBalance += t.amount;
      if (t.date < endDateExclusive) endingBalance += t.amount;
    }
    if (t.date < startDate || t.date >= endDateExclusive) continue;

    switch (t.kind) {
      case 'income':
        income += t.amount;
        break;
      case 'expense': {
        const insight = entry(expenseCategory(t.category));
        insight.actual -= t.amount;
        if (t.countsToBalance) {
          spending -= t.amount;
          if (t.date >= trackingStart) insight.trackedActual -= t.amount;
        } else {
          historicalSpending -= t.amount;
        }
        break;
      }
      case 'bill_payment':
        billsPaid -= t.amount;
        entry(BILLS_CATEGORY).actual -= t.amount;
        break;
      case 'savings_transfer':
        savedMoved -= t.amount;
        break;
      case 'adjustment':
        adjustments += t.amount;
        break;
    }
  }

  let expectedTotal = 0;
  for (const date of trackedDates) {
    const routine = routineForWeekday(routines, weekday(date));
    for (const item of routine?.items ?? []) {
      entry(expenseCategory(item.category)).expected += item.amount;
      expectedTotal += item.amount;
    }
  }

  const categories = [...byCategory.values()]
    .filter((insight) => insight.actual > 0 || insight.expected > 0)
    .sort((a, b) => b.actual - a.actual);

  const mostOverRoutine =
    categories
      .filter((insight) => insight.expected > 0 && insight.trackedActual > insight.expected)
      .sort((a, b) => b.trackedActual - b.expected - (a.trackedActual - a.expected))[0] ?? null;

  return {
    startDate,
    endDateExclusive,
    trackedDays,
    startingBalance,
    endingBalance,
    income,
    spending,
    historicalSpending,
    billsPaid,
    savedMoved,
    adjustments,
    categories,
    biggest: categories.find((insight) => insight.category.id !== BILLS_CATEGORY.id && insight.actual > 0) ?? null,
    mostOverRoutine,
    dailyAverage: Math.round(spending / trackedDays),
    expectedDailyAverage: expectedTotal > 0 ? Math.round(expectedTotal / trackedDays) : null,
  };
}

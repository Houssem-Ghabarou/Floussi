/** "Where did my money go?" — cycle summaries and actual vs expected. */
import { billsCategory, expenseCategory, type CategoryInfo } from './categories';
import { isBeforeBoundary, type CycleBoundary } from './cycle';
import { addDays, eachDay, maxDate, weekday } from './dates';
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
  start: CycleBoundary;
  end: CycleBoundary;
  trackedDays: number;
  startingBalance: Minor;
  endingBalance: Minor;
  /**
   * startingBalance + income − spending − billsPaid − savedMoved + adjustments = endingBalance.
   */
  income: Minor;
  spending: Minor;
  /** Spending and bills from before tracking started: shown in categories, never in the balance lines. */
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
  start: CycleBoundary;
  /** Use `{ date: tomorrow, at: null }` to include everything recorded so far. */
  end: CycleBoundary;
}

export function summarizeCycle({ settings, transactions, routines, start, end }: SummaryParams): CycleSummary {
  const trackingStart = maxDate(start.date, settings.openingDate);
  // A boundary part-way through a day still counts that day as tracked.
  const trackedUntil = end.at === null ? end.date : addDays(end.date, 1);
  const trackedDates = trackingStart < trackedUntil ? eachDay(trackingStart, trackedUntil) : [];
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

  // The first cycle also shows what was entered from before tracking started ("where did my money go").
  const includeHistory = start.date <= settings.openingDate;

  for (const t of transactions) {
    const beforeStart = isBeforeBoundary(t, start);
    const beforeEnd = isBeforeBoundary(t, end);
    const inPeriod = !beforeStart && beforeEnd;

    if (!t.countsToBalance) {
      // History only: part of where the money went, never of the balance lines.
      if (!(includeHistory || inPeriod) || !beforeEnd) continue;
      if (t.kind === 'expense') {
        historicalSpending -= t.amount;
        entry(expenseCategory(t.category)).actual -= t.amount;
      } else if (t.kind === 'bill_payment') {
        historicalSpending -= t.amount;
        entry(billsCategory()).actual -= t.amount;
      }
      continue;
    }

    if (beforeStart) startingBalance += t.amount;
    if (beforeEnd) endingBalance += t.amount;
    if (!inPeriod) continue;

    // Every balance-affecting transaction lands in exactly one line, so the summary always adds up.
    switch (t.kind) {
      case 'income':
        income += t.amount;
        break;
      case 'expense': {
        const insight = entry(expenseCategory(t.category));
        insight.actual -= t.amount;
        insight.trackedActual -= t.amount;
        spending -= t.amount;
        break;
      }
      case 'bill_payment':
        billsPaid -= t.amount;
        entry(billsCategory()).actual -= t.amount;
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
    start,
    end,
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
    biggest: categories.find((insight) => insight.category.id !== billsCategory().id && insight.actual > 0) ?? null,
    mostOverRoutine,
    dailyAverage: Math.round(spending / trackedDays),
    expectedDailyAverage: expectedTotal > 0 ? Math.round(expectedTotal / trackedDays) : null,
  };
}

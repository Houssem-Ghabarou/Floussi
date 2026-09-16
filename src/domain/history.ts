/**
 * "What happened on that day?" — filtering and per-day totals for browsing past activity.
 *
 * Spending entered from before tracking started is included: it still happened, even though it never
 * moved the balance. Every function here is pure, so the calendar and the day sheet agree.
 */
import { billsCategory, expenseCategory, type CategoryInfo } from './categories';
import { daysBetween, type LocalDate } from './dates';
import type { Minor } from './money';
import type { Transaction } from './types';

/** Money in, money out, or both. */
export type Direction = 'all' | 'out' | 'in';

export interface HistoryFilter {
  direction: Direction;
  billsOnly: boolean;
}

export const ALL_HISTORY: HistoryFilter = { direction: 'all', billsOnly: false };

export function isFiltered(filter: HistoryFilter): boolean {
  return filter.direction !== 'all' || filter.billsOnly;
}

/**
 * The category a transaction counts under. Bill payments all share the "bills" category; income,
 * savings transfers and corrections have none and are left out of the category breakdown.
 */
function categoryIdOf(transaction: Transaction): string | null {
  if (transaction.kind === 'bill_payment') return billsCategory().id;
  if (transaction.kind === 'expense') return expenseCategory(transaction.category).id;
  return null;
}

export function matchesFilter(transaction: Transaction, filter: HistoryFilter): boolean {
  if (filter.billsOnly && transaction.kind !== 'bill_payment') return false;
  if (filter.direction === 'out' && transaction.amount >= 0) return false;
  if (filter.direction === 'in' && transaction.amount <= 0) return false;
  return true;
}

export interface DayTotals {
  date: LocalDate;
  /** Positive amounts, as a positive number. */
  in: Minor;
  /** Negative amounts, as a positive number. */
  out: Minor;
  count: number;
}

function emptyDay(date: LocalDate): DayTotals {
  return { date, in: 0, out: 0, count: 0 };
}

function add(totals: DayTotals, transaction: Transaction) {
  if (transaction.amount > 0) totals.in += transaction.amount;
  else totals.out -= transaction.amount;
  totals.count++;
}

/** Every day that has at least one matching transaction, keyed by date. */
export function totalsByDay(transactions: Transaction[], filter: HistoryFilter): Map<LocalDate, DayTotals> {
  const days = new Map<LocalDate, DayTotals>();
  for (const transaction of transactions) {
    if (!matchesFilter(transaction, filter)) continue;
    let totals = days.get(transaction.date);
    if (!totals) {
      totals = emptyDay(transaction.date);
      days.set(transaction.date, totals);
    }
    add(totals, transaction);
  }
  return days;
}

export function dayTotals(transactions: Transaction[], date: LocalDate, filter: HistoryFilter): DayTotals {
  const totals = emptyDay(date);
  for (const transaction of transactions) {
    if (transaction.date !== date || !matchesFilter(transaction, filter)) continue;
    add(totals, transaction);
  }
  return totals;
}

/** Everything recorded on one day, newest first — what the day sheet lists. */
export function transactionsOn(transactions: Transaction[], date: LocalDate): Transaction[] {
  return transactions.filter((transaction) => transaction.date === date).sort((a, b) => b.createdAt - a.createdAt);
}

export interface CategoryTotal {
  category: CategoryInfo;
  amount: Minor;
  count: number;
}

export interface RangeSummary {
  from: LocalDate;
  to: LocalDate;
  /** Calendar days covered, both ends included. */
  days: number;
  in: Minor;
  out: Minor;
  count: number;
  /** Average money out per day across the whole range, spent days and quiet ones alike. */
  dailyAverage: Minor;
  busiest: DayTotals | null;
  /** Money out per category, biggest first. */
  categories: CategoryTotal[];
}

/** Totals for `from`…`to`, both ends included. */
export function summarizeRange(
  transactions: Transaction[],
  from: LocalDate,
  to: LocalDate,
  filter: HistoryFilter,
): RangeSummary {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const days = daysBetween(start, end) + 1;

  const byDay = new Map<LocalDate, DayTotals>();
  const byCategory = new Map<string, CategoryTotal>();
  let moneyIn = 0;
  let moneyOut = 0;
  let count = 0;

  for (const transaction of transactions) {
    if (transaction.date < start || transaction.date > end) continue;
    if (!matchesFilter(transaction, filter)) continue;

    let totals = byDay.get(transaction.date);
    if (!totals) {
      totals = emptyDay(transaction.date);
      byDay.set(transaction.date, totals);
    }
    add(totals, transaction);

    if (transaction.amount > 0) moneyIn += transaction.amount;
    else moneyOut -= transaction.amount;
    count++;

    if (transaction.amount >= 0) continue;
    const id = categoryIdOf(transaction);
    if (id === null) continue;
    const category = transaction.kind === 'bill_payment' ? billsCategory() : expenseCategory(transaction.category);
    const entry = byCategory.get(id) ?? { category, amount: 0, count: 0 };
    entry.amount -= transaction.amount;
    entry.count++;
    byCategory.set(id, entry);
  }

  const busiest = [...byDay.values()].sort((a, b) => b.out - a.out || a.date.localeCompare(b.date))[0] ?? null;

  return {
    from: start,
    to: end,
    days,
    in: moneyIn,
    out: moneyOut,
    count,
    dailyAverage: Math.round(moneyOut / Math.max(1, days)),
    // A range with no money out has no busiest day to name.
    busiest: busiest && busiest.out > 0 ? busiest : null,
    categories: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
  };
}

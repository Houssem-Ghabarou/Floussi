/** Derives engine input from stored records. */
import { billOccurrences, type BillOccurrence } from './bills';
import { maxDate, type LocalDate } from './dates';
import type { FinancialInput } from './engine';
import type { Minor } from './money';
import { routineByWeekday } from './routines';
import type { AppData, Cycle, Settings, Transaction } from './types';

/** Spending dated before the opening balance was entered is already reflected in it. */
export function countsToBalance(date: LocalDate, settings: Settings): boolean {
  return date >= settings.openingDate;
}

export function computeBalance(settings: Settings, transactions: Transaction[]): Minor {
  return transactions.reduce(
    (balance, t) => (t.countsToBalance ? balance + t.amount : balance),
    settings.openingBalance,
  );
}

export function savingsMovedInCycle(cycle: Cycle, transactions: Transaction[]): Minor {
  return transactions
    .filter((t) => t.kind === 'savings_transfer' && t.date >= cycle.startDate)
    .reduce((total, t) => total - t.amount, 0);
}

export function savingsReserve(cycle: Cycle, transactions: Transaction[]): Minor {
  return Math.max(0, cycle.savingsTarget - savingsMovedInCycle(cycle, transactions));
}

/** Bills owed this cycle: due before the income date (or today, if the income is late), plus overdue ones. */
export function cycleBillOccurrences(data: AppData, today: LocalDate): BillOccurrence[] {
  const { cycle, settings } = data;
  const windowEnd = maxDate(cycle.nextIncomeDate, today);
  const isFirstCycle = cycle.startDate <= settings.openingDate;
  return billOccurrences(data.bills, data.transactions, cycle.startDate, windowEnd).filter(
    // Payments settled in an earlier cycle aren't part of this one; the first cycle keeps
    // the "already paid" answers given when bills were set up.
    (occurrence) => !occurrence.paid || occurrence.dueDate >= cycle.startDate || isFirstCycle,
  );
}

export function buildFinancialInput(data: AppData, today: LocalDate): FinancialInput {
  const { settings, cycle, transactions } = data;
  const trackingStartDate = maxDate(cycle.startDate, settings.openingDate);

  const dailySpending: Record<LocalDate, Minor> = {};
  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.countsToBalance) continue;
    if (t.date < trackingStartDate || t.date > today) continue;
    dailySpending[t.date] = (dailySpending[t.date] ?? 0) - t.amount;
  }

  return {
    today,
    balance: computeBalance(settings, transactions),
    nextIncomeDate: cycle.nextIncomeDate,
    billsDue: cycleBillOccurrences(data, today)
      .filter((occurrence) => !occurrence.paid)
      .map((occurrence) => ({
        name: occurrence.bill.name,
        amount: occurrence.bill.amount,
        dueDate: occurrence.dueDate,
      })),
    savingsReserve: savingsReserve(cycle, transactions),
    minimumBalance: settings.minimumBalance,
    dailySpending,
    trackingStartDate,
    routineByWeekday: routineByWeekday(data.routines),
  };
}

import { addMonths, dateInMonth, maxDate, splitDate, type LocalDate } from './dates';
import type { Minor } from './money';
import type { Bill, Transaction } from './types';

export interface BillOccurrence {
  bill: Bill;
  dueDate: LocalDate;
  paid: boolean;
  paidAmount: Minor;
  /** The payment transaction, when paid. */
  paymentId: string | null;
}

/** How long before a cycle an unpaid recurring occurrence is still considered owed. */
const LOOKBACK_MONTHS = 1;

/** A recurring bill is first owed on its due day in the month it was added (which may already be past). */
export function firstOwedDate(bill: Bill): LocalDate | null {
  if (!bill.recurring || bill.dueDay == null || !bill.createdOn) return null;
  const [year, month] = splitDate(bill.createdOn);
  return dateInMonth(year, month, bill.dueDay);
}

/**
 * Due dates of a bill that are owed up to `windowEnd`: occurrences inside the window, plus unpaid
 * ones shortly before it (a due date that already passed is never silently assumed paid).
 */
export function occurrenceDates(bill: Bill, windowStart: LocalDate, windowEnd: LocalDate): LocalDate[] {
  if (bill.archived) return [];

  if (!bill.recurring) {
    // Unpaid one-off bills stay protected until paid, even if their date has passed.
    if (bill.dueDate && bill.dueDate > windowEnd) return [];
    return [bill.dueDate ?? windowEnd];
  }

  if (bill.dueDay == null) return [];
  const firstOwed = firstOwedDate(bill);
  const from = firstOwed ? maxDate(firstOwed, addMonths(windowStart, -LOOKBACK_MONTHS)) : windowStart;
  const [startYear, startMonth] = splitDate(from);
  const dates: LocalDate[] = [];
  for (let offset = 0; offset < 36; offset++) {
    const due = dateInMonth(startYear, startMonth + offset, bill.dueDay);
    if (due > windowEnd) break;
    if (due >= from) dates.push(due);
  }
  return dates;
}

/** The first due date strictly after `after`, used to explain bills that aren't due this cycle. */
export function nextDueAfter(bill: Bill, after: LocalDate): LocalDate | null {
  if (bill.archived) return null;
  if (!bill.recurring) return bill.dueDate && bill.dueDate > after ? bill.dueDate : null;
  if (bill.dueDay == null) return null;
  const [year, month] = splitDate(after);
  for (let offset = 0; offset < 3; offset++) {
    const due = dateInMonth(year, month + offset, bill.dueDay);
    if (due > after) return due;
  }
  return null;
}

export function billOccurrences(
  bills: Bill[],
  transactions: Transaction[],
  windowStart: LocalDate,
  windowEnd: LocalDate,
): BillOccurrence[] {
  const payments = transactions.filter((t) => t.kind === 'bill_payment' && t.billId);

  return bills
    .flatMap((bill) =>
      occurrenceDates(bill, windowStart, windowEnd).map((dueDate) => {
        const payment = payments.find(
          (p) => p.billId === bill.id && (!bill.recurring || p.billDueDate === dueDate),
        );
        return {
          bill,
          dueDate,
          paid: Boolean(payment),
          paidAmount: payment ? -payment.amount : 0,
          paymentId: payment?.id ?? null,
        };
      }),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

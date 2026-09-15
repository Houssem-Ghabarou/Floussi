import type { LocalDate } from './dates';
import type { Minor } from './money';

export type TransactionKind = 'expense' | 'income' | 'bill_payment' | 'savings_transfer' | 'adjustment';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** Signed minor units: negative = money out, positive = money in. */
  amount: Minor;
  /** Expense category id or income source id. */
  category: string | null;
  note: string | null;
  date: LocalDate;
  billId: string | null;
  /** The bill occurrence this payment settles. */
  billDueDate: LocalDate | null;
  /** False for spending that happened before the opening balance was entered (history only). */
  countsToBalance: boolean;
  createdAt: number;
}

export type IncomeFrequency = 'monthly' | 'biweekly' | 'weekly' | 'irregular';

export interface Cycle {
  id: string;
  startDate: LocalDate;
  /**
   * When the cycle began (the income that started it was recorded). Transactions on `startDate`
   * recorded before this moment belong to the previous cycle. Null: the whole start day belongs here.
   */
  startedAt: number | null;
  nextIncomeDate: LocalDate;
  expectedIncome: Minor | null;
  incomeLabel: string;
  frequency: IncomeFrequency;
  /** Amount to keep protected (or move to savings) during this cycle. */
  savingsTarget: Minor;
  closedAt: number | null;
}

export interface Bill {
  id: string;
  name: string;
  emoji: string;
  amount: Minor;
  recurring: boolean;
  /** Day of month for recurring bills. */
  dueDay: number | null;
  /** Due date for one-off bills; null means "before next income". */
  dueDate: LocalDate | null;
  archived: boolean;
  /** Day the bill was added: a recurring bill can be owed from its due day in that month, even if already past. */
  createdOn: LocalDate | null;
}

export interface RoutineItem {
  id: string;
  name: string;
  amount: Minor;
  category: string;
}

export interface Routine {
  id: string;
  name: string;
  emoji: string;
  /** 0 = Sunday … 6 = Saturday. A weekday belongs to at most one routine. */
  weekdays: number[];
  items: RoutineItem[];
  enabled: boolean;
}

export interface Settings {
  currency: string;
  openingBalance: Minor;
  openingDate: LocalDate;
  minimumBalance: Minor;
  /** What a normal day costs: decides if the safe pace is comfortable, tight or very tight. Null: currency default. */
  dailyNeed: Minor | null;
  /** Default share of unexpected income to protect as savings (0-100). */
  unexpectedIncomeSavePercent: number;
  onboarded: boolean;
}

export interface AppData {
  settings: Settings;
  cycle: Cycle;
  transactions: Transaction[];
  bills: Bill[];
  routines: Routine[];
}

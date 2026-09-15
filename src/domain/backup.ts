/**
 * Portable backup of everything the user entered — never computed values, which the engine rebuilds.
 * Parsing is defensive: a damaged or foreign file is rejected before it can replace any data.
 */
import { formatShortDate, toLocalDate, type LocalDate } from './dates';
import type { Bill, Cycle, IncomeFrequency, Routine, Settings, Transaction, TransactionKind } from './types';

export const BACKUP_FORMAT = 1;

/** 'floussi' is how backups were marked before the app was renamed; they still restore. */
const BACKUP_APPS = ['flousey', 'floussi'];

export interface BackupData {
  settings: Settings;
  cycles: Cycle[];
  transactions: Transaction[];
  bills: Bill[];
  routines: Routine[];
}

export interface Backup {
  app: 'flousey';
  format: number;
  /** ISO timestamp. */
  exportedAt: string;
  data: BackupData;
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

export function createBackup(data: BackupData, now: Date = new Date()): Backup {
  return { app: 'flousey', format: BACKUP_FORMAT, exportedAt: now.toISOString(), data };
}

export function backupFileName(today: LocalDate): string {
  return `flousey-backup-${today}.json`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** "Backup from Sep 15 · 42 transactions · 3 bills · 2 routines" */
export function describeBackup(backup: Backup): string {
  const { transactions, bills, routines } = backup.data;
  return [
    `Backup from ${formatShortDate(toLocalDate(new Date(backup.exportedAt)))}`,
    plural(transactions.length, 'transaction'),
    plural(bills.filter((bill) => !bill.archived).length, 'bill'),
    plural(routines.length, 'routine'),
  ].join(' · ');
}

const NOT_A_BACKUP = "This file isn't a Flousey backup.";
const damaged = (what: string) => `The backup looks damaged (${what}).`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRANSACTION_KINDS: TransactionKind[] = ['expense', 'income', 'bill_payment', 'savings_transfer', 'adjustment'];
const FREQUENCIES: IncomeFrequency[] = ['monthly', 'biweekly', 'weekly', 'irregular'];

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isInteger(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isDate = (value: unknown): value is LocalDate => isString(value) && DATE_PATTERN.test(value);
const stringOrNull = (value: unknown) => (isString(value) ? value : null);
const intOrNull = (value: unknown) => (isInt(value) ? value : null);

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isObject(raw) || !isString(raw.app) || !BACKUP_APPS.includes(raw.app) || !isObject(raw.data)) {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isInt(raw.format) || raw.format > BACKUP_FORMAT) {
    return { ok: false, error: 'This backup was made by a newer version of Flousey. Update the app and try again.' };
  }
  if (!isString(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) {
    return { ok: false, error: damaged('export date') };
  }

  const settings = parseSettings(raw.data.settings);
  if (!settings) return { ok: false, error: damaged('settings') };
  const cycles = parseList(raw.data.cycles, parseCycle);
  if (!cycles) return { ok: false, error: damaged('cycles') };
  if (!cycles.some((cycle) => cycle.closedAt === null)) return { ok: false, error: damaged('no current cycle') };
  const transactions = parseList(raw.data.transactions, parseTransaction);
  if (!transactions) return { ok: false, error: damaged('transactions') };
  const bills = parseList(raw.data.bills, parseBill);
  if (!bills) return { ok: false, error: damaged('bills') };
  const routines = parseList(raw.data.routines, parseRoutine);
  if (!routines) return { ok: false, error: damaged('routines') };

  return {
    ok: true,
    backup: {
      app: 'flousey',
      format: raw.format,
      exportedAt: raw.exportedAt,
      data: { settings, cycles, transactions, bills, routines },
    },
  };
}

/** Every item must be valid: a partially readable backup is refused rather than half-restored. */
function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items;
}

function parseSettings(value: unknown): Settings | null {
  if (
    !isObject(value) ||
    !isString(value.currency) ||
    !isInt(value.openingBalance) ||
    !isDate(value.openingDate) ||
    !isInt(value.minimumBalance)
  ) {
    return null;
  }
  return {
    currency: value.currency,
    openingBalance: value.openingBalance,
    openingDate: value.openingDate,
    minimumBalance: value.minimumBalance,
    dailyNeed: intOrNull(value.dailyNeed),
    unexpectedIncomeSavePercent: isInt(value.unexpectedIncomeSavePercent) ? value.unexpectedIncomeSavePercent : 0,
    onboarded: true,
  };
}

function parseCycle(value: unknown): Cycle | null {
  if (
    !isObject(value) ||
    !isString(value.id) ||
    !isDate(value.startDate) ||
    !isDate(value.nextIncomeDate) ||
    !isString(value.incomeLabel) ||
    !FREQUENCIES.includes(value.frequency as IncomeFrequency) ||
    !isInt(value.savingsTarget)
  ) {
    return null;
  }
  return {
    id: value.id,
    startDate: value.startDate,
    startedAt: intOrNull(value.startedAt),
    nextIncomeDate: value.nextIncomeDate,
    expectedIncome: intOrNull(value.expectedIncome),
    incomeLabel: value.incomeLabel,
    frequency: value.frequency as IncomeFrequency,
    savingsTarget: value.savingsTarget,
    closedAt: intOrNull(value.closedAt),
  };
}

function parseTransaction(value: unknown): Transaction | null {
  if (
    !isObject(value) ||
    !isString(value.id) ||
    !TRANSACTION_KINDS.includes(value.kind as TransactionKind) ||
    !isInt(value.amount) ||
    !isDate(value.date) ||
    typeof value.countsToBalance !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind as TransactionKind,
    amount: value.amount,
    category: stringOrNull(value.category),
    note: stringOrNull(value.note),
    date: value.date,
    billId: stringOrNull(value.billId),
    billDueDate: isDate(value.billDueDate) ? value.billDueDate : null,
    countsToBalance: value.countsToBalance,
    createdAt: isInt(value.createdAt) ? value.createdAt : 0,
  };
}

function parseBill(value: unknown): Bill | null {
  if (
    !isObject(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !isInt(value.amount) ||
    typeof value.recurring !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    emoji: isString(value.emoji) ? value.emoji : '🧾',
    amount: value.amount,
    recurring: value.recurring,
    dueDay: intOrNull(value.dueDay),
    dueDate: isDate(value.dueDate) ? value.dueDate : null,
    archived: value.archived === true,
    createdOn: isDate(value.createdOn) ? value.createdOn : null,
  };
}

function parseRoutine(value: unknown): Routine | null {
  if (
    !isObject(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !Array.isArray(value.weekdays) ||
    !Array.isArray(value.items)
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    emoji: isString(value.emoji) ? value.emoji : '📋',
    weekdays: value.weekdays.filter((day): day is number => isInt(day) && day >= 0 && day <= 6),
    items: value.items.flatMap((item) =>
      isObject(item) && isString(item.id) && isString(item.name) && isInt(item.amount) && isString(item.category)
        ? [{ id: item.id, name: item.name, amount: item.amount, category: item.category }]
        : [],
    ),
    enabled: value.enabled !== false,
  };
}

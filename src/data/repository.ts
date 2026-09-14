/**
 * Local SQLite persistence — the source of truth (offline-first).
 * Cloud sync can later replicate these tables without changing the store's API.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { Bill, Cycle, IncomeFrequency, Routine, Settings, Transaction, TransactionKind } from '@/domain/types';

const MIGRATIONS = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
   CREATE TABLE cycles (
     id TEXT PRIMARY KEY NOT NULL,
     start_date TEXT NOT NULL,
     next_income_date TEXT NOT NULL,
     expected_income INTEGER,
     income_label TEXT NOT NULL,
     frequency TEXT NOT NULL,
     savings_target INTEGER NOT NULL,
     closed_at INTEGER
   );
   CREATE TABLE transactions (
     id TEXT PRIMARY KEY NOT NULL,
     kind TEXT NOT NULL,
     amount INTEGER NOT NULL,
     category TEXT,
     note TEXT,
     date TEXT NOT NULL,
     bill_id TEXT,
     bill_due_date TEXT,
     counts_to_balance INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX transactions_date ON transactions (date);
   CREATE TABLE bills (
     id TEXT PRIMARY KEY NOT NULL,
     name TEXT NOT NULL,
     emoji TEXT NOT NULL,
     amount INTEGER NOT NULL,
     recurring INTEGER NOT NULL,
     due_day INTEGER,
     due_date TEXT,
     archived INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE routines (
     id TEXT PRIMARY KEY NOT NULL,
     name TEXT NOT NULL,
     emoji TEXT NOT NULL,
     weekdays TEXT NOT NULL,
     items TEXT NOT NULL,
     enabled INTEGER NOT NULL,
     position INTEGER NOT NULL DEFAULT 0
   );`,
  'ALTER TABLE bills ADD COLUMN created_on TEXT;',
];

let database: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (!database) {
    database = openDatabaseSync('floussi.db');
    migrate(database);
  }
  return database;
}

function migrate(target: SQLiteDatabase) {
  target.execSync('PRAGMA journal_mode = WAL;');
  let version = target.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    const nextVersion = version + 1;
    target.withTransactionSync(() => {
      target.execSync(migration);
      target.execSync(`PRAGMA user_version = ${nextVersion}`);
    });
    version = nextVersion;
  }
}

interface CycleRow {
  id: string;
  start_date: string;
  next_income_date: string;
  expected_income: number | null;
  income_label: string;
  frequency: string;
  savings_target: number;
  closed_at: number | null;
}

interface TransactionRow {
  id: string;
  kind: string;
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
  bill_id: string | null;
  bill_due_date: string | null;
  counts_to_balance: number;
  created_at: number;
}

interface BillRow {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  recurring: number;
  due_day: number | null;
  due_date: string | null;
  archived: number;
  created_on: string | null;
}

interface RoutineRow {
  id: string;
  name: string;
  emoji: string;
  weekdays: string;
  items: string;
  enabled: number;
}

export interface StoredData {
  settings: Settings | null;
  cycles: Cycle[];
  transactions: Transaction[];
  bills: Bill[];
  routines: Routine[];
}

export const repository = {
  loadAll(): StoredData {
    const settingsRow = db().getFirstSync<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");

    const cycles = db()
      .getAllSync<CycleRow>('SELECT * FROM cycles ORDER BY start_date')
      .map<Cycle>((row) => ({
        id: row.id,
        startDate: row.start_date,
        nextIncomeDate: row.next_income_date,
        expectedIncome: row.expected_income,
        incomeLabel: row.income_label,
        frequency: row.frequency as IncomeFrequency,
        savingsTarget: row.savings_target,
        closedAt: row.closed_at,
      }));

    const transactions = db()
      .getAllSync<TransactionRow>('SELECT * FROM transactions ORDER BY date, created_at')
      .map<Transaction>((row) => ({
        id: row.id,
        kind: row.kind as TransactionKind,
        amount: row.amount,
        category: row.category,
        note: row.note,
        date: row.date,
        billId: row.bill_id,
        billDueDate: row.bill_due_date,
        countsToBalance: row.counts_to_balance === 1,
        createdAt: row.created_at,
      }));

    const bills = db()
      .getAllSync<BillRow>('SELECT * FROM bills ORDER BY name')
      .map<Bill>((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        amount: row.amount,
        recurring: row.recurring === 1,
        dueDay: row.due_day,
        dueDate: row.due_date,
        archived: row.archived === 1,
        createdOn: row.created_on,
      }));

    const routines = db()
      .getAllSync<RoutineRow>('SELECT * FROM routines ORDER BY position')
      .map<Routine>((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        weekdays: JSON.parse(row.weekdays),
        items: JSON.parse(row.items),
        enabled: row.enabled === 1,
      }));

    return {
      settings: settingsRow ? (JSON.parse(settingsRow.value) as Settings) : null,
      cycles,
      transactions,
      bills,
      routines,
    };
  },

  /** Runs several writes atomically. */
  transaction(task: () => void) {
    db().withTransactionSync(task);
  },

  saveSettings(settings: Settings) {
    db().runSync("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)", [JSON.stringify(settings)]);
  },

  upsertCycle(cycle: Cycle) {
    db().runSync('INSERT OR REPLACE INTO cycles VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      cycle.id,
      cycle.startDate,
      cycle.nextIncomeDate,
      cycle.expectedIncome,
      cycle.incomeLabel,
      cycle.frequency,
      cycle.savingsTarget,
      cycle.closedAt,
    ]);
  },

  upsertTransaction(t: Transaction) {
    db().runSync('INSERT OR REPLACE INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      t.id,
      t.kind,
      t.amount,
      t.category,
      t.note,
      t.date,
      t.billId,
      t.billDueDate,
      t.countsToBalance ? 1 : 0,
      t.createdAt,
    ]);
  },

  deleteTransaction(id: string) {
    db().runSync('DELETE FROM transactions WHERE id = ?', [id]);
  },

  upsertBill(bill: Bill) {
    db().runSync(
      `INSERT OR REPLACE INTO bills (id, name, emoji, amount, recurring, due_day, due_date, archived, created_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.id,
        bill.name,
        bill.emoji,
        bill.amount,
        bill.recurring ? 1 : 0,
        bill.dueDay,
        bill.dueDate,
        bill.archived ? 1 : 0,
        bill.createdOn,
      ],
    );
  },

  deleteBill(id: string) {
    db().runSync('DELETE FROM bills WHERE id = ?', [id]);
  },

  upsertRoutine(routine: Routine, position: number) {
    db().runSync('INSERT OR REPLACE INTO routines VALUES (?, ?, ?, ?, ?, ?, ?)', [
      routine.id,
      routine.name,
      routine.emoji,
      JSON.stringify(routine.weekdays),
      JSON.stringify(routine.items),
      routine.enabled ? 1 : 0,
      position,
    ]);
  },

  deleteRoutine(id: string) {
    db().runSync('DELETE FROM routines WHERE id = ?', [id]);
  },

  resetAll() {
    db().withTransactionSync(() => {
      db().execSync('DELETE FROM settings; DELETE FROM cycles; DELETE FROM transactions; DELETE FROM bills; DELETE FROM routines;');
    });
  },
};

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

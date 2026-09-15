/**
 * Local SQLite persistence — the source of truth (offline-first).
 *
 * Sync-ready: every row carries `updated_at`, deletions are soft (`deleted_at` tombstones), and every
 * write is recorded in `sync_changes`, so a future sync can push exactly what changed since last time.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { BackupData } from '@/domain/backup';
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
  'ALTER TABLE cycles ADD COLUMN started_at INTEGER;',
  `ALTER TABLE settings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE settings ADD COLUMN deleted_at INTEGER;
   ALTER TABLE cycles ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE cycles ADD COLUMN deleted_at INTEGER;
   ALTER TABLE transactions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE transactions ADD COLUMN deleted_at INTEGER;
   ALTER TABLE bills ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE bills ADD COLUMN deleted_at INTEGER;
   ALTER TABLE routines ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE routines ADD COLUMN deleted_at INTEGER;
   CREATE TABLE sync_changes (
     entity TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     changed_at INTEGER NOT NULL,
     PRIMARY KEY (entity, entity_id)
   );`,
];

type Entity = 'settings' | 'cycle' | 'transaction' | 'bill' | 'routine';
type Value = string | number | null;

let database: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (!database) {
    database = openDatabaseSync('flousey.db');
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

// SQLite can't nest transactions: an inner `atomically` joins the transaction already running.
let transactionDepth = 0;

function atomically(task: () => void) {
  if (transactionDepth > 0) {
    task();
    return;
  }
  const target = db();
  transactionDepth++;
  try {
    target.withTransactionSync(task);
  } finally {
    transactionDepth--;
  }
}

function recordChange(entity: Entity, id: string, at: number) {
  db().runSync('INSERT OR REPLACE INTO sync_changes (entity, entity_id, changed_at) VALUES (?, ?, ?)', [entity, id, at]);
}

/** Inserts or replaces a live row (clearing any tombstone) and records the change. */
function upsert(entity: Entity, table: string, id: string, columns: Record<string, Value>) {
  const now = Date.now();
  const values: Record<string, Value> = { ...columns, updated_at: now, deleted_at: null };
  const names = Object.keys(values);
  atomically(() => {
    db().runSync(
      `INSERT OR REPLACE INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      names.map((name) => values[name]),
    );
    recordChange(entity, id, now);
  });
}

/** Keeps a tombstone so a future sync can tell other devices the row was deleted. */
function softDelete(entity: Entity, table: string, id: string) {
  const now = Date.now();
  atomically(() => {
    db().runSync(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
    recordChange(entity, id, now);
  });
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
  started_at: number | null;
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
    const settingsRow = db().getFirstSync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'settings' AND deleted_at IS NULL",
    );

    const cycles = db()
      .getAllSync<CycleRow>('SELECT * FROM cycles WHERE deleted_at IS NULL ORDER BY start_date')
      .map<Cycle>((row) => ({
        id: row.id,
        startDate: row.start_date,
        startedAt: row.started_at,
        nextIncomeDate: row.next_income_date,
        expectedIncome: row.expected_income,
        incomeLabel: row.income_label,
        frequency: row.frequency as IncomeFrequency,
        savingsTarget: row.savings_target,
        closedAt: row.closed_at,
      }));

    const transactions = db()
      .getAllSync<TransactionRow>('SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY date, created_at')
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
      .getAllSync<BillRow>('SELECT * FROM bills WHERE deleted_at IS NULL ORDER BY name')
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
      .getAllSync<RoutineRow>('SELECT * FROM routines WHERE deleted_at IS NULL ORDER BY position')
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
    atomically(task);
  },

  saveSettings(settings: Settings) {
    upsert('settings', 'settings', 'settings', { key: 'settings', value: JSON.stringify(settings) });
  },

  upsertCycle(cycle: Cycle) {
    upsert('cycle', 'cycles', cycle.id, {
      id: cycle.id,
      start_date: cycle.startDate,
      next_income_date: cycle.nextIncomeDate,
      expected_income: cycle.expectedIncome,
      income_label: cycle.incomeLabel,
      frequency: cycle.frequency,
      savings_target: cycle.savingsTarget,
      closed_at: cycle.closedAt,
      started_at: cycle.startedAt,
    });
  },

  upsertTransaction(t: Transaction) {
    upsert('transaction', 'transactions', t.id, {
      id: t.id,
      kind: t.kind,
      amount: t.amount,
      category: t.category,
      note: t.note,
      date: t.date,
      bill_id: t.billId,
      bill_due_date: t.billDueDate,
      counts_to_balance: t.countsToBalance ? 1 : 0,
      created_at: t.createdAt,
    });
  },

  deleteTransaction(id: string) {
    softDelete('transaction', 'transactions', id);
  },

  upsertBill(bill: Bill) {
    upsert('bill', 'bills', bill.id, {
      id: bill.id,
      name: bill.name,
      emoji: bill.emoji,
      amount: bill.amount,
      recurring: bill.recurring ? 1 : 0,
      due_day: bill.dueDay,
      due_date: bill.dueDate,
      archived: bill.archived ? 1 : 0,
      created_on: bill.createdOn,
    });
  },

  deleteBill(id: string) {
    softDelete('bill', 'bills', id);
  },

  upsertRoutine(routine: Routine, position: number) {
    upsert('routine', 'routines', routine.id, {
      id: routine.id,
      name: routine.name,
      emoji: routine.emoji,
      weekdays: JSON.stringify(routine.weekdays),
      items: JSON.stringify(routine.items),
      enabled: routine.enabled ? 1 : 0,
      position,
    });
  },

  deleteRoutine(id: string) {
    softDelete('routine', 'routines', id);
  },

  /**
   * Erases everything on this device, tombstones and pending changes included. Nothing syncs yet, so
   * there is nothing to tell other devices; once accounts exist, erasing will need its own sync step.
   */
  resetAll() {
    atomically(() => {
      db().execSync(
        'DELETE FROM settings; DELETE FROM cycles; DELETE FROM transactions; DELETE FROM bills; DELETE FROM routines; DELETE FROM sync_changes;',
      );
    });
  },

  /** Replaces all data with a backup, in one transaction: either everything is restored or nothing changes. */
  replaceAll(data: BackupData) {
    atomically(() => {
      repository.resetAll();
      repository.saveSettings(data.settings);
      data.cycles.forEach((cycle) => repository.upsertCycle(cycle));
      data.transactions.forEach((transaction) => repository.upsertTransaction(transaction));
      data.bills.forEach((bill) => repository.upsertBill(bill));
      data.routines.forEach((routine, position) => repository.upsertRoutine(routine, position));
    });
  },
};

/** A random UUID (v4). IDs are created on the device, so records can later sync without collisions. */
export function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

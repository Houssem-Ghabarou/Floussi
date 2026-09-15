import { create } from 'zustand';

import { newId, repository } from '@/data/repository';
import { createBackup, type Backup } from '@/domain/backup';
import { toLocalDate, type LocalDate } from '@/domain/dates';
import { computeBalance, countsToBalance } from '@/domain/derive';
import type { Minor } from '@/domain/money';
import type { Bill, Cycle, IncomeFrequency, Routine, Settings, Transaction } from '@/domain/types';

export type NewTransaction = Pick<Transaction, 'kind' | 'amount' | 'date'> &
  Partial<Pick<Transaction, 'category' | 'note' | 'billId' | 'billDueDate'>>;

export interface CyclePlan {
  nextIncomeDate: LocalDate;
  expectedIncome: Minor | null;
  incomeLabel: string;
  frequency: IncomeFrequency;
  savingsTarget: Minor;
}

export interface OnboardingPlan extends CyclePlan {
  currency: string;
  balance: Minor;
  minimumBalance: Minor;
  dailyNeed: Minor | null;
  /** `alreadyPaidOn` answers "this bill's due date already passed — did you pay it?". */
  bills: (Omit<Bill, 'id' | 'archived' | 'createdOn'> & { alreadyPaidOn: LocalDate | null })[];
}

interface AppState {
  status: 'loading' | 'ready' | 'error';
  today: LocalDate;
  settings: Settings | null;
  cycles: Cycle[];
  transactions: Transaction[];
  bills: Bill[];
  routines: Routine[];

  load(): void;
  refreshToday(): void;
  completeOnboarding(plan: OnboardingPlan): void;
  addTransaction(input: NewTransaction): Transaction;
  updateTransaction(transaction: Transaction): void;
  deleteTransaction(id: string): Transaction | null;
  restoreTransaction(transaction: Transaction): void;
  saveBill(bill: Bill): void;
  deleteBill(id: string): void;
  payBill(payment: { billId: string; dueDate: LocalDate; amount: Minor; date: LocalDate }): Transaction;
  saveRoutine(routine: Routine): void;
  deleteRoutine(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  updateCycle(patch: Partial<Cycle>): void;
  reconcileBalance(actualBalance: Minor): Transaction | null;
  /** `start` is when the income that ends the current cycle was recorded. */
  startNextCycle(plan: CyclePlan, start: { date: LocalDate; at: number }): void;
  resetAll(): void;
  /** Everything the user entered, ready to save as a file. Null before onboarding. */
  exportBackup(): Backup | null;
  /** Replaces all data on this device with a validated backup. */
  importBackup(backup: Backup): void;
}

export function currentCycle(cycles: Cycle[]): Cycle | null {
  return (
    cycles
      .filter((cycle) => cycle.closedAt === null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export const useApp = create<AppState>()((set, get) => {
  /** One-off bills are archived once paid and restored if the payment is removed. */
  const setOneOffBillArchived = (billId: string | null, archived: boolean) => {
    const bill = get().bills.find((candidate) => candidate.id === billId);
    if (!bill || bill.recurring || bill.archived === archived) return;
    get().saveBill({ ...bill, archived });
  };

  return {
    status: 'loading',
    today: toLocalDate(),
    settings: null,
    cycles: [],
    transactions: [],
    bills: [],
    routines: [],

    load() {
      try {
        set({ ...repository.loadAll(), status: 'ready', today: toLocalDate() });
      } catch (error) {
        console.error('Failed to open the local database', error);
        set({ status: 'error' });
      }
    },

    refreshToday() {
      const today = toLocalDate();
      if (today !== get().today) set({ today });
    },

    completeOnboarding(plan) {
      const { today } = get();
      const settings: Settings = {
        currency: plan.currency,
        openingBalance: plan.balance,
        openingDate: today,
        minimumBalance: plan.minimumBalance,
        dailyNeed: plan.dailyNeed,
        unexpectedIncomeSavePercent: 0,
        onboarded: true,
      };
      const cycle: Cycle = {
        id: newId(),
        startDate: today,
        startedAt: null,
        nextIncomeDate: plan.nextIncomeDate,
        expectedIncome: plan.expectedIncome,
        incomeLabel: plan.incomeLabel,
        frequency: plan.frequency,
        savingsTarget: plan.savingsTarget,
        closedAt: null,
      };
      const bills: Bill[] = [];
      const transactions: Transaction[] = [];
      for (const { alreadyPaidOn, ...fields } of plan.bills) {
        const bill: Bill = { ...fields, id: newId(), archived: false, createdOn: today };
        bills.push(bill);
        if (alreadyPaidOn) {
          transactions.push({
            id: newId(),
            kind: 'bill_payment',
            amount: -bill.amount,
            category: null,
            note: null,
            date: alreadyPaidOn,
            billId: bill.id,
            billDueDate: alreadyPaidOn,
            countsToBalance: countsToBalance(alreadyPaidOn, settings),
            createdAt: Date.now(),
          });
        }
      }

      repository.transaction(() => {
        repository.saveSettings(settings);
        repository.upsertCycle(cycle);
        bills.forEach((bill) => repository.upsertBill(bill));
        transactions.forEach((transaction) => repository.upsertTransaction(transaction));
      });
      set({ settings, cycles: [cycle], bills, transactions, routines: [] });
    },

    addTransaction(input) {
      const transaction: Transaction = {
        category: null,
        note: null,
        billId: null,
        billDueDate: null,
        ...input,
        id: newId(),
        countsToBalance: countsToBalance(input.date, get().settings!),
        createdAt: Date.now(),
      };
      repository.upsertTransaction(transaction);
      set((state) => ({ transactions: [...state.transactions, transaction] }));
      return transaction;
    },

    updateTransaction(transaction) {
      const next = { ...transaction, countsToBalance: countsToBalance(transaction.date, get().settings!) };
      repository.upsertTransaction(next);
      set((state) => ({ transactions: replaceById(state.transactions, next) }));
    },

    deleteTransaction(id) {
      const transaction = get().transactions.find((candidate) => candidate.id === id);
      if (!transaction) return null;
      repository.deleteTransaction(id);
      set((state) => ({ transactions: state.transactions.filter((candidate) => candidate.id !== id) }));
      if (transaction.kind === 'bill_payment') setOneOffBillArchived(transaction.billId, false);
      return transaction;
    },

    restoreTransaction(transaction) {
      repository.upsertTransaction(transaction);
      set((state) => ({ transactions: replaceById(state.transactions, transaction) }));
      if (transaction.kind === 'bill_payment') setOneOffBillArchived(transaction.billId, true);
    },

    saveBill(bill) {
      repository.upsertBill(bill);
      set((state) => ({ bills: replaceById(state.bills, bill) }));
    },

    deleteBill(id) {
      // Bills with payments are archived so history keeps its names.
      if (get().transactions.some((transaction) => transaction.billId === id)) {
        const bill = get().bills.find((candidate) => candidate.id === id);
        if (bill) get().saveBill({ ...bill, archived: true });
        return;
      }
      repository.deleteBill(id);
      set((state) => ({ bills: state.bills.filter((bill) => bill.id !== id) }));
    },

    payBill({ billId, dueDate, amount, date }) {
      const payment = get().addTransaction({
        kind: 'bill_payment',
        amount: -amount,
        date,
        billId,
        billDueDate: dueDate,
      });
      setOneOffBillArchived(billId, true);
      return payment;
    },

    saveRoutine(routine) {
      // A weekday belongs to a single routine, so the new selection wins.
      const routines = replaceById(
        get().routines.map((other) =>
          other.id === routine.id
            ? other
            : { ...other, weekdays: other.weekdays.filter((day) => !routine.weekdays.includes(day)) },
        ),
        routine,
      );
      repository.transaction(() => routines.forEach((item, position) => repository.upsertRoutine(item, position)));
      set({ routines });
    },

    deleteRoutine(id) {
      repository.deleteRoutine(id);
      set((state) => ({ routines: state.routines.filter((routine) => routine.id !== id) }));
    },

    updateSettings(patch) {
      const settings = { ...get().settings!, ...patch };
      repository.saveSettings(settings);
      set({ settings });
    },

    updateCycle(patch) {
      const cycle = currentCycle(get().cycles);
      if (!cycle) return;
      const next = { ...cycle, ...patch };
      repository.upsertCycle(next);
      set((state) => ({ cycles: replaceById(state.cycles, next) }));
    },

    reconcileBalance(actualBalance) {
      const { settings, transactions, today } = get();
      const difference = actualBalance - computeBalance(settings!, transactions);
      if (difference === 0) return null;
      return get().addTransaction({ kind: 'adjustment', amount: difference, date: today });
    },

    startNextCycle(plan, start) {
      const current = currentCycle(get().cycles);
      const closed = current ? { ...current, closedAt: Date.now() } : null;
      const next: Cycle = { ...plan, id: newId(), startDate: start.date, startedAt: start.at, closedAt: null };
      repository.transaction(() => {
        if (closed) repository.upsertCycle(closed);
        repository.upsertCycle(next);
      });
      set((state) => ({
        cycles: [...(closed ? replaceById(state.cycles, closed) : state.cycles), next],
      }));
    },

    resetAll() {
      repository.resetAll();
      set({ settings: null, cycles: [], transactions: [], bills: [], routines: [] });
    },

    exportBackup() {
      const { settings, cycles, transactions, bills, routines } = get();
      return settings ? createBackup({ settings, cycles, transactions, bills, routines }) : null;
    },

    importBackup(backup) {
      repository.replaceAll(backup.data);
      set({ ...repository.loadAll(), today: toLocalDate() });
    },
  };
});

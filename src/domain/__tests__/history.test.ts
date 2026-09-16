import {
  ALL_HISTORY,
  dayTotals,
  isFiltered,
  matchesFilter,
  summarizeRange,
  totalsByDay,
  transactionsOn,
  type HistoryFilter,
} from '../history';
import type { Transaction } from '../types';

let sequence = 0;

function tx(fields: Partial<Transaction> & Pick<Transaction, 'kind' | 'amount' | 'date'>): Transaction {
  sequence++;
  return {
    id: `t${sequence}`,
    category: null,
    note: null,
    billId: null,
    billDueDate: null,
    countsToBalance: true,
    createdAt: sequence,
    ...fields,
  };
}

const coffee = tx({ kind: 'expense', amount: -3_000, date: '2026-09-17', category: 'coffee' });
const lunch = tx({ kind: 'expense', amount: -12_000, date: '2026-09-17', category: 'food' });
const rent = tx({ kind: 'bill_payment', amount: -400_000, date: '2026-09-17', billId: 'b1' });
const salary = tx({ kind: 'income', amount: 1_200_000, date: '2026-09-18', category: 'salary' });
const bus = tx({ kind: 'expense', amount: -7_000, date: '2026-09-19', category: 'transport' });
const history = [coffee, lunch, rent, salary, bus];

const filter = (patch: Partial<HistoryFilter> = {}): HistoryFilter => ({ ...ALL_HISTORY, ...patch });

describe('matchesFilter', () => {
  it('keeps everything by default', () => {
    expect(history.every((transaction) => matchesFilter(transaction, ALL_HISTORY))).toBe(true);
    expect(isFiltered(ALL_HISTORY)).toBe(false);
  });

  it('splits money out from money in', () => {
    expect(matchesFilter(coffee, filter({ direction: 'out' }))).toBe(true);
    expect(matchesFilter(salary, filter({ direction: 'out' }))).toBe(false);
    expect(matchesFilter(salary, filter({ direction: 'in' }))).toBe(true);
    expect(matchesFilter(coffee, filter({ direction: 'in' }))).toBe(false);
  });

  it('keeps only bill payments when asked', () => {
    expect(matchesFilter(rent, filter({ billsOnly: true }))).toBe(true);
    expect(matchesFilter(coffee, filter({ billsOnly: true }))).toBe(false);
    expect(matchesFilter(salary, filter({ billsOnly: true }))).toBe(false);
    expect(isFiltered(filter({ billsOnly: true }))).toBe(true);
  });
});

describe('totalsByDay', () => {
  it('sums money in and out separately, as positive numbers', () => {
    const days = totalsByDay(history, ALL_HISTORY);
    expect(days.get('2026-09-17')).toEqual({ date: '2026-09-17', in: 0, out: 415_000, count: 3 });
    expect(days.get('2026-09-18')).toEqual({ date: '2026-09-18', in: 1_200_000, out: 0, count: 1 });
  });

  it('leaves out days with nothing matching', () => {
    const days = totalsByDay(history, filter({ billsOnly: true }));
    expect([...days.keys()]).toEqual(['2026-09-17']);
    expect(days.get('2026-09-17')?.out).toBe(400_000);
  });

  it('agrees with dayTotals', () => {
    const chosen = filter({ direction: 'out' });
    for (const date of ['2026-09-17', '2026-09-18', '2026-09-19']) {
      const fromMap = totalsByDay(history, chosen).get(date);
      const direct = dayTotals(history, date, chosen);
      expect(direct).toEqual(fromMap ?? { date, in: 0, out: 0, count: 0 });
    }
  });
});

describe('transactionsOn', () => {
  it('returns one day, newest first', () => {
    expect(transactionsOn(history, '2026-09-17').map((transaction) => transaction.id)).toEqual([
      rent.id,
      lunch.id,
      coffee.id,
    ]);
    expect(transactionsOn(history, '2026-09-20')).toEqual([]);
  });
});

describe('summarizeRange', () => {
  it('includes both ends of the range', () => {
    const summary = summarizeRange(history, '2026-09-17', '2026-09-19', ALL_HISTORY);
    expect(summary.days).toBe(3);
    expect(summary.count).toBe(5);
    expect(summary.out).toBe(422_000);
    expect(summary.in).toBe(1_200_000);
  });

  it('excludes anything outside the range', () => {
    const summary = summarizeRange(history, '2026-09-18', '2026-09-19', ALL_HISTORY);
    expect(summary.count).toBe(2);
    expect(summary.out).toBe(7_000);
  });

  it('orders reversed bounds', () => {
    const summary = summarizeRange(history, '2026-09-19', '2026-09-17', ALL_HISTORY);
    expect(summary.from).toBe('2026-09-17');
    expect(summary.to).toBe('2026-09-19');
    expect(summary.days).toBe(3);
  });

  it('averages money out over every day, quiet ones included', () => {
    const summary = summarizeRange(history, '2026-09-17', '2026-09-19', filter({ billsOnly: true }));
    expect(summary.out).toBe(400_000);
    expect(summary.dailyAverage).toBe(Math.round(400_000 / 3));
  });

  it('ranks categories by money out and names the busiest day', () => {
    const summary = summarizeRange(history, '2026-09-17', '2026-09-19', ALL_HISTORY);
    expect(summary.categories.map((entry) => entry.category.id)).toEqual(['bills', 'food', 'transport', 'coffee']);
    expect(summary.categories[0].amount).toBe(400_000);
    expect(summary.busiest?.date).toBe('2026-09-17');
  });

  it('names no busiest day when nothing went out', () => {
    const summary = summarizeRange(history, '2026-09-18', '2026-09-18', ALL_HISTORY);
    expect(summary.in).toBe(1_200_000);
    expect(summary.out).toBe(0);
    expect(summary.busiest).toBeNull();
    expect(summary.categories).toEqual([]);
  });

  it('reports an empty range instead of dividing by zero', () => {
    const summary = summarizeRange([], '2026-09-17', '2026-09-17', ALL_HISTORY);
    expect(summary).toMatchObject({ days: 1, count: 0, in: 0, out: 0, dailyAverage: 0, busiest: null });
    expect(summary.categories).toEqual([]);
  });
});

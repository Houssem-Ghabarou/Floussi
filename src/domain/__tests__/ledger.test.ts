import { billOccurrences, nextDueAfter, occurrenceDates } from '../bills';
import { buildFinancialInput, computeBalance, countsToBalance, cycleBillOccurrences } from '../derive';
import { calculateFinancialStatus } from '../engine';
import { summarizeCycle } from '../insights';
import type { AppData, Bill, Routine, Settings, Transaction } from '../types';

const tnd = (value: number) => Math.round(value * 1000);

const settings: Settings = {
  currency: 'TND',
  openingBalance: tnd(900),
  openingDate: '2026-09-14',
  minimumBalance: tnd(100),
  unexpectedIncomeSavePercent: 50,
  onboarded: true,
};

let nextId = 0;
function tx(partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amount' | 'date'>): Transaction {
  return {
    id: `t${nextId++}`,
    category: null,
    note: null,
    billId: null,
    billDueDate: null,
    countsToBalance: countsToBalance(partial.date, settings),
    createdAt: 0,
    ...partial,
  };
}

function bill(partial: Partial<Bill>): Bill {
  return {
    id: 'b1',
    name: 'Rent',
    emoji: '🏠',
    amount: tnd(700),
    recurring: true,
    dueDay: 1,
    dueDate: null,
    archived: false,
    createdOn: null,
    ...partial,
  };
}

const workday: Routine = {
  id: 'r1',
  name: 'Workday',
  emoji: '☀️',
  weekdays: [1, 2, 3, 4, 5],
  enabled: true,
  items: [
    { id: 'i1', name: 'Lunch', amount: tnd(12), category: 'food' },
    { id: 'i2', name: 'Coffee', amount: tnd(4), category: 'coffee' },
  ],
};

describe('bill occurrences', () => {
  it('finds monthly occurrences inside the window', () => {
    expect(occurrenceDates(bill({ dueDay: 5 }), '2026-09-14', '2026-09-30')).toEqual([]);
    expect(occurrenceDates(bill({ dueDay: 5 }), '2026-09-14', '2026-10-10')).toEqual(['2026-10-05']);
    expect(occurrenceDates(bill({ dueDay: 31 }), '2027-02-01', '2027-02-28')).toEqual(['2027-02-28']);
  });

  it('keeps one-off bills protected until paid', () => {
    const oneOff = bill({ recurring: false, dueDay: null });
    expect(occurrenceDates(oneOff, '2026-09-14', '2026-09-30')).toEqual(['2026-09-30']);
    expect(occurrenceDates({ ...oneOff, dueDate: '2026-09-02' }, '2026-09-14', '2026-09-30')).toEqual(['2026-09-02']);
    expect(occurrenceDates({ ...oneOff, dueDate: '2026-10-15' }, '2026-09-14', '2026-09-30')).toEqual([]);
    expect(occurrenceDates({ ...oneOff, archived: true }, '2026-09-14', '2026-09-30')).toEqual([]);
  });

  it('matches payments to the right recurring occurrence', () => {
    const rent = bill({ dueDay: 20 });
    const payment = tx({ kind: 'bill_payment', amount: tnd(-700), date: '2026-09-19', billId: 'b1', billDueDate: '2026-09-20' });
    const [september, october] = billOccurrences([rent], [payment], '2026-09-14', '2026-10-25');
    expect(september).toMatchObject({ dueDate: '2026-09-20', paid: true, paidAmount: tnd(700) });
    expect(october).toMatchObject({ dueDate: '2026-10-20', paid: false });
  });
});

describe('due dates that already passed', () => {
  const firstCycle: AppData['cycle'] = {
    id: 'c1',
    startDate: '2026-09-14',
    nextIncomeDate: '2026-09-30',
    expectedIncome: null,
    incomeLabel: 'Salary',
    frequency: 'monthly',
    savingsTarget: 0,
    closedAt: null,
    startedAt: null,
  };

  it('includes this month’s passed due date of a bill added today, instead of assuming it was paid', () => {
    const rent = bill({ dueDay: 5, createdOn: '2026-09-14' });
    expect(occurrenceDates(rent, '2026-09-14', '2026-09-30')).toEqual(['2026-09-05']);
    expect(occurrenceDates({ ...rent, dueDay: 20 }, '2026-09-14', '2026-09-30')).toEqual(['2026-09-20']);
  });

  it('keeps unpaid occurrences from up to a month before the cycle', () => {
    const rent = bill({ dueDay: 5, createdOn: '2026-01-10' });
    expect(occurrenceDates(rent, '2026-09-30', '2026-10-30')).toEqual(['2026-09-05', '2026-10-05']);
  });

  it('protects an unanswered or "not yet" bill as overdue', () => {
    const data: AppData = {
      settings,
      cycle: firstCycle,
      transactions: [],
      bills: [bill({ dueDay: 5, createdOn: '2026-09-14' })],
      routines: [],
    };
    expect(calculateFinancialStatus(buildFinancialInput(data, '2026-09-14')).billsProtected).toBe(tnd(700));
  });

  it('"already paid" before tracking releases the protection without changing the balance', () => {
    const data: AppData = {
      settings,
      cycle: firstCycle,
      transactions: [
        tx({ kind: 'bill_payment', amount: tnd(-700), date: '2026-09-05', billId: 'b1', billDueDate: '2026-09-05' }),
      ],
      bills: [bill({ dueDay: 5, createdOn: '2026-09-14' })],
      routines: [],
    };
    const status = calculateFinancialStatus(buildFinancialInput(data, '2026-09-14'));
    expect(status.billsProtected).toBe(0);
    expect(status.balance).toBe(tnd(900));
    expect(cycleBillOccurrences(data, '2026-09-14')).toMatchObject([{ dueDate: '2026-09-05', paid: true }]);
  });

  it('finds the next due date after a day', () => {
    expect(nextDueAfter(bill({ dueDay: 5 }), '2026-09-30')).toBe('2026-10-05');
    expect(nextDueAfter(bill({ dueDay: 31 }), '2026-02-27')).toBe('2026-02-28');
    expect(nextDueAfter(bill({ recurring: false, dueDay: null, dueDate: '2026-10-15' }), '2026-09-30')).toBe(
      '2026-10-15',
    );
  });
});

describe('ledger → engine', () => {
  it('paying a bill or moving savings leaves flexible money unchanged', () => {
    const base: AppData = {
      settings,
      cycle: {
        id: 'c1',
        startDate: '2026-09-14',
        nextIncomeDate: '2026-09-30',
        expectedIncome: tnd(2500),
        incomeLabel: 'Salary',
        frequency: 'monthly',
        savingsTarget: tnd(100),
        closedAt: null,
        startedAt: null,
      },
      transactions: [],
      bills: [bill({ name: 'Internet', amount: tnd(50), dueDay: 25 })],
      routines: [],
    };
    const before = calculateFinancialStatus(buildFinancialInput(base, '2026-09-20'));

    const after = calculateFinancialStatus(
      buildFinancialInput(
        {
          ...base,
          transactions: [
            tx({ kind: 'bill_payment', amount: tnd(-50), date: '2026-09-20', billId: 'b1', billDueDate: '2026-09-25' }),
            tx({ kind: 'savings_transfer', amount: tnd(-100), date: '2026-09-20' }),
          ],
        },
        '2026-09-20',
      ),
    );

    expect(before.flexibleNow).toBe(tnd(900 - 50 - 100 - 100));
    expect(after.balance).toBe(tnd(750));
    expect(after.flexibleNow).toBe(before.flexibleNow);
    expect(after.spentToday).toBe(0);
  });

  it('history entered after onboarding does not change the balance', () => {
    const transactions = [
      tx({ kind: 'expense', amount: tnd(-200), date: '2026-09-05', category: 'food' }),
      tx({ kind: 'expense', amount: tnd(-12), date: '2026-09-14', category: 'food' }),
    ];
    expect(transactions[0].countsToBalance).toBe(false);
    expect(computeBalance(settings, transactions)).toBe(tnd(888));
  });
});

describe('cycle summary', () => {
  const transactions = [
    tx({ kind: 'expense', amount: tnd(-200), date: '2026-09-05', category: 'food' }),
    tx({ kind: 'bill_payment', amount: tnd(-700), date: '2026-09-05', billId: 'b1', billDueDate: '2026-09-05' }),
    tx({ kind: 'expense', amount: tnd(-12), date: '2026-09-14', category: 'food' }),
    tx({ kind: 'expense', amount: tnd(-4), date: '2026-09-14', category: 'coffee' }),
    tx({ kind: 'expense', amount: tnd(-130), date: '2026-09-15', category: 'food' }),
    tx({ kind: 'income', amount: tnd(300), date: '2026-09-16', category: 'freelance' }),
    tx({ kind: 'bill_payment', amount: tnd(-50), date: '2026-09-20', billId: 'b1', billDueDate: '2026-09-25' }),
    tx({ kind: 'savings_transfer', amount: tnd(-100), date: '2026-09-21' }),
    tx({ kind: 'adjustment', amount: tnd(-35), date: '2026-09-22' }),
    tx({ kind: 'expense', amount: tnd(-99), date: '2026-09-23', category: 'fun' }),
  ];

  const summary = summarizeCycle({
    settings,
    transactions,
    routines: [workday],
    start: { date: '2026-09-14', at: null },
    end: { date: '2026-09-23', at: null },
  });

  const addsUp = (s: typeof summary) =>
    s.startingBalance + s.income - s.spending - s.billsPaid - s.savedMoved + s.adjustments === s.endingBalance;

  it('reconciles starting and ending balance', () => {
    expect(summary.startingBalance).toBe(tnd(900));
    expect(summary.endingBalance).toBe(tnd(900 - 12 - 4 - 130 + 300 - 50 - 100 - 35));
    expect(summary.income).toBe(tnd(300));
    expect(summary.spending).toBe(tnd(146));
    expect(summary.billsPaid).toBe(tnd(50));
    expect(summary.savedMoved).toBe(tnd(100));
    expect(summary.adjustments).toBe(tnd(-35));
    expect(addsUp(summary)).toBe(true);
  });

  it('shows history from before tracking in the first cycle only, outside the balance lines', () => {
    expect(summary.historicalSpending).toBe(tnd(900));
    expect(summary.categories.find((c) => c.category.id === 'bills')?.actual).toBe(tnd(750));

    const later = summarizeCycle({
      settings,
      transactions,
      routines: [workday],
      start: { date: '2026-09-16', at: null },
      end: { date: '2026-09-23', at: null },
    });
    expect(later.historicalSpending).toBe(0);
    expect(later.startingBalance).toBe(tnd(900 - 12 - 4 - 130));
    expect(addsUp(later)).toBe(true);
  });

  it('splits payday between cycles at the moment the income was recorded', () => {
    const payday = [
      tx({ kind: 'expense', amount: tnd(-4), date: '2026-09-30', category: 'coffee', createdAt: 1_000 }),
      tx({ kind: 'income', amount: tnd(2500), date: '2026-09-30', category: 'salary', createdAt: 5_000 }),
      tx({ kind: 'expense', amount: tnd(-12), date: '2026-09-30', category: 'food', createdAt: 9_000 }),
    ];
    const boundary = { date: '2026-09-30', at: 5_000 };
    const ended = summarizeCycle({
      settings,
      transactions: payday,
      routines: [],
      start: { date: '2026-09-14', at: null },
      end: boundary,
    });
    const next = summarizeCycle({
      settings,
      transactions: payday,
      routines: [],
      start: boundary,
      end: { date: '2026-10-01', at: null },
    });

    expect(ended.income).toBe(0);
    expect(ended.spending).toBe(tnd(4));
    expect(ended.endingBalance).toBe(tnd(896));
    expect(next.startingBalance).toBe(ended.endingBalance);
    expect(next.income).toBe(tnd(2500));
    expect(next.endingBalance).toBe(tnd(896 + 2500 - 12));
    expect(addsUp(ended) && addsUp(next)).toBe(true);
  });

  it('counts money added today when summarizing everything so far', () => {
    const result = summarizeCycle({
      settings,
      transactions: [tx({ kind: 'income', amount: tnd(300), date: '2026-09-14', category: 'freelance', createdAt: 1 })],
      routines: [],
      start: { date: '2026-09-14', at: null },
      end: { date: '2026-09-15', at: null },
    });
    expect(result.income).toBe(tnd(300));
    expect(result.endingBalance).toBe(tnd(1200));
  });

  it('compares actual spending with routines on tracked days only', () => {
    // Sep 14 → Sep 22: 7 workdays.
    expect(summary.trackedDays).toBe(9);
    const food = summary.categories.find((c) => c.category.id === 'food')!;
    expect(food.actual).toBe(tnd(342));
    expect(food.trackedActual).toBe(tnd(142));
    expect(food.expected).toBe(tnd(84));
    expect(summary.biggest?.category.id).toBe('food');
    expect(summary.mostOverRoutine?.category.id).toBe('food');
    expect(summary.categories.some((c) => c.category.id === 'fun')).toBe(false);
  });
});

import { EMPTY_WIDGET, widgetTimeline } from '../widget-snapshot';
import type { AppData, Transaction } from '../types';

const lunch: Transaction = {
  id: 't1',
  kind: 'expense',
  amount: -20_000,
  category: 'food',
  note: null,
  date: '2026-09-14',
  billId: null,
  billDueDate: null,
  countsToBalance: true,
  createdAt: 1,
};

function appData(transactions: Transaction[] = [], widgetHideAmounts = false): AppData {
  return {
    settings: {
      currency: 'TND',
      openingBalance: 900_000,
      openingDate: '2026-09-14',
      minimumBalance: 0,
      dailyNeed: null,
      unexpectedIncomeSavePercent: 0,
      onboarded: true,
      widgetHideAmounts,
    },
    cycle: {
      id: 'c1',
      startDate: '2026-09-14',
      startedAt: null,
      nextIncomeDate: '2026-09-30',
      expectedIncome: null,
      incomeLabel: 'Salary',
      frequency: 'monthly',
      savingsTarget: 0,
      closedAt: null,
    },
    bills: [],
    transactions,
    routines: [],
  };
}

describe('widget content', () => {
  it("shows today's safe amount, then tomorrow's from midnight", () => {
    const [today, tomorrow] = widgetTimeline(appData(), '2026-09-14');
    // 900 TND over 16 days, then over 15 days.
    expect(today).toEqual({
      date: '2026-09-14',
      props: {
        ready: true,
        hidden: false,
        amount: '56',
        currency: 'TND',
        caption: 'safe today',
        status: 'Breathing room',
        tone: 'good',
        balance: '900 TND available',
        payday: '16 days to payday',
      },
    });
    expect(tomorrow).toMatchObject({ date: '2026-09-15', props: { amount: '60', payday: '15 days to payday' } });
  });

  it("shows what's left once something was spent, and tomorrow starts fresh", () => {
    const [today, tomorrow] = widgetTimeline(appData([lunch]), '2026-09-14');
    expect(today.props).toMatchObject({ amount: '36', caption: 'left today', balance: '880 TND available' });
    expect(tomorrow.props).toMatchObject({ amount: '59', caption: 'safe today' });
  });

  it('can hide amounts but keeps the status', () => {
    const [today] = widgetTimeline(appData([], true), '2026-09-14');
    expect(today.props).toMatchObject({ hidden: true, amount: '•••', balance: '••• available', status: 'Breathing room' });
  });

  it('invites to set up a plan before onboarding', () => {
    expect(widgetTimeline(null, '2026-09-14')).toEqual([{ date: '2026-09-14', props: EMPTY_WIDGET }]);
  });
});

import { DEFAULT_REMINDERS, formatMinutes, planReminders } from '../reminders';
import type { AppData, Bill, Transaction } from '../types';

const bill = (patch: Partial<Bill>): Bill => ({
  id: 'b',
  name: 'Bill',
  emoji: '🧾',
  amount: 50_000,
  recurring: true,
  dueDay: 20,
  dueDate: null,
  archived: false,
  createdOn: '2026-09-14',
  ...patch,
});

const rentPaid: Transaction = {
  id: 't1',
  kind: 'bill_payment',
  amount: -400_000,
  category: null,
  note: null,
  date: '2026-09-14',
  billId: 'rent',
  billDueDate: '2026-09-25',
  countsToBalance: true,
  createdAt: 1,
};

function appData(patch: Partial<AppData['settings']> = {}): AppData {
  return {
    settings: {
      currency: 'TND',
      openingBalance: 900_000,
      openingDate: '2026-09-14',
      minimumBalance: 0,
      dailyNeed: null,
      unexpectedIncomeSavePercent: 0,
      onboarded: true,
      ...patch,
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
    bills: [
      bill({ id: 'internet', name: 'Internet', emoji: '🌐', dueDay: 20 }),
      bill({ id: 'rent', name: 'Rent', emoji: '🏠', amount: 400_000, dueDay: 25 }),
      bill({ id: 'gift', name: 'Gift', recurring: false, dueDay: null, dueDate: null }),
    ],
    transactions: [rentPaid],
    routines: [],
  };
}

const onceDates = (reminders: ReturnType<typeof planReminders>) =>
  reminders.map((reminder) => [reminder.id, reminder.schedule.type === 'once' ? reminder.schedule.date : 'daily']);

describe('reminder plan', () => {
  it('reminds the day before unpaid dated bills, then payday, with the inactivity check first', () => {
    expect(onceDates(planReminders(appData(), '2026-09-14', 8 * 60))).toEqual([
      ['inactivity', '2026-09-17'],
      ['bill:internet:2026-09-20', '2026-09-19'],
      ['payday:c1:2026-09-30', '2026-09-30'],
      ['bill:internet:2026-10-20', '2026-10-19'],
      ['bill:rent:2026-10-25', '2026-10-24'],
    ]);
  });

  it('writes calm texts that open the right screen', () => {
    const [, internet, payday] = planReminders(appData(), '2026-09-14', 0);
    expect(internet).toMatchObject({
      title: '🌐 Internet is due tomorrow',
      body: "50 TND. Tap to mark it paid once it's done.",
      url: '/pay-bill?billId=internet&dueDate=2026-09-20',
      schedule: { type: 'once', minutes: 540 },
    });
    expect(payday).toMatchObject({ title: '💼 Your salary is expected today', url: '/income?cycleIncome=1' });
  });

  it('skips reminders whose time has already passed today', () => {
    const plan = planReminders(appData(), '2026-09-19', 10 * 60);
    expect(plan.some((reminder) => reminder.id === 'bill:internet:2026-09-20')).toBe(false);
  });

  it('uses a daily check-in instead of the inactivity reminder when it is on', () => {
    const plan = planReminders(appData({ reminders: { ...DEFAULT_REMINDERS, checkIn: true, checkInMinutes: 1290 } }), '2026-09-14', 0);
    expect(plan[0]).toMatchObject({ id: 'check-in', schedule: { type: 'daily', minutes: 1290 } });
    expect(plan.some((reminder) => reminder.kind === 'inactivity')).toBe(false);
  });

  it('schedules nothing that was turned off', () => {
    const off = { bills: false, payday: false, checkIn: false, checkInMinutes: 1200, inactivity: false };
    expect(planReminders(appData({ reminders: off }), '2026-09-14', 0)).toEqual([]);
    expect(planReminders(appData({ onboarded: false }), '2026-09-14', 0)).toEqual([]);
  });

  it('formats the check-in time', () => {
    expect(formatMinutes(20 * 60)).toBe('20:00');
    expect(formatMinutes(9 * 60 + 5)).toBe('09:05');
  });
});

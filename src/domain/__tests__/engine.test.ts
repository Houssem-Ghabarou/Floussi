import { buildAdvice } from '../advice';
import { calculateFinancialStatus, type FinancialInput } from '../engine';
import { getCurrency } from '../money';
import { evaluateWhatIf } from '../what-if';

const TND = getCurrency('TND');
const tnd = (value: number) => Math.round(value * 1000);

/** §48 of the spec: September 14, 900 TND, salary on September 30. */
function midMonthInput(overrides: Partial<FinancialInput> = {}): FinancialInput {
  return {
    today: '2026-09-14',
    balance: tnd(900),
    nextIncomeDate: '2026-09-30',
    billsDue: [
      { name: 'Internet', amount: tnd(50), dueDate: '2026-09-25' },
      { name: 'Other', amount: tnd(100), dueDate: '2026-09-30' },
    ],
    savingsReserve: tnd(100),
    minimumBalance: tnd(100),
    dailySpending: {},
    recentBalanceCorrections: 0,
    incomeSinceCorrections: 0,
    trackingStartDate: '2026-09-14',
    routineByWeekday: [0, 0, 0, 0, 0, 0, 0],
    ...overrides,
  };
}

/** Constant spending of `amount` on each of the `days` days before `today`. */
function steadySpending(today: string, days: number, amount: number): Record<string, number> {
  const spending: Record<string, number> = {};
  const [y, m, d] = today.split('-').map(Number);
  for (let i = 1; i <= days; i++) {
    const date = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10);
    spending[date] = amount;
  }
  return spending;
}

describe('spec §48 — complete mid-month user', () => {
  it('starts with 550 flexible and a pace of about 34/day', () => {
    const status = calculateFinancialStatus(midMonthInput());
    expect(status.protectedTotal).toBe(tnd(350));
    expect(status.flexibleNow).toBe(tnd(550));
    expect(status.daysRemaining).toBe(16);
    expect(status.dailyAllowance).toBe(34_375);
    expect(status.riskLevel).toBe('on_track');
  });

  it("keeps today's allowance fixed while spending lowers what's left", () => {
    const status = calculateFinancialStatus(
      midMonthInput({ balance: tnd(876), dailySpending: { '2026-09-14': tnd(24) } }),
    );
    expect(status.dailyAllowance).toBe(34_375);
    expect(status.remainingToday).toBe(10_375);
    expect(status.upcomingDailyPace).toBe(Math.floor(tnd(526) / 15));
    expect(status.riskLevel).toBe('on_track');
  });

  it('flags a 55 TND day without shaming', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        today: '2026-09-15',
        balance: tnd(821),
        dailySpending: { '2026-09-14': tnd(24), '2026-09-15': tnd(55) },
      }),
    );
    expect(status.riskLevel).toBe('watch');
    expect(status.reason).toBe('over_today');
    expect(buildAdvice(status, TND).title).not.toMatch(/exceeded|failed/i);
  });

  it('remembers that yesterday went over before a pace exists', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        today: '2026-09-16',
        balance: tnd(821),
        dailySpending: { '2026-09-14': tnd(24), '2026-09-15': tnd(55) },
      }),
    );
    expect(status.currentPace).toBeNull();
    expect(status.reason).toBe('over_yesterday');
  });

  it('raises the pace to about 55/day after +300 freelance income', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        today: '2026-09-16',
        balance: tnd(1121),
        dailySpending: { '2026-09-14': tnd(24), '2026-09-15': tnd(55) },
      }),
    );
    expect(status.dailyAllowance).toBe(Math.floor(tnd(771) / 14));
    expect(status.riskLevel).toBe('on_track');

    const whatIf = evaluateWhatIf(status, tnd(120), TND);
    expect(whatIf.level).toBe('comfortable');
    expect(whatIf.paceAfter).toBe(Math.floor(tnd(651) / 14));
  });
});

describe('validation scenarios (§59)', () => {
  it('scenario 3 — protected money exceeds the balance', () => {
    const status = calculateFinancialStatus(midMonthInput({ balance: tnd(300) }));
    expect(status.flexibleNow).toBe(tnd(-50));
    expect(status.dailyAllowance).toBe(0);
    expect(status.reason).toBe('protected_exceeds_balance');
  });

  it('bills larger than the balance get a specific suggestion', () => {
    const status = calculateFinancialStatus(midMonthInput({ balance: tnd(120) }));
    expect(buildAdvice(status, TND).suggestion).toContain('30 TND more than you have');
  });

  it('no flexible money at all', () => {
    const status = calculateFinancialStatus(midMonthInput({ balance: tnd(350) }));
    expect(status.reason).toBe('no_flexible_money');
  });

  it('scenario 5 — a large expense today dips into protected money', () => {
    const status = calculateFinancialStatus(
      midMonthInput({ balance: tnd(300), dailySpending: { '2026-09-14': tnd(600) } }),
    );
    expect(status.flexibleStartOfDay).toBe(tnd(550));
    expect(status.reason).toBe('dipping_into_protected');
  });

  it('scenario 6 — overspending several days in a row becomes at risk', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        trackingStartDate: '2026-09-01',
        dailySpending: steadySpending('2026-09-14', 7, tnd(60)),
      }),
    );
    expect(status.currentPace).toBe(tnd(60));
    expect(status.riskLevel).toBe('at_risk');
    expect(status.reason).toBe('pace_unsustainable');
    expect(status.projectedEndFlexible).toBe(tnd(550) - tnd(60) - tnd(60) * 15);
  });

  it('slightly faster than the safe pace is a watch', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        trackingStartDate: '2026-09-01',
        dailySpending: steadySpending('2026-09-14', 7, tnd(37)),
      }),
    );
    expect(status.reason).toBe('pace_above_safe');
  });

  it('scenario 7 — spending less than normal gives breathing room', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        trackingStartDate: '2026-09-01',
        dailySpending: steadySpending('2026-09-14', 7, tnd(20)),
      }),
    );
    expect(status.riskLevel).toBe('comfortable');
    expect(status.reason).toBe('below_pace');
  });

  it('needs at least 3 tracked days before trusting a pace', () => {
    const status = calculateFinancialStatus(
      midMonthInput({
        trackingStartDate: '2026-09-12',
        dailySpending: steadySpending('2026-09-14', 2, tnd(60)),
      }),
    );
    expect(status.currentPace).toBeNull();
  });

  it('scenario 10 — income date reached or overdue never divides by zero', () => {
    const dueToday = calculateFinancialStatus(midMonthInput({ today: '2026-09-30' }));
    expect(dueToday.daysUntilIncome).toBe(0);
    expect(dueToday.daysRemaining).toBe(1);
    expect(dueToday.incomeDue).toBe(true);
    expect(dueToday.dailyAllowance).toBe(tnd(550));

    const overdue = calculateFinancialStatus(midMonthInput({ today: '2026-10-02' }));
    expect(overdue.daysRemaining).toBe(1);
    expect(overdue.incomeDue).toBe(true);
  });
});

describe('routines', () => {
  const weekly = (workday: number, weekend: number) => [weekend, workday, workday, workday, workday, workday, weekend];

  it('sums expected spending day by day until payday', () => {
    // Sep 14 (Mon) → Sep 29 (Tue): 12 workdays and 4 weekend days.
    const status = calculateFinancialStatus(midMonthInput({ routineByWeekday: weekly(tnd(24), tnd(35)) }));
    expect(status.expectedToday).toBe(tnd(24));
    expect(status.expectedUntilIncome).toBe(tnd(12 * 24 + 4 * 35));
    expect(status.reason).toBe('steady');
  });

  it('warns when the normal routine costs more than the safe pace', () => {
    const status = calculateFinancialStatus(midMonthInput({ routineByWeekday: weekly(tnd(40), tnd(50)) }));
    expect(status.reason).toBe('routine_above_safe');
  });

  it('reports breathing room when the routine is well below the pace', () => {
    const status = calculateFinancialStatus(midMonthInput({ routineByWeekday: weekly(tnd(15), tnd(20)) }));
    expect(status.reason).toBe('routine_below_safe');
  });
});

describe('what-if (§22–23)', () => {
  // 672 flexible over 16 days = 42/day.
  const status = calculateFinancialStatus(midMonthInput({ balance: tnd(1022) }));

  it.each([
    [50, 'comfortable'],
    [180, 'tighter'],
    [250, 'significant'],
    [700, 'touches_protected'],
    [900, 'touches_bills'],
    [2000, 'exceeds_balance'],
  ])('spending %d TND is %s', (amount, level) => {
    expect(evaluateWhatIf(status, tnd(amount), TND).level).toBe(level);
  });

  it('reports the pace before and after', () => {
    const result = evaluateWhatIf(status, tnd(180), TND);
    expect(result.paceBefore).toBe(tnd(42));
    expect(result.paceAfter).toBe(30_750);
  });
});

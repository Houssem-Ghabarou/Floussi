import { buildAdvice } from '../advice';
import { calculateFinancialStatus, type FinancialInput } from '../engine';
import { getCurrency } from '../money';
import { evaluateWhatIf } from '../what-if';

const TND = getCurrency('TND');
const tnd = (value: number) => Math.round(value * 1000);

/** Sep 14 → Sep 30 (16 days), nothing protected, a normal day of 15 TND by default. */
function input(overrides: Partial<FinancialInput> = {}): FinancialInput {
  return {
    today: '2026-09-14',
    balance: 0,
    nextIncomeDate: '2026-09-30',
    billsDue: [],
    savingsReserve: 0,
    minimumBalance: 0,
    dailySpending: {},
    recentBalanceCorrections: 0,
    incomeSinceCorrections: 0,
    trackingStartDate: '2026-09-14',
    routineByWeekday: [0, 0, 0, 0, 0, 0, 0],
    dailyNeed: tnd(15),
    dailyNeedIsDefault: true,
    ...overrides,
  };
}

/** A plan whose safe pace is exactly `perDay` TND. */
const pacePerDay = (perDay: number, overrides: Partial<FinancialInput> = {}) =>
  calculateFinancialStatus(input({ balance: tnd(perDay * 16), ...overrides }));

describe('status color from the safe pace vs a normal day (15 TND)', () => {
  it.each([
    [3, 'at_risk', 'very_tight'],
    [7, 'at_risk', 'very_tight'],
    [7.5, 'watch', 'tight'],
    [10, 'watch', 'tight'],
    [15, 'on_track', 'on_track'],
    [20, 'on_track', 'on_track'],
    [22.5, 'comfortable', 'comfortable'],
    [34, 'comfortable', 'comfortable'],
  ])('%d TND/day is %s (%s)', (perDay, riskLevel, reason) => {
    const status = pacePerDay(perDay);
    expect(status.riskLevel).toBe(riskLevel);
    expect(status.reason).toBe(reason);
  });

  it('uses the normal day the user set', () => {
    const status = pacePerDay(8, { dailyNeed: tnd(8), dailyNeedIsDefault: false });
    expect(status.normalDaySource).toBe('custom');
    expect(status.reason).toBe('on_track');
  });

  it('uses routines when there are some', () => {
    const status = pacePerDay(15, { routineByWeekday: Array(7).fill(tnd(20)) });
    expect(status.normalDaySource).toBe('routines');
    expect(status.normalDay).toBe(tnd(20));
    expect(status.reason).toBe('tight');
  });

  it('keeps the figure the user set, even when routines exist', () => {
    const status = pacePerDay(15, {
      routineByWeekday: Array(7).fill(tnd(20)),
      dailyNeed: tnd(12),
      dailyNeedIsDefault: false,
    });
    expect(status.normalDaySource).toBe('custom');
    expect(status.normalDay).toBe(tnd(12));
    expect(status.reason).toBe('on_track');
  });

  it('tells a user on the default to set their own normal day', () => {
    expect(buildAdvice(pacePerDay(3), TND).suggestion).toContain('Rules → Protections');
    expect(buildAdvice(pacePerDay(3, { dailyNeedIsDefault: false }), TND).suggestion).not.toContain('Protections');
  });
});

describe('status color from what is left today', () => {
  // A 34 TND/day plan: 544 flexible over 16 days.
  const spent = (amount: number) =>
    calculateFinancialStatus(
      input({ balance: tnd(544 - amount), dailySpending: amount ? { '2026-09-14': tnd(amount) } : {} }),
    );

  it('stays green while a good part of today is left', () => {
    expect(spent(20).reason).toBe('comfortable');
  });

  it('turns yellow when less than 20% of today is left', () => {
    const status = spent(30);
    expect(status.remainingToday).toBe(tnd(4));
    expect(status.riskLevel).toBe('watch');
    expect(status.reason).toBe('almost_used_today');
    expect(buildAdvice(status, TND).title).toBe("You've almost used today's amount");
  });

  it('says so when today is fully used, and over today when passed', () => {
    expect(buildAdvice(spent(34), TND).title).toBe("You've used today's amount");
    expect(spent(40).reason).toBe('over_today');
  });

  it("doesn't warn when what's left still covers a normal day", () => {
    // 200/day plan, 170 spent: 30 left (15%) is still twice a normal day.
    const status = calculateFinancialStatus(
      input({ balance: tnd(3200 - 170), dailySpending: { '2026-09-14': tnd(170) } }),
    );
    expect(status.remainingToday).toBe(tnd(30));
    expect(status.riskLevel).toBe('comfortable');
  });
});

describe('what-if uses the same normal day', () => {
  it('is never comfortable when the pace after would be under a normal day', () => {
    // 20/day → 18.75/day keeps 94% of the pace, but that is still over 15.
    expect(evaluateWhatIf(pacePerDay(20), tnd(20), TND).level).toBe('comfortable');
    // 16/day → 14/day keeps 88% of the pace, but it's under a normal day.
    expect(evaluateWhatIf(pacePerDay(16), tnd(32), TND).level).toBe('tighter');
    // 8/day → 6/day is under half a normal day.
    expect(evaluateWhatIf(pacePerDay(8), tnd(32), TND).level).toBe('significant');
  });
});

/**
 * The financial engine: pure, deterministic, UI-independent.
 * See SPEC/Audit_and_Recommendations.md §2 for the reasoning behind every formula.
 */
import { addDays, daysBetween, eachDay, maxDate, weekday, type LocalDate } from './dates';
import type { Minor } from './money';

export interface ProtectedBill {
  name: string;
  amount: Minor;
  dueDate: LocalDate;
}

export interface FinancialInput {
  today: LocalDate;
  balance: Minor;
  nextIncomeDate: LocalDate;
  /** Unpaid bill occurrences due before (or on) the next income. */
  billsDue: ProtectedBill[];
  /** Savings still to set aside this cycle. */
  savingsReserve: Minor;
  minimumBalance: Minor;
  /** Discretionary spending per tracked day (positive minor units), including today. */
  dailySpending: Record<LocalDate, Minor>;
  /** Net balance corrections recorded during the last week (negative = spending that went untracked). */
  recentBalanceCorrections: Minor;
  /** Income recorded after the first of those corrections: new money that can make up for the drop. */
  incomeSinceCorrections: Minor;
  /** First day whose spending is fully tracked (later of cycle start and opening date). */
  trackingStartDate: LocalDate;
  /** Expected routine spending per weekday, index 0 = Sunday. */
  routineByWeekday: Minor[];
  /** What a normal day costs when routines don't say (the user's setting or the currency default). */
  dailyNeed: Minor;
  dailyNeedIsDefault: boolean;
}

/** 🟢 comfortable / 🟢 on_track / 🟡 watch / 🔴 at_risk */
export type RiskLevel = 'comfortable' | 'on_track' | 'watch' | 'at_risk';

/** Why the status has its color. Listed from most to least severe, in the order they are checked. */
export type StatusReason =
  // 🔴
  | 'protected_exceeds_balance'
  | 'no_flexible_money'
  | 'dipping_into_protected'
  | 'untracked_spending'
  | 'pace_unsustainable'
  | 'very_tight'
  // 🟡
  | 'pace_above_safe'
  | 'over_today'
  | 'almost_used_today'
  | 'over_yesterday'
  | 'tight'
  // 🟢
  | 'on_track'
  | 'comfortable';

/** Where the normal-day reference comes from. */
export type NormalDaySource = 'routines' | 'custom' | 'default';

export interface FinancialStatus {
  balance: Minor;
  billsProtected: Minor;
  savingsReserve: Minor;
  minimumBalance: Minor;
  protectedTotal: Minor;
  flexibleNow: Minor;
  flexibleStartOfDay: Minor;
  /** Raw days until the income date (0 = today, negative = overdue). */
  daysUntilIncome: number;
  /** Spending days left including today, at least 1. */
  daysRemaining: number;
  incomeDue: boolean;
  /** Safe amount for today, fixed from the start of the day. */
  dailyAllowance: Minor;
  spentToday: Minor;
  /** Allowance minus today's spending; negative when over. */
  remainingToday: Minor;
  /** Safe pace for the days after today. */
  upcomingDailyPace: Minor;
  hasRoutines: boolean;
  expectedToday: Minor;
  expectedUntilIncome: Minor;
  expectedDailyAverage: Minor;
  /** What a normal day costs: the reference that decides tight / on track / comfortable. */
  normalDay: Minor;
  normalDaySource: NormalDaySource;
  /** Recent average daily spending, null until enough tracked days exist. */
  currentPace: Minor | null;
  paceDays: number;
  /** Flexible money left at the income date if the current pace continues. */
  projectedEndFlexible: Minor | null;
  /** Untracked spending found over the last week. */
  recentUntrackedSpending: Minor;
  /** What today's safe pace would be without that untracked spending. */
  paceWithoutUntracked: Minor;
  riskLevel: RiskLevel;
  reason: StatusReason;
}

export const PACE_WINDOW_DAYS = 7;
export const MIN_PACE_DAYS = 3;

export const THRESHOLDS = {
  /** Safe pace vs a normal day: 🔴 below half, 🟡 below one, 🟢 comfortable from one and a half. */
  veryTightBelow: 0.5,
  comfortableFrom: 1.5,
  /** Recent spending pace vs safe pace: 🟡 above 105%, 🔴 above 125%. */
  paceWatchAbove: 1.05,
  paceAtRiskAbove: 1.25,
  /** 🟡 when less than this share of today's amount is left (and less than a normal day). */
  almostUsedBelow: 0.2,
  /** Share of the daily pace kept after untracked spending: 🟡 below 90%, 🔴 below 65%. */
  untrackedWatchBelow: 0.9,
  untrackedAtRiskBelow: 0.65,
} as const;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function calculateFinancialStatus(input: FinancialInput): FinancialStatus {
  const { today } = input;

  const daysUntilIncome = daysBetween(today, input.nextIncomeDate);
  const daysRemaining = Math.max(1, daysUntilIncome);

  const billsProtected = sum(input.billsDue.map((bill) => bill.amount));
  const protectedTotal = billsProtected + input.savingsReserve + input.minimumBalance;
  const flexibleNow = input.balance - protectedTotal;

  const spentToday = input.dailySpending[today] ?? 0;
  const flexibleStartOfDay = flexibleNow + spentToday;
  const dailyAllowance = flexibleStartOfDay > 0 ? Math.floor(flexibleStartOfDay / daysRemaining) : 0;
  const remainingToday = dailyAllowance - spentToday;
  const upcomingDailyPace =
    daysRemaining > 1
      ? Math.floor(Math.max(0, flexibleNow) / (daysRemaining - 1))
      : Math.max(0, remainingToday);

  // Routines: expected spending, day by day, until the income date.
  const hasRoutines = input.routineByWeekday.some((amount) => amount > 0);
  const remainingDates = daysUntilIncome > 0 ? eachDay(today, input.nextIncomeDate) : [today];
  const expectedToday = input.routineByWeekday[weekday(today)] ?? 0;
  const expectedUntilIncome = sum(remainingDates.map((date) => input.routineByWeekday[weekday(date)] ?? 0));
  const expectedDailyAverage = Math.round(expectedUntilIncome / remainingDates.length);

  // A normal day: the figure the user set always wins. Routines only fill in when there is none, and
  // the currency default when there are no routines either.
  const routinesAverage = hasRoutines && expectedDailyAverage > 0 ? expectedDailyAverage : null;
  const usesRoutines = input.dailyNeedIsDefault && routinesAverage !== null;
  const normalDay = usesRoutines ? routinesAverage : input.dailyNeed;
  const normalDaySource: NormalDaySource = usesRoutines ? 'routines' : input.dailyNeedIsDefault ? 'default' : 'custom';

  // Recent pace over the last full tracked days (today excluded, it isn't over yet).
  const paceStart = maxDate(addDays(today, -PACE_WINDOW_DAYS), input.trackingStartDate);
  const paceDays = Math.max(0, daysBetween(paceStart, today));
  const currentPace =
    paceDays >= MIN_PACE_DAYS
      ? Math.round(sum(eachDay(paceStart, today).map((date) => input.dailySpending[date] ?? 0)) / paceDays)
      : null;

  const projectedEndFlexible =
    currentPace === null
      ? null
      : flexibleStartOfDay - Math.max(spentToday, currentPace) - currentPace * (daysRemaining - 1);

  const yesterday = addDays(today, -1);
  const spentYesterday = yesterday >= input.trackingStartDate ? (input.dailySpending[yesterday] ?? null) : null;

  // Untracked spending found this week, compared with the pace you'd have without it. Money added after it
  // was found is left out of that reference: it's new money that can make up for the drop, not hide it.
  const recentUntrackedSpending = Math.max(0, -input.recentBalanceCorrections);
  const paceWithoutUntracked = Math.floor(
    Math.max(0, flexibleStartOfDay - input.incomeSinceCorrections + recentUntrackedSpending) / daysRemaining,
  );

  const { riskLevel, reason } = assessRisk({
    flexibleNow,
    flexibleStartOfDay,
    dailyAllowance,
    remainingToday,
    upcomingDailyPace,
    daysRemaining,
    spentToday,
    spentYesterday,
    currentPace,
    normalDay,
    recentUntrackedSpending,
    paceWithoutUntracked,
  });

  return {
    balance: input.balance,
    billsProtected,
    savingsReserve: input.savingsReserve,
    minimumBalance: input.minimumBalance,
    protectedTotal,
    flexibleNow,
    flexibleStartOfDay,
    daysUntilIncome,
    daysRemaining,
    incomeDue: daysUntilIncome <= 0,
    dailyAllowance,
    spentToday,
    remainingToday,
    upcomingDailyPace,
    hasRoutines,
    expectedToday,
    expectedUntilIncome,
    expectedDailyAverage,
    normalDay,
    normalDaySource,
    currentPace,
    paceDays,
    projectedEndFlexible,
    recentUntrackedSpending,
    paceWithoutUntracked,
    riskLevel,
    reason,
  };
}

interface RiskFactors {
  flexibleNow: Minor;
  flexibleStartOfDay: Minor;
  dailyAllowance: Minor;
  remainingToday: Minor;
  upcomingDailyPace: Minor;
  daysRemaining: number;
  spentToday: Minor;
  spentYesterday: Minor | null;
  currentPace: Minor | null;
  normalDay: Minor;
  recentUntrackedSpending: Minor;
  paceWithoutUntracked: Minor;
}

/**
 * The status color. Rules are checked from most to least severe; the first one that matches wins.
 *
 * 🔴 money is short now, the pace covers less than half a normal day, or spending is far too fast
 * 🟡 the pace doesn't cover a normal day, today's amount is (almost) used, or spending is a bit fast
 * 🟢 the pace covers a normal day — with breathing room from one and a half normal days
 */
function assessRisk(f: RiskFactors): { riskLevel: RiskLevel; reason: StatusReason } {
  const red = (reason: StatusReason) => ({ riskLevel: 'at_risk' as const, reason });
  const yellow = (reason: StatusReason) => ({ riskLevel: 'watch' as const, reason });
  const allowance = f.dailyAllowance;
  const untrackedPaceKept =
    f.recentUntrackedSpending > 0 && f.paceWithoutUntracked > 0 ? allowance / f.paceWithoutUntracked : 1;

  // 🔴 Money is short right now.
  if (f.flexibleStartOfDay < 0) return red('protected_exceeds_balance');
  if (allowance === 0) return red('no_flexible_money');
  if (f.flexibleNow < 0) return red('dipping_into_protected');
  if (f.daysRemaining > 1 && f.upcomingDailyPace === 0) return red('no_flexible_money');

  // 🔴 The coming days won't be covered.
  if (untrackedPaceKept < THRESHOLDS.untrackedAtRiskBelow) return red('untracked_spending');
  if (f.currentPace !== null && f.currentPace > allowance * THRESHOLDS.paceAtRiskAbove) {
    return red('pace_unsustainable');
  }
  if (allowance < f.normalDay * THRESHOLDS.veryTightBelow) return red('very_tight');

  // 🟡 Worth slowing down.
  if (untrackedPaceKept < THRESHOLDS.untrackedWatchBelow) return yellow('untracked_spending');
  if (f.currentPace !== null && f.currentPace > allowance * THRESHOLDS.paceWatchAbove) {
    return yellow('pace_above_safe');
  }
  if (f.spentToday > allowance) return yellow('over_today');
  if (
    f.spentToday > 0 &&
    f.remainingToday < allowance * THRESHOLDS.almostUsedBelow &&
    f.remainingToday < f.normalDay
  ) {
    return yellow('almost_used_today');
  }
  if (f.currentPace === null && f.spentYesterday !== null && f.spentYesterday > allowance * THRESHOLDS.paceWatchAbove) {
    return yellow('over_yesterday');
  }
  if (allowance < f.normalDay) return yellow('tight');

  // 🟢 The pace covers a normal day.
  if (allowance >= f.normalDay * THRESHOLDS.comfortableFrom) return { riskLevel: 'comfortable', reason: 'comfortable' };
  return { riskLevel: 'on_track', reason: 'on_track' };
}

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
  /** First day whose spending is fully tracked (later of cycle start and opening date). */
  trackingStartDate: LocalDate;
  /** Expected routine spending per weekday, index 0 = Sunday. */
  routineByWeekday: Minor[];
}

export type RiskLevel = 'comfortable' | 'on_track' | 'watch' | 'at_risk';

export type StatusReason =
  | 'protected_exceeds_balance'
  | 'no_flexible_money'
  | 'dipping_into_protected'
  | 'pace_unsustainable'
  | 'pace_above_safe'
  | 'over_today'
  | 'over_yesterday'
  | 'routine_above_safe'
  | 'below_pace'
  | 'routine_below_safe'
  | 'steady';

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
  /** Recent average daily spending, null until enough tracked days exist. */
  currentPace: Minor | null;
  paceDays: number;
  /** Flexible money left at the income date if the current pace continues. */
  projectedEndFlexible: Minor | null;
  riskLevel: RiskLevel;
  reason: StatusReason;
}

export const PACE_WINDOW_DAYS = 7;
export const MIN_PACE_DAYS = 3;
export const THRESHOLDS = {
  comfortableBelow: 0.7,
  watchAbove: 1.05,
  atRiskAbove: 1.25,
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

  const { riskLevel, reason } = assessRisk({
    flexibleNow,
    flexibleStartOfDay,
    dailyAllowance,
    spentToday,
    spentYesterday,
    currentPace,
    expectedDailyAverage: hasRoutines ? expectedDailyAverage : null,
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
    currentPace,
    paceDays,
    projectedEndFlexible,
    riskLevel,
    reason,
  };
}

interface RiskFactors {
  flexibleNow: Minor;
  flexibleStartOfDay: Minor;
  dailyAllowance: Minor;
  spentToday: Minor;
  spentYesterday: Minor | null;
  currentPace: Minor | null;
  expectedDailyAverage: Minor | null;
}

function assessRisk(f: RiskFactors): { riskLevel: RiskLevel; reason: StatusReason } {
  if (f.flexibleStartOfDay < 0) return { riskLevel: 'at_risk', reason: 'protected_exceeds_balance' };
  if (f.dailyAllowance === 0) return { riskLevel: 'at_risk', reason: 'no_flexible_money' };
  if (f.flexibleNow < 0) return { riskLevel: 'at_risk', reason: 'dipping_into_protected' };

  const allowance = f.dailyAllowance;
  if (f.currentPace !== null) {
    if (f.currentPace > allowance * THRESHOLDS.atRiskAbove) {
      return { riskLevel: 'at_risk', reason: 'pace_unsustainable' };
    }
    if (f.currentPace > allowance * THRESHOLDS.watchAbove) {
      return { riskLevel: 'watch', reason: 'pace_above_safe' };
    }
  }
  if (f.spentToday > allowance) return { riskLevel: 'watch', reason: 'over_today' };
  if (f.currentPace === null && f.spentYesterday !== null && f.spentYesterday > allowance * THRESHOLDS.watchAbove) {
    return { riskLevel: 'watch', reason: 'over_yesterday' };
  }
  if (f.expectedDailyAverage !== null && f.expectedDailyAverage > allowance * THRESHOLDS.watchAbove) {
    return { riskLevel: 'watch', reason: 'routine_above_safe' };
  }
  if (f.currentPace !== null && f.currentPace < allowance * THRESHOLDS.comfortableBelow) {
    return { riskLevel: 'comfortable', reason: 'below_pace' };
  }
  if (
    f.currentPace === null &&
    f.expectedDailyAverage !== null &&
    f.expectedDailyAverage < allowance * THRESHOLDS.comfortableBelow
  ) {
    return { riskLevel: 'comfortable', reason: 'routine_below_safe' };
  }
  return { riskLevel: 'on_track', reason: 'steady' };
}

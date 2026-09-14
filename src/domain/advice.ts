/** Turns engine output into short, supportive, non-judgmental copy. */
import type { FinancialStatus, RiskLevel } from './engine';
import { formatMoney, type CurrencyInfo, type Minor } from './money';

export interface Advice {
  title: string;
  detail: string;
  suggestion: string | null;
}

export const RISK_META: Record<RiskLevel, { emoji: string; label: string }> = {
  comfortable: { emoji: '🟢', label: 'Breathing room' },
  on_track: { emoji: '🟢', label: 'On track' },
  watch: { emoji: '🟡', label: 'Spending faster' },
  at_risk: { emoji: '🔴', label: 'May run short' },
};

export function buildAdvice(s: FinancialStatus, currency: CurrencyInfo): Advice {
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const routineLine = `A normal day costs you about ${m(s.expectedDailyAverage)}. Your safe pace is ${m(s.dailyAllowance)}.`;

  switch (s.reason) {
    case 'protected_exceeds_balance': {
      const billsGap = s.billsProtected - s.balance;
      return {
        title: 'Your plan needs a small adjustment',
        detail: `You have ${m(s.balance)}, but ${m(s.protectedTotal)} is set aside for bills, savings and your minimum balance.`,
        suggestion:
          billsGap > 0
            ? `Your upcoming bills need ${m(billsGap)} more than you have. See if a payment can move after your next income.`
            : `Lowering your savings or minimum balance for this cycle would close the ${m(-s.flexibleStartOfDay)} gap.`,
      };
    }
    case 'no_flexible_money':
      return {
        title: 'No flexible money until your next income',
        detail: 'Your bills, savings and minimum balance are still protected.',
        suggestion: 'Adding income or lowering savings for this cycle would free up some room.',
      };
    case 'dipping_into_protected':
      return {
        title: "You've dipped into protected money",
        detail: `Today's spending went ${m(-s.flexibleNow)} into the money set aside for bills, savings and your minimum balance.`,
        suggestion: 'Holding off on extra spending until your next income keeps your bills covered.',
      };
    case 'untracked_spending':
      return {
        title: 'Your balance was lower than tracked',
        detail: `About ${m(s.recentUntrackedSpending)} went untracked, so your safe pace dropped from ${m(s.paceWithoutUntracked)} to ${m(s.dailyAllowance)}/day.`,
        suggestion: `Try keeping the next few days around ${m(s.upcomingDailyPace)}. Logging expenses as they happen keeps your plan accurate.`,
      };
    case 'pace_unsustainable':
      return {
        title: 'You may run short',
        detail: `At your current pace (${m(s.currentPace ?? 0)}/day), you may use about ${m(-(s.projectedEndFlexible ?? 0))} more than your flexible money before your next income.`,
        suggestion: `Recommended pace: ${m(s.upcomingDailyPace)}/day.`,
      };
    case 'pace_above_safe':
      return {
        title: "You're spending a bit faster than your pace",
        detail: `Your recent average is ${m(s.currentPace ?? 0)}/day. Your sustainable pace is ${m(s.dailyAllowance)}/day.`,
        suggestion: `Keeping the next few days around ${m(s.upcomingDailyPace)} should bring you back on track.`,
      };
    case 'over_today':
      return {
        title: "You've gone past today's pace",
        detail: `You've spent ${m(s.spentToday)} today, ${m(-s.remainingToday)} more than today's ${m(s.dailyAllowance)}.`,
        suggestion: `No problem. Your pace for the coming days adjusts to about ${m(s.upcomingDailyPace)}.`,
      };
    case 'over_yesterday':
      return {
        title: 'Yesterday went over your pace',
        detail: 'No problem, it happens. Your plan has already adjusted.',
        suggestion: `Try keeping the next few days around ${m(s.dailyAllowance)}.`,
      };
    case 'routine_above_safe':
      return {
        title: 'Your normal routine costs more than your safe pace',
        detail: routineLine,
        suggestion: 'Trimming a few small things on some days keeps your bills and savings covered.',
      };
    case 'below_pace':
      return {
        title: 'You have breathing room',
        detail: `Your recent average is ${m(s.currentPace ?? 0)}/day. Your safe pace is ${m(s.dailyAllowance)}/day.`,
        suggestion: 'What you don’t spend spreads over the coming days, so your pace keeps rising.',
      };
    case 'routine_below_safe':
      return {
        title: "You're in a comfortable spot",
        detail: routineLine,
        suggestion: `That's around ${m(s.dailyAllowance - s.expectedDailyAverage)}/day of flexibility.`,
      };
    case 'steady':
      return {
        title: "You're on track",
        detail: s.hasRoutines
          ? routineLine
          : `You can safely spend about ${m(s.dailyAllowance)} a day until your next income.`,
        suggestion: null,
      };
  }
}

/** Turns engine output into short, supportive, non-judgmental copy. */
import type { FinancialStatus, RiskLevel, StatusReason } from './engine';
import { formatMoney, type CurrencyInfo, type Minor } from './money';

export interface Advice {
  title: string;
  detail: string;
  suggestion: string | null;
}

export const RISK_META: Record<RiskLevel, { emoji: string; label: string }> = {
  comfortable: { emoji: '🟢', label: 'Breathing room' },
  on_track: { emoji: '🟢', label: 'On track' },
  watch: { emoji: '🟡', label: 'Slow down a little' },
  at_risk: { emoji: '🔴', label: 'May run short' },
};

/** The status pill label: says exactly why the card has its color. */
export const STATUS_LABELS: Record<StatusReason, string> = {
  protected_exceeds_balance: 'Plan needs adjusting',
  no_flexible_money: 'Nothing left to spend',
  dipping_into_protected: 'Using protected money',
  untracked_spending: 'Balance lower than tracked',
  pace_unsustainable: 'May run short',
  very_tight: 'Very tight',
  pace_above_safe: 'Spending faster',
  over_today: 'Over today',
  almost_used_today: 'Almost used today',
  over_yesterday: 'Over yesterday',
  tight: 'Tight',
  on_track: 'On track',
  comfortable: 'Breathing room',
};

export function buildAdvice(s: FinancialStatus, currency: CurrencyInfo): Advice {
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const normalDay = `${s.normalDaySource === 'routines' ? 'your normal day' : 'a normal day'} (about ${m(s.normalDay)})`;
  const setNormalDay =
    s.normalDaySource === 'default' ? ' You can set what a normal day costs you in Rules → Protections.' : '';

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
    case 'very_tight':
      return {
        title: 'Very tight until your next income',
        detail: `Your safe pace is ${m(s.dailyAllowance)}/day, less than half of ${normalDay}.`,
        suggestion: `Sticking to essentials keeps your bills and savings covered. Adding income or lowering savings for this cycle would give you more room.${setNormalDay}`,
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
    case 'almost_used_today':
      return {
        title: s.remainingToday <= 0 ? "You've used today's amount" : "You've almost used today's amount",
        detail: `${m(Math.max(0, s.remainingToday))} left of today's ${m(s.dailyAllowance)}.`,
        suggestion: "Whatever you don't spend today spreads over the coming days.",
      };
    case 'over_yesterday':
      return {
        title: 'Yesterday went over your pace',
        detail: 'No problem, it happens. Your plan has already adjusted.',
        suggestion: `Try keeping the next few days around ${m(s.dailyAllowance)}.`,
      };
    case 'tight':
      return {
        title: 'A bit tight',
        detail: `Your safe pace is ${m(s.dailyAllowance)}/day, a little under ${normalDay}.`,
        suggestion: `Keeping days around ${m(s.dailyAllowance)} covers everything until your next income.${setNormalDay}`,
      };
    case 'on_track':
      return {
        title: "You're on track",
        detail: `Your safe pace is ${m(s.dailyAllowance)}/day, enough for ${normalDay}.`,
        suggestion: s.currentPace !== null ? `Your recent average is ${m(s.currentPace)}/day.` : null,
      };
    case 'comfortable':
      return {
        title: 'You have breathing room',
        detail: `Your safe pace is ${m(s.dailyAllowance)}/day, well above ${normalDay}.`,
        suggestion: `That's around ${m(s.dailyAllowance - s.normalDay)}/day of flexibility.`,
      };
  }
}

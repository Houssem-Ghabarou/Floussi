/** Turns engine output into short, supportive, non-judgmental copy, in the chosen language. */
import { t, type TranslationKey } from '@/i18n';

import type { FinancialStatus, RiskLevel, StatusReason } from './engine';
import { formatMoney, type CurrencyInfo, type Minor } from './money';

export interface Advice {
  title: string;
  detail: string;
  suggestion: string | null;
}

export const RISK_EMOJI: Record<RiskLevel, string> = {
  comfortable: '🟢',
  on_track: '🟢',
  watch: '🟡',
  at_risk: '🔴',
};

export function riskLabel(level: RiskLevel): string {
  return t(`risk.${level}` as TranslationKey);
}

/** The status pill label: says exactly why the card has its color. */
export function statusLabel(reason: StatusReason): string {
  return t(`status.${reason}` as TranslationKey);
}

export function buildAdvice(s: FinancialStatus, currency: CurrencyInfo): Advice {
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const normalDay = t(s.normalDaySource === 'routines' ? 'advice.normalDay.routines' : 'advice.normalDay.custom', {
    amount: m(s.normalDay),
  });
  // Only worth suggesting while the figure is still the currency's default.
  const setNormalDay = s.normalDaySource === 'default' ? t('advice.setNormalDay') : '';

  switch (s.reason) {
    case 'protected_exceeds_balance': {
      const billsGap = s.billsProtected - s.balance;
      return {
        title: t('advice.protected_exceeds_balance.title'),
        detail: t('advice.protected_exceeds_balance.detail', {
          balance: m(s.balance),
          protected: m(s.protectedTotal),
        }),
        suggestion:
          billsGap > 0
            ? t('advice.protected_exceeds_balance.bills', { gap: m(billsGap) })
            : t('advice.protected_exceeds_balance.reserves', { gap: m(-s.flexibleStartOfDay) }),
      };
    }
    case 'no_flexible_money':
      return {
        title: t('advice.no_flexible_money.title'),
        detail: t('advice.no_flexible_money.detail'),
        suggestion: t('advice.no_flexible_money.suggestion'),
      };
    case 'dipping_into_protected':
      return {
        title: t('advice.dipping_into_protected.title'),
        detail: t('advice.dipping_into_protected.detail', { amount: m(-s.flexibleNow) }),
        suggestion: t('advice.dipping_into_protected.suggestion'),
      };
    case 'untracked_spending':
      return {
        title: t('advice.untracked_spending.title'),
        detail: t('advice.untracked_spending.detail', {
          amount: m(s.recentUntrackedSpending),
          before: m(s.paceWithoutUntracked),
          after: m(s.dailyAllowance),
        }),
        suggestion: t('advice.untracked_spending.suggestion', { pace: m(s.upcomingDailyPace) }),
      };
    case 'pace_unsustainable':
      return {
        title: t('advice.pace_unsustainable.title'),
        detail: t('advice.pace_unsustainable.detail', {
          pace: m(s.currentPace ?? 0),
          gap: m(-(s.projectedEndFlexible ?? 0)),
        }),
        suggestion: t('advice.pace_unsustainable.suggestion', { pace: m(s.upcomingDailyPace) }),
      };
    case 'very_tight':
      return {
        title: t('advice.very_tight.title'),
        detail: t('advice.very_tight.detail', { pace: m(s.dailyAllowance), normalDay }),
        suggestion: `${t('advice.very_tight.suggestion')}${setNormalDay}`,
      };
    case 'pace_above_safe':
      return {
        title: t('advice.pace_above_safe.title'),
        detail: t('advice.pace_above_safe.detail', { current: m(s.currentPace ?? 0), pace: m(s.dailyAllowance) }),
        suggestion: t('advice.pace_above_safe.suggestion', { pace: m(s.upcomingDailyPace) }),
      };
    case 'over_today':
      return {
        title: t('advice.over_today.title'),
        detail: t('advice.over_today.detail', {
          spent: m(s.spentToday),
          over: m(-s.remainingToday),
          allowance: m(s.dailyAllowance),
        }),
        suggestion: t('advice.over_today.suggestion', { pace: m(s.upcomingDailyPace) }),
      };
    case 'almost_used_today':
      return {
        title: t(s.remainingToday <= 0 ? 'advice.almost_used_today.titleUsed' : 'advice.almost_used_today.title'),
        detail: t('advice.almost_used_today.detail', {
          left: m(Math.max(0, s.remainingToday)),
          allowance: m(s.dailyAllowance),
        }),
        suggestion: t('advice.almost_used_today.suggestion'),
      };
    case 'over_yesterday':
      return {
        title: t('advice.over_yesterday.title'),
        detail: t('advice.over_yesterday.detail'),
        suggestion: t('advice.over_yesterday.suggestion', { pace: m(s.dailyAllowance) }),
      };
    case 'tight':
      return {
        title: t('advice.tight.title'),
        detail: t('advice.tight.detail', { pace: m(s.dailyAllowance), normalDay }),
        suggestion: `${t('advice.tight.suggestion', { pace: m(s.dailyAllowance) })}${setNormalDay}`,
      };
    case 'on_track':
      return {
        title: t('advice.on_track.title'),
        detail: t('advice.on_track.detail', { pace: m(s.dailyAllowance), normalDay }),
        suggestion: s.currentPace !== null ? t('advice.on_track.suggestion', { current: m(s.currentPace) }) : null,
      };
    case 'comfortable':
      return {
        title: t('advice.comfortable.title'),
        detail: t('advice.comfortable.detail', { pace: m(s.dailyAllowance), normalDay }),
        suggestion: t('advice.comfortable.suggestion', { amount: m(s.dailyAllowance - s.normalDay) }),
      };
  }
}

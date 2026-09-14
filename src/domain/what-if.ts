/** "Can I afford this?" — evaluates a purchase without recording it. */
import type { FinancialStatus, RiskLevel } from './engine';
import { formatMoney, type CurrencyInfo, type Minor } from './money';

export type WhatIfLevel =
  | 'comfortable'
  | 'tighter'
  | 'significant'
  | 'touches_protected'
  | 'touches_bills'
  | 'exceeds_balance';

export interface WhatIfResult {
  level: WhatIfLevel;
  riskLevel: RiskLevel;
  paceBefore: Minor;
  paceAfter: Minor;
  title: string;
  detail: string;
}

export const WHAT_IF_THRESHOLDS = {
  /** Pace keeps at least this share → comfortable. */
  comfortableRatio: 0.8,
  /** Pace keeps at least this share → tighter; below → significant. */
  tighterRatio: 0.65,
} as const;

const PROTECTED_LINE = 'Your bills, savings and minimum balance stay protected.';

export function evaluateWhatIf(status: FinancialStatus, amount: Minor, currency: CurrencyInfo): WhatIfResult {
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const paceBefore = status.dailyAllowance;
  const paceAfter = Math.max(0, Math.floor((status.flexibleStartOfDay - amount) / status.daysRemaining));
  const flexibleAfter = status.flexibleNow - amount;
  const base = { paceBefore, paceAfter };

  if (amount > status.balance) {
    return {
      ...base,
      level: 'exceeds_balance',
      riskLevel: 'at_risk',
      title: "That's more than you have right now",
      detail: `You have ${m(status.balance)} available.`,
    };
  }
  if (status.balance - amount < status.billsProtected) {
    return {
      ...base,
      level: 'touches_bills',
      riskLevel: 'at_risk',
      title: 'This would put your bills at risk',
      detail: `You'd have ${m(status.balance - amount)} left, but ${m(status.billsProtected)} in bills are due before your next income.`,
    };
  }
  if (flexibleAfter < 0) {
    return {
      ...base,
      level: 'touches_protected',
      riskLevel: 'at_risk',
      title: 'This would dip into your protected money',
      detail: `It would use ${m(Math.min(amount, -flexibleAfter))} of the money set aside for savings and your minimum balance.`,
    };
  }

  const ratio = paceBefore > 0 ? paceAfter / paceBefore : 0;
  const belowRoutine = status.hasRoutines && paceAfter < status.expectedDailyAverage;
  const routineLine = belowRoutine ? ` That's below your normal day of ${m(status.expectedDailyAverage)}.` : '';

  if (ratio >= WHAT_IF_THRESHOLDS.comfortableRatio && !belowRoutine) {
    return {
      ...base,
      level: 'comfortable',
      riskLevel: 'comfortable',
      title: 'Looks comfortable',
      detail: `Your safe pace would stay around ${m(paceAfter)}/day. ${PROTECTED_LINE}`,
    };
  }
  if (ratio >= WHAT_IF_THRESHOLDS.tighterRatio) {
    return {
      ...base,
      level: 'tighter',
      riskLevel: 'watch',
      title: 'Possible, but the rest of the cycle gets tighter',
      detail: `${PROTECTED_LINE}${routineLine}`,
    };
  }
  return {
    ...base,
    level: 'significant',
    riskLevel: 'at_risk',
    title: 'This would significantly reduce your daily flexibility',
    detail: `${PROTECTED_LINE}${routineLine}`,
  };
}

/** "Can I afford this?" — evaluates a purchase without recording it, in the chosen language. */
import { t } from '@/i18n';

import { THRESHOLDS, type FinancialStatus, type RiskLevel } from './engine';
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

export function evaluateWhatIf(status: FinancialStatus, amount: Minor, currency: CurrencyInfo): WhatIfResult {
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const paceBefore = status.dailyAllowance;
  const paceAfter = Math.max(0, Math.floor((status.flexibleStartOfDay - amount) / status.daysRemaining));
  const flexibleAfter = status.flexibleNow - amount;
  const base = { paceBefore, paceAfter };
  const protectedLine = t('whatIf.protectedLine');

  if (amount > status.balance) {
    return {
      ...base,
      level: 'exceeds_balance',
      riskLevel: 'at_risk',
      title: t('whatIf.exceedsBalance.title'),
      detail: t('whatIf.exceedsBalance.detail', { amount: m(status.balance) }),
    };
  }
  if (status.balance - amount < status.billsProtected) {
    return {
      ...base,
      level: 'touches_bills',
      riskLevel: 'at_risk',
      title: t('whatIf.touchesBills.title'),
      detail: t('whatIf.touchesBills.detail', {
        left: m(status.balance - amount),
        bills: m(status.billsProtected),
      }),
    };
  }
  if (flexibleAfter < 0) {
    return {
      ...base,
      level: 'touches_protected',
      riskLevel: 'at_risk',
      title: t('whatIf.touchesProtected.title'),
      detail: t('whatIf.touchesProtected.detail', { amount: m(Math.min(amount, -flexibleAfter)) }),
    };
  }

  const ratio = paceBefore > 0 ? paceAfter / paceBefore : 0;
  // Same references as the status color: a pace under a normal day is never "comfortable",
  // and under half a normal day it's a significant impact.
  const belowNormalDay = paceAfter < status.normalDay;
  const veryTight = paceAfter < status.normalDay * THRESHOLDS.veryTightBelow;
  const routineLine = belowNormalDay ? t('whatIf.belowNormalDay', { amount: m(status.normalDay) }) : '';

  if (ratio >= WHAT_IF_THRESHOLDS.comfortableRatio && !belowNormalDay) {
    return {
      ...base,
      level: 'comfortable',
      riskLevel: 'comfortable',
      title: t('whatIf.comfortable.title'),
      detail: t('whatIf.comfortable.detail', { pace: m(paceAfter), protected: protectedLine }),
    };
  }
  if (ratio >= WHAT_IF_THRESHOLDS.tighterRatio && !veryTight) {
    return {
      ...base,
      level: 'tighter',
      riskLevel: 'watch',
      title: t('whatIf.tighter.title'),
      detail: `${protectedLine}${routineLine}`,
    };
  }
  return {
    ...base,
    level: 'significant',
    riskLevel: 'at_risk',
    title: t('whatIf.significant.title'),
    detail: `${protectedLine}${routineLine}`,
  };
}

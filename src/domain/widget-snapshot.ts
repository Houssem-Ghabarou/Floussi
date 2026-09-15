/**
 * What the home-screen widgets show. Pure: the Android widget renders these props directly, and the iOS
 * widget receives them on a timeline (today now, tomorrow from midnight).
 */
import { STATUS_LABELS } from './advice';
import { addDays, type LocalDate } from './dates';
import { buildFinancialInput } from './derive';
import { calculateFinancialStatus, type RiskLevel } from './engine';
import { formatAmount, formatMoney, getCurrency } from './money';
import type { AppData } from './types';

export type WidgetTone = 'good' | 'watch' | 'risk';

export interface WidgetProps {
  /** False before onboarding: the widget invites the user to set up a plan. */
  ready: boolean;
  hidden: boolean;
  amount: string;
  currency: string;
  /** 'safe today' before spending, 'left today' after. */
  caption: string;
  status: string;
  tone: WidgetTone;
  balance: string;
  payday: string;
}

export const EMPTY_WIDGET: WidgetProps = {
  ready: false,
  hidden: false,
  amount: '',
  currency: '',
  caption: 'Open Flousey to set up your plan',
  status: '',
  tone: 'good',
  balance: '',
  payday: '',
};

export const HIDDEN_AMOUNT = '•••';

const TONES: Record<RiskLevel, WidgetTone> = {
  comfortable: 'good',
  on_track: 'good',
  watch: 'watch',
  at_risk: 'risk',
};

/** The widget content for `day`, from the same engine as the Today screen. */
export function widgetPropsFor(data: AppData, day: LocalDate): WidgetProps {
  const status = calculateFinancialStatus(buildFinancialInput(data, day));
  const currency = getCurrency(data.settings.currency);
  const hidden = data.settings.widgetHideAmounts === true;
  const spent = status.spentToday > 0;
  const amount = spent ? Math.max(0, status.remainingToday) : status.dailyAllowance;
  const days = status.daysUntilIncome;

  return {
    ready: true,
    hidden,
    amount: hidden ? HIDDEN_AMOUNT : formatAmount(amount, currency, { whole: true }),
    currency: currency.label,
    caption: spent ? 'left today' : 'safe today',
    status: STATUS_LABELS[status.reason],
    tone: TONES[status.riskLevel],
    balance: hidden ? `${HIDDEN_AMOUNT} available` : `${formatMoney(status.balance, currency, { whole: true })} available`,
    payday: status.incomeDue ? 'Income expected' : `${days} ${days === 1 ? 'day' : 'days'} to payday`,
  };
}

export interface WidgetEntry {
  date: LocalDate;
  props: WidgetProps;
}

/** Today's content, then tomorrow's from midnight, so the widget moves on even if the app isn't opened. */
export function widgetTimeline(data: AppData | null, today: LocalDate): WidgetEntry[] {
  if (!data) return [{ date: today, props: EMPTY_WIDGET }];
  const tomorrow = addDays(today, 1);
  return [
    { date: today, props: widgetPropsFor(data, today) },
    { date: tomorrow, props: widgetPropsFor(data, tomorrow) },
  ];
}

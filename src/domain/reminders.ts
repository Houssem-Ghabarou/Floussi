/**
 * Local reminders: what to schedule on this phone. Pure — the platform layer only turns this plan into
 * notifications. Texts only state facts that stay true until they fire (no amounts to spend, no status),
 * because a scheduled notification can't be updated once the day comes.
 */
import { billOccurrences } from './bills';
import { addDays, type LocalDate } from './dates';
import { formatMoney, getCurrency } from './money';
import type { AppData, ReminderPreferences, Settings } from './types';

export const DEFAULT_REMINDERS: ReminderPreferences = {
  bills: true,
  payday: true,
  checkIn: false,
  checkInMinutes: 20 * 60,
  inactivity: true,
};

export function reminderPreferences(settings: Settings): ReminderPreferences {
  return { ...DEFAULT_REMINDERS, ...settings.reminders };
}

export const MORNING_MINUTES = 9 * 60;
export const EVENING_MINUTES = 19 * 60;
/** "Quick money check?" goes out this many days after the app was last opened. */
export const INACTIVITY_DAYS = 3;
/** iOS keeps at most 64 pending local notifications. */
export const MAX_REMINDERS = 60;
const BILL_HORIZON_DAYS = 62;

export type ReminderSchedule =
  | { type: 'once'; date: LocalDate; minutes: number }
  | { type: 'daily'; minutes: number };

export interface PlannedReminder {
  /** Stable, so the same reminder keeps the same identity across reschedules. */
  id: string;
  kind: 'bill' | 'payday' | 'check_in' | 'inactivity';
  title: string;
  body: string;
  /** Screen opened when the notification is tapped. */
  url: string;
  schedule: ReminderSchedule;
}

/** Everything to schedule from now on. Called whenever the app opens or the data changes. */
export function planReminders(data: AppData, today: LocalDate, nowMinutes: number): PlannedReminder[] {
  const { settings, cycle, bills, transactions } = data;
  if (!settings.onboarded) return [];
  const preferences = reminderPreferences(settings);
  const currency = getCurrency(settings.currency);
  const stillAhead = (date: LocalDate, minutes: number) => date > today || (date === today && minutes > nowMinutes);
  const once: PlannedReminder[] = [];

  if (preferences.bills) {
    for (const { bill, dueDate, paid } of billOccurrences(bills, transactions, today, addDays(today, BILL_HORIZON_DAYS))) {
      // A one-off bill without a date is due "before the next income": there is no day to remind about.
      if (paid || (!bill.recurring && !bill.dueDate)) continue;
      const date = addDays(dueDate, -1);
      if (!stillAhead(date, MORNING_MINUTES)) continue;
      once.push({
        id: `bill:${bill.id}:${dueDate}`,
        kind: 'bill',
        title: `${bill.emoji} ${bill.name} is due tomorrow`,
        body: `${formatMoney(bill.amount, currency)}. Tap to mark it paid once it's done.`,
        url: `/pay-bill?billId=${encodeURIComponent(bill.id)}&dueDate=${dueDate}`,
        schedule: { type: 'once', date, minutes: MORNING_MINUTES },
      });
    }
  }

  if (preferences.payday && stillAhead(cycle.nextIncomeDate, MORNING_MINUTES)) {
    const irregular = cycle.frequency === 'irregular';
    once.push({
      id: `payday:${cycle.id}:${cycle.nextIncomeDate}`,
      kind: 'payday',
      title: irregular
        ? '📅 Your plan reaches its end date today'
        : `💼 Your ${cycle.incomeLabel.toLowerCase()} is expected today`,
      body: irregular
        ? 'Add the money you received, or move the date.'
        : 'Did it arrive? Add it to start your next cycle.',
      url: '/income?cycleIncome=1',
      schedule: { type: 'once', date: cycle.nextIncomeDate, minutes: MORNING_MINUTES },
    });
  }

  // Rescheduled at every launch, so it only fires after a few days without opening the app.
  // The daily check-in already brings people back, so the two never both go out.
  if (preferences.inactivity && !preferences.checkIn) {
    once.push({
      id: 'inactivity',
      kind: 'inactivity',
      title: 'Quick money check?',
      body: 'See how much you can safely spend today.',
      url: '/',
      schedule: { type: 'once', date: addDays(today, INACTIVITY_DAYS), minutes: EVENING_MINUTES },
    });
  }

  const daily: PlannedReminder[] = preferences.checkIn
    ? [
        {
          id: 'check-in',
          kind: 'check_in',
          title: '🌙 Your money check-in is ready',
          body: 'See where you stand today.',
          url: '/',
          schedule: { type: 'daily', minutes: preferences.checkInMinutes },
        },
      ]
    : [];

  const order = (reminder: PlannedReminder) =>
    reminder.schedule.type === 'once' ? `${reminder.schedule.date} ${String(reminder.schedule.minutes).padStart(4, '0')}` : '';
  once.sort((a, b) => order(a).localeCompare(order(b)));
  return [...daily, ...once].slice(0, MAX_REMINDERS);
}

/** '20:00' */
export function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

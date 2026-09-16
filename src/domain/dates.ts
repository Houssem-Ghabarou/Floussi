/**
 * Calendar dates are stored as local 'YYYY-MM-DD' strings. Money math is done per calendar day,
 * so using strings (and UTC arithmetic internally) avoids time-zone and DST shifts.
 */
export type LocalDate = string;

const MS_PER_DAY = 86_400_000;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function splitDate(date: LocalDate): [year: number, month: number, day: number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

function toUtcMs(date: LocalDate): number {
  const [year, month, day] = splitDate(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function toLocalDate(date: Date = new Date()): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Builds a date in the given month (months may overflow), clamping the day to the month's length. */
export function dateInMonth(year: number, month: number, day: number): LocalDate {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth() + 1;
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function addMonths(date: LocalDate, months: number, dayOfMonth?: number): LocalDate {
  const [year, month, day] = splitDate(date);
  return dateInMonth(year, month + months, dayOfMonth ?? day);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export function eachDay(from: LocalDate, toExclusive: LocalDate): LocalDate[] {
  const count = daysBetween(from, toExclusive);
  const days: LocalDate[] = [];
  for (let i = 0; i < count; i++) days.push(addDays(from, i));
  return days;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

/**
 * Month and weekday names, and the order they appear in, come from the chosen language
 * ("Monday, September 14", "lundi 14 septembre", "الاثنين، 14 سبتمبر"). English is the default.
 */
export interface DateNames {
  months: string[];
  monthsShort: string[];
  weekdays: string[];
  weekdaysShort: string[];
  today: string;
  yesterday: string;
  tomorrow: string;
  /** Lowercase forms used inside a sentence ("expected tomorrow"). */
  todayLower: string;
  yesterdayLower: string;
  tomorrowLower: string;
  inDays: (days: number) => string;
  daysAgo: (days: number) => string;
  short: (day: number, month: string) => string;
  long: (weekday: string, day: number, month: string) => string;
  monthYear: (month: string, year: number) => string;
  shortWithWeekday: (weekdayShort: string, short: string) => string;
}

const ENGLISH: DateNames = {
  months: MONTH_NAMES,
  monthsShort: MONTH_NAMES.map((month) => month.slice(0, 3)),
  weekdays: WEEKDAY_NAMES,
  weekdaysShort: WEEKDAY_SHORT,
  today: 'Today',
  yesterday: 'Yesterday',
  tomorrow: 'Tomorrow',
  todayLower: 'today',
  yesterdayLower: 'yesterday',
  tomorrowLower: 'tomorrow',
  inDays: (days) => `in ${days} days`,
  daysAgo: (days) => `${days} days ago`,
  short: (day, month) => `${month} ${day}`,
  long: (weekday, day, month) => `${weekday}, ${month} ${day}`,
  monthYear: (month, year) => `${month} ${year}`,
  shortWithWeekday: (weekdayShort, short) => `${weekdayShort}, ${short}`,
};

let names: DateNames = ENGLISH;

/** Called when the language changes; without it, dates stay English. */
export function setDateNames(next: DateNames) {
  names = next;
}

export function monthName(month: number): string {
  return names.months[month - 1];
}

export function weekdayName(index: number): string {
  return names.weekdays[index];
}

export function weekdayShortName(index: number): string {
  return names.weekdaysShort[index];
}

/** 'Sep 30' */
export function formatShortDate(date: LocalDate): string {
  const [, month, day] = splitDate(date);
  return names.short(day, names.monthsShort[month - 1]);
}

/** 'Monday, September 14' */
export function formatLongDate(date: LocalDate): string {
  const [, month, day] = splitDate(date);
  return names.long(names.weekdays[weekday(date)], day, names.months[month - 1]);
}

/** 'September 2026' */
export function formatMonthYear(date: LocalDate): string {
  const [year, month] = splitDate(date);
  return names.monthYear(names.months[month - 1], year);
}

/** '1:15 PM' in local time. */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  return `${hours % 12 || 12}:${pad(d.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** 'Today', 'Yesterday', 'Tomorrow' or 'Mon, Sep 14' */
export function formatRelativeDay(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return names.today;
  if (diff === -1) return names.yesterday;
  if (diff === 1) return names.tomorrow;
  return names.shortWithWeekday(names.weekdaysShort[weekday(date)], formatShortDate(date));
}

/** 'today', 'tomorrow', 'in 3 days', '2 days ago' */
export function formatDaysFromNow(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return names.todayLower;
  if (diff === 1) return names.tomorrowLower;
  if (diff === -1) return names.yesterdayLower;
  return diff > 0 ? names.inDays(diff) : names.daysAgo(-diff);
}

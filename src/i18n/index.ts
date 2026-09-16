/**
 * Translations. One catalog per language, typed against English: a missing or misspelled key is a
 * compile error, never a blank screen. Text comes from `t('some.key')`, with `{name}` placeholders.
 */
import { setDateNames, type DateNames } from '@/domain/dates';
import type { Language } from '@/domain/types';

import ar from './ar';
import en, { type TranslationKey } from './en';
import fr from './fr';

export const LANGUAGES = ['en', 'fr', 'ar'] as const satisfies readonly Language[];
export type { Language };

/** Shown in the language picker, each in its own language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

const CATALOGS: Record<Language, Record<TranslationKey, string>> = { en, fr, ar };

export function isRightToLeft(language: Language): boolean {
  return language === 'ar';
}

let current: Language = 'en';

export function currentLanguage(): Language {
  return current;
}

/** Date order differs by language: "Monday, September 14" but "lundi 14 septembre". */
const DATE_FORMATS: Record<Language, Pick<DateNames, 'short' | 'long' | 'monthYear' | 'shortWithWeekday'>> = {
  en: {
    short: (day, month) => `${month} ${day}`,
    long: (weekday, day, month) => `${weekday}, ${month} ${day}`,
    monthYear: (month, year) => `${month} ${year}`,
    shortWithWeekday: (weekdayShort, short) => `${weekdayShort}, ${short}`,
  },
  fr: {
    short: (day, month) => `${day} ${month}`,
    long: (weekday, day, month) => `${weekday} ${day} ${month}`,
    monthYear: (month, year) => `${month} ${year}`,
    shortWithWeekday: (weekdayShort, short) => `${weekdayShort} ${short}`,
  },
  ar: {
    short: (day, month) => `${day} ${month}`,
    long: (weekday, day, month) => `${weekday}، ${day} ${month}`,
    monthYear: (month, year) => `${month} ${year}`,
    shortWithWeekday: (weekdayShort, short) => `${weekdayShort}، ${short}`,
  },
};

/** Applies a language to every text in the app, dates included. */
export function setLanguage(language: Language) {
  current = language;
  setDateNames({
    months: MONTH_KEYS.map((key) => t(key)),
    monthsShort: MONTH_SHORT_KEYS.map((key) => t(key)),
    weekdays: WEEKDAY_KEYS.map((key) => t(key)),
    weekdaysShort: WEEKDAY_SHORT_KEYS.map((key) => t(key)),
    today: t('date.today'),
    yesterday: t('date.yesterday'),
    tomorrow: t('date.tomorrow'),
    todayLower: t('date.todayLower'),
    yesterdayLower: t('date.yesterdayLower'),
    tomorrowLower: t('date.tomorrowLower'),
    inDays: (days: number) => tn('date.inDays', days),
    daysAgo: (days: number) => tn('date.daysAgo', days),
    ...DATE_FORMATS[language],
  });
}

type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function t(key: TranslationKey, params?: Params): string {
  return fill(CATALOGS[current][key] ?? en[key], params);
}

/**
 * Plural form of a key: `key.one`, `key.other`, and for Arabic also `zero`, `two`, `few` and `many`.
 * The count is available as `{count}`.
 */
export function tn(key: string, count: number, params?: Params): string {
  const form = pluralForm(count, current);
  const catalog = CATALOGS[current] as Record<string, string>;
  const template = catalog[`${key}.${form}`] ?? catalog[`${key}.other`] ?? (en as Record<string, string>)[`${key}.other`];
  return fill(template ?? key, { count, ...params });
}

function pluralForm(count: number, language: Language): string {
  if (language === 'ar') {
    if (count === 0) return 'zero';
    if (count === 1) return 'one';
    if (count === 2) return 'two';
    const rest = count % 100;
    if (rest >= 3 && rest <= 10) return 'few';
    if (rest >= 11) return 'many';
    return 'other';
  }
  // French keeps the singular for 0 ("0 jour"), English does not ("0 days").
  if (language === 'fr') return count <= 1 ? 'one' : 'other';
  return count === 1 ? 'one' : 'other';
}

const MONTH_KEYS = [
  'month.1',
  'month.2',
  'month.3',
  'month.4',
  'month.5',
  'month.6',
  'month.7',
  'month.8',
  'month.9',
  'month.10',
  'month.11',
  'month.12',
] as const satisfies readonly TranslationKey[];

const MONTH_SHORT_KEYS = [
  'monthShort.1',
  'monthShort.2',
  'monthShort.3',
  'monthShort.4',
  'monthShort.5',
  'monthShort.6',
  'monthShort.7',
  'monthShort.8',
  'monthShort.9',
  'monthShort.10',
  'monthShort.11',
  'monthShort.12',
] as const satisfies readonly TranslationKey[];

const WEEKDAY_KEYS = [
  'weekday.0',
  'weekday.1',
  'weekday.2',
  'weekday.3',
  'weekday.4',
  'weekday.5',
  'weekday.6',
] as const satisfies readonly TranslationKey[];

const WEEKDAY_SHORT_KEYS = [
  'weekdayShort.0',
  'weekdayShort.1',
  'weekdayShort.2',
  'weekdayShort.3',
  'weekdayShort.4',
  'weekdayShort.5',
  'weekdayShort.6',
] as const satisfies readonly TranslationKey[];

export type { TranslationKey };

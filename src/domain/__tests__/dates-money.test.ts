import {
  addDays,
  addMonths,
  dateInMonth,
  daysBetween,
  eachDay,
  formatLongDate,
  formatRelativeDay,
  weekday,
} from '../dates';
import { setLanguage } from '@/i18n';

import { amountToInput, formatAmount, formatMoney, getCurrency, parseAmount, sanitizeAmountInput } from '../money';

const TND = getCurrency('TND');
const EUR = getCurrency('EUR');

describe('dates', () => {
  it('counts days between local dates', () => {
    expect(daysBetween('2026-09-14', '2026-09-30')).toBe(16);
    expect(daysBetween('2026-09-30', '2026-09-14')).toBe(-16);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps days to the month length and overflows months', () => {
    expect(dateInMonth(2026, 2, 31)).toBe('2026-02-28');
    expect(dateInMonth(2028, 2, 30)).toBe('2028-02-29');
    expect(dateInMonth(2026, 13, 5)).toBe('2027-01-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('knows weekdays and formats dates', () => {
    expect(weekday('2026-09-14')).toBe(1);
    expect(formatLongDate('2026-09-14')).toBe('Monday, September 14');
    expect(formatRelativeDay('2026-09-13', '2026-09-14')).toBe('Yesterday');
    expect(formatRelativeDay('2026-09-10', '2026-09-14')).toBe('Thu, Sep 10');
  });

  it('lists each day in a half-open range', () => {
    expect(eachDay('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(eachDay('2026-09-29', '2026-09-29')).toEqual([]);
  });
});

describe('money', () => {
  it('parses user input into minor units', () => {
    expect(parseAmount('12', TND)).toBe(12_000);
    expect(parseAmount('12.5', TND)).toBe(12_500);
    expect(parseAmount('12,500', TND)).toBe(12_500);
    expect(parseAmount('0.004', TND)).toBe(4);
    expect(parseAmount('1.2345', TND)).toBe(1_234);
    expect(parseAmount('9.99', EUR)).toBe(999);
    expect(parseAmount('', TND)).toBeNull();
    expect(parseAmount('abc', TND)).toBeNull();
  });

  it('sanitizes typing', () => {
    expect(sanitizeAmountInput('12,3456', TND)).toBe('12.345');
    expect(sanitizeAmountInput('007', TND)).toBe('7');
    expect(sanitizeAmountInput('.5', TND)).toBe('0.5');
    expect(sanitizeAmountInput('1.2.3', EUR)).toBe('1.23');
  });

  it('formats amounts', () => {
    expect(formatMoney(1_240_000, TND)).toBe('1,240 TND');
    expect(formatAmount(12_500, TND)).toBe('12.5');
    expect(formatAmount(36_875, TND, { whole: true })).toBe('37');
    expect(formatAmount(-4_000, TND)).toBe('−4');
    expect(formatAmount(300_000, TND, { signed: true })).toBe('+300');
    expect(amountToInput(-12_500, TND)).toBe('12.5');
    expect(amountToInput(1_240_000, TND)).toBe('1240');
  });

  it('writes the currency in the chosen language', () => {
    setLanguage('ar');
    expect(formatMoney(42_000, TND)).toBe('42 د.ت');
    setLanguage('fr');
    expect(formatMoney(999, getCurrency('EUR'))).toBe('9.99 €');
    setLanguage('en');
    expect(formatMoney(42_000, TND)).toBe('42 TND');
  });

  it('supports the British pound', () => {
    const GBP = getCurrency('GBP');
    expect(GBP.code).toBe('GBP');
    expect(parseAmount('12.50', GBP)).toBe(1_250);
    expect(formatMoney(1_250, GBP)).toBe('12.5 GBP');
    expect(sanitizeAmountInput('3.456', GBP)).toBe('3.45');
  });
});

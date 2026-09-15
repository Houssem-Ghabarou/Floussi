/**
 * Money is stored as integers in the currency's minor unit (TND: 1 dinar = 1000 millimes)
 * so sums never accumulate floating-point errors.
 */
export type Minor = number;

export interface CurrencyInfo {
  code: string;
  label: string;
  decimals: number;
  /** Default cost of a normal day (major units), until the user sets their own or adds routines. */
  typicalDailyNeed: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'TND', label: 'TND', decimals: 3, typicalDailyNeed: 15 },
  { code: 'EUR', label: 'EUR', decimals: 2, typicalDailyNeed: 20 },
  { code: 'USD', label: 'USD', decimals: 2, typicalDailyNeed: 20 },
  { code: 'GBP', label: 'GBP', decimals: 2, typicalDailyNeed: 15 },
  { code: 'MAD', label: 'MAD', decimals: 2, typicalDailyNeed: 60 },
  { code: 'DZD', label: 'DZD', decimals: 2, typicalDailyNeed: 1000 },
];

export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES.find((currency) => currency.code === code) ?? CURRENCIES[0];
}

export function defaultDailyNeed(currency: CurrencyInfo): Minor {
  return fromMajor(currency.typicalDailyNeed, currency);
}

export function minorFactor(currency: CurrencyInfo): number {
  return 10 ** currency.decimals;
}

export function fromMajor(major: number, currency: CurrencyInfo): Minor {
  return Math.round(major * minorFactor(currency));
}

/** Keeps only what a money input may contain: digits, one separator, limited decimals. */
export function sanitizeAmountInput(text: string, currency: CurrencyInfo): string {
  const normalized = text.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
  if (rest.length === 0) return trimmedWhole;
  return `${trimmedWhole || '0'}.${rest.join('').slice(0, currency.decimals)}`;
}

/** Parses user input like '12', '12.5' or '12,500'. Returns null when empty or invalid. */
export function parseAmount(text: string, currency: CurrencyInfo): Minor | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '.' || !/^\d*(\.\d*)?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const fractionDigits = fraction.slice(0, currency.decimals).padEnd(currency.decimals, '0');
  return Number(whole || '0') * minorFactor(currency) + Number(fractionDigits || '0');
}

/** Converts a stored amount back to an editable string ('12.5'). */
export function amountToInput(minor: Minor, currency: CurrencyInfo): string {
  return formatAmount(Math.abs(minor), currency).replace(/,/g, '');
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface FormatOptions {
  /** Round to whole units (used for paces and advice). */
  whole?: boolean;
  /** Prefix positive amounts with '+'. */
  signed?: boolean;
}

export function formatAmount(minor: Minor, currency: CurrencyInfo, options: FormatOptions = {}): string {
  const factor = minorFactor(currency);
  const absolute = Math.abs(minor);
  const sign = minor < 0 ? '−' : options.signed && minor > 0 ? '+' : '';

  if (options.whole) {
    return `${sign}${groupThousands(Math.round(absolute / factor))}`;
  }

  const whole = Math.floor(absolute / factor);
  const fraction = absolute % factor;
  const fractionText = fraction
    ? `.${String(fraction).padStart(currency.decimals, '0').replace(/0+$/, '')}`
    : '';
  return `${sign}${groupThousands(whole)}${fractionText}`;
}

export function formatMoney(minor: Minor, currency: CurrencyInfo, options: FormatOptions = {}): string {
  return `${formatAmount(minor, currency, options)} ${currency.label}`;
}

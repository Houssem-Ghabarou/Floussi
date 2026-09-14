import { useMemo } from 'react';

import { buildAdvice } from '@/domain/advice';
import { buildFinancialInput } from '@/domain/derive';
import { calculateFinancialStatus } from '@/domain/engine';
import { getCurrency } from '@/domain/money';
import type { AppData } from '@/domain/types';

import { currentCycle, useApp } from './app-store';

export function useAppData(): AppData | null {
  const settings = useApp((state) => state.settings);
  const cycles = useApp((state) => state.cycles);
  const transactions = useApp((state) => state.transactions);
  const bills = useApp((state) => state.bills);
  const routines = useApp((state) => state.routines);

  return useMemo(() => {
    const cycle = currentCycle(cycles);
    if (!settings || !cycle) return null;
    return { settings, cycle, transactions, bills, routines };
  }, [settings, cycles, transactions, bills, routines]);
}

/** Everything a screen needs to explain the user's situation, recomputed when data or the day changes. */
export function useFinancial() {
  const data = useAppData();
  const today = useApp((state) => state.today);

  return useMemo(() => {
    if (!data) return null;
    const input = buildFinancialInput(data, today);
    const status = calculateFinancialStatus(input);
    const currency = getCurrency(data.settings.currency);
    return { data, today, input, status, currency, advice: buildAdvice(status, currency) };
  }, [data, today]);
}
